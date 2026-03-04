import * as vscode from 'vscode';
import { XamlDesignerProvider } from './xamlDesignerProvider';
import { RazorDesignerProvider } from './razorDesignerProvider';
import { HtmlDesignerProvider } from './htmlDesignerProvider';

export function activate(context: vscode.ExtensionContext) {
    const xamlProvider = new XamlDesignerProvider(context);
    const razorProvider = new RazorDesignerProvider(context);
    const htmlProvider = new HtmlDesignerProvider(context);

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
        vscode.commands.registerCommand('xamlDesigner.openVisualEditor', () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    activeEditor.document.uri,
                    'xamlDesigner.visualEditor'
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.openRazorVisualEditor', () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    activeEditor.document.uri,
                    'xamlDesigner.razorVisualEditor'
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xamlDesigner.openHtmlVisualEditor', () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                vscode.commands.executeCommand(
                    'vscode.openWith',
                    activeEditor.document.uri,
                    'xamlDesigner.htmlVisualEditor'
                );
            }
        })
    );
}

export function deactivate() {}
