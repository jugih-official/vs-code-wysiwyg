import * as vscode from 'vscode';
import { getRazorWebviewContent } from './razorWebviewContent';

export class RazorDesignerProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        let isInternalEdit = false;

        // Set initial content
        webviewPanel.webview.html = getRazorWebviewContent(webviewPanel.webview, this.context);

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
                const match = lineText.match(/<(\w+)[\s/>]/);
                if (match) {
                    const nameMatch = lineText.match(/(?:id|class)="([^"]+)"/);
                    const elemType = match[1];
                    const elemName = nameMatch ? nameMatch[1] : '';
                    // Count occurrences of same type+name before this line
                    let occurrenceIndex = 0;
                    for (let i = 0; i < line; i++) {
                        const prevLine = document.lineAt(i).text;
                        const prevMatch = prevLine.match(/<(\w+)[\s/>]/);
                        if (prevMatch && prevMatch[1] === elemType) {
                            const prevNameMatch = prevLine.match(/(?:id|class)="([^"]+)"/);
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
                case 'updateRazor':
                    isInternalEdit = true;
                    await this.updateDocument(document, message.content || '');
                    isInternalEdit = false;
                    break;
                case 'selectElement': {
                    const text = document.getText();
                    const lines = text.split('\n');
                    const elemType = message.elementType || '';
                    const elemName = message.elementName || '';
                    const targetOccurrence = message.occurrenceIndex || 0;
                    let matchIdx = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.indexOf('<' + elemType) >= 0) {
                            const nameMatch = line.match(/(?:id|class)="([^"]+)"/);
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
