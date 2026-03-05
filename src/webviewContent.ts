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
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-color);
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
    line-height: 1;
}
.toolbar button:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); }
.toolbar button:active { background: rgba(255,255,255,0.12); }
.toolbar button svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
.toolbar .separator { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 6px; }
.toolbar .title { font-weight: 600; font-size: 13px; color: var(--text-bright); margin-right: 14px; letter-spacing: 0.3px; }
.auto-sync-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #4ec9b0; padding: 3px 10px; border-radius: 10px; background: rgba(78,201,176,0.1); border: 1px solid rgba(78,201,176,0.2); margin-left: auto; }
.auto-sync-badge .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ec9b0; }
.auto-sync-badge.syncing .sync-dot { animation: pulse 0.8s ease-in-out; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

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
    display: flex;
    align-items: center;
    padding: 5px 10px;
    cursor: grab;
    font-size: 12px;
    gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.12s ease;
}
.toolbox-item:hover { background: rgba(255,255,255,0.06); }
.toolbox-item:active { background: rgba(255,255,255,0.1); }
.toolbox-item .icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,122,204,0.15);
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    color: #4fc1ff;
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
.design-control[data-type="HyperlinkButton"] { background: transparent; border: 1px dashed #3a3a5c; border-radius: 3px; }
.design-control[data-type="RepeatButton"]    { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="ToggleButton"]    { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="SplitButton"]     { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="AutoCompleteBox"] { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="ColorPicker"]     { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="SplitView"]       { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="Carousel"]        { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="NavigationView"]  { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="FlyoutPresenter"] { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="ToolTip"]         { background: rgba(200,200,200,0.08); border: 1px solid #888; border-radius: 3px; }
.design-control[data-type="Popup"]           { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="HeaderedContentControl"] { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="ContentControl"]  { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="ItemsControl"]    { background: rgba(200,200,200,0.05); border: 1px solid #666; }
.design-control[data-type="Panel"]           { background: rgba(0,122,204,0.06); border: 1px dashed #007acc44; }
.design-control[data-type="RelativePanel"]   { background: rgba(204,0,122,0.06); border: 1px dashed #cc007a44; }
.design-control[data-type="ItemsRepeater"]   { background: rgba(122,204,0,0.06); border: 1px dashed #7acc0044; }
.design-control[data-type="Polygon"]         { background: rgba(100,149,237,0.3); border: 1px solid #6495ed; }
.design-control[data-type="Polyline"]        { background: transparent; border: 1px dashed #6495ed; }
.design-control[data-type="Arc"]             { background: transparent; border: 1px dashed #6495ed; }

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
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--text-color);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    transition: border-color 0.15s ease;
    outline: none;
}
.prop-row input:focus, .prop-row select:focus { border-color: var(--control-selected); }
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
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 4px;
    min-width: 170px;
    z-index: 200;
    display: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    backdrop-filter: blur(8px);
}
.context-menu.visible { display: block; }
.context-menu-item {
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-color);
    border-radius: 4px;
    transition: background 0.1s ease;
}
.context-menu-item:hover { background: rgba(0,122,204,0.3); color: var(--text-bright); }
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
    <button onclick="undoAction()" title="Undo (Ctrl+Z)"><svg viewBox="0 0 16 16"><path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7h-1.5c0 3-2.5 5.5-5.5 5.5S2.5 11 2.5 8 5 2.5 8 2.5c1.5 0 2.8.6 3.9 1.5L9.5 6.5H15V1l-2.1 2.1C11.5 1.8 9.8 1 8 1z"/></svg> Undo</button>
    <button onclick="redoAction()" title="Redo (Ctrl+Y)"><svg viewBox="0 0 16 16"><path d="M8 1c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7h1.5c0 3 2.5 5.5 5.5 5.5s5.5-2.5 5.5-5.5S11 2.5 8 2.5C6.5 2.5 5.2 3.1 4.1 4L6.5 6.5H1V1l2.1 2.1C4.5 1.8 6.2 1 8 1z"/></svg> Redo</button>
    <span class="separator"></span>
    <button onclick="deleteSelected()" title="Delete (Del)"><svg viewBox="0 0 16 16"><path d="M11 1.5v1h3.5v1h-1l-.9 10.1c-.1.8-.7 1.4-1.5 1.4H4.9c-.8 0-1.4-.6-1.5-1.4L2.5 3.5h-1v-1H5v-1c0-.6.4-1 1-1h4c.6 0 1 .4 1 1zm-5 0v1h4v-1H6zm5.5 2h-7l.9 10h5.2l.9-10z"/></svg> Delete</button>
    <button onclick="bringToFront()" title="Bring to Front"><svg viewBox="0 0 16 16"><path d="M3 13h10l-5-8z"/></svg> Front</button>
    <button onclick="sendToBack()" title="Send to Back"><svg viewBox="0 0 16 16"><path d="M3 3h10l-5 8z"/></svg> Back</button>
    <span class="separator"></span>
    <span class="auto-sync-badge" id="syncStatus" title="Changes auto-sync to document"><span class="sync-dot"></span> Auto-sync</span>
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
        <div class="toolbox-item" draggable="true" data-type="HyperlinkButton">
            <span class="icon">Hl</span> HyperlinkButton
        </div>
        <div class="toolbox-item" draggable="true" data-type="RepeatButton">
            <span class="icon">Rb</span> RepeatButton
        </div>
        <div class="toolbox-item" draggable="true" data-type="ToggleButton">
            <span class="icon">Tb</span> ToggleButton
        </div>
        <div class="toolbox-item" draggable="true" data-type="SplitButton">
            <span class="icon">Sb</span> SplitButton
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
        <div class="toolbox-item" draggable="true" data-type="AutoCompleteBox">
            <span class="icon">Ac</span> AutoCompleteBox
        </div>
        <div class="toolbox-item" draggable="true" data-type="ColorPicker">
            <span class="icon">Cp</span> ColorPicker
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
        <div class="toolbox-item" draggable="true" data-type="SplitView">
            <span class="icon">Sw</span> SplitView
        </div>
        <div class="toolbox-item" draggable="true" data-type="Carousel">
            <span class="icon">Cr</span> Carousel
        </div>
        <div class="toolbox-item" draggable="true" data-type="NavigationView">
            <span class="icon">Nv</span> NavigationView
        </div>
        <div class="toolbox-item" draggable="true" data-type="FlyoutPresenter">
            <span class="icon">Fp</span> FlyoutPresenter
        </div>
        <div class="toolbox-item" draggable="true" data-type="ToolTip">
            <span class="icon">Tt</span> ToolTip
        </div>
        <div class="toolbox-item" draggable="true" data-type="Popup">
            <span class="icon">Pu</span> Popup
        </div>
        <div class="toolbox-item" draggable="true" data-type="HeaderedContentControl">
            <span class="icon">Hc</span> HeaderedContentControl
        </div>
        <div class="toolbox-item" draggable="true" data-type="ContentControl">
            <span class="icon">Cc</span> ContentControl
        </div>
        <div class="toolbox-item" draggable="true" data-type="ItemsControl">
            <span class="icon">Ic</span> ItemsControl
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
        <div class="toolbox-item" draggable="true" data-type="Panel">
            <span class="icon">Pn</span> Panel
        </div>
        <div class="toolbox-item" draggable="true" data-type="RelativePanel">
            <span class="icon">Rp</span> RelativePanel
        </div>
        <div class="toolbox-item" draggable="true" data-type="ItemsRepeater">
            <span class="icon">Ir</span> ItemsRepeater
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
        <div class="toolbox-item" draggable="true" data-type="Polygon">
            <span class="icon">Pg</span> Polygon
        </div>
        <div class="toolbox-item" draggable="true" data-type="Polyline">
            <span class="icon">Pl</span> Polyline
        </div>
        <div class="toolbox-item" draggable="true" data-type="Arc">
            <span class="icon">Ar</span> Arc
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
    let autoSyncTimer = null;

    // =================== AUTO-SYNC ===================
    function scheduleAutoSync() {
        if (autoSyncTimer) clearTimeout(autoSyncTimer);
        autoSyncTimer = setTimeout(function() {
            autoSyncTimer = null;
            window.syncToXaml();
            var badge = document.getElementById('syncStatus');
            if (badge) {
                badge.classList.add('syncing');
                setTimeout(function() { badge.classList.remove('syncing'); }, 800);
            }
        }, 300);
    }

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
        HyperlinkButton: { w: 140, h: 30, content: 'Link' },
        RepeatButton: { w: 120, h: 32, content: 'Repeat' },
        ToggleButton: { w: 120, h: 32, content: 'Toggle' },
        SplitButton:  { w: 140, h: 32, content: 'Split' },
        // Input / Pickers
        NumericUpDown:{ w: 120, h: 28,  content: '' },
        DatePicker:   { w: 140, h: 30,  content: '' },
        TimePicker:   { w: 120, h: 30,  content: '' },
        Calendar:     { w: 200, h: 180, content: '' },
        AutoCompleteBox: { w: 160, h: 28, content: '' },
        ColorPicker:  { w: 200, h: 200, content: '' },
        // Containers
        Expander:     { w: 200, h: 120, content: 'Expander' },
        TabControl:   { w: 250, h: 180, content: '' },
        Menu:         { w: 200, h: 28,  content: '' },
        TreeView:     { w: 180, h: 150, content: '' },
        DataGrid:     { w: 300, h: 200, content: '' },
        ScrollViewer: { w: 200, h: 150, content: '' },
        SplitView:    { w: 300, h: 200, content: '' },
        Carousel:     { w: 250, h: 180, content: '' },
        NavigationView: { w: 280, h: 300, content: '' },
        FlyoutPresenter: { w: 200, h: 150, content: '' },
        ToolTip:      { w: 150, h: 60,  content: 'ToolTip' },
        Popup:        { w: 200, h: 150, content: '' },
        HeaderedContentControl: { w: 200, h: 150, content: 'Header' },
        ContentControl: { w: 200, h: 150, content: '' },
        ItemsControl: { w: 200, h: 150, content: '' },
        // Layout
        StackPanel:   { w: 200, h: 150, content: '' },
        WrapPanel:    { w: 200, h: 150, content: '' },
        DockPanel:    { w: 250, h: 180, content: '' },
        Grid:         { w: 250, h: 180, content: '' },
        UniformGrid:  { w: 200, h: 150, content: '' },
        Canvas:       { w: 200, h: 150, content: '' },
        Border:       { w: 160, h: 120, content: '' },
        Viewbox:      { w: 150, h: 150, content: '' },
        Panel:        { w: 200, h: 150, content: '' },
        RelativePanel:{ w: 250, h: 180, content: '' },
        ItemsRepeater:{ w: 200, h: 150, content: '' },
        // Shapes
        Rectangle:    { w: 100, h: 60,  content: '' },
        Ellipse:      { w: 80,  h: 80,  content: '' },
        Line:         { w: 100, h: 2,   content: '' },
        Path:         { w: 80,  h: 80,  content: '' },
        Separator:    { w: 150, h: 2,   content: '' },
        Polygon:      { w: 80,  h: 80,  content: '' },
        Polyline:     { w: 100, h: 60,  content: '' },
        Arc:          { w: 80,  h: 80,  content: '' },
    };

    // Types that use "Content" attribute
    var contentTypes = ['Button', 'CheckBox', 'RadioButton', 'Label', 'Expander',
        'HyperlinkButton', 'RepeatButton', 'ToggleButton', 'SplitButton',
        'ToolTip', 'HeaderedContentControl'];
    // Types that use "Text" attribute
    var textTypes = ['TextBlock', 'TextBox'];
    // Container/layout types (not self-closing)
    var containerTypes = ['StackPanel', 'WrapPanel', 'DockPanel', 'Grid', 'UniformGrid',
        'Canvas', 'Border', 'Viewbox', 'Expander', 'TabControl', 'Menu', 'TreeView',
        'DataGrid', 'ScrollViewer', 'ListBox',
        'SplitView', 'Carousel', 'NavigationView', 'FlyoutPresenter', 'Popup',
        'HeaderedContentControl', 'ContentControl', 'ItemsControl',
        'Panel', 'RelativePanel', 'ItemsRepeater'];

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
            case 'HyperlinkButton':
                return '<span class="control-label" style="pointer-events:none;color:#4da6ff;text-decoration:underline">' + esc(ctrl.content || 'Link') + '</span>';
            case 'RepeatButton':
                return '<span class="control-label" style="pointer-events:none;display:flex;align-items:center;gap:4px;justify-content:center">&#8635; ' + esc(ctrl.content || 'Repeat') + '</span>';
            case 'ToggleButton':
                return '<span class="control-label" style="pointer-events:none;display:flex;align-items:center;gap:4px;justify-content:center">&#9632; ' + esc(ctrl.content || 'Toggle') + '</span>';
            case 'SplitButton':
                return '<span style="pointer-events:none;display:flex;width:100%;height:100%;align-items:center"><span style="flex:1;text-align:center;padding:0 6px">' + esc(ctrl.content || 'Split') + '</span><span style="border-left:1px solid #5a5a8c;padding:0 6px;display:flex;align-items:center">&#9660;</span></span>';
            case 'AutoCompleteBox':
                return '<span class="control-label" style="pointer-events:none;display:flex;justify-content:space-between;padding:0 8px;width:100%;color:#999"><span>Search...</span><span>&#128269;</span></span>';
            case 'ColorPicker':
                return '<span style="pointer-events:none;display:flex;flex-wrap:wrap;gap:2px;padding:6px;align-content:flex-start"><span style="width:24px;height:24px;background:#ff0000;border-radius:2px"></span><span style="width:24px;height:24px;background:#00ff00;border-radius:2px"></span><span style="width:24px;height:24px;background:#0000ff;border-radius:2px"></span><span style="width:24px;height:24px;background:#ffff00;border-radius:2px"></span><span style="width:24px;height:24px;background:#ff00ff;border-radius:2px"></span><span style="width:24px;height:24px;background:#00ffff;border-radius:2px"></span></span>';
            case 'SplitView':
                return '<span style="pointer-events:none;display:flex;width:100%;height:100%"><span style="width:30%;background:rgba(100,100,200,0.15);border-right:1px solid #666;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888">Pane</span><span style="flex:1;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888">Content</span></span>';
            case 'Carousel':
                return '<span style="pointer-events:none;display:flex;width:100%;height:100%;align-items:center"><span style="padding:0 6px;font-size:14px;color:#888">&#9664;</span><span style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888">Slide 1</span><span style="padding:0 6px;font-size:14px;color:#888">&#9654;</span></span>';
            case 'NavigationView':
                return '<span style="pointer-events:none;display:flex;width:100%;height:100%"><span style="width:40px;background:rgba(100,100,200,0.12);border-right:1px solid #666;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:8px;font-size:10px"><span>&#9776;</span><span>&#8962;</span><span>&#9881;</span></span><span style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888">Content</span></span>';
            case 'FlyoutPresenter':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:10px;color:#888;border:1px solid #555;background:rgba(50,50,50,0.5)">Flyout</span>';
            case 'ToolTip':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'ToolTip') + '</span>';
            case 'Popup':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:10px;color:#888;background:rgba(50,50,60,0.4);border:1px solid #777">Popup</span>';
            case 'HeaderedContentControl':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;height:100%"><span style="padding:4px 8px;border-bottom:1px solid #666;font-size:11px;font-weight:bold">' + esc(ctrl.content || 'Header') + '</span><span style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888">Content</span></span>';
            case 'ContentControl':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">ContentControl</span>';
            case 'ItemsControl':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:10px;gap:2px;width:100%;color:#888"><span>&#8226; Item 1</span><span>&#8226; Item 2</span><span>&#8226; Item 3</span></span>';
            case 'Panel':
                return '<span class="control-label" style="pointer-events:none;color:#007acc66;font-size:10px">Panel</span>';
            case 'RelativePanel':
                return '<span style="pointer-events:none;display:flex;width:100%;height:100%;align-items:center;justify-content:center;position:relative"><span style="position:absolute;top:2px;left:2px;font-size:8px;color:#cc007a55">&#8598;</span><span style="position:absolute;top:2px;right:2px;font-size:8px;color:#cc007a55">&#8599;</span><span style="position:absolute;bottom:2px;left:2px;font-size:8px;color:#cc007a55">&#8601;</span><span style="position:absolute;bottom:2px;right:2px;font-size:8px;color:#cc007a55">&#8600;</span><span style="font-size:10px;color:#cc007a66">RelativePanel</span></span>';
            case 'ItemsRepeater':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:10px;gap:1px;width:100%;color:#7acc0088"><span>&#8943; Item</span><span>&#8943; Item</span><span>&#8943; Item</span></span>';
            case 'Polygon':
                return '<svg style="pointer-events:none;position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 80 80"><polygon points="40,5 75,75 5,75" fill="rgba(100,149,237,0.3)" stroke="#6495ed" stroke-width="2"/></svg>';
            case 'Polyline':
                return '<svg style="pointer-events:none;position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 100 60"><polyline points="5,55 30,10 55,40 80,5 95,30" fill="none" stroke="#6495ed" stroke-width="2"/></svg>';
            case 'Arc':
                return '<svg style="pointer-events:none;position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 80 80"><path d="M10,60 A35,35 0 0,1 70,60" fill="none" stroke="#6495ed" stroke-width="2"/></svg>';
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
        // Cursor sync: notify provider of element selection
        if (id !== null) {
            var ctrl = controls.find(function(c) { return c.id === id; });
            if (ctrl) {
                vscode.postMessage({ type: 'selectElement', elementType: ctrl.type, elementName: ctrl.name || '' });
            }
        }
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
        scheduleAutoSync();
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
        if (isDraggingControl || isResizing) {
            scheduleAutoSync();
        }
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
    var controlPropertyDefs = {
        Button: [
            { label: 'Command', attr: 'Command', type: 'text' },
            { label: 'CommandParameter', attr: 'CommandParameter', type: 'text' },
            { label: 'IsDefault', attr: 'IsDefault', type: 'select', options: ['True','False'] },
            { label: 'IsCancel', attr: 'IsCancel', type: 'select', options: ['True','False'] },
            { label: 'ClickMode', attr: 'ClickMode', type: 'select', options: ['Release','Press','Hover'] },
        ],
        HyperlinkButton: [
            { label: 'Command', attr: 'Command', type: 'text' },
            { label: 'CommandParameter', attr: 'CommandParameter', type: 'text' },
            { label: 'ClickMode', attr: 'ClickMode', type: 'select', options: ['Release','Press','Hover'] },
        ],
        RepeatButton: [
            { label: 'Command', attr: 'Command', type: 'text' },
            { label: 'CommandParameter', attr: 'CommandParameter', type: 'text' },
            { label: 'ClickMode', attr: 'ClickMode', type: 'select', options: ['Release','Press','Hover'] },
        ],
        ToggleButton: [
            { label: 'Command', attr: 'Command', type: 'text' },
            { label: 'CommandParameter', attr: 'CommandParameter', type: 'text' },
            { label: 'ClickMode', attr: 'ClickMode', type: 'select', options: ['Release','Press','Hover'] },
            { label: 'IsChecked', attr: 'IsChecked', type: 'select', options: ['True','False'] },
            { label: 'IsThreeState', attr: 'IsThreeState', type: 'select', options: ['True','False'] },
        ],
        SplitButton: [
            { label: 'Command', attr: 'Command', type: 'text' },
            { label: 'CommandParameter', attr: 'CommandParameter', type: 'text' },
            { label: 'ClickMode', attr: 'ClickMode', type: 'select', options: ['Release','Press','Hover'] },
        ],
        TextBox: [
            { label: 'Watermark', attr: 'Watermark', type: 'text' },
            { label: 'AcceptsReturn', attr: 'AcceptsReturn', type: 'select', options: ['True','False'] },
            { label: 'AcceptsTab', attr: 'AcceptsTab', type: 'select', options: ['True','False'] },
            { label: 'IsReadOnly', attr: 'IsReadOnly', type: 'select', options: ['True','False'] },
            { label: 'MaxLength', attr: 'MaxLength', type: 'number' },
            { label: 'TextWrapping', attr: 'TextWrapping', type: 'select', options: ['NoWrap','Wrap','WrapWithOverflow'] },
        ],
        CheckBox: [
            { label: 'IsChecked', attr: 'IsChecked', type: 'select', options: ['True','False'] },
            { label: 'IsThreeState', attr: 'IsThreeState', type: 'select', options: ['True','False'] },
        ],
        RadioButton: [
            { label: 'IsChecked', attr: 'IsChecked', type: 'select', options: ['True','False'] },
            { label: 'GroupName', attr: 'GroupName', type: 'text' },
        ],
        ToggleSwitch: [
            { label: 'IsChecked', attr: 'IsChecked', type: 'select', options: ['True','False'] },
            { label: 'OnContent', attr: 'OnContent', type: 'text' },
            { label: 'OffContent', attr: 'OffContent', type: 'text' },
        ],
        ComboBox: [
            { label: 'SelectedIndex', attr: 'SelectedIndex', type: 'number' },
            { label: 'PlaceholderText', attr: 'PlaceholderText', type: 'text' },
            { label: 'IsDropDownOpen', attr: 'IsDropDownOpen', type: 'select', options: ['True','False'] },
        ],
        ListBox: [
            { label: 'SelectedIndex', attr: 'SelectedIndex', type: 'number' },
            { label: 'SelectionMode', attr: 'SelectionMode', type: 'select', options: ['Single','Multiple','Toggle','AlwaysSelected'] },
        ],
        Slider: [
            { label: 'Minimum', attr: 'Minimum', type: 'number' },
            { label: 'Maximum', attr: 'Maximum', type: 'number' },
            { label: 'Value', attr: 'Value', type: 'number' },
            { label: 'SmallChange', attr: 'SmallChange', type: 'number' },
            { label: 'LargeChange', attr: 'LargeChange', type: 'number' },
            { label: 'TickFrequency', attr: 'TickFrequency', type: 'number' },
            { label: 'IsSnapToTickEnabled', attr: 'IsSnapToTickEnabled', type: 'select', options: ['True','False'] },
            { label: 'Orientation', attr: 'Orientation', type: 'select', options: ['Horizontal','Vertical'] },
        ],
        ProgressBar: [
            { label: 'Minimum', attr: 'Minimum', type: 'number' },
            { label: 'Maximum', attr: 'Maximum', type: 'number' },
            { label: 'Value', attr: 'Value', type: 'number' },
            { label: 'IsIndeterminate', attr: 'IsIndeterminate', type: 'select', options: ['True','False'] },
        ],
        Image: [
            { label: 'Source', attr: 'Source', type: 'text' },
            { label: 'Stretch', attr: 'Stretch', type: 'select', options: ['None','Fill','Uniform','UniformToFill'] },
        ],
        NumericUpDown: [
            { label: 'Value', attr: 'Value', type: 'number' },
            { label: 'Minimum', attr: 'Minimum', type: 'number' },
            { label: 'Maximum', attr: 'Maximum', type: 'number' },
            { label: 'Increment', attr: 'Increment', type: 'number' },
            { label: 'FormatString', attr: 'FormatString', type: 'text' },
        ],
        DatePicker: [
            { label: 'SelectedDate', attr: 'SelectedDate', type: 'text' },
            { label: 'DayFormat', attr: 'DayFormat', type: 'text' },
            { label: 'MonthFormat', attr: 'MonthFormat', type: 'text' },
            { label: 'YearFormat', attr: 'YearFormat', type: 'text' },
        ],
        TimePicker: [
            { label: 'SelectedTime', attr: 'SelectedTime', type: 'text' },
            { label: 'ClockIdentifier', attr: 'ClockIdentifier', type: 'select', options: ['12HourClock','24HourClock'] },
        ],
        Calendar: [
            { label: 'DisplayMode', attr: 'DisplayMode', type: 'select', options: ['Month','Year','Decade'] },
            { label: 'SelectedDate', attr: 'SelectedDate', type: 'text' },
        ],
        StackPanel: [
            { label: 'Orientation', attr: 'Orientation', type: 'select', options: ['Vertical','Horizontal'] },
            { label: 'Spacing', attr: 'Spacing', type: 'number' },
        ],
        WrapPanel: [
            { label: 'Orientation', attr: 'Orientation', type: 'select', options: ['Vertical','Horizontal'] },
        ],
        DockPanel: [
            { label: 'LastChildFill', attr: 'LastChildFill', type: 'select', options: ['True','False'] },
        ],
        Grid: [
            { label: 'RowDefinitions', attr: 'RowDefinitions', type: 'text' },
            { label: 'ColumnDefinitions', attr: 'ColumnDefinitions', type: 'text' },
            { label: 'ShowGridLines', attr: 'ShowGridLines', type: 'select', options: ['True','False'] },
        ],
        UniformGrid: [
            { label: 'Rows', attr: 'Rows', type: 'number' },
            { label: 'Columns', attr: 'Columns', type: 'number' },
        ],
        Border: [
            { label: 'CornerRadius', attr: 'CornerRadius', type: 'text' },
            { label: 'BorderBrush', attr: 'BorderBrush', type: 'color' },
            { label: 'BorderThickness', attr: 'BorderThickness', type: 'text' },
        ],
        Expander: [
            { label: 'IsExpanded', attr: 'IsExpanded', type: 'select', options: ['True','False'] },
            { label: 'ExpandDirection', attr: 'ExpandDirection', type: 'select', options: ['Down','Up','Left','Right'] },
        ],
        TabControl: [
            { label: 'SelectedIndex', attr: 'SelectedIndex', type: 'number' },
            { label: 'TabStripPlacement', attr: 'TabStripPlacement', type: 'select', options: ['Top','Bottom','Left','Right'] },
        ],
        DataGrid: [
            { label: 'AutoGenerateColumns', attr: 'AutoGenerateColumns', type: 'select', options: ['True','False'] },
            { label: 'CanUserResizeColumns', attr: 'CanUserResizeColumns', type: 'select', options: ['True','False'] },
            { label: 'CanUserSortColumns', attr: 'CanUserSortColumns', type: 'select', options: ['True','False'] },
            { label: 'IsReadOnly', attr: 'IsReadOnly', type: 'select', options: ['True','False'] },
        ],
        ScrollViewer: [
            { label: 'HorizontalScrollBarVisibility', attr: 'HorizontalScrollBarVisibility', type: 'select', options: ['Disabled','Auto','Hidden','Visible'] },
            { label: 'VerticalScrollBarVisibility', attr: 'VerticalScrollBarVisibility', type: 'select', options: ['Disabled','Auto','Hidden','Visible'] },
        ],
        Rectangle: [
            { label: 'Fill', attr: 'Fill', type: 'color' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
            { label: 'RadiusX', attr: 'RadiusX', type: 'number' },
            { label: 'RadiusY', attr: 'RadiusY', type: 'number' },
        ],
        Ellipse: [
            { label: 'Fill', attr: 'Fill', type: 'color' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
        ],
        Line: [
            { label: 'X1', attr: 'X1', type: 'number' },
            { label: 'Y1', attr: 'Y1', type: 'number' },
            { label: 'X2', attr: 'X2', type: 'number' },
            { label: 'Y2', attr: 'Y2', type: 'number' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
        ],
        Path: [
            { label: 'Data', attr: 'Data', type: 'text' },
            { label: 'Fill', attr: 'Fill', type: 'color' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
        ],
        AutoCompleteBox: [
            { label: 'Watermark', attr: 'Watermark', type: 'text' },
            { label: 'FilterMode', attr: 'FilterMode', type: 'select', options: ['None','StartsWith','StartsWithCaseSensitive','StartsWithOrdinal','StartsWithOrdinalCaseSensitive','Contains','ContainsCaseSensitive','ContainsOrdinal','ContainsOrdinalCaseSensitive','Equals','EqualsCaseSensitive','EqualsOrdinal','EqualsOrdinalCaseSensitive'] },
        ],
        SplitView: [
            { label: 'DisplayMode', attr: 'DisplayMode', type: 'select', options: ['Overlay','Inline','CompactOverlay','CompactInline'] },
            { label: 'IsPaneOpen', attr: 'IsPaneOpen', type: 'select', options: ['True','False'] },
            { label: 'OpenPaneLength', attr: 'OpenPaneLength', type: 'number' },
            { label: 'PanePlacement', attr: 'PanePlacement', type: 'select', options: ['Left','Right'] },
        ],
        Carousel: [
            { label: 'Orientation', attr: 'Orientation', type: 'select', options: ['Horizontal','Vertical'] },
        ],
        NavigationView: [
            { label: 'IsOpen', attr: 'IsOpen', type: 'select', options: ['True','False'] },
            { label: 'DisplayMode', attr: 'DisplayMode', type: 'select', options: ['Minimal','Compact','Expanded'] },
            { label: 'PaneDisplayMode', attr: 'PaneDisplayMode', type: 'select', options: ['Auto','Left','Top','LeftCompact','LeftMinimal'] },
        ],
        Polygon: [
            { label: 'Fill', attr: 'Fill', type: 'color' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
            { label: 'Points', attr: 'Points', type: 'text' },
        ],
        Polyline: [
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
            { label: 'Points', attr: 'Points', type: 'text' },
        ],
        Arc: [
            { label: 'StartAngle', attr: 'StartAngle', type: 'number' },
            { label: 'SweepAngle', attr: 'SweepAngle', type: 'number' },
            { label: 'Stroke', attr: 'Stroke', type: 'color' },
            { label: 'StrokeThickness', attr: 'StrokeThickness', type: 'number' },
        ],
        ColorPicker: [
            { label: 'Color', attr: 'Color', type: 'color' },
        ],
    };

    var commonPropertyDefs = [
        { label: 'Background', attr: 'Background', type: 'color' },
        { label: 'Foreground', attr: 'Foreground', type: 'color' },
        { label: 'FontSize', attr: 'FontSize', type: 'number' },
        { label: 'FontWeight', attr: 'FontWeight', type: 'select', options: ['Normal','Bold','SemiBold','Light','Thin','ExtraLight','Medium','ExtraBold','Black'] },
        { label: 'Padding', attr: 'Padding', type: 'text' },
        { label: 'Margin', attr: 'Margin', type: 'text' },
        { label: 'HorizontalAlignment', attr: 'HorizontalAlignment', type: 'select', options: ['Left','Center','Right','Stretch'] },
        { label: 'VerticalAlignment', attr: 'VerticalAlignment', type: 'select', options: ['Top','Center','Bottom','Stretch'] },
        { label: 'IsEnabled', attr: 'IsEnabled', type: 'select', options: ['True','False'] },
        { label: 'IsVisible', attr: 'IsVisible', type: 'select', options: ['True','False'] },
        { label: 'Opacity', attr: 'Opacity', type: 'number' },
        { label: 'ToolTip.Tip', attr: 'ToolTip.Tip', type: 'text' },
        { label: 'Classes', attr: 'Classes', type: 'text' },
    ];

    function createPropertyRow(propDef, ctrl, fields) {
        var div = document.createElement('div');
        div.className = 'prop-row';
        var lbl = document.createElement('label');
        lbl.textContent = propDef.label;
        div.appendChild(lbl);

        var currentVal = (ctrl.properties && ctrl.properties[propDef.attr] !== undefined) ? ctrl.properties[propDef.attr] : '';

        if (propDef.type === 'select') {
            var sel = document.createElement('select');
            var emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '';
            sel.appendChild(emptyOpt);
            for (var oi = 0; oi < propDef.options.length; oi++) {
                var opt = document.createElement('option');
                opt.value = propDef.options[oi];
                opt.textContent = propDef.options[oi];
                if (propDef.options[oi] === currentVal) opt.selected = true;
                sel.appendChild(opt);
            }
            (function(attr, selEl, c) {
                selEl.addEventListener('change', function() {
                    saveUndo();
                    if (selEl.value === '') {
                        delete c.properties[attr];
                    } else {
                        c.properties[attr] = selEl.value;
                    }
                    render();
                    scheduleAutoSync();
                });
            })(propDef.attr, sel, ctrl);
            div.appendChild(sel);
        } else {
            var input = document.createElement('input');
            input.type = (propDef.type === 'number') ? 'number' : 'text';
            input.value = currentVal;
            (function(attr, inp, c) {
                inp.addEventListener('change', function() {
                    saveUndo();
                    if (inp.value === '') {
                        delete c.properties[attr];
                    } else {
                        c.properties[attr] = inp.value;
                    }
                    render();
                    scheduleAutoSync();
                });
            })(propDef.attr, input, ctrl);
            div.appendChild(input);
        }

        fields.appendChild(div);
    }

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

        // Render the basic property rows
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
                    render();
                    scheduleAutoSync();
                });
            })(row, input, ctrl);

            div.appendChild(input);
            fields.appendChild(div);
        }

        // Control-specific properties
        var specificDefs = controlPropertyDefs[ctrl.type];
        if (specificDefs) {
            var specHeader = document.createElement('div');
            specHeader.className = 'prop-row';
            specHeader.innerHTML = '<label style="color:#007acc;font-weight:bold;margin-top:6px;border-top:1px solid #333;padding-top:6px">' + esc(ctrl.type) + ' Properties</label>';
            fields.appendChild(specHeader);

            var knownSpecAttrs = {};
            for (var si = 0; si < specificDefs.length; si++) {
                knownSpecAttrs[specificDefs[si].attr] = true;
                createPropertyRow(specificDefs[si], ctrl, fields);
            }
        }

        // Show preserved extra properties that are not covered by specific defs
        var propKeys = Object.keys(ctrl.properties || {});
        var knownCommonAttrs = {};
        for (var ci = 0; ci < commonPropertyDefs.length; ci++) {
            knownCommonAttrs[commonPropertyDefs[ci].attr] = true;
        }
        for (var pi = 0; pi < propKeys.length; pi++) {
            var pk = propKeys[pi];
            if (knownSpecAttrs && knownSpecAttrs[pk]) continue;
            if (knownCommonAttrs[pk]) continue;
            var extraDiv = document.createElement('div');
            extraDiv.className = 'prop-row';
            var extraLbl = document.createElement('label');
            extraLbl.textContent = pk;
            extraDiv.appendChild(extraLbl);
            var extraInp = document.createElement('input');
            extraInp.type = 'text';
            extraInp.value = ctrl.properties[pk];
            (function(key, inp, c) {
                inp.addEventListener('change', function() {
                    saveUndo();
                    if (inp.value === '') {
                        delete c.properties[key];
                    } else {
                        c.properties[key] = inp.value;
                    }
                    render();
                    scheduleAutoSync();
                });
            })(pk, extraInp, ctrl);
            extraDiv.appendChild(extraInp);
            fields.appendChild(extraDiv);
        }

        // Common properties (shown after control-specific)
        var commonHeader = document.createElement('div');
        commonHeader.className = 'prop-row';
        commonHeader.innerHTML = '<label style="color:#888;font-weight:bold;margin-top:6px;border-top:1px solid #333;padding-top:6px">Common Properties</label>';
        fields.appendChild(commonHeader);

        for (var cpi = 0; cpi < commonPropertyDefs.length; cpi++) {
            createPropertyRow(commonPropertyDefs[cpi], ctrl, fields);
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
        scheduleAutoSync();
    };

    window.redoAction = function() {
        if (redoStack.length === 0) return;
        undoStack.push(JSON.stringify(controls));
        controls = JSON.parse(redoStack.pop());
        selectedId = null;
        render();
        updateProperties();
        scheduleAutoSync();
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
        scheduleAutoSync();
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
        scheduleAutoSync();
    };

    window.bringToFront = function() {
        if (selectedId === null) return;
        var maxZ = Math.max.apply(null, controls.map(function(c) { return c.zIndex || 1; }).concat([0]));
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (ctrl) { ctrl.zIndex = maxZ + 1; render(); scheduleAutoSync(); }
        hideContextMenu();
    };

    window.sendToBack = function() {
        if (selectedId === null) return;
        var minZ = Math.min.apply(null, controls.map(function(c) { return c.zIndex || 1; }).concat([999]));
        var ctrl = controls.find(function(c) { return c.id === selectedId; });
        if (ctrl) { ctrl.zIndex = Math.max(1, minZ - 1); render(); scheduleAutoSync(); }
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
            scheduleAutoSync();
        }
    });

    // =================== COMMUNICATION WITH VS CODE ===================
    window.addEventListener('message', function(event) {
        var message = event.data;
        switch (message.type) {
            case 'highlightElement': {
                var elemType = message.elementType || '';
                var elemName = message.elementName || '';
                var found = null;
                for (var hi = 0; hi < controls.length; hi++) {
                    var c = controls[hi];
                    if (c.type === elemType) {
                        if (!elemName || c.name === elemName) {
                            found = c;
                            break;
                        }
                    }
                }
                if (found && found.id !== selectedId) {
                    selectedId = found.id;
                    render();
                    updateProperties();
                }
                break;
            }
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
