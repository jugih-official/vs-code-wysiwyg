/*
 * Razor (Blazor) visual designer (webview side). Renders the component with the project's own CSS in an
 * iframe, lets you pick and change elements, and turns every change into a minimal text edit of the
 * .razor file (or of the CSS file that holds the rule you edit).
 */
(function () {
    'use strict';
    var R = window.RazorCore;
    var vscode = acquireVsCodeApi();

    var $ = function (id) { return document.getElementById(id); };
    var wrapper = $('canvasWrapper'), stage = $('stage'), frame = $('frame'), glass = $('glass');
    var selBox = $('selBox'), selLabel = $('selLabel'), hoverBox = $('hoverBox'), dropLine = $('dropLine'), overlay = $('overlay');
    var treeEl = $('tree'), propsEl = $('props'), propsHeader = $('propsHeader'), statusEl = $('status'), errorBanner = $('errorBanner');

    // ------------------------------------------------------------------ state
    var info = null;          // project info from the extension
    var project = null;       // { files: [{ path, name, parsed, scopeAttr, css, cssPath }], byName }
    var cur = -1;             // index of the edited file
    var text = '', version = -1;
    var lastAtoms = {};
    var sel = null;           // { f, id }
    var pendingSel = null;    // { offset } | { path }
    var saved = vscode.getState() || {};
    var ds = saved.ds || {};  // design state per file path
    var viewport = saved.viewport || { w: 1920, h: 1080 };
    var zoom = saved.zoom || null;
    var frameKey = null;      // what the iframe document was built for
    var sheets = [];          // [{ info, rules }] local stylesheets for rule lookup
    var scopedCss = '';

    function persist() { vscode.setState({ ds: ds, viewport: viewport, zoom: zoom }); }
    function fileState() {
        var key = info && project ? project.files[cur].path : '_';
        if (!ds[key]) ds[key] = { conds: {}, cases: {}, loops: 3, placeholders: true, layout: true };
        return ds[key];
    }

    // ------------------------------------------------------------------ project and document

    function loadProject(msg) {
        info = msg.project;
        var files = [];
        var byName = {};
        info.files.forEach(function (f, i) {
            var parsed = null;
            try { parsed = R.parseRazor(f.text); } catch (e) { parsed = null; }
            files.push({ path: f.path, name: f.name, parsed: parsed, css: f.css, cssPath: f.cssPath, scopeAttr: f.css !== null ? 'b-rz' + i : null, text: f.text });
            if (parsed && byName[f.name] === undefined) byName[f.name] = i;
        });
        project = { files: files, byName: byName };
        cur = info.files.findIndex(function (f) { return f.path === msg.current; });
        // Stylesheets: local sheets are parsed for rule lookup and editing.
        sheets = info.stylesheets.filter(function (s) { return s.path && s.text !== null; }).map(function (s) { return { info: s, rules: R.parseCss(s.text) }; });
        scopedCss = files.map(function (f) { return f.css !== null && f.scopeAttr ? R.scopeCss(f.css, f.scopeAttr) : ''; }).join('\n');
        frameKey = null;
        loadDocument({ text: msg.text, version: msg.version });
    }

    function loadDocument(msg) {
        text = msg.text;
        version = msg.version;
        var f = project.files[cur];
        var prevPath = sel && sel.f === cur ? nodePath(f.parsed, f.parsed.nodes[sel.id]) : null;
        var parsed;
        try {
            parsed = R.parseRazor(text);
        } catch (err) {
            var off = err && typeof err.offset === 'number' ? err.offset : 0;
            errorBanner.hidden = false;
            errorBanner.textContent = 'Razor error on line ' + lineOf(off) + ': ' + (err.message || err) + ' — the designer shows the last valid version. Click to go there.';
            errorBanner.onclick = function () { vscode.postMessage({ type: 'reveal', offset: off, end: off }); };
            return;
        }
        errorBanner.hidden = true;
        f.parsed = parsed;
        f.text = text;
        project.byName[f.name] = cur;
        sel = null;
        if (pendingSel && pendingSel.offset !== undefined) {
            var hit = parsed.nodes.filter(function (n) { return n.start === pendingSel.offset && (n.type === 'element' || n.type === 'if' || n.type === 'loop' || n.type === 'expr'); })[0];
            if (hit) sel = { f: cur, id: hit.id };
        }
        if (!sel) {
            var p = pendingSel && pendingSel.path !== undefined ? pendingSel.path : prevPath;
            var n = p !== null && p !== undefined ? byNodePath(parsed, p) : null;
            if (n) sel = { f: cur, id: n.id };
        }
        pendingSel = null;
        render();
    }

    function lineOf(offset) { var n = 1; for (var i = text.indexOf('\n'); i >= 0 && i < offset; i = text.indexOf('\n', i + 1)) n++; return n; }

    // Significant children for the outline and for moving.
    function kids(n) {
        var out = [];
        R.eachChild(n, function (c) {
            if (c.type === 'element' || c.type === 'if' || c.type === 'loop' || c.type === 'switch' || c.type === 'expr' || c.type === 'codeSection') out.push(c);
            else if (c.type === 'code') kids(c).forEach(function (x) { out.push(x); });
        });
        return out;
    }
    function parentOf(n) {
        for (var p = n.parent; p; p = p.parent) if (p.type === 'root' || p.type === 'element' || p.type === 'if' || p.type === 'loop' || p.type === 'switch') return p;
        return null;
    }
    function nodePath(parsed, n) {
        var parts = [];
        for (var x = n; x && x.type !== 'root'; x = parentOf(x)) {
            var p = parentOf(x);
            if (!p) break;
            parts.unshift(kids(p).indexOf(x));
        }
        return parts.join('/');
    }
    function byNodePath(parsed, path) {
        var n = parsed.root;
        if (path === '') return null;
        var parts = String(path).split('/');
        for (var i = 0; i < parts.length; i++) {
            var k = kids(n)[Number(parts[i])];
            if (!k) return n.type === 'root' ? null : n;
            n = k;
        }
        return n;
    }

    // ------------------------------------------------------------------ rendering into the iframe

    function layoutIndex() {
        var st = fileState();
        var f = project.files[cur];
        var isPage = f.parsed.directives.some(function (d) { return d.name === 'page'; });
        var ld = f.parsed.directives.filter(function (d) { return d.name === 'layout'; })[0];
        var name = ld ? ld.value.split('.').pop() : (isPage ? info.layoutName : null);
        if (!st.layout || !name || ld && /null/.test(ld.value)) return null;
        var i = project.byName[name];
        return i === undefined ? null : i;
    }

    function isDocument() {
        return project.files[cur].parsed.root.children.some(function (c) { return c.type === 'element' && c.name.toLowerCase() === 'html'; });
    }

    var DESIGN_CSS = '*{pointer-events:auto!important;cursor:default!important;-webkit-user-select:none!important;user-select:none!important;caret-color:transparent!important}' +
        '.rz-ph{outline:1px dotted rgba(0,120,215,.7);outline-offset:-1px}' +
        '.rz-comp-ph{display:inline-block;min-width:60px;min-height:22px;padding:2px 8px;border:1px dashed #8a8a8a;background:rgba(138,138,138,.12);color:#555;font:12px sans-serif}' +
        'html.rz-outlines [data-rz]{outline:1px dashed rgba(0,122,204,.55)!important;outline-offset:-1px}';

    function headHtml() {
        var h = '<meta charset="utf-8"><base href="' + esc(info.baseUri) + '">';
        info.stylesheets.forEach(function (s) {
            if (s.scopedBundle) h += '<style id="rz-scoped">' + scopedCss + '</style>';
            else h += '<link rel="stylesheet" href="' + esc(s.href) + '">';
        });
        if (!info.stylesheets.some(function (s) { return s.scopedBundle; }) && scopedCss) h += '<style id="rz-scoped">' + scopedCss + '</style>';
        return h + '<style id="rz-design">' + DESIGN_CSS + '</style>';
    }

    function render() {
        if (!project || cur < 0) return;
        var t0 = performance.now();
        var st = fileState();
        var r = R.render(project, cur, st, { layout: layoutIndex() });
        lastAtoms = r.atoms;
        var doc = isDocument();
        var key = doc ? 'doc:' + r.html : 'page:' + JSON.stringify(info.stylesheets.map(function (s) { return s.href; })) + scopedCss.length;
        var afterLoad = function () {
            var d = frame.contentDocument;
            if (!doc) d.body.innerHTML = r.html;
            d.documentElement.classList.toggle('rz-outlines', $('chkOutlines').checked);
            // Fonts and images change sizes after load: keep the overlay in place.
            if (d.fonts && d.fonts.ready) d.fonts.ready.then(updateOverlay);
            Array.prototype.forEach.call(d.images, function (img) { if (!img.complete) img.addEventListener('load', updateOverlay); });
            updateStage();
            updateOverlay();
            statusEl.textContent = project.files[cur].name + '.razor · rendered in ' + Math.round(performance.now() - t0) + ' ms';
        };
        if (frameKey !== key || !frame.contentDocument || !frame.contentDocument.body) {
            frameKey = key;
            var html = doc ? injectHead(r.html) : '<!DOCTYPE html><html><head>' + headHtml() + '</head><body></body></html>';
            frame.onload = function () { frame.onload = null; afterLoad(); };
            frame.srcdoc = html;
        } else afterLoad();
        renderTree();
        renderState();
        renderProps();
    }

    function injectHead(html) {
        var extra = '<base href="' + esc(info.baseUri) + '">' + (scopedCss ? '<style id="rz-scoped">' + scopedCss + '</style>' : '') + '<style id="rz-design">' + DESIGN_CSS + '</style>';
        // Scoped bundle links are replaced by the generated CSS.
        html = html.replace(/<link[^>]+(\.styles\.css|\.bundle\.scp\.css)[^>]*>/gi, '');
        if (/<head[^>]*>/i.test(html)) return '<!DOCTYPE html>' + html.replace(/<head([^>]*)>/i, '<head$1>' + extra);
        return '<!DOCTYPE html><html><head>' + extra + '</head><body>' + html + '</body></html>';
    }

    function updateStage() {
        frame.style.width = viewport.w + 'px';
        frame.style.height = viewport.h + 'px';
        if (!zoom) fit();
        frame.style.transform = 'scale(' + zoom + ')';
        stage.style.width = Math.ceil(viewport.w * zoom) + 'px';
        stage.style.height = Math.ceil(viewport.h * zoom) + 'px';
        glass.style.width = (stage.offsetLeft + stage.offsetWidth) + 'px';
        glass.style.height = (stage.offsetTop + stage.offsetHeight) + 'px';
        glass.style.left = '0px'; glass.style.top = '0px';
        $('zoomBadge').textContent = Math.round(zoom * 100) + '%';
    }
    function fit() {
        zoom = Math.max(0.05, Math.min(1, Math.min((wrapper.clientWidth - 60) / viewport.w, (wrapper.clientHeight - 60) / viewport.h)));
        persist();
    }
    function setZoom(z) {
        zoom = Math.max(0.05, Math.min(4, z));
        updateStage();
        updateOverlay();
        persist();
    }

    // ------------------------------------------------------------------ DOM lookups and overlay

    function fdoc() { return frame.contentDocument; }
    function domsFor(s) {
        var d = fdoc();
        if (!d || !s) return [];
        var key = s.f + ':' + s.id;
        var n = project.files[s.f].parsed.nodes[s.id];
        var list = [];
        if (n && n.type === 'element' && /^[A-Z]/.test(n.name.split('.').pop())) list = d.querySelectorAll('[data-rzc="' + key + '"], [data-rz="' + key + '"]');
        else if (n && n.type === 'expr') list = d.querySelectorAll('[data-rzx="' + key + '"]');
        else if (n && (n.type === 'if' || n.type === 'loop' || n.type === 'switch')) {
            // A block: the elements it renders.
            var out = [];
            kids(n).forEach(function (c) { domsFor({ f: s.f, id: c.id }).forEach(function (x) { out.push(x); }); });
            return out;
        } else list = d.querySelectorAll('[data-rz="' + key + '"]');
        return Array.prototype.slice.call(list);
    }

    function frameToWrapper(r) {
        var fr = frame.getBoundingClientRect(), w = wrapper.getBoundingClientRect();
        return { x: fr.left - w.left + wrapper.scrollLeft + r.left * zoom, y: fr.top - w.top + wrapper.scrollTop + r.top * zoom, w: r.width * zoom, h: r.height * zoom };
    }
    function unionRect(doms) {
        var box = null;
        doms.forEach(function (d) {
            var r = d.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (!box) box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            else { box.left = Math.min(box.left, r.left); box.top = Math.min(box.top, r.top); box.right = Math.max(box.right, r.right); box.bottom = Math.max(box.bottom, r.bottom); }
        });
        return box ? { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top } : null;
    }

    function updateOverlay() {
        selBox.style.display = 'none';
        overlay.querySelectorAll('.sel-copy').forEach(function (x) { x.remove(); });
        if (!sel) return;
        var n = project.files[sel.f].parsed.nodes[sel.id];
        var doms = domsFor(sel);
        if (!doms.length) return;
        var isComp = n.type === 'element' && /^[A-Z]/.test(n.name.split('.').pop());
        var first = isComp || n.type !== 'element' ? unionRect(doms.filter(function (d) { return d.getAttribute('data-rzc') === sel.f + ':' + sel.id || n.type !== 'element'; })) : unionRect([doms[0]]);
        if (!first) first = unionRect([doms[0]]);
        if (!first) return;
        var r = frameToWrapper(first);
        selBox.style.display = 'block';
        selBox.style.left = r.x + 'px'; selBox.style.top = r.y + 'px'; selBox.style.width = r.w + 'px'; selBox.style.height = r.h + 'px';
        selLabel.textContent = nodeLabel(n) + (sel.f !== cur ? ' — ' + project.files[sel.f].name + '.razor' : '');
        selBox.querySelectorAll('.handle').forEach(function (h) { h.remove(); });
        if (canResize(n)) {
            // Small boxes get only an outside corner handle, so a drag from the middle moves the element.
            var small = r.w < 36 || r.h < 36;
            var hs = small ? [['se', 100, 100]] : [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]];
            hs.forEach(function (h) {
                var hd = document.createElement('div');
                hd.className = 'handle'; hd.dataset.h = h[0]; hd.style.left = h[1] + '%'; hd.style.top = h[2] + '%';
                if (small) hd.style.margin = '2px 0 0 2px';
                selBox.appendChild(hd);
            });
        }
        // Other copies (loops) get a lighter frame.
        if (n.type === 'element' && !isComp) doms.slice(1, 40).forEach(function (d) {
            var rr = d.getBoundingClientRect();
            if (!rr.width && !rr.height) return;
            var q = frameToWrapper(rr);
            var c = document.createElement('div');
            c.className = 'hover-box sel-copy';
            c.style.display = 'block'; c.style.left = q.x + 'px'; c.style.top = q.y + 'px'; c.style.width = q.w + 'px'; c.style.height = q.h + 'px';
            overlay.appendChild(c);
        });
    }

    function nodeLabel(n) {
        if (!n) return '';
        switch (n.type) {
            case 'element': {
                var id = R.findAttr(n, 'id'), cls = R.findAttr(n, 'class');
                return '<' + n.name + '>' + (id && id.raw ? '#' + id.raw : '') + (cls && cls.raw && cls.raw.indexOf('@') < 0 ? '.' + cls.raw.trim().split(/\s+/).join('.') : '');
            }
            case 'if': return '@if (' + R.norm(n.branches[0].cond || '') + ')';
            case 'loop': return '@' + n.kw + ' (' + R.norm(n.header) + ')';
            case 'switch': return '@switch (' + R.norm(n.expr) + ')';
            case 'expr': return '@' + (n.explicit ? '(' + R.norm(n.code) + ')' : n.code);
            case 'codeSection': return '@code';
            default: return n.type;
        }
    }

    // ------------------------------------------------------------------ hit testing

    function framePoint(x, y) {
        var fr = frame.getBoundingClientRect();
        return { x: (x - fr.left) / zoom, y: (y - fr.top) / zoom };
    }

    /** Nodes under a point, topmost first, resolved to the edited file unless deep is set. */
    function nodesAt(x, y, deep) {
        var d = fdoc();
        if (!d) return [];
        var p = framePoint(x, y);
        if (p.x < 0 || p.y < 0 || p.x > viewport.w || p.y > viewport.h) return [];
        var list = d.elementsFromPoint(p.x, p.y);
        var out = [], seen = {}, exprs = [];
        list.forEach(function (el) {
            var s = resolve(el, deep);
            if (s && !seen[s.f + ':' + s.id]) { seen[s.f + ':' + s.id] = true; out.push(s); }
            // @expression placeholders come last: a click picks the element, Ctrl+click reaches the expression.
            var x = el.getAttribute && el.getAttribute('data-rzx');
            if (x) { var px = x.split(':').map(Number); if ((deep || px[0] === cur) && !seen[x]) { seen[x] = true; exprs.push({ f: px[0], id: px[1] }); } }
        });
        return out.concat(exprs);
    }
    function resolve(el, deep) {
        for (var e = el; e && e.getAttribute; e = e.parentElement) {
            var a = e.getAttribute('data-rz');
            if (a) { var pa = a.split(':').map(Number); if (deep || pa[0] === cur) return { f: pa[0], id: pa[1] }; }
            var c = e.getAttribute('data-rzc');
            if (c) { var pc = c.split(':').map(Number); if (pc[0] === cur && !deep) return { f: pc[0], id: pc[1] }; }
        }
        return null;
    }

    // ------------------------------------------------------------------ selection

    function select(s, opts) {
        opts = opts || {};
        sel = s;
        updateOverlay();
        renderTree();
        renderProps();
        updateBreadcrumb();
        if (s && s.f === cur && !opts.fromText) {
            var n = project.files[cur].parsed.nodes[s.id];
            vscode.postMessage({ type: 'reveal', offset: n.start, end: n.type === 'element' ? n.tagEnd : Math.min(n.end, n.start + 200) });
        }
        if (opts.scroll) scrollIntoView();
    }
    function selNode() { return sel ? project.files[sel.f].parsed.nodes[sel.id] : null; }

    function scrollIntoView() {
        var doms = domsFor(sel);
        var u = unionRect(doms.slice(0, 1));
        if (!u) return;
        var r = frameToWrapper(u);
        var vw = wrapper.clientWidth, vh = wrapper.clientHeight;
        if (r.x < wrapper.scrollLeft || r.x + Math.min(r.w, vw) > wrapper.scrollLeft + vw) wrapper.scrollLeft = r.x - Math.max(20, (vw - r.w) / 2);
        if (r.y < wrapper.scrollTop || r.y + Math.min(r.h, vh) > wrapper.scrollTop + vh) wrapper.scrollTop = r.y - Math.max(20, (vh - r.h) / 2);
    }

    function isComponent(n) { return n && n.type === 'element' && /^[A-Z]/.test(n.name.split('.').pop()); }
    function editable(n) { return sel && sel.f === cur && n; }
    function canResize(n) { return sel && sel.f === cur && n && n.type === 'element' && !isComponent(n) && !/^(html|head|body)$/i.test(n.name); }

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
        var n = selNode();
        pendingSel = selectAfter || (n && sel.f === cur ? { offset: shiftOffset(n.start, edits), path: nodePath(project.files[cur].parsed, n) } : null);
        vscode.postMessage({ type: 'edit', edits: edits, version: version });
    }
    function setAttr(n, name, value) { send([R.setAttrEdit(text, n, name, value)]); }

    function styleOf(n) { var a = R.findAttr(n, 'style'); return a ? a.raw : null; }
    function styleEditable(n) { var s = styleOf(n); return s === null || s.indexOf('@') < 0; }
    function setStyle(n, changes) {
        if (!styleEditable(n)) { statusEl.textContent = 'The style attribute is computed by code; edit it as text'; return false; }
        var ns = R.setStyleProps(styleOf(n) || '', changes);
        setAttr(n, 'style', ns ? ns : null);
        return true;
    }

    function deleteSelected() {
        var n = selNode();
        if (!editable(n) || n.type === 'codeSection') return;
        var p = parentOf(n);
        send([R.deleteNodeEdit(text, n)], { path: p && p.type !== 'root' ? nodePath(project.files[cur].parsed, p) : undefined });
    }

    function duplicateSelected() {
        var n = selNode();
        if (!editable(n) || n.type === 'codeSection') return;
        var copy = R.reindent(text, n, R.lineIndent(text, n.start));
        copy = copy.replace(/(\sid=")([^"@]*)(")/, '$1$2-copy$3');
        var ed = R.insertEdit(text, n, 'after', copy);
        send([ed], { offset: ed.offset + (ed.text.indexOf(copy) >= 0 ? ed.text.indexOf(copy) : 0) });
    }

    /** Moves node n before/after/inside target (all offsets from the current text). */
    function moveNode(n, target, where) {
        if (!target || target === n || isDescendant(target, n)) return;
        var sibs = kids(parentOf(n) || project.files[cur].parsed.root);
        var i = sibs.indexOf(n);
        if (where === 'after' && sibs[i - 1] === target) return;
        if (where === 'before' && sibs[i + 1] === target) return;
        var indent = where === 'inside' ? R.lineIndent(text, target.start) + detectUnit() : R.lineIndent(text, target.start);
        var moved = R.reindent(text, n, indent);
        var ins = R.insertEdit(text, target, where, moved);
        var del = R.deleteNodeEdit(text, n);
        var edits = [ins, del];
        // Where the moved element starts in the new text.
        var at = ins.offset + Math.max(0, ins.text.indexOf(moved));
        var newStart = at + (del.offset + del.length <= ins.offset ? -del.length : 0);
        send(edits, { offset: newStart });
    }
    function detectUnit() { return /\n\t+</.test(text) ? '\t' : '    '; }
    function isDescendant(a, b) { for (var p = a; p; p = p.parent) if (p === b) return true; return false; }

    function moveSibling(dir) {
        var n = selNode();
        if (!editable(n) || n.type === 'codeSection') return;
        var sibs = kids(parentOf(n) || project.files[cur].parsed.root).filter(function (x) { return x.type !== 'codeSection'; });
        var i = sibs.indexOf(n);
        var t = sibs[i + dir];
        if (!t) return;
        moveNode(n, t, dir < 0 ? 'before' : 'after');
    }

    // ------------------------------------------------------------------ mouse

    var drag = null;
    glass.addEventListener('mousedown', function (ev) {
        if (!project) return;
        wrapper.focus({ preventScroll: true });
        if (ev.button === 1 || (ev.button === 0 && spaceDown)) {
            ev.preventDefault();
            drag = { mode: 'pan', x: ev.clientX, y: ev.clientY, sl: wrapper.scrollLeft, st: wrapper.scrollTop };
            return;
        }
        if (ev.button !== 0) return;
        ev.preventDefault();
        var list = nodesAt(ev.clientX, ev.clientY, ev.shiftKey);
        if (!list.length) { select(null); return; }
        var s = list[0];
        if ((ev.ctrlKey || ev.metaKey) && sel) {
            var k = list.findIndex(function (x) { return x.f === sel.f && x.id === sel.id; });
            s = list[(k + 1) % list.length];
        }
        if (ev.altKey) {
            var n0 = project.files[s.f].parsed.nodes[s.id];
            var p0 = parentOf(n0);
            if (p0 && p0.type !== 'root') s = { f: s.f, id: p0.id };
        }
        if (!sel || sel.f !== s.f || sel.id !== s.id) select(s);
        var n = selNode();
        if (editable(n) && n.type === 'element') {
            var dom = domsFor(sel)[0];
            var pos = dom && dom.ownerDocument.defaultView.getComputedStyle(dom).position;
            drag = { mode: 'maybe', x: ev.clientX, y: ev.clientY, node: n, dom: dom, absolute: pos === 'absolute' || pos === 'fixed' };
        }
    });
    selBox.addEventListener('mousedown', function (ev) {
        var h = ev.target.closest('.handle');
        if (!h || !sel) return;
        ev.preventDefault();
        ev.stopPropagation();
        var n = selNode();
        var dom = domsFor(sel)[0];
        if (!dom) return;
        var cs = dom.ownerDocument.defaultView.getComputedStyle(dom);
        drag = { mode: 'resize', h: h.dataset.h, x: ev.clientX, y: ev.clientY, node: n, dom: dom, w: parseFloat(cs.width), hgt: parseFloat(cs.height), boxSizing: cs.boxSizing,
            pad: { x: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth), y: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) },
            left: parseFloat(cs.left), top: parseFloat(cs.top), absolute: cs.position === 'absolute' || cs.position === 'fixed', orig: dom.getAttribute('style') };
    });

    document.addEventListener('mousemove', function (ev) {
        if (drag) {
            if (drag.mode === 'pan') { wrapper.scrollLeft = drag.sl - (ev.clientX - drag.x); wrapper.scrollTop = drag.st - (ev.clientY - drag.y); updateOverlay(); return; }
            var dx = (ev.clientX - drag.x) / zoom, dy = (ev.clientY - drag.y) / zoom;
            if (drag.mode === 'maybe') {
                if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 5) return;
                drag.mode = drag.absolute ? 'moveAbs' : 'reorder';
                if (drag.dom) drag.origStyle = drag.dom.getAttribute('style');
            }
            dx = Math.round(dx); dy = Math.round(dy);
            drag.dx = dx; drag.dy = dy;
            if (drag.mode === 'moveAbs') {
                drag.dom.style.translate = dx + 'px ' + dy + 'px';
                $('coords').textContent = 'Δ ' + dx + ', ' + dy;
                updateOverlay();
            } else if (drag.mode === 'reorder') {
                drag.drop = dropTarget(ev.clientX, ev.clientY, drag.node);
                showDrop(drag.drop);
                if (drag.dom) drag.dom.style.opacity = '0.4';
            } else if (drag.mode === 'resize') {
                var h = drag.h;
                var w = drag.w + (h.indexOf('e') >= 0 ? dx : h.indexOf('w') >= 0 ? -dx : 0);
                var hh = drag.hgt + (h.indexOf('s') >= 0 ? dy : h.indexOf('n') >= 0 ? -dy : 0);
                if (h.indexOf('e') >= 0 || h.indexOf('w') >= 0) drag.dom.style.width = Math.max(0, w) + 'px';
                if (h.indexOf('n') >= 0 || h.indexOf('s') >= 0) drag.dom.style.height = Math.max(0, hh) + 'px';
                drag.nw = Math.max(0, w); drag.nh = Math.max(0, hh);
                $('coords').textContent = Math.round(drag.nw) + ' × ' + Math.round(drag.nh);
                updateOverlay();
            }
            return;
        }
        scheduleHover(ev.clientX, ev.clientY, ev.shiftKey);
    });

    document.addEventListener('mouseup', function () {
        if (!drag) return;
        var d = drag;
        drag = null;
        hideDrop();
        if (d.mode === 'moveAbs' && (d.dx || d.dy)) {
            var cs = d.dom.ownerDocument.defaultView.getComputedStyle(d.dom);
            d.dom.style.translate = '';
            var ch = {};
            if (d.dx) ch.left = Math.round(parseFloat(cs.left) + d.dx) + 'px';
            if (d.dy) ch.top = Math.round(parseFloat(cs.top) + d.dy) + 'px';
            if (!setStyle(d.node, ch)) render();
        } else if (d.mode === 'reorder') {
            if (d.dom) d.dom.style.opacity = '';
            if (d.drop) moveNode(d.node, d.drop.node, d.drop.where);
        } else if (d.mode === 'resize' && (d.dx || d.dy)) {
            var ch2 = {};
            var bb = d.boxSizing === 'border-box';
            if (d.h.indexOf('e') >= 0 || d.h.indexOf('w') >= 0) ch2.width = Math.round(d.nw) + 'px';
            if (d.h.indexOf('n') >= 0 || d.h.indexOf('s') >= 0) ch2.height = Math.round(d.nh) + 'px';
            void bb;
            if (d.absolute && d.h.indexOf('w') >= 0) ch2.left = Math.round(d.left + d.dx) + 'px';
            if (d.absolute && d.h.indexOf('n') >= 0) ch2.top = Math.round(d.top + d.dy) + 'px';
            if (!setStyle(d.node, ch2)) { d.dom.setAttribute('style', d.orig || ''); updateOverlay(); }
        }
    });

    // Where a drop lands: before/after/inside the element under the pointer.
    function dropTarget(x, y, moving) {
        var list = nodesAt(x, y, false);
        for (var i = 0; i < list.length; i++) {
            var n = project.files[list[i].f].parsed.nodes[list[i].id];
            if (!n || n.type !== 'element' || (moving && (n === moving || isDescendant(n, moving)))) continue;
            var dom = domsFor(list[i])[0];
            if (!dom) continue;
            var r = dom.getBoundingClientRect();
            var p = framePoint(x, y);
            var parentDom = dom.parentElement;
            var pcs = parentDom ? parentDom.ownerDocument.defaultView.getComputedStyle(parentDom) : null;
            var horizontal = pcs && ((pcs.display.indexOf('flex') >= 0 && pcs.flexDirection.indexOf('row') === 0) || pcs.display.indexOf('inline') >= 0 || getComputedStyleOf(dom).display.indexOf('inline') === 0);
            var canInside = !n.isVoid && !isComponent(n) && !/^(img|input|br|hr)$/i.test(n.name);
            var rel = horizontal ? (p.x - r.left) / Math.max(1, r.width) : (p.y - r.top) / Math.max(1, r.height);
            var where = canInside && rel > 0.25 && rel < 0.75 ? 'inside' : rel < 0.5 ? 'before' : 'after';
            return { node: n, where: where, rect: r, horizontal: horizontal };
        }
        return null;
    }
    function getComputedStyleOf(dom) { return dom.ownerDocument.defaultView.getComputedStyle(dom); }
    function showDrop(t) {
        if (!t) { hideDrop(); return; }
        var r = frameToWrapper(t.rect);
        dropLine.className = 'drop-line' + (t.where === 'inside' ? ' inside' : '');
        dropLine.style.display = 'block';
        if (t.where === 'inside') { dropLine.style.left = r.x + 'px'; dropLine.style.top = r.y + 'px'; dropLine.style.width = r.w + 'px'; dropLine.style.height = r.h + 'px'; }
        else if (t.horizontal) { dropLine.style.left = (t.where === 'before' ? r.x : r.x + r.w) - 1 + 'px'; dropLine.style.top = r.y + 'px'; dropLine.style.width = '3px'; dropLine.style.height = r.h + 'px'; }
        else { dropLine.style.left = r.x + 'px'; dropLine.style.top = (t.where === 'before' ? r.y : r.y + r.h) - 1 + 'px'; dropLine.style.width = r.w + 'px'; dropLine.style.height = '3px'; }
        $('coords').textContent = t.where + ' ' + nodeLabel(t.node);
    }
    function hideDrop() { dropLine.style.display = 'none'; }

    var hoverPending = null;
    function scheduleHover(x, y, deep) {
        if (hoverPending) { hoverPending.x = x; hoverPending.y = y; hoverPending.deep = deep; return; }
        hoverPending = { x: x, y: y, deep: deep };
        requestAnimationFrame(function () {
            var p = hoverPending; hoverPending = null;
            if (!project) return;
            var list = nodesAt(p.x, p.y, p.deep);
            if (!list.length || (sel && list[0].f === sel.f && list[0].id === sel.id)) { hoverBox.style.display = 'none'; return; }
            var u = unionRect(domsFor(list[0]).slice(0, 1));
            if (!u) { hoverBox.style.display = 'none'; return; }
            var r = frameToWrapper(u);
            hoverBox.style.display = 'block';
            hoverBox.style.left = r.x + 'px'; hoverBox.style.top = r.y + 'px'; hoverBox.style.width = r.w + 'px'; hoverBox.style.height = r.h + 'px';
            var n = project.files[list[0].f].parsed.nodes[list[0].id];
            $('coords').textContent = nodeLabel(n) + (list[0].f !== cur ? ' in ' + project.files[list[0].f].name + '.razor' : '') + ' · ' + Math.round(u.width) + ' × ' + Math.round(u.height);
        });
    }
    wrapper.addEventListener('mouseleave', function () { hoverBox.style.display = 'none'; });
    wrapper.addEventListener('wheel', function (ev) {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        setZoom(zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
    glass.addEventListener('dblclick', function (ev) {
        var list = nodesAt(ev.clientX, ev.clientY, true);
        if (!list.length) return;
        var s = list[0];
        var n = project.files[s.f].parsed.nodes[s.id];
        if (s.f === cur) vscode.postMessage({ type: 'reveal', offset: n.start, end: n.type === 'element' ? n.tagEnd : n.end, focus: true });
        else vscode.postMessage({ type: 'openFile', path: project.files[s.f].path, offset: n.start });
    });

    var spaceDown = false;
    document.addEventListener('keydown', function (ev) {
        var inInput = ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
        if (ev.key === ' ' && !inInput) spaceDown = true;
        if (inInput) return;
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === '=' || ev.key === '+')) { ev.preventDefault(); setZoom(zoom * 1.25); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key === '-') { ev.preventDefault(); setZoom(zoom / 1.25); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key === '0') { ev.preventDefault(); fit(); updateStage(); updateOverlay(); return; }
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); duplicateSelected(); return; }
        if (ev.key === 'Delete') { ev.preventDefault(); deleteSelected(); return; }
        if (ev.key === 'Escape') { var n = selNode(); var p = n && parentOf(n); if (p && p.type !== 'root') select({ f: sel.f, id: p.id }); return; }
        if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) { ev.preventDefault(); moveSibling(ev.key === 'ArrowUp' ? -1 : 1); return; }
        if (sel && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(ev.key) >= 0) {
            var nn = selNode();
            var dom = domsFor(sel)[0];
            if (!editable(nn) || !dom) return;
            var cs = getComputedStyleOf(dom);
            if (cs.position !== 'absolute' && cs.position !== 'fixed') return;
            ev.preventDefault();
            var stp = ev.shiftKey ? 10 : 1;
            var ch = {};
            if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') ch.left = Math.round(parseFloat(cs.left) + (ev.key === 'ArrowLeft' ? -stp : stp)) + 'px';
            else ch.top = Math.round(parseFloat(cs.top) + (ev.key === 'ArrowUp' ? -stp : stp)) + 'px';
            setStyle(nn, ch);
        }
    });
    document.addEventListener('keyup', function (ev) { if (ev.key === ' ') spaceDown = false; });

    // ------------------------------------------------------------------ outline tree

    var collapsed = new Set();
    function renderTree() {
        if (!project) return;
        var parsed = project.files[cur].parsed;
        var q = $('treeSearch').value.trim().toLowerCase();
        var rows = [];
        var selN = sel && sel.f === cur ? parsed.nodes[sel.id] : null;
        var open = {};
        for (var a = selN && parentOf(selN); a; a = parentOf(a)) open[a.id] = true;
        (function walk(n, depth) {
            kids(n).forEach(function (c) {
                var label = nodeLabel(c);
                var match = !q || label.toLowerCase().indexOf(q) >= 0;
                var ks = kids(c);
                var isOpen = !collapsed.has(c.id) || open[c.id];
                if (match) rows.push(treeRow(c, q ? 0 : depth, ks.length > 0 && !q, isOpen));
                if (q || isOpen) walk(c, depth + 1);
            });
        })(parsed.root, 0);
        treeEl.innerHTML = rows.join('') || '<div class="tree-more">Nothing to show</div>';
        var s = treeEl.querySelector('.tree-row.selected');
        if (s) { var tr = treeEl.getBoundingClientRect(), sr = s.getBoundingClientRect(); if (sr.top < tr.top || sr.bottom > tr.bottom) s.scrollIntoView({ block: 'center' }); }
    }
    function treeRow(n, depth, hasKids, isOpen) {
        var cls = n.type === 'element' ? (isComponent(n) ? 'tree-comp' : 'tree-kind') : n.type === 'expr' ? 'tree-expr' : 'tree-block';
        var main, extra = '';
        if (n.type === 'element') {
            main = isComponent(n) ? n.name : n.name;
            var id = R.findAttr(n, 'id'), c = R.findAttr(n, 'class');
            if (id && id.raw) extra += '#' + id.raw;
            if (c && c.raw) extra += c.raw.indexOf('@') >= 0 ? ' class=@…' : ' .' + c.raw.trim().replace(/\s+/g, ' .');
        } else main = nodeLabel(n);
        var selected = sel && sel.f === cur && sel.id === n.id;
        return '<div class="tree-row' + (selected ? ' selected' : '') + '" data-id="' + n.id + '" style="padding-left:' + (depth * 14 + 4) + 'px" title="Line ' + lineOf(n.start) + '">' +
            '<span class="tree-twisty" data-tw="1">' + (hasKids ? (isOpen ? '&#x25BE;' : '&#x25B8;') : '') + '</span><span class="' + cls + '">' + esc(main) + '</span>' +
            (extra ? '<span class="tree-cls">' + esc(extra.length > 60 ? extra.slice(0, 60) + '…' : extra) + '</span>' : '') + '</div>';
    }
    treeEl.addEventListener('mousedown', function (ev) {
        var row = ev.target.closest('.tree-row');
        if (!row) return;
        var id = Number(row.dataset.id);
        if (ev.target.dataset.tw) { if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); renderTree(); return; }
        select({ f: cur, id: id }, { scroll: true });
    });
    $('treeSearch').addEventListener('input', renderTree);

    function updateBreadcrumb() {
        var bc = $('breadcrumb');
        var n = selNode();
        if (!n) { bc.innerHTML = ''; return; }
        var parts = [];
        for (var x = n; x && x.type !== 'root'; x = parentOf(x)) parts.unshift('<span class="crumb" data-id="' + x.id + '">' + esc(nodeLabel(x)) + '</span>');
        bc.innerHTML = (sel.f !== cur ? esc(project.files[sel.f].name) + '.razor: ' : '') + parts.join(' › ');
    }
    $('breadcrumb').addEventListener('click', function (ev) {
        var c = ev.target.closest('.crumb');
        if (c) select({ f: sel.f, id: Number(c.dataset.id) }, { scroll: true });
    });

    // ------------------------------------------------------------------ state panel (design-time values)

    function renderState() {
        var st = fileState();
        var pane = $('statePane');
        var h = [];
        h.push('<div class="state-head">Page</div>');
        var li = layoutIndex();
        var f = project.files[cur];
        var isPage = f.parsed.directives.some(function (d) { return d.name === 'page'; });
        if (isPage || f.parsed.directives.some(function (d) { return d.name === 'layout'; })) {
            h.push('<div class="state-row"><input type="checkbox" id="stLayout"' + (st.layout ? ' checked' : '') + '><label for="stLayout">Show in layout' + (info.layoutName ? ' (' + esc(info.layoutName) + ')' : '') + '</label></div>');
        }
        h.push('<div class="state-row"><label>Loop repeats</label><input type="number" id="stLoops" min="0" max="50" value="' + st.loops + '"></div>');
        h.push('<div class="state-row"><input type="checkbox" id="stPh"' + (st.placeholders ? ' checked' : '') + '><label for="stPh">Show @expressions as placeholders</label></div>');
        var atoms = Object.keys(lastAtoms);
        var conds = atoms.filter(function (a) { return lastAtoms[a] === true; });
        var switches = atoms.filter(function (a) { return lastAtoms[a] && lastAtoms[a].cases; });
        if (conds.length) {
            h.push('<div class="state-head">Conditions (values at design time)</div>');
            conds.forEach(function (a, i) {
                var on = st.conds.hasOwnProperty(a) ? st.conds[a] : true;
                h.push('<div class="state-row"><input type="checkbox" data-cond="' + esc(a) + '" id="c' + i + '"' + (on ? ' checked' : '') + '><label for="c' + i + '" title="' + esc(a) + '">' + esc(a) + '</label></div>');
            });
        }
        if (switches.length) {
            h.push('<div class="state-head">Switches</div>');
            switches.forEach(function (a) {
                var pick = st.cases[a] || 0;
                h.push('<div class="state-row"><label title="' + esc(a) + '">' + esc(a) + '</label><select data-switch="' + esc(a) + '">' + lastAtoms[a].cases.map(function (c, i) { return '<option value="' + i + '"' + (i === pick ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>');
            });
        }
        if (!conds.length && !switches.length) h.push('<div class="hint">Conditions from @if and ?: appear here once the page uses them.</div>');
        pane.innerHTML = h.join('');
    }
    $('statePane').addEventListener('change', function (ev) {
        var st = fileState();
        var t = ev.target;
        if (t.id === 'stLayout') st.layout = t.checked;
        else if (t.id === 'stLoops') st.loops = Math.max(0, Math.min(50, Number(t.value) || 0));
        else if (t.id === 'stPh') st.placeholders = t.checked;
        else if (t.dataset.cond !== undefined) st.conds[t.dataset.cond] = t.checked;
        else if (t.dataset.switch !== undefined) st.cases[t.dataset.switch] = Number(t.value);
        persist();
        frameKey = t.id === 'stLayout' ? null : frameKey;
        render();
    });

    // ------------------------------------------------------------------ properties panel

    var STYLE_PROPS = ['width', 'height', 'min-width', 'max-width', 'margin', 'padding', 'display', 'flex-direction', 'gap', 'justify-content', 'align-items',
        'position', 'left', 'top', 'right', 'bottom', 'z-index', 'color', 'background', 'font-size', 'font-weight', 'line-height', 'text-align', 'border', 'border-radius', 'opacity'];

    function group(title) { var h = document.createElement('div'); h.className = 'prop-group'; h.textContent = title; return h; }
    function inputRow(label, value, placeholder, onCommit, opts) {
        opts = opts || {};
        var r = document.createElement('div');
        r.className = 'prop-row';
        var l = document.createElement('label');
        l.textContent = label;
        if (opts.set) l.className = 'set';
        if (opts.title) l.title = opts.title;
        r.appendChild(l);
        var box = document.createElement('div');
        box.className = 'prop-input';
        var inp = document.createElement('input');
        inp.type = 'text'; inp.spellcheck = false;
        inp.value = value === null || value === undefined ? '' : value;
        if (placeholder) inp.placeholder = placeholder;
        if (opts.readonly) inp.readOnly = true;
        inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } if (ev.key === 'Escape') { inp.value = value || ''; inp.blur(); } };
        inp.onchange = function () { if (inp.value !== (value || '')) onCommit(inp.value); };
        box.appendChild(inp);
        if (opts.button) { var b = document.createElement('button'); b.className = 'link-button'; b.textContent = opts.button.text; b.title = opts.button.title || ''; b.onclick = opts.button.onClick; box.appendChild(b); }
        r.appendChild(box);
        return r;
    }
    function note(t) { var d = document.createElement('div'); d.className = 'readonly-note'; d.textContent = t; return d; }

    function renderProps() {
        propsEl.innerHTML = '';
        var n = selNode();
        if (!n) { propsHeader.textContent = 'No selection'; return; }
        var f = project.files[sel.f];
        propsHeader.textContent = nodeLabel(n) + ' · ' + (sel.f !== cur ? f.name + '.razor ' : '') + 'line ' + lineIn(f.text, n.start);
        var frag = document.createDocumentFragment();
        if (sel.f !== cur) {
            frag.appendChild(note('This element belongs to ' + f.name + '.razor. Open that component to edit it; its CSS rules can be edited here.'));
            var ob = document.createElement('div'); ob.className = 'prop-add';
            ob.innerHTML = '<button>Open ' + esc(f.name) + '.razor in the designer</button>';
            ob.querySelector('button').onclick = function () { vscode.postMessage({ type: 'openInDesigner', path: f.path }); };
            frag.appendChild(ob);
            cssRules(frag, n);
            propsEl.appendChild(frag);
            return;
        }
        if (n.type === 'element') elementProps(frag, n);
        else if (n.type === 'if') {
            n.branches.forEach(function (b, i) {
                if (b.cond === null) return;
                var cs = b.start + text.substring(b.start).indexOf('(') + 1;
                frag.appendChild(inputRow(i === 0 ? 'if' : 'else if', R.norm(b.cond), '', function (v) { send([{ offset: cs, length: b.cond.length, text: v }]); }));
            });
            frag.appendChild(note('Which branch shows is set on the State tab.'));
        } else if (n.type === 'loop') {
            var hs = n.start + text.substring(n.start).indexOf('(') + 1;
            frag.appendChild(inputRow(n.kw, R.norm(n.header), '', function (v) { send([{ offset: hs, length: n.header.length, text: v }]); }));
            frag.appendChild(note('The body is repeated ' + fileState().loops + ' times at design time (State tab).'));
        } else if (n.type === 'expr') {
            var cs2 = n.start + (n.explicit ? 2 : 1);
            frag.appendChild(inputRow('expression', n.code, '', function (v) { send([{ offset: cs2, length: n.code.length, text: v }]); }));
            frag.appendChild(note('Evaluated when the app runs; the designer shows it as a placeholder.'));
        } else if (n.type === 'codeSection') frag.appendChild(note('C# code. Double-click in the outline or use Source to edit it.'));
        propsEl.appendChild(frag);
    }
    function lineIn(t, off) { var k = 1; for (var i = t.indexOf('\n'); i >= 0 && i < off; i = t.indexOf('\n', i + 1)) k++; return k; }

    function elementProps(frag, n) {
        var comp = isComponent(n);
        var dom = domsFor(sel)[0];
        var cs = dom && !comp ? getComputedStyleOf(dom) : null;
        // Where it is shown
        var conds = [];
        for (var p = n.parent; p; p = p.parent) {
            if (p.type === 'if') { var br = p.branches.filter(function (b) { return b.children.indexOf(n) >= 0 || b.children.some(function (c) { return isDescendant(n, c); }); })[0]; if (br) conds.unshift(br.cond ? '@if (' + R.norm(br.cond) + ')' : 'else'); }
            if (p.type === 'loop') conds.unshift('@' + p.kw);
        }
        if (conds.length) frag.appendChild(note('Shown ' + conds.join(' › ')));
        if (comp) {
            var name = n.name.split('.').pop();
            var fi = project.byName[name];
            frag.appendChild(group('Parameters'));
            var decl = fi !== undefined ? project.files[fi].parsed.params : {};
            var shown = {};
            n.attrs.forEach(function (a) { if (a.name[0] !== '@') { shown[a.name] = 1; frag.appendChild(attrRow(n, a.name, a.raw, decl[a.name] ? decl[a.name].type : '')); } });
            Object.keys(decl).forEach(function (k) {
                if (shown[k] || decl[k].cascading || /EventCallback|RenderFragment/.test(decl[k].type)) return;
                frag.appendChild(inputRow(k, '', decl[k].type + (decl[k].def ? ' = ' + decl[k].def : ''), function (v) { setAttr(n, k, v); }));
            });
            directiveRows(frag, n);
            if (fi !== undefined) {
                var ob = document.createElement('div'); ob.className = 'prop-add';
                ob.innerHTML = '<button>Open ' + esc(name) + '.razor in the designer</button>';
                ob.querySelector('button').onclick = function () { vscode.postMessage({ type: 'openInDesigner', path: project.files[fi].path }); };
                frag.appendChild(ob);
            } else frag.appendChild(note(name + ' is not a component of this project: it is shown as a placeholder.'));
            return;
        }
        // Text content
        var textKids = n.children.filter(function (c) { return c.type !== 'comment'; });
        if (textKids.length && textKids.every(function (c) { return c.type === 'text'; })) {
            var first = textKids[0], last = textKids[textKids.length - 1];
            var raw = text.substring(first.start, last.end);
            var lead = raw.length - raw.replace(/^\s+/, '').length, trail = raw.length - raw.replace(/\s+$/, '').length;
            var ts = first.start + lead, te = last.end - trail;
            if (te > ts) {
                frag.appendChild(group('Text'));
                frag.appendChild(inputRow('text', text.substring(ts, te), '', function (v) { send([{ offset: ts, length: te - ts, text: v.replace(/</g, '&lt;') }]); }));
            }
        }
        // Classes
        var cls = R.findAttr(n, 'class');
        frag.appendChild(group('Class'));
        if (!cls || cls.raw === null || cls.raw.indexOf('@') < 0) {
            var chips = document.createElement('div');
            chips.className = 'chips';
            var list = cls && cls.raw ? cls.raw.trim().split(/\s+/).filter(Boolean) : [];
            list.forEach(function (c) {
                var ch = document.createElement('span');
                ch.className = 'chip';
                ch.innerHTML = esc(c) + '<button title="Remove">&#x2715;</button>';
                ch.querySelector('button').onclick = function () { var nl = list.filter(function (x) { return x !== c; }).join(' '); setAttr(n, 'class', nl ? nl : null); };
                chips.appendChild(ch);
            });
            frag.appendChild(chips);
            frag.appendChild(inputRow('add class', '', 'name', function (v) { var add = v.trim().split(/\s+/).filter(function (x) { return x && list.indexOf(x) < 0; }); if (add.length) setAttr(n, 'class', list.concat(add).join(' ')); }));
        } else frag.appendChild(attrRow(n, 'class', cls.raw, 'computed by code'));
        // Inline style
        frag.appendChild(group('Style (inline)'));
        if (styleEditable(n)) {
            var styleList = R.parseStyle(styleOf(n) || '');
            var have = {};
            styleList.forEach(function (d) { have[d.prop] = d.value; });
            var props = STYLE_PROPS.slice();
            styleList.forEach(function (d) { if (props.indexOf(d.prop) < 0) props.push(d.prop); });
            props.forEach(function (prop) {
                var comp2 = cs ? cs.getPropertyValue(prop) : '';
                if (prop === 'background') comp2 = cs ? cs.backgroundColor : '';
                if (prop === 'border') comp2 = cs ? cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor : '';
                if (prop === 'margin' || prop === 'padding') comp2 = cs ? [cs[prop + 'Top'], cs[prop + 'Right'], cs[prop + 'Bottom'], cs[prop + 'Left']].join(' ') : '';
                var ch = {};
                frag.appendChild(inputRow(prop, have[prop] !== undefined ? have[prop] : '', comp2, function (v) { ch[prop] = v.trim() || null; setStyle(n, ch); }, { set: have[prop] !== undefined }));
            });
        } else frag.appendChild(attrRow(n, 'style', styleOf(n), 'computed by code'));
        // Attributes
        frag.appendChild(group('Attributes'));
        n.attrs.forEach(function (a) { if (a.name[0] !== '@' && a.name !== 'class' && a.name !== 'style') frag.appendChild(attrRow(n, a.name, a.raw, '')); });
        directiveRows(frag, n);
        var add = document.createElement('div');
        add.className = 'prop-add';
        add.innerHTML = '<input placeholder="Attribute" spellcheck="false"/><input placeholder="Value" spellcheck="false"/><button>Add</button>';
        var ins = add.querySelectorAll('input');
        add.querySelector('button').onclick = function () { var nm = ins[0].value.trim(); if (/^@?[A-Za-z_][\w:.\-]*$/.test(nm)) setAttr(n, nm, ins[1].value); };
        frag.appendChild(add);
        cssRules(frag, n);
    }

    function attrRow(n, name, raw, hint) {
        return inputRow(name, raw === null ? '' : raw, raw === null ? '(no value)' : hint, function (v) { setAttr(n, name, v === '' && raw !== null ? null : v); }, {
            set: true,
            button: { text: '✕', title: 'Remove ' + name, onClick: function () { setAttr(n, name, null); } },
        });
    }
    function directiveRows(frag, n) {
        var dir = n.attrs.filter(function (a) { return a.name[0] === '@'; });
        if (!dir.length) return;
        frag.appendChild(group('Events & bindings'));
        dir.forEach(function (a) { frag.appendChild(attrRow(n, a.name, a.raw, '')); });
    }

    /** The CSS rules that apply to the element, with editable declarations (written to the CSS file). */
    function cssRules(frag, n) {
        var dom = domsFor(sel)[0];
        if (!dom || isComponent(n)) return;
        var win = dom.ownerDocument.defaultView;
        var found = [];
        var testRules = function (rules, src, scopeAttr) {
            rules.forEach(function (r) {
                var selText = scopeAttr ? R.scopeSelector(r.selector, scopeAttr) : r.selector;
                var ok = false;
                try { ok = dom.matches(selText.replace(/::?(before|after|placeholder|selection|marker|first-line|first-letter|-webkit-[\w-]+)/g, '')); } catch (e) { ok = false; }
                if (!ok) return;
                var active = true;
                if (r.media) { try { active = win.matchMedia(r.media.replace(/^@media\s*/, '').replace(/ and @media /g, ' and ')).matches; } catch (e2) { active = true; } }
                found.push({ rule: r, src: src, active: active });
            });
        };
        sheets.forEach(function (s) { testRules(s.rules, { path: s.info.path, text: s.info.text, name: s.info.path.split(/[\\/]/).pop() }, null); });
        var f = project.files[sel.f];
        if (f.css !== null && f.scopeAttr) testRules(R.parseCss(f.css), { path: f.cssPath, text: f.css, name: f.cssPath.split(/[\\/]/).pop() }, f.scopeAttr);
        if (!found.length) return;
        frag.appendChild(group('CSS rules (edits go to the CSS file)'));
        found.reverse().forEach(function (m) {
            var box = document.createElement('div');
            box.className = 'rule' + (m.active ? '' : ' inactive');
            var line = lineIn(m.src.text, m.rule.start);
            box.innerHTML = '<div class="rule-head" title="Open the rule"><span class="sel">' + esc(m.rule.selector) + '</span><span class="src">' + esc(m.src.name) + ':' + line + '</span></div>';
            box.querySelector('.rule-head').onclick = function () { vscode.postMessage({ type: 'openFile', path: m.src.path, offset: m.rule.start }); };
            m.rule.decls.forEach(function (d) {
                box.appendChild(inputRow(d.prop, d.value, '', function (v) {
                    vscode.postMessage({ type: 'editFile', path: m.src.path, edits: [{ offset: d.vStart, length: d.vEnd - d.vStart, text: v, expect: m.src.text.substring(d.vStart, d.vEnd) }] });
                }));
            });
            box.appendChild(inputRow('+', '', 'property: value', function (v) {
                var mm = /^\s*([\w-]+)\s*:\s*(.+?);?\s*$/.exec(v);
                if (!mm) return;
                var at = m.rule.bodyEnd;
                var body = m.src.text.substring(m.rule.bodyStart, m.rule.bodyEnd);
                var indent = (/\n([ \t]+)\S/.exec(body) || [null, '    '])[1];
                var multi = body.indexOf('\n') >= 0;
                var trimmedEnd = at; while (trimmedEnd > m.rule.bodyStart && /\s/.test(m.src.text[trimmedEnd - 1])) trimmedEnd--;
                var needSemi = m.src.text[trimmedEnd - 1] !== ';' && m.src.text[trimmedEnd - 1] !== '{' ? ';' : '';
                var ins = multi ? needSemi + '\n' + indent + mm[1] + ': ' + mm[2] + ';' : needSemi + ' ' + mm[1] + ': ' + mm[2] + ';';
                vscode.postMessage({ type: 'editFile', path: m.src.path, edits: [{ offset: trimmedEnd, length: 0, text: ins, expect: '' }] });
            }));
            frag.appendChild(box);
        });
    }

    // ------------------------------------------------------------------ toolbox

    var TOOLS = [
        ['div', 'Dv', '<div></div>'], ['section', 'Sc', '<section></section>'], ['p', 'P', '<p>Text</p>'], ['span', 'Sp', '<span>Text</span>'],
        ['h1', 'H1', '<h1>Heading</h1>'], ['h2', 'H2', '<h2>Heading</h2>'], ['h3', 'H3', '<h3>Heading</h3>'],
        ['button', 'Bt', '<button type="button">Button</button>'], ['input', 'In', '<input type="text" />'], ['label', 'Lb', '<label>Label</label>'],
        ['textarea', 'Ta', '<textarea></textarea>'], ['select', 'Se', '<select>\n    <option>Option</option>\n</select>'],
        ['img', 'Im', '<img src="" alt="" />'], ['a', 'A', '<a href="">Link</a>'], ['ul', 'Ul', '<ul>\n    <li>Item</li>\n</ul>'],
        ['table', 'Tb', '<table>\n    <thead><tr><th>Header</th></tr></thead>\n    <tbody><tr><td>Cell</td></tr></tbody>\n</table>'],
    ];
    (function () {
        var tb = $('toolbox');
        TOOLS.forEach(function (t) {
            var d = document.createElement('div');
            d.className = 'tool';
            d.draggable = true;
            d.innerHTML = '<span class="tool-icon">' + t[1] + '</span>&lt;' + t[0] + '&gt;';
            d.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/x-rz-tool', t[0]); ev.dataTransfer.effectAllowed = 'copy'; });
            tb.appendChild(d);
        });
    })();
    function isTool(ev) { return Array.prototype.indexOf.call(ev.dataTransfer.types, 'text/x-rz-tool') >= 0; }
    glass.addEventListener('dragover', function (ev) {
        if (!project || !isTool(ev)) return;
        ev.preventDefault();
        showDrop(dropTarget(ev.clientX, ev.clientY, null));
    });
    glass.addEventListener('dragleave', hideDrop);
    glass.addEventListener('drop', function (ev) {
        hideDrop();
        if (!isTool(ev)) return;
        ev.preventDefault();
        var name = ev.dataTransfer.getData('text/x-rz-tool');
        var t = dropTarget(ev.clientX, ev.clientY, null);
        var markup = TOOLS.filter(function (x) { return x[0] === name; })[0][2];
        var target = t ? t.node : null, where = t ? t.where : 'inside';
        if (!target) {
            // Empty page: append at the end of the markup (before @code).
            var parsed = project.files[cur].parsed;
            var code = parsed.nodes.filter(function (x) { return x.type === 'codeSection'; })[0];
            var off = code ? code.start : text.length;
            send([{ offset: off, length: 0, text: markup + '\n\n' }], { offset: off });
            return;
        }
        var indent = where === 'inside' ? R.lineIndent(text, target.start) + detectUnit() : R.lineIndent(text, target.start);
        var nl = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
        var m2 = markup.split('\n').map(function (l, i) { return i ? indent + l : l; }).join(nl);
        var ed = R.insertEdit(text, target, where, m2);
        send([ed], { offset: ed.offset + Math.max(0, ed.text.indexOf(m2)) });
    });

    // ------------------------------------------------------------------ toolbar and panels

    $('btnUndo').onclick = function () { vscode.postMessage({ type: 'undo' }); };
    $('btnRedo').onclick = function () { vscode.postMessage({ type: 'redo' }); };
    $('btnDelete').onclick = deleteSelected;
    $('btnDuplicate').onclick = duplicateSelected;
    $('btnUp').onclick = function () { moveSibling(-1); };
    $('btnDown').onclick = function () { moveSibling(1); };
    $('btnParent').onclick = function () { var n = selNode(); var p = n && parentOf(n); if (p && p.type !== 'root') select({ f: sel.f, id: p.id }, { scroll: true }); };
    $('btnZoomIn').onclick = function () { setZoom(zoom * 1.25); };
    $('btnZoomOut').onclick = function () { setZoom(zoom / 1.25); };
    $('btnFit').onclick = function () { fit(); updateStage(); updateOverlay(); };
    $('zoomBadge').onclick = function () { setZoom(1); };
    $('btnSource').onclick = function () { vscode.postMessage({ type: 'openSource' }); };
    $('chkOutlines').onchange = function () { var d = fdoc(); if (d) d.documentElement.classList.toggle('rz-outlines', this.checked); };

    var vpSel = $('viewport'), vpW = $('vpW'), vpH = $('vpH');
    (function initViewport() {
        var key = viewport.w + 'x' + viewport.h;
        var found = Array.prototype.some.call(vpSel.options, function (o) { return o.value === key; });
        vpSel.value = found ? key : 'custom';
        vpW.value = viewport.w; vpH.value = viewport.h;
        vpW.hidden = vpH.hidden = found;
    })();
    vpSel.onchange = function () {
        if (vpSel.value === 'custom') { vpW.hidden = vpH.hidden = false; return; }
        vpW.hidden = vpH.hidden = true;
        var p = vpSel.value.split('x').map(Number);
        viewport = { w: p[0], h: p[1] };
        vpW.value = p[0]; vpH.value = p[1];
        zoom = null;
        updateStage(); updateOverlay(); persist();
    };
    [vpW, vpH].forEach(function (i) { i.onchange = function () { viewport = { w: Math.max(200, Number(vpW.value) || 1280), h: Math.max(200, Number(vpH.value) || 800) }; zoom = null; updateStage(); updateOverlay(); persist(); }; });

    document.querySelectorAll('.side-tab').forEach(function (b) {
        b.onclick = function () {
            document.querySelectorAll('.side-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
            ['outline', 'state', 'toolbox'].forEach(function (p) { $('pane' + p[0].toUpperCase() + p.substring(1)).hidden = b.dataset.pane !== p; });
        };
    });
    document.querySelectorAll('.splitter').forEach(function (sp) {
        sp.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
            var side = sp.dataset.side === 'left' ? $('leftPanel') : $('propsPanel');
            var startX = ev.clientX, startW = side.offsetWidth;
            sp.classList.add('active');
            var mv = function (e) { var d = e.clientX - startX; side.style.width = Math.max(150, Math.min(700, sp.dataset.side === 'left' ? startW + d : startW - d)) + 'px'; updateStage(); updateOverlay(); };
            var up = function () { sp.classList.remove('active'); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('mouseup', up);
        });
    });
    new ResizeObserver(function () { if (project) { updateStage(); updateOverlay(); } }).observe(wrapper);
    wrapper.addEventListener('scroll', function () { /* the overlay scrolls with the content */ });

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    // ------------------------------------------------------------------ messages

    window.addEventListener('message', function (event) {
        var msg = event.data;
        switch (msg.type) {
            case 'project':
                loadProject(msg);
                break;
            case 'document':
                if (drag) { setTimeout(function () { window.postMessage(msg, '*'); }, 50); return; }
                if (project) loadDocument(msg);
                break;
            case 'cursor': {
                if (!project || drag) return;
                var n = R.nodeAtOffset(project.files[cur].parsed, msg.offset);
                if (n && !(sel && sel.f === cur && sel.id === n.id)) select({ f: cur, id: n.id }, { fromText: true, scroll: true });
                break;
            }
            case 'editRejected':
                pendingSel = null;
                statusEl.textContent = msg.reason || 'The file changed meanwhile; try again';
                break;
        }
    });

    window.__razorDesigner = { select: select, project: function () { return project; }, cur: function () { return cur; }, text: function () { return text; }, frame: frame };
    vscode.postMessage({ type: 'ready' });
})();
