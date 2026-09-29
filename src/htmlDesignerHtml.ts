import * as vscode from 'vscode';

const icon = (paths: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;

// Toolbar icons: simple shapes in the current colour.
const ICONS = {
    alignLeft: icon('<path d="M2 1v14" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="3" width="9" height="3"/><rect x="4" y="9" width="5" height="3"/>'),
    alignCenter: icon('<path d="M8 1v14" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="10" height="3"/><rect x="5" y="9" width="6" height="3"/>'),
    alignRight: icon('<path d="M14 1v14" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="9" height="3"/><rect x="7" y="9" width="5" height="3"/>'),
    alignTop: icon('<path d="M1 2h14" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="4" width="3" height="9"/><rect x="9" y="4" width="3" height="5"/>'),
    alignMiddle: icon('<path d="M1 8h14" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="3" height="10"/><rect x="9" y="5" width="3" height="6"/>'),
    alignBottom: icon('<path d="M1 14h14" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="3" height="9"/><rect x="9" y="7" width="3" height="5"/>'),
    sameWidth: icon('<rect x="3" y="2" width="10" height="4"/><rect x="3" y="10" width="10" height="4"/><path d="M1 8h14" stroke="currentColor" stroke-dasharray="2 1"/>'),
    sameHeight: icon('<rect x="2" y="3" width="4" height="10"/><rect x="10" y="3" width="4" height="10"/><path d="M8 1v14" stroke="currentColor" stroke-dasharray="2 1"/>'),
    distH: icon('<rect x="1" y="4" width="3" height="8"/><rect x="6.5" y="4" width="3" height="8"/><rect x="12" y="4" width="3" height="8"/>'),
    distV: icon('<rect x="4" y="1" width="8" height="3"/><rect x="4" y="6.5" width="8" height="3"/><rect x="4" y="12" width="8" height="3"/>'),
    front: icon('<rect x="1" y="1" width="9" height="9" fill="none" stroke="currentColor"/><rect x="6" y="6" width="9" height="9"/>'),
    back: icon('<rect x="6" y="6" width="9" height="9" fill="none" stroke="currentColor"/><rect x="1" y="1" width="9" height="9"/>'),
    group: icon('<rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" stroke-dasharray="2 1.5"/><rect x="3.5" y="3.5" width="4" height="4"/><rect x="8.5" y="8.5" width="4" height="4"/>'),
    ungroup: icon('<rect x="1" y="1" width="6" height="6" fill="none" stroke="currentColor" stroke-dasharray="2 1.5"/><rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" stroke-dasharray="2 1.5"/>'),
    lock: icon('<rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
};

/** The HTML designer webview: the page shell; the designer lives in media/html (chrome shared with the other designers). */
export function getHtmlDesignerHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const media = (dir: string, file: string) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', dir, file)).toString();
    const btn = (id: string, title: string, content: string, cls = '') => `<button id="${id}" class="${cls}" title="${title}">${content}</button>`;
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>HTML Visual Designer</title>
<link rel="stylesheet" href="${media('wpf', 'wpfDesigner.css')}"/>
<link rel="stylesheet" href="${media('razor', 'razorDesigner.css')}"/>
<link rel="stylesheet" href="${media('html', 'htmlDesigner.css')}"/>
</head>
<body class="mode-empty">
<div class="toolbar wrap">
    <span class="title">HTML Designer</span>
    <span id="modeBadge" class="mode-badge doc-only"></span>
    ${btn('btnUndo', 'Undo (Ctrl+Z)', 'Undo')}
    ${btn('btnRedo', 'Redo (Ctrl+Y)', 'Redo')}
    <span class="separator doc-only"></span>
    ${btn('btnDelete', 'Delete the selection (Del)', 'Delete', 'doc-only')}
    ${btn('btnDuplicate', 'Duplicate the selection (Ctrl+D)', 'Duplicate', 'doc-only')}
    <span class="flow-only tb-group">
        ${btn('btnUp', 'Move before the previous sibling (Alt+Up)', '&#x2191;')}
        ${btn('btnDown', 'Move after the next sibling (Alt+Down)', '&#x2193;')}
        ${btn('btnParent', 'Select the parent (Esc)', 'Parent')}
    </span>
    <span class="hmi-only tb-group" id="alignGroup">
        <span class="separator"></span>
        ${btn('btnAlignLeft', 'Align left edges (to the first selected)', ICONS.alignLeft, 'icon')}
        ${btn('btnAlignCenter', 'Align horizontal centres', ICONS.alignCenter, 'icon')}
        ${btn('btnAlignRight', 'Align right edges', ICONS.alignRight, 'icon')}
        ${btn('btnAlignTop', 'Align top edges', ICONS.alignTop, 'icon')}
        ${btn('btnAlignMiddle', 'Align vertical centres', ICONS.alignMiddle, 'icon')}
        ${btn('btnAlignBottom', 'Align bottom edges', ICONS.alignBottom, 'icon')}
        ${btn('btnSameWidth', 'Same width', ICONS.sameWidth, 'icon')}
        ${btn('btnSameHeight', 'Same height', ICONS.sameHeight, 'icon')}
        ${btn('btnDistH', 'Distribute horizontally (equal spacing)', ICONS.distH, 'icon')}
        ${btn('btnDistV', 'Distribute vertically (equal spacing)', ICONS.distV, 'icon')}
        <span class="separator"></span>
        ${btn('btnFront', 'Bring to front', ICONS.front, 'icon')}
        ${btn('btnBack', 'Send to back', ICONS.back, 'icon')}
        ${btn('btnGroup', 'Group (Ctrl+G)', ICONS.group, 'icon')}
        ${btn('btnUngroup', 'Ungroup (Ctrl+Shift+G)', ICONS.ungroup, 'icon')}
        ${btn('btnLock', 'Lock or unlock position and size (Ctrl+L)', ICONS.lock, 'icon')}
    </span>
    <span class="separator doc-only"></span>
    <span class="hmi-only tb-group">
        <label class="tb-label" title="The page's design resolution">Page</label>
        <select id="pageRes" title="Page resolution"></select>
        <input id="pageW" class="vp-input" type="number" min="100" max="16000" title="Page width" hidden/>
        <input id="pageH" class="vp-input" type="number" min="100" max="16000" title="Page height" hidden/>
        <label class="tb-label" title="How the page scales to the browser window">Scale</label>
        <select id="pageScale" title="Scale mode">
            <option value="fit">Fit (whole page)</option>
            <option value="width">Fit width</option>
            <option value="height">Fit height</option>
            <option value="fill">Stretch to fill</option>
            <option value="none">No scaling</option>
        </select>
        <label class="tb-label" title="Preview the page in a window of another size">Window</label>
        <select id="windowPreview" title="Window preview"></select>
        <label class="toggle" title="Show the grid"><input type="checkbox" id="chkGrid"/> Grid</label>
        <input id="gridSize" class="vp-input small" type="number" min="2" max="200" title="Grid size (px)"/>
        <label class="toggle" title="Snap to the grid and to other elements (hold Alt to move freely)"><input type="checkbox" id="chkSnap"/> Snap</label>
    </span>
    <span class="flow-only tb-group">
        <select id="viewport" title="Viewport size"></select>
        <input id="vpW" class="vp-input" type="number" min="200" max="8000" title="Viewport width" hidden/>
        <input id="vpH" class="vp-input" type="number" min="200" max="8000" title="Viewport height" hidden/>
    </span>
    <span class="doc-only tb-group">
        ${btn('btnZoomOut', 'Zoom out (Ctrl+-)', '&#x2212;')}
        <span id="zoomBadge" class="zoom-badge" title="Click for 100%">100%</span>
        ${btn('btnZoomIn', 'Zoom in (Ctrl+=)', '+')}
        ${btn('btnFit', 'Fit in view (Ctrl+0)', 'Fit')}
        <label class="toggle" title="Outline every element"><input type="checkbox" id="chkOutlines"/> Outlines</label>
        ${btn('btnBrowser', 'Save and open the page in the browser', 'Preview')}
        ${btn('btnSource', 'Open the HTML source beside the designer', 'Source')}
    </span>
    <span id="status" class="status"></span>
</div>
<div id="errorBanner" class="error-banner" hidden></div>
<div class="main">
    <div class="side left doc-only-flex" id="leftPanel">
        <div class="side-tabs"><button class="side-tab active" data-pane="outline">Outline</button><button class="side-tab" data-pane="toolbox">Toolbox</button></div>
        <div class="pane" id="paneOutline">
            <input id="treeSearch" class="search" type="search" placeholder="Find by tag, class or id" spellcheck="false"/>
            <div id="tree" class="tree"></div>
        </div>
        <div class="pane" id="paneToolbox" hidden>
            <div class="hint" id="toolboxHint"></div>
            <div id="toolbox"></div>
        </div>
    </div>
    <div class="splitter doc-only-flex" data-side="left"></div>
    <div class="canvas-wrapper" id="canvasWrapper" tabindex="0">
        <div class="stage" id="stage"><iframe id="frame" class="rz-frame" title="Page preview"></iframe></div>
        <div class="glass" id="glass"></div>
        <div class="overlay" id="overlay">
            <div class="grid-layer" id="gridLayer"></div>
            <div id="guides"></div>
            <div class="hover-box" id="hoverBox"></div>
            <div class="sel-box" id="selBox"><span class="sel-label" id="selLabel"></span></div>
            <div class="drop-line" id="dropLine"></div>
            <div class="marquee" id="marquee"></div>
        </div>
        <div class="start-screen" id="startScreen" hidden>
            <h2>New page</h2>
            <div class="start-cards">
                <div class="start-card">
                    <h3>Fixed page (HMI)</h3>
                    <p>Everything stays exactly where you place it. The whole page scales to the browser window, like a TwinCAT HMI view.</p>
                    <label>Resolution <select id="startRes"></select></label>
                    <span class="start-custom"><input id="startW" type="number" min="100" max="16000" value="1920"/> × <input id="startH" type="number" min="100" max="16000" value="1080"/></span>
                    <label>Scale mode <select id="startScale">
                        <option value="fit">Fit (whole page)</option><option value="width">Fit width</option><option value="height">Fit height</option><option value="fill">Stretch to fill</option><option value="none">No scaling</option>
                    </select></label>
                    <button id="btnNewHmi" class="primary">Create fixed page</button>
                </div>
                <div class="start-card">
                    <h3>Flow page</h3>
                    <p>A normal web page: content flows and wraps with the window width. Good for text and for phones.</p>
                    <button id="btnNewFlow" class="primary">Create flow page</button>
                </div>
            </div>
        </div>
    </div>
    <div class="splitter doc-only-flex" data-side="right"></div>
    <div class="side right doc-only-flex" id="propsPanel">
        <div class="props-header" id="propsHeader">No selection</div>
        <div id="props" class="props"></div>
    </div>
</div>
<div class="statusbar"><span id="breadcrumb"></span><span id="coords"></span></div>
<script src="${media('razor', 'razorCore.js')}"></script>
<script src="${media('html', 'htmlDesigner.js')}"></script>
</body>
</html>`;
}
