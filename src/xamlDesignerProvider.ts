import * as vscode from 'vscode';
import { designerMessage, registerDesignerHandler } from './designerEvents';
import { XamlDocument } from './xamlDocument';
import { getWebviewContent } from './webviewContent';
import { getWpfDesignerHtml } from './wpfDesignerHtml';
import { collectImages, findProjectRoot } from './wpfImages';
import * as path from 'path';

interface WpfMessage {
    type: string;
    version?: number;
    edits?: { offset: number; length: number; text: string }[];
    offset?: number;
    end?: number;
    focus?: boolean;
}

/** WPF XAML (as opposed to Avalonia, UWP or MAUI): the root uses the WPF presentation namespace. */
export function isWpfXaml(text: string): boolean {
    const head = text.substring(0, 4000);
    return /xmlns\s*=\s*"http:\/\/schemas\.microsoft\.com\/winfx\/2006\/xaml\/presentation"/.test(head)
        && !/xmlns\s*=\s*"https:\/\/github\.com\/avaloniaui"/.test(head);
}

export class XamlDesignerProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        if (isWpfXaml(document.getText())) {
            this.resolveWpfEditor(document, webviewPanel);
            return;
        }
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        const xamlDoc = new XamlDocument(document);
        let isInternalEdit = false;

        // Set initial content
        webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context);

        // Send the document content to webview
        const sendDocumentToWebview = () => {
            const text = document.getText();
            webviewPanel.webview.postMessage({
                type: 'documentUpdate',
                content: text,
            });
        };

        // Debounce document change events to avoid excessive updates
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;
        const debouncedSendDocument = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(sendDocumentToWebview, 100);
        };

        // Listen for text document changes (external edits)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            if (e.document.uri.toString() === document.uri.toString() && !isInternalEdit) {
                debouncedSendDocument();
            }
        });

        // Listen for text editor selection changes (cursor sync: text → visual)
        const selectionChangeSubscription = vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
            if (e.selections.length === 0) { return; }
            if (e.textEditor.document.uri.toString() === document.uri.toString() && webviewPanel.visible) {
                const line = e.selections[0].active.line;
                const lineText = document.lineAt(line).text;
                // Try to find an element tag on this line
                const match = lineText.match(/<(\w+)[\s/]/);
                if (match) {
                    const nameMatch = lineText.match(/x:Name="([^"]+)"/);
                    const elemType = match[1];
                    const elemName = nameMatch ? nameMatch[1] : '';
                    // Count occurrences of same type+name before this line
                    let occurrenceIndex = 0;
                    for (let i = 0; i < line; i++) {
                        const prevLine = document.lineAt(i).text;
                        const prevMatch = prevLine.match(/<(\w+)[\s/]/);
                        if (prevMatch && prevMatch[1] === elemType) {
                            const prevNameMatch = prevLine.match(/x:Name="([^"]+)"/);
                            const prevName = prevNameMatch ? prevNameMatch[1] : '';
                            if (prevName === elemName) {
                                occurrenceIndex++;
                            }
                        }
                    }
                    webviewPanel.webview.postMessage({
                        type: 'highlightElement',
                        elementType: elemType,
                        elementName: elemName,
                        occurrenceIndex: occurrenceIndex,
                        line: line,
                    });
                }
            }
        });

        webviewPanel.onDidDispose(() => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = undefined;
            }
            changeDocumentSubscription.dispose();
            selectionChangeSubscription.dispose();
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(async (message: { type: string; content?: string; elementType?: string; elementName?: string; occurrenceIndex?: number }) => {
            switch (message.type) {
                case 'ready':
                    sendDocumentToWebview();
                    break;
                case 'updateXaml':
                    isInternalEdit = true;
                    await this.updateDocument(document, message.content || '');
                    isInternalEdit = false;
                    break;
                case 'selectElement': {
                    // Cursor sync: visual → text
                    const text = document.getText();
                    const lines = text.split('\n');
                    const elemType = message.elementType || '';
                    const elemName = message.elementName || '';
                    const targetOccurrence = message.occurrenceIndex || 0;
                    let matchIdx = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.indexOf('<' + elemType) >= 0) {
                            const nameMatch = line.match(/x:Name="([^"]+)"/);
                            const lineName = nameMatch ? nameMatch[1] : '';
                            if (lineName === elemName) {
                                if (matchIdx === targetOccurrence) {
                                    const range = new vscode.Range(i, 0, i, line.length);
                                    const editors = vscode.window.visibleTextEditors.filter(
                                        e => e.document.uri.toString() === document.uri.toString()
                                    );
                                    if (editors.length > 0) {
                                        editors[0].revealRange(range, vscode.TextEditorRevealType.InCenter);
                                        editors[0].selection = new vscode.Selection(i, 0, i, line.length);
                                    }
                                    break;
                                }
                                matchIdx++;
                            }
                        }
                    }
                    break;
                }
            }
        });
    }

    /**
     * WPF files: the webview renders the XAML with WPF layout rules and sends back minimal text edits
     * (offset, length, text), so everything the designer does not touch stays byte for byte as it was.
     */
    private resolveWpfEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
        const xamlPath = document.uri.fsPath;
        const projectRoot = findProjectRoot(xamlPath);
        const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'media'), vscode.Uri.file(projectRoot), vscode.Uri.file(path.dirname(xamlPath))];
        (vscode.workspace.workspaceFolders || []).forEach(f => roots.push(f.uri));
        webviewPanel.webview.options = { enableScripts: true, localResourceRoots: roots };
        webviewPanel.webview.html = getWpfDesignerHtml(webviewPanel.webview, this.context);

        let revealing = false;
        const sendDocument = () => {
            const text = document.getText();
            webviewPanel.webview.postMessage({
                type: 'document',
                text,
                version: document.version,
                images: collectImages(text, xamlPath, webviewPanel.webview),
            });
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        const scheduleSend = (delay: number) => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = undefined;
                sendDocument();
            }, delay);
        };

        const textEditors = () => vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === document.uri.toString());

        const subscriptions = [
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) {
                    scheduleSend(e.reason === undefined ? 150 : 0);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection(e => {
                if (revealing || e.textEditor.document.uri.toString() !== document.uri.toString() || !webviewPanel.visible) {
                    return;
                }
                if (e.kind === vscode.TextEditorSelectionChangeKind.Command) {
                    return;
                }
                webviewPanel.webview.postMessage({ type: 'cursor', offset: document.offsetAt(e.selections[0].active) });
            }),
        ];
        webviewPanel.onDidDispose(() => {
            if (timer) {
                clearTimeout(timer);
            }
            subscriptions.forEach(s => s.dispose());
        });

        const onMessage = async (message: WpfMessage) => {
            designerMessage('wpf', document.uri.fsPath, message);
            switch (message.type) {
                case 'ready':
                    sendDocument();
                    break;
                case 'edit': {
                    if (message.version !== document.version) {
                        webviewPanel.webview.postMessage({ type: 'editRejected' });
                        sendDocument();
                        break;
                    }
                    const edit = new vscode.WorkspaceEdit();
                    for (const e of message.edits || []) {
                        edit.replace(document.uri, new vscode.Range(document.positionAt(e.offset), document.positionAt(e.offset + e.length)), e.text);
                    }
                    const ok = await vscode.workspace.applyEdit(edit);
                    if (!ok) {
                        webviewPanel.webview.postMessage({ type: 'editRejected' });
                    }
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    sendDocument();
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
        const testHandler = registerDesignerHandler('wpf', document.uri.fsPath, onMessage);
        webviewPanel.onDidDispose(() => testHandler.dispose());
    }

    private async updateDocument(document: vscode.TextDocument, content: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        try {
            await vscode.workspace.applyEdit(edit);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update document: ${error}`);
        }
    }
}
