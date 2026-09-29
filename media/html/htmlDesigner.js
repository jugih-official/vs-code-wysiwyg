/*
 * HTML visual designer (webview side). Two modes, chosen by the page itself:
 *  - Fixed page (HMI): a page of a set resolution (class "hmi-page") whose elements are placed absolutely and
 *    which scales to the browser window, like a TwinCAT HMI view. What you place stays where you place it.
 *  - Flow page: a normal web page; elements are reordered and styled, never repositioned behind your back.
 * Every change is a minimal text edit of the .html file (or of the stylesheet of an edited CSS rule).
 */
(function () {
    'use strict';
    var R = window.RazorCore;
    var vscode = acquireVsCodeApi();
    var $ = function (id) { return document.getElementById(id); };

    var wrapper = $('canvasWrapper'), stage = $('stage'), frame = $('frame'), glass = $('glass'), overlay = $('overlay');
    var selBox = $('selBox'), selLabel = $('selLabel'), hoverBox = $('hoverBox'), dropLine = $('dropLine'), marqueeEl = $('marquee');
    var guidesEl = $('guides'), gridLayer = $('gridLayer');
    var treeEl = $('tree'), propsEl = $('props'), propsHeader = $('propsHeader'), statusEl = $('status'), errorBanner = $('errorBanner');

    var RESOLUTIONS = [
        [1920, 1080, 'Full HD'], [1280, 720, 'HD'], [1366, 768, ''], [1280, 800, 'WXGA panel'], [1024, 768, 'XGA'],
        [800, 600, ''], [800, 480, '7" panel'], [1600, 900, ''], [2560, 1440, 'QHD'], [3840, 2160, '4K'], [1080, 1920, 'portrait'], [768, 1024, 'tablet portrait'],
    ];
    var VIEWPORTS = [[1920, 1080], [1600, 900], [1366, 768], [1280, 800], [1024, 768], [768, 1024], [390, 844]];

    // ------------------------------------------------------------------ state
    var info = null;            // { path, name, baseUri, stylesheets: [{ href, uri, path, text }] }
    var text = '', version = -1, parsed = null;
    var mode = 'empty';         // 'hmi' | 'flow' | 'empty'
    var page = null;            // HMI: the .hmi-page element node
    var sel = [];               // selected node ids; the first is the primary (alignment reference)
    var scopeId = null;         // HMI: the container being edited inside (double-click); null = the page
    var pendingSel = null;      // after an edit: { offsets: [...] } or { paths: [...] }
    var saved = vscode.getState() || {};
    var zoom = saved.zoom || null;
    var ds = { grid: 10, showGrid: true, snap: true, windowPreview: 'page', flowViewport: { w: 1280, h: 800 } };
    var frameHeadSig = null, frameLoaded = false, renderSeq = 0;
    var clipboard = null;
    var sheets = [];

    var saveTimer = null;
    function persist() {
        vscode.setState({ zoom: zoom });
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { vscode.postMessage({ type: 'saveDesignState', state: ds }); }, 300);
    }

    // ------------------------------------------------------------------ model helpers

    function nodeById(id) { return parsed && id !== null && id !== undefined ? parsed.nodes[id] || null : null; }
    function isEl(n) { return !!n && n.type === 'element'; }
    function elementChildren(n) { var out = []; R.eachChild(n, function (c) { if (c.type === 'element') out.push(c); }); return out; }
    function parentEl(n) { for (var p = n.parent; p; p = p.parent) if (p.type === 'element' || p.type === 'root') return p; return null; }
    function isInside(n, anc) { for (var p = n; p; p = p.parent) if (p === anc) return true; return false; }
    function lname(n) { return n.name.toLowerCase(); }
    function attr(n, name) { var a = R.findAttr(n, name); return a ? a.raw : null; }
    function hasClass(n, c) { var v = attr(n, 'class'); return !!v && (' ' + v.replace(/\s+/g, ' ') + ' ').indexOf(' ' + c + ' ') >= 0; }
    function findPage() {
        if (!parsed) return null;
        for (var i = 0; i < parsed.nodes.length; i++) { var n = parsed.nodes[i]; if (isEl(n) && hasClass(n, 'hmi-page')) return n; }
        return null;
    }
    function findTag(name) {
        for (var i = 0; parsed && i < parsed.nodes.length; i++) if (isEl(parsed.nodes[i]) && lname(parsed.nodes[i]) === name) return parsed.nodes[i];
        return null;
    }
    function nodePath(n) {
        var parts = [];
        for (var x = n; x && x.type === 'element'; x = parentEl(x)) { var p = parentEl(x); if (!p) break; parts.unshift(elementChildren(p).indexOf(x)); }
        return parts.join('/');
    }
    function byNodePath(p) {
        if (!parsed || p === null || p === undefined || p === '') return null;
        var n = parsed.root;
        var parts = String(p).split('/');
        for (var i = 0; i < parts.length; i++) { var k = elementChildren(n)[Number(parts[i])]; if (!k) return null; n = k; }
        return n;
    }
    function label(n) {
        if (!n) return '';
        if (n === page) return 'page';
        var id = attr(n, 'id'), cls = attr(n, 'class');
        var classes = cls ? cls.trim().split(/\s+/).filter(Boolean) : [];
        return '<' + n.name + '>' + (id ? '#' + id : '') + (classes.length ? '.' + classes.slice(0, 3).join('.') : '');
    }
    function lineOf(off) { var k = 1; for (var i = text.indexOf('\n'); i >= 0 && i < off; i = text.indexOf('\n', i + 1)) k++; return k; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function fileName(p) { return String(p).split(/[\\/]/).pop(); }

    // ------------------------------------------------------------------ inline style helpers

    function styleMap(n) {
        var m = {};
        R.parseStyle(attr(n, 'style') || '').forEach(function (d) { m[d.prop] = d.value; });
        return m;
    }
    function lenOf(v) {
        var m = /^\s*(-?[\d.]+)(px|%)?\s*$/.exec(v || '');
        return m ? { v: Number(m[1]), u: m[2] || 'px' } : null;
    }
    function px(v) { return Math.round(v) + 'px'; }
    function pct(v) { return Math.round(v * 100) / 100 + '%'; }
    function addLen(L, dpx, total) { return L.u === '%' ? pct(L.v + (total ? dpx / total * 100 : 0)) : px(L.v + dpx); }
    function styleEditable(n) { var s = attr(n, 'style'); return s === null || s.indexOf('{{') < 0; }
    function styleEdit(n, changes) {
        var ns = R.setStyleProps(attr(n, 'style') || '', changes);
        return R.setAttrEdit(text, n, 'style', ns ? ns : null);
    }
    /** A copy of an element's markup with its inline style changed (for copies, groups and pasting). */
    function markupWithStyle(markup, changes) {
        var p = R.parseRazor(markup, { html: true });
        var el = p.root.children.filter(isEl)[0];
        if (!el) return markup;
        var a = R.findAttr(el, 'style');
        var ns = R.setStyleProps(a ? a.raw : '', changes);
        var ed = R.setAttrEdit(markup, el, 'style', ns ? ns : null);
        return ed ? markup.substring(0, ed.offset) + ed.text + markup.substring(ed.offset + ed.length) : markup;
    }
    function uniqueIds(markup) {
        return markup.replace(/(\sid=")([^"]+)(")/g, function (m, a, id, b) {
            var n = id.replace(/-\d+$/, ''), k = 2;
            while (text.indexOf('id="' + n + '-' + k + '"') >= 0) k++;
            return a + n + '-' + k + b;
        });
    }

    // ------------------------------------------------------------------ document load

    function loadDocument(msg) {
        text = msg.text;
        version = msg.version;
        if (msg.info) info = msg.info;
        if (msg.designState) Object.keys(msg.designState).forEach(function (k) { ds[k] = msg.designState[k]; });
        var prevPaths = sel.map(function (id) { return nodePath(nodeById(id)); });
        var prevScope = scopeId !== null && nodeById(scopeId) ? nodePath(nodeById(scopeId)) : null;
        var np;
        try {
            np = R.parseRazor(text, { html: true });
        } catch (err) {
            var off = err && typeof err.offset === 'number' ? err.offset : 0;
            errorBanner.hidden = false;
            errorBanner.textContent = 'HTML error on line ' + lineOf(off) + ': ' + (err.message || err) + ' — the designer shows the last valid version. Click to go there.';
            errorBanner.onclick = function () { vscode.postMessage({ type: 'reveal', offset: off, end: off }); };
            return;
        }
        errorBanner.hidden = true;
        parsed = np;
        page = findPage();
        var newMode = !text.trim() ? 'empty' : page ? 'hmi' : 'flow';
        if (newMode !== mode) { frameHeadSig = null; zoom = null; }
        mode = newMode;
        document.body.className = 'mode-' + mode;
        sheets = (info.stylesheets || []).map(function (s) { return { info: s, rules: R.parseCss(s.text) }; });
        sel = [];
        if (pendingSel && pendingSel.offsets) {
            pendingSel.offsets.forEach(function (off) {
                for (var i = 0; i < parsed.nodes.length; i++) if (isEl(parsed.nodes[i]) && parsed.nodes[i].start === off) { sel.push(i); break; }
            });
        }
        if (!sel.length) {
            (pendingSel && pendingSel.paths || prevPaths).forEach(function (p) { var n = byNodePath(p); if (n && sel.indexOf(n.id) < 0) sel.push(n.id); });
        }
        pendingSel = null;
        var sc = prevScope !== null ? byNodePath(prevScope) : null;
        scopeId = sc && mode === 'hmi' && sc !== page && isInside(sc, page) ? sc.id : null;
        sel = sel.filter(function (id) { var n = nodeById(id); return n && (mode !== 'hmi' || n === page || isInside(n, page)); });
        render();
    }

    // ------------------------------------------------------------------ resources for the preview frame
    // VS Code serves project files to the designer page but not to frames inside it, so the page fetches them:
    // stylesheets are inlined (their url()s become blob: URLs) and images get blob: URLs.

    var blobCache = {};
    function fetchBlob(url) {
        if (!blobCache[url]) {
            blobCache[url] = fetch(url).then(function (r) { return r.ok ? r.blob() : null; })
                .then(function (b) { return b ? URL.createObjectURL(b) : null; }).catch(function () { return null; });
        }
        return blobCache[url];
    }
    function absUrl(u, base) { try { return new URL(u, base).href; } catch (e) { return null; } }
    function isLocalResource(u) {
        return !!u && !/^(data:|blob:|about:|javascript:|#)/i.test(u) && (/^(https:\/\/file(\+|%2B)|vscode-(webview-)?resource:|file:)/i.test(u) || (info && u.indexOf(info.baseUri) === 0));
    }
    var cssCache = {};
    function inlineCss(css, cssUrl) {
        var key = cssUrl + '\u0000' + css.length + '\u0000' + css.slice(0, 200) + css.slice(-100);
        if (cssCache[key]) return cssCache[key];
        var urls = {};
        css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, u) { var a = absUrl(u.trim(), cssUrl); if (isLocalResource(a)) urls[u] = a; return m; });
        var keys = Object.keys(urls);
        cssCache[key] = Promise.all(keys.map(function (k) { return fetchBlob(urls[k]); })).then(function (blobs) {
            var map = {};
            keys.forEach(function (k, i) { if (blobs[i]) map[k] = blobs[i]; });
            return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, u) { return map[u] ? 'url("' + map[u] + '")' : m; });
        });
        return cssCache[key];
    }
    function styleTag(css, attrs) { return '<style' + (attrs || '') + '>' + css.replace(/<\/style/gi, '<\\/style') + '</style>'; }

    function fixResources(d) {
        var jobs = [];
        Array.prototype.forEach.call(d.images, function (img) {
            var raw = img.getAttribute('src');
            var a = raw ? absUrl(raw, info.baseUri) : null;
            if (!isLocalResource(a)) return;
            jobs.push(fetchBlob(a).then(function (b) {
                if (!b) return null;
                return new Promise(function (res) { img.onload = img.onerror = function () { res(); }; img.src = b; });
            }));
        });
        Array.prototype.forEach.call(d.querySelectorAll('[style*="url("]'), function (el) {
            var st = el.getAttribute('style');
            jobs.push(inlineCss(st, info.baseUri).then(function (ns) { if (ns !== st) el.setAttribute('style', ns); }));
        });
        return Promise.all(jobs);
    }

    var DESIGN_CSS = '*{pointer-events:auto!important;cursor:default!important;-webkit-user-select:none!important;user-select:none!important;caret-color:transparent!important}' +
        'html.rz-outlines [data-rz]{outline:1px dashed rgba(0,122,204,.55)!important;outline-offset:-1px}' +
        'html.rz-editing [contenteditable]{-webkit-user-select:text!important;user-select:text!important;caret-color:auto!important;cursor:text!important;outline:2px solid #1e90ff!important}';

    /** The frame document: local stylesheet links and style blocks inlined, base URL set, scripts already removed. */
    function buildDocument(html) {
        var links = [];
        html.replace(/<link\b[^>]*>/gi, function (tag) { if (/\brel\s*=\s*["']?stylesheet/i.test(tag)) links.push(tag); return tag; });
        var styles = [];
        html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, function (m, a, css) { styles.push({ tag: m, attrs: a, css: css }); return m; });
        return Promise.all([
            Promise.all(links.map(function (tag) {
                var h = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
                var a = h ? absUrl(h[1] || h[2] || h[3], info.baseUri) : null;
                if (!isLocalResource(a)) return null;
                return fetch(a).then(function (r) { return r.ok ? r.text() : null; })
                    .then(function (t) { return t === null ? null : inlineCss(t, a).then(function (c) { return styleTag(c); }); }).catch(function () { return null; });
            })),
            Promise.all(styles.map(function (s) { return inlineCss(s.css, info.baseUri).then(function (c) { return styleTag(c, s.attrs); }); })),
        ]).then(function (res) {
            links.forEach(function (tag, i) { if (res[0][i]) html = html.replace(tag, res[0][i]); });
            styles.forEach(function (s, i) { html = html.replace(s.tag, res[1][i]); });
            var extra = '<base href="' + esc(info.baseUri) + '"><style id="rz-design">' + DESIGN_CSS + '</style>';
            if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, '<head$1>' + extra);
            else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html([^>]*)>/i, '<html$1><head>' + extra + '</head>');
            else html = '<html><head>' + extra + '</head><body>' + html + '</body></html>';
            return '<!DOCTYPE html>' + html.replace(/^\s*<!DOCTYPE[^>]*>/i, '');
        });
    }

    // ------------------------------------------------------------------ rendering

    function render() {
        updateToolbar();
        if (mode === 'empty') {
            $('startScreen').hidden = false;
            stage.hidden = true;
            clearOverlay();
            return;
        }
        $('startScreen').hidden = true;
        stage.hidden = false;
        var seq = ++renderSeq;
        var t0 = performance.now();
        var project = { files: [{ path: info.path, name: 'page', parsed: parsed, scopeAttr: null }], byName: {} };
        var html = R.render(project, 0, { conds: {}, cases: {}, loops: 1, placeholders: false }, { html: true }).html;
        var head = /<head[\s\S]*?<\/head>/i.exec(html);
        var htmlTag = /<html[^>]*>/i.exec(html);
        var sig = (htmlTag ? htmlTag[0] : '') + (head ? head[0] : '') + sheets.map(function (sh) { return sh.info.text; }).join('\u0000');
        var d = frame.contentDocument;
        var done = function (doc) {
            if (seq !== renderSeq) return;
            doc.documentElement.classList.toggle('rz-outlines', $('chkOutlines').checked);
            applyWindowPreview(doc);
            fixResources(doc).then(function () {
                if (seq !== renderSeq) return;
                applyWindowPreview(doc);
                updateOverlay();
                reportRendered(doc, t0);
            });
            updateStage();
            updateOverlay();
        };
        if (frameLoaded && sig === frameHeadSig && d && d.body) {
            // Same head: swap the body only (no reload, no flicker).
            var nd = new DOMParser().parseFromString(/<body[\s>]/i.test(html) ? html : '<body>' + html + '</body>', 'text/html');
            d.documentElement.replaceChild(d.importNode(nd.body, true), d.body);
            done(d);
        } else {
            frameHeadSig = sig;
            frameLoaded = false;
            buildDocument(html).then(function (doc) {
                if (seq !== renderSeq) return;
                frame.onload = function () { frame.onload = null; frameLoaded = true; done(frame.contentDocument); };
                frame.srcdoc = doc;
            });
        }
        renderTree();
        renderProps();
        updateBreadcrumb();
    }

    function reportRendered(doc, t0) {
        var pg = doc.querySelector('.hmi-page');
        statusEl.textContent = (info ? info.name : '') + ' · ' + (mode === 'hmi' ? 'fixed page ' + pageSize().w + ' × ' + pageSize().h : 'flow page') + ' · rendered in ' + Math.round(performance.now() - t0) + ' ms';
        var imgs = Array.prototype.slice.call(doc.images).filter(function (i) { return i.getAttribute('src'); });
        vscode.postMessage({
            type: 'rendered', mode: mode, elements: doc.querySelectorAll('[data-rz]').length,
            imagesLoaded: imgs.filter(function (i) { return i.naturalWidth > 0; }).length, images: imgs.length,
            page: pg ? { w: pg.offsetWidth, h: pg.offsetHeight, transform: pg.style.transform || '' } : null,
            probe: probeStyle(doc),
        });
    }
    function probeStyle(doc) {
        // One computed value that only the page's own CSS sets, for the tests.
        var e = doc.querySelector('[data-probe]') || doc.body;
        return e ? getComputedStyle(e).getPropertyValue(e.getAttribute('data-probe') || 'font-family') : null;
    }

    function fdoc() { return frame.contentDocument; }
    function domFor(id) { var d = fdoc(); return d ? d.querySelector('[data-rz="0:' + id + '"]') : null; }
    function nodeOfDom(el) {
        for (var e = el; e && e.getAttribute; e = e.parentElement) {
            var a = e.getAttribute('data-rz');
            if (a) return nodeById(Number(a.split(':')[1]));
        }
        return null;
    }
    function getCS(dom) { return dom.ownerDocument.defaultView.getComputedStyle(dom); }

    // ------------------------------------------------------------------ page size, window preview, zoom

    function pageSize() {
        if (!page) return { w: 0, h: 0 };
        var st = styleMap(page);
        var w = lenOf(st.width), h = lenOf(st.height);
        return { w: w && w.u === 'px' ? w.v : 1920, h: h && h.u === 'px' ? h.v : 1080 };
    }
    function windowSize() {
        if (mode === 'hmi') {
            if (ds.windowPreview && ds.windowPreview !== 'page') { var p = ds.windowPreview.split('x').map(Number); if (p[0] > 0 && p[1] > 0) return { w: p[0], h: p[1] }; }
            return pageSize();
        }
        return { w: ds.flowViewport.w, h: ds.flowViewport.h };
    }
    function scaleMode() { return page ? attr(page, 'data-scale') || 'fit' : 'fit'; }

    /** What the page's scale script does, done on the design frame: the page scaled into the window. */
    function applyWindowPreview(d) {
        var pg = d.querySelector('.hmi-page');
        if (!pg || !d.body) return;
        var mode2 = pg.getAttribute('data-scale') || 'fit';
        pg.style.transform = 'none';
        var w = pg.offsetWidth, h = pg.offsetHeight;
        d.body.style.overflowX = mode2 === 'height' || mode2 === 'none' ? 'auto' : 'hidden';
        d.body.style.overflowY = mode2 === 'width' || mode2 === 'none' ? 'auto' : 'hidden';
        var vw = d.documentElement.clientWidth, vh = d.documentElement.clientHeight;
        if (!w || !h || !vw || !vh) return;
        var sx = vw / w, sy = vh / h, x = 0, y = 0;
        if (mode2 === 'none') sx = sy = 1;
        else if (mode2 === 'width') sy = sx;
        else if (mode2 === 'height') sx = sy;
        else if (mode2 === 'fit') { sx = sy = Math.min(sx, sy); x = (vw - w * sx) / 2; y = (vh - h * sy) / 2; }
        pg.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')';
    }

    function updateStage() {
        var ws = windowSize();
        frame.style.width = ws.w + 'px';
        frame.style.height = ws.h + 'px';
        if (!zoom) fit();
        frame.style.transform = 'scale(' + zoom + ')';
        stage.style.width = Math.ceil(ws.w * zoom) + 'px';
        stage.style.height = Math.ceil(ws.h * zoom) + 'px';
        glass.style.width = (stage.offsetLeft + stage.offsetWidth + 40) + 'px';
        glass.style.height = (stage.offsetTop + stage.offsetHeight + 40) + 'px';
        $('zoomBadge').textContent = Math.round(zoom * 100) + '%';
    }
    function fit() {
        var ws = windowSize();
        if (!ws.w || !ws.h) { zoom = 1; return; }
        zoom = Math.max(0.05, Math.min(1, Math.min((wrapper.clientWidth - 60) / ws.w, (wrapper.clientHeight - 60) / ws.h)));
        persist();
    }
    function setZoom(z) {
        zoom = Math.max(0.05, Math.min(4, z));
        var d = fdoc();
        updateStage();
        if (d) applyWindowPreview(d);
        updateOverlay();
        persist();
    }

    // ------------------------------------------------------------------ geometry (frame coordinates → wrapper)

    function frameToWrapper(r) {
        var fr = frame.getBoundingClientRect(), w = wrapper.getBoundingClientRect();
        return { x: fr.left - w.left + wrapper.scrollLeft + r.left * zoom, y: fr.top - w.top + wrapper.scrollTop + r.top * zoom, w: r.width * zoom, h: r.height * zoom };
    }
    function framePoint(x, y) { var fr = frame.getBoundingClientRect(); return { x: (x - fr.left) / zoom, y: (y - fr.top) / zoom }; }
    function place(el, r) { el.style.display = 'block'; el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; }

    /** A container's coordinate system for its absolutely positioned children (its padding box), in frame px. */
    function containerInfo(pdom) {
        var r = pdom.getBoundingClientRect();
        var s = pdom.offsetWidth ? r.width / pdom.offsetWidth : 1;
        return { dom: pdom, s: s, ox: r.left + pdom.clientLeft * s, oy: r.top + pdom.clientTop * s, w: pdom.clientWidth, h: pdom.clientHeight };
    }
    function boxIn(dom, ci) {
        var r = dom.getBoundingClientRect();
        return { x: (r.left - ci.ox) / ci.s, y: (r.top - ci.oy) / ci.s, w: r.width / ci.s, h: r.height / ci.s };
    }
    function containerDomFor(n) {
        var dom = domFor(n.id);
        if (!dom) return null;
        var p = parentEl(n);
        var pd = p && p.type === 'element' ? domFor(p.id) : null;
        var st = getCS(dom);
        if (st.position === 'absolute' && dom.offsetParent) return dom.offsetParent;
        return pd || dom.parentElement;
    }
    /** Everything the move/resize code needs about one element. */
    function itemFor(id) {
        var n = nodeById(id), dom = n && domFor(id);
        if (!dom) return null;
        var cdom = containerDomFor(n);
        if (!cdom) return null;
        var ci = containerInfo(cdom);
        var cs = getCS(dom);
        return { id: id, n: n, dom: dom, ci: ci, box: boxIn(dom, ci), st: styleMap(n), cssW: parseFloat(cs.width) || 0, cssH: parseFloat(cs.height) || 0, origStyle: dom.getAttribute('style') };
    }
    function isLocked(n) { return !!n && R.findAttr(n, 'data-locked') !== null && attr(n, 'data-locked') !== 'false'; }

    // ------------------------------------------------------------------ overlay

    function clearOverlay() {
        selBox.style.display = 'none';
        hoverBox.style.display = 'none';
        gridLayer.style.display = 'none';
        guidesEl.innerHTML = '';
        overlay.querySelectorAll('.sel-copy').forEach(function (x) { x.remove(); });
    }

    function updateOverlay() {
        selBox.style.display = 'none';
        overlay.querySelectorAll('.sel-copy').forEach(function (x) { x.remove(); });
        drawGrid();
        drawScope();
        if (!parsed) return;
        sel.forEach(function (id, i) {
            var dom = domFor(id);
            if (!dom) return;
            var r = frameToWrapper(dom.getBoundingClientRect());
            if (i === 0) {
                place(selBox, r);
                var n = nodeById(id);
                selLabel.textContent = (isLocked(n) ? '🔒 ' : '') + label(n) + (sel.length > 1 ? '  +' + (sel.length - 1) : '');
                selBox.classList.toggle('locked', isLocked(n));
                selBox.querySelectorAll('.handle').forEach(function (h) { h.remove(); });
                if (sel.length === 1 && canResize(n)) {
                    var small = r.w < 36 || r.h < 36;
                    var hs = small ? [['se', 100, 100]] : [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]];
                    hs.forEach(function (h) {
                        var hd = document.createElement('div');
                        hd.className = 'handle'; hd.dataset.h = h[0]; hd.style.left = h[1] + '%'; hd.style.top = h[2] + '%';
                        if (small) hd.style.margin = '2px 0 0 2px';
                        selBox.appendChild(hd);
                    });
                }
            } else {
                var c = document.createElement('div');
                c.className = 'sel-box sel-copy';
                place(c, r);
                overlay.appendChild(c);
            }
        });
    }
    function canResize(n) {
        if (!n || isLocked(n) || n === page) return false;
        var l = lname(n);
        return !/^(html|head|body)$/.test(l);
    }
    function drawGrid() {
        if (mode !== 'hmi' || !ds.showGrid || !page) { gridLayer.style.display = 'none'; return; }
        var pd = domFor(page.id);
        if (!pd) { gridLayer.style.display = 'none'; return; }
        var ci = containerInfo(pd);
        var pr = pd.getBoundingClientRect();
        // Only the part of the page inside the window is visible (the page may be larger, e.g. "Fit width").
        var ws = windowSize();
        var cl = { left: Math.max(0, pr.left), top: Math.max(0, pr.top), right: Math.min(ws.w, pr.right), bottom: Math.min(ws.h, pr.bottom) };
        if (cl.right <= cl.left || cl.bottom <= cl.top) { gridLayer.style.display = 'none'; return; }
        place(gridLayer, frameToWrapper({ left: cl.left, top: cl.top, width: cl.right - cl.left, height: cl.bottom - cl.top }));
        var g = Math.max(2, ds.grid) * ci.s * zoom;
        gridLayer.style.backgroundSize = g + 'px ' + g + 'px';
        gridLayer.style.backgroundPosition = ((ci.ox - cl.left) * zoom) + 'px ' + ((ci.oy - cl.top) * zoom) + 'px';
        gridLayer.style.opacity = g < 5 ? '0' : '';
    }
    var scopeFrame = null;
    function drawScope() {
        if (!scopeFrame) { scopeFrame = document.createElement('div'); scopeFrame.className = 'scope-box'; overlay.insertBefore(scopeFrame, overlay.firstChild); }
        var n = mode === 'hmi' && scopeId !== null ? nodeById(scopeId) : null;
        var dom = n && domFor(n.id);
        if (!dom) { scopeFrame.style.display = 'none'; return; }
        place(scopeFrame, frameToWrapper(dom.getBoundingClientRect()));
        scopeFrame.title = 'Editing inside ' + label(n) + ' (Esc to leave)';
    }
    function showGuides(list) {
        guidesEl.innerHTML = '';
        (list || []).forEach(function (g) {
            var el = document.createElement('div');
            el.className = 'guide';
            place(el, frameToWrapper(g));
            if (g.width === 0) el.style.width = '1px';
            if (g.height === 0) el.style.height = '1px';
            guidesEl.appendChild(el);
        });
    }

    // ------------------------------------------------------------------ selection

    function scopeNode() { return mode === 'hmi' ? (scopeId !== null && nodeById(scopeId)) || page : null; }

    function select(ids, opts) {
        opts = opts || {};
        sel = ids.filter(function (id, i) { return id !== null && ids.indexOf(id) === i && nodeById(id); });
        updateOverlay();
        renderTree();
        renderProps();
        updateBreadcrumb();
        updateToolbar();
        if (sel.length && !opts.fromText) {
            var n = nodeById(sel[0]);
            vscode.postMessage({ type: 'reveal', offset: n.start, end: n.tagEnd });
        }
        if (opts.scroll && sel.length) scrollIntoView(sel[0]);
    }
    function scrollIntoView(id) {
        var dom = domFor(id);
        if (!dom) return;
        var r = frameToWrapper(dom.getBoundingClientRect());
        var vw = wrapper.clientWidth, vh = wrapper.clientHeight;
        if (r.x < wrapper.scrollLeft || r.x + Math.min(r.w, vw) > wrapper.scrollLeft + vw) wrapper.scrollLeft = r.x - Math.max(20, (vw - r.w) / 2);
        if (r.y < wrapper.scrollTop || r.y + Math.min(r.h, vh) > wrapper.scrollTop + vh) wrapper.scrollTop = r.y - Math.max(20, (vh - r.h) / 2);
    }
    /** Selecting from the outline: the element's container becomes the editing scope. */
    function selectNode(n, opts) {
        if (mode === 'hmi' && n !== page && isInside(n, page)) {
            var p = parentEl(n);
            scopeId = p === page ? null : p.id;
        }
        select([n.id], opts);
    }

    // ------------------------------------------------------------------ picking

    /** HMI: the element of the current scope under the point, the scope itself ({ scope }), or null outside the page. */
    function pickHmi(x, y, deep) {
        var d = fdoc();
        if (!d || !page) return null;
        var fp = framePoint(x, y);
        var list = d.elementsFromPoint(fp.x, fp.y);
        var sc = scopeNode();
        for (var i = 0; i < list.length; i++) {
            var n = nodeOfDom(list[i]);
            if (!n || !(n === page || isInside(n, page))) continue;
            if (deep && n !== page) return { id: n.id, deep: true };
            for (var a = n; a && a.type === 'element'; a = parentEl(a)) {
                if (a === sc) return { scope: true };
                if (parentEl(a) === sc) return { id: a.id };
            }
            return { outside: true };
        }
        return null;
    }
    function pickFlow(x, y) {
        var d = fdoc();
        if (!d) return [];
        var fp = framePoint(x, y);
        var out = [];
        d.elementsFromPoint(fp.x, fp.y).forEach(function (el) {
            var n = nodeOfDom(el);
            if (n && out.indexOf(n.id) < 0 && !/^(html)$/i.test(n.name)) out.push(n.id);
        });
        return out;
    }

    // ------------------------------------------------------------------ edits

    function mergeEdits(edits) {
        edits = edits.filter(Boolean).sort(function (a, b) { return a.offset - b.offset || a.length - b.length; });
        var out = [];
        edits.forEach(function (e) {
            var last = out[out.length - 1];
            if (last && last.offset === e.offset && last.length === 0 && e.length === 0) last.text += e.text;
            else out.push({ offset: e.offset, length: e.length, text: e.text });
        });
        return out;
    }
    function shiftOffset(off, edits) {
        var delta = 0;
        edits.forEach(function (e) { if (e.offset + e.length <= off && !(e.length === 0 && e.offset === off)) delta += e.text.length - e.length; });
        return off + delta;
    }
    function send(edits, selectAfter) {
        edits = mergeEdits(edits);
        if (!edits.length) return;
        pendingSel = selectAfter || { offsets: sel.map(function (id) { return shiftOffset(nodeById(id).start, edits); }), paths: sel.map(function (id) { return nodePath(nodeById(id)); }) };
        vscode.postMessage({ type: 'edit', edits: edits, version: version });
    }
    function setAttr(n, name, value) { send([R.setAttrEdit(text, n, name, value)]); }
    function setStyle(n, changes) {
        if (!styleEditable(n)) { statusEl.textContent = 'The style attribute of this element cannot be edited here'; return; }
        send([styleEdit(n, changes)]);
    }
    function detectUnit() { return /\n\t+</.test(text) ? '\t' : '    '; }
    function nl() { return text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'; }
    function topmost(ids) {
        // Drop selected elements that are inside other selected elements.
        return ids.filter(function (id) { var n = nodeById(id); return !ids.some(function (o) { return o !== id && isInside(n, nodeById(o)) && nodeById(o) !== n; }); });
    }

    // ------------------------------------------------------------------ move / resize (fixed page)

    /** Style changes that move an element by (dx, dy) px of its container, keeping its units and anchors. */
    function moveChanges(it, dx, dy) {
        var st = it.st, ch = {};
        if (!/absolute|fixed/.test(st.position || getCS(it.dom).position)) {
            // Not placed yet (e.g. pasted flow content): pin it where it is, then move it.
            ch.position = 'absolute';
            ch.left = px(it.box.x + dx);
            ch.top = px(it.box.y + dy);
            if (!st.width) ch.width = px(it.box.w);
            if (!st.height) ch.height = px(it.box.h);
            ch.margin = '0';
            return ch;
        }
        var axis = function (near, far, size, d, total, cur) {
            if (!d) return;
            var N = lenOf(st[near]), F = lenOf(st[far]);
            if (N && F && !lenOf(st[size])) { ch[near] = addLen(N, d, total); ch[far] = addLen(F, -d, total); } // stretched: both edges move
            else if (N) ch[near] = addLen(N, d, total);   // anchored near (a far value is ignored by CSS when the size is set)
            else if (F) ch[far] = addLen(F, -d, total);   // anchored to the far edge
            else ch[near] = px(cur + d);
        };
        axis('left', 'right', 'width', dx, it.ci.w, it.box.x);
        axis('top', 'bottom', 'height', dy, it.ci.h, it.box.y);
        return ch;
    }
    /** Style changes that give an element the box nb (px of its container), keeping its units and anchors. */
    function resizeChanges(it, nb) {
        var st = it.st, ob = it.box, ch = {};
        var axis = function (near, far, size, obN, obS, nbN, nbS, total, cssSize) {
            var dN = nbN - obN, dS = nbS - obS, dF = (nbN + nbS) - (obN + obS);
            if (!dN && !dS) return;
            var N = lenOf(st[near]), F = lenOf(st[far]), S = lenOf(st[size]);
            if (N && F && !S) {
                if (dN) ch[near] = addLen(N, dN, total);
                if (dF) ch[far] = addLen(F, -dF, total);
                return;
            }
            if (dS) ch[size] = S ? addLen(S, dS, total) : px(cssSize + dS);
            if (F && !N) { if (dF) ch[far] = addLen(F, -dF, total); }
            else if (dN) ch[near] = N ? addLen(N, dN, total) : px(obN + dN);
        };
        axis('left', 'right', 'width', ob.x, ob.w, nb.x, nb.w, it.ci.w, it.cssW);
        axis('top', 'bottom', 'height', ob.y, ob.h, nb.y, nb.h, it.ci.h, it.cssH);
        return ch;
    }
    function previewStyle(it, ch) {
        it.dom.setAttribute('style', it.origStyle || '');
        Object.keys(ch).forEach(function (k) { if (ch[k] === null) it.dom.style.removeProperty(k); else it.dom.style.setProperty(k, ch[k]); });
    }

    /** Snap lines of a container: its edges and centre, and the edges and centres of its other children. */
    function snapLines(ci, containerNode, exclude) {
        var xs = [{ v: 0 }, { v: ci.w / 2 }, { v: ci.w }], ys = [{ v: 0 }, { v: ci.h / 2 }, { v: ci.h }];
        xs.forEach(function (l) { l.span = [0, ci.h]; });
        ys.forEach(function (l) { l.span = [0, ci.w]; });
        elementChildren(containerNode).forEach(function (c) {
            if (exclude.indexOf(c.id) >= 0) return;
            var dom = domFor(c.id);
            if (!dom || !dom.getClientRects().length) return;
            var b = boxIn(dom, ci);
            [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (v) { xs.push({ v: v, span: [b.y, b.y + b.h] }); });
            [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (v) { ys.push({ v: v, span: [b.x, b.x + b.w] }); });
        });
        return { xs: xs, ys: ys };
    }
    function snapTo(points, lines, threshold) {
        var best = null;
        points.forEach(function (p) {
            lines.forEach(function (l) {
                var d = l.v - p;
                if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, line: l };
            });
        });
        return best;
    }
    function gridSnap(v) { var g = Math.max(2, ds.grid); return Math.round(v / g) * g - v; }
    function guideRects(ci, sx, sy, box) {
        var out = [];
        if (sx) {
            var y1 = Math.min(sx.line.span[0], box.y), y2 = Math.max(sx.line.span[1], box.y + box.h);
            out.push({ left: ci.ox + sx.line.v * ci.s, top: ci.oy + y1 * ci.s, width: 0, height: (y2 - y1) * ci.s });
        }
        if (sy) {
            var x1 = Math.min(sy.line.span[0], box.x), x2 = Math.max(sy.line.span[1], box.x + box.w);
            out.push({ left: ci.ox + x1 * ci.s, top: ci.oy + sy.line.v * ci.s, width: (x2 - x1) * ci.s, height: 0 });
        }
        return out;
    }

    // ------------------------------------------------------------------ mouse

    var drag = null;
    var spaceDown = false;

    glass.addEventListener('mousedown', function (ev) {
        if (!parsed || mode === 'empty') return;
        wrapper.focus({ preventScroll: true });
        if (ev.button === 1 || (ev.button === 0 && spaceDown)) {
            ev.preventDefault();
            drag = { mode: 'pan', x: ev.clientX, y: ev.clientY, sl: wrapper.scrollLeft, st: wrapper.scrollTop };
            return;
        }
        if (ev.button !== 0) return;
        ev.preventDefault();
        if (mode === 'hmi') return hmiMouseDown(ev);
        return flowMouseDown(ev);
    });

    function hmiMouseDown(ev) {
        var additive = ev.ctrlKey || ev.metaKey || ev.shiftKey;
        var hit = pickHmi(ev.clientX, ev.clientY, false);
        if (hit && hit.outside) { scopeId = null; hit = pickHmi(ev.clientX, ev.clientY, false); if (hit && hit.outside) hit = null; }
        if (!hit || hit.scope) {
            if (!additive) select([]);
            drag = { mode: 'marquee', x: ev.clientX, y: ev.clientY, additive: additive, base: sel.slice() };
            return;
        }
        var id = hit.id;
        var toggleOnUp = false, collapseOnUp = null, addOnUp = null;
        var ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && sel.indexOf(id) < 0) {
            // Ctrl on an unselected element: a drag copies just it, a click adds it to the selection.
            addOnUp = id;
        } else if (additive) {
            if (sel.indexOf(id) < 0) select(sel.concat([id]));
            else toggleOnUp = true;
        } else if (sel.indexOf(id) < 0) {
            select([id]);
        } else if (sel.length > 1) {
            // Part of a multi-selection: a drag moves them all, a click selects just this one.
            collapseOnUp = id;
        }
        var items = (addOnUp !== null ? [id] : sel).map(itemFor).filter(Boolean);
        drag = { mode: 'maybe', x: ev.clientX, y: ev.clientY, items: items, copy: ctrl, toggle: toggleOnUp ? id : null, collapse: collapseOnUp, add: addOnUp };
    }

    function flowMouseDown(ev) {
        var ids = pickFlow(ev.clientX, ev.clientY);
        if (!ids.length) { select([]); return; }
        var id = ids[0];
        if ((ev.ctrlKey || ev.metaKey) && sel.length) { var k = ids.indexOf(sel[0]); id = ids[(k + 1) % ids.length]; }
        if (ev.altKey) { var p = parentEl(nodeById(id)); if (p && p.type === 'element') id = p.id; }
        // Pressing inside the selected element keeps it (a drag moves it); a click without dragging selects the inner one.
        var drillOnUp = null;
        if (!ev.altKey && !ev.ctrlKey && !ev.metaKey && sel.length === 1 && sel[0] !== id && isInside(nodeById(id), nodeById(sel[0]))) { drillOnUp = id; id = sel[0]; }
        if (sel[0] !== id || sel.length !== 1) select([id]);
        var n = nodeById(id);
        var dom = domFor(id);
        var pos = dom && getCS(dom).position;
        drag = { mode: 'maybe', x: ev.clientX, y: ev.clientY, flowNode: n, dom: dom, absolute: pos === 'absolute' || pos === 'fixed', items: [itemFor(id)].filter(Boolean), drill: drillOnUp };
    }

    selBox.addEventListener('mousedown', function (ev) {
        var h = ev.target.closest('.handle');
        if (!h || sel.length !== 1) return;
        ev.preventDefault();
        ev.stopPropagation();
        var it = itemFor(sel[0]);
        if (!it) return;
        drag = { mode: 'resize', h: h.dataset.h, x: ev.clientX, y: ev.clientY, it: it };
    });

    document.addEventListener('mousemove', function (ev) {
        if (!drag) { scheduleHover(ev); return; }
        if (drag.mode === 'pan') { wrapper.scrollLeft = drag.sl - (ev.clientX - drag.x); wrapper.scrollTop = drag.st - (ev.clientY - drag.y); updateOverlay(); return; }
        if (drag.mode === 'marquee') { drawMarquee(ev); return; }
        if (drag.mode === 'maybe') {
            if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 4) return;
            if (drag.items.some(function (it) { return isLocked(it.n); })) { statusEl.textContent = 'Locked: unlock it (Ctrl+L) to move it'; drag = null; return; }
            drag.mode = mode === 'hmi' || drag.absolute ? 'move' : 'reorder';
            drag.toggle = null;
        }
        if (drag.mode === 'move') return dragMove(ev);
        if (drag.mode === 'resize') return dragResize(ev);
        if (drag.mode === 'reorder') {
            drag.drop = dropTarget(ev.clientX, ev.clientY, drag.flowNode);
            showDrop(drag.drop);
            if (drag.dom) drag.dom.style.opacity = '0.4';
        }
    });

    function dragMove(ev) {
        var it0 = drag.items[0];
        if (!it0) return;
        var s = it0.ci.s * zoom;
        var dx = (ev.clientX - drag.x) / s, dy = (ev.clientY - drag.y) / s;
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        var sameContainer = drag.items.every(function (it) { return it.ci.dom === it0.ci.dom; });
        var guides = [];
        if (ds.snap && !ev.altKey && sameContainer) {
            var bb = union(drag.items.map(function (it) { return it.box; }));
            var cont = nodeOfDom(it0.ci.dom) || page;
            var lines = drag.lines || (drag.lines = snapLines(it0.ci, cont, drag.items.map(function (it) { return it.id; })));
            var th = 6 / s;
            var sx = snapTo([bb.x + dx, bb.x + bb.w / 2 + dx, bb.x + bb.w + dx], lines.xs, th);
            var sy = snapTo([bb.y + dy, bb.y + bb.h / 2 + dy, bb.y + bb.h + dy], lines.ys, th);
            if (sx) dx += sx.d; else if (ds.showGrid && !ev.shiftKey) dx += gridSnap(bb.x + dx);
            if (sy) dy += sy.d; else if (ds.showGrid && !ev.shiftKey) dy += gridSnap(bb.y + dy);
            guides = guideRects(it0.ci, sx, sy, { x: bb.x + dx, y: bb.y + dy, w: bb.w, h: bb.h });
        }
        dx = Math.round(dx); dy = Math.round(dy);
        drag.dx = dx; drag.dy = dy;
        drag.items.forEach(function (it) { previewStyle(it, moveChanges(it, dx, dy)); });
        showGuides(guides);
        $('coords').textContent = (drag.copy ? 'copy ' : '') + 'x ' + Math.round(it0.box.x + dx) + ', y ' + Math.round(it0.box.y + dy) + '   (Δ ' + dx + ', ' + dy + ')';
        updateOverlay();
    }

    function dragResize(ev) {
        var it = drag.it, h = drag.h, s = it.ci.s * zoom;
        var dx = (ev.clientX - drag.x) / s, dy = (ev.clientY - drag.y) / s;
        var b = it.box, nb = { x: b.x, y: b.y, w: b.w, h: b.h };
        var guides = [];
        var lines = ds.snap && !ev.altKey ? (drag.lines || (drag.lines = snapLines(it.ci, nodeOfDom(it.ci.dom) || page, [it.id]))) : null;
        var th = 6 / s;
        var snapEdge = function (v, xs) {
            if (!lines) return v;
            var sn = snapTo([v], xs ? lines.xs : lines.ys, th);
            if (sn) { guides.push(xs ? { left: it.ci.ox + sn.line.v * it.ci.s, top: it.ci.oy + Math.min(sn.line.span[0], nb.y) * it.ci.s, width: 0, height: (Math.max(sn.line.span[1], nb.y + nb.h) - Math.min(sn.line.span[0], nb.y)) * it.ci.s } :
                { left: it.ci.ox + Math.min(sn.line.span[0], nb.x) * it.ci.s, top: it.ci.oy + sn.line.v * it.ci.s, width: (Math.max(sn.line.span[1], nb.x + nb.w) - Math.min(sn.line.span[0], nb.x)) * it.ci.s, height: 0 }); return v + sn.d; }
            return ds.showGrid ? v + gridSnap(v) : v;
        };
        if (h.indexOf('e') >= 0) { var r = snapEdge(b.x + b.w + dx, true); nb.w = Math.max(1, r - b.x); }
        if (h.indexOf('w') >= 0) { var l = snapEdge(b.x + dx, true); l = Math.min(l, b.x + b.w - 1); nb.x = l; nb.w = b.x + b.w - l; }
        if (h.indexOf('s') >= 0) { var bt = snapEdge(b.y + b.h + dy, false); nb.h = Math.max(1, bt - b.y); }
        if (h.indexOf('n') >= 0) { var tp = snapEdge(b.y + dy, false); tp = Math.min(tp, b.y + b.h - 1); nb.y = tp; nb.h = b.y + b.h - tp; }
        if (ev.shiftKey && h.length === 2 && b.w > 0 && b.h > 0) {
            // Keep the aspect ratio (corner handles).
            var ratio = b.w / b.h;
            if (nb.w / nb.h > ratio) nb.w = nb.h * ratio; else nb.h = nb.w / ratio;
            if (h.indexOf('w') >= 0) nb.x = b.x + b.w - nb.w;
            if (h.indexOf('n') >= 0) nb.y = b.y + b.h - nb.h;
        }
        nb = { x: Math.round(nb.x), y: Math.round(nb.y), w: Math.round(nb.w), h: Math.round(nb.h) };
        drag.nb = nb;
        previewStyle(it, resizeChanges(it, nb));
        showGuides(guides);
        $('coords').textContent = nb.w + ' × ' + nb.h + '   at ' + nb.x + ', ' + nb.y;
        updateOverlay();
    }

    function union(boxes) {
        var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        boxes.forEach(function (b) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); });
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }

    function drawMarquee(ev) {
        var w = wrapper.getBoundingClientRect();
        var x1 = Math.min(drag.x, ev.clientX), y1 = Math.min(drag.y, ev.clientY), x2 = Math.max(drag.x, ev.clientX), y2 = Math.max(drag.y, ev.clientY);
        drag.rect = { x1: x1, y1: y1, x2: x2, y2: y2, enclosed: ev.altKey };
        if (x2 - x1 < 3 && y2 - y1 < 3) { marqueeEl.style.display = 'none'; return; }
        place(marqueeEl, { x: x1 - w.left + wrapper.scrollLeft, y: y1 - w.top + wrapper.scrollTop, w: x2 - x1, h: y2 - y1 });
    }
    function finishMarquee(md) {
        marqueeEl.style.display = 'none';
        var r = md.rect;
        if (!r || (r.x2 - r.x1 < 3 && r.y2 - r.y1 < 3) || mode !== 'hmi') return;
        var a = framePoint(r.x1, r.y1), b = framePoint(r.x2, r.y2);
        var picked = [];
        elementChildren(scopeNode()).forEach(function (c) {
            var dom = domFor(c.id);
            if (!dom || !dom.getClientRects().length) return;
            var e = dom.getBoundingClientRect();
            var inside = r.enclosed ? e.left >= a.x && e.right <= b.x && e.top >= a.y && e.bottom <= b.y : e.right >= a.x && e.left <= b.x && e.bottom >= a.y && e.top <= b.y;
            if (inside) picked.push(c.id);
        });
        select(md.additive ? md.base.concat(picked.filter(function (id) { return md.base.indexOf(id) < 0; })) : picked, { fromText: false });
    }

    document.addEventListener('mouseup', function (ev) {
        if (!drag) return;
        var d = drag;
        drag = null;
        showGuides([]);
        hideDrop();
        if (d.mode === 'marquee') { finishMarquee(d); return; }
        if (d.mode === 'maybe') {
            if (d.toggle !== null && d.toggle !== undefined) select(sel.filter(function (x) { return x !== d.toggle; }));
            else if (d.add !== null && d.add !== undefined) select(sel.concat([d.add]));
            else if (d.collapse !== null && d.collapse !== undefined) select([d.collapse]);
            else if (d.drill !== null && d.drill !== undefined) select([d.drill]);
            return;
        }
        if (d.mode === 'move' && (d.dx || d.dy)) {
            if (d.copy) return copyItemsTo(d.items, d.dx, d.dy);
            send(d.items.map(function (it) { return styleEdit(it.n, moveChanges(it, d.dx, d.dy)); }));
            return;
        }
        if (d.mode === 'move') { d.items.forEach(function (it) { it.dom.setAttribute('style', it.origStyle || ''); }); updateOverlay(); return; }
        if (d.mode === 'resize' && d.nb) { send([styleEdit(d.it.n, resizeChanges(d.it, d.nb))]); return; }
        if (d.mode === 'reorder') {
            if (d.dom) d.dom.style.opacity = '';
            if (d.drop) moveNode(d.flowNode, d.drop.node, d.drop.where);
        }
    });

    var hoverPending = null;
    function scheduleHover(ev) {
        if (hoverPending) { hoverPending.x = ev.clientX; hoverPending.y = ev.clientY; hoverPending.alt = ev.altKey; return; }
        hoverPending = { x: ev.clientX, y: ev.clientY, alt: ev.altKey };
        requestAnimationFrame(function () {
            var p = hoverPending;
            hoverPending = null;
            if (!parsed || mode === 'empty') return;
            var wr = wrapper.getBoundingClientRect();
            if (p.x < wr.left || p.x > wr.right || p.y < wr.top || p.y > wr.bottom) { hoverBox.style.display = 'none'; return; }
            var id = null;
            if (mode === 'hmi') { var h = pickHmi(p.x, p.y, false); id = h && h.id !== undefined ? h.id : null; }
            else { var ids = pickFlow(p.x, p.y); id = ids.length ? ids[0] : null; }
            var dom = id !== null && sel.indexOf(id) < 0 ? domFor(id) : null;
            if (dom) place(hoverBox, frameToWrapper(dom.getBoundingClientRect())); else hoverBox.style.display = 'none';
            if (mode === 'hmi' && page) {
                var pd = domFor(page.id);
                if (pd) {
                    var ci = containerInfo(pd), fp = framePoint(p.x, p.y);
                    $('coords').textContent = 'x ' + Math.round((fp.x - ci.ox) / ci.s) + ', y ' + Math.round((fp.y - ci.oy) / ci.s) + (id !== null ? '   ' + label(nodeById(id)) : '');
                }
            } else if (id !== null) $('coords').textContent = label(nodeById(id));
        });
    }
    wrapper.addEventListener('mouseleave', function () { hoverBox.style.display = 'none'; });
    wrapper.addEventListener('wheel', function (ev) {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        setZoom(zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
    wrapper.addEventListener('scroll', function () { /* the overlay scrolls with the content */ });

    glass.addEventListener('dblclick', function (ev) {
        if (!parsed || mode === 'empty') return;
        var n = null;
        if (mode === 'hmi') {
            var h = pickHmi(ev.clientX, ev.clientY, false);
            n = h && h.id !== undefined ? nodeById(h.id) : null;
            if (n && elementChildren(n).length && !textRange(n)) {
                // Into a group or container: its children become selectable.
                scopeId = n.id;
                var inner = pickHmi(ev.clientX, ev.clientY, false);
                select(inner && inner.id !== undefined ? [inner.id] : []);
                return;
            }
        } else {
            var ids = pickFlow(ev.clientX, ev.clientY);
            n = ids.length ? nodeById(ids[0]) : null;
        }
        if (n && textRange(n)) { startInlineEdit(n); return; }
        if (n) vscode.postMessage({ type: 'reveal', offset: n.start, end: n.tagEnd, focus: true });
    });

    // ------------------------------------------------------------------ in-place text editing

    function textRange(n) {
        if (!n || n.isVoid || n.rawContent !== undefined || !n.children.length) return null;
        if (!n.children.every(function (c) { return c.type === 'text' || c.type === 'comment'; })) return null;
        var kids = n.children.filter(function (c) { return c.type === 'text'; });
        if (!kids.length) return null;
        var first = kids[0], last = kids[kids.length - 1];
        var raw = text.substring(first.start, last.end);
        var lead = raw.length - raw.replace(/^\s+/, '').length, trail = raw.length - raw.replace(/\s+$/, '').length;
        if (first.start + lead >= last.end - trail) return null;
        return { start: first.start + lead, end: last.end - trail };
    }
    function decodeText(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); }
    function encodeText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;'); }

    function startInlineEdit(n) {
        var dom = domFor(n.id), rng = textRange(n);
        if (!dom || !rng || isLocked(n)) return;
        var d = fdoc();
        var before = dom.textContent;
        glass.classList.add('passthrough');
        d.documentElement.classList.add('rz-editing');
        dom.setAttribute('contenteditable', 'plaintext-only');
        dom.focus();
        var range = d.createRange();
        range.selectNodeContents(dom);
        var s = d.getSelection(); s.removeAllRanges(); s.addRange(range);
        var finished = false;
        var finish = function (commit) {
            if (finished) return;
            finished = true;
            dom.removeAttribute('contenteditable');
            d.documentElement.classList.remove('rz-editing');
            glass.classList.remove('passthrough');
            dom.removeEventListener('keydown', onKey);
            var after = dom.textContent.replace(/\s+/g, ' ').trim();
            if (commit && after !== before.replace(/\s+/g, ' ').trim()) send([{ offset: rng.start, length: rng.end - rng.start, text: encodeText(after) }]);
            else render();
            wrapper.focus({ preventScroll: true });
        };
        var onKey = function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        };
        dom.addEventListener('keydown', onKey);
        dom.addEventListener('blur', function () { finish(true); }, { once: true });
        statusEl.textContent = 'Editing text: Enter to keep, Esc to cancel';
    }

    // ------------------------------------------------------------------ commands: delete, duplicate, copy, paste

    function deleteSelected() {
        var ids = topmost(sel).filter(function (id) { var n = nodeById(id); return n !== page && !/^(html|head|body)$/i.test(n.name); });
        if (!ids.length) return;
        var parent = parentEl(nodeById(ids[0]));
        send(ids.map(function (id) { return R.deleteNodeEdit(text, nodeById(id)); }),
            { paths: mode === 'flow' && parent && parent.type === 'element' && !/^(html|body)$/i.test(parent.name) ? [nodePath(parent)] : [] });
    }

    /** Copies of the items, moved by (dx, dy), inserted after each original (Ctrl+drag, Ctrl+D). */
    function copyItemsTo(items, dx, dy) {
        var edits = [], markers = [];
        items.forEach(function (it) {
            var n = it.n;
            var indent = R.lineIndent(text, n.start);
            var copy = uniqueIds(R.reindent(text, n, indent));
            if (dx || dy) copy = markupWithStyle(copy, moveChanges(it, dx, dy));
            var ed = R.insertEdit(text, n, 'after', copy);
            edits.push(ed);
            markers.push({ ed: ed, copy: copy });
        });
        var merged = mergeEdits(edits.slice());
        // Where each copy starts in the new text.
        var offsets = markers.map(function (m) {
            var at = m.ed.offset + Math.max(0, m.ed.text.indexOf(m.copy));
            return shiftOffset(at, merged.filter(function (e) { return e.offset < m.ed.offset; }));
        });
        send(edits, { offsets: offsets });
    }
    function duplicateSelected() {
        var ids = topmost(sel).filter(function (id) { var n = nodeById(id); return n !== page && !/^(html|head|body)$/i.test(n.name); });
        if (!ids.length) return;
        if (mode === 'hmi') copyItemsTo(ids.map(itemFor).filter(Boolean), 10, 10);
        else copyItemsTo(ids.map(function (id) { return { n: nodeById(id) }; }), 0, 0);
    }
    function copySelection() {
        var ids = topmost(sel).filter(function (id) { return nodeById(id) !== page; });
        if (!ids.length) return;
        clipboard = ids.map(function (id) { return R.reindent(text, nodeById(id), ''); });
        statusEl.textContent = 'Copied ' + ids.length + ' element' + (ids.length > 1 ? 's' : '');
    }
    function paste() {
        if (!clipboard || !clipboard.length) return;
        var target = mode === 'hmi' ? scopeNode() : (sel.length ? nodeById(sel[0]) : findTag('body'));
        if (!target) return;
        var where = mode === 'hmi' || !sel.length ? 'inside' : 'after';
        var indent = where === 'inside' ? R.lineIndent(text, target.start) + detectUnit() : R.lineIndent(text, target.start);
        var parts = clipboard.map(function (m) {
            var c = uniqueIds(m);
            if (mode === 'hmi') {
                var st = {};
                var p = R.parseRazor(c, { html: true }).root.children.filter(isEl)[0];
                R.parseStyle(p ? attr(p, 'style') || '' : '').forEach(function (d) { st[d.prop] = d.value; });
                var L = lenOf(st.left), T = lenOf(st.top);
                c = markupWithStyle(c, { left: L ? addLen(L, 10, pageSize().w) : null, top: T ? addLen(T, 10, pageSize().h) : null });
            }
            return c.split(/\r?\n/).map(function (l, i) { return i ? indent + l : l; }).join(nl());
        });
        var joined = parts.join(nl() + indent);
        var ed = R.insertEdit(text, target, where, joined);
        var base = ed.offset + Math.max(0, ed.text.indexOf(joined));
        var offsets = [], pos = base;
        parts.forEach(function (p2) { offsets.push(pos); pos += p2.length + nl().length + indent.length; });
        send([ed], { offsets: offsets });
    }

    // ------------------------------------------------------------------ commands: align, size, distribute, order, group, lock

    function selItems() { return topmost(sel).map(itemFor).filter(Boolean); }
    function sameParent(items) { return items.every(function (it) { return it.ci.dom === items[0].ci.dom; }); }
    function checkUnlocked(items) {
        if (items.some(function (it) { return isLocked(it.n); })) { statusEl.textContent = 'Some of the selection is locked'; return false; }
        return true;
    }

    function align(kind) {
        var items = selItems();
        if (items.length < 2 || !sameParent(items) || !checkUnlocked(items)) { statusEl.textContent = 'Select two or more elements in the same container (the first one is the reference)'; return; }
        var p = items[0].box;
        send(items.slice(1).map(function (it) {
            var b = it.box, dx = 0, dy = 0;
            if (kind === 'left') dx = p.x - b.x;
            if (kind === 'center') dx = (p.x + p.w / 2) - (b.x + b.w / 2);
            if (kind === 'right') dx = (p.x + p.w) - (b.x + b.w);
            if (kind === 'top') dy = p.y - b.y;
            if (kind === 'middle') dy = (p.y + p.h / 2) - (b.y + b.h / 2);
            if (kind === 'bottom') dy = (p.y + p.h) - (b.y + b.h);
            dx = Math.round(dx); dy = Math.round(dy);
            return dx || dy ? styleEdit(it.n, moveChanges(it, dx, dy)) : null;
        }));
    }
    function sameSize(which) {
        var items = selItems();
        if (items.length < 2 || !checkUnlocked(items)) { statusEl.textContent = 'Select two or more elements (the first one is the reference)'; return; }
        var p = items[0].box;
        send(items.slice(1).map(function (it) {
            var b = it.box;
            var nb = { x: b.x, y: b.y, w: which === 'width' ? Math.round(p.w) : b.w, h: which === 'height' ? Math.round(p.h) : b.h };
            return styleEdit(it.n, resizeChanges(it, nb));
        }));
    }
    function distribute(axis) {
        var items = selItems();
        if (items.length < 3 || !sameParent(items) || !checkUnlocked(items)) { statusEl.textContent = 'Select three or more elements in the same container'; return; }
        var pos = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'h';
        items.sort(function (a, b) { return a.box[pos] - b.box[pos]; });
        var first = items[0].box, last = items[items.length - 1].box;
        var span = last[pos] + last[size] - first[pos];
        var sum = items.reduce(function (s, it) { return s + it.box[size]; }, 0);
        var gap = (span - sum) / (items.length - 1);
        var at = first[pos] + first[size] + gap;
        var edits = [];
        items.slice(1, -1).forEach(function (it) {
            var d = Math.round(at - it.box[pos]);
            if (d) edits.push(styleEdit(it.n, axis === 'h' ? moveChanges(it, d, 0) : moveChanges(it, 0, d)));
            at += it.box[size] + gap;
        });
        send(edits);
    }

    /** Moves node n before/after/inside target (flow reordering and z-order). */
    function moveNode(n, target, where) {
        if (!target || target === n || isInside(target, n)) return;
        var sibs = elementChildren(parentEl(n));
        var i = sibs.indexOf(n);
        if (where === 'after' && sibs[i - 1] === target) return;
        if (where === 'before' && sibs[i + 1] === target) return;
        var indent = where === 'inside' ? R.lineIndent(text, target.start) + detectUnit() : R.lineIndent(text, target.start);
        var moved = R.reindent(text, n, indent);
        var ins = R.insertEdit(text, target, where, moved);
        var del = R.deleteNodeEdit(text, n);
        var at = ins.offset + Math.max(0, ins.text.indexOf(moved));
        var newStart = at + (del.offset + del.length <= ins.offset ? -del.length : 0);
        send([ins, del], { offsets: [newStart] });
    }
    function moveSibling(dir) {
        if (sel.length !== 1) return;
        var n = nodeById(sel[0]);
        if (n === page) return;
        var sibs = elementChildren(parentEl(n));
        var t = sibs[sibs.indexOf(n) + dir];
        if (t) moveNode(n, t, dir < 0 ? 'before' : 'after');
    }
    function zOrder(front) {
        if (sel.length !== 1) { statusEl.textContent = 'Select one element'; return; }
        var n = nodeById(sel[0]);
        if (n === page) return;
        var sibs = elementChildren(parentEl(n));
        if (front) { var last = sibs[sibs.length - 1]; if (last !== n) moveNode(n, last, 'after'); }
        else { var first = sibs[0]; if (first !== n) moveNode(n, first, 'before'); }
    }

    function groupSelection() {
        var items = selItems().filter(function (it) { return it.n !== page; });
        if (!items.length || !sameParent(items)) { statusEl.textContent = 'Select elements in the same container to group them'; return; }
        items.sort(function (a, b) { return a.n.start - b.n.start; });
        var bb = union(items.map(function (it) { return it.box; }));
        bb = { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.w), h: Math.round(bb.h) };
        var first = items[0].n;
        var indent = R.lineIndent(text, first.start), inner = indent + detectUnit();
        var kids = items.map(function (it) {
            var c = R.reindent(text, it.n, inner);
            // Inside the group: the same place, now relative to the group's corner.
            return markupWithStyle(c, { position: 'absolute', left: px(it.box.x - bb.x), top: px(it.box.y - bb.y), right: null, bottom: null,
                width: lenOf(it.st.width) && lenOf(it.st.width).u === '%' ? px(it.box.w) : it.st.width || null,
                height: lenOf(it.st.height) && lenOf(it.st.height).u === '%' ? px(it.box.h) : it.st.height || null });
        });
        var groupMarkup = '<div class="group" style="position: absolute; left: ' + bb.x + 'px; top: ' + bb.y + 'px; width: ' + bb.w + 'px; height: ' + bb.h + 'px;">' +
            nl() + inner + kids.join(nl() + inner) + nl() + indent + '</div>';
        var edits = [{ offset: first.start, length: first.end - first.start, text: groupMarkup }];
        items.slice(1).forEach(function (it) { edits.push(R.deleteNodeEdit(text, it.n)); });
        send(edits, { offsets: [edits[0].offset] });
    }
    function ungroupSelection() {
        if (sel.length !== 1) { statusEl.textContent = 'Select one group'; return; }
        var g = nodeById(sel[0]);
        var kids = elementChildren(g);
        if (g === page || !kids.length) { statusEl.textContent = 'Select a group (an element with elements inside)'; return; }
        var git = itemFor(g.id), gdom = domFor(g.id);
        if (!git || !gdom) return;
        var gci = containerInfo(gdom);
        var indent = R.lineIndent(text, g.start);
        var parts = kids.map(function (k) {
            var kd = domFor(k.id);
            var kb = kd ? boxIn(kd, gci) : { x: 0, y: 0, w: 0, h: 0 };
            // Group coordinates → the group's container: add the group's position (group scaling ignored).
            var kst = styleMap(k);
            return markupWithStyle(R.reindent(text, k, indent), { position: 'absolute', left: px(git.box.x + gdom.clientLeft + kb.x), top: px(git.box.y + gdom.clientTop + kb.y), right: null, bottom: null,
                width: lenOf(kst.width) && lenOf(kst.width).u === '%' ? px(kb.w) : kst.width || null,
                height: lenOf(kst.height) && lenOf(kst.height).u === '%' ? px(kb.h) : kst.height || null });
        });
        var joined = parts.join(nl() + indent);
        var start = g.start, end = g.end;
        var offsets = [], pos = start;
        parts.forEach(function (p) { offsets.push(pos); pos += p.length + nl().length + indent.length; });
        send([{ offset: start, length: end - start, text: joined }], { offsets: offsets });
    }
    function toggleLock() {
        var ids = sel.filter(function (id) { return nodeById(id) !== page; });
        if (!ids.length) return;
        var lock = !ids.every(function (id) { return isLocked(nodeById(id)); });
        send(ids.map(function (id) { return R.setAttrEdit(text, nodeById(id), 'data-locked', lock ? 'true' : null); }));
    }

    function nudge(dx, dy) {
        var items = selItems().filter(function (it) { return it.n !== page; });
        if (!items.length || !checkUnlocked(items)) return;
        if (mode === 'flow' && !items.every(function (it) { return /absolute|fixed/.test(getCS(it.dom).position); })) return;
        send(items.map(function (it) { return styleEdit(it.n, moveChanges(it, dx, dy)); }));
    }

    // ------------------------------------------------------------------ flow: drop targets for reordering and the toolbox

    function dropTarget(x, y, moving) {
        var ids = pickFlow(x, y);
        for (var i = 0; i < ids.length; i++) {
            var n = nodeById(ids[i]);
            if (!n || (moving && (n === moving || isInside(n, moving))) || /^(html|head)$/i.test(n.name)) continue;
            var dom = domFor(n.id);
            if (!dom) continue;
            var r = dom.getBoundingClientRect(), p = framePoint(x, y);
            var pdom = dom.parentElement;
            var pcs = pdom ? getCS(pdom) : null;
            var horizontal = pcs && ((pcs.display.indexOf('flex') >= 0 && pcs.flexDirection.indexOf('row') === 0) || pcs.display.indexOf('inline') >= 0 || getCS(dom).display.indexOf('inline') === 0);
            var canInside = !n.isVoid && n.rawContent === undefined && !/^(img|input|br|hr|select|textarea)$/i.test(n.name);
            var rel = horizontal ? (p.x - r.left) / Math.max(1, r.width) : (p.y - r.top) / Math.max(1, r.height);
            var where = /^body$/i.test(n.name) ? 'inside' : canInside && rel > 0.25 && rel < 0.75 ? 'inside' : rel < 0.5 ? 'before' : 'after';
            return { node: n, where: where, rect: r, horizontal: horizontal };
        }
        return null;
    }
    function showDrop(t) {
        if (!t) { hideDrop(); return; }
        var r = frameToWrapper(t.rect);
        dropLine.className = 'drop-line' + (t.where === 'inside' ? ' inside' : '');
        if (t.where === 'inside') place(dropLine, r);
        else if (t.horizontal) place(dropLine, { x: (t.where === 'before' ? r.x : r.x + r.w) - 1, y: r.y, w: 3, h: r.h });
        else place(dropLine, { x: r.x, y: (t.where === 'before' ? r.y : r.y + r.h) - 1, w: r.w, h: 3 });
        $('coords').textContent = t.where + ' ' + label(t.node);
    }
    function hideDrop() { dropLine.style.display = 'none'; }

    // ------------------------------------------------------------------ keyboard

    document.addEventListener('keydown', function (ev) {
        var inInput = ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
        if (ev.key === ' ' && !inInput) spaceDown = true;
        if (inInput || mode === 'empty') return;
        var ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && (ev.key === '=' || ev.key === '+')) { ev.preventDefault(); setZoom(zoom * 1.25); return; }
        if (ctrl && ev.key === '-') { ev.preventDefault(); setZoom(zoom / 1.25); return; }
        if (ctrl && ev.key === '0') { ev.preventDefault(); fit(); updateStage(); updateOverlay(); return; }
        if (ctrl && /^d$/i.test(ev.key)) { ev.preventDefault(); duplicateSelected(); return; }
        if (ctrl && /^c$/i.test(ev.key)) { ev.preventDefault(); copySelection(); return; }
        if (ctrl && /^x$/i.test(ev.key)) { ev.preventDefault(); copySelection(); deleteSelected(); return; }
        if (ctrl && /^v$/i.test(ev.key)) { ev.preventDefault(); paste(); return; }
        if (ctrl && /^a$/i.test(ev.key) && mode === 'hmi') { ev.preventDefault(); select(elementChildren(scopeNode()).map(function (c) { return c.id; })); return; }
        if (ctrl && /^g$/i.test(ev.key) && mode === 'hmi') { ev.preventDefault(); if (ev.shiftKey) ungroupSelection(); else groupSelection(); return; }
        if (ctrl && /^l$/i.test(ev.key) && mode === 'hmi') { ev.preventDefault(); toggleLock(); return; }
        if (ev.key === 'Delete' || (ev.key === 'Backspace' && sel.length)) { ev.preventDefault(); deleteSelected(); return; }
        if (ev.key === 'Escape') { ev.preventDefault(); escape(); return; }
        if (ev.key === 'F2' && sel.length === 1) { ev.preventDefault(); startInlineEdit(nodeById(sel[0])); return; }
        if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) { ev.preventDefault(); moveSibling(ev.key === 'ArrowUp' ? -1 : 1); return; }
        if (sel.length && /^Arrow/.test(ev.key)) {
            ev.preventDefault();
            var st = ev.shiftKey ? 10 : 1;
            nudge(ev.key === 'ArrowLeft' ? -st : ev.key === 'ArrowRight' ? st : 0, ev.key === 'ArrowUp' ? -st : ev.key === 'ArrowDown' ? st : 0);
        }
    });
    document.addEventListener('keyup', function (ev) { if (ev.key === ' ') spaceDown = false; });
    function escape() {
        if (mode === 'hmi') {
            if (sel.length) { select([]); return; }
            if (scopeId !== null) {
                var sc = nodeById(scopeId), p = parentEl(sc);
                scopeId = p && p !== page && p.type === 'element' ? p.id : null;
                select([sc.id]);
            }
            return;
        }
        if (sel.length === 1) { var q = parentEl(nodeById(sel[0])); if (q && q.type === 'element') select([q.id]); }
    }

    // ------------------------------------------------------------------ outline tree

    var collapsed = new Set();
    function treeRoot() {
        if (mode === 'hmi') return page;
        return findTag('body') || parsed.root;
    }
    function renderTree() {
        if (!parsed || mode === 'empty') { treeEl.innerHTML = ''; return; }
        var q = $('treeSearch').value.trim().toLowerCase();
        var rows = [];
        var open = {};
        sel.forEach(function (id) { for (var a = parentEl(nodeById(id)); a; a = parentEl(a)) open[a.id] = true; });
        var skip = /^(script|style|link|meta|base|title|head|noscript)$/i;
        var visit = function (n, depth) {
            if (skip.test(n.name)) return;
            var kids = elementChildren(n).filter(function (k) { return !skip.test(k.name); });
            var isOpen = depth === 0 || !collapsed.has(n.id) || open[n.id];
            if (!q || label(n).toLowerCase().indexOf(q) >= 0) rows.push(treeRow(n, q ? 0 : depth, kids.length > 0 && !q, isOpen));
            if (q || isOpen) kids.forEach(function (k) { visit(k, depth + 1); });
        };
        var root = treeRoot();
        if (root.type === 'element') visit(root, 0); else elementChildren(root).forEach(function (k) { visit(k, 0); });
        treeEl.innerHTML = rows.join('') || '<div class="tree-more">Nothing to show</div>';
        var s = treeEl.querySelector('.tree-row.selected');
        if (s) { var tr = treeEl.getBoundingClientRect(), sr = s.getBoundingClientRect(); if (sr.top < tr.top || sr.bottom > tr.bottom) s.scrollIntoView({ block: 'center' }); }
    }
    function treeRow(n, depth, hasKids, isOpen) {
        var id = attr(n, 'id'), cls = attr(n, 'class');
        var extra = (id ? '#' + id : '') + (cls ? ' .' + cls.trim().split(/\s+/).join(' .') : '');
        var txt = textRange(n) ? text.substring(textRange(n).start, textRange(n).end) : '';
        return '<div class="tree-row' + (sel.indexOf(n.id) >= 0 ? ' selected' : '') + (isLocked(n) ? ' locked' : '') + '" data-id="' + n.id + '" style="padding-left:' + (depth * 14 + 4) + 'px" title="Line ' + lineOf(n.start) + '">' +
            '<span class="tree-twisty" data-tw="1">' + (hasKids ? (isOpen ? '&#x25BE;' : '&#x25B8;') : '') + '</span><span class="tree-kind">' + esc(n === page ? 'page' : n.name) + '</span>' +
            (extra ? '<span class="tree-cls">' + esc(extra.length > 50 ? extra.slice(0, 50) + '…' : extra) + '</span>' : '') +
            (txt ? '<span class="tree-text">' + esc(decodeText(txt).slice(0, 30)) + '</span>' : '') + '</div>';
    }
    treeEl.addEventListener('mousedown', function (ev) {
        var row = ev.target.closest('.tree-row');
        if (!row) return;
        var id = Number(row.dataset.id);
        if (ev.target.dataset.tw) { if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); renderTree(); return; }
        var n = nodeById(id);
        if (ev.ctrlKey || ev.metaKey) { select(sel.indexOf(id) >= 0 ? sel.filter(function (x) { return x !== id; }) : sel.concat([id])); return; }
        selectNode(n, { scroll: true });
    });
    $('treeSearch').addEventListener('input', renderTree);

    function updateBreadcrumb() {
        var bc = $('breadcrumb');
        if (!sel.length || !parsed) { bc.innerHTML = mode === 'hmi' && scopeId !== null ? 'Inside ' + esc(label(nodeById(scopeId))) + ' — Esc to leave' : ''; return; }
        var parts = [];
        for (var x = nodeById(sel[0]); x && x.type === 'element'; x = parentEl(x)) parts.unshift('<span class="crumb" data-id="' + x.id + '">' + esc(label(x)) + '</span>');
        bc.innerHTML = parts.join(' › ') + (sel.length > 1 ? '  (+' + (sel.length - 1) + ')' : '');
    }
    $('breadcrumb').addEventListener('click', function (ev) {
        var c = ev.target.closest('.crumb');
        if (c) selectNode(nodeById(Number(c.dataset.id)), { scroll: true });
    });

    // ------------------------------------------------------------------ properties panel

    function group(title) { var h = document.createElement('div'); h.className = 'prop-group'; h.textContent = title; return h; }
    function note(t) { var d = document.createElement('div'); d.className = 'readonly-note'; d.textContent = t; return d; }
    function inputRow(labelText, value, placeholder, onCommit, opts) {
        opts = opts || {};
        var r = document.createElement('div');
        r.className = 'prop-row';
        var l = document.createElement('label');
        l.textContent = labelText;
        if (opts.set) l.className = 'set';
        if (opts.title) l.title = opts.title;
        r.appendChild(l);
        var box = document.createElement('div');
        box.className = 'prop-input';
        var inp;
        if (opts.options) {
            inp = document.createElement('select');
            opts.options.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; inp.appendChild(op); });
            inp.value = value || '';
            inp.onchange = function () { onCommit(inp.value); };
        } else {
            inp = document.createElement('input');
            inp.type = opts.type || 'text';
            inp.spellcheck = false;
            inp.value = value === null || value === undefined ? '' : value;
            if (placeholder) inp.placeholder = placeholder;
            inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } if (ev.key === 'Escape') { inp.value = value || ''; inp.blur(); } };
            inp.onchange = function () { if (inp.value !== (value === null || value === undefined ? '' : String(value))) onCommit(inp.value); };
        }
        box.appendChild(inp);
        if (opts.extra) box.appendChild(opts.extra);
        r.appendChild(box);
        return r;
    }
    function button(textLabel, title, onClick, cls) {
        var b = document.createElement('button');
        b.textContent = textLabel;
        b.title = title || '';
        b.className = cls || '';
        b.onclick = onClick;
        return b;
    }

    function renderProps() {
        propsEl.innerHTML = '';
        if (!parsed || mode === 'empty') { propsHeader.textContent = ''; return; }
        var frag = document.createDocumentFragment();
        if (!sel.length || (sel.length === 1 && nodeById(sel[0]) === page)) {
            if (mode === 'hmi') pageProps(frag);
            else { propsHeader.textContent = 'No selection'; frag.appendChild(note('Click an element to select it. Drag it to move it in the page\'s order; double-click text to edit it.')); }
            propsEl.appendChild(frag);
            return;
        }
        if (sel.length > 1) {
            propsHeader.textContent = sel.length + ' elements selected';
            if (mode === 'hmi') multiProps(frag);
            propsEl.appendChild(frag);
            return;
        }
        var n = nodeById(sel[0]);
        propsHeader.textContent = label(n) + ' · line ' + lineOf(n.start);
        if (mode === 'hmi') positionProps(frag, n);
        var tr = textRange(n);
        if (tr) {
            frag.appendChild(group('Text'));
            frag.appendChild(inputRow('text', decodeText(text.substring(tr.start, tr.end)), '', function (v) { send([{ offset: tr.start, length: tr.end - tr.start, text: encodeText(v) }]); }));
        }
        appearanceProps(frag, n);
        classProps(frag, n);
        attributeProps(frag, n);
        cssRules(frag, n);
        propsEl.appendChild(frag);
    }

    function resolutionOptions(includePage) {
        var o = [];
        if (includePage) o.push(['page', 'Same as the page']);
        RESOLUTIONS.forEach(function (r) { o.push([r[0] + 'x' + r[1], r[0] + ' × ' + r[1] + (r[2] ? ' (' + r[2] + ')' : '')]); });
        return o;
    }
    var SCALE_HELP = {
        fit: 'The whole page is visible and centred; empty bands fill the rest (like ScaleToFit).',
        width: 'The page fills the window width; scroll vertically (like ScaleToWidth).',
        height: 'The page fills the window height; scroll horizontally (like ScaleToHeight).',
        fill: 'Stretched to the whole window; proportions change (like ScaleToFill).',
        none: 'Shown at its own size; scroll when the window is smaller.',
    };

    function pageProps(frag) {
        propsHeader.textContent = 'Page';
        var ps = pageSize();
        frag.appendChild(group('Resolution'));
        var key = ps.w + 'x' + ps.h;
        var opts = resolutionOptions(false);
        if (!opts.some(function (o) { return o[0] === key; })) opts.unshift([key, ps.w + ' × ' + ps.h + ' (custom)']);
        frag.appendChild(inputRow('preset', key, '', function (v) { var p = v.split('x').map(Number); setPageSize(p[0], p[1]); }, { options: opts }));
        frag.appendChild(inputRow('width', ps.w, '', function (v) { if (Number(v) >= 50) setPageSize(Number(v), ps.h); }, { type: 'number' }));
        frag.appendChild(inputRow('height', ps.h, '', function (v) { if (Number(v) >= 50) setPageSize(ps.w, Number(v)); }, { type: 'number' }));
        frag.appendChild(group('Scaling in the browser'));
        frag.appendChild(inputRow('scale mode', scaleMode(), '', function (v) { setAttr(page, 'data-scale', v); },
            { options: [['fit', 'Fit (whole page)'], ['width', 'Fit width'], ['height', 'Fit height'], ['fill', 'Stretch to fill'], ['none', 'No scaling']] }));
        frag.appendChild(note(SCALE_HELP[scaleMode()] || ''));
        if (!/data-hmi-scale|\.hmi-page/.test(scriptsText())) frag.appendChild(note('This page has no scale script, so it will not scale in a browser. Recreate it from an empty file to get one.'));
        frag.appendChild(group('Page'));
        var st = styleMap(page);
        frag.appendChild(inputRow('background', st.background || st['background-color'] || '', 'from the stylesheet', function (v) { setStyle(page, { background: v.trim() || null, 'background-color': null }); }));
        var title = findTag('title');
        if (title) {
            var tr = title.rawContent !== undefined ? { start: title.tagEnd, end: title.closeStart } : null;
            if (tr) frag.appendChild(inputRow('title', decodeText(text.substring(tr.start, tr.end).trim()), '', function (v) { send([{ offset: tr.start, length: tr.end - tr.start, text: encodeText(v) }]); }));
        }
        frag.appendChild(group('Designer'));
        frag.appendChild(note('Click to select, drag on empty space to select several (Alt: only fully inside). Drag to move: edges snap to the page, to other elements and to the grid (Alt: free). Shift keeps a move straight or a resize proportional; Ctrl+drag copies. Double-click a group to work inside it, double-click text to edit it; Esc goes back.'));
        if (scopeId !== null) frag.appendChild(button('Leave ' + label(nodeById(scopeId)), 'Esc', function () { scopeId = null; select([]); }, 'link-button'));
    }
    function scriptsText() {
        var out = '';
        parsed.nodes.forEach(function (n) { if (isEl(n) && lname(n) === 'script' && n.rawContent) out += n.rawContent; });
        return out;
    }
    function setPageSize(w, h) {
        setStyle(page, { width: Math.round(w) + 'px', height: Math.round(h) + 'px' });
        zoom = null;
    }

    function multiProps(frag) {
        frag.appendChild(note('The first selected element is the reference for aligning and sizing.'));
        var row = function (items) {
            var d = document.createElement('div');
            d.className = 'prop-add';
            items.forEach(function (b) { d.appendChild(button(b[0], b[1], b[2])); });
            frag.appendChild(d);
        };
        frag.appendChild(group('Align'));
        row([['Left', 'Align left edges', function () { align('left'); }], ['Center', 'Align centres', function () { align('center'); }], ['Right', 'Align right edges', function () { align('right'); }]]);
        row([['Top', 'Align top edges', function () { align('top'); }], ['Middle', 'Align middles', function () { align('middle'); }], ['Bottom', 'Align bottom edges', function () { align('bottom'); }]]);
        frag.appendChild(group('Size and spacing'));
        row([['Same width', '', function () { sameSize('width'); }], ['Same height', '', function () { sameSize('height'); }]]);
        row([['Distribute ↔', 'Equal horizontal spacing', function () { distribute('h'); }], ['Distribute ↕', 'Equal vertical spacing', function () { distribute('v'); }]]);
        frag.appendChild(group('Arrange'));
        row([['Group', 'Ctrl+G', groupSelection], ['Lock', 'Ctrl+L', toggleLock], ['Delete', 'Del', deleteSelected]]);
    }

    function positionProps(frag, n) {
        var it = itemFor(n.id);
        var cont = parentEl(n);
        frag.appendChild(group('Position in ' + (cont === page ? 'the page' : label(cont))));
        if (!it) return;
        var st = it.st, b = it.box, ci = it.ci;
        var computed = { left: b.x, top: b.y, right: ci.w - b.x - b.w, bottom: ci.h - b.y - b.h, width: b.w, height: b.h };
        ['left', 'top', 'right', 'bottom', 'width', 'height'].forEach(function (p) {
            var L = lenOf(st[p]);
            var total = /left|right|width/.test(p) ? ci.w : ci.h;
            var unit = document.createElement('select');
            unit.className = 'unit';
            ['px', '%'].forEach(function (u) { var o = document.createElement('option'); o.value = u; o.textContent = u; unit.appendChild(o); });
            unit.value = L ? L.u : 'px';
            unit.onchange = function () {
                var ch = {};
                var cur = L ? (L.u === '%' ? L.v * total / 100 : L.v) : computed[p];
                ch[p] = unit.value === '%' ? pct(cur / total * 100) : px(cur);
                setStyle(n, ch);
            };
            var disabled = isLocked(n);
            var row = inputRow(p, L ? String(L.v) : '', String(Math.round(computed[p])), function (v) {
                var ch = {};
                ch[p] = v.trim() === '' ? null : (isNaN(Number(v)) ? v.trim() : Number(v) + unit.value);
                setStyle(n, ch);
            }, { set: !!L, extra: unit, type: 'text' });
            if (disabled) row.querySelectorAll('input,select').forEach(function (x) { x.disabled = true; });
            frag.appendChild(row);
        });
        var rot = /rotate\(\s*(-?[\d.]+)deg\s*\)/.exec(st.transform || '');
        frag.appendChild(inputRow('rotate °', rot ? rot[1] : '', '0', function (v) {
            var t = (st.transform || '').replace(/\s*rotate\([^)]*\)/, '').trim();
            var nv = v.trim() && Number(v) ? (t ? t + ' ' : '') + 'rotate(' + Number(v) + 'deg)' : t;
            setStyle(n, { transform: nv || null });
        }));
        var lockRow = document.createElement('div');
        lockRow.className = 'prop-add';
        lockRow.appendChild(button(isLocked(n) ? 'Unlock' : 'Lock', 'Ctrl+L: locked elements cannot be moved or resized', toggleLock));
        if (elementChildren(n).length) lockRow.appendChild(button('Edit inside', 'Double-click also works', function () { scopeId = n.id; select([]); }));
        if (elementChildren(n).length) lockRow.appendChild(button('Ungroup', 'Ctrl+Shift+G', ungroupSelection));
        frag.appendChild(lockRow);
        frag.appendChild(note('Set two of left / width / right (and of top / height / bottom). Right and bottom anchor to the far edge; % is of the container.'));
    }

    var APPEARANCE = [['background', ''], ['color', ''], ['border', ''], ['border-radius', ''], ['opacity', ''], ['font-family', ''], ['font-size', ''], ['font-weight', ''],
        ['text-align', ''], ['padding', ''], ['box-shadow', '']];
    var FLOW_LAYOUT = [['display', ''], ['width', ''], ['height', ''], ['max-width', ''], ['margin', ''], ['gap', ''], ['flex-direction', ''], ['justify-content', ''], ['align-items', '']];

    function appearanceProps(frag, n) {
        var st = styleMap(n);
        var dom = domFor(n.id);
        var cs = dom ? getCS(dom) : null;
        var add = function (p) {
            var comp = cs ? cs.getPropertyValue(p) : '';
            if (p === 'background' && cs) comp = cs.backgroundColor;
            if (p === 'border' && cs) comp = cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor;
            if ((p === 'margin' || p === 'padding') && cs) comp = [cs[p + 'Top'], cs[p + 'Right'], cs[p + 'Bottom'], cs[p + 'Left']].join(' ');
            var ch = {};
            frag.appendChild(inputRow(p, st[p] !== undefined ? st[p] : '', comp, function (v) { ch[p] = v.trim() || null; setStyle(n, ch); }, { set: st[p] !== undefined }));
        };
        if (mode === 'flow') { frag.appendChild(group('Layout (inline style)')); FLOW_LAYOUT.forEach(function (p) { add(p[0]); }); }
        frag.appendChild(group('Appearance (inline style)'));
        APPEARANCE.forEach(function (p) { add(p[0]); });
        if (mode === 'hmi') {
            var v = st.display === 'flex' && st['flex-direction'] === 'column' ? ({ 'flex-start': 'top', center: 'middle', 'flex-end': 'bottom' })[st['justify-content']] || '' : '';
            frag.appendChild(inputRow('text vertical', v, '', function (nv) {
                if (!nv) setStyle(n, { display: null, 'flex-direction': null, 'justify-content': null });
                else setStyle(n, { display: 'flex', 'flex-direction': 'column', 'justify-content': ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' })[nv] });
            }, { options: [['', '(normal)'], ['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']] }));
        }
        var known = {};
        APPEARANCE.concat(FLOW_LAYOUT).forEach(function (p) { known[p[0]] = 1; });
        ['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'transform', 'display', 'flex-direction', 'justify-content'].forEach(function (p) { if (mode === 'hmi') known[p] = 1; });
        Object.keys(st).forEach(function (p) { if (!known[p]) add(p); });
        var extra = document.createElement('div');
        extra.className = 'prop-add';
        extra.innerHTML = '<input placeholder="property: value" spellcheck="false"/><button>Add</button>';
        var inp = extra.querySelector('input');
        extra.querySelector('button').onclick = function () {
            var m = /^\s*([\w-]+)\s*:\s*(.+?);?\s*$/.exec(inp.value);
            if (m) { var ch = {}; ch[m[1].toLowerCase()] = m[2]; setStyle(n, ch); }
        };
        frag.appendChild(extra);
    }

    function classProps(frag, n) {
        frag.appendChild(group('Class'));
        var cls = attr(n, 'class');
        var list = cls ? cls.trim().split(/\s+/).filter(Boolean) : [];
        var chips = document.createElement('div');
        chips.className = 'chips';
        list.forEach(function (c) {
            var ch = document.createElement('span');
            ch.className = 'chip';
            ch.innerHTML = esc(c) + (c === 'hmi-page' ? '' : '<button title="Remove">&#x2715;</button>');
            var b = ch.querySelector('button');
            if (b) b.onclick = function () { var nl2 = list.filter(function (x) { return x !== c; }).join(' '); setAttr(n, 'class', nl2 ? nl2 : null); };
            chips.appendChild(ch);
        });
        frag.appendChild(chips);
        frag.appendChild(inputRow('add class', '', 'name', function (v) { var add = v.trim().split(/\s+/).filter(function (x) { return x && list.indexOf(x) < 0; }); if (add.length) setAttr(n, 'class', list.concat(add).join(' ')); }));
    }

    var TAG_ATTRS = { img: ['src', 'alt'], a: ['href', 'target'], input: ['type', 'value', 'placeholder', 'name'], button: ['type'], iframe: ['src'], video: ['src', 'poster'], select: ['name'], textarea: ['placeholder', 'rows'], label: ['for'], form: ['action', 'method'] };
    function attributeProps(frag, n) {
        frag.appendChild(group('Attributes'));
        var shown = { style: 1, class: 1 };
        var row = function (name) {
            var a = R.findAttr(n, name);
            shown[name] = 1;
            var rm = document.createElement('button');
            rm.className = 'link-button';
            rm.textContent = '✕';
            rm.title = 'Remove ' + name;
            rm.onclick = function () { setAttr(n, name, null); };
            frag.appendChild(inputRow(name, a ? (a.raw === null ? '' : a.raw) : '', a && a.raw === null ? '(no value)' : '', function (v) { setAttr(n, name, v === '' && !a ? null : v); }, { set: !!a, extra: a ? rm : null }));
        };
        row('id');
        (TAG_ATTRS[lname(n)] || []).forEach(row);
        n.attrs.forEach(function (a) { if (!shown[a.name]) row(a.name); });
        var add = document.createElement('div');
        add.className = 'prop-add';
        add.innerHTML = '<input placeholder="Attribute" spellcheck="false"/><input placeholder="Value" spellcheck="false"/><button>Add</button>';
        var ins = add.querySelectorAll('input');
        add.querySelector('button').onclick = function () { var nm = ins[0].value.trim(); if (/^[A-Za-z_:][\w:.\-]*$/.test(nm)) setAttr(n, nm, ins[1].value); };
        frag.appendChild(add);
    }

    /** CSS rules that apply to the element: from linked stylesheets (edits go to that file) and <style> blocks of the page. */
    function cssRules(frag, n) {
        var dom = domFor(n.id);
        if (!dom) return;
        var win = dom.ownerDocument.defaultView;
        var cands = [];
        sheets.forEach(function (sh) { var src = { kind: 'file', path: sh.info.path, text: sh.info.text, name: fileName(sh.info.path) }; sh.rules.forEach(function (r) { cands.push({ rule: r, src: src }); }); });
        parsed.nodes.forEach(function (sn) {
            if (!isEl(sn) || lname(sn) !== 'style' || sn.rawContent === undefined) return;
            var src = { kind: 'doc', base: sn.tagEnd, text: sn.rawContent, name: 'this page, line ' + lineOf(sn.start) };
            R.parseCss(sn.rawContent).forEach(function (r) { cands.push({ rule: r, src: src }); });
        });
        var found = [];
        cands.forEach(function (c) {
            var ok = false;
            try { ok = dom.matches(c.rule.selector.replace(/::?(before|after|placeholder|selection|marker|first-line|first-letter|-webkit-[\w-]+)/g, '')); } catch (e) { ok = false; }
            if (!ok) return;
            var active = true;
            if (c.rule.media) { try { active = win.matchMedia(c.rule.media.replace(/^@media\s*/, '').replace(/ and @media /g, ' and ')).matches; } catch (e2) { active = true; } }
            found.push({ rule: c.rule, src: c.src, active: active });
        });
        if (!found.length) return;
        frag.appendChild(group('CSS rules'));
        found.reverse().forEach(function (m) {
            var box = document.createElement('div');
            box.className = 'rule' + (m.active ? '' : ' inactive');
            var line = m.src.kind === 'doc' ? lineOf(m.src.base + m.rule.start) : lineIn(m.src.text, m.rule.start);
            box.innerHTML = '<div class="rule-head" title="Show the rule"><span class="sel">' + esc(m.rule.selector) + '</span><span class="src">' + esc(m.src.kind === 'doc' ? 'line ' + line : m.src.name + ':' + line) + '</span></div>';
            box.querySelector('.rule-head').onclick = function () {
                if (m.src.kind === 'doc') vscode.postMessage({ type: 'reveal', offset: m.src.base + m.rule.start, end: m.src.base + m.rule.selEnd, focus: true });
                else vscode.postMessage({ type: 'openFile', path: m.src.path, offset: m.rule.start });
            };
            var editDecl = function (offset, length, value, expect) {
                if (m.src.kind === 'doc') send([{ offset: m.src.base + offset, length: length, text: value }]);
                else vscode.postMessage({ type: 'editFile', path: m.src.path, edits: [{ offset: offset, length: length, text: value, expect: expect }] });
            };
            m.rule.decls.forEach(function (d) {
                box.appendChild(inputRow(d.prop, d.value, '', function (v) { editDecl(d.vStart, d.vEnd - d.vStart, v, m.src.text.substring(d.vStart, d.vEnd)); }));
            });
            box.appendChild(inputRow('+', '', 'property: value', function (v) {
                var mm = /^\s*([\w-]+)\s*:\s*(.+?);?\s*$/.exec(v);
                if (!mm) return;
                var body = m.src.text.substring(m.rule.bodyStart, m.rule.bodyEnd);
                var indent = (/\n([ \t]+)\S/.exec(body) || [null, '    '])[1];
                var end = m.rule.bodyEnd;
                while (end > m.rule.bodyStart && /\s/.test(m.src.text[end - 1])) end--;
                var semi = m.src.text[end - 1] !== ';' && m.src.text[end - 1] !== '{' ? ';' : '';
                var ins = body.indexOf('\n') >= 0 ? semi + '\n' + indent + mm[1] + ': ' + mm[2] + ';' : semi + ' ' + mm[1] + ': ' + mm[2] + ';';
                editDecl(end, 0, ins, '');
            }));
            frag.appendChild(box);
        });
    }
    function lineIn(t, off) { var k = 1; for (var i = t.indexOf('\n'); i >= 0 && i < off; i = t.indexOf('\n', i + 1)) k++; return k; }

    // ------------------------------------------------------------------ toolbox

    var HMI_TOOLS = [
        ['Text', 'Tx', '<div style="position: absolute; left: {L}; top: {T}; width: 160px; height: 32px;">Text</div>'],
        ['Heading', 'H', '<h2 style="position: absolute; left: {L}; top: {T}; width: 360px; height: 48px; margin: 0; font-size: 32px;">Heading</h2>'],
        ['Button', 'Bt', '<button type="button" style="position: absolute; left: {L}; top: {T}; width: 140px; height: 44px;">Button</button>'],
        ['Image', 'Im', '<img src="" alt="" style="position: absolute; left: {L}; top: {T}; width: 200px; height: 150px; object-fit: contain;">'],
        ['Rectangle', 'Re', '<div style="position: absolute; left: {L}; top: {T}; width: 200px; height: 120px; background: #e8e8e8; border: 1px solid #9a9a9a;"></div>'],
        ['Ellipse', 'El', '<div style="position: absolute; left: {L}; top: {T}; width: 120px; height: 120px; background: #e8e8e8; border: 1px solid #9a9a9a; border-radius: 50%;"></div>'],
        ['Line', 'Ln', '<div style="position: absolute; left: {L}; top: {T}; width: 200px; height: 2px; background: #333333;"></div>'],
        ['Group box', 'Gb', '<div style="position: absolute; left: {L}; top: {T}; width: 320px; height: 200px; border: 1px solid #9a9a9a; border-radius: 4px;"></div>'],
        ['Text box', 'In', '<input type="text" style="position: absolute; left: {L}; top: {T}; width: 180px; height: 32px;">'],
        ['Checkbox', 'Ck', '<label style="position: absolute; left: {L}; top: {T}; width: 160px; height: 24px;"><input type="checkbox"> Checkbox</label>'],
        ['Drop-down', 'Dd', '<select style="position: absolute; left: {L}; top: {T}; width: 180px; height: 32px;"><option>Option 1</option><option>Option 2</option></select>'],
        ['Link', 'A', '<a href="#" style="position: absolute; left: {L}; top: {T};">Link</a>'],
        ['Table', 'Tb', '<table style="position: absolute; left: {L}; top: {T}; width: 320px; border-collapse: collapse;">\n    <tr><th>Name</th><th>Value</th></tr>\n    <tr><td>A</td><td>1</td></tr>\n</table>'],
    ];
    var FLOW_TOOLS = [
        ['div', 'Dv', '<div></div>'], ['section', 'Sc', '<section></section>'], ['p', 'P', '<p>Text</p>'], ['span', 'Sp', '<span>Text</span>'],
        ['h1', 'H1', '<h1>Heading</h1>'], ['h2', 'H2', '<h2>Heading</h2>'], ['h3', 'H3', '<h3>Heading</h3>'],
        ['button', 'Bt', '<button type="button">Button</button>'], ['input', 'In', '<input type="text">'], ['label', 'Lb', '<label>Label</label>'],
        ['textarea', 'Ta', '<textarea></textarea>'], ['select', 'Se', '<select>\n    <option>Option</option>\n</select>'],
        ['img', 'Im', '<img src="" alt="">'], ['a', 'A', '<a href="">Link</a>'], ['ul', 'Ul', '<ul>\n    <li>Item</li>\n</ul>'],
        ['table', 'Tb', '<table>\n    <tr><th>Header</th></tr>\n    <tr><td>Cell</td></tr>\n</table>'],
    ];
    function buildToolbox() {
        var tb = $('toolbox');
        tb.innerHTML = '';
        $('toolboxHint').textContent = mode === 'hmi' ? 'Drag onto the page: it lands where you drop it (on the grid).' : 'Drag onto the page: the middle of an element puts it inside, its edges before or after.';
        (mode === 'hmi' ? HMI_TOOLS : FLOW_TOOLS).forEach(function (t) {
            var d = document.createElement('div');
            d.className = 'tool';
            d.draggable = true;
            d.innerHTML = '<span class="tool-icon">' + t[1] + '</span>' + (mode === 'hmi' ? esc(t[0]) : '&lt;' + t[0] + '&gt;');
            d.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/x-html-tool', t[0]); ev.dataTransfer.effectAllowed = 'copy'; });
            tb.appendChild(d);
        });
    }
    function isTool(ev) { return Array.prototype.indexOf.call(ev.dataTransfer.types, 'text/x-html-tool') >= 0; }
    /** HMI: where a dropped tool goes: the deepest container-like element under the point (or the page), and the spot in it. */
    function hmiDropSpot(x, y) {
        var d = fdoc();
        if (!d || !page) return null;
        var fp = framePoint(x, y);
        var target = page;
        var list = d.elementsFromPoint(fp.x, fp.y);
        for (var i = 0; i < list.length; i++) {
            var n = nodeOfDom(list[i]);
            if (!n || !isInside(n, page)) continue;
            for (var a = n; a && a !== page; a = parentEl(a)) {
                if (/^(div|section|fieldset|figure|form|article|aside|header|footer|nav|main)$/i.test(a.name) && !textRange(a) && !isLocked(a)) { target = a; break; }
            }
            break;
        }
        var cd = domFor(target.id);
        if (!cd) return null;
        var ci = containerInfo(cd);
        var lx = (fp.x - ci.ox) / ci.s, ly = (fp.y - ci.oy) / ci.s;
        if (ds.snap) { lx += gridSnap(lx); ly += gridSnap(ly); }
        return { target: target, x: Math.round(lx), y: Math.round(ly), ci: ci };
    }
    glass.addEventListener('dragover', function (ev) {
        if (!parsed || !isTool(ev)) return;
        ev.preventDefault();
        if (mode === 'hmi') {
            var sp = hmiDropSpot(ev.clientX, ev.clientY);
            if (!sp) { hideDrop(); return; }
            var r = frameToWrapper({ left: sp.ci.ox + sp.x * sp.ci.s, top: sp.ci.oy + sp.y * sp.ci.s, width: 0, height: 0 });
            dropLine.className = 'drop-line inside';
            place(dropLine, { x: r.x - 4, y: r.y - 4, w: 8, h: 8 });
            $('coords').textContent = 'x ' + sp.x + ', y ' + sp.y + ' in ' + label(sp.target);
        } else showDrop(dropTarget(ev.clientX, ev.clientY, null));
    });
    glass.addEventListener('dragleave', hideDrop);
    glass.addEventListener('drop', function (ev) {
        hideDrop();
        if (!isTool(ev) || !parsed) return;
        ev.preventDefault();
        var name = ev.dataTransfer.getData('text/x-html-tool');
        if (mode === 'hmi') {
            var sp = hmiDropSpot(ev.clientX, ev.clientY);
            if (!sp) return;
            var tool = HMI_TOOLS.filter(function (x) { return x[0] === name; })[0];
            var ind = R.lineIndent(text, sp.target.start) + detectUnit();
            var markup = tool[2].replace('{L}', sp.x + 'px').replace('{T}', sp.y + 'px').split('\n').map(function (l, i) { return i ? ind + l : l; }).join(nl());
            var ed = R.insertEdit(text, sp.target, 'inside', markup);
            scopeId = sp.target === page ? null : sp.target.id;
            send([ed], { offsets: [ed.offset + Math.max(0, ed.text.indexOf(markup))] });
            return;
        }
        var t = dropTarget(ev.clientX, ev.clientY, null);
        var ftool = FLOW_TOOLS.filter(function (x) { return x[0] === name; })[0];
        var target = t ? t.node : findTag('body'), where = t ? t.where : 'inside';
        if (!target) return;
        var indent = where === 'inside' ? R.lineIndent(text, target.start) + detectUnit() : R.lineIndent(text, target.start);
        var m2 = ftool[2].split('\n').map(function (l, i) { return i ? indent + l : l; }).join(nl());
        var ed2 = R.insertEdit(text, target, where, m2);
        send([ed2], { offsets: [ed2.offset + Math.max(0, ed2.text.indexOf(m2))] });
    });

    // ------------------------------------------------------------------ new pages

    var SCALE_SCRIPT = [
        '// Scales the fixed-size page to the browser window. data-scale: fit | width | height | fill | none.',
        '(function () {',
        '    function scale() {',
        '        var pages = document.querySelectorAll(".hmi-page"), body = document.body, root = document.documentElement;',
        '        for (var i = 0; i < pages.length; i++) {',
        '            var p = pages[i], mode = p.getAttribute("data-scale") || "fit";',
        '            p.style.transform = "none";',
        '            var w = p.offsetWidth, h = p.offsetHeight;',
        '            body.style.overflowX = mode === "height" || mode === "none" ? "auto" : "hidden";',
        '            body.style.overflowY = mode === "width" || mode === "none" ? "auto" : "hidden";',
        '            var vw = root.clientWidth, vh = root.clientHeight;',
        '            var sx = vw / w, sy = vh / h, x = 0, y = 0;',
        '            if (mode === "none") sx = sy = 1;',
        '            else if (mode === "width") sy = sx;',
        '            else if (mode === "height") sx = sy;',
        '            else if (mode === "fit") { sx = sy = Math.min(sx, sy); x = (vw - w * sx) / 2; y = (vh - h * sy) / 2; }',
        '            p.style.transform = "translate(" + x + "px," + y + "px) scale(" + sx + "," + sy + ")";',
        '        }',
        '    }',
        '    window.addEventListener("resize", scale);',
        '    scale();',
        '})();',
    ];
    function hmiTemplate(w, h, scale) {
        var n = '\n';
        return ['<!DOCTYPE html>', '<html lang="en">', '<head>',
            '    <meta charset="utf-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1">',
            '    <title>HMI page</title>',
            '    <style>',
            '        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }',
            '        body { position: relative; background: #1e1e1e; }',
            '        .hmi-page { position: absolute; left: 0; top: 0; overflow: hidden; transform-origin: 0 0; background: #ffffff; color: #1a1a1a; font-family: "Segoe UI", Arial, sans-serif; font-size: 16px; }',
            '        .hmi-page * { box-sizing: border-box; }',
            '    </style>',
            '</head>', '<body>',
            '    <div class="hmi-page" data-scale="' + scale + '" style="width: ' + w + 'px; height: ' + h + 'px;">',
            '    </div>',
            '    <script data-hmi-scale>',
            SCALE_SCRIPT.map(function (l) { return '        ' + l; }).join(n),
            '    </script>',
            '</body>', '</html>', ''].join(n);
    }
    function flowTemplate() {
        return ['<!DOCTYPE html>', '<html lang="en">', '<head>',
            '    <meta charset="utf-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1">',
            '    <title>Page</title>',
            '    <style>',
            '        body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; line-height: 1.5; color: #1a1a1a; }',
            '        main { max-width: 960px; margin: 0 auto; padding: 24px; }',
            '    </style>',
            '</head>', '<body>',
            '    <main>',
            '        <h1>Title</h1>',
            '        <p>Text</p>',
            '    </main>',
            '</body>', '</html>', ''].join('\n');
    }
    (function startScreen() {
        var sr = $('startRes');
        resolutionOptions(false).concat([['custom', 'Custom…']]).forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sr.appendChild(op); });
        sr.value = '1920x1080';
        var sync = function () {
            var custom = sr.value === 'custom';
            document.querySelector('.start-custom').classList.toggle('show', custom);
            if (!custom) { var p = sr.value.split('x'); $('startW').value = p[0]; $('startH').value = p[1]; }
        };
        sr.onchange = sync;
        sync();
        $('btnNewHmi').onclick = function () {
            var w = Math.max(100, Number($('startW').value) || 1920), h = Math.max(100, Number($('startH').value) || 1080);
            zoom = null;
            vscode.postMessage({ type: 'edit', version: version, edits: [{ offset: 0, length: text.length, text: hmiTemplate(w, h, $('startScale').value) }] });
        };
        $('btnNewFlow').onclick = function () {
            zoom = null;
            vscode.postMessage({ type: 'edit', version: version, edits: [{ offset: 0, length: text.length, text: flowTemplate() }] });
        };
    })();

    // ------------------------------------------------------------------ toolbar

    function fillSelect(el, options) {
        el.innerHTML = '';
        options.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; el.appendChild(op); });
    }
    fillSelect($('windowPreview'), resolutionOptions(true));
    fillSelect($('viewport'), VIEWPORTS.map(function (v) { return [v[0] + 'x' + v[1], v[0] + ' × ' + v[1]]; }).concat([['custom', 'Custom…']]));

    var lastMode = null;
    function updateToolbar() {
        $('modeBadge').textContent = mode === 'hmi' ? 'Fixed page' : mode === 'flow' ? 'Flow page' : '';
        if (mode !== lastMode) { lastMode = mode; buildToolbox(); }
        if (mode === 'hmi') {
            var ps = pageSize(), key = ps.w + 'x' + ps.h;
            var opts = resolutionOptions(false).concat([['custom', 'Custom…']]);
            if (!opts.some(function (o) { return o[0] === key; })) opts.unshift([key, ps.w + ' × ' + ps.h]);
            fillSelect($('pageRes'), opts);
            $('pageRes').value = key;
            $('pageW').value = ps.w; $('pageH').value = ps.h;
            $('pageScale').value = scaleMode();
            $('windowPreview').value = ds.windowPreview || 'page';
            $('chkGrid').checked = !!ds.showGrid;
            $('chkSnap').checked = !!ds.snap;
            $('gridSize').value = ds.grid;
            var many = sel.length > 1, one = sel.length === 1 && nodeById(sel[0]) !== page;
            ['btnAlignLeft', 'btnAlignCenter', 'btnAlignRight', 'btnAlignTop', 'btnAlignMiddle', 'btnAlignBottom', 'btnSameWidth', 'btnSameHeight'].forEach(function (id) { $(id).disabled = !many; });
            $('btnDistH').disabled = $('btnDistV').disabled = sel.length < 3;
            $('btnFront').disabled = $('btnBack').disabled = !one;
            $('btnGroup').disabled = !(many || one);
            $('btnUngroup').disabled = !(one && elementChildren(nodeById(sel[0])).length);
            $('btnLock').disabled = !(many || one);
        }
        if (mode === 'flow') {
            var vk = ds.flowViewport.w + 'x' + ds.flowViewport.h;
            var known = VIEWPORTS.some(function (v) { return v[0] + 'x' + v[1] === vk; });
            $('viewport').value = known ? vk : 'custom';
            $('vpW').hidden = $('vpH').hidden = known;
            $('vpW').value = ds.flowViewport.w; $('vpH').value = ds.flowViewport.h;
        }
        $('btnDelete').disabled = $('btnDuplicate').disabled = !sel.length;
    }

    $('btnUndo').onclick = function () { vscode.postMessage({ type: 'undo' }); };
    $('btnRedo').onclick = function () { vscode.postMessage({ type: 'redo' }); };
    $('btnDelete').onclick = deleteSelected;
    $('btnDuplicate').onclick = duplicateSelected;
    $('btnUp').onclick = function () { moveSibling(-1); };
    $('btnDown').onclick = function () { moveSibling(1); };
    $('btnParent').onclick = escape;
    $('btnAlignLeft').onclick = function () { align('left'); };
    $('btnAlignCenter').onclick = function () { align('center'); };
    $('btnAlignRight').onclick = function () { align('right'); };
    $('btnAlignTop').onclick = function () { align('top'); };
    $('btnAlignMiddle').onclick = function () { align('middle'); };
    $('btnAlignBottom').onclick = function () { align('bottom'); };
    $('btnSameWidth').onclick = function () { sameSize('width'); };
    $('btnSameHeight').onclick = function () { sameSize('height'); };
    $('btnDistH').onclick = function () { distribute('h'); };
    $('btnDistV').onclick = function () { distribute('v'); };
    $('btnFront').onclick = function () { zOrder(true); };
    $('btnBack').onclick = function () { zOrder(false); };
    $('btnGroup').onclick = groupSelection;
    $('btnUngroup').onclick = ungroupSelection;
    $('btnLock').onclick = toggleLock;
    $('pageRes').onchange = function () {
        var v = this.value;
        if (v === 'custom') { $('pageW').hidden = $('pageH').hidden = false; return; }
        var p = v.split('x').map(Number);
        setPageSize(p[0], p[1]);
    };
    [$('pageW'), $('pageH')].forEach(function (i) { i.onchange = function () { var w = Number($('pageW').value), h = Number($('pageH').value); if (w >= 50 && h >= 50) setPageSize(w, h); }; });
    $('pageScale').onchange = function () { if (page) setAttr(page, 'data-scale', this.value); };
    $('windowPreview').onchange = function () { ds.windowPreview = this.value; zoom = null; persist(); updateStage(); var d = fdoc(); if (d) applyWindowPreview(d); updateOverlay(); };
    $('chkGrid').onchange = function () { ds.showGrid = this.checked; persist(); updateOverlay(); };
    $('chkSnap').onchange = function () { ds.snap = this.checked; persist(); };
    $('gridSize').onchange = function () { ds.grid = Math.max(2, Math.min(200, Number(this.value) || 10)); persist(); updateOverlay(); };
    $('viewport').onchange = function () {
        if (this.value === 'custom') { $('vpW').hidden = $('vpH').hidden = false; return; }
        var p = this.value.split('x').map(Number);
        ds.flowViewport = { w: p[0], h: p[1] };
        zoom = null; persist(); updateStage(); updateOverlay();
    };
    [$('vpW'), $('vpH')].forEach(function (i) { i.onchange = function () { ds.flowViewport = { w: Math.max(200, Number($('vpW').value) || 1280), h: Math.max(200, Number($('vpH').value) || 800) }; zoom = null; persist(); updateStage(); updateOverlay(); }; });
    $('btnZoomIn').onclick = function () { setZoom(zoom * 1.25); };
    $('btnZoomOut').onclick = function () { setZoom(zoom / 1.25); };
    $('btnFit').onclick = function () { fit(); updateStage(); var d = fdoc(); if (d) applyWindowPreview(d); updateOverlay(); };
    $('zoomBadge').onclick = function () { setZoom(1); };
    $('chkOutlines').onchange = function () { var d = fdoc(); if (d) d.documentElement.classList.toggle('rz-outlines', this.checked); };
    $('btnSource').onclick = function () { vscode.postMessage({ type: 'openSource' }); };
    $('btnBrowser').onclick = function () { vscode.postMessage({ type: 'openInBrowser' }); };

    document.querySelectorAll('.side-tab').forEach(function (b) {
        b.onclick = function () {
            document.querySelectorAll('.side-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
            $('paneOutline').hidden = b.dataset.pane !== 'outline';
            $('paneToolbox').hidden = b.dataset.pane !== 'toolbox';
        };
    });
    document.querySelectorAll('.splitter').forEach(function (sp) {
        sp.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            var side = sp.dataset.side === 'left' ? $('leftPanel') : $('propsPanel');
            var startX = ev.clientX, startW = side.offsetWidth;
            sp.classList.add('active');
            var mv = function (e) { var dd = e.clientX - startX; side.style.width = Math.max(150, Math.min(700, sp.dataset.side === 'left' ? startW + dd : startW - dd)) + 'px'; updateStage(); updateOverlay(); };
            var up = function () { sp.classList.remove('active'); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('mouseup', up);
        });
    });
    new ResizeObserver(function () { if (parsed && mode !== 'empty') { updateStage(); updateOverlay(); } }).observe(wrapper);

    // ------------------------------------------------------------------ messages

    window.addEventListener('message', function (event) {
        var msg = event.data;
        switch (msg.type) {
            case 'document':
                if (drag) { setTimeout(function () { window.postMessage(msg, '*'); }, 50); return; }
                loadDocument(msg);
                break;
            case 'cursor': {
                if (!parsed || drag || mode === 'empty') return;
                var best = null;
                parsed.nodes.forEach(function (n) { if (isEl(n) && n.start <= msg.offset && msg.offset < n.end && (!best || n.start >= best.start)) best = n; });
                if (best && !/^(html|head|body)$/i.test(best.name) && sel[0] !== best.id && (mode !== 'hmi' || isInside(best, page))) selectNode(best, { fromText: true, scroll: true });
                break;
            }
            case 'editRejected':
                pendingSel = null;
                statusEl.textContent = msg.reason || 'The file changed meanwhile; try again';
                break;
        }
    });

    window.__htmlDesigner = { select: select, state: function () { return { mode: mode, sel: sel.slice(), scopeId: scopeId, text: text, ds: ds }; }, nodeByPath: byNodePath, frame: frame, nodes: function () { return parsed; } };
    vscode.postMessage({ type: 'ready' });
})();
