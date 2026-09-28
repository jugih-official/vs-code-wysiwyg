import * as vscode from 'vscode';

/** The Razor designer webview: the page shell; the designer lives in media/razor (chrome styles shared with the WPF designer). */
export function getRazorDesignerHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const media = (dir: string, file: string) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', dir, file)).toString();
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Razor Visual Designer</title>
<link rel="stylesheet" href="${media('wpf', 'wpfDesigner.css')}"/>
<link rel="stylesheet" href="${media('razor', 'razorDesigner.css')}"/>
</head>
<body>
<div class="toolbar">
    <span class="title">Razor Designer</span>
    <button id="btnUndo" title="Undo (Ctrl+Z)">Undo</button>
    <button id="btnRedo" title="Redo (Ctrl+Y)">Redo</button>
    <span class="separator"></span>
    <button id="btnDelete" title="Delete the selected element (Del)">Delete</button>
    <button id="btnDuplicate" title="Duplicate the selected element (Ctrl+D)">Duplicate</button>
    <button id="btnUp" title="Move before the previous sibling (Alt+Up)">&#x2191;</button>
    <button id="btnDown" title="Move after the next sibling (Alt+Down)">&#x2193;</button>
    <button id="btnParent" title="Select the parent (Esc)">Parent</button>
    <span class="separator"></span>
    <select id="viewport" title="Viewport size">
        <option value="1920x1080">1920 × 1080</option>
        <option value="1600x900">1600 × 900</option>
        <option value="1366x768">1366 × 768</option>
        <option value="1280x800">1280 × 800</option>
        <option value="1024x768">1024 × 768</option>
        <option value="768x1024">768 × 1024</option>
        <option value="390x844">390 × 844</option>
        <option value="custom">Custom…</option>
    </select>
    <input id="vpW" class="vp-input" type="number" min="200" max="8000" title="Viewport width" hidden/>
    <input id="vpH" class="vp-input" type="number" min="200" max="8000" title="Viewport height" hidden/>
    <button id="btnZoomOut" title="Zoom out (Ctrl+-)">&#x2212;</button>
    <span id="zoomBadge" class="zoom-badge" title="Click for 100%">100%</span>
    <button id="btnZoomIn" title="Zoom in (Ctrl+=)">+</button>
    <button id="btnFit" title="Fit the viewport in view (Ctrl+0)">Fit</button>
    <span class="separator"></span>
    <label class="toggle" title="Outline every element"><input type="checkbox" id="chkOutlines"/> Outlines</label>
    <button id="btnSource" title="Open the .razor source beside the designer">Source</button>
    <span id="status" class="status"></span>
</div>
<div id="errorBanner" class="error-banner" hidden></div>
<div class="main">
    <div class="side left" id="leftPanel">
        <div class="side-tabs">
            <button class="side-tab active" data-pane="outline">Outline</button>
            <button class="side-tab" data-pane="state">State</button>
            <button class="side-tab" data-pane="toolbox">Toolbox</button>
        </div>
        <div class="pane" id="paneOutline">
            <input id="treeSearch" class="search" type="search" placeholder="Find by tag, class or id" spellcheck="false"/>
            <div id="tree" class="tree"></div>
        </div>
        <div class="pane" id="paneState" hidden><div id="statePane" class="state-pane"></div></div>
        <div class="pane" id="paneToolbox" hidden>
            <div class="hint">Drag onto the page: the middle of an element puts it inside, its edges before or after.</div>
            <div id="toolbox"></div>
        </div>
    </div>
    <div class="splitter" data-side="left"></div>
    <div class="canvas-wrapper" id="canvasWrapper" tabindex="0">
        <div class="stage" id="stage"><iframe id="frame" class="rz-frame" title="Page preview"></iframe></div>
        <div class="glass" id="glass"></div>
        <div class="overlay" id="overlay">
            <div class="hover-box" id="hoverBox"></div>
            <div class="sel-box" id="selBox"><span class="sel-label" id="selLabel"></span></div>
            <div class="drop-line" id="dropLine"></div>
        </div>
    </div>
    <div class="splitter" data-side="right"></div>
    <div class="side right" id="propsPanel">
        <div class="props-header" id="propsHeader">No selection</div>
        <div id="props" class="props"></div>
    </div>
</div>
<div class="statusbar"><span id="breadcrumb"></span><span id="coords"></span></div>
<script src="${media('razor', 'razorCore.js')}"></script>
<script src="${media('razor', 'razorDesigner.js')}"></script>
</body>
</html>`;
}
