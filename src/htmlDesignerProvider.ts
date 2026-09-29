import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getHtmlDesignerHtml } from './htmlDesignerHtml';
import { designerMessage, registerDesignerHandler } from './designerEvents';

interface TextEditMessage {
    offset: number;
    length: number;
    text: string;
    /** For edits of other files: the text the edit replaces, checked before applying. */
    expect?: string;
}

interface HtmlMessage {
    type: string;
    version?: number;
    edits?: TextEditMessage[];
    offset?: number;
    end?: number;
    focus?: boolean;
    path?: string;
    state?: unknown;
}

export interface HtmlStylesheet {
    href: string;
    uri: string;
    path: string;
    text: string;
}

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

/** Local stylesheets the page links with <link rel="stylesheet" href="...">, for CSS rule lookup and editing. */
export function linkedStylesheets(htmlPath: string, text: string, webview: vscode.Webview): HtmlStylesheet[] {
    const dir = path.dirname(htmlPath);
    const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(htmlPath))?.uri.fsPath ?? dir;
    const out: HtmlStylesheet[] = [];
    const re = /<link\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const tag = m[0];
        if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) {
            continue;
        }
        const h = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        const href = h ? (h[1] ?? h[2] ?? h[3] ?? '').trim() : '';
        if (!href || /^([a-z]+:)?\/\//i.test(href) || href.startsWith('data:')) {
            continue;
        }
        const clean = decodeURIComponent(href.split(/[?#]/)[0]);
        const file = clean.startsWith('/') ? path.join(ws, clean) : path.resolve(dir, clean);
        const css = fs.existsSync(file) ? readText(file) : null;
        if (css !== null) {
            out.push({ href, uri: webview.asWebviewUri(vscode.Uri.file(file)).toString(), path: file, text: css });
        }
    }
    return out;
}

/**
 * HTML designer: renders the page with its own CSS and sends back minimal text edits (offset, length, text) for
 * the .html file, or for the stylesheet of an edited CSS rule. Two modes, chosen by the page itself: a fixed-size
 * page (class "hmi-page") with absolute placement that scales to the window, or a normal flowing page.
 */
export class HtmlDesignerProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const file = document.uri.fsPath;
        const dir = path.dirname(file);
        const webview = webviewPanel.webview;
        const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.file(dir)];
        (vscode.workspace.workspaceFolders || []).forEach(f => roots.push(f.uri));
        webview.options = { enableScripts: true, localResourceRoots: roots };
        webview.html = getHtmlDesignerHtml(webview, this.context);

        const stateKey = 'htmlDesign:' + file;
        let sheets: HtmlStylesheet[] = [];
        const info = () => {
            sheets = linkedStylesheets(file, document.getText(), webview);
            return {
                path: file,
                name: path.basename(file),
                baseUri: webview.asWebviewUri(vscode.Uri.file(dir)).toString() + '/',
                stylesheets: sheets,
            };
        };
        const sendDocument = (withState: boolean) => {
            webview.postMessage({
                type: 'document',
                text: document.getText(),
                version: document.version,
                info: info(),
                designState: withState ? this.context.workspaceState.get(stateKey) ?? null : undefined,
            });
        };

        let timer: ReturnType<typeof setTimeout> | undefined;
        const schedule = (delay: number) => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => { timer = undefined; sendDocument(false); }, delay);
        };
        let revealing = false;
        const textEditors = () => vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === document.uri.toString());
        const isSheet = (p: string) => sheets.some(s => s.path === p);

        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, '**/*.css'));
        const subscriptions: vscode.Disposable[] = [
            watcher,
            watcher.onDidChange(u => { if (isSheet(u.fsPath)) { schedule(200); } }),
            watcher.onDidCreate(() => schedule(200)),
            vscode.workspace.onDidChangeTextDocument(e => {
                if (!e.contentChanges.length) {
                    return;
                }
                if (e.document.uri.toString() === document.uri.toString()) {
                    schedule(e.reason === undefined ? 150 : 0);
                } else if (isSheet(e.document.uri.fsPath)) {
                    schedule(200);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection(e => {
                if (revealing || e.textEditor.document.uri.toString() !== document.uri.toString() || !webviewPanel.visible) {
                    return;
                }
                if (e.kind === vscode.TextEditorSelectionChangeKind.Command) {
                    return;
                }
                webview.postMessage({ type: 'cursor', offset: document.offsetAt(e.selections[0].active) });
            }),
        ];

        const onMessage = async (message: HtmlMessage) => {
            designerMessage('html', file, message);
            switch (message.type) {
                case 'ready':
                    sendDocument(true);
                    break;
                case 'edit': {
                    if (message.version !== document.version) {
                        webview.postMessage({ type: 'editRejected' });
                        sendDocument(false);
                        break;
                    }
                    const edit = new vscode.WorkspaceEdit();
                    for (const e of message.edits || []) {
                        edit.replace(document.uri, new vscode.Range(document.positionAt(e.offset), document.positionAt(e.offset + e.length)), e.text);
                    }
                    const ok = await vscode.workspace.applyEdit(edit);
                    if (!ok) {
                        webview.postMessage({ type: 'editRejected' });
                    }
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    sendDocument(false);
                    break;
                }
                case 'editFile': {
                    // A CSS rule of a linked stylesheet, edited in the properties panel.
                    const target = message.path || '';
                    if (!isSheet(target)) {
                        break;
                    }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
                    const current = doc.getText();
                    const edits = message.edits || [];
                    if (edits.some(e => e.expect !== undefined && current.substring(e.offset, e.offset + e.length) !== e.expect)) {
                        webview.postMessage({ type: 'editRejected', reason: path.basename(target) + ' changed meanwhile; try again' });
                        sendDocument(false);
                        break;
                    }
                    const edit = new vscode.WorkspaceEdit();
                    for (const e of edits) {
                        edit.replace(doc.uri, new vscode.Range(doc.positionAt(e.offset), doc.positionAt(e.offset + e.length)), e.text);
                    }
                    if (await vscode.workspace.applyEdit(edit)) {
                        await doc.save();
                    }
                    sendDocument(false);
                    break;
                }
                case 'reveal': {
                    const start = document.positionAt(message.offset || 0);
                    const end = document.positionAt(message.end ?? message.offset ?? 0);
                    let editors = textEditors();
                    if (!editors.length && message.focus) {
                        await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
                        editors = textEditors();
                    }
                    revealing = true;
                    try {
                        for (const ed of editors) {
                            ed.selection = new vscode.Selection(start, end);
                            ed.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                        }
                        if (message.focus && editors[0]) {
                            await vscode.window.showTextDocument(editors[0].document, { viewColumn: editors[0].viewColumn, preserveFocus: false });
                        }
                    } finally {
                        setTimeout(() => { revealing = false; }, 50);
                    }
                    break;
                }
                case 'openFile': {
                    const target = message.path || '';
                    if (!isSheet(target)) {
                        break;
                    }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
                    const pos = doc.positionAt(message.offset || 0);
                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, selection: new vscode.Range(pos, pos) });
                    break;
                }
                case 'openSource':
                    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
                    break;
                case 'openInBrowser':
                    // The browser reads the file from disk, so unsaved changes are saved first.
                    if (document.isDirty) {
                        await document.save();
                    }
                    await vscode.env.openExternal(document.uri);
                    break;
                case 'saveDesignState':
                    await this.context.workspaceState.update(stateKey, message.state);
                    break;
                case 'undo':
                case 'redo':
                    webviewPanel.reveal(undefined, false);
                    await vscode.commands.executeCommand(message.type);
                    break;
            }
        };
        webview.onDidReceiveMessage(onMessage);
        const testHandler = registerDesignerHandler('html', file, onMessage);
        webviewPanel.onDidDispose(() => {
            if (timer) {
                clearTimeout(timer);
            }
            subscriptions.forEach(s => s.dispose());
            testHandler.dispose();
        });
    }
}
