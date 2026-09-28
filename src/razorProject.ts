import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { findProjectRoot } from './wpfImages';

export interface RazorFileInfo {
    path: string;
    name: string;
    text: string;
    /** The component's isolated CSS (X.razor.css), if any. */
    css: string | null;
    cssPath: string | null;
}

export interface StylesheetInfo {
    href: string;
    /** Local file (editable) or null for external sheets. */
    path: string | null;
    text: string | null;
    /** The generated CSS-isolation bundle ({Project}.styles.css): built by the designer from the .razor.css files. */
    scopedBundle?: boolean;
}

export interface RazorProjectInfo {
    root: string;
    files: RazorFileInfo[];
    stylesheets: StylesheetInfo[];
    baseUri: string;
    layoutName: string | null;
}

const SKIP_DIRS = new Set(['bin', 'obj', 'node_modules', '.git', '.vs', '.vscode', 'publish']);

function listFiles(dir: string, ext: string, out: string[], limit: number): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (out.length >= limit) {
            return;
        }
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) {
                listFiles(p, ext, out, limit);
            }
        } else if (e.name.endsWith(ext)) {
            out.push(p);
        }
    }
}

/** Current text of a file: the open editor's (possibly unsaved) text, else the file on disk. */
function readText(file: string): string | null {
    const open = vscode.workspace.textDocuments.find(d => d.uri.fsPath === file);
    if (open) {
        return open.getText();
    }
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}

/** Stylesheet hrefs of the app's host page: App.razor (Blazor Web App), index.html (WebAssembly), _Host/_Layout.cshtml (Server). */
function hostPageStylesheets(root: string, razorFiles: string[]): { hrefs: string[]; hostText: string | null } {
    const candidates = [
        ...razorFiles.filter(f => path.basename(f) === 'App.razor'),
        path.join(root, 'wwwroot', 'index.html'),
        path.join(root, 'Pages', '_Host.cshtml'),
        path.join(root, 'Pages', '_Layout.cshtml'),
        path.join(root, 'Views', 'Shared', '_Layout.cshtml'),
    ];
    for (const c of candidates) {
        const text = readText(c);
        if (!text || !/<link\b/i.test(text)) {
            continue;
        }
        const hrefs: string[] = [];
        const re = /<link\b[^>]*>/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            const tag = m[0];
            if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) {
                continue;
            }
            const h = /href\s*=\s*"(@Assets\[\s*"[^"]+"\s*\]|[^"]*)"|href\s*=\s*'([^']*)'/i.exec(tag);
            if (!h) {
                continue;
            }
            let href = (h[1] ?? h[2]).trim();
            const assets = /^@Assets\[\s*"([^"]+)"\s*\]$/.exec(href);
            if (assets) {
                href = assets[1];
            }
            hrefs.push(href);
        }
        return { hrefs, hostText: text };
    }
    return { hrefs: [], hostText: null };
}

function findLayoutName(razorFiles: string[]): string | null {
    for (const f of razorFiles) {
        const b = path.basename(f);
        if (b !== 'Routes.razor' && b !== 'App.razor') {
            continue;
        }
        const text = readText(f) || '';
        const m = /DefaultLayout\s*=\s*"@?typeof\(\s*([\w.]+)\s*\)"/.exec(text);
        if (m) {
            return m[1].split('.').pop() || null;
        }
    }
    return null;
}

export function collectRazorProject(razorPath: string, webview: vscode.Webview): RazorProjectInfo {
    const root = findProjectRoot(razorPath);
    const razorFiles: string[] = [];
    listFiles(root, '.razor', razorFiles, 600);
    if (!razorFiles.includes(razorPath)) {
        razorFiles.unshift(razorPath);
    }
    const files: RazorFileInfo[] = razorFiles.map(p => {
        const cssPath = p + '.css';
        const css = fs.existsSync(cssPath) ? readText(cssPath) : null;
        return { path: p, name: path.basename(p, '.razor'), text: readText(p) || '', css, cssPath: css !== null ? cssPath : null };
    });

    const wwwroot = path.join(root, 'wwwroot');
    const baseDir = fs.existsSync(wwwroot) ? wwwroot : root;
    const { hrefs } = hostPageStylesheets(root, razorFiles);
    const stylesheets: StylesheetInfo[] = [];
    for (const href of hrefs) {
        if (/^(https?:)?\/\//i.test(href)) {
            stylesheets.push({ href, path: null, text: null });
            continue;
        }
        const clean = href.replace(/^~?\//, '').split('?')[0];
        if (/\.styles\.css$|\.bundle\.scp\.css$/i.test(clean)) {
            stylesheets.push({ href: clean, path: null, text: null, scopedBundle: true });
            continue;
        }
        const file = path.join(baseDir, clean);
        if (fs.existsSync(file)) {
            stylesheets.push({ href: webview.asWebviewUri(vscode.Uri.file(file)).toString(), path: file, text: readText(file) });
        }
    }
    if (!stylesheets.some(s => s.scopedBundle) && files.some(f => f.css !== null)) {
        stylesheets.push({ href: 'scoped', path: null, text: null, scopedBundle: true });
    }
    return {
        root,
        files,
        stylesheets,
        baseUri: webview.asWebviewUri(vscode.Uri.file(baseDir)).toString() + '/',
        layoutName: findLayoutName(razorFiles),
    };
}
