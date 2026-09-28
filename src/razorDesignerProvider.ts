import * as vscode from 'vscode';
import * as path from 'path';
import { getRazorDesignerHtml } from './razorDesignerHtml';
import { collectRazorProject } from './razorProject';

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
}

/**
 * Razor (Blazor) designer: the webview renders the component with the project's CSS and sends back
 * minimal text edits (offset, length, text) for the .razor file, or for the CSS file of an edited rule.
 */
export class RazorDesignerProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const razorPath = document.uri.fsPath;
        const webview = webviewPanel.webview;
        let info = collectRazorProject(razorPath, webview);
        const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.file(info.root), vscode.Uri.file(path.dirname(razorPath))];
        (vscode.workspace.workspaceFolders || []).forEach(f => roots.push(f.uri));
        webview.options = { enableScripts: true, localResourceRoots: roots };
        webview.html = getRazorDesignerHtml(webview, this.context);

        const sendProject = () => {
            info = collectRazorProject(razorPath, webview);
            webview.postMessage({ type: 'project', project: info, current: razorPath, text: document.getText(), version: document.version });
        };
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
        });

        webview.onDidReceiveMessage(async (message: RazorMessage) => {
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
                case 'openSource':
                    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
                    break;
                case 'undo':
                case 'redo':
                    webviewPanel.reveal(undefined, false);
                    await vscode.commands.executeCommand(message.type);
                    break;
            }
        });
    }
}
