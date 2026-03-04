import * as vscode from 'vscode';

export function getRazorWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Razor Visual Designer</title>
<style>
:root {
    --toolbar-bg: #1e1e1e;
    --toolbar-border: #333;
    --canvas-bg: #2d2d30;
    --control-bg: #3c3c3c;
    --control-border: #555;
    --control-selected: #007acc;
    --text-color: #cccccc;
    --text-bright: #ffffff;
    --handle-color: #007acc;
    --toolbox-item-hover: #3c3c3c;
    --property-bg: #252526;
    --input-bg: #3c3c3c;
    --input-border: #555;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--text-color);
    background: var(--toolbar-bg);
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ============ TOP TOOLBAR ============ */
.toolbar {
    display: flex;
    align-items: center;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--toolbar-border);
    padding: 4px 10px;
    gap: 6px;
    height: 36px;
    flex-shrink: 0;
}
.toolbar button {
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    color: var(--text-color);
    padding: 3px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
}
.toolbar button:hover { background: #4a4a4a; }
.toolbar .separator { width: 1px; height: 20px; background: var(--toolbar-border); margin: 0 4px; }
.toolbar .title { font-weight: 600; font-size: 13px; color: var(--text-bright); margin-right: 12px; }

/* ============ MAIN LAYOUT ============ */
.main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
}

/* ============ TOOLBOX PANEL ============ */
.toolbox {
    width: 180px;
    background: var(--property-bg);
    border-right: 1px solid var(--toolbar-border);
    overflow-y: auto;
    flex-shrink: 0;
}
.toolbox h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    padding: 10px 10px 6px;
}
.toolbox-item {
    padding: 6px 12px;
    cursor: grab;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
}
.toolbox-item:hover { background: var(--toolbox-item-hover); }
.toolbox-item .icon {
    width: 20px;
    height: 16px;
    border: 1px solid #666;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #999;
    flex-shrink: 0;
}

/* ============ CANVAS AREA ============ */
.canvas-wrapper {
    flex: 1;
    overflow: auto;
    background: #1a1a1a;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
.canvas-container {
    position: relative;
    width: 800px;
    height: 500px;
    background: var(--canvas-bg);
    border: 2px solid var(--toolbar-border);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    overflow: hidden;
}
.canvas-label {
    position: absolute;
    top: -22px;
    left: 0;
    font-size: 11px;
    color: #888;
}

/* ============ DESIGN CONTROLS ON CANVAS ============ */
.design-control {
    position: absolute;
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    cursor: move;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-color);
    overflow: hidden;
}
.design-control.selected {
    border-color: var(--control-selected);
    box-shadow: 0 0 0 1px var(--control-selected);
}
.design-control .control-label {
    pointer-events: none;
    text-align: center;
    padding: 2px 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
}

