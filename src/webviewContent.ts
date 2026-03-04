import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>XAML Visual Designer</title>
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

/* Control type visual styles */
.design-control[data-type="Button"]      { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="TextBlock"]   { background: transparent; border: 1px dashed #555; }
.design-control[data-type="TextBox"]     { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="CheckBox"]    { background: transparent; border: 1px dashed #555; }
.design-control[data-type="RadioButton"] { background: transparent; border: 1px dashed #555; }
.design-control[data-type="ToggleSwitch"]{ background: transparent; border: 1px dashed #555; }
.design-control[data-type="Label"]       { background: transparent; border: 1px dashed #555; }
.design-control[data-type="ComboBox"]    { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="ListBox"]     { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="Slider"]      { background: transparent; border: 1px dashed #555; }
.design-control[data-type="ProgressBar"] { background: #2a2a2a; border: 1px solid #555; border-radius: 3px; overflow: hidden; }
.design-control[data-type="Image"]       { background: #333; border: 1px solid #555; }
.design-control[data-type="NumericUpDown"]{ background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="DatePicker"]  { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="TimePicker"]  { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="Calendar"]    { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="Expander"]    { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="TabControl"]  { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="Menu"]        { background: #2d2d30; border: 1px solid #555; }
.design-control[data-type="TreeView"]    { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="DataGrid"]    { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="Separator"]   { background: #555; border: none; }
.design-control[data-type="Rectangle"]   { background: rgba(100,149,237,0.3); border: 1px solid #6495ed; }
.design-control[data-type="Ellipse"]     { background: rgba(100,149,237,0.3); border: 1px solid #6495ed; border-radius: 50%; }
.design-control[data-type="Line"]        { background: transparent; border: 1px dashed #6495ed; }
.design-control[data-type="Path"]        { background: transparent; border: 1px dashed #6495ed; }
.design-control[data-type="StackPanel"]  { background: rgba(0,122,204,0.08); border: 1px dashed #007acc55; min-width: 60px; min-height: 40px; }
.design-control[data-type="Grid"]        { background: rgba(0,204,122,0.06); border: 1px dashed #00cc7a55; }
.design-control[data-type="Border"]      { background: rgba(200,200,200,0.05); border: 1px solid #666; border-radius: 3px; }
.design-control[data-type="Canvas"]      { background: rgba(200,200,0,0.06); border: 1px dashed #cccc0055; }
.design-control[data-type="WrapPanel"]   { background: rgba(204,122,0,0.08); border: 1px dashed #cc7a0055; }
.design-control[data-type="DockPanel"]   { background: rgba(122,0,204,0.08); border: 1px dashed #7a00cc55; }
.design-control[data-type="UniformGrid"] { background: rgba(0,204,122,0.06); border: 1px dashed #00cc7a55; }
.design-control[data-type="ScrollViewer"]{ background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="Viewbox"]     { background: rgba(200,200,200,0.05); border: 1px dashed #888; }

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
    <span class="title">XAML Designer</span>
    <button onclick="undoAction()" title="Undo">&#8617; Undo</button>
    <button onclick="redoAction()" title="Redo">&#8618; Redo</button>
    <span class="separator"></span>
    <button onclick="deleteSelected()" title="Delete selected">&#128465; Delete</button>
    <button onclick="bringToFront()" title="Bring to front">&#11014; Front</button>
    <button onclick="sendToBack()" title="Send to back">&#11015; Back</button>
    <span class="separator"></span>
    <button onclick="syncToXaml()" title="Sync visual to XAML">&#128190; Sync to XAML</button>
</div>

<!-- MAIN LAYOUT -->
<div class="main-layout">

    <!-- TOOLBOX -->
    <div class="toolbox">
        <h3>Common Controls</h3>
        <div class="toolbox-item" draggable="true" data-type="Button">
            <span class="icon">B</span> Button
        </div>
        <div class="toolbox-item" draggable="true" data-type="TextBlock">
            <span class="icon">T</span> TextBlock
        </div>
        <div class="toolbox-item" draggable="true" data-type="TextBox">
            <span class="icon">Tx</span> TextBox
        </div>
        <div class="toolbox-item" draggable="true" data-type="Label">
            <span class="icon">L</span> Label
        </div>
        <div class="toolbox-item" draggable="true" data-type="CheckBox">
            <span class="icon">Ck</span> CheckBox
        </div>
        <div class="toolbox-item" draggable="true" data-type="RadioButton">
            <span class="icon">Rb</span> RadioButton
        </div>
        <div class="toolbox-item" draggable="true" data-type="ToggleSwitch">
            <span class="icon">Ts</span> ToggleSwitch
        </div>
        <div class="toolbox-item" draggable="true" data-type="ComboBox">
            <span class="icon">Cb</span> ComboBox
        </div>
        <div class="toolbox-item" draggable="true" data-type="ListBox">
            <span class="icon">Lb</span> ListBox
        </div>
        <div class="toolbox-item" draggable="true" data-type="Slider">
            <span class="icon">Sl</span> Slider
        </div>
        <div class="toolbox-item" draggable="true" data-type="ProgressBar">
            <span class="icon">Pb</span> ProgressBar
        </div>
        <div class="toolbox-item" draggable="true" data-type="Image">
            <span class="icon">Im</span> Image
        </div>

        <h3>Input / Pickers</h3>
        <div class="toolbox-item" draggable="true" data-type="NumericUpDown">
            <span class="icon">Nu</span> NumericUpDown
        </div>
        <div class="toolbox-item" draggable="true" data-type="DatePicker">
            <span class="icon">Dp</span> DatePicker
        </div>
        <div class="toolbox-item" draggable="true" data-type="TimePicker">
            <span class="icon">Tp</span> TimePicker
        </div>
        <div class="toolbox-item" draggable="true" data-type="Calendar">
            <span class="icon">Ca</span> Calendar
        </div>

        <h3>Containers</h3>
        <div class="toolbox-item" draggable="true" data-type="Expander">
            <span class="icon">Ex</span> Expander
        </div>
        <div class="toolbox-item" draggable="true" data-type="TabControl">
            <span class="icon">Tc</span> TabControl
        </div>
        <div class="toolbox-item" draggable="true" data-type="Menu">
            <span class="icon">Mn</span> Menu
        </div>
        <div class="toolbox-item" draggable="true" data-type="TreeView">
            <span class="icon">Tv</span> TreeView
        </div>
        <div class="toolbox-item" draggable="true" data-type="DataGrid">
            <span class="icon">Dg</span> DataGrid
        </div>
        <div class="toolbox-item" draggable="true" data-type="ScrollViewer">
            <span class="icon">Sv</span> ScrollViewer
        </div>

        <h3>Layout</h3>
        <div class="toolbox-item" draggable="true" data-type="StackPanel">
            <span class="icon">Sp</span> StackPanel
        </div>
        <div class="toolbox-item" draggable="true" data-type="WrapPanel">
            <span class="icon">Wp</span> WrapPanel
        </div>
        <div class="toolbox-item" draggable="true" data-type="DockPanel">
            <span class="icon">Dk</span> DockPanel
        </div>
        <div class="toolbox-item" draggable="true" data-type="Grid">
            <span class="icon">#</span> Grid
        </div>
        <div class="toolbox-item" draggable="true" data-type="UniformGrid">
            <span class="icon">##</span> UniformGrid
        </div>
        <div class="toolbox-item" draggable="true" data-type="Canvas">
            <span class="icon">Cv</span> Canvas
        </div>
        <div class="toolbox-item" draggable="true" data-type="Border">
            <span class="icon">Bd</span> Border
        </div>
        <div class="toolbox-item" draggable="true" data-type="Viewbox">
            <span class="icon">Vb</span> Viewbox
        </div>

        <h3>Shapes</h3>
        <div class="toolbox-item" draggable="true" data-type="Rectangle">
            <span class="icon">Re</span> Rectangle
        </div>
        <div class="toolbox-item" draggable="true" data-type="Ellipse">
            <span class="icon">El</span> Ellipse
        </div>
        <div class="toolbox-item" draggable="true" data-type="Line">
            <span class="icon">Ln</span> Line
        </div>
        <div class="toolbox-item" draggable="true" data-type="Path">
            <span class="icon">Pa</span> Path
        </div>
        <div class="toolbox-item" draggable="true" data-type="Separator">
            <span class="icon">Se</span> Separator
        </div>
    </div>

    <!-- CANVAS -->
    <div class="canvas-wrapper" id="canvasWrapper">
        <div style="position: relative;">
            <span class="canvas-label" id="canvasLabel">Window</span>
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
    const vscode = acquireVsCodeApi();

    // =================== STATE ===================
    let controls = [];
    let selectedId = null;
    let nextId = 1;
    let undoStack = [];
    let redoStack = [];
    let isDraggingNew = false;
    let dragType = '';
    let isDraggingControl = false;
    let isResizing = false;
    let resizeHandle = '';
    let dragStartX = 0, dragStartY = 0;
    let dragOrigX = 0, dragOrigY = 0, dragOrigW = 0, dragOrigH = 0;
    let documentLoaded = false;

    // *** CRITICAL: preserve original document structure ***
    let originalRootOpenTag = '';     // full root opening tag with all xmlns, attributes, etc.
    let originalRootCloseTag = '';    // e.g. '</Window>'
    let originalRootTag = '';         // e.g. 'Window'
    let hasCanvasWrapper = false;     // whether original had a <Canvas> child under root
    let canvasWrapperOpenTag = '';    // full <Canvas ...> open tag from original

    const canvas = document.getElementById('designCanvas');
    const dropIndicator = document.getElementById('dropIndicator');
    const propertiesPanel = document.getElementById('propertiesPanel');
    const contextMenu = document.getElementById('contextMenu');
    const canvasLabel = document.getElementById('canvasLabel');

    // =================== CONTROL DEFAULTS ===================
    const controlDefaults = {
        // Common controls
        Button:       { w: 120, h: 32,  content: 'Button' },
        TextBlock:    { w: 100, h: 24,  content: 'TextBlock' },
        TextBox:      { w: 150, h: 28,  content: '' },
        Label:        { w: 100, h: 30,  content: 'Label' },
        CheckBox:     { w: 120, h: 24,  content: 'CheckBox' },
        RadioButton:  { w: 120, h: 24,  content: 'RadioButton' },
        ToggleSwitch: { w: 80,  h: 28,  content: '' },
        ComboBox:     { w: 150, h: 28,  content: '' },
        ListBox:      { w: 150, h: 100, content: '' },
        Slider:       { w: 150, h: 22,  content: '' },
        ProgressBar:  { w: 150, h: 20,  content: '' },
        Image:        { w: 100, h: 80,  content: '' },
        // Input / Pickers
        NumericUpDown:{ w: 120, h: 28,  content: '' },
        DatePicker:   { w: 140, h: 30,  content: '' },
        TimePicker:   { w: 120, h: 30,  content: '' },
        Calendar:     { w: 200, h: 180, content: '' },
        // Containers
        Expander:     { w: 200, h: 120, content: 'Expander' },
        TabControl:   { w: 250, h: 180, content: '' },
        Menu:         { w: 200, h: 28,  content: '' },
        TreeView:     { w: 180, h: 150, content: '' },
        DataGrid:     { w: 300, h: 200, content: '' },
        ScrollViewer: { w: 200, h: 150, content: '' },
        // Layout
        StackPanel:   { w: 200, h: 150, content: '' },
        WrapPanel:    { w: 200, h: 150, content: '' },
        DockPanel:    { w: 250, h: 180, content: '' },
        Grid:         { w: 250, h: 180, content: '' },
        UniformGrid:  { w: 200, h: 150, content: '' },
        Canvas:       { w: 200, h: 150, content: '' },
        Border:       { w: 160, h: 120, content: '' },
        Viewbox:      { w: 150, h: 150, content: '' },
        // Shapes
        Rectangle:    { w: 100, h: 60,  content: '' },
        Ellipse:      { w: 80,  h: 80,  content: '' },
        Line:         { w: 100, h: 2,   content: '' },
        Path:         { w: 80,  h: 80,  content: '' },
        Separator:    { w: 150, h: 2,   content: '' },
    };

    // Types that use "Content" attribute
    const contentTypes = ['Button', 'CheckBox', 'RadioButton', 'Label', 'Expander'];
    // Types that use "Text" attribute
    const textTypes = ['TextBlock', 'TextBox'];
    // Container/layout types (not self-closing)
    const containerTypes = ['StackPanel', 'WrapPanel', 'DockPanel', 'Grid', 'UniformGrid',
        'Canvas', 'Border', 'Viewbox', 'Expander', 'TabControl', 'Menu', 'TreeView',
        'DataGrid', 'ScrollViewer', 'ListBox'];

    // =================== XAML PARSING ===================
    /**
     * Parse XAML file. Preserves root opening/closing tags EXACTLY.
     * Extracts child controls for the visual designer.
     */
    function parseXamlToControls(xmlText) {
        try {
            // --- 1. Extract root open tag with ALL attributes using character scanning ---
            // This preserves namespaces, Title, x:Class, mc:Ignorable, etc. exactly
            var rootTagMatch = xmlText.match(/^\\s*<([a-zA-Z_][a-zA-Z0-9_.:]*)/);
            if (!rootTagMatch) return null;
            originalRootTag = rootTagMatch[1];
            canvasLabel.textContent = originalRootTag;

            // Find the end of the root opening tag by scanning chars
            // We need to handle multi-line attributes and quoted values
            var inQuote = false;
            var quoteChar = '';
            var foundOpen = false;
            var rootOpenEnd = -1;
            for (var i = 0; i < xmlText.length; i++) {
                var ch = xmlText[i];
                if (inQuote) {
                    if (ch === quoteChar) inQuote = false;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    inQuote = true;
                    quoteChar = ch;
                    continue;
                }
                if (ch === '<' && !foundOpen) {
                    foundOpen = true;
                    continue;
                }
                if (ch === '>' && foundOpen) {
                    rootOpenEnd = i;
                    break;
                }
            }

            if (rootOpenEnd === -1) return null;
            originalRootOpenTag = xmlText.substring(0, rootOpenEnd + 1);

            // Find closing tag for the root element
            var closeIdx = xmlText.lastIndexOf('</' + originalRootTag);
            if (closeIdx >= 0) {
                originalRootCloseTag = xmlText.substring(closeIdx).trim();
            } else {
                originalRootCloseTag = '</' + originalRootTag + '>';
            }

            // --- 2. Parse with DOMParser to extract controls ---
            var parser = new DOMParser();
            var doc = parser.parseFromString(xmlText, 'application/xml');
            var parseError = doc.querySelector('parsererror');
            if (parseError) {
                console.warn('XML parse error, controls may not load');
                return [];
            }

            var root = doc.documentElement;

            // Read design dimensions from root
            var dw = root.getAttribute('d:DesignWidth') || root.getAttribute('Width');
            var dh = root.getAttribute('d:DesignHeight') || root.getAttribute('Height');
            if (dw) canvas.style.width = dw.replace(/[^0-9.]/g, '') + 'px';
            if (dh) canvas.style.height = dh.replace(/[^0-9.]/g, '') + 'px';

            // --- 3. Check for Canvas wrapper and preserve its opening tag ---
            hasCanvasWrapper = false;
            canvasWrapperOpenTag = '';
            var searchRoot = root;

            for (var ci = 0; ci < root.children.length; ci++) {
                var child = root.children[ci];
                if (child.localName === 'Canvas') {
                    hasCanvasWrapper = true;
                    // Extract the Canvas open tag from the original text
                    var canvasOpenRegex = /<Canvas([\\s\\S]*?)>/;
                    var innerXml = xmlText.substring(rootOpenEnd + 1);
                    var canvasMatch = innerXml.match(canvasOpenRegex);
                    if (canvasMatch) {
                        canvasWrapperOpenTag = '<Canvas' + canvasMatch[1] + '>';
                    } else {
                        canvasWrapperOpenTag = '<Canvas>';
                    }
                    searchRoot = child;
                    break;
                }
            }

            // --- 4. Walk children and extract known controls ---
            var parsed = [];
            function walkChildren(parent) {
                for (var j = 0; j < parent.children.length; j++) {
                    var el = parent.children[j];
                    var type = el.localName;
                    if (!controlDefaults[type]) {
                        // Recurse into unknown containers
                        walkChildren(el);
                        continue;
                    }

                    var def = controlDefaults[type];
                    var marginStr = el.getAttribute('Margin') || '';
                    var marginParts = marginStr.split(',');
                    var ctrl = {
                        id: nextId++,
                        type: type,
                        x: parseFloat(el.getAttribute('Canvas.Left') || (marginParts[0] || '10')),
                        y: parseFloat(el.getAttribute('Canvas.Top') || (marginParts[1] || '10')),
                        w: parseFloat(el.getAttribute('Width') || def.w),
                        h: parseFloat(el.getAttribute('Height') || def.h),
                        name: el.getAttribute('Name') || el.getAttribute('x:Name') || '',
                        content: el.getAttribute('Content') || el.getAttribute('Text') || el.textContent.trim() || def.content,
                        properties: {},
                        zIndex: parsed.length + 1,
                    };

                    // Gather ALL additional attributes to preserve on export
                    var skipAttrs = ['Width','Height','Canvas.Left','Canvas.Top','Content','Text','Name','x:Name'];
                    for (var ai = 0; ai < el.attributes.length; ai++) {
                        var attr = el.attributes[ai];
                        var n = attr.name;
                        if (skipAttrs.indexOf(n) >= 0) continue;
                        if (n.indexOf('xmlns') === 0) continue;
                        ctrl.properties[n] = attr.value;
                    }

                    parsed.push(ctrl);
                }
            }

            walkChildren(searchRoot);
            return parsed;
        } catch(e) {
            console.error('XAML parse error', e);
            return null;
        }
    }

    // =================== XAML GENERATION ===================
    /**
     * Generate XAML preserving the original root element opening tag
     * (with all namespaces, attributes, Title, x:Class, etc.)
     * Only regenerates the Canvas children.
     */
    function generateXaml() {
        // If we never loaded a document, use a sensible default root
        if (!originalRootOpenTag) {
            originalRootOpenTag = '<Window\\n    xmlns="https://github.com/avaloniaui"\\n    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">';
            originalRootCloseTag = '</Window>';
            originalRootTag = 'Window';
        }

        var NL = '\\n';
        var xaml = originalRootOpenTag + NL;

        // Canvas wrapper
        if (hasCanvasWrapper && canvasWrapperOpenTag) {
            xaml += '    ' + canvasWrapperOpenTag + NL;
        } else {
            xaml += '    <Canvas>' + NL;
        }

        // Generate child controls
        for (var i = 0; i < controls.length; i++) {
            var ctrl = controls[i];
            var isSelfClosing = !ctrl.content && containerTypes.indexOf(ctrl.type) < 0;
            var line = '        <' + ctrl.type;

            if (ctrl.name) line += ' x:Name="' + escXml(ctrl.name) + '"';
            line += ' Canvas.Left="' + Math.round(ctrl.x) + '"';
            line += ' Canvas.Top="' + Math.round(ctrl.y) + '"';
            line += ' Width="' + Math.round(ctrl.w) + '"';
            line += ' Height="' + Math.round(ctrl.h) + '"';

            // Content/Text attribute
            if (ctrl.content && contentTypes.indexOf(ctrl.type) >= 0) {
                line += ' Content="' + escXml(ctrl.content) + '"';
            } else if (ctrl.content && textTypes.indexOf(ctrl.type) >= 0) {
                line += ' Text="' + escXml(ctrl.content) + '"';
            }

            // Preserve all extra properties from the original
            var props = ctrl.properties || {};
            var propKeys = Object.keys(props);
            for (var pi = 0; pi < propKeys.length; pi++) {
                line += ' ' + propKeys[pi] + '="' + escXml(props[propKeys[pi]]) + '"';
            }

            if (isSelfClosing) {
                line += ' />' + NL;
            } else {
                line += '></' + ctrl.type + '>' + NL;
            }
            xaml += line;
        }

        // Close Canvas and root
        xaml += '    </Canvas>' + NL;
        xaml += originalRootCloseTag + NL;
        return xaml;
    }

    function escXml(s) {
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
            case 'Button':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'Button') + '</span>';
            case 'TextBlock':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'TextBlock') + '</span>';
            case 'TextBox':
                return '<span class="control-label" style="pointer-events:none;text-align:left;padding-left:6px;color:#999;">' + esc(ctrl.content || 'TextBox') + '</span>';
            case 'Label':
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'Label') + '</span>';
            case 'CheckBox':
                return '<span style="pointer-events:none;display:flex;align-items:center;gap:4px;padding:0 6px;width:100%"><span style="width:14px;height:14px;border:1px solid #888;border-radius:2px;display:inline-block;flex-shrink:0;background:#2a2a2a"></span><span class="control-label">' + esc(ctrl.content || 'CheckBox') + '</span></span>';
            case 'RadioButton':
                return '<span style="pointer-events:none;display:flex;align-items:center;gap:4px;padding:0 6px;width:100%"><span style="width:14px;height:14px;border:2px solid #888;border-radius:50%;display:inline-block;flex-shrink:0;background:#2a2a2a"></span><span class="control-label">' + esc(ctrl.content || 'RadioButton') + '</span></span>';
            case 'ToggleSwitch':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%"><span style="width:36px;height:18px;background:#555;border-radius:9px;position:relative;display:inline-block"><span style="position:absolute;left:2px;top:2px;width:14px;height:14px;background:#ccc;border-radius:50%"></span></span></span>';
            case 'ComboBox':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 8px;width:100%"><span>ComboBox</span><span>&#9660;</span></span>';
            case 'ListBox':
                return '<span class="control-label" style="pointer-events:none;align-self:flex-start;padding:6px;">ListBox</span>';
            case 'Slider':
                return '<span style="pointer-events:none;width:100%;padding:0 4px;display:flex;align-items:center"><span style="flex:1;height:4px;background:#555;border-radius:2px;position:relative"><span style="position:absolute;left:40%;top:-5px;width:12px;height:12px;background:#007acc;border-radius:50%;border:1px solid #fff"></span></span></span>';
            case 'ProgressBar':
                return '<span style="pointer-events:none;position:absolute;left:0;top:0;height:100%;width:60%;background:linear-gradient(90deg,#007acc,#00a2ff);border-radius:2px"></span>';
            case 'Image':
                return '<span class="control-label" style="pointer-events:none;color:#888">Image</span>';
            case 'NumericUpDown':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 6px;width:100%"><span>0</span><span style="display:flex;flex-direction:column;font-size:8px;line-height:1"><span>&#9650;</span><span>&#9660;</span></span></span>';
            case 'DatePicker':
                return '<span class="control-label" style="pointer-events:none;padding:0 6px;">Select date</span>';
            case 'TimePicker':
                return '<span class="control-label" style="pointer-events:none;padding:0 6px;">Select time</span>';
            case 'Calendar':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">Calendar</span>';
            case 'Expander':
                return '<span class="control-label" style="pointer-events:none;align-self:flex-start;padding:6px;">&#9654; ' + esc(ctrl.content || 'Expander') + '</span>';
            case 'TabControl':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;height:100%"><span style="display:flex;border-bottom:1px solid #555;padding:0 4px"><span style="padding:4px 8px;background:#3c3c3c;border:1px solid #555;border-bottom:none;font-size:10px;border-radius:3px 3px 0 0">Tab 1</span><span style="padding:4px 8px;font-size:10px;color:#888">Tab 2</span></span></span>';
            case 'Menu':
                return '<span class="control-label" style="pointer-events:none;display:flex;gap:12px;padding:0 8px;font-size:11px">File  Edit  View  Help</span>';
            case 'TreeView':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span>&#9654; Item 1</span><span style="padding-left:16px">&#9654; Item 2</span></span>';
            case 'DataGrid':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;font-size:10px"><span style="display:flex;border-bottom:1px solid #555;background:#333;padding:2px 0"><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col1</span><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col2</span><span style="flex:1;padding:2px 6px">Col3</span></span></span>';
            case 'ScrollViewer':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">ScrollViewer</span>';
            case 'StackPanel':
                return '<span class="control-label" style="pointer-events:none;color:#007acc88;font-size:10px">StackPanel</span>';
            case 'WrapPanel':
                return '<span class="control-label" style="pointer-events:none;color:#cc7a0088;font-size:10px">WrapPanel</span>';
            case 'DockPanel':
                return '<span class="control-label" style="pointer-events:none;color:#7a00cc88;font-size:10px">DockPanel</span>';
            case 'Grid':
                return '<span class="control-label" style="pointer-events:none;color:#00cc7a88;font-size:10px">Grid</span>';
            case 'UniformGrid':
                return '<span class="control-label" style="pointer-events:none;color:#00cc7a88;font-size:10px">UniformGrid</span>';
            case 'Canvas':
                return '<span class="control-label" style="pointer-events:none;color:#cccc0088;font-size:10px">Canvas</span>';
            case 'Border':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">Border</span>';
            case 'Viewbox':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">Viewbox</span>';
            case 'Rectangle':
                return '<span style="pointer-events:none;position:absolute;inset:0;background:rgba(100,149,237,0.3);border:2px solid #6495ed"></span>';
            case 'Ellipse':
                return '<span style="pointer-events:none;position:absolute;inset:0;background:rgba(100,149,237,0.3);border:2px solid #6495ed;border-radius:50%"></span>';
            case 'Line':
                return '<span style="pointer-events:none;position:absolute;top:50%;left:0;right:0;height:2px;background:#6495ed"></span>';
            case 'Path':
                return '<span class="control-label" style="pointer-events:none;color:#6495ed;font-size:10px">Path</span>';
            case 'Separator':
                return '<span style="pointer-events:none;position:absolute;top:50%;left:4px;right:4px;height:1px;background:#888"></span>';
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
            zIndex: controls.length + 1,
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
            { label: 'Name', key: 'name', value: ctrl.name || '' },
            { label: 'X (Canvas.Left)', key: 'x', value: Math.round(ctrl.x), type: 'number' },
            { label: 'Y (Canvas.Top)', key: 'y', value: Math.round(ctrl.y), type: 'number' },
            { label: 'Width', key: 'w', value: Math.round(ctrl.w), type: 'number' },
            { label: 'Height', key: 'h', value: Math.round(ctrl.h), type: 'number' },
        ];

        if (contentTypes.indexOf(ctrl.type) >= 0) {
            rows.push({ label: 'Content', key: 'content', value: ctrl.content || '' });
        } else if (textTypes.indexOf(ctrl.type) >= 0) {
            rows.push({ label: 'Text', key: 'content', value: ctrl.content || '' });
        }

        // Show preserved extra properties (editable)
        var propKeys = Object.keys(ctrl.properties || {});
        for (var pi = 0; pi < propKeys.length; pi++) {
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
                    else if (r.propKey) c.properties[r.propKey] = inp.value;
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

    window.syncToXaml = function() {
        var xaml = generateXaml();
        vscode.postMessage({ type: 'updateXaml', content: xaml });
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
                // Always re-parse to capture original structure
                var parsed = parseXamlToControls(message.content);
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
