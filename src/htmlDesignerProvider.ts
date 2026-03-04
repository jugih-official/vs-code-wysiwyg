import * as vscode from 'vscode';
import { getHtmlWebviewContent } from './htmlWebviewContent';

export class HtmlDesignerProvider implements vscode.CustomTextEditorProvider {
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
        webviewPanel.webview.html = getHtmlWebviewContent(webviewPanel.webview, this.context);

        // Send the document content to webview
        const sendDocumentToWebview = () => {
            const text = document.getText();
            webviewPanel.webview.postMessage({
                type: 'documentUpdate',
                content: text,
            });
        };

        // Listen for text document changes (external edits)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                sendDocumentToWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage((message: { type: string; content?: string }) => {
            switch (message.type) {
                case 'ready':
                    sendDocumentToWebview();
                    break;
                case 'updateHtml':
                    this.updateDocument(document, message.content || '');
                    break;
            }
        });
    }

    private updateDocument(document: vscode.TextDocument, content: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        vscode.workspace.applyEdit(edit);
    }
}
