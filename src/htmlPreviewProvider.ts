import * as vscode from 'vscode';
import * as path from 'path';

export class HtmlPreviewProvider {
    private static readonly viewType = 'xamlDesigner.htmlPreview';
    private panel: vscode.WebviewPanel | undefined;
    private documentUri: vscode.Uri | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async openPreview(uri: vscode.Uri): Promise<void> {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, update it
        if (this.panel) {
            this.panel.reveal(column);
            this.documentUri = uri;
            await this.updatePreview();
            return;
        }

        this.documentUri = uri;
        const fileName = path.basename(uri.fsPath);

        this.panel = vscode.window.createWebviewPanel(
            HtmlPreviewProvider.viewType,
            `Preview: ${fileName}`,
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(uri.fsPath)),
                ],
            }
        );

        // Watch for file changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (this.documentUri && e.document.uri.toString() === this.documentUri.toString()) {
                this.updatePreview();
            }
        });

        // Watch for file saves
        const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument((doc) => {
            if (this.documentUri && doc.uri.toString() === this.documentUri.toString()) {
                this.updatePreview();
            }
        });

        this.disposables.push(changeDocumentSubscription, saveDocumentSubscription);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
        });

        await this.updatePreview();
    }

    private async updatePreview(): Promise<void> {
        if (!this.panel || !this.documentUri) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(this.documentUri);
            const htmlContent = document.getText();
            const baseDir = path.dirname(this.documentUri.fsPath);
            const baseUri = this.panel.webview.asWebviewUri(vscode.Uri.file(baseDir));

            this.panel.webview.html = this.getPreviewHtml(htmlContent, baseUri.toString());
        } catch (error) {
            this.panel.webview.html = this.getErrorHtml(String(error));
        }
    }

    private getPreviewHtml(htmlContent: string, baseUri: string): string {
        // Encode the HTML content for safe embedding in srcdoc
        const encodedContent = htmlContent
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Preview</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #ffffff;
        }
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: var(--vscode-editor-background, #1e1e1e);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
            color: var(--vscode-foreground, #ccc);
            font-family: var(--vscode-font-family, sans-serif);
            font-size: 12px;
            height: 28px;
            box-sizing: border-box;
        }
        .toolbar button {
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            padding: 2px 8px;
            cursor: pointer;
            font-size: 12px;
            border-radius: 2px;
        }
        .toolbar button:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }
        .toolbar .file-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        iframe {
            width: 100%;
            height: calc(100% - 28px);
            border: none;
            background: #ffffff;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <span class="file-name" id="fileName"></span>
        <button id="refreshBtn" title="Refresh">&#x21bb; Refresh</button>
    </div>
    <iframe id="previewFrame" sandbox="allow-scripts allow-same-origin" srcdoc="${encodedContent}"></iframe>
    <script>
        (function() {
            var vscode = acquireVsCodeApi();

            document.getElementById('refreshBtn').addEventListener('click', function() {
                vscode.postMessage({ type: 'refresh' });
            });
        })();
    </script>
</body>
</html>`;
    }

    private getErrorHtml(error: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family, sans-serif);
            color: var(--vscode-errorForeground, #f44);
            padding: 20px;
        }
    </style>
</head>
<body>
    <h2>Preview Error</h2>
    <p>${error.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
