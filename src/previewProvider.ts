import * as vscode from 'vscode';
import * as path from 'path';

type FileKind = 'html' | 'xaml' | 'razor';

export class PreviewProvider {
    private static readonly viewType = 'xamlDesigner.preview';
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
            PreviewProvider.viewType,
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

    private getFileKind(fsPath: string): FileKind {
        const ext = path.extname(fsPath).toLowerCase();
        if (ext === '.xaml' || ext === '.axaml') {
            return 'xaml';
        }
        if (ext === '.razor') {
            return 'razor';
        }
        return 'html';
    }

    private async updatePreview(): Promise<void> {
        if (!this.panel || !this.documentUri) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(this.documentUri);
            const content = document.getText();
            const baseDir = path.dirname(this.documentUri.fsPath);
            const baseUri = this.panel.webview.asWebviewUri(vscode.Uri.file(baseDir));
            const kind = this.getFileKind(this.documentUri.fsPath);
            const fileName = path.basename(this.documentUri.fsPath);

            let htmlContent: string;
            if (kind === 'xaml') {
                htmlContent = this.xamlToHtml(content);
            } else if (kind === 'razor') {
                htmlContent = this.razorToHtml(content);
            } else {
                htmlContent = content;
            }

            this.panel.title = `Preview: ${fileName}`;
            this.panel.webview.html = this.getPreviewHtml(htmlContent, baseUri.toString(), kind);
        } catch (error) {
            this.panel.webview.html = this.getErrorHtml(String(error));
        }
    }

    // ── XAML → HTML transformation ──────────────────────────────────────

    private xamlToHtml(xaml: string): string {
        // Remove XML declaration and namespace attributes for cleaner parsing
        let cleaned = xaml.replace(/<\?xml[^?]*\?>/g, '');

        // Build an approximate HTML representation
        const lines: string[] = [];
        lines.push('<!DOCTYPE html>');
        lines.push('<html><head><style>');
        lines.push(this.getXamlPreviewStyles());
        lines.push('</style></head><body>');
        lines.push('<div class="xaml-root">');
        lines.push(this.convertXamlNodes(cleaned));
        lines.push('</div>');
        lines.push('</body></html>');
        return lines.join('\n');
    }

    private getXamlPreviewStyles(): string {
        return `
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 8px; background: #f0f0f0; }
            .xaml-root { position: relative; min-height: 400px; background: #ffffff; border: 1px solid #ccc; padding: 4px; }
            .xaml-canvas { position: relative; min-height: 300px; }
            .xaml-control { position: absolute; }
            .xaml-button { padding: 4px 16px; background: #e0e0e0; border: 1px solid #999; cursor: pointer; text-align: center; font-size: 14px; }
            .xaml-button:hover { background: #d0d0d0; }
            .xaml-textblock { font-size: 14px; color: #000; }
            .xaml-textbox { padding: 4px 6px; border: 1px solid #999; background: #fff; font-size: 14px; }
            .xaml-label { font-size: 14px; color: #000; }
            .xaml-checkbox { display: flex; align-items: center; gap: 4px; font-size: 14px; }
            .xaml-radiobutton { display: flex; align-items: center; gap: 4px; font-size: 14px; }
            .xaml-combobox { padding: 4px; border: 1px solid #999; background: #fff; font-size: 14px; }
            .xaml-listbox { padding: 4px; border: 1px solid #999; background: #fff; min-height: 60px; font-size: 14px; }
            .xaml-slider { width: 100%; }
            .xaml-progressbar { width: 100%; height: 20px; }
            .xaml-image { border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; background: #fafafa; }
            .xaml-toggleswitch { display: flex; align-items: center; gap: 4px; font-size: 14px; }
            .xaml-expander { border: 1px solid #ccc; margin: 4px 0; }
            .xaml-expander summary { padding: 4px 8px; background: #e8e8e8; cursor: pointer; }
            .xaml-expander .content { padding: 8px; }
            .xaml-tabcontrol { border: 1px solid #ccc; }
            .xaml-tabcontrol .tabs { display: flex; background: #e0e0e0; }
            .xaml-tabcontrol .tab { padding: 6px 16px; border-right: 1px solid #ccc; cursor: pointer; font-size: 13px; }
            .xaml-tabcontrol .tab.active { background: #fff; }
            .xaml-tabcontrol .tab-content { padding: 8px; min-height: 50px; }
            .xaml-datagrid { border-collapse: collapse; width: 100%; font-size: 13px; }
            .xaml-datagrid th, .xaml-datagrid td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
            .xaml-datagrid th { background: #e8e8e8; }
            .xaml-border { border: 1px solid #000; padding: 4px; }
            .xaml-scrollviewer { overflow: auto; border: 1px solid #ccc; }
            .xaml-stackpanel-v { display: flex; flex-direction: column; gap: 4px; }
            .xaml-stackpanel-h { display: flex; flex-direction: row; gap: 4px; }
            .xaml-wrappanel { display: flex; flex-wrap: wrap; gap: 4px; }
            .xaml-grid { display: grid; gap: 4px; }
            .xaml-separator { border-top: 1px solid #ccc; margin: 4px 0; }
            .xaml-rectangle { background: #ddd; border: 1px solid #999; }
            .xaml-ellipse { border-radius: 50%; background: #ddd; border: 1px solid #999; }
            .xaml-calendar { border: 1px solid #ccc; padding: 8px; font-size: 13px; min-width: 200px; }
            .xaml-datepicker, .xaml-timepicker { padding: 4px; border: 1px solid #999; font-size: 14px; }
            .xaml-numericupdown { padding: 4px; border: 1px solid #999; font-size: 14px; width: 100px; }
            .xaml-menu { display: flex; background: #f0f0f0; border-bottom: 1px solid #ccc; padding: 2px; }
            .xaml-menu .menu-item { padding: 4px 12px; cursor: pointer; font-size: 13px; }
            .xaml-menu .menu-item:hover { background: #e0e0e0; }
            .xaml-treeview { border: 1px solid #ccc; padding: 4px; font-size: 13px; }
            .xaml-hyperlink { color: #0066cc; text-decoration: underline; cursor: pointer; font-size: 14px; }
            .xaml-colorpicker { width: 50px; height: 30px; border: 1px solid #ccc; }
            .xaml-splitview { display: flex; border: 1px solid #ccc; }
            .xaml-splitview .pane { width: 200px; background: #f8f8f8; border-right: 1px solid #ccc; padding: 8px; }
            .xaml-splitview .content { flex: 1; padding: 8px; }
            .xaml-navigationview { display: flex; border: 1px solid #ccc; min-height: 200px; }
            .xaml-navigationview .nav-pane { width: 48px; background: #f0f0f0; border-right: 1px solid #ccc; }
            .xaml-navigationview .nav-content { flex: 1; padding: 8px; }
            .xaml-unknown { border: 1px dashed #999; padding: 4px; color: #666; font-size: 12px; background: #fafafa; }
        `;
    }

    private convertXamlNodes(xaml: string): string {
        // Simple recursive XAML to HTML converter
        // Handles self-closing and paired tags
        const output: string[] = [];
        let pos = 0;

        while (pos < xaml.length) {
            const tagStart = xaml.indexOf('<', pos);
            if (tagStart === -1) {
                break;
            }

            // Skip comments
            if (xaml.substring(tagStart, tagStart + 4) === '<!--') {
                const commentEnd = xaml.indexOf('-->', tagStart);
                if (commentEnd === -1) { break; }
                pos = commentEnd + 3;
                continue;
            }

            // Skip closing tags (handled by recursive parsing)
            if (xaml[tagStart + 1] === '/') {
                pos = xaml.indexOf('>', tagStart) + 1;
                continue;
            }

            // Parse the tag
            const result = this.parseXamlTag(xaml, tagStart);
            if (!result) {
                pos = tagStart + 1;
                continue;
            }

            output.push(this.renderXamlElement(result.tagName, result.attrs, result.innerContent));
            pos = result.endPos;
        }

        return output.join('\n');
    }

    private parseXamlTag(xaml: string, startPos: number): { tagName: string; attrs: Map<string, string>; innerContent: string; endPos: number } | null {
        // Find the end of the opening tag
        let i = startPos + 1;
        // Read tag name
        let tagName = '';
        while (i < xaml.length && /[a-zA-Z0-9_:\.\-]/.test(xaml[i])) {
            tagName += xaml[i];
            i++;
        }
        if (!tagName) { return null; }

        // Read attributes
        const attrs = new Map<string, string>();
        while (i < xaml.length && xaml[i] !== '>' && !(xaml[i] === '/' && xaml[i + 1] === '>')) {
            // Skip whitespace
            while (i < xaml.length && /\s/.test(xaml[i])) { i++; }
            if (xaml[i] === '>' || (xaml[i] === '/' && xaml[i + 1] === '>')) { break; }

            // Read attribute name
            let attrName = '';
            while (i < xaml.length && /[a-zA-Z0-9_:\.\-]/.test(xaml[i])) {
                attrName += xaml[i];
                i++;
            }
            if (!attrName) { i++; continue; }

            // Check for = sign
            if (xaml[i] === '=') {
                i++; // skip =
                let attrValue = '';
                if (xaml[i] === '"') {
                    i++; // skip opening quote
                    while (i < xaml.length && xaml[i] !== '"') {
                        attrValue += xaml[i];
                        i++;
                    }
                    i++; // skip closing quote
                } else if (xaml[i] === "'") {
                    i++; // skip opening quote
                    while (i < xaml.length && xaml[i] !== "'") {
                        attrValue += xaml[i];
                        i++;
                    }
                    i++; // skip closing quote
                }
                attrs.set(attrName, attrValue);
            } else {
                attrs.set(attrName, 'true');
            }
        }

        // Self-closing tag
        if (xaml[i] === '/' && xaml[i + 1] === '>') {
            return { tagName, attrs, innerContent: '', endPos: i + 2 };
        }

        // Skip >
        if (xaml[i] === '>') { i++; }

        // Find matching closing tag
        const closingTag = `</${tagName}>`;
        let depth = 1;
        let contentStart = i;
        while (i < xaml.length && depth > 0) {
            if (xaml.substring(i, i + closingTag.length) === closingTag) {
                depth--;
                if (depth === 0) {
                    const innerContent = xaml.substring(contentStart, i);
                    return { tagName, attrs, innerContent, endPos: i + closingTag.length };
                }
            }
            // Check for nested opening of same tag
            if (xaml[i] === '<' && xaml.substring(i + 1, i + 1 + tagName.length) === tagName) {
                const after = xaml[i + 1 + tagName.length];
                if (after === ' ' || after === '>' || after === '/') {
                    depth++;
                }
            }
            i++;
        }

        // If we didn't find a closing tag, treat remaining as inner content
        const innerContent = xaml.substring(contentStart);
        return { tagName, attrs, innerContent, endPos: xaml.length };
    }

    private renderXamlElement(tagName: string, attrs: Map<string, string>, innerContent: string): string {
        const style = this.buildXamlStyle(attrs);
        const content = attrs.get('Content') || attrs.get('Text') || attrs.get('Header') || '';
        const name = attrs.get('x:Name') || attrs.get('Name') || '';
        const title = name ? ` title="${this.escapeHtml(name)}"` : '';

        // Strip namespace prefix
        const baseName = tagName.includes(':') ? (tagName.split(':').pop() || tagName) : tagName;

        switch (baseName) {
            case 'Window':
            case 'UserControl':
            case 'Page':
            case 'Application':
                return `<div class="xaml-root"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Canvas':
                return `<div class="xaml-canvas"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Button':
            case 'RepeatButton':
            case 'ToggleButton':
            case 'SplitButton':
                return `<button class="xaml-button xaml-control"${title} style="${style}">${this.escapeHtml(content) || this.convertXamlNodes(innerContent) || baseName}</button>`;

            case 'TextBlock':
                return `<span class="xaml-textblock xaml-control"${title} style="${style}">${this.escapeHtml(content) || this.convertXamlNodes(innerContent) || 'TextBlock'}</span>`;

            case 'TextBox':
            case 'AutoCompleteBox':
                return `<input class="xaml-textbox xaml-control"${title} type="text" placeholder="${this.escapeHtml(content || baseName)}" style="${style}" />`;

            case 'Label':
                return `<label class="xaml-label xaml-control"${title} style="${style}">${this.escapeHtml(content) || this.convertXamlNodes(innerContent) || 'Label'}</label>`;

            case 'CheckBox':
                return `<label class="xaml-checkbox xaml-control"${title} style="${style}"><input type="checkbox" />${this.escapeHtml(content) || 'CheckBox'}</label>`;

            case 'RadioButton':
                return `<label class="xaml-radiobutton xaml-control"${title} style="${style}"><input type="radio" />${this.escapeHtml(content) || 'RadioButton'}</label>`;

            case 'ToggleSwitch':
                return `<label class="xaml-toggleswitch xaml-control"${title} style="${style}"><input type="checkbox" /> ${this.escapeHtml(content) || 'Toggle'}</label>`;

            case 'ComboBox':
                return `<select class="xaml-combobox xaml-control"${title} style="${style}"><option>${this.escapeHtml(content) || 'ComboBox'}</option></select>`;

            case 'ListBox':
                return `<select class="xaml-listbox xaml-control"${title} multiple style="${style}"><option>Item 1</option><option>Item 2</option></select>`;

            case 'Slider':
                return `<input class="xaml-slider xaml-control"${title} type="range" style="${style}" />`;

            case 'ProgressBar': {
                const value = attrs.get('Value') || '50';
                const max = attrs.get('Maximum') || '100';
                return `<progress class="xaml-progressbar xaml-control"${title} value="${this.escapeHtml(value)}" max="${this.escapeHtml(max)}" style="${style}"></progress>`;
            }

            case 'Image': {
                const src = attrs.get('Source') || '';
                return `<div class="xaml-image xaml-control"${title} style="${style}">${src ? `<img src="${this.escapeHtml(src)}" style="max-width:100%;max-height:100%;" />` : '🖼 Image'}</div>`;
            }

            case 'HyperlinkButton':
                return `<a class="xaml-hyperlink xaml-control"${title} href="#" style="${style}">${this.escapeHtml(content) || 'Hyperlink'}</a>`;

            case 'NumericUpDown':
                return `<input class="xaml-numericupdown xaml-control"${title} type="number" style="${style}" />`;

            case 'DatePicker':
                return `<input class="xaml-datepicker xaml-control"${title} type="date" style="${style}" />`;

            case 'TimePicker':
                return `<input class="xaml-timepicker xaml-control"${title} type="time" style="${style}" />`;

            case 'Calendar':
                return `<div class="xaml-calendar xaml-control"${title} style="${style}">📅 Calendar</div>`;

            case 'ColorPicker':
                return `<input class="xaml-colorpicker xaml-control"${title} type="color" style="${style}" />`;

            case 'Expander': {
                const header = attrs.get('Header') || 'Expander';
                return `<details class="xaml-expander"${title} style="${style}" open><summary>${this.escapeHtml(header)}</summary><div class="content">${this.convertXamlNodes(innerContent)}</div></details>`;
            }

            case 'TabControl':
                return `<div class="xaml-tabcontrol"${title} style="${style}"><div class="tabs"><span class="tab active">Tab 1</span></div><div class="tab-content">${this.convertXamlNodes(innerContent)}</div></div>`;

            case 'Menu':
                return `<div class="xaml-menu"${title} style="${style}">${this.convertXamlNodes(innerContent) || '<span class="menu-item">File</span><span class="menu-item">Edit</span>'}</div>`;

            case 'MenuItem': {
                const header2 = attrs.get('Header') || 'Menu Item';
                return `<span class="menu-item">${this.escapeHtml(header2)}</span>`;
            }

            case 'TreeView':
                return `<div class="xaml-treeview"${title} style="${style}">🌳 TreeView${this.convertXamlNodes(innerContent)}</div>`;

            case 'DataGrid':
                return `<table class="xaml-datagrid"${title} style="${style}"><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>Data</td><td>Data</td></tr></tbody></table>`;

            case 'ScrollViewer':
                return `<div class="xaml-scrollviewer"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'SplitView':
                return `<div class="xaml-splitview"${title} style="${style}"><div class="pane">Pane</div><div class="content">${this.convertXamlNodes(innerContent)}</div></div>`;

            case 'NavigationView':
                return `<div class="xaml-navigationview"${title} style="${style}"><div class="nav-pane">☰</div><div class="nav-content">${this.convertXamlNodes(innerContent)}</div></div>`;

            case 'Carousel':
                return `<div class="xaml-border"${title} style="${style}">⟵ Carousel ⟶${this.convertXamlNodes(innerContent)}</div>`;

            case 'StackPanel': {
                const orientation = attrs.get('Orientation') || 'Vertical';
                const cls = orientation.toLowerCase() === 'horizontal' ? 'xaml-stackpanel-h' : 'xaml-stackpanel-v';
                return `<div class="${cls}"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;
            }

            case 'WrapPanel':
                return `<div class="xaml-wrappanel"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'DockPanel':
                return `<div class="xaml-stackpanel-v"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Grid':
            case 'UniformGrid':
                return `<div class="xaml-grid"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Border':
                return `<div class="xaml-border"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Viewbox':
            case 'Panel':
            case 'RelativePanel':
            case 'ContentControl':
            case 'HeaderedContentControl':
            case 'ItemsControl':
            case 'ItemsRepeater':
                return `<div class="xaml-border"${title} style="${style}">${this.convertXamlNodes(innerContent)}</div>`;

            case 'Separator':
                return `<hr class="xaml-separator" style="${style}" />`;

            case 'Rectangle':
                return `<div class="xaml-rectangle xaml-control"${title} style="${style}">&nbsp;</div>`;

            case 'Ellipse':
                return `<div class="xaml-ellipse xaml-control"${title} style="${style}">&nbsp;</div>`;

            case 'Line':
                return `<hr class="xaml-separator" style="${style}" />`;

            case 'Path':
            case 'Polygon':
            case 'Polyline':
            case 'Arc':
                return `<div class="xaml-unknown xaml-control"${title} style="${style}">⟨${baseName}⟩</div>`;

            // Property elements like Grid.RowDefinitions, etc. — skip
            default:
                if (tagName.includes('.')) {
                    return '';
                }
                return `<div class="xaml-unknown"${title} style="${style}">&lt;${baseName}&gt;${this.convertXamlNodes(innerContent)}</div>`;
        }
    }

    private buildXamlStyle(attrs: Map<string, string>): string {
        const parts: string[] = [];

        const left = attrs.get('Canvas.Left');
        if (left) { parts.push(`left:${left}px`); }

        const top = attrs.get('Canvas.Top');
        if (top) { parts.push(`top:${top}px`); }

        const width = attrs.get('Width');
        if (width && width !== 'NaN') { parts.push(`width:${width}px`); }

        const height = attrs.get('Height');
        if (height && height !== 'NaN') { parts.push(`height:${height}px`); }

        const bg = attrs.get('Background');
        if (bg) { parts.push(`background:${bg}`); }

        const fg = attrs.get('Foreground');
        if (fg) { parts.push(`color:${fg}`); }

        const fontSize = attrs.get('FontSize');
        if (fontSize) { parts.push(`font-size:${fontSize}px`); }

        const margin = attrs.get('Margin');
        if (margin) {
            const marginParts = margin.split(',').map(m => {
                const v = m.trim();
                return /[a-z%]$/i.test(v) ? v : v + 'px';
            });
            parts.push(`margin:${marginParts.join(' ')}`);
        }

        const padding = attrs.get('Padding');
        if (padding) {
            const paddingParts = padding.split(',').map(p => {
                const v = p.trim();
                return /[a-z%]$/i.test(v) ? v : v + 'px';
            });
            parts.push(`padding:${paddingParts.join(' ')}`);
        }

        const opacity = attrs.get('Opacity');
        if (opacity) { parts.push(`opacity:${opacity}`); }

        const fill = attrs.get('Fill');
        if (fill) { parts.push(`background:${fill}`); }

        const stroke = attrs.get('Stroke');
        if (stroke) { parts.push(`border-color:${stroke}`); }

        return parts.join(';');
    }

    // ── Razor → HTML transformation ─────────────────────────────────────

    private razorToHtml(razor: string): string {
        let html = razor;

        // Remove @page directives
        html = html.replace(/^@page\s+.*$/gm, '');

        // Remove @using directives
        html = html.replace(/^@using\s+.*$/gm, '');

        // Remove @inject directives
        html = html.replace(/^@inject\s+.*$/gm, '');

        // Remove @implements directives
        html = html.replace(/^@implements\s+.*$/gm, '');

        // Remove @inherits directives
        html = html.replace(/^@inherits\s+.*$/gm, '');

        // Remove @namespace directives
        html = html.replace(/^@namespace\s+.*$/gm, '');

        // Remove @attribute directives
        html = html.replace(/^@attribute\s+.*$/gm, '');

        // Remove @layout directives
        html = html.replace(/^@layout\s+.*$/gm, '');

        // Remove @typeparam directives
        html = html.replace(/^@typeparam\s+.*$/gm, '');

        // Remove @code { ... } blocks (can be multiline)
        html = html.replace(/@code\s*\{[^]*?^\}/gm, '');

        // Remove @functions { ... } blocks
        html = html.replace(/@functions\s*\{[^]*?^\}/gm, '');

        // Convert Blazor components to HTML approximations
        html = this.convertBlazorComponents(html);

        // Convert Razor expressions: @variable → [variable]
        html = html.replace(/@(\w[\w.]*)/g, '[$1]');

        // Remove remaining @{ ... } blocks (inline code)
        html = html.replace(/@\{[^}]*\}/g, '');

        // Wrap in a basic HTML structure if not already wrapped
        if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
            html = `<!DOCTYPE html>
<html><head><style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 16px; }
    .blazor-badge { display: inline-block; padding: 2px 6px; background: #7b2ff2; color: #fff; border-radius: 3px; font-size: 10px; margin-left: 4px; }
</style></head><body>
${html}
</body></html>`;
        }

        return html;
    }

    private convertBlazorComponents(html: string): string {
        // EditForm → <form>
        html = html.replace(/<EditForm([^>]*)>([\s\S]*?)<\/EditForm>/g, '<form$1>$2</form>');

        // InputText → <input type="text">
        html = html.replace(/<InputText([^/>]*)\/?>/g, '<input type="text"$1 />');

        // InputNumber → <input type="number">
        html = html.replace(/<InputNumber([^/>]*)\/?>/g, '<input type="number"$1 />');

        // InputDate → <input type="date">
        html = html.replace(/<InputDate([^/>]*)\/?>/g, '<input type="date"$1 />');

        // InputCheckbox → <input type="checkbox">
        html = html.replace(/<InputCheckbox([^/>]*)\/?>/g, '<input type="checkbox"$1 />');

        // InputTextArea → <textarea>
        html = html.replace(/<InputTextArea([^>]*)\/>/g, '<textarea$1></textarea>');
        html = html.replace(/<InputTextArea([^>]*)>([\s\S]*?)<\/InputTextArea>/g, '<textarea$1>$2</textarea>');

        // InputFile → <input type="file">
        html = html.replace(/<InputFile([^/>]*)\/?>/g, '<input type="file"$1 />');

        // InputRadio → <input type="radio">
        html = html.replace(/<InputRadio([^/>]*)\/?>/g, '<input type="radio"$1 />');

        // InputRadioGroup → <div>
        html = html.replace(/<InputRadioGroup([^>]*)>/g, '<div$1>');
        html = html.replace(/<\/InputRadioGroup>/g, '</div>');

        // InputSelect → <select>
        html = html.replace(/<InputSelect([^>]*)>/g, '<select$1>');
        html = html.replace(/<\/InputSelect>/g, '</select>');

        // ValidationSummary → <div class="validation-summary">
        html = html.replace(/<ValidationSummary([^/>]*)\/?>/g, '<div style="color:#dc3545;font-size:13px;border:1px dashed #dc3545;padding:8px;margin:4px 0;">Validation Summary</div>');

        // ValidationMessage → <span>
        html = html.replace(/<ValidationMessage([^/>]*)\/?>/g, '<span style="color:#dc3545;font-size:12px;">Validation Message</span>');

        // AuthorizeView → <div>
        html = html.replace(/<AuthorizeView([^>]*)>/g, '<div$1>');
        html = html.replace(/<\/AuthorizeView>/g, '</div>');

        // CascadingValue → <div>
        html = html.replace(/<CascadingValue([^>]*)>/g, '<div$1>');
        html = html.replace(/<\/CascadingValue>/g, '</div>');

        // Virtualize → <div>
        html = html.replace(/<Virtualize([^>]*)>/g, '<div$1>');
        html = html.replace(/<\/Virtualize>/g, '</div>');

        // PageTitle → <title>
        html = html.replace(/<PageTitle>/g, '<div style="font-weight:bold;">');
        html = html.replace(/<\/PageTitle>/g, '</div>');

        // HeadContent → remove
        html = html.replace(/<HeadContent>([\s\S]*?)<\/HeadContent>/g, '');

        // ErrorBoundary → <div>
        html = html.replace(/<ErrorBoundary([^>]*)>/g, '<div$1>');
        html = html.replace(/<\/ErrorBoundary>/g, '</div>');

        // Clean up Blazor-specific attributes
        html = html.replace(/@bind-Value="[^"]*"/g, '');
        html = html.replace(/@bind="[^"]*"/g, '');
        html = html.replace(/@onclick="[^"]*"/g, '');
        html = html.replace(/@onchange="[^"]*"/g, '');
        html = html.replace(/@onsubmit="[^"]*"/g, '');
        html = html.replace(/Model="[^"]*"/g, '');

        return html;
    }

    // ── Preview HTML template ───────────────────────────────────────────

    private getPreviewHtml(htmlContent: string, baseUri: string, kind: FileKind): string {
        // Encode the HTML content for safe embedding in srcdoc
        const encodedContent = htmlContent
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');

        const kindLabel = kind === 'xaml' ? 'XAML' : kind === 'razor' ? 'Razor' : 'HTML';
        const badgeColor = kind === 'xaml' ? '#0078d4' : kind === 'razor' ? '#7b2ff2' : '#e44d26';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${kindLabel} Preview</title>
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
        .toolbar .badge {
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            color: #fff;
            background: ${badgeColor};
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
        <span class="badge">${kindLabel}</span>
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

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
