import * as vscode from 'vscode';
import { XamlDesignerProvider } from './xamlDesignerProvider';
import { RazorDesignerProvider } from './razorDesignerProvider';
import { HtmlDesignerProvider } from './htmlDesignerProvider';
import { HtmlPreviewProvider } from './htmlPreviewProvider';
import { PreviewProvider } from './previewProvider';

export function activate(context: vscode.ExtensionContext) {
    const xamlProvider = new XamlDesignerProvider(context);
    const razorProvider = new RazorDesignerProvider(context);
    const htmlProvider = new HtmlDesignerProvider(context);
    const htmlPreviewProvider = new HtmlPreviewProvider(context);
    const previewProvider = new PreviewProvider(context);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'xamlDesigner.visualEditor',
            xamlProvider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'xamlDesigner.razorVisualEditor',
            razorProvider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'xamlDesigner.htmlVisualEditor',
            htmlProvider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.openVisualEditor', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    targetUri,
                    'xamlDesigner.visualEditor'
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.openRazorVisualEditor', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    targetUri,
                    'xamlDesigner.razorVisualEditor'
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.openHtmlVisualEditor', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    targetUri,
                    'xamlDesigner.htmlVisualEditor'
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.previewHtml', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                htmlPreviewProvider.openPreview(targetUri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.previewXaml', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                previewProvider.openPreview(targetUri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.previewRazor', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                previewProvider.openPreview(targetUri);
            }
        })
    );
}

export function deactivate() {}
