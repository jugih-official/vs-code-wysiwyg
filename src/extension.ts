import * as vscode from 'vscode';
import { XamlDesignerProvider } from './xamlDesignerProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new XamlDesignerProvider(context);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'xamlDesigner.visualEditor',
            provider,
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
}

export function deactivate() {}
