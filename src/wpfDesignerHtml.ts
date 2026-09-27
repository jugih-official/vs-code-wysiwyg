import * as vscode from 'vscode';

/** The WPF designer webview: the page shell; the designer itself lives in media/wpf. */
export function getWpfDesignerHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const media = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'wpf', file)).toString();
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>WPF Visual Designer</title>
<link rel="stylesheet" href="${media('wpfRender.css')}"/>
<link rel="stylesheet" href="${media('wpfDesigner.css')}"/>
</head>
<body>
<div class="toolbar">
    <span class="title">WPF Designer</span>
    <button id="btnUndo" title="Undo (Ctrl+Z)">Undo</button>
    <button id="btnRedo" title="Redo (Ctrl+Y)">Redo</button>
    <span class="separator"></span>
    <button id="btnDelete" title="Delete the selected element (Del)">Delete</button>
    <button id="btnDuplicate" title="Duplicate the selected element (Ctrl+D)">Duplicate</button>
    <button id="btnParent" title="Select the parent element (Esc)">Parent</button>
    <span class="separator"></span>
    <button id="btnZoomOut" title="Zoom out (Ctrl+-)">&#x2212;</button>
    <span id="zoomBadge" class="zoom-badge" title="Click for 100%">100%</span>
    <button id="btnZoomIn" title="Zoom in (Ctrl+=)">+</button>
    <button id="btnFit" title="Fit the window in view (Ctrl+0)">Fit</button>
    <span class="separator"></span>
    <label class="toggle" title="Outline every element and show hidden ones, so invisible parts can be picked"><input type="checkbox" id="chkOutlines"/> Outlines</label>
    <button id="btnSource" title="Open the XAML beside the designer">Source</button>
    <span id="status" class="status"></span>
</div>
<div id="errorBanner" class="error-banner" hidden></div>
<div class="main">
    <div class="side left" id="leftPanel">
        <div class="side-tabs"><button class="side-tab active" data-pane="outline">Outline</button><button class="side-tab" data-pane="toolbox">Toolbox</button></div>
        <div class="pane" id="paneOutline">
            <input id="treeSearch" class="search" type="search" placeholder="Find by name or type" spellcheck="false"/>
            <div id="tree" class="tree"></div>
        </div>
        <div class="pane" id="paneToolbox" hidden>
            <div class="hint">Drag onto a panel in the canvas.</div>
            <div id="toolbox"></div>
        </div>
    </div>
    <div class="splitter" data-side="left"></div>
    <div class="canvas-wrapper" id="canvasWrapper" tabindex="0">
        <div class="stage" id="stage"><div class="wpf-root" id="surface"></div></div>
        <div class="overlay" id="overlay">
            <div class="hover-box" id="hoverBox"></div>
            <div class="sel-box" id="selBox"><span class="sel-label" id="selLabel"></span></div>
        </div>
    </div>
    <div class="splitter" data-side="right"></div>
    <div class="side right" id="propsPanel">
        <div class="props-header" id="propsHeader">No selection</div>
        <div id="props" class="props"></div>
    </div>
</div>
<div class="statusbar"><span id="breadcrumb"></span><span id="coords"></span></div>
<script src="${media('wpfCore.js')}"></script>
<script src="${media('wpfDesigner.js')}"></script>
</body>
</html>`;
}
