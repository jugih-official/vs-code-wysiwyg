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
            if (e.document.uri.toString() === document.uri.toString()) {
                debouncedSendDocument();
            }
        });

        webviewPanel.onDidDispose(() => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            changeDocumentSubscription.dispose();
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage((message: { type: string; content?: string }) => {
            switch (message.type) {
                case 'ready':
                    sendDocumentToWebview();
                    break;
                case 'updateRazor':
                    this.updateDocument(document, message.content || '');
                    break;
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
