import * as vscode from 'vscode';

export function getHtmlWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>HTML Visual Designer</title>
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
}
.canvas-scroller {
    min-width: 100%;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
}
.canvas-container {
    position: relative;
    width: 800px;
    height: 500px;
    background: var(--canvas-bg);
    border: 2px solid var(--toolbar-border);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    overflow: hidden;
    transform-origin: 0 0;
}
.zoom-badge {
    font-size: 11px;
    color: #888;
    margin-left: 4px;
    cursor: pointer;
    user-select: none;
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
.design-control[data-type="div"]        { background: rgba(0,122,204,0.08); border: 1px dashed #007acc55; }
.design-control[data-type="span"]       { background: transparent; border: 1px dashed #555; }
.design-control[data-type="p"]          { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h1"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h2"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h3"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h4"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h5"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="h6"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="a"]          { background: transparent; border: 1px dashed #555; }
.design-control[data-type="hr"]         { background: #555; border: none; }
.design-control[data-type="br"]         { background: transparent; border: 1px dashed #88888844; }
.design-control[data-type="blockquote"] { background: rgba(200,200,200,0.05); border-left: 3px solid #888; border-top: 1px dashed #555; border-right: 1px dashed #555; border-bottom: 1px dashed #555; }
.design-control[data-type="pre"]        { background: #2a2a2a; border: 1px solid #555; }
.design-control[data-type="code"]       { background: #2a2a2a; border: 1px solid #555; }

/* Control type visual styles - HTML Forms */
.design-control[data-type="input"]      { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="textarea"]   { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="select"]     { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="button"]     { background: #3a3a5c; border-radius: 3px; border-color: #5a5a8c; }
.design-control[data-type="label"]      { background: transparent; border: 1px dashed #555; }
.design-control[data-type="form"]       { background: rgba(200,200,200,0.05); border: 1px dashed #666; }
.design-control[data-type="fieldset"]   { background: rgba(200,200,200,0.05); border: 1px solid #666; border-radius: 3px; }
.design-control[data-type="legend"]     { background: transparent; border: 1px dashed #555; }
.design-control[data-type="output"]     { background: transparent; border: 1px dashed #555; }
.design-control[data-type="meter"]      { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="progress"]   { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }
.design-control[data-type="datalist"]   { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 2px; }

/* Control type visual styles - HTML Media */
.design-control[data-type="img"]        { background: #2a2a3a; border: 1px solid #555; }
.design-control[data-type="video"]      { background: #1a1a2a; border: 1px solid #555; }
.design-control[data-type="audio"]      { background: #2a2a2a; border: 1px solid #555; border-radius: 20px; }
.design-control[data-type="canvas"]     { background: #1e1e1e; border: 1px solid #555; }
.design-control[data-type="svg"]        { background: rgba(200,200,0,0.05); border: 1px solid #555; }
.design-control[data-type="iframe"]     { background: #1a1a1a; border: 2px solid #555; }
.design-control[data-type="picture"]    { background: #2a2a3a; border: 1px solid #555; }
.design-control[data-type="source"]     { background: transparent; border: 1px dashed #555; }
.design-control[data-type="figure"]     { background: rgba(200,200,200,0.05); border: 1px solid #555; }
.design-control[data-type="figcaption"] { background: transparent; border: 1px dashed #555; }

/* Control type visual styles - Lists/Tables */
.design-control[data-type="ul"]         { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="ol"]         { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="li"]         { background: transparent; border: 1px dashed #55555544; }
.design-control[data-type="dl"]         { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="dt"]         { background: transparent; border: 1px dashed #555; }
.design-control[data-type="dd"]         { background: transparent; border: 1px dashed #55555544; }
.design-control[data-type="table"]      { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="thead"]      { background: #333; border: 1px solid #555; }
.design-control[data-type="tbody"]      { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="tfoot"]      { background: #333; border: 1px solid #555; }
.design-control[data-type="tr"]         { background: rgba(200,200,200,0.05); border: 1px dashed #555; }
.design-control[data-type="th"]         { background: #333; border: 1px solid #555; }
.design-control[data-type="td"]         { background: var(--input-bg); border: 1px solid var(--input-border); }
.design-control[data-type="caption"]    { background: transparent; border: 1px dashed #555; }
.design-control[data-type="colgroup"]   { background: transparent; border: 1px dashed #55555544; }
.design-control[data-type="col"]        { background: transparent; border: 1px dashed #55555544; }

/* Control type visual styles - Semantic/Layout */
.design-control[data-type="nav"]        { background: rgba(0,204,122,0.06); border: 1px dashed #00cc7a55; }
.design-control[data-type="header"]     { background: rgba(122,0,204,0.08); border: 1px dashed #7a00cc55; }
.design-control[data-type="footer"]     { background: rgba(204,122,0,0.08); border: 1px dashed #cc7a0055; }
.design-control[data-type="section"]    { background: rgba(0,122,204,0.06); border: 1px dashed #007acc44; }
.design-control[data-type="article"]    { background: rgba(200,200,0,0.06); border: 1px dashed #cccc0055; }
.design-control[data-type="aside"]      { background: rgba(204,0,122,0.06); border: 1px dashed #cc007a44; }
.design-control[data-type="main"]       { background: rgba(0,122,204,0.08); border: 1px dashed #007acc55; }
.design-control[data-type="details"]    { background: rgba(200,200,200,0.05); border: 1px solid #555; }
.design-control[data-type="summary"]    { background: transparent; border: 1px dashed #555; }
.design-control[data-type="dialog"]     { background: #2d2d30; border: 1px solid #888; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.design-control[data-type="template"]   { background: rgba(200,200,200,0.03); border: 1px dashed #44444488; }
.design-control[data-type="slot"]       { background: rgba(200,200,200,0.03); border: 1px dashed #44444488; }

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
/* Panel splitter/resizer handles */
.panel-splitter {
    width: 5px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
    transition: background 0.15s;
}
.panel-splitter:hover, .panel-splitter.active {
    background: var(--control-selected);
}
.panel-splitter::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    left: -2px; right: -2px;
}
</style>
</head>
<body>

<!-- TOP TOOLBAR -->
<div class="toolbar">
    <span class="title">HTML Designer</span>
    <button onclick="undoAction()" title="Undo (Ctrl+Z)"><svg viewBox="0 0 16 16"><path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7h-1.5c0 3-2.5 5.5-5.5 5.5S2.5 11 2.5 8 5 2.5 8 2.5c1.5 0 2.8.6 3.9 1.5L9.5 6.5H15V1l-2.1 2.1C11.5 1.8 9.8 1 8 1z"/></svg> Undo</button>
    <button onclick="redoAction()" title="Redo (Ctrl+Y)"><svg viewBox="0 0 16 16"><path d="M8 1c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7h1.5c0 3 2.5 5.5 5.5 5.5s5.5-2.5 5.5-5.5S11 2.5 8 2.5C6.5 2.5 5.2 3.1 4.1 4L6.5 6.5H1V1l2.1 2.1C4.5 1.8 6.2 1 8 1z"/></svg> Redo</button>
    <span class="separator"></span>
    <button onclick="deleteSelected()" title="Delete (Del)"><svg viewBox="0 0 16 16"><path d="M11 1.5v1h3.5v1h-1l-.9 10.1c-.1.8-.7 1.4-1.5 1.4H4.9c-.8 0-1.4-.6-1.5-1.4L2.5 3.5h-1v-1H5v-1c0-.6.4-1 1-1h4c.6 0 1 .4 1 1zm-5 0v1h4v-1H6zm5.5 2h-7l.9 10h5.2l.9-10z"/></svg> Delete</button>
    <button onclick="bringToFront()" title="Bring to Front"><svg viewBox="0 0 16 16"><path d="M3 13h10l-5-8z"/></svg> Front</button>
    <button onclick="sendToBack()" title="Send to Back"><svg viewBox="0 0 16 16"><path d="M3 3h10l-5 8z"/></svg> Back</button>
    <span class="separator"></span>
    <span class="auto-sync-badge" id="syncStatus" title="Changes auto-sync to document"><span class="sync-dot"></span> Auto-sync</span>
    <span class="zoom-badge" id="zoomBadge" title="Zoom level (click to reset)">100%</span>
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
        <div class="toolbox-item" draggable="true" data-type="blockquote">
            <span class="icon">Bq</span> blockquote
        </div>
        <div class="toolbox-item" draggable="true" data-type="pre">
            <span class="icon">Pr</span> pre
        </div>
        <div class="toolbox-item" draggable="true" data-type="code">
            <span class="icon">Cd</span> code
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
        <div class="toolbox-item" draggable="true" data-type="legend">
            <span class="icon">Lg</span> legend
        </div>
        <div class="toolbox-item" draggable="true" data-type="output">
            <span class="icon">Op</span> output
        </div>
        <div class="toolbox-item" draggable="true" data-type="meter">
            <span class="icon">Mt</span> meter
        </div>
        <div class="toolbox-item" draggable="true" data-type="progress">
            <span class="icon">Pg</span> progress
        </div>
        <div class="toolbox-item" draggable="true" data-type="datalist">
            <span class="icon">Dl</span> datalist
        </div>

        <h3>HTML Media</h3>
        <div class="toolbox-item" draggable="true" data-type="img">
            <span class="icon">Im</span> img
        </div>
        <div class="toolbox-item" draggable="true" data-type="video">
            <span class="icon">Vd</span> video
        </div>
        <div class="toolbox-item" draggable="true" data-type="audio">
            <span class="icon">Au</span> audio
        </div>
        <div class="toolbox-item" draggable="true" data-type="canvas">
            <span class="icon">Cv</span> canvas
        </div>
        <div class="toolbox-item" draggable="true" data-type="svg">
            <span class="icon">Sv</span> svg
        </div>
        <div class="toolbox-item" draggable="true" data-type="iframe">
            <span class="icon">If</span> iframe
        </div>
        <div class="toolbox-item" draggable="true" data-type="picture">
            <span class="icon">Pc</span> picture
        </div>
        <div class="toolbox-item" draggable="true" data-type="source">
            <span class="icon">Sr</span> source
        </div>
        <div class="toolbox-item" draggable="true" data-type="figure">
            <span class="icon">Fg</span> figure
        </div>
        <div class="toolbox-item" draggable="true" data-type="figcaption">
            <span class="icon">Fc</span> figcaption
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
        <div class="toolbox-item" draggable="true" data-type="dl">
            <span class="icon">Dl</span> dl
        </div>
        <div class="toolbox-item" draggable="true" data-type="dt">
            <span class="icon">Dt</span> dt
        </div>
        <div class="toolbox-item" draggable="true" data-type="dd">
            <span class="icon">Dd</span> dd
        </div>
        <div class="toolbox-item" draggable="true" data-type="table">
            <span class="icon">Tb</span> table
        </div>
        <div class="toolbox-item" draggable="true" data-type="thead">
            <span class="icon">Th</span> thead
        </div>
        <div class="toolbox-item" draggable="true" data-type="tbody">
            <span class="icon">Tb</span> tbody
        </div>
        <div class="toolbox-item" draggable="true" data-type="tfoot">
            <span class="icon">Tf</span> tfoot
        </div>
        <div class="toolbox-item" draggable="true" data-type="tr">
            <span class="icon">Tr</span> tr
        </div>
        <div class="toolbox-item" draggable="true" data-type="th">
            <span class="icon">TH</span> th
        </div>
        <div class="toolbox-item" draggable="true" data-type="td">
            <span class="icon">Td</span> td
        </div>
        <div class="toolbox-item" draggable="true" data-type="caption">
            <span class="icon">Cp</span> caption
        </div>
        <div class="toolbox-item" draggable="true" data-type="colgroup">
            <span class="icon">Cg</span> colgroup
        </div>
        <div class="toolbox-item" draggable="true" data-type="col">
            <span class="icon">Co</span> col
        </div>

        <h3>HTML Semantic / Layout</h3>
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
        <div class="toolbox-item" draggable="true" data-type="details">
            <span class="icon">De</span> details
        </div>
        <div class="toolbox-item" draggable="true" data-type="summary">
            <span class="icon">Su</span> summary
        </div>
        <div class="toolbox-item" draggable="true" data-type="dialog">
            <span class="icon">Di</span> dialog
        </div>
        <div class="toolbox-item" draggable="true" data-type="template">
            <span class="icon">Tm</span> template
        </div>
        <div class="toolbox-item" draggable="true" data-type="slot">
            <span class="icon">Sl</span> slot
        </div>
    </div>

    <div class="panel-splitter" id="splitterLeft"></div>

    <!-- CANVAS -->
    <div class="canvas-wrapper" id="canvasWrapper">
        <div class="canvas-scroller" id="canvasScroller">
            <div style="position: relative;">
                <span class="canvas-label" id="canvasLabel">HTML Document</span>
                <div class="canvas-container" id="designCanvas">
                    <div class="drop-indicator" id="dropIndicator"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="panel-splitter" id="splitterRight"></div>

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
    var isSplitterDragging = false;
    var activeSplitter = null;
    var splitterStartX = 0;
    var splitterStartWidth = 0;
    var autoSyncTimer = null;
    var zoomLevel = 1;
    var isPanning = false;
    var panStartX = 0;
    var panStartY = 0;
    var panScrollStartX = 0;
    var panScrollStartY = 0;

    // =================== AUTO-SYNC ===================
    function scheduleAutoSync() {
        if (autoSyncTimer) clearTimeout(autoSyncTimer);
        autoSyncTimer = setTimeout(function() {
            autoSyncTimer = null;
            window.syncToHtml();
            var badge = document.getElementById('syncStatus');
            if (badge) {
                badge.classList.add('syncing');
                setTimeout(function() { badge.classList.remove('syncing'); }, 800);
            }
        }, 300);
    }

    // Preserved HTML document parts
    var doctype = '';
    var htmlOpenTag = '';
    var headContent = '';
    var bodyOpenTag = '';
    var scriptTags = '';
    var isFragment = false;
    var fragmentPrefix = '';
    var fragmentSuffix = '';

    var canvas = document.getElementById('designCanvas');
    var dropIndicator = document.getElementById('dropIndicator');
    var propertiesPanel = document.getElementById('propertiesPanel');
    var contextMenu = document.getElementById('contextMenu');
    var canvasLabel = document.getElementById('canvasLabel');
    var canvasWrapper = document.getElementById('canvasWrapper');
    var zoomBadge = document.getElementById('zoomBadge');

    // =================== ZOOM & PAN ===================
    function applyZoom() {
        canvas.style.transform = 'scale(' + zoomLevel + ')';
        zoomBadge.textContent = Math.round(zoomLevel * 100) + '%';
    }

    canvasWrapper.addEventListener('wheel', function(e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        var delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomLevel = Math.min(5, Math.max(0.1, zoomLevel + delta));
        zoomLevel = Math.round(zoomLevel * 100) / 100;
        applyZoom();
    }, { passive: false });

    zoomBadge.addEventListener('click', function() {
        zoomLevel = 1;
        applyZoom();
    });

    canvasWrapper.addEventListener('mousedown', function(e) {
        if (e.button === 1) {
            e.preventDefault();
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panScrollStartX = canvasWrapper.scrollLeft;
            panScrollStartY = canvasWrapper.scrollTop;
            canvasWrapper.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isPanning) {
            canvasWrapper.scrollLeft = panScrollStartX - (e.clientX - panStartX);
            canvasWrapper.scrollTop = panScrollStartY - (e.clientY - panStartY);
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (isPanning) {
            isPanning = false;
            canvasWrapper.style.cursor = '';
        }
    });

    // =================== CONTROL DEFAULTS ===================
    var controlDefaults = {
        // HTML Structure
        'div':        { w: 200, h: 100, content: '' },
        'span':       { w: 80,  h: 24,  content: 'Span' },
        'p':          { w: 300, h: 40,  content: 'Paragraph text' },
        'h1':         { w: 300, h: 44,  content: 'Heading 1' },
        'h2':         { w: 280, h: 38,  content: 'Heading 2' },
        'h3':         { w: 260, h: 32,  content: 'Heading 3' },
        'h4':         { w: 240, h: 28,  content: 'Heading 4' },
        'h5':         { w: 220, h: 24,  content: 'Heading 5' },
        'h6':         { w: 200, h: 22,  content: 'Heading 6' },
        'a':          { w: 80,  h: 24,  content: 'Link' },
        'hr':         { w: 200, h: 4,   content: '' },
        'br':         { w: 40,  h: 20,  content: '' },
        'blockquote': { w: 280, h: 80,  content: 'Blockquote' },
        'pre':        { w: 250, h: 80,  content: '' },
        'code':       { w: 120, h: 24,  content: 'code' },
        // HTML Forms
        'input':      { w: 200, h: 32,  content: '' },
        'textarea':   { w: 250, h: 100, content: '' },
        'select':     { w: 200, h: 32,  content: '' },
        'button':     { w: 120, h: 36,  content: 'Button' },
        'label':      { w: 80,  h: 24,  content: 'Label' },
        'form':       { w: 300, h: 250, content: '' },
        'fieldset':   { w: 280, h: 200, content: '' },
        'legend':     { w: 100, h: 24,  content: 'Legend' },
        'output':     { w: 100, h: 24,  content: '' },
        'meter':      { w: 150, h: 24,  content: '' },
        'progress':   { w: 200, h: 24,  content: '' },
        'datalist':   { w: 200, h: 32,  content: '' },
        // HTML Media
        'img':        { w: 200, h: 150, content: '' },
        'video':      { w: 320, h: 240, content: '' },
        'audio':      { w: 300, h: 54,  content: '' },
        'canvas':     { w: 300, h: 200, content: '' },
        'svg':        { w: 200, h: 200, content: '' },
        'iframe':     { w: 400, h: 300, content: '' },
        'picture':    { w: 200, h: 150, content: '' },
        'source':     { w: 200, h: 24,  content: '' },
        'figure':     { w: 250, h: 200, content: '' },
        'figcaption': { w: 250, h: 30,  content: 'Figure Caption' },
        // HTML Lists/Tables
        'ul':         { w: 200, h: 100, content: '' },
        'ol':         { w: 200, h: 100, content: '' },
        'li':         { w: 180, h: 28,  content: 'List item' },
        'dl':         { w: 200, h: 100, content: '' },
        'dt':         { w: 180, h: 24,  content: 'Term' },
        'dd':         { w: 180, h: 24,  content: 'Definition' },
        'table':      { w: 300, h: 200, content: '' },
        'thead':      { w: 280, h: 30,  content: '' },
        'tbody':      { w: 280, h: 100, content: '' },
        'tfoot':      { w: 280, h: 30,  content: '' },
        'tr':         { w: 280, h: 30,  content: '' },
        'th':         { w: 100, h: 30,  content: 'Header' },
        'td':         { w: 100, h: 30,  content: 'Cell' },
        'caption':    { w: 280, h: 28,  content: 'Table Caption' },
        'colgroup':   { w: 280, h: 20,  content: '' },
        'col':        { w: 100, h: 20,  content: '' },
        // HTML Semantic/Layout
        'nav':        { w: 250, h: 50,  content: '' },
        'header':     { w: 400, h: 80,  content: '' },
        'footer':     { w: 400, h: 60,  content: '' },
        'section':    { w: 350, h: 200, content: '' },
        'article':    { w: 350, h: 250, content: '' },
        'aside':      { w: 200, h: 300, content: '' },
        'main':       { w: 400, h: 400, content: '' },
        'details':    { w: 250, h: 80,  content: '' },
        'summary':    { w: 200, h: 28,  content: 'Details summary' },
        'dialog':     { w: 300, h: 200, content: '' },
        'template':   { w: 200, h: 100, content: '' },
        'slot':       { w: 200, h: 100, content: '' }
    };

    // Types whose text content appears between open/close tags
    var contentTypes = ['button', 'label', 'legend', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'th', 'td', 'dt', 'dd', 'summary', 'figcaption', 'caption', 'code', 'blockquote', 'output'];

    // HTML void / self-closing elements
    var selfClosingTypes = ['hr', 'br', 'img', 'input', 'source', 'col', 'meter', 'progress'];

    // Container types (rendered with open + close tag, no text content)
    var containerTypes = ['div', 'form', 'fieldset', 'nav', 'header', 'footer', 'section', 'article',
        'aside', 'main', 'details', 'dialog', 'figure', 'table', 'thead', 'tbody', 'tfoot', 'tr',
        'ul', 'ol', 'dl', 'picture', 'colgroup', 'template', 'slot', 'blockquote', 'pre', 'svg',
        'canvas', 'textarea', 'select', 'iframe', 'video', 'audio', 'datalist'];

    // Type-specific extra properties shown in the properties panel
    var typeExtraProperties = {
        'a':          [
            { name: 'href', type: 'text' },
            { name: 'target', type: 'select', options: ['', '_blank', '_self', '_parent', '_top'] },
            { name: 'rel', type: 'text' },
            { name: 'download', type: 'text' }
        ],
        'img':        [
            { name: 'src', type: 'text' },
            { name: 'alt', type: 'text' },
            { name: 'loading', type: 'select', options: ['', 'lazy', 'eager'] },
            { name: 'crossorigin', type: 'select', options: ['', 'anonymous', 'use-credentials'] }
        ],
        'input':      [
            { name: 'type', type: 'select', options: ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'file', 'checkbox', 'radio', 'range', 'hidden', 'submit', 'reset', 'button'] },
            { name: 'placeholder', type: 'text' },
            { name: 'value', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'required', type: 'select', options: ['', 'true'] },
            { name: 'disabled', type: 'select', options: ['', 'true'] },
            { name: 'readonly', type: 'select', options: ['', 'true'] },
            { name: 'min', type: 'text' },
            { name: 'max', type: 'text' },
            { name: 'step', type: 'text' },
            { name: 'pattern', type: 'text' },
            { name: 'autocomplete', type: 'select', options: ['', 'on', 'off'] }
        ],
        'textarea':   [
            { name: 'placeholder', type: 'text' },
            { name: 'rows', type: 'number' },
            { name: 'cols', type: 'number' },
            { name: 'name', type: 'text' },
            { name: 'required', type: 'select', options: ['', 'true'] },
            { name: 'disabled', type: 'select', options: ['', 'true'] },
            { name: 'readonly', type: 'select', options: ['', 'true'] },
            { name: 'wrap', type: 'select', options: ['', 'hard', 'soft'] }
        ],
        'select':     [
            { name: 'name', type: 'text' },
            { name: 'required', type: 'select', options: ['', 'true'] },
            { name: 'disabled', type: 'select', options: ['', 'true'] },
            { name: 'multiple', type: 'select', options: ['', 'true'] },
            { name: 'size', type: 'number' }
        ],
        'button':     [
            { name: 'type', type: 'select', options: ['button', 'submit', 'reset'] },
            { name: 'disabled', type: 'select', options: ['', 'true'] },
            { name: 'formaction', type: 'text' }
        ],
        'form':       [
            { name: 'action', type: 'text' },
            { name: 'method', type: 'select', options: ['', 'get', 'post'] },
            { name: 'enctype', type: 'select', options: ['', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'] },
            { name: 'target', type: 'select', options: ['', '_blank', '_self'] },
            { name: 'novalidate', type: 'select', options: ['', 'true'] },
            { name: 'autocomplete', type: 'select', options: ['', 'on', 'off'] }
        ],
        'fieldset':   [
            { name: 'disabled', type: 'select', options: ['', 'true'] }
        ],
        'label':      [
            { name: 'for', type: 'text' }
        ],
        'video':      [
            { name: 'src', type: 'text' },
            { name: 'controls', type: 'select', options: ['', 'true'] },
            { name: 'autoplay', type: 'select', options: ['', 'true'] },
            { name: 'loop', type: 'select', options: ['', 'true'] },
            { name: 'muted', type: 'select', options: ['', 'true'] },
            { name: 'poster', type: 'text' },
            { name: 'preload', type: 'select', options: ['', 'auto', 'metadata', 'none'] }
        ],
        'audio':      [
            { name: 'src', type: 'text' },
            { name: 'controls', type: 'select', options: ['', 'true'] },
            { name: 'autoplay', type: 'select', options: ['', 'true'] },
            { name: 'loop', type: 'select', options: ['', 'true'] },
            { name: 'muted', type: 'select', options: ['', 'true'] },
            { name: 'preload', type: 'select', options: ['', 'auto', 'metadata', 'none'] }
        ],
        'iframe':     [
            { name: 'src', type: 'text' },
            { name: 'srcdoc', type: 'text' },
            { name: 'sandbox', type: 'text' },
            { name: 'allow', type: 'text' },
            { name: 'loading', type: 'select', options: ['', 'lazy', 'eager'] }
        ],
        'svg':        [
            { name: 'viewBox', type: 'text' },
            { name: 'xmlns', type: 'text' }
        ],
        'table':      [
            { name: 'border', type: 'text' }
        ],
        'th':         [
            { name: 'colspan', type: 'number' },
            { name: 'rowspan', type: 'number' },
            { name: 'scope', type: 'select', options: ['', 'col', 'row', 'colgroup', 'rowgroup'] }
        ],
        'td':         [
            { name: 'colspan', type: 'number' },
            { name: 'rowspan', type: 'number' }
        ],
        'col':        [
            { name: 'span', type: 'number' }
        ],
        'colgroup':   [
            { name: 'span', type: 'number' }
        ],
        'meter':      [
            { name: 'value', type: 'number' },
            { name: 'min', type: 'number' },
            { name: 'max', type: 'number' },
            { name: 'low', type: 'number' },
            { name: 'high', type: 'number' },
            { name: 'optimum', type: 'number' }
        ],
        'progress':   [
            { name: 'value', type: 'number' },
            { name: 'max', type: 'number' }
        ],
        'details':    [
            { name: 'open', type: 'select', options: ['', 'true'] }
        ],
        'dialog':     [
            { name: 'open', type: 'select', options: ['', 'true'] }
        ],
        'ol':         [
            { name: 'type', type: 'select', options: ['', '1', 'a', 'A', 'i', 'I'] },
            { name: 'start', type: 'number' },
            { name: 'reversed', type: 'select', options: ['', 'true'] }
        ],
        'source':     [
            { name: 'src', type: 'text' },
            { name: 'type', type: 'text' },
            { name: 'srcset', type: 'text' },
            { name: 'media', type: 'text' },
            { name: 'sizes', type: 'text' }
        ],
        'output':     [
            { name: 'for', type: 'text' },
            { name: 'name', type: 'text' }
        ]
    };

    // Common properties for all elements
    var commonProperties = [
        { name: 'class', type: 'text' },
        { name: 'id', type: 'text' },
        { name: 'style', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'hidden', type: 'select', options: ['', 'true'] },
        { name: 'draggable', type: 'select', options: ['', 'true', 'false'] }
    ];

    // =================== HTML PARSING ===================
    function parseHtmlContent(text) {
        try {
            var trimmed = text.trim();
            if (!trimmed) return [];

            // Detect if this is a full HTML document or a fragment
            var hasHtmlTag = /<html[\\s>]/i.test(trimmed);
            var hasBodyTag = /<body[\\s>]/i.test(trimmed);

            if (!hasHtmlTag && !hasBodyTag) {
                // Fragment mode
                isFragment = true;
                fragmentPrefix = '';
                fragmentSuffix = '';
                return parseBodyElements(trimmed);
            }

            isFragment = false;

            // Extract DOCTYPE
            doctype = '';
            var doctypeMatch = trimmed.match(/^<!DOCTYPE[^>]*>/i);
            if (doctypeMatch) {
                doctype = doctypeMatch[0];
            }

            // Extract <html ...> opening tag
            htmlOpenTag = '<html>';
            var htmlOpenMatch = trimmed.match(/<html([^>]*)>/i);
            if (htmlOpenMatch) {
                htmlOpenTag = '<html' + htmlOpenMatch[1] + '>';
            }

            // Extract <head>...</head> content
            headContent = '';
            var headMatch = trimmed.match(/<head[^>]*>([\\s\\S]*?)<\\/head>/i);
            if (headMatch) {
                headContent = headMatch[1];
            }

            // Extract <body ...> opening tag
            bodyOpenTag = '<body>';
            var bodyOpenMatch = trimmed.match(/<body([^>]*)>/i);
            if (bodyOpenMatch) {
                bodyOpenTag = '<body' + bodyOpenMatch[1] + '>';
            }

            // Extract body content
            var bodyContent = '';
            var bodyMatch = trimmed.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
            if (bodyMatch) {
                bodyContent = bodyMatch[1];
            } else if (hasBodyTag) {
                var bodyStartMatch = trimmed.match(/<body[^>]*>/i);
                if (bodyStartMatch) {
                    bodyContent = trimmed.substring(trimmed.indexOf(bodyStartMatch[0]) + bodyStartMatch[0].length);
                }
            }

            // Extract script tags from end of body
            scriptTags = '';
            var scriptParts = [];
            var scriptRegex = /<script[\\s\\S]*?<\\/script>/gi;
            var remaining = bodyContent;
            var lastScriptEnd = -1;
            var sm;
            while ((sm = scriptRegex.exec(bodyContent)) !== null) {
                scriptParts.push(sm[0]);
                lastScriptEnd = sm.index + sm[0].length;
            }
            if (scriptParts.length > 0) {
                scriptTags = scriptParts.join('\\n');
                // Remove script tags from body content for parsing elements
                for (var si = 0; si < scriptParts.length; si++) {
                    remaining = remaining.replace(scriptParts[si], '');
                }
                bodyContent = remaining;
            }

            return parseBodyElements(bodyContent.trim());
        } catch(e) {
            console.error('HTML parse error', e);
            return null;
        }
    }

    function parseBodyElements(htmlPortion) {
        var allTypeNames = Object.keys(controlDefaults);
        var parsed = [];

        for (var ti = 0; ti < allTypeNames.length; ti++) {
            var typeName = allTypeNames[ti];
            var selfClose = new RegExp('<' + typeName + '(\\\\s[^>]*)?\\\\/>', 'g');
            var openClose = new RegExp('<' + typeName + '(\\\\s[^>]*)?>(([\\\\s\\\\S]*?)?)<\\\\/' + typeName + '\\\\s*>', 'g');
            // Also match void elements without self-closing slash (e.g., <br> <hr> <img ...>)
            var voidTag = null;
            if (selfClosingTypes.indexOf(typeName) >= 0) {
                voidTag = new RegExp('<' + typeName + '(\\\\s[^>]*)?>(?!\\\\s*<\\\\/' + typeName + ')', 'g');
            }

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
            if (voidTag) {
                while ((m = voidTag.exec(htmlPortion)) !== null) {
                    // Skip if already matched as self-closing
                    var fullMatch = m[0];
                    if (fullMatch.charAt(fullMatch.length - 2) === '/') continue;
                    var ctrl3 = parseElementAttrs(typeName, m[1] || '', '');
                    if (ctrl3) parsed.push(ctrl3);
                }
            }
        }

        return parsed;
    }

    function parseElementAttrs(typeName, attrString, innerText) {
        var def = controlDefaults[typeName];
        if (!def) return null;

        var attrs = {};
        // Parse double-quoted attributes
        var attrRegex = /([\\w:.\\-]+)\\s*=\\s*"([^"]*)"/g;
        var am;
        while ((am = attrRegex.exec(attrString)) !== null) {
            attrs[am[1]] = am[2];
        }
        // Parse single-quoted attributes
        var attrRegex2 = /([\\w:.\\-]+)\\s*=\\s*'([^']*)'/g;
        while ((am = attrRegex2.exec(attrString)) !== null) {
            attrs[am[1]] = am[2];
        }
        // Parse boolean attributes (no value)
        var boolRegex = /\\s([\\w:.\\-]+)(?=\\s|$|\\/>|>)/g;
        var bm;
        var attrStr = attrString || '';
        while ((bm = boolRegex.exec(attrStr)) !== null) {
            var boolName = bm[1];
            if (!(boolName in attrs)) {
                attrs[boolName] = 'true';
            }
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

        // Gather additional attributes, skipping ones we handle separately
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

    // =================== HTML GENERATION ===================
    function generateHtml() {
        var NL = '\\n';
        var html = '';

        if (isFragment) {
            // Fragment mode: just output positioned elements
            html += '<div style="position:relative;width:' + (canvas.offsetWidth || 800) + 'px;height:' + (canvas.offsetHeight || 500) + 'px;">' + NL;
            html += generateControlElements(NL);
            html += '</div>' + NL;
            return html;
        }

        // Full document mode
        if (doctype) {
            html += doctype + NL;
        }
        html += htmlOpenTag + NL;
        html += '<head>' + NL;
        if (headContent) {
            html += headContent + NL;
        }
        html += '</head>' + NL;
        html += bodyOpenTag + NL;

        // Container div for absolute positioning
        var cw = (canvas.offsetWidth || 800) + 'px';
        var ch = (canvas.offsetHeight || 500) + 'px';
        html += '<div style="position:relative;width:' + cw + ';height:' + ch + ';">' + NL;

        html += generateControlElements(NL);

        html += '</div>' + NL;

        // Script tags at the bottom of body
        if (scriptTags) {
            html += scriptTags + NL;
        }

        html += '</body>' + NL;
        html += '</html>' + NL;

        return html;
    }

    function generateControlElements(NL) {
        var output = '';
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
                var propVal = props[pk[pi]];
                // Boolean attributes
                if (propVal === 'true' && ['required', 'disabled', 'readonly', 'multiple', 'novalidate',
                    'controls', 'autoplay', 'loop', 'muted', 'open', 'reversed', 'hidden'].indexOf(pk[pi]) >= 0) {
                    line += ' ' + pk[pi];
                } else {
                    line += ' ' + pk[pi] + '="' + escHtml(propVal) + '"';
                }
            }

            if (isSelfClosing) {
                line += ' />' + NL;
            } else if (hasContent) {
                line += '>' + escHtml(ctrl.content) + '</' + ctrl.type + '>' + NL;
            } else if (isContainer) {
                line += '></' + ctrl.type + '>' + NL;
            } else {
                if (ctrl.content) {
                    line += '>' + escHtml(ctrl.content) + '</' + ctrl.type + '>' + NL;
                } else {
                    line += '></' + ctrl.type + '>' + NL;
                }
            }
            output += line;
        }
        return output;
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
                    if (e.button !== 0) return;
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
                            if (e.button !== 0) return;
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
                return '<span class="control-label" style="pointer-events:none">' + esc(ctrl.content || 'Span') + '</span>';
            case 'p':
                return '<span class="control-label" style="pointer-events:none;font-size:13px">' + esc(ctrl.content || 'Paragraph text') + '</span>';
            case 'h1':
                return '<span class="control-label" style="pointer-events:none;font-size:22px;font-weight:bold">' + esc(ctrl.content || 'Heading 1') + '</span>';
            case 'h2':
                return '<span class="control-label" style="pointer-events:none;font-size:19px;font-weight:bold">' + esc(ctrl.content || 'Heading 2') + '</span>';
            case 'h3':
                return '<span class="control-label" style="pointer-events:none;font-size:16px;font-weight:bold">' + esc(ctrl.content || 'Heading 3') + '</span>';
            case 'h4':
                return '<span class="control-label" style="pointer-events:none;font-size:14px;font-weight:bold">' + esc(ctrl.content || 'Heading 4') + '</span>';
            case 'h5':
                return '<span class="control-label" style="pointer-events:none;font-size:12px;font-weight:bold">' + esc(ctrl.content || 'Heading 5') + '</span>';
            case 'h6':
                return '<span class="control-label" style="pointer-events:none;font-size:11px;font-weight:bold">' + esc(ctrl.content || 'Heading 6') + '</span>';
            case 'a':
                return '<span class="control-label" style="pointer-events:none;color:#58a6ff;text-decoration:underline">' + esc(ctrl.content || 'Link') + '</span>';
            case 'hr':
                return '<span style="pointer-events:none;position:absolute;top:50%;left:4px;right:4px;height:1px;background:#888"></span>';
            case 'br':
                return '<span class="control-label" style="pointer-events:none;color:#88888888;font-size:14px">&#8629;</span>';
            case 'blockquote':
                return '<span class="control-label" style="pointer-events:none;padding-left:10px;font-style:italic;font-size:12px;text-align:left;color:#aaa">' + esc(ctrl.content || 'Blockquote') + '</span>';
            case 'pre':
                return '<span class="control-label" style="pointer-events:none;font-family:monospace;font-size:11px;color:#aaa">&lt;pre&gt;</span>';
            case 'code':
                return '<span class="control-label" style="pointer-events:none;font-family:monospace;font-size:11px">' + esc(ctrl.content || 'code') + '</span>';

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
            case 'legend':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'Legend') + '</span>';
            case 'output':
                return '<span class="control-label" style="pointer-events:none;font-size:11px;color:#aaa">&lt;output&gt;</span>';
            case 'meter':
                return '<span style="pointer-events:none;display:flex;align-items:center;width:100%;height:100%;padding:4px"><span style="background:#4a8c4a;height:60%;width:60%;border-radius:2px"></span></span>';
            case 'progress':
                return '<span style="pointer-events:none;display:flex;align-items:center;width:100%;height:100%;padding:4px"><span style="background:#007acc;height:50%;width:70%;border-radius:2px"></span></span>';
            case 'datalist':
                return '<span class="control-label" style="pointer-events:none;font-size:10px;color:#888">&lt;datalist&gt;</span>';

            // HTML Media
            case 'img':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#888"><span style="font-size:28px">&#128444;</span><span style="font-size:10px">image</span></span>';
            case 'video':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#888;background:#111"><span style="font-size:32px">&#9654;</span><span style="font-size:10px">video</span></span>';
            case 'audio':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;padding:0 12px"><span style="font-size:14px">&#9654;</span><span style="flex:1;height:4px;background:#555;border-radius:2px"></span><span style="font-size:10px;color:#888">0:00</span></span>';
            case 'canvas':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#555;font-size:10px">&lt;canvas&gt;</span>';
            case 'svg':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#cccc0088;font-size:10px">&lt;svg&gt;</span>';
            case 'iframe':
                return '<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#555;font-size:10px;background:#1a1a1a">&lt;iframe&gt;</span>';
            case 'picture':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#888"><span style="font-size:24px">&#128444;</span><span style="font-size:10px">&lt;picture&gt;</span></span>';
            case 'source':
                return '<span class="control-label" style="pointer-events:none;font-size:10px;color:#888">&lt;source&gt;</span>';
            case 'figure':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&lt;figure&gt;</span>';
            case 'figcaption':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'Figure Caption') + '</span>';

            // HTML Lists/Tables
            case 'ul':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span>&#8226; Item 1</span><span>&#8226; Item 2</span><span>&#8226; Item 3</span></span>';
            case 'ol':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span>1. Item 1</span><span>2. Item 2</span><span>3. Item 3</span></span>';
            case 'li':
                return '<span class="control-label" style="pointer-events:none;text-align:left;padding-left:6px">&#8226; ' + esc(ctrl.content || 'List item') + '</span>';
            case 'dl':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;align-self:flex-start;padding:6px;font-size:11px;gap:2px;width:100%"><span style="font-weight:bold">Term</span><span style="padding-left:12px;color:#aaa">Definition</span></span>';
            case 'dt':
                return '<span class="control-label" style="pointer-events:none;font-weight:bold;font-size:11px">' + esc(ctrl.content || 'Term') + '</span>';
            case 'dd':
                return '<span class="control-label" style="pointer-events:none;font-size:11px;padding-left:8px;color:#aaa">' + esc(ctrl.content || 'Definition') + '</span>';
            case 'table':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;font-size:10px"><span style="display:flex;border-bottom:1px solid #555;background:#333;padding:2px 0"><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col1</span><span style="flex:1;padding:2px 6px;border-right:1px solid #555">Col2</span><span style="flex:1;padding:2px 6px">Col3</span></span></span>';
            case 'thead':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px;font-weight:bold">&lt;thead&gt;</span>';
            case 'tbody':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&lt;tbody&gt;</span>';
            case 'tfoot':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&lt;tfoot&gt;</span>';
            case 'tr':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:10px">&lt;tr&gt;</span>';
            case 'th':
                return '<span class="control-label" style="pointer-events:none;font-weight:bold;font-size:11px">' + esc(ctrl.content || 'Header') + '</span>';
            case 'td':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'Cell') + '</span>';
            case 'caption':
                return '<span class="control-label" style="pointer-events:none;font-size:11px;font-style:italic">' + esc(ctrl.content || 'Table Caption') + '</span>';
            case 'colgroup':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:9px">&lt;colgroup&gt;</span>';
            case 'col':
                return '<span class="control-label" style="pointer-events:none;color:#888;font-size:9px">&lt;col&gt;</span>';

            // HTML Semantic/Layout
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
            case 'details':
                return '<span style="pointer-events:none;display:flex;align-items:flex-start;padding:6px;font-size:11px;width:100%"><span>&#9654; Details</span></span>';
            case 'summary':
                return '<span class="control-label" style="pointer-events:none;font-size:11px">' + esc(ctrl.content || 'Details summary') + '</span>';
            case 'dialog':
                return '<span style="pointer-events:none;display:flex;flex-direction:column;width:100%;height:100%"><span style="padding:8px 10px;font-size:11px;border-bottom:1px solid #555;font-weight:bold">Dialog</span><span style="flex:1;padding:8px 10px;font-size:10px;color:#888">Content</span></span>';
            case 'template':
                return '<span class="control-label" style="pointer-events:none;color:#44444488;font-size:10px">&lt;template&gt;</span>';
            case 'slot':
                return '<span class="control-label" style="pointer-events:none;color:#44444488;font-size:10px">&lt;slot&gt;</span>';

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
    function getOccurrenceIndex(ctrl) {
        var idx = 0;
        for (var i = 0; i < controls.length; i++) {
            var c = controls[i];
            if (c.id === ctrl.id) return idx;
            if (c.type === ctrl.type && c.name === ctrl.name) idx++;
        }
        return 0;
    }

    function selectControl(id) {
        selectedId = id;
        render();
        updateProperties();
        if (id !== null) {
            var ctrl = controls.find(function(c) { return c.id === id; });
            if (ctrl) {
                vscode.postMessage({ type: 'selectElement', elementType: ctrl.type, elementName: ctrl.name || '', occurrenceIndex: getOccurrenceIndex(ctrl) });
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
        var x = (e.clientX - rect.left - canvas.clientLeft) / zoomLevel;
        var y = (e.clientY - rect.top - canvas.clientTop) / zoomLevel;
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
        var x = Math.max(0, (e.clientX - rect.left - canvas.clientLeft) / zoomLevel - def.w/2);
        var y = Math.max(0, (e.clientY - rect.top - canvas.clientTop) / zoomLevel - def.h/2);

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
        scheduleAutoSync();
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
            var dx = (e.clientX - dragStartX) / zoomLevel;
            var dy = (e.clientY - dragStartY) / zoomLevel;
            ctrl.x = Math.max(0, dragOrigX + dx);
            ctrl.y = Math.max(0, dragOrigY + dy);
            render();
            updateProperties();
        }
        if (isResizing && selectedId !== null) {
            handleResize(e);
        }
        if (isSplitterDragging && activeSplitter) {
            var dx = e.clientX - splitterStartX;
            if (activeSplitter === 'left') {
                var newW = Math.max(100, Math.min(400, splitterStartWidth + dx));
                document.querySelector('.toolbox').style.width = newW + 'px';
            } else if (activeSplitter === 'right') {
                var newW = Math.max(120, Math.min(500, splitterStartWidth - dx));
                document.getElementById('propertiesPanel').style.width = newW + 'px';
            }
        }
    });

    document.addEventListener('mouseup', function() {
        if (isDraggingControl || isResizing) {
            scheduleAutoSync();
        }
        isDraggingControl = false;
        isResizing = false;
        if (isSplitterDragging) {
            isSplitterDragging = false;
            activeSplitter = null;
            var sl = document.getElementById('splitterLeft');
            var sr = document.getElementById('splitterRight');
            if (sl) sl.classList.remove('active');
            if (sr) sr.classList.remove('active');
        }
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

        var dx = (e.clientX - dragStartX) / zoomLevel;
        var dy = (e.clientY - dragStartY) / zoomLevel;
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

        // Basic position/size rows
        var rows = [
            { label: 'Type', key: '_type', value: ctrl.type, readonly: true, inputType: 'text' },
            { label: 'X (left)', key: 'x', value: Math.round(ctrl.x), inputType: 'number' },
            { label: 'Y (top)', key: 'y', value: Math.round(ctrl.y), inputType: 'number' },
            { label: 'Width', key: 'w', value: Math.round(ctrl.w), inputType: 'number' },
            { label: 'Height', key: 'h', value: Math.round(ctrl.h), inputType: 'number' }
        ];

        // Content field for content types
        if (contentTypes.indexOf(ctrl.type) >= 0) {
            rows.push({ label: 'Content', key: 'content', value: ctrl.content || '', inputType: 'text' });
        }

        // Common properties
        for (var ci = 0; ci < commonProperties.length; ci++) {
            var cp = commonProperties[ci];
            if (cp.name === 'id') {
                rows.push({ label: 'id', key: 'name', value: ctrl.name || '', inputType: 'text' });
            } else if (cp.type === 'select') {
                rows.push({ label: cp.name, key: 'prop_' + cp.name, value: ctrl.properties[cp.name] || '', propKey: cp.name, inputType: 'select', options: cp.options });
            } else {
                rows.push({ label: cp.name, key: 'prop_' + cp.name, value: ctrl.properties[cp.name] || '', propKey: cp.name, inputType: 'text' });
            }
        }

        // Type-specific extra properties
        var extras = typeExtraProperties[ctrl.type] || [];
        var extraNames = [];
        for (var ei = 0; ei < extras.length; ei++) {
            var ep = extras[ei];
            extraNames.push(ep.name);
            if (ep.type === 'select') {
                rows.push({ label: ep.name, key: 'prop_' + ep.name, value: ctrl.properties[ep.name] || '', propKey: ep.name, inputType: 'select', options: ep.options });
            } else {
                rows.push({ label: ep.name, key: 'prop_' + ep.name, value: ctrl.properties[ep.name] || '', propKey: ep.name, inputType: ep.type || 'text' });
            }
        }

        // Show any other preserved properties not already shown
        var shownPropKeys = ['class', 'id', 'style', 'title', 'hidden', 'draggable'];
        for (var si = 0; si < extraNames.length; si++) {
            shownPropKeys.push(extraNames[si]);
        }
        var propKeys = Object.keys(ctrl.properties || {});
        for (var pi = 0; pi < propKeys.length; pi++) {
            if (shownPropKeys.indexOf(propKeys[pi]) >= 0) continue;
            rows.push({ label: propKeys[pi], key: 'prop_' + propKeys[pi], value: ctrl.properties[propKeys[pi]], propKey: propKeys[pi], inputType: 'text' });
        }

        for (var ri = 0; ri < rows.length; ri++) {
            var row = rows[ri];
            var div = document.createElement('div');
            div.className = 'prop-row';
            var lbl = document.createElement('label');
            lbl.textContent = row.label;
            div.appendChild(lbl);

            var inputEl;
            if (row.inputType === 'select' && row.options) {
                inputEl = document.createElement('select');
                for (var oi = 0; oi < row.options.length; oi++) {
                    var opt = document.createElement('option');
                    opt.value = row.options[oi];
                    opt.textContent = row.options[oi] || '(none)';
                    if (row.options[oi] === row.value) opt.selected = true;
                    inputEl.appendChild(opt);
                }
            } else {
                inputEl = document.createElement('input');
                inputEl.type = row.inputType || 'text';
                inputEl.value = row.value;
                if (row.readonly) inputEl.readOnly = true;
            }

            (function(r, inp, c) {
                inp.addEventListener('change', function() {
                    saveUndo();
                    var val = inp.value;
                    if (r.key === 'x') c.x = parseFloat(val) || 0;
                    else if (r.key === 'y') c.y = parseFloat(val) || 0;
                    else if (r.key === 'w') c.w = Math.max(20, parseFloat(val) || 20);
                    else if (r.key === 'h') c.h = Math.max(16, parseFloat(val) || 16);
                    else if (r.key === 'name') c.name = val;
                    else if (r.key === 'content') c.content = val;
                    else if (r.propKey) {
                        if (val) {
                            c.properties[r.propKey] = val;
                        } else {
                            delete c.properties[r.propKey];
                        }
                    }
                    render();
                    updateProperties();
                    scheduleAutoSync();
                });
            })(row, inputEl, ctrl);

            div.appendChild(inputEl);
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

    window.syncToHtml = function() {
        var html = generateHtml();
        vscode.postMessage({ type: 'updateHtml', content: html });
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
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;
            window.deleteSelected();
        }
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undoAction(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redoAction(); }
        if (e.ctrlKey && e.key === 'd') { e.preventDefault(); window.duplicateSelected(); }
        if (e.key === 'Escape') { selectedId = null; render(); updateProperties(); }

        if (selectedId !== null && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0) {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;
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
                var occIdx = typeof message.occurrenceIndex === 'number' ? message.occurrenceIndex : -1;
                var found = null;
                var matchCount = 0;
                for (var hi = 0; hi < controls.length; hi++) {
                    var c = controls[hi];
                    if (c.type === elemType && c.name === elemName) {
                        if (occIdx < 0 || matchCount === occIdx) {
                            found = c;
                            break;
                        }
                        matchCount++;
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
                var parsed = parseHtmlContent(message.content);
                if (parsed) {
                    var prevSelectedId = selectedId;
                    controls = parsed;
                    // Try to preserve selection
                    var found = false;
                    for (var si = 0; si < controls.length; si++) {
                        if (controls[si].id === prevSelectedId) { found = true; break; }
                    }
                    if (!found) selectedId = null;
                }
                if (!documentLoaded) {
                    documentLoaded = true;
                }
                render();
                updateProperties();
                break;
            }
        }
    });

    // =================== SPLITTER RESIZE ===================
    var splitterLeft = document.getElementById('splitterLeft');
    var splitterRight = document.getElementById('splitterRight');

    if (splitterLeft) {
        splitterLeft.addEventListener('mousedown', function(e) {
            e.preventDefault();
            isSplitterDragging = true;
            activeSplitter = 'left';
            splitterStartX = e.clientX;
            splitterStartWidth = document.querySelector('.toolbox').offsetWidth;
            splitterLeft.classList.add('active');
        });
    }

    if (splitterRight) {
        splitterRight.addEventListener('mousedown', function(e) {
            e.preventDefault();
            isSplitterDragging = true;
            activeSplitter = 'right';
            splitterStartX = e.clientX;
            splitterStartWidth = document.getElementById('propertiesPanel').offsetWidth;
            splitterRight.classList.add('active');
        });
    }

    // Signal ready
    vscode.postMessage({ type: 'ready' });
    render();
})();
</script>
</body>
</html>`;
}