/* Control type visual styles - HTML Structure */
.design-control[data-type="div"]       { background: rgba(0,122,204,0.08); border: 1px dashed #007acc55; }
.design-control[data-type="span"]      { background: transparent; border: 1px dashed #555; }
.design-control[data-type="p"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h1"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h2"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h3"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h4"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h5"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h6"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="a"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="hr"]        { background: #555; border: none; }
.design-control[data-type="br"]        { background: transparent; border: 1px dashed #88888844; }

/* Control type visual styles - HTML Forms */
.design-control[data-type="input"]     { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="textarea"]  { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="select"]    { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="button"]    { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="label"]     { background: transparent; border: 1px dashed #555; }
.design-control[data-type="form"]      { background: rgba(200,200,200,0.05); border: 1px dashed #666; }
.design-control[data-type="fieldset"]  { background: rgba(200,200,200,0.05); border: 1px solid #666; border-radius: 3px; }

/* Control type visual styles - Lists/Tables */
.design-control[data-type="ul"]        { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="ol"]        { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="li"]        { background: transparent; border: 1px dashed #55555544; }
.design-control[data-type="table"]     { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="tr"]        { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="th"]        { background: #333; border: 1px solid #555; }
.design-control[data-type="td"]        { background: var(--input-bg); border: 1px solid var(--input-border); }

/* Control type visual styles - Semantic */
.design-control[data-type="nav"]       { background: rgba(0,204,122,0.06); border: 1px dashed #00cc7a55; }
.design-control[data-type="header"]    { background: rgba(122,0,204,0.08); border: 1px dashed #7a00cc55; }
.design-control[data-type="footer"]    { background: rgba(204,122,0,0.08); border: 1px dashed #cc7a0055; }
.design-control[data-type="section"]   { background: rgba(0,122,204,0.06); border: 1px dashed #007acc44; }
.design-control[data-type="article"]   { background: rgba(200,200,0,0.06); border: 1px dashed #cccc0055; }
.design-control[data-type="aside"]     { background: rgba(204,0,122,0.06); border: 1px dashed #cc007a44; }
.design-control[data-type="main"]      { background: rgba(0,122,204,0.08); border: 1px dashed #007acc55; }

/* Control type visual styles - Blazor Components */
.design-control[data-type="EditForm"]          { background: rgba(128,0,255,0.08); border: 1px dashed #8000ff55; }
.design-control[data-type="InputText"]         { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputNumber"]       { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputDate"]         { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputSelect"]       { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputCheckbox"]     { background: transparent; border: 1px dashed #555; }
.design-control[data-type="InputTextArea"]     { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputFile"]         { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="InputRadio"]        { background: transparent; border: 1px dashed #555; }
.design-control[data-type="InputRadioGroup"]   { background: transparent; border: 1px dashed #555; }
.design-control[data-type="ValidationSummary"] { background: rgba(255,100,100,0.08); border: 1px dashed #ff646455; }
.design-control[data-type="ValidationMessage"] { background: rgba(255,100,100,0.06); border: 1px dashed #ff646444; }
.design-control[data-type="AuthorizeView"]     { background: rgba(0,200,100,0.06); border: 1px dashed #00c86444; }
.design-control[data-type="CascadingValue"]    { background: rgba(100,100,255,0.06); border: 1px dashed #6464ff44; }
.design-control[data-type="Virtualize"]        { background: rgba(200,200,200,0.05); border: 1px dashed #888; }
.design-control[data-type="PageTitle"]         { background: rgba(255,200,0,0.08); border: 1px dashed #ffc80055; }
.design-control[data-type="HeadContent"]       { background: rgba(255,200,0,0.06); border: 1px dashed #ffc80044; }
.design-control[data-type="ErrorBoundary"]     { background: rgba(255,50,50,0.08); border: 1px dashed #ff323255; }

/* ============ RESIZE HANDLES ============ */
.resize-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--handle-color);
    border: 1px solid var(--text-bright);
    z-index: 100;
}
.resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
.resize-handle.n  { top: -4px; left: 50%; margin-left: -4px; cursor: n-resize; }
.resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
.resize-handle.e  { top: 50%; margin-top: -4px; right: -4px; cursor: e-resize; }
.resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
.resize-handle.s  { bottom: -4px; left: 50%; margin-left: -4px; cursor: s-resize; }
.resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
.resize-handle.w  { top: 50%; margin-top: -4px; left: -4px; cursor: w-resize; }

/* ============ PROPERTIES PANEL ============ */
.properties-panel {
    width: 220px;
    background: var(--property-bg);
    border-left: 1px solid var(--toolbar-border);
    overflow-y: auto;
    flex-shrink: 0;
}
.properties-panel h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    padding: 10px 10px 6px;
    border-bottom: 1px solid var(--toolbar-border);
}
.prop-row {
    display: flex;
    flex-direction: column;
    padding: 4px 10px;
}
.prop-row label {
    font-size: 11px;
    color: #999;
    margin-bottom: 2px;
}
.prop-row input, .prop-row select {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--text-color);
    padding: 3px 6px;
    border-radius: 2px;
    font-size: 12px;
    outline: none;
}
.prop-row input:focus, .prop-row select:focus {
    border-color: var(--control-selected);
}
.no-selection {
    padding: 20px 10px;
    font-size: 12px;
    color: #666;
    text-align: center;
    font-style: italic;
}

/* ============ CONTEXT MENU ============ */
.context-menu {
    position: fixed;
    background: #2d2d30;
    border: 1px solid #454545;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 10000;
    min-width: 150px;
    padding: 4px 0;
    display: none;
}
.context-menu.visible { display: block; }
.context-menu-item {
    padding: 6px 16px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-color);
}
.context-menu-item:hover { background: #094771; color: var(--text-bright); }
.context-menu-divider { height: 1px; background: #454545; margin: 4px 0; }

.drop-indicator {
    position: absolute;
    border: 2px dashed var(--control-selected);
    background: rgba(0,122,204,0.1);
    pointer-events: none;
    display: none;
    z-index: 50;
}
</style>
</head>
<body>

<!-- TOP TOOLBAR -->
<div class="toolbar">
    <span class="title">Razor Visual Designer</span>
    <button onclick="undoAction()" title="Undo">&#8617; Undo</button>
    <button onclick="redoAction()" title="Redo">&#8618; Redo</button>
    <span class="separator"></span>
    <button onclick="deleteSelected()" title="Delete selected">&#128465; Delete</button>
    <button onclick="bringToFront()" title="Bring to front">&#11014; Front</button>
    <button onclick="sendToBack()" title="Send to back">&#11015; Back</button>
    <span class="separator"></span>
    <button onclick="syncToRazor()" title="Sync visual to Razor">&#128190; Sync to Razor</button>
</div>

<!-- MAIN LAYOUT -->
<div class="main-layout">

    <!-- TOOLBOX -->
    <div class="toolbox">
        <h3>HTML Structure</h3>
        <div class="toolbox-item" draggable="true" data-type="div">
            <span class="icon">D</span> div
        </div>
        <div class="toolbox-item" draggable="true" data-type="span">
            <span class="icon">S</span> span
        </div>
        <div class="toolbox-item" draggable="true" data-type="p">
            <span class="icon">P</span> p
        </div>
        <div class="toolbox-item" draggable="true" data-type="h1">
            <span class="icon">H1</span> h1
        </div>
        <div class="toolbox-item" draggable="true" data-type="h2">
            <span class="icon">H2</span> h2
        </div>
        <div class="toolbox-item" draggable="true" data-type="h3">
            <span class="icon">H3</span> h3
        </div>
        <div class="toolbox-item" draggable="true" data-type="h4">
            <span class="icon">H4</span> h4
        </div>
        <div class="toolbox-item" draggable="true" data-type="h5">
            <span class="icon">H5</span> h5
        </div>
        <div class="toolbox-item" draggable="true" data-type="h6">
            <span class="icon">H6</span> h6
        </div>
        <div class="toolbox-item" draggable="true" data-type="a">
            <span class="icon">A</span> a
        </div>
        <div class="toolbox-item" draggable="true" data-type="hr">
            <span class="icon">Hr</span> hr
        </div>
        <div class="toolbox-item" draggable="true" data-type="br">
            <span class="icon">Br</span> br
        </div>

        <h3>HTML Forms</h3>
        <div class="toolbox-item" draggable="true" data-type="input">
            <span class="icon">In</span> input
        </div>
        <div class="toolbox-item" draggable="true" data-type="textarea">
            <span class="icon">Ta</span> textarea
        </div>
        <div class="toolbox-item" draggable="true" data-type="select">
            <span class="icon">Se</span> select
        </div>
        <div class="toolbox-item" draggable="true" data-type="button">
            <span class="icon">B</span> button
        </div>
        <div class="toolbox-item" draggable="true" data-type="label">
            <span class="icon">L</span> label
        </div>
        <div class="toolbox-item" draggable="true" data-type="form">
            <span class="icon">Fm</span> form
        </div>
        <div class="toolbox-item" draggable="true" data-type="fieldset">
            <span class="icon">Fs</span> fieldset
        </div>

        <h3>HTML Lists / Tables</h3>
        <div class="toolbox-item" draggable="true" data-type="ul">
            <span class="icon">Ul</span> ul
        </div>
        <div class="toolbox-item" draggable="true" data-type="ol">
            <span class="icon">Ol</span> ol
        </div>
        <div class="toolbox-item" draggable="true" data-type="li">
            <span class="icon">Li</span> li
        </div>
        <div class="toolbox-item" draggable="true" data-type="table">
            <span class="icon">Tb</span> table
        </div>
        <div class="toolbox-item" draggable="true" data-type="tr">
            <span class="icon">Tr</span> tr
        </div>
        <div class="toolbox-item" draggable="true" data-type="th">
            <span class="icon">Th</span> th
        </div>
        <div class="toolbox-item" draggable="true" data-type="td">
            <span class="icon">Td</span> td
        </div>

        <h3>HTML Semantic</h3>
        <div class="toolbox-item" draggable="true" data-type="nav">
            <span class="icon">Nv</span> nav
        </div>
        <div class="toolbox-item" draggable="true" data-type="header">
            <span class="icon">Hd</span> header
        </div>
        <div class="toolbox-item" draggable="true" data-type="footer">
            <span class="icon">Ft</span> footer
        </div>
        <div class="toolbox-item" draggable="true" data-type="section">
            <span class="icon">Sc</span> section
        </div>
        <div class="toolbox-item" draggable="true" data-type="article">
            <span class="icon">Ar</span> article
        </div>
        <div class="toolbox-item" draggable="true" data-type="aside">
            <span class="icon">As</span> aside
        </div>
        <div class="toolbox-item" draggable="true" data-type="main">
            <span class="icon">Mn</span> main
        </div>

        <h3>Blazor Components</h3>
        <div class="toolbox-item" draggable="true" data-type="EditForm">
            <span class="icon">EF</span> EditForm
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputText">
            <span class="icon">IT</span> InputText
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputNumber">
            <span class="icon">IN</span> InputNumber
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputDate">
            <span class="icon">ID</span> InputDate
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputSelect">
            <span class="icon">IS</span> InputSelect
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputCheckbox">
            <span class="icon">IC</span> InputCheckbox
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputTextArea">
            <span class="icon">IA</span> InputTextArea
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputFile">
            <span class="icon">IF</span> InputFile
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputRadio">
            <span class="icon">IR</span> InputRadio
        </div>
        <div class="toolbox-item" draggable="true" data-type="InputRadioGroup">
            <span class="icon">IG</span> InputRadioGroup
        </div>
        <div class="toolbox-item" draggable="true" data-type="ValidationSummary">
            <span class="icon">VS</span> ValidationSummary
        </div>
        <div class="toolbox-item" draggable="true" data-type="ValidationMessage">
            <span class="icon">VM</span> ValidationMessage
        </div>
        <div class="toolbox-item" draggable="true" data-type="AuthorizeView">
            <span class="icon">AV</span> AuthorizeView
        </div>
        <div class="toolbox-item" draggable="true" data-type="CascadingValue">
            <span class="icon">CV</span> CascadingValue
        </div>
        <div class="toolbox-item" draggable="true" data-type="Virtualize">
            <span class="icon">Vz</span> Virtualize
        </div>
        <div class="toolbox-item" draggable="true" data-type="PageTitle">
            <span class="icon">PT</span> PageTitle
        </div>
        <div class="toolbox-item" draggable="true" data-type="HeadContent">
            <span class="icon">HC</span> HeadContent
        </div>
        <div class="toolbox-item" draggable="true" data-type="ErrorBoundary">
            <span class="icon">EB</span> ErrorBoundary
        </div>
    </div>

    <!-- CANVAS -->
    <div class="canvas-wrapper" id="canvasWrapper">
        <div style="position: relative;">
            <span class="canvas-label" id="canvasLabel">Razor Component</span>
            <div class="canvas-container" id="designCanvas">
                <div class="drop-indicator" id="dropIndicator"></div>
            </div>
        </div>
    </div>

    <!-- PROPERTIES PANEL -->
    <div class="properties-panel" id="propertiesPanel">
        <h3>Properties</h3>
        <div class="no-selection" id="noSelection">Select a control to edit properties</div>
        <div id="propertyFields" style="display:none;"></div>
    </div>

</div>

<!-- CONTEXT MENU -->
<div class="context-menu" id="contextMenu">
    <div class="context-menu-item" onclick="deleteSelected()">Delete</div>
    <div class="context-menu-item" onclick="duplicateSelected()">Duplicate</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="bringToFront()">Bring to Front</div>
    <div class="context-menu-item" onclick="sendToBack()">Send to Back</div>
</div>

<script>
(function() {
    var vscode = acquireVsCodeApi();

    // =================== STATE ===================
    var controls = [];
    var selectedId = null;
    var nextId = 1;
    var undoStack = [];
    var redoStack = [];
    var isDraggingNew = false;
    var dragType = '';
    var isDraggingControl = false;
    var isResizing = false;
    var resizeHandle = '';
    var dragStartX = 0, dragStartY = 0;
    var dragOrigX = 0, dragOrigY = 0, dragOrigW = 0, dragOrigH = 0;
    var documentLoaded = false;

    // Preserved Razor sections
    var directiveLines = '';   // @page, @using, @inject, etc.
    var codeBlock = '';        // @code { ... }

    var canvas = document.getElementById('designCanvas');
    var dropIndicator = document.getElementById('dropIndicator');
    var propertiesPanel = document.getElementById('propertiesPanel');
    var contextMenu = document.getElementById('contextMenu');
    var canvasLabel = document.getElementById('canvasLabel');

    // =================== CONTROL DEFAULTS ===================
    var controlDefaults = {
        // HTML Structure
        'div':       { w: 200, h: 150, content: '' },
        'span':      { w: 100, h: 24,  content: 'span' },
        'p':         { w: 200, h: 24,  content: 'Paragraph text' },
        'h1':        { w: 250, h: 40,  content: 'Heading 1' },
        'h2':        { w: 220, h: 36,  content: 'Heading 2' },
        'h3':        { w: 200, h: 32,  content: 'Heading 3' },
        'h4':        { w: 180, h: 28,  content: 'Heading 4' },
        'h5':        { w: 160, h: 24,  content: 'Heading 5' },
        'h6':        { w: 150, h: 22,  content: 'Heading 6' },
        'a':         { w: 100, h: 24,  content: 'Link' },
        'hr':        { w: 200, h: 2,   content: '' },
        'br':        { w: 40,  h: 16,  content: '' },
        // HTML Forms
        'input':     { w: 180, h: 28,  content: '' },
        'textarea':  { w: 200, h: 80,  content: '' },
        'select':    { w: 180, h: 28,  content: '' },
        'button':    { w: 120, h: 32,  content: 'Button' },
        'label':     { w: 100, h: 24,  content: 'Label' },
        'form':      { w: 300, h: 250, content: '' },
        'fieldset':  { w: 280, h: 200, content: '' },
        // HTML Lists/Tables
        'ul':        { w: 180, h: 100, content: '' },
        'ol':        { w: 180, h: 100, content: '' },
        'li':        { w: 160, h: 24,  content: 'List item' },
        'table':     { w: 300, h: 150, content: '' },
        'tr':        { w: 280, h: 30,  content: '' },
        'th':        { w: 100, h: 28,  content: 'Header' },
        'td':        { w: 100, h: 28,  content: 'Cell' },
        // HTML Semantic
        'nav':       { w: 250, h: 50,  content: '' },
        'header':    { w: 300, h: 60,  content: '' },
        'footer':    { w: 300, h: 60,  content: '' },
        'section':   { w: 300, h: 200, content: '' },
        'article':   { w: 300, h: 200, content: '' },
        'aside':     { w: 200, h: 200, content: '' },
        'main':      { w: 400, h: 300, content: '' },
        // Blazor Components
        'EditForm':          { w: 350, h: 300, content: '' },
        'InputText':         { w: 180, h: 28,  content: '' },
        'InputNumber':       { w: 150, h: 28,  content: '' },
        'InputDate':         { w: 180, h: 28,  content: '' },
        'InputSelect':       { w: 180, h: 28,  content: '' },
        'InputCheckbox':     { w: 28,  h: 28,  content: '' },
        'InputTextArea':     { w: 200, h: 80,  content: '' },
        'InputFile':         { w: 200, h: 32,  content: '' },
        'InputRadio':        { w: 28,  h: 28,  content: '' },
        'InputRadioGroup':   { w: 180, h: 100, content: '' },
        'ValidationSummary': { w: 250, h: 60,  content: '' },
        'ValidationMessage': { w: 200, h: 24,  content: '' },
        'AuthorizeView':     { w: 250, h: 150, content: '' },
        'CascadingValue':    { w: 250, h: 150, content: '' },
        'Virtualize':        { w: 250, h: 200, content: '' },
        'PageTitle':         { w: 200, h: 28,  content: 'Page Title' },
        'HeadContent':       { w: 200, h: 60,  content: '' },
        'ErrorBoundary':     { w: 250, h: 150, content: '' }
    };

    // Types whose text content appears between open/close tags
    var contentTypes = ['button', 'label', 'p', 'span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'th', 'td', 'PageTitle'];

    // HTML void / self-closing elements
    var selfClosingTypes = ['input', 'hr', 'br',
        'InputText', 'InputNumber', 'InputDate', 'InputCheckbox',
        'InputFile', 'InputRadio', 'ValidationMessage'];

    // Container types (rendered with open + close tag, no text content)
    var containerTypes = ['div', 'form', 'fieldset', 'ul', 'ol', 'table', 'tr',
        'nav', 'header', 'footer', 'section', 'article', 'aside', 'main',
        'EditForm', 'InputSelect', 'InputTextArea', 'InputRadioGroup',
        'ValidationSummary', 'AuthorizeView', 'CascadingValue', 'Virtualize',
        'HeadContent', 'ErrorBoundary', 'textarea', 'select'];

    // Type-specific extra properties shown in the properties panel
    var typeExtraProperties = {
        'a':                 ['href', 'target'],
        'input':             ['type', 'placeholder', 'value', 'name', '@bind', '@bind:event'],
        'button':            ['type', '@onclick', 'disabled'],
        'textarea':          ['placeholder', 'rows', 'cols', '@bind'],
        'select':            ['name', '@bind'],
        'label':             ['for'],
        'form':              ['action', 'method'],
        'fieldset':          ['disabled'],
        'table':             ['class'],
        'th':                ['colspan', 'rowspan'],
        'td':                ['colspan', 'rowspan'],
        'EditForm':          ['Model', 'OnValidSubmit', 'OnInvalidSubmit'],
        'InputText':         ['@bind-Value', 'DisplayName', 'placeholder'],
        'InputNumber':       ['@bind-Value', 'DisplayName', 'placeholder'],
        'InputDate':         ['@bind-Value', 'DisplayName'],
        'InputSelect':       ['@bind-Value', 'DisplayName'],
        'InputCheckbox':     ['@bind-Value', 'DisplayName'],
        'InputTextArea':     ['@bind-Value', 'DisplayName', 'placeholder', 'rows'],
        'InputFile':         ['OnChange', 'multiple'],
        'InputRadio':        ['Value', 'name'],
        'InputRadioGroup':   ['@bind-Value', 'DisplayName'],
        'ValidationMessage': ['For'],
        'AuthorizeView':     ['Roles', 'Policy'],
        'CascadingValue':    ['Value', 'Name'],
        'Virtualize':        ['Items', 'ItemSize'],
        'img':               ['src', 'alt']
    };

    // =================== RAZOR PARSING ===================
    function parseRazorContent(text) {
        try {
            // --- 1. Extract @directive lines from the top ---
            var lines = text.split('\\n');
            var directiveEndIdx = 0;
            var directives = [];
            for (var li = 0; li < lines.length; li++) {
                var trimmed = lines[li].trim();
                if (trimmed === '') {
                    directives.push(lines[li]);
                    directiveEndIdx = li + 1;
                    continue;
                }
                if (trimmed.charAt(0) === '@' &&
                    !trimmed.match(/^@code\\s*\\{/) &&
                    (trimmed.match(/^@(page|using|inject|inherits|layout|attribute|implements|typeparam|namespace|preservewhitespace)/) ||
                     trimmed.match(/^@[a-zA-Z]+\\s+[^{]/))) {
                    directives.push(lines[li]);
                    directiveEndIdx = li + 1;
                    continue;
                }
                if (trimmed.charAt(0) === '@' && !trimmed.match(/^@code\\s*\\{/)) {
                    // Could be another directive line
                    if (trimmed.match(/^@[a-zA-Z]+\\s/) && !trimmed.match(/^@[a-z]/) ) {
                        directives.push(lines[li]);
                        directiveEndIdx = li + 1;
                        continue;
                    }
                }
                break;
            }
            directiveLines = directives.join('\\n');
            // Remove trailing empty lines from directives for clean check
            while (directiveLines.length > 0 && directiveLines.charAt(directiveLines.length - 1) === '\\n') {
                directiveLines = directiveLines.substring(0, directiveLines.length - 1);
            }

            // --- 2. Extract @code { ... } block (handle nested braces) ---
            codeBlock = '';
            var codeIdx = text.indexOf('@code');
            if (codeIdx >= 0) {
                // Find the opening brace
                var braceStart = text.indexOf('{', codeIdx);
                if (braceStart >= 0) {
                    var depth = 0;
                    var braceEnd = -1;
                    for (var bi = braceStart; bi < text.length; bi++) {
                        if (text.charAt(bi) === '{') depth++;
                        else if (text.charAt(bi) === '}') {
                            depth--;
                            if (depth === 0) {
                                braceEnd = bi;
                                break;
                            }
                        }
                    }
                    if (braceEnd >= 0) {
                        codeBlock = text.substring(codeIdx, braceEnd + 1);
                    } else {
                        codeBlock = text.substring(codeIdx);
                    }
                }
            }

            // --- 3. Extract the HTML portion ---
            var htmlPortion = text.substring(directiveEndIdx > 0 ? text.indexOf('\\n', text.indexOf(directives[directives.length - 1] || '')) : 0);
            // More reliable: rebuild from the remaining text
            var afterDirectives = lines.slice(directiveEndIdx).join('\\n');
            // Remove @code block from the HTML portion
            if (codeBlock) {
                afterDirectives = afterDirectives.replace(codeBlock, '');
            }
            htmlPortion = afterDirectives.trim();

            // --- 4. Parse HTML elements using regex ---
            var allTypeNames = Object.keys(controlDefaults);
            var parsed = [];

            for (var ti = 0; ti < allTypeNames.length; ti++) {
                var typeName = allTypeNames[ti];
                // Escape type name for regex (no special chars in our types)
                // Match self-closing: <type ... /> or open tag: <type ...>...</type>
                var selfClose = new RegExp('<' + typeName + '(\\\\s[^>]*)?\\\\/>', 'g');
                var openClose = new RegExp('<' + typeName + '(\\\\s[^>]*)?>(([\\\\s\\\\S]*?)?)<\\\\/' + typeName + '\\\\s*>', 'g');

                var m;
                while ((m = selfClose.exec(htmlPortion)) !== null) {
                    var ctrl = parseElementAttrs(typeName, m[1] || '', '');
                    if (ctrl) parsed.push(ctrl);
                }
                while ((m = openClose.exec(htmlPortion)) !== null) {
                    var innerText = (m[2] || '').trim();
                    var ctrl2 = parseElementAttrs(typeName, m[1] || '', innerText);
                    if (ctrl2) parsed.push(ctrl2);
                }
            }

            return parsed;
        } catch(e) {
            console.error('Razor parse error', e);
            return null;
        }
    }

    function parseElementAttrs(typeName, attrString, innerText) {
        var def = controlDefaults[typeName];
        if (!def) return null;

        var attrs = {};
        // Parse attributes - handles @bind-Value="x", class="y", etc.
        var attrRegex = /([\\w@:.\\-]+)\\s*=\\s*"([^"]*)"/g;
        var am;
        while ((am = attrRegex.exec(attrString)) !== null) {
            attrs[am[1]] = am[2];
        }
        // Also match single-quoted attributes
        var attrRegex2 = /([\\w@:.\\-]+)\\s*=\\s*'([^']*)'/g;
        while ((am = attrRegex2.exec(attrString)) !== null) {
            attrs[am[1]] = am[2];
        }

        // Extract positioning from style attribute
        var style = attrs['style'] || '';
        var xVal = extractStyleNum(style, 'left');
        var yVal = extractStyleNum(style, 'top');
        var wVal = extractStyleNum(style, 'width');
        var hVal = extractStyleNum(style, 'height');

        var ctrl = {
            id: nextId++,
            type: typeName,
            x: xVal !== null ? xVal : 10,
            y: yVal !== null ? yVal : 10 + (nextId - 2) * 5,
            w: wVal !== null ? wVal : def.w,
            h: hVal !== null ? hVal : def.h,
            name: attrs['id'] || '',
            content: innerText || def.content,
            properties: {},
            zIndex: nextId
        };

        // Gather additional attributes, skipping ones we handle
        var skipAttrs = ['style', 'id'];
        var propKeys = Object.keys(attrs);
        for (var pi = 0; pi < propKeys.length; pi++) {
            if (skipAttrs.indexOf(propKeys[pi]) >= 0) continue;
            ctrl.properties[propKeys[pi]] = attrs[propKeys[pi]];
        }

        return ctrl;
    }

    function extractStyleNum(style, prop) {
        var regex = new RegExp(prop + '\\\\s*:\\\\s*([\\\\d.]+)');
        var m = regex.exec(style);
        if (m) return parseFloat(m[1]);
        return null;
    }

    // =================== RAZOR GENERATION ===================
    function generateRazor() {
        var NL = '\\n';
        var razor = '';

        // Directives at the top
        if (directiveLines) {
            razor += directiveLines + NL + NL;
        }

        // Container div for absolute positioning
        var cw = (canvas.offsetWidth || 800) + 'px';
        var ch = (canvas.offsetHeight || 500) + 'px';
        razor += '<div style="position:relative;width:' + cw + ';height:' + ch + ';">' + NL;

        // Generate child elements
        for (var i = 0; i < controls.length; i++) {
            var ctrl = controls[i];
            var isSelfClosing = selfClosingTypes.indexOf(ctrl.type) >= 0;
            var isContainer = containerTypes.indexOf(ctrl.type) >= 0;
            var hasContent = ctrl.content && contentTypes.indexOf(ctrl.type) >= 0;

            var line = '    <' + ctrl.type;

            if (ctrl.name) line += ' id="' + escHtml(ctrl.name) + '"';

            // Style attribute for positioning
            line += ' style="position:absolute;left:' + Math.round(ctrl.x) + 'px;top:' + Math.round(ctrl.y) + 'px;width:' + Math.round(ctrl.w) + 'px;height:' + Math.round(ctrl.h) + 'px;"';

            // Extra properties
            var props = ctrl.properties || {};
            var pk = Object.keys(props);
            for (var pi = 0; pi < pk.length; pi++) {
                line += ' ' + pk[pi] + '="' + escHtml(props[pk[pi]]) + '"';
            }

            if (isSelfClosing) {
                line += ' />' + NL;
            } else if (hasContent) {
                line += '>' + escHtml(ctrl.content) + '</' + ctrl.type + '>' + NL;
            } else if (isContainer) {
                line += '></' + ctrl.type + '>' + NL;
            } else {
                // Default: close immediately, include content if any
                if (ctrl.content) {
                    line += '>' + escHtml(ctrl.content) + '</' + ctrl.type + '>' + NL;
                } else {
                    line += '></' + ctrl.type + '>' + NL;
                }
            }
            razor += line;
        }

        razor += '</div>' + NL;

        // @code block at the bottom
        if (codeBlock) {
            razor += NL + codeBlock + NL;
        }

        return razor;
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // =================== RENDER ===================
    function render() {
        canvas.querySelectorAll('.design-control').forEach(function(el) { el.remove(); });
        canvas.querySelectorAll('.resize-handle').forEach(function(el) { el.remove(); });

        for (var i = 0; i < controls.length; i++) {
            var ctrl = controls[i];
            var el = document.createElement('div');
            el.className = 'design-control' + (ctrl.id === selectedId ? ' selected' : '');
            el.dataset.id = ctrl.id;
            el.dataset.type = ctrl.type;
            el.style.left = ctrl.x + 'px';
            el.style.top = ctrl.y + 'px';
            el.style.width = ctrl.w + 'px';
            el.style.height = ctrl.h + 'px';
            el.style.zIndex = ctrl.zIndex || 1;

            el.innerHTML = renderControlInner(ctrl);

            (function(c) {
                el.addEventListener('mousedown', function(e) {
                    if (e.button === 2) return;
                    e.stopPropagation();
                    selectControl(c.id);
                    startDragControl(e, c);
                });
                el.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectControl(c.id);
                    showContextMenu(e.clientX, e.clientY);
                });
            })(ctrl);

            canvas.appendChild(el);

            if (ctrl.id === selectedId) {
                var handles = ['nw','n','ne','e','se','s','sw','w'];
                for (var hi = 0; hi < handles.length; hi++) {
                    var h = handles[hi];
                    var hel = document.createElement('div');
                    hel.className = 'resize-handle ' + h;
                    hel.style.zIndex = 101;
                    hel.style.position = 'absolute';

                    var px = ctrl.x, py = ctrl.y, pw = ctrl.w, ph = ctrl.h;
                    if (h.indexOf('n') >= 0) hel.style.top = (py - 4) + 'px';
                    if (h.indexOf('s') >= 0) hel.style.top = (py + ph - 4) + 'px';
                    if (h === 'e' || h === 'w') hel.style.top = (py + ph/2 - 4) + 'px';
                    if (h === 'n' || h === 's') hel.style.left = (px + pw/2 - 4) + 'px';
                    if (h.indexOf('w') >= 0 && h !== 'nw' && h !== 'sw') hel.style.left = (px - 4) + 'px';
                    if (h === 'nw' || h === 'sw') hel.style.left = (px - 4) + 'px';
                    if (h.indexOf('e') >= 0) hel.style.left = (px + pw - 4) + 'px';

                    (function(handle, control) {
                        hel.addEventListener('mousedown', function(e) {
                            e.stopPropagation();
                            startResize(e, control, handle);
                        });
                    })(h, ctrl);

                    canvas.appendChild(hel);
                }
            }
        }
    }

    function renderControlInner(ctrl) {
        switch(ctrl.type) {
            // HTML Structure
            case 'div':
                return '<span class="control-label" style="pointer-events:none;color:#007acc88;font-size:10px">&lt;div&gt;</span>';
            case 'span':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'span') + '</span>';
            case 'p':
                return '<span class="control-label" style="pointer-events:none;font-size:13px">' + esc(ctrl.content || 'Paragraph text') + '</span>';
            case 'h1':
                return '<span class="control-label" style="pointer-events:none;font-size:24px;font-weight:bold">' + esc(ctrl.content || 'Heading 1') + '</span>';
            case 'h2':
                return '<span class="control-label" style="pointer-events:none;font-size:20px;font-weight:bold">' + esc(ctrl.content || 'Heading 2') + '</span>';
            case 'h3':
                return '<span class="control-label" style="pointer-events:none;font-size:17px;font-weight:bold">' + esc(ctrl.content || 'Heading 3') + '</span>';
            case 'h4':
                return '<span class="control-label" style="pointer-events:none;font-size:15px;font-weight:bold">' + esc(ctrl.content || 'Heading 4') + '</span>';
            case 'h5':
                return '<span class="control-label" style="pointer-events:none;font-size:13px;font-weight:bold">' + esc(ctrl.content || 'Heading 5') + '</span>';
            case 'h6':
                return '<span class="control-label" style="pointer-events:none;font-size:11px;font-weight:bold">' + esc(ctrl.content || 'Heading 6') + '</span>';
            case 'a':
                return '<span class="control-label" style="pointer-events:none;color:#58a6ff;text-decoration:underline">' + esc(ctrl.content || 'Link') + '</span>';
            case 'hr':
                return '<span style="pointer-events:none;position:absolute;top:50%;left:4px;right:4px;height:1px;background:#888"></span>';
            case 'br':
                return '<span class="control-label" style="pointer-events:none;color:#88888888;font-size:9px">&lt;br&gt;</span>';

            // HTML Forms
            case 'input':
                return '<span class="control-label" style="pointer-events:none;text-align:left;padding-left:6px;color:#999;">' + esc(ctrl.properties['placeholder'] || 'input') + '</span>';
            case 'textarea':
                return '<span class="control-label" style="pointer-events:none;align-self:flex-start;padding:6px;color:#999;">' + esc(ctrl.properties['placeholder'] || 'textarea') + '</span>';
            case 'select':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 8px;width:100%"><span>select</span><span>&#9660;</span></span>';
            case 'button':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'Button') + '</span>';
            case 'label':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'Label') + '</span>';
            case 'form':
                return '<span class="control-label" style="pointer-events:none;color:#88888888;font-size:10px">&lt;form&gt;</span>';
            case 'fieldset':
                return '<span class="control-label" style="pointer-events:none;align-self:flex-start;padding:6px;font-size:10px;color:#888">&lt;fieldset&gt;</span>';

            // HTML Lists/Tables
            case 'ul':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span>&#8226; Item 1</span><span>&#8226; Item 2</span><span>&#8226; Item 3</span></span>';
            case 'ol':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span>1. Item 1</span><span>2. Item 2</span><span>3. Item 3</span></span>';
            case 'li':
                return '<span class="control-label" style="pointer-events:none;text-align:left;padding-left:6px">&#8226; ' + esc(ctrl.content || 'List item') + '</span>';
            case 'table':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;font-size:10px"><span style="display:flex;border-bottom:1px solid #555;background:#333;padding:2px 0"><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col1</span><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col2</span><span style="flex:1;padding:2px 6px">Col3</span></span></span>';
            case 'tr':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&lt;tr&gt;</span>';
            case 'th':
                return '<span class="control-label" style="pointer-events:none;font-weight:bold;font-size:11px">' + esc(ctrl.content || 'Header') + '</span>';
            case 'td':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'Cell') + '</span>';

            // HTML Semantic
            case 'nav':
                return '<span class="control-label" style="pointer-events:none;color:#00cc7a88;font-size:10px">&lt;nav&gt;</span>';
            case 'header':
                return '<span class="control-label" style="pointer-events:none;color:#7a00cc88;font-size:10px">&lt;header&gt;</span>';
            case 'footer':
                return '<span class="control-label" style="pointer-events:none;color:#cc7a0088;font-size:10px">&lt;footer&gt;</span>';
            case 'section':
                return '<span class="control-label" style="pointer-events:none;color:#007acc88;font-size:10px">&lt;section&gt;</span>';
            case 'article':
                return '<span class="control-label" style="pointer-events:none;color:#cccc0088;font-size:10px">&lt;article&gt;</span>';
            case 'aside':
                return '<span class="control-label" style="pointer-events:none;color:#cc007a88;font-size:10px">&lt;aside&gt;</span>';
            case 'main':
                return '<span class="control-label" style="pointer-events:none;color:#007acc88;font-size:10px">&lt;main&gt;</span>';

            // Blazor Components
            case 'EditForm':
                return '<span class="control-label" style="pointer-events:none;color:#8000ff88;font-size:10px">&lt;EditForm&gt;</span>';
            case 'InputText':
                return '<span class="control-label" style="pointer-events:none;text-align:left;padding-left:6px;color:#999;">InputText</span>';
            case 'InputNumber':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 6px;width:100%"><span style="color:#999">0</span><span style="display:flex;flex-direction:column;font-size:8px;line-height:1"><span>&#9650;</span><span>&#9660;</span></span></span>';
            case 'InputDate':
                return '<span class="control-label" style="pointer-events:none;padding:0 6px;color:#999;">Select date</span>';
            case 'InputSelect':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 8px;width:100%"><span style="color:#999">InputSelect</span><span>&#9660;</span></span>';
            case 'InputCheckbox':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%"><span style="width:16px;height:16px;border:1px solid #888;border-radius:2px;display:inline-block;background:#2a2a2a"></span></span>';
            case 'InputTextArea':
                return '<span class="control-label" style="pointer-events:none;align-self:flex-start;padding:6px;color:#999;">InputTextArea</span>';
            case 'InputFile':
                return '<span class="control-label" style="pointer-events:none;padding:0 6px;color:#999;">Choose file...</span>';
            case 'InputRadio':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%"><span style="width:16px;height:16px;border:2px solid #888;border-radius:50%;display:inline-block;background:#2a2a2a"></span></span>';
            case 'InputRadioGroup':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:4px;width:100%"><span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:2px solid #888;border-radius:50%;display:inline-block;background:#2a2a2a"></span>Option 1</span><span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:2px solid #888;border-radius:50%;display:inline-block;background:#2a2a2a"></span>Option 2</span></span>';
            case 'ValidationSummary':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:10px;color:#ff6464;gap:2px;width:100%"><span>&#9888; Validation errors:</span><span style="padding-left:8px">&#8226; Error message</span></span>';
            case 'ValidationMessage':
                return '<span class="control-label" style="pointer-events:none;color:#ff6464;font-size:10px">&#9888; Validation message</span>';
            case 'AuthorizeView':
                return '<span class="control-label" style="pointer-events:none;color:#00c86488;font-size:10px">&#128274; AuthorizeView</span>';
            case 'CascadingValue':
                return '<span class="control-label" style="pointer-events:none;color:#6464ff88;font-size:10px">&#8595; CascadingValue</span>';
            case 'Virtualize':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&#8942; Virtualize</span>';
            case 'PageTitle':
                return '<span class="control-label" style="pointer-events:none;font-weight:bold">' + esc(ctrl.content || 'Page Title') + '</span>';
            case 'HeadContent':
                return '<span class="control-label" style="pointer-events:none;color:#ffc80088;font-size:10px">&lt;HeadContent&gt;</span>';
            case 'ErrorBoundary':
                return '<span class="control-label" style="pointer-events:none;color:#ff323288;font-size:10px">&#9888; ErrorBoundary</span>';
            default:
                return '<span class="control-label">' + esc(ctrl.type) + '</span>';
        }
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // =================== SELECTION ===================
    function selectControl(id) {
        selectedId = id;
        render();
        updateProperties();
    }

    canvas.addEventListener('mousedown', function(e) {
        if (e.target === canvas || e.target === dropIndicator) {
            selectedId = null;
            render();
            updateProperties();
            hideContextMenu();
        }
    });

    document.addEventListener('click', function() { hideContextMenu(); });

    // =================== DRAG NEW CONTROLS ===================
    document.querySelectorAll('.toolbox-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            isDraggingNew = true;
            dragType = item.dataset.type;
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', dragType);
        });
        item.addEventListener('dragend', function() {
            isDraggingNew = false;
            dropIndicator.style.display = 'none';
        });
    });

    canvas.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var def = controlDefaults[dragType] || { w: 100, h: 30 };
        dropIndicator.style.display = 'block';
        dropIndicator.style.left = (x - def.w/2) + 'px';
        dropIndicator.style.top = (y - def.h/2) + 'px';
        dropIndicator.style.width = def.w + 'px';
        dropIndicator.style.height = def.h + 'px';
    });

    canvas.addEventListener('dragleave', function() {
        dropIndicator.style.display = 'none';
    });

    canvas.addEventListener('drop', function(e) {
        e.preventDefault();
        dropIndicator.style.display = 'none';
        var type = e.dataTransfer.getData('text/plain');
        if (!type || !controlDefaults[type]) return;

        var rect = canvas.getBoundingClientRect();
        var def = controlDefaults[type];
        var x = Math.max(0, e.clientX - rect.left - def.w/2);
        var y = Math.max(0, e.clientY - rect.top - def.h/2);

        saveUndo();
        var ctrl = {
            id: nextId++,
            type: type,
            x: Math.round(x),
            y: Math.round(y),
            w: def.w,
            h: def.h,
            name: '',
            content: def.content,
            properties: {},
            zIndex: controls.length + 1
        };
        controls.push(ctrl);
        selectControl(ctrl.id);
    });

    // =================== DRAG EXISTING CONTROLS ===================
    function startDragControl(e, ctrl) {
        isDraggingControl = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragOrigX = ctrl.x;
        dragOrigY = ctrl.y;
        saveUndo();
    }

    document.addEventListener('mousemove', function(e) {
        if (isDraggingControl && selectedId !== null) {
            var ctrl = controls.find(function(c) { return c.id === selectedId; });
            if (!ctrl) return;
            var dx = e.clientX - dragStartX;
            var dy = e.clientY - dragStartY;
            ctrl.x = Math.max(0, dragOrigX + dx);
            ctrl.y = Math.max(0, dragOrigY + dy);
            render();
            updateProperties();
        }
        if (isResizing && selectedId !== null) {
            handleResize(e);
        }
    });

    document.addEventListener('mouseup', function() {
        isDraggingControl = false;
        isResizing = false;
    });

    // =================== RESIZE ===================
    function startResize(e, ctrl, handle) {
        isResizing = true;
        resizeHandle = handle;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragOrigX = ctrl.x;
        dragOrigY = ctrl.y;
        dragOrigW = ctrl.w;
        dragOrigH = ctrl.h;
        saveUndo();
    }

    function handleResize(e) {
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (!ctrl) return;

        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;
        var minW = 20, minH = 16;

        var x = dragOrigX, y = dragOrigY, w = dragOrigW, h = dragOrigH;

        if (resizeHandle.indexOf('e') >= 0) w = Math.max(minW, dragOrigW + dx);
        if (resizeHandle.indexOf('s') >= 0) h = Math.max(minH, dragOrigH + dy);
        if (resizeHandle.indexOf('w') >= 0) {
            w = Math.max(minW, dragOrigW - dx);
            x = dragOrigX + dragOrigW - w;
        }
        if (resizeHandle.indexOf('n') >= 0) {
            h = Math.max(minH, dragOrigH - dy);
            y = dragOrigY + dragOrigH - h;
        }

        ctrl.x = Math.max(0, x);
        ctrl.y = Math.max(0, y);
        ctrl.w = w;
        ctrl.h = h;
        render();
        updateProperties();
    }

    // =================== PROPERTIES PANEL ===================
    function updateProperties() {
        var noSel = document.getElementById('noSelection');
        var fields = document.getElementById('propertyFields');

        if (selectedId === null) {
            noSel.style.display = 'block';
            fields.style.display = 'none';
            return;
        }

        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (!ctrl) { noSel.style.display = 'block'; fields.style.display = 'none'; return; }

        noSel.style.display = 'none';
        fields.style.display = 'block';
        fields.innerHTML = '';

        var rows = [
            { label: 'Type', key: '_type', value: ctrl.type, readonly: true },
            { label: 'id', key: 'name', value: ctrl.name || '' },
            { label: 'X (left)', key: 'x', value: Math.round(ctrl.x), type: 'number' },
            { label: 'Y (top)', key: 'y', value: Math.round(ctrl.y), type: 'number' },
            { label: 'Width', key: 'w', value: Math.round(ctrl.w), type: 'number' },
            { label: 'Height', key: 'h', value: Math.round(ctrl.h), type: 'number' }
        ];

        // Content field for content types
        if (contentTypes.indexOf(ctrl.type) >= 0) {
            rows.push({ label: 'Content', key: 'content', value: ctrl.content || '' });
        }

        // Common properties: class
        rows.push({ label: 'class', key: 'prop_class', value: ctrl.properties['class'] || '', propKey: 'class' });

        // Type-specific extra properties
        var extras = typeExtraProperties[ctrl.type] || [];
        for (var ei = 0; ei < extras.length; ei++) {
            var propName = extras[ei];
            rows.push({ label: propName, key: 'prop_' + propName, value: ctrl.properties[propName] || '', propKey: propName });
        }

        // Show any other preserved properties not already shown
        var shownPropKeys = ['class'];
        for (var si = 0; si < extras.length; si++) {
            shownPropKeys.push(extras[si]);
        }
        var propKeys = Object.keys(ctrl.properties || {});
        for (var pi = 0; pi < propKeys.length; pi++) {
            if (shownPropKeys.indexOf(propKeys[pi]) >= 0) continue;
            rows.push({ label: propKeys[pi], key: 'prop_' + propKeys[pi], value: ctrl.properties[propKeys[pi]], propKey: propKeys[pi] });
        }

        for (var ri = 0; ri < rows.length; ri++) {
            var row = rows[ri];
            var div = document.createElement('div');
            div.className = 'prop-row';
            var lbl = document.createElement('label');
            lbl.textContent = row.label;
            div.appendChild(lbl);

            var input = document.createElement('input');
            input.type = row.type || 'text';
            input.value = row.value;
            if (row.readonly) input.readOnly = true;

            (function(r, inp, c) {
                inp.addEventListener('change', function() {
                    saveUndo();
                    if (r.key === 'x') c.x = parseFloat(inp.value) || 0;
                    else if (r.key === 'y') c.y = parseFloat(inp.value) || 0;
                    else if (r.key === 'w') c.w = Math.max(20, parseFloat(inp.value) || 20);
                    else if (r.key === 'h') c.h = Math.max(16, parseFloat(inp.value) || 16);
                    else if (r.key === 'name') c.name = inp.value;
                    else if (r.key === 'content') c.content = inp.value;
                    else if (r.propKey) {
                        if (inp.value) {
                            c.properties[r.propKey] = inp.value;
                        } else {
                            delete c.properties[r.propKey];
                        }
                    }
                    render();
                });
            })(row, input, ctrl);

            div.appendChild(input);
            fields.appendChild(div);
        }
    }

    // =================== UNDO/REDO ===================
    function saveUndo() {
        undoStack.push(JSON.stringify(controls));
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
    }

    window.undoAction = function() {
        if (undoStack.length === 0) return;
        redoStack.push(JSON.stringify(controls));
        controls = JSON.parse(undoStack.pop());
        selectedId = null;
        render();
        updateProperties();
    };

    window.redoAction = function() {
        if (redoStack.length === 0) return;
        undoStack.push(JSON.stringify(controls));
        controls = JSON.parse(redoStack.pop());
        selectedId = null;
        render();
        updateProperties();
    };

    // =================== ACTIONS ===================
    window.deleteSelected = function() {
        if (selectedId === null) return;
        saveUndo();
        controls = controls.filter(function(c) { return c.id !== selectedId; });
        selectedId = null;
        render();
        updateProperties();
        hideContextMenu();
    };

    window.duplicateSelected = function() {
        if (selectedId === null) return;
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (!ctrl) return;
        saveUndo();
        var dup = JSON.parse(JSON.stringify(ctrl));
        dup.id = nextId++;
        dup.x += 20;
        dup.y += 20;
        dup.name = '';
        controls.push(dup);
        selectControl(dup.id);
        hideContextMenu();
    };

    window.bringToFront = function() {
        if (selectedId === null) return;
        var maxZ = Math.max.apply(null, controls.map(function(c) { return c.zIndex || 1; }).concat([0]));
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (ctrl) { ctrl.zIndex = maxZ + 1; render(); }
        hideContextMenu();
    };

    window.sendToBack = function() {
        if (selectedId === null) return;
        var minZ = Math.min.apply(null, controls.map(function(c) { return c.zIndex || 1; }).concat([999]));
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (ctrl) { ctrl.zIndex = Math.max(1, minZ - 1); render(); }
        hideContextMenu();
    };

    window.syncToRazor = function() {
        var razor = generateRazor();
        vscode.postMessage({ type: 'updateRazor', content: razor });
    };

    // =================== CONTEXT MENU ===================
    function showContextMenu(x, y) {
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.add('visible');
    }

    function hideContextMenu() {
        contextMenu.classList.remove('visible');
    }

    canvas.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // =================== KEYBOARD ===================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            window.deleteSelected();
        }
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undoAction(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redoAction(); }
        if (e.ctrlKey && e.key === 'd') { e.preventDefault(); window.duplicateSelected(); }
        if (e.key === 'Escape') { selectedId = null; render(); updateProperties(); }

        if (selectedId !== null && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0) {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            e.preventDefault();
            var ctrl = controls.find(function(c) { return c.id === selectedId; });
            if (!ctrl) return;
            var step = e.shiftKey ? 10 : 1;
            saveUndo();
            if (e.key === 'ArrowUp') ctrl.y = Math.max(0, ctrl.y - step);
            if (e.key === 'ArrowDown') ctrl.y += step;
            if (e.key === 'ArrowLeft') ctrl.x = Math.max(0, ctrl.x - step);
            if (e.key === 'ArrowRight') ctrl.x += step;
            render();
            updateProperties();
        }
    });

    // =================== COMMUNICATION WITH VS CODE ===================
    window.addEventListener('message', function(event) {
        var message = event.data;
        switch (message.type) {
            case 'documentUpdate': {
                var parsed = parseRazorContent(message.content);
                if (!documentLoaded) {
                    if (parsed && parsed.length > 0) {
                        controls = parsed;
                    }
                    documentLoaded = true;
                }
                render();
                updateProperties();
                break;
            }
        }
    });

    // Signal ready
    vscode.postMessage({ type: 'ready' });
    render();
})();
</script>
</body>
</html>`;
}
