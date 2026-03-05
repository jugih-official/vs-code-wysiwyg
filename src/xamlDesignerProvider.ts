import * as vscode from 'vscode';
import { XamlDocument } from './xamlDocument';
import { getWebviewContent } from './webviewContent';

export class XamlDesignerProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
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
                    webviewPanel.webview.postMessage({
                        type: 'highlightElement',
                        elementType: match[1],
                        elementName: nameMatch ? nameMatch[1] : '',
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
        webviewPanel.webview.onDidReceiveMessage(async (message: { type: string; content?: string; elementType?: string; elementName?: string }) => {
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
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.indexOf('<' + elemType) >= 0) {
                            if (!elemName || line.indexOf('x:Name="' + elemName + '"') >= 0) {
                                // Reveal this line in a text editor beside the webview
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
                        }
                    }
                    break;
                }
            }
        });
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
