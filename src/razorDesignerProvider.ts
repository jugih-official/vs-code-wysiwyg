import * as vscode from 'vscode';
import { designerMessage, registerDesignerHandler } from './designerEvents';
import * as path from 'path';
import { getRazorDesignerHtml } from './razorDesignerHtml';
import { collectRazorProject, linkedXaml } from './razorProject';
import { findProjectRoot, collectImages } from './wpfImages';
import { startLiveProxy, LiveProxy } from './liveProxy';
import * as fs from 'fs';

interface TextEditMessage {
    offset: number;
    length: number;
    text: string;
    /** For edits of other files: the text the edit replaces, checked before applying. */
    expect?: string;
}

interface RazorMessage {
    type: string;
    version?: number;
    edits?: TextEditMessage[];
    offset?: number;
    end?: number;
    focus?: boolean;
    path?: string;
    url?: string;
    state?: unknown;
}

/**
 * Razor (Blazor) designer: the webview renders the component with the project's CSS and sends back
 * minimal text edits (offset, length, text) for the .razor file, or for the CSS file of an edited rule.
 */
export class RazorDesignerProvider implements vscode.CustomTextEditorProvider {
    private readonly panels = new Set<vscode.WebviewPanel>();

    constructor(private readonly context: vscode.ExtensionContext) {}

    /** Switches the active Razor designer between the design view and the live view of the running app. */
    public toggleLive(url?: string): boolean {
        const panel = Array.from(this.panels).find(p => p.active) ?? Array.from(this.panels).pop();
        if (!panel) {
            vscode.window.showInformationMessage('Open a .razor file in the Razor designer first.');
            return false;
        }
        panel.webview.postMessage({ type: 'toggleLive', url });
        return true;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const razorPath = document.uri.fsPath;
        this.panels.add(webviewPanel);
        webviewPanel.onDidDispose(() => this.panels.delete(webviewPanel));
        const webview = webviewPanel.webview;
        let info = collectRazorProject(razorPath, webview);
        const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.file(info.root), vscode.Uri.file(path.dirname(razorPath))];
        // Linked XAML (drawn inline) and its images live in the XAML's own project.
        for (const x of info.xaml) {
            roots.push(vscode.Uri.file(findProjectRoot(x.path)));
        }
        (vscode.workspace.workspaceFolders || []).forEach(f => roots.push(f.uri));
        webview.options = { enableScripts: true, localResourceRoots: roots };
        webview.html = getRazorDesignerHtml(webview, this.context);

        const stateKey = 'razorDesign:' + razorPath;
        const sendProject = () => {
            info = collectRazorProject(razorPath, webview);
            webview.postMessage({
                type: 'project', project: info, current: razorPath, text: document.getText(), version: document.version,
                designState: this.context.workspaceState.get(stateKey) ?? null,
            });
        };
        // XAML files drawn inline: sent on request and again when they change.
        const loadedXaml = new Set<string>();
        const readFile = (p: string) => vscode.workspace.textDocuments.find(d => d.uri.fsPath === p)?.getText() ?? fs.readFileSync(p, 'utf8');
        const sendXaml = (p: string) => {
            try {
                const text = readFile(p);
                webview.postMessage({ type: 'xaml', path: p, text, images: collectImages(text, p, webview) });
            } catch (err) {
                webview.postMessage({ type: 'xaml', path: p, error: String(err) });
            }
        };
        let live: LiveProxy | null = null;
        const sendDocument = () => {
            webview.postMessage({ type: 'document', text: document.getText(), version: document.version });
        };

        let docTimer: ReturnType<typeof setTimeout> | undefined;
        let projectTimer: ReturnType<typeof setTimeout> | undefined;
        const scheduleDocument = (delay: number) => {
            if (docTimer) {
                clearTimeout(docTimer);
            }
            docTimer = setTimeout(() => { docTimer = undefined; sendDocument(); }, delay);
        };
        const scheduleProject = () => {
            if (projectTimer) {
                clearTimeout(projectTimer);
            }
            projectTimer = setTimeout(() => { projectTimer = undefined; sendProject(); }, 250);
        };
        const inProject = (p: string) => p.startsWith(info.root + path.sep) && /\.(razor|css|cshtml|html)$/i.test(p) && p !== razorPath;

