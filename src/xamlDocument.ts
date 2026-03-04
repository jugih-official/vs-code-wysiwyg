import * as vscode from 'vscode';

/**
 * Simple XAML document model for parsing and generating XAML.
 */
export interface XamlControl {
    type: string;
    name?: string;
    properties: Record<string, string>;
    children: XamlControl[];
}

export class XamlDocument {
    constructor(private readonly document: vscode.TextDocument) {}

    getText(): string {
        return this.document.getText();
    }
}