        let revealing = false;
        const textEditors = () => vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === document.uri.toString());

        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(info.root, '**/*.{razor,css,cshtml,html}'));
        const subscriptions: vscode.Disposable[] = [
            watcher,
            watcher.onDidChange(u => { if (inProject(u.fsPath)) { scheduleProject(); } }),
            watcher.onDidCreate(u => { if (inProject(u.fsPath)) { scheduleProject(); } }),
            watcher.onDidDelete(u => { if (inProject(u.fsPath)) { scheduleProject(); } }),
            vscode.workspace.onDidChangeTextDocument(e => {
                if (!e.contentChanges.length) {
                    return;
                }
                if (e.document.uri.toString() === document.uri.toString()) {
                    scheduleDocument(e.reason === undefined ? 150 : 0);
                } else if (inProject(e.document.uri.fsPath)) {
                    // Unsaved changes of a child component or stylesheet show up too.
                    scheduleProject();
                }
            }),
            vscode.workspace.onDidChangeTextDocument(e => {
                if (loadedXaml.has(e.document.uri.fsPath) && e.contentChanges.length) {
                    sendXaml(e.document.uri.fsPath);
                }
            }),
            vscode.workspace.onDidSaveTextDocument(d => {
                if (loadedXaml.has(d.uri.fsPath)) {
                    sendXaml(d.uri.fsPath);
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
        webviewPanel.onDidDispose(() => {
            if (docTimer) {
                clearTimeout(docTimer);
            }
            if (projectTimer) {
                clearTimeout(projectTimer);
            }
            subscriptions.forEach(s => s.dispose());
            live?.close();
        });

        const onMessage = async (message: RazorMessage) => {
            designerMessage('razor', document.uri.fsPath, message);
            switch (message.type) {
                case 'ready':
                    sendProject();
                    break;
                case 'edit': {
                    if (message.version !== document.version) {
                        webview.postMessage({ type: 'editRejected' });
                        sendDocument();
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
                    if (docTimer) {
                        clearTimeout(docTimer);
                        docTimer = undefined;
                    }
                    sendDocument();
                    break;
                }
                case 'editFile': {
                    // A CSS rule edited in the properties panel: only files of this project.
                    const file = message.path || '';
                    if (!file.startsWith(info.root + path.sep) || !/\.css$/i.test(file)) {
                        break;
                    }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
                    const text = doc.getText();
                    const edits = message.edits || [];
                    if (edits.some(e => e.expect !== undefined && text.substring(e.offset, e.offset + e.length) !== e.expect)) {
                        webview.postMessage({ type: 'editRejected', reason: path.basename(file) + ' changed meanwhile; try again' });
                        sendProject();
                        break;
                    }
                    const edit = new vscode.WorkspaceEdit();
                    for (const e of edits) {
                        edit.replace(doc.uri, new vscode.Range(doc.positionAt(e.offset), doc.positionAt(e.offset + e.length)), e.text);
                    }
                    if (await vscode.workspace.applyEdit(edit)) {
                        await doc.save();
                    }
                    sendProject();
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
                    const file = message.path || '';
                    if (!file.startsWith(info.root + path.sep)) {
                        break;
                    }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
                    const pos = doc.positionAt(message.offset || 0);
                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, selection: new vscode.Range(pos, pos) });
                    break;
                }
                case 'openInDesigner': {
                    const file = message.path || '';
                    if (file.startsWith(info.root + path.sep) && file.endsWith('.razor')) {
                        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(file), 'xamlDesigner.razorVisualEditor');
                    }
                    break;
                }
                case 'saveDesignState':
                    await this.context.workspaceState.update(stateKey, message.state);
                    break;
                case 'loadXaml': {
                    const p = message.path || '';
                    if (linkedXaml(info.root, info.csproj).some(x => x.path === p)) {
                        loadedXaml.add(p);
                        sendXaml(p);
                    }
                    break;
                }
                case 'openXaml': {
                    const p = message.path || '';
                    if (!linkedXaml(info.root, info.csproj).some(x => x.path === p)) {
                        break;
                    }
                    const uri = vscode.Uri.file(p);
                    await vscode.commands.executeCommand('vscode.openWith', uri, 'xamlDesigner.visualEditor', vscode.ViewColumn.Active);
                    if (message.offset !== undefined) {
                        // The WPF designer selects the element under the text cursor.
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const pos = doc.positionAt(message.offset);
                        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, selection: new vscode.Range(pos, pos), preserveFocus: true });
                    }
                    break;
                }
                case 'startLive': {
                    live?.close();
                    live = null;
                    try {
                        live = await startLiveProxy(message.url || '', path.join(this.context.extensionUri.fsPath, 'media', 'razor', 'liveAgent.js'));
                        const external = await vscode.env.asExternalUri(vscode.Uri.parse(live.url));
                        webview.postMessage({ type: 'live', url: external.toString(true).replace(/\/$/, ''), target: live.target });
                    } catch (err) {
                        webview.postMessage({ type: 'live', error: String(err instanceof Error ? err.message : err) });
                    }
                    break;
                }
                case 'stopLive':
                    live?.close();
                    live = null;
                    break;
                case 'startApp': {
                    if (!info.csproj) {
                        vscode.window.showWarningMessage('No .csproj found for ' + path.basename(razorPath));
                        break;
                    }
                    const term = vscode.window.createTerminal({ name: 'dotnet watch: ' + path.basename(info.csproj, '.csproj'), cwd: info.root });
                    term.show(true);
                    term.sendText(`dotnet watch --project "${info.csproj}" --non-interactive`);
                    break;
                }
                case 'openSource':
                    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
                    break;
                case 'undo':
                case 'redo':
                    webviewPanel.reveal(undefined, false);
                    await vscode.commands.executeCommand(message.type);
                    break;
            }
        };
        webviewPanel.webview.onDidReceiveMessage(onMessage);
        const testHandler = registerDesignerHandler('razor', document.uri.fsPath, onMessage);
        webviewPanel.onDidDispose(() => testHandler.dispose());
    }
}
