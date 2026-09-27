/*
 * WPF visual designer (webview side). Renders the XAML with WpfCore exactly as WPF lays it out and turns
 * mouse and property-panel changes into minimal text edits of the XAML, applied by the extension.
 */
(function () {
    'use strict';
    var C = window.WpfCore;
    var vscode = acquireVsCodeApi();

    // ------------------------------------------------------------------ state
    var text = '';
    var version = -1;
    var model = null;
    var images = {};
    var selId = null;
    var zoom = 1;
    var fitted = false;
    var saved = vscode.getState() || {};
    var tabPaths = saved.tabPaths || {};        // TabControl path -> TabItem path (designer-only tab choice)
    var expanded = new Set(saved.expanded || []); // tree paths
    var pendingSel = null;                      // { offset } or { path } to select after the next document
    var lastSentVersion = -1;
    if (typeof saved.zoom === 'number') { zoom = saved.zoom; fitted = true; }

    var $ = function (id) { return document.getElementById(id); };
    var wrapper = $('canvasWrapper'), stage = $('stage'), surface = $('surface');
    var selBox = $('selBox'), hoverBox = $('hoverBox'), selLabel = $('selLabel'), overlay = $('overlay');
    var treeEl = $('tree'), propsEl = $('props'), propsHeader = $('propsHeader');
    var statusEl = $('status'), errorBanner = $('errorBanner');

    function persist() {
        vscode.setState({ zoom: zoom, tabPaths: tabPaths, expanded: Array.from(expanded).slice(0, 2000), selPath: selId !== null && model ? pathOf(model.all[selId]) : null });
    }

    // ------------------------------------------------------------------ model helpers

    function uiChildren(el) {
        var list = [];
        if (el.headerEl) list.push(el.headerEl);
        for (var i = 0; i < el.children.length; i++) list.push(el.children[i]);
        if (el.contentEl) list.push(el.contentEl);
        return list;
    }
    function pathOf(el) {
        var parts = [];
        for (var e = el; e && e.parent; e = e.parent) parts.push(uiChildren(e.parent).indexOf(e));
        return parts.reverse().join('/');
    }
    function byPath(p) {
        if (!model) return null;
        var el = model.root;
        if (p === '' || p === null || p === undefined) return p === '' ? el : null;
        var parts = String(p).split('/');
        for (var i = 0; i < parts.length; i++) {
            var kids = uiChildren(el);
            var k = kids[Number(parts[i])];
            if (!k) return el;
            el = k;
        }
        return el;
    }
    function label(el) { return el.kind + (el.name ? ' ' + el.name : ''); }
    function lineOf(offset) { var n = 1; for (var i = text.indexOf('\n'); i >= 0 && i < offset; i = text.indexOf('\n', i + 1)) n++; return n; }
    function effective(el, prop) { return C.getValue(model, el, prop); }
    function effStr(el, prop) { var v = effective(el, prop).value; return typeof v === 'string' ? v : null; }
    function localAttr(el, prop) { return el.attrs[prop] ? el.attrs[prop].value : null; }

    // ------------------------------------------------------------------ document load and render

    function loadDocument(msg) {
        text = msg.text;
        version = msg.version;
        if (msg.images) images = msg.images;
        var prevSelPath = selId !== null && model ? pathOf(model.all[selId]) : (saved.selPath || null);
        saved.selPath = null;
        var newModel;
        try {
            newModel = C.buildModel(C.parseXml(text));
        } catch (err) {
            var off = err && typeof err.offset === 'number' ? err.offset : 0;
            errorBanner.hidden = false;
            errorBanner.textContent = 'XAML error on line ' + lineOf(off) + ': ' + (err && err.message ? err.message : String(err)) + ' — the designer shows the last valid version. Click to go there.';
            errorBanner.onclick = function () { vscode.postMessage({ type: 'reveal', offset: off, end: off }); };
            return;
        }
        errorBanner.hidden = true;
        model = newModel;
        selId = null;
        if (pendingSel && pendingSel.offset !== undefined) {
            for (var i = 0; i < model.all.length; i++) if (model.all[i].node.start === pendingSel.offset) { selId = i; break; }
        }
        if (selId === null) {
            var p = pendingSel && pendingSel.path !== undefined ? pendingSel.path : prevSelPath;
            if (p !== null && p !== undefined) { var el = byPath(p); if (el) selId = el.id; }
        }
        pendingSel = null;
        if (selId !== null) ensureVisibleTab(model.all[selId]);
        render();
    }

    function selectedTabsById() {
        var map = {};
        Object.keys(tabPaths).forEach(function (tcp) {
            var tc = byPath(tcp), ti = byPath(tabPaths[tcp]);
            if (tc && ti && tc.kind === 'TabControl' && ti.parent === tc) map[tc.id] = ti.id;
        });
        return map;
    }

    function render() {
        if (!model) return;
        var t0 = performance.now();
        var html = C.renderModel(model, { images: images, selectedTabs: selectedTabsById() });
        surface.innerHTML = html;
        postLayout();
        updateStage();
        if (!fitted) { fitToView(); fitted = true; }
        updateOverlay();
        renderTree();
        renderProps();
        statusEl.textContent = model.all.length + ' elements · rendered in ' + Math.round(performance.now() - t0) + ' ms';
    }

    // Layout that depends on measured sizes: Viewbox scaling and Stretch on geometry.
    function postLayout() {
        var boxes = surface.querySelectorAll('[data-viewbox]');
        for (var i = 0; i < boxes.length; i++) {
            var vb = boxes[i], inner = vb.firstElementChild;
            if (!inner) continue;
            inner.style.transform = 'none';
            var nw = inner.offsetWidth, nh = inner.offsetHeight, bw = vb.clientWidth, bh = vb.clientHeight;
            if (!nw || !nh) continue;
            var mode = vb.getAttribute('data-viewbox'), dir = vb.getAttribute('data-stretchdir');
            var sx = bw / nw, sy = bh / nh;
            if (mode === 'Uniform') sx = sy = Math.min(sx, sy);
            else if (mode === 'UniformToFill') sx = sy = Math.max(sx, sy);
            else if (mode === 'None') sx = sy = 1;
            if (dir === 'UpOnly') { sx = Math.max(1, sx); sy = Math.max(1, sy); }
            if (dir === 'DownOnly') { sx = Math.min(1, sx); sy = Math.min(1, sy); }
            var x = (bw - nw * sx) / 2, y = (bh - nh * sy) / 2;
            inner.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')';
        }
        var geoms = surface.querySelectorAll('[data-fitgeom]');
        for (var g = 0; g < geoms.length; g++) {
            try {
                var svg = geoms[g], bb = svg.getBBox();
                if (bb.width > 0 && bb.height > 0) {
                    svg.setAttribute('viewBox', bb.x + ' ' + bb.y + ' ' + bb.width + ' ' + bb.height);
                    svg.setAttribute('preserveAspectRatio', svg.getAttribute('data-fitgeom') === 'Fill' ? 'none' : 'xMidYMid meet');
                }
            } catch (e) { /* not rendered */ }
        }
    }

    function naturalSize() {
        var r = surface.firstElementChild;
        return r ? { w: r.offsetWidth, h: r.offsetHeight } : { w: 0, h: 0 };
    }
    function updateStage() {
        var n = naturalSize();
        surface.style.transform = 'scale(' + zoom + ')';
        stage.style.width = Math.ceil(n.w * zoom) + 'px';
        stage.style.height = Math.ceil(n.h * zoom) + 'px';
        $('zoomBadge').textContent = Math.round(zoom * 100) + '%';
    }
    function setZoom(z, cx, cy) {
        z = Math.max(0.05, Math.min(8, z));
        var wr = wrapper.getBoundingClientRect();
        if (cx === undefined) { cx = wr.left + wrapper.clientWidth / 2; cy = wr.top + wrapper.clientHeight / 2; }
        var sr = stage.getBoundingClientRect();
        var ux = (cx - sr.left) / zoom, uy = (cy - sr.top) / zoom;
        zoom = z;
        updateStage();
        var sr2 = stage.getBoundingClientRect();
        wrapper.scrollLeft += (sr2.left + ux * zoom) - cx;
        wrapper.scrollTop += (sr2.top + uy * zoom) - cy;
        updateOverlay();
        persist();
    }
    function fitToView() {
        var n = naturalSize();
        if (!n.w || !n.h) return;
        zoom = Math.max(0.05, Math.min(1, Math.min((wrapper.clientWidth - 60) / n.w, (wrapper.clientHeight - 60) / n.h)));
        updateStage();
        wrapper.scrollLeft = 0; wrapper.scrollTop = 0;
        updateOverlay();
        persist();
    }

    // ------------------------------------------------------------------ selection and overlay

    function domFor(id) { return surface.querySelector('[data-i="' + id + '"]'); }

    function rectIn(el) {
        var r = el.getBoundingClientRect(), w = wrapper.getBoundingClientRect();
        return { x: r.left - w.left + wrapper.scrollLeft, y: r.top - w.top + wrapper.scrollTop, w: r.width, h: r.height };
    }

    function updateOverlay() {
        selBox.style.display = 'none';
        if (selId === null || !model) return;
        var d = domFor(selId);
        if (!d) return;
        var r = rectIn(d);
        if (r.w === 0 && r.h === 0) return;
        selBox.style.display = 'block';
        selBox.style.left = r.x + 'px'; selBox.style.top = r.y + 'px';
        selBox.style.width = r.w + 'px'; selBox.style.height = r.h + 'px';
        var el = model.all[selId];
        selLabel.textContent = label(el);
        selBox.querySelectorAll('.handle').forEach(function (h) { h.remove(); });
        if (canResize(el)) {
            [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]].forEach(function (h) {
                var hd = document.createElement('div');
                hd.className = 'handle';
                hd.dataset.h = h[0];
                hd.style.left = h[1] + '%';
                hd.style.top = h[2] + '%';
                selBox.appendChild(hd);
            });
        }
    }

    function select(id, opts) {
        opts = opts || {};
        if (id !== null && model.all[id] && ensureVisibleTab(model.all[id])) {
            selId = id;
            render();
        } else {
            selId = id;
            updateOverlay();
            renderTree();
            renderProps();
        }
        if (id !== null && !opts.fromText) {
            var n = model.all[id].node;
            vscode.postMessage({ type: 'reveal', offset: n.start, end: n.tagEnd });
        }
        if (opts.scroll && id !== null) scrollIntoView(id);
        updateBreadcrumb();
        persist();
    }

    function scrollIntoView(id) {
        var d = domFor(id);
        if (!d) return;
        var r = rectIn(d);
        var vw = wrapper.clientWidth, vh = wrapper.clientHeight;
        if (r.x < wrapper.scrollLeft || r.x + Math.min(r.w, vw) > wrapper.scrollLeft + vw) wrapper.scrollLeft = r.x - Math.max(20, (vw - r.w) / 2);
        if (r.y < wrapper.scrollTop || r.y + Math.min(r.h, vh) > wrapper.scrollTop + vh) wrapper.scrollTop = r.y - Math.max(20, (vh - r.h) / 2);
    }

    /** Makes sure the TabItems around el are the shown ones; returns true when a tab changed. */
    function ensureVisibleTab(el) {
        var changed = false;
        for (var e = el; e && e.parent; e = e.parent) {
            if (e.kind === 'TabItem' && e.parent.kind === 'TabControl' && e !== e.parent.headerEl) {
                var tcp = pathOf(e.parent), tip = pathOf(e);
                var current = selectedTabsById()[e.parent.id];
                if (current === undefined) {
                    // What the renderer shows without a choice: SelectedIndex / IsSelected / first.
                    var items = e.parent.children.filter(function (c) { return c.kind === 'TabItem'; });
                    var si = C.num(localAttr(e.parent, 'SelectedIndex'));
                    var sel = items.filter(function (c) { return localAttr(c, 'IsSelected') === 'True'; })[0] || items[si !== null && items[si] ? si : 0];
                    current = sel ? sel.id : undefined;
                }
                if (current !== e.id) { tabPaths[tcp] = tip; changed = true; }
            }
        }
        return changed;
    }

    /** Elements under a screen point, topmost first (WPF hit-testing rules as rendered). */
    function idsAt(x, y) {
        var list = document.elementsFromPoint(x, y);
        var ids = [];
        for (var i = 0; i < list.length; i++) {
            var n = list[i];
            if (!surface.contains(n)) continue;
            for (var d = n; d && d !== surface; d = d.parentElement) {
                var a = d.getAttribute('data-hit') || d.getAttribute('data-i');
                if (a !== null) {
                    var id = Number(a);
                    if (ids.indexOf(id) < 0) ids.push(id);
                    break;
                }
            }
        }
        return ids;
    }

    function pick(x, y, ev) {
        var ids = idsAt(x, y);
        if (!ids.length) return null;
        var id = ids[0];
        if (ev && (ev.ctrlKey || ev.metaKey) && selId !== null) {
            // Ctrl+click: step through the elements stacked under the pointer.
            var k = ids.indexOf(selId);
            id = ids[(k + 1) % ids.length];
        }
        if (ev && ev.altKey && model.all[id].parent) id = model.all[id].parent.id;
        return id;
    }

    // ------------------------------------------------------------------ geometry helpers

    /** Screen pixels per element unit of el's parent coordinate space. */
    function scaleOf(dom) {
        for (var d = dom.parentElement; d && d !== document.body; d = d.parentElement) {
            if (d.offsetWidth > 0) {
                var r = d.getBoundingClientRect();
                return r.width / d.offsetWidth;
            }
        }
        return zoom;
    }
    function renderedSize(el) {
        var d = domFor(el.id);
        if (!d) return { w: 0, h: 0 };
        if (d.offsetWidth !== undefined && !(d instanceof SVGElement)) return { w: d.offsetWidth, h: d.offsetHeight };
        var r = d.getBoundingClientRect(), s = scaleOf(d);
        return { w: r.width / s, h: r.height / s };
    }

    function layoutOf(el) {
        var p = el.parent;
        if (!p) return 'root';
        if (el === p.headerEl) return 'fixed';
        switch (p.kind) {
            case 'Canvas': return 'canvas';
            case 'StackPanel': case 'VirtualizingStackPanel': case 'WrapPanel': return 'stack';
            case 'TabControl': case 'Menu': case 'StatusBar': return 'fixed';
            case 'Window': return el.kind === 'Viewbox' ? 'fixed' : 'cell';
            case 'Viewbox': return 'fixed';
            default: return 'cell';
        }
    }
    function canMove(el) { var l = layoutOf(el); return l !== 'root' && l !== 'fixed'; }
    function canResize(el) { return el.kind !== 'Window' && layoutOf(el) !== 'root' && el.kind !== 'TabItem'; }

    function r2(v) { return Math.round(v * 100) / 100; }

    /** Attribute changes that move el by (dx, dy) element units. */
    function moveAttrs(el, dx, dy) {
        var out = {};
        var lk = layoutOf(el);
        if (lk === 'canvas') {
            if (dx) {
                var L = C.num(effStr(el, 'Canvas.Left')), R = C.num(effStr(el, 'Canvas.Right'));
                if (L === null && R !== null) out['Canvas.Right'] = C.fmt(r2(R - dx));
                else out['Canvas.Left'] = C.fmt(r2((L || 0) + dx));
            }
            if (dy) {
                var T = C.num(effStr(el, 'Canvas.Top')), B = C.num(effStr(el, 'Canvas.Bottom'));
                if (T === null && B !== null) out['Canvas.Bottom'] = C.fmt(r2(B - dy));
                else out['Canvas.Top'] = C.fmt(r2((T || 0) + dy));
            }
            return out;
        }
        var m = C.parseThickness(effStr(el, 'Margin') || '0');
        var ha = effStr(el, 'HorizontalAlignment') || 'Stretch', va = effStr(el, 'VerticalAlignment') || 'Stretch';
        if (dx) {
            if (lk === 'stack' || ha === 'Center' || ha === 'Stretch') { m.l += dx; m.r -= dx; }
            else if (ha === 'Right') m.r -= dx;
            else m.l += dx;
        }
        if (dy) {
            if (lk === 'stack' || va === 'Center' || va === 'Stretch') { m.t += dy; m.b -= dy; }
            else if (va === 'Bottom') m.b -= dy;
            else m.t += dy;
        }
        m = { l: r2(m.l), t: r2(m.t), r: r2(m.r), b: r2(m.b) };
        out.Margin = C.formatThickness(m, localAttr(el, 'Margin'));
        return out;
    }

    /** Attribute changes for dragging a resize handle by (dx, dy). */
    function resizeAttrs(el, h, dx, dy) {
        var out = {};
        var lk = layoutOf(el);
        var size = renderedSize(el);
        var axis = function (horizontal) {
            var d = horizontal ? dx : dy;
            var far = horizontal ? h.indexOf('e') >= 0 : h.indexOf('s') >= 0;
            var near = horizontal ? h.indexOf('w') >= 0 : h.indexOf('n') >= 0;
            if (!d || (!far && !near)) return;
            var P = horizontal ? 'Width' : 'Height';
            var cur = C.num(effStr(el, P));
            var align = effStr(el, horizontal ? 'HorizontalAlignment' : 'VerticalAlignment') || 'Stretch';
            if (lk === 'canvas') {
                var base = cur !== null ? cur : (horizontal ? size.w : size.h);
                out[P] = C.fmt(Math.max(0, r2(base + (far ? d : -d))));
                var startProp = horizontal ? 'Canvas.Left' : 'Canvas.Top', endProp = horizontal ? 'Canvas.Right' : 'Canvas.Bottom';
                var S = C.num(effStr(el, startProp)), E = C.num(effStr(el, endProp));
                if (near && !(S === null && E !== null)) out[startProp] = C.fmt(r2((S || 0) + d));
                if (far && S === null && E !== null) out[endProp] = C.fmt(r2(E - d));
                return;
            }
            var m = out.Margin ? C.parseThickness(out.Margin) : C.parseThickness(effStr(el, 'Margin') || '0');
            var nearKey = horizontal ? 'l' : 't', farKey = horizontal ? 'r' : 'b';
            if (align === 'Stretch' && cur === null) {
                if (far) m[farKey] -= d; else m[nearKey] += d;
            } else {
                var base2 = cur !== null ? cur : (horizontal ? size.w : size.h);
                out[P] = C.fmt(Math.max(0, r2(base2 + (far ? d : -d))));
                var startAligned = align === 'Left' || align === 'Top';
                var endAligned = align === 'Right' || align === 'Bottom';
                if (near && !endAligned) m[nearKey] += d;
                if (far && !startAligned) m[farKey] -= d;
                if (lk === 'stack' && near) { m[nearKey] = m[nearKey]; }
            }
            m = { l: r2(m.l), t: r2(m.t), r: r2(m.r), b: r2(m.b) };
            var orig = C.parseThickness(effStr(el, 'Margin') || '0');
            if (m.l !== orig.l || m.t !== orig.t || m.r !== orig.r || m.b !== orig.b) out.Margin = C.formatThickness(m, localAttr(el, 'Margin'));
        };
        axis(true);
        axis(false);
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

    function send(edits, selectAfter) {
        edits = mergeEdits(edits);
        if (!edits.length) return;
        // selectAfter offsets are positions in the edited text; otherwise the selection follows its element.
        pendingSel = selectAfter || (selId !== null ? { offset: shiftOffset(model.all[selId].node.start, edits), path: pathOf(model.all[selId]) } : null);
        lastSentVersion = version;
        vscode.postMessage({ type: 'edit', edits: edits, version: version });
    }
    function shiftOffset(off, edits) {
        var delta = 0;
        edits.forEach(function (e) { if (e.offset + e.length <= off && !(e.length === 0 && e.offset === off)) delta += e.text.length - e.length; });
        return off + delta;
    }

    function attrEdits(el, attrs) {
        return Object.keys(attrs).map(function (k) { return C.setAttrEdit(text, el.node, k, attrs[k]); });
    }

    function setAttr(el, name, value) {
        send([C.setAttrEdit(text, el.node, name, value)]);
    }

    function deleteSelected() {
        if (selId === null) return;
        var el = model.all[selId];
        if (!el.parent) return;
        var parentPath = pathOf(el.parent);
        send([C.deleteElementEdit(text, el.node)], { path: parentPath });
    }

    function uniqueName(base) {
        var n = base, i = 1;
        while (model.byName[n]) n = base + (++i);
        return n;
    }

    function duplicateSelected() {
        if (selId === null) return;
        var el = model.all[selId];
        if (!el.parent || el.parent.kind === 'TabControl') return;
        var copy = text.substring(el.node.start, el.node.end);
        var taken = {};
        copy = copy.replace(/(\s(?:x:)?Name=")([^"]*)(")/g, function (m, a, name, b) {
            var nn = uniqueName(name + '_Copy');
            while (taken[nn]) nn = uniqueName(nn + '_');
            taken[nn] = true;
            return a + nn + b;
        });
        // Offset the copy a little so it can be seen and grabbed (same effective values as the original).
        var tmp = C.buildModel(C.parseXml(copy)).root;
        var shift = layoutOf(el) === 'canvas' || layoutOf(el) === 'cell' ? moveAttrs(el, 10, 10) : {};
        Object.keys(shift).forEach(function (k) {
            var ed = C.setAttrEdit(copy, tmp.node, k, shift[k]);
            copy = copy.substring(0, ed.offset) + ed.text + copy.substring(ed.offset + ed.length);
            tmp = C.buildModel(C.parseXml(copy)).root;
        });
        var nl = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
        var indent = C.lineIndent(text, el.node.start);
        var ins = nl + indent + copy;
        send([{ offset: el.node.end, length: 0, text: ins }], { offset: el.node.end + nl.length + indent.length });
    }

    // ------------------------------------------------------------------ mouse: select, move, resize, pan

    var drag = null;      // { mode: 'move'|'resize'|'pan'|'maybe', ... }

    wrapper.addEventListener('mousedown', function (ev) {
        if (!model) return;
        wrapper.focus({ preventScroll: true });
        if (ev.button === 1 || (ev.button === 0 && spaceDown)) {
            ev.preventDefault();
            drag = { mode: 'pan', x: ev.clientX, y: ev.clientY, sl: wrapper.scrollLeft, st: wrapper.scrollTop };
            wrapper.classList.add('panning');
            return;
        }
        if (ev.button !== 0) return;
        var handle = ev.target.closest && ev.target.closest('.handle');
        if (handle && selId !== null) {
            ev.preventDefault();
            var d = domFor(selId);
            drag = { mode: 'resize', h: handle.dataset.h, x: ev.clientX, y: ev.clientY, id: selId, dom: d, scale: scaleOf(d), start: renderedSize(model.all[selId]), orig: { w: d.style.width, h: d.style.height, tr: d.style.translate } };
            return;
        }
        var id = pick(ev.clientX, ev.clientY, ev);
        if (id === null) { select(null); return; }
        ev.preventDefault();
        // A click on a tab header shows that tab.
        var tabDom = document.elementsFromPoint(ev.clientX, ev.clientY).filter(function (n) { return n.getAttribute && n.getAttribute('data-tabcontrol'); })[0];
        if (tabDom && !(ev.ctrlKey || ev.altKey)) {
            var ti = model.all[Number(tabDom.getAttribute('data-i'))];
            if (ti) {
                tabPaths[pathOf(ti.parent)] = pathOf(ti);
                selId = ti.id;
                render();
                select(ti.id);
                return;
            }
        }
        if (id !== selId) select(id);
        var el = model.all[id];
        if (canMove(el)) {
            var dom = domFor(id);
            drag = { mode: 'maybe', x: ev.clientX, y: ev.clientY, id: id, dom: dom, scale: scaleOf(dom), origTranslate: dom.style.translate };
        }
    });

    document.addEventListener('mousemove', function (ev) {
        if (drag) {
            if (drag.mode === 'pan') {
                wrapper.scrollLeft = drag.sl - (ev.clientX - drag.x);
                wrapper.scrollTop = drag.st - (ev.clientY - drag.y);
                updateOverlay();
                return;
            }
            var dx = (ev.clientX - drag.x) / drag.scale, dy = (ev.clientY - drag.y) / drag.scale;
            if (drag.mode === 'maybe') {
                if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 4) return;
                drag.mode = 'move';
            }
            if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
            dx = Math.round(dx); dy = Math.round(dy);
            drag.dx = dx; drag.dy = dy;
            if (drag.mode === 'move') {
                drag.dom.style.translate = dx + 'px ' + dy + 'px';
                $('coords').textContent = 'Δ ' + dx + ', ' + dy;
            } else if (drag.mode === 'resize') {
                var h = drag.h;
                var w = drag.start.w + (h.indexOf('e') >= 0 ? dx : h.indexOf('w') >= 0 ? -dx : 0);
                var hh = drag.start.h + (h.indexOf('s') >= 0 ? dy : h.indexOf('n') >= 0 ? -dy : 0);
                drag.dom.style.width = Math.max(0, w) + 'px';
                drag.dom.style.height = Math.max(0, hh) + 'px';
                drag.dom.style.translate = (h.indexOf('w') >= 0 ? dx : 0) + 'px ' + (h.indexOf('n') >= 0 ? dy : 0) + 'px';
                $('coords').textContent = Math.round(Math.max(0, w)) + ' × ' + Math.round(Math.max(0, hh));
            }
            updateOverlay();
            return;
        }
        scheduleHover(ev.clientX, ev.clientY);
    });

    document.addEventListener('mouseup', function () {
        if (!drag) return;
        var d = drag;
        drag = null;
        wrapper.classList.remove('panning');
        if (d.mode === 'move' && (d.dx || d.dy)) {
            var el = model.all[d.id];
            send(attrEdits(el, moveAttrs(el, d.dx, d.dy)));
        } else if (d.mode === 'resize' && (d.dx || d.dy)) {
            var el2 = model.all[d.id];
            send(attrEdits(el2, resizeAttrs(el2, d.h, d.dx, d.dy)));
        } else if (d.dom && (d.mode === 'move' || d.mode === 'resize')) {
            d.dom.style.translate = d.origTranslate || '';
            updateOverlay();
        }
    });

    var hoverPending = null;
    function scheduleHover(x, y) {
        if (hoverPending) { hoverPending.x = x; hoverPending.y = y; return; }
        hoverPending = { x: x, y: y };
        requestAnimationFrame(function () {
            var p = hoverPending;
            hoverPending = null;
            if (!model) return;
            var wr = wrapper.getBoundingClientRect();
            if (p.x < wr.left || p.x > wr.right || p.y < wr.top || p.y > wr.bottom) { hoverBox.style.display = 'none'; return; }
            var ids = idsAt(p.x, p.y);
            if (!ids.length || ids[0] === selId) { hoverBox.style.display = 'none'; }
            else {
                var d = domFor(ids[0]);
                if (d) {
                    var r = rectIn(d);
                    hoverBox.style.display = 'block';
                    hoverBox.style.left = r.x + 'px'; hoverBox.style.top = r.y + 'px';
                    hoverBox.style.width = r.w + 'px'; hoverBox.style.height = r.h + 'px';
                    hoverBox.title = label(model.all[ids[0]]);
                }
            }
            // Position under the pointer in the coordinates of the hovered element's parent.
            if (ids.length) {
                var el = model.all[ids[0]];
                var pd = el.parent ? domFor(el.parent.id) : null;
                if (pd) {
                    var pr = pd.getBoundingClientRect(), s = pd.offsetWidth ? pr.width / pd.offsetWidth : zoom;
                    $('coords').textContent = label(el) + ' · x ' + Math.round((p.x - pr.left) / s) + ', y ' + Math.round((p.y - pr.top) / s) + ' in ' + el.parent.kind;
                }
            }
        });
    }

    wrapper.addEventListener('mouseleave', function () { hoverBox.style.display = 'none'; });
    wrapper.addEventListener('scroll', function () { /* overlay scrolls with content */ });
    wrapper.addEventListener('wheel', function (ev) {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        setZoom(zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), ev.clientX, ev.clientY);
    }, { passive: false });
    wrapper.addEventListener('dblclick', function (ev) {
        // Double click: go into the text of the element.
        var id = pick(ev.clientX, ev.clientY, null);
        if (id === null) return;
        var n = model.all[id].node;
        vscode.postMessage({ type: 'reveal', offset: n.start, end: n.tagEnd, focus: true });
    });

    var spaceDown = false;
    document.addEventListener('keydown', function (ev) {
        var inInput = ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA');
        if (ev.key === ' ' && !inInput) { spaceDown = true; }
        if (inInput) return;
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === '=' || ev.key === '+')) { ev.preventDefault(); setZoom(zoom * 1.25); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key === '-') { ev.preventDefault(); setZoom(zoom / 1.25); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key === '0') { ev.preventDefault(); fitToView(); return; }
        if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); duplicateSelected(); return; }
        if (ev.key === 'Delete') { ev.preventDefault(); deleteSelected(); return; }
        if (ev.key === 'Escape') { if (selId !== null && model.all[selId].parent) select(model.all[selId].parent.id, { scroll: false }); return; }
        if (selId !== null && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(ev.key) >= 0) {
            var el = model.all[selId];
            if (!canMove(el)) return;
            ev.preventDefault();
            var st = ev.shiftKey ? 10 : 1;
            var dx = ev.key === 'ArrowLeft' ? -st : ev.key === 'ArrowRight' ? st : 0;
            var dy = ev.key === 'ArrowUp' ? -st : ev.key === 'ArrowDown' ? st : 0;
            send(attrEdits(el, moveAttrs(el, dx, dy)));
        }
    });
    document.addEventListener('keyup', function (ev) { if (ev.key === ' ') spaceDown = false; });

    // ------------------------------------------------------------------ outline tree

    function renderTree() {
        if (!model) return;
        var q = $('treeSearch').value.trim().toLowerCase();
        var rows = [];
        if (q) {
            var n = 0;
            for (var i = 0; i < model.all.length && n < 300; i++) {
                var e = model.all[i];
                if ((e.name && e.name.toLowerCase().indexOf(q) >= 0) || e.kind.toLowerCase() === q || e.kind.toLowerCase().indexOf(q) === 0) {
                    rows.push(rowHtml(e, 0, false, true));
                    n++;
                }
            }
            if (!rows.length) rows.push('<div class="tree-more">No match</div>');
            treeEl.innerHTML = rows.join('');
            return;
        }
        // Expand the path to the selection.
        if (selId !== null) for (var a = model.all[selId].parent; a; a = a.parent) expanded.add(pathOf(a));
        expanded.add('');
        (function walk(e, depth) {
            var kids = uiChildren(e);
            var p = pathOf(e);
            var open = expanded.has(p);
            rows.push(rowHtml(e, depth, kids.length > 0, false, open));
            if (open) {
                var limit = 600;
                for (var k = 0; k < kids.length && k < limit; k++) walk(kids[k], depth + 1);
                if (kids.length > limit) rows.push('<div class="tree-more" style="padding-left:' + (depth * 14 + 30) + 'px">… ' + (kids.length - limit) + ' more — use Find</div>');
            }
        })(model.root, 0);
        treeEl.innerHTML = rows.join('');
        var s = treeEl.querySelector('.tree-row.selected');
        if (s) {
            var tr = treeEl.getBoundingClientRect(), sr = s.getBoundingClientRect();
            if (sr.top < tr.top || sr.bottom > tr.bottom) s.scrollIntoView({ block: 'center' });
        }
    }
    function rowHtml(e, depth, hasKids, flat, open) {
        var hidden = effStr(e, 'Visibility');
        var dim = hidden === 'Hidden' || hidden === 'Collapsed';
        var tw = hasKids ? (open ? '&#x25BE;' : '&#x25B8;') : '';
        return '<div class="tree-row' + (e.id === selId ? ' selected' : '') + (dim ? ' tree-dim' : '') + '" data-id="' + e.id + '" style="padding-left:' + (depth * 14 + 4) + 'px" title="Line ' + lineOf(e.node.start) + (dim ? ' · ' + hidden : '') + '">' +
            '<span class="tree-twisty" data-tw="1">' + tw + '</span><span class="tree-kind">' + esc(e.kind) + '</span>' + (e.name ? '<span class="tree-name">' + esc(e.name) + '</span>' : '') +
            (flat && e.parent ? '<span class="tree-dim" style="margin-left:6px">in ' + esc(label(e.parent)) + '</span>' : '') + '</div>';
    }
    treeEl.addEventListener('mousedown', function (ev) {
        var row = ev.target.closest('.tree-row');
        if (!row) return;
        var e = model.all[Number(row.dataset.id)];
        if (ev.target.dataset.tw) {
            var p = pathOf(e);
            if (expanded.has(p)) expanded.delete(p); else expanded.add(p);
            renderTree();
            persist();
            return;
        }
        select(e.id, { scroll: true });
    });
    treeEl.addEventListener('dblclick', function (ev) {
        var row = ev.target.closest('.tree-row');
        if (!row) return;
        var e = model.all[Number(row.dataset.id)];
        var p = pathOf(e);
        if (expanded.has(p)) expanded.delete(p); else expanded.add(p);
        renderTree();
    });
    $('treeSearch').addEventListener('input', renderTree);

    function updateBreadcrumb() {
        var bc = $('breadcrumb');
        if (selId === null || !model) { bc.innerHTML = ''; return; }
        var parts = [];
        for (var e = model.all[selId]; e; e = e.parent) parts.unshift('<span class="crumb" data-id="' + e.id + '">' + esc(label(e)) + '</span>');
        bc.innerHTML = parts.join(' › ');
    }
    $('breadcrumb').addEventListener('click', function (ev) {
        var c = ev.target.closest('.crumb');
        if (c) select(Number(c.dataset.id), { scroll: true });
    });

    // ------------------------------------------------------------------ properties panel

    var ALIGN_H = ['Left', 'Center', 'Right', 'Stretch'], ALIGN_V = ['Top', 'Center', 'Bottom', 'Stretch'];
    var ENUMS = {
        HorizontalAlignment: ALIGN_H, VerticalAlignment: ALIGN_V, HorizontalContentAlignment: ALIGN_H, VerticalContentAlignment: ALIGN_V,
        Visibility: ['Visible', 'Hidden', 'Collapsed'], Stretch: ['None', 'Fill', 'Uniform', 'UniformToFill'],
        TextWrapping: ['NoWrap', 'Wrap', 'WrapWithOverflow'], TextAlignment: ['Left', 'Center', 'Right', 'Justify'],
        FontWeight: ['Thin', 'ExtraLight', 'Light', 'Normal', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'],
        FontStyle: ['Normal', 'Italic', 'Oblique'], Orientation: ['Horizontal', 'Vertical'], 'DockPanel.Dock': ['Left', 'Top', 'Right', 'Bottom'],
        IsEnabled: ['True', 'False'], IsChecked: ['True', 'False'], LastChildFill: ['True', 'False'], ClipToBounds: ['True', 'False'],
        TextTrimming: ['None', 'CharacterEllipsis', 'WordEllipsis'], TabStripPlacement: ['Top', 'Bottom', 'Left', 'Right'],
        Cursor: ['Arrow', 'Hand', 'IBeam', 'Wait', 'Cross', 'SizeAll', 'No'], Focusable: ['True', 'False'], IsHitTestVisible: ['True', 'False'],
    };
    var COLOR_PROPS = { Background: 1, Foreground: 1, BorderBrush: 1, Fill: 1, Stroke: 1, OpacityMask: 1 };
    var TEXTUAL = { Label: 1, Button: 1, ToggleButton: 1, RepeatButton: 1, CheckBox: 1, RadioButton: 1, TextBlock: 1, TextBox: 1, MenuItem: 1, TabItem: 1, StatusBarItem: 1, ComboBox: 1, GroupBox: 1, Expander: 1 };

    function propGroups(el) {
        var p = el.parent, k = el.kind;
        var layout = ['Width', 'Height'];
        if (p && p.kind === 'Canvas') layout.push('Canvas.Left', 'Canvas.Top');
        if (p && p.kind === 'Grid') layout.push('Grid.Row', 'Grid.Column', 'Grid.RowSpan', 'Grid.ColumnSpan');
        if (p && p.kind === 'DockPanel') layout.push('DockPanel.Dock');
        layout.push('Margin', 'HorizontalAlignment', 'VerticalAlignment', 'Panel.ZIndex', 'MinWidth', 'MinHeight');
        var look = ['Visibility', 'Opacity'];
        if (k === 'Rectangle' || k === 'Ellipse' || k === 'Path' || k === 'Polygon' || k === 'Polyline' || k === 'Line') look.push('Fill', 'Stroke', 'StrokeThickness');
        if (k === 'Rectangle') look.push('RadiusX', 'RadiusY');
        if (k === 'Image') look.push('Source', 'Stretch');
        if (k === 'Border') look.push('Background', 'BorderBrush', 'BorderThickness', 'CornerRadius', 'Padding');
        if (/^(Grid|Canvas|StackPanel|WrapPanel|DockPanel|Window|UserControl|Page)$/.test(k)) look.push('Background');
        if (TEXTUAL[k] || k === 'ProgressBar' || k === 'DataGrid' || k === 'ListBox') look.push('Background', 'Foreground', 'BorderBrush', 'BorderThickness', 'Padding');
        if (k === 'StackPanel' || k === 'WrapPanel' || k === 'ProgressBar' || k === 'Slider') look.push('Orientation');
        look.push('RenderTransformOrigin', 'Cursor');
        var txt = [];
        if (k === 'TextBlock' || k === 'TextBox') txt.push('Text');
        if (/^(Label|Button|ToggleButton|RepeatButton|CheckBox|RadioButton|StatusBarItem|ContentControl|GroupBox|Expander)$/.test(k)) txt.push('Content', 'ContentStringFormat');
        if (k === 'MenuItem' || k === 'TabItem' || k === 'GroupBox' || k === 'Expander') txt.push('Header');
        if (TEXTUAL[k] || k === 'Window' || k === 'TabControl') txt.push('FontSize', 'FontFamily', 'FontWeight', 'FontStyle');
        if (k === 'TextBlock' || k === 'TextBox') txt.push('TextWrapping', 'TextAlignment', 'TextTrimming');
        if (/^(Label|Button|TextBox|ToggleButton)$/.test(k)) txt.push('HorizontalContentAlignment', 'VerticalContentAlignment');
        if (k === 'Window') { layout = ['Width', 'Height']; look = ['Background']; txt = ['Title', 'FontSize', 'FontFamily']; }
        var groups = [['Layout', layout], ['Appearance', look]];
        if (txt.length) groups.push(['Text', txt]);
        if (k === 'ProgressBar' || k === 'Slider') groups.push(['Range', ['Minimum', 'Maximum', 'Value']]);
        if (k === 'Grid') groups.push(['Grid', ['RowDefinitions', 'ColumnDefinitions']]);
        return groups;
    }

    function displayValue(v) {
        if (v === undefined) return '';
        if (v === null) return '{x:Null}';
        if (typeof v === 'object' && v.node) return '<' + v.node.localName + '>';
        return String(v);
    }

    function renderProps() {
        propsEl.innerHTML = '';
        if (selId === null || !model) { propsHeader.textContent = 'No selection'; return; }
        var el = model.all[selId];
        propsHeader.textContent = label(el) + '  ·  line ' + lineOf(el.node.start);
        propsHeader.title = el.node.name;
        var shown = {};
        var frag = document.createDocumentFragment();

        var nameRow = row(el, el.attrs['Name'] ? 'Name' : 'x:Name', 'Name');
        frag.appendChild(nameRow);
        shown.Name = shown['x:Name'] = true;

        propGroups(el).forEach(function (g) {
            var h = document.createElement('div');
            h.className = 'prop-group';
            h.textContent = g[0];
            frag.appendChild(h);
            g[1].forEach(function (p) { if (!shown[p]) { frag.appendChild(row(el, p)); shown[p] = true; } });
        });

        // Inner text content (<Label>Text</Label>)
        var tr = innerTextRange(el);
        if (tr) {
            var h2 = document.createElement('div');
            h2.className = 'prop-group';
            h2.textContent = 'Content text';
            frag.appendChild(h2);
            frag.appendChild(innerTextRow(el, tr));
        }

        var others = Object.keys(el.attrs).filter(function (k) { return !shown[k]; });
        if (others.length) {
            var h3 = document.createElement('div');
            h3.className = 'prop-group';
            h3.textContent = 'Other attributes';
            frag.appendChild(h3);
            others.forEach(function (p) { frag.appendChild(row(el, p)); shown[p] = true; });
        }

        var st = C.styleOf(model, el);
        if (st) {
            var h4 = document.createElement('div');
            h4.className = 'prop-group';
            h4.textContent = 'Style ' + (el.propEls.Style ? '(inline)' : el.attrs.Style ? el.attrs.Style.value : '(implicit, ' + (st.targetType || '') + ')');
            frag.appendChild(h4);
            var seen = {};
            for (var s = st; s; s = s.basedOn) {
                s.setters.forEach(function (x) {
                    if (seen[x.prop] || !x.prop) return;
                    seen[x.prop] = true;
                    if (!shown[x.prop]) frag.appendChild(row(el, x.prop));
                    shown[x.prop] = true;
                });
            }
            var nt = 0;
            for (var s2 = st; s2; s2 = s2.basedOn) nt += s2.triggers.length;
            if (nt) {
                var note = document.createElement('div');
                note.className = 'prop-note';
                note.textContent = nt + ' trigger' + (nt === 1 ? '' : 's') + ' in the style. The designer shows the state at design time: bindings use their FallbackValue, as in the Visual Studio designer.';
                frag.appendChild(note);
            }
        }

        var add = document.createElement('div');
        add.className = 'prop-add';
        add.innerHTML = '<input placeholder="Attribute" spellcheck="false"/><input placeholder="Value" spellcheck="false"/><button>Add</button>';
        var inputs = add.querySelectorAll('input');
        add.querySelector('button').onclick = function () {
            var n = inputs[0].value.trim(), v = inputs[1].value;
            if (!/^[A-Za-z_][\w.:]*$/.test(n)) { inputs[0].focus(); return; }
            setAttr(el, n, v);
        };
        frag.appendChild(add);
        propsEl.appendChild(frag);
        updateBreadcrumb();
    }

    function row(el, prop, title) {
        var r = document.createElement('div');
        r.className = 'prop-row';
        var lab = document.createElement('label');
        lab.textContent = title || prop;
        var local = localAttr(el, prop);
        var eff = prop === 'x:Name' || prop === 'Name' ? { value: el.name || undefined, source: el.name ? 'local' : 'default' } : effective(el, prop);
        if (local !== null) lab.className = 'set';
        else if (eff.source === 'style' || eff.source === 'trigger') { lab.className = 'styled'; lab.title = 'From the ' + (eff.source === 'trigger' ? 'style trigger' : 'style') + ': ' + displayValue(eff.value); }
        else if (eff.source === 'local' && el.propEls[prop]) { lab.className = 'set'; lab.title = 'Set by <' + el.kind + '.' + prop + '> element'; }
        r.appendChild(lab);
        var box = document.createElement('div');
        box.className = 'prop-input';
        var input;
        var opts = ENUMS[prop];
        if (opts) {
            input = document.createElement('select');
            var o0 = document.createElement('option');
            o0.value = '\u0000';
            o0.textContent = local === null ? (eff.value !== undefined ? displayValue(eff.value) + ' (' + eff.source + ')' : '') : '(remove)';
            input.appendChild(o0);
            var list = opts.slice();
            if (local !== null && list.indexOf(local) < 0) list.unshift(local);
            list.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; input.appendChild(o); });
            input.value = local !== null ? local : '\u0000';
            input.onchange = function () { commit(input.value === '\u0000' ? null : input.value); };
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.spellcheck = false;
            input.value = local !== null ? local : '';
            if (local === null) input.placeholder = el.propEls[prop] ? '<' + el.kind + '.' + prop + '>' : displayValue(eff.value);
            input.onkeydown = function (ev) {
                if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                if (ev.key === 'Escape') { input.value = local !== null ? local : ''; input.blur(); }
            };
            input.onchange = function () { commit(input.value === '' ? null : input.value); };
        }
        function commit(v) {
            if (v === local) return;
            if ((prop === 'x:Name' || prop === 'Name') && v && model.byName[v] && model.byName[v] !== el) {
                statusEl.textContent = 'The name ' + v + ' is already used';
                return;
            }
            if (v === null && el.propEls[prop] && local === null) return;
            setAttr(el, prop, v);
        }
        if (COLOR_PROPS[prop]) {
            var sw = document.createElement('span');
            sw.className = 'swatch';
            var c = C.brushColor(model, el, eff.value);
            sw.innerHTML = '<span style="background:' + (c ? C.colorCss(c) : 'transparent') + '"></span><input type="color"/>';
            var ci = sw.querySelector('input');
            if (c) ci.value = '#' + [c.r, c.g, c.b].map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
            ci.onchange = function () {
                var a = c ? c.a : 255;
                var hex = ci.value.substring(1).toUpperCase();
                commit('#' + (a < 16 ? '0' : '') + a.toString(16).toUpperCase() + hex);
            };
            box.appendChild(sw);
        }
        box.insertBefore(input, box.firstChild);
        r.appendChild(box);
        return r;
    }

    function innerTextRange(el) {
        var n = el.node;
        if (n.selfClosing || n.children.length) return null;
        var items = n.items.filter(function (i) { return i.text !== undefined && !i.cdata; });
        if (!items.length || !items.map(function (i) { return i.text; }).join('').trim()) return null;
        var first = items[0], last = items[items.length - 1];
        var raw = text.substring(first.start, last.end);
        var lead = /^\s*/.exec(raw)[0].length, trail = /\s*$/.exec(raw)[0].length;
        return { start: first.start + lead, end: last.end - trail };
    }
    function innerTextRow(el, rng) {
        var r = document.createElement('div');
        r.className = 'prop-row';
        r.innerHTML = '<label class="set">Text</label><div class="prop-input"><input type="text" spellcheck="false"/></div>';
        var input = r.querySelector('input');
        var cur = text.substring(rng.start, rng.end);
        input.value = cur.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
        input.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } };
        input.onchange = function () {
            var v = input.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            send([{ offset: rng.start, length: rng.end - rng.start, text: v }]);
        };
        return r;
    }

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    // ------------------------------------------------------------------ toolbox (insert new elements)

    var TOOLS = [
        ['Button', 'Bt', '<Button Content="Button" Width="75" Height="23"/>'],
        ['TextBlock', 'Tb', '<TextBlock Text="TextBlock"/>'],
        ['Label', 'Lb', '<Label Content="Label"/>'],
        ['TextBox', 'Tx', '<TextBox Text="" Width="120" Height="23"/>'],
        ['Image', 'Im', '<Image Width="100" Height="100"/>'],
        ['Rectangle', 'Re', '<Rectangle Width="100" Height="60" Fill="#FFF4F4F5" Stroke="Black"/>'],
        ['Ellipse', 'El', '<Ellipse Width="60" Height="60" Fill="#FFF4F4F5" Stroke="Black"/>'],
        ['Border', 'Bd', '<Border Width="100" Height="100" BorderBrush="Black" BorderThickness="1"/>'],
        ['Canvas', 'Cv', '<Canvas Width="200" Height="150"/>'],
        ['Grid', 'Gr', '<Grid Width="200" Height="150"/>'],
        ['StackPanel', 'Sp', '<StackPanel Width="150" Height="100"/>'],
        ['CheckBox', 'Ck', '<CheckBox Content="CheckBox"/>'],
        ['RadioButton', 'Rb', '<RadioButton Content="RadioButton"/>'],
        ['ComboBox', 'Cb', '<ComboBox Width="120"/>'],
        ['ProgressBar', 'Pb', '<ProgressBar Width="100" Height="10"/>'],
        ['Slider', 'Sl', '<Slider Width="120"/>'],
    ];
    var CONTAINERS = { Canvas: 1, Grid: 1, StackPanel: 1, WrapPanel: 1, DockPanel: 1, UniformGrid: 1, VirtualizingStackPanel: 1 };
    var SINGLE = { Border: 1, Window: 1, UserControl: 1, ContentControl: 1, ScrollViewer: 1, Viewbox: 1, Page: 1, Button: 1, Label: 1, GroupBox: 1, Expander: 1, TabItem: 1 };

    (function buildToolbox() {
        var tb = $('toolbox');
        TOOLS.forEach(function (t) {
            var d = document.createElement('div');
            d.className = 'tool';
            d.draggable = true;
            d.innerHTML = '<span class="tool-icon">' + t[1] + '</span>' + t[0];
            d.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/x-wpf-tool', t[0]); ev.dataTransfer.effectAllowed = 'copy'; });
            tb.appendChild(d);
        });
    })();

    var dropBox = null;
    function dropTargetAt(x, y) {
        // The deepest panel whose box contains the point (panels need no background to accept a drop).
        var best = null, bestDepth = -1;
        var list = surface.querySelectorAll('[data-i]');
        for (var i = 0; i < list.length; i++) {
            var d = list[i];
            var el = model.all[Number(d.getAttribute('data-i'))];
            if (!el) continue;
            var ok = CONTAINERS[el.kind] || (SINGLE[el.kind] && !el.children.length && !el.contentEl && !el.attrs.Content);
            if (!ok) continue;
            var r = d.getBoundingClientRect();
            if (r.width === 0 || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
            var depth = 0;
            for (var a = el; a; a = a.parent) depth++;
            if (depth > bestDepth) { best = { el: el, dom: d }; bestDepth = depth; }
        }
        return best;
    }
    wrapper.addEventListener('dragover', function (ev) {
        if (!model || ev.dataTransfer.types.indexOf('text/x-wpf-tool') < 0) return;
        ev.preventDefault();
        var t = dropTargetAt(ev.clientX, ev.clientY);
        if (!dropBox) { dropBox = document.createElement('div'); dropBox.className = 'drop-box'; overlay.appendChild(dropBox); }
        if (t) {
            var r = rectIn(t.dom);
            dropBox.style.display = 'block';
            dropBox.style.left = r.x + 'px'; dropBox.style.top = r.y + 'px'; dropBox.style.width = r.w + 'px'; dropBox.style.height = r.h + 'px';
            dropBox.title = label(t.el);
        } else dropBox.style.display = 'none';
    });
    wrapper.addEventListener('dragleave', function () { if (dropBox) dropBox.style.display = 'none'; });
    wrapper.addEventListener('drop', function (ev) {
        if (dropBox) dropBox.style.display = 'none';
        var kind = ev.dataTransfer.getData('text/x-wpf-tool');
        if (!kind || !model) return;
        ev.preventDefault();
        var t = dropTargetAt(ev.clientX, ev.clientY);
        if (!t) { statusEl.textContent = 'Drop onto a panel (Canvas, Grid, StackPanel…) or an empty Border'; return; }
        var snippet = TOOLS.filter(function (x) { return x[0] === kind; })[0][2];
        var pr = t.dom.getBoundingClientRect(), s = t.dom.offsetWidth ? pr.width / t.dom.offsetWidth : zoom;
        var bl = parseFloat(getComputedStyle(t.dom).borderLeftWidth) || 0, btp = parseFloat(getComputedStyle(t.dom).borderTopWidth) || 0;
        var x = Math.round((ev.clientX - pr.left) / s - bl), y = Math.round((ev.clientY - pr.top) / s - btp);
        var pos = '';
        if (t.el.kind === 'Canvas') pos = ' Canvas.Left="' + x + '" Canvas.Top="' + y + '"';
        else if (t.el.kind === 'Grid' || SINGLE[t.el.kind]) {
            var gp = '';
            if (t.el.kind === 'Grid') {
                // Put it in the cell under the pointer, with the margin measured from that cell.
                var cellInfo = gridCellAt(t, ev.clientX, ev.clientY, s);
                if (cellInfo) { gp = (cellInfo.row ? ' Grid.Row="' + cellInfo.row + '"' : '') + (cellInfo.col ? ' Grid.Column="' + cellInfo.col + '"' : ''); x = cellInfo.x; y = cellInfo.y; }
            }
            pos = gp + ' HorizontalAlignment="Left" VerticalAlignment="Top" Margin="' + x + ',' + y + ',0,0"';
        }
        var xml = snippet.replace(/^<(\w+)/, '<$1' + pos);
        var ed = C.insertChildEdit(text, t.el.node, xml);
        send([ed], { offset: ed.offset + ed.text.indexOf('<' + kind) });
    });
    function gridCellAt(t, cx, cy, s) {
        var cs = getComputedStyle(t.dom);
        var cols = cs.gridTemplateColumns.split(' ').map(parseFloat), rows = cs.gridTemplateRows.split(' ').map(parseFloat);
        var pr = t.dom.getBoundingClientRect();
        var lx = (cx - pr.left) / s, ly = (cy - pr.top) / s;
        var col = 0, acc = 0;
        for (; col < cols.length - 1 && lx > acc + cols[col]; col++) acc += cols[col];
        var x = lx - acc;
        var row = 0; acc = 0;
        for (; row < rows.length - 1 && ly > acc + rows[row]; row++) acc += rows[row];
        return { col: C.gridDefs(t.el, 'Column').length ? col : 0, row: C.gridDefs(t.el, 'Row').length ? row : 0, x: Math.round(x), y: Math.round(ly - acc) };
    }

    // ------------------------------------------------------------------ toolbar and panels

    $('btnUndo').onclick = function () { vscode.postMessage({ type: 'undo' }); };
    $('btnRedo').onclick = function () { vscode.postMessage({ type: 'redo' }); };
    $('btnDelete').onclick = deleteSelected;
    $('btnDuplicate').onclick = duplicateSelected;
    $('btnParent').onclick = function () { if (selId !== null && model.all[selId].parent) select(model.all[selId].parent.id, { scroll: true }); };
    $('btnZoomIn').onclick = function () { setZoom(zoom * 1.25); };
    $('btnZoomOut').onclick = function () { setZoom(zoom / 1.25); };
    $('btnFit').onclick = fitToView;
    $('zoomBadge').onclick = function () { setZoom(1); };
    $('btnSource').onclick = function () { vscode.postMessage({ type: 'openSource' }); };
    $('chkOutlines').onchange = function () { surface.classList.toggle('outlines', this.checked); };

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
            var mv = function (e) {
                var d = e.clientX - startX;
                side.style.width = Math.max(150, Math.min(600, sp.dataset.side === 'left' ? startW + d : startW - d)) + 'px';
                updateOverlay();
            };
            var up = function () { sp.classList.remove('active'); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', mv);
            document.addEventListener('mouseup', up);
        });
    });

    new ResizeObserver(function () { updateOverlay(); }).observe(wrapper);

    // ------------------------------------------------------------------ messages from the extension

    window.addEventListener('message', function (event) {
        var msg = event.data;
        switch (msg.type) {
            case 'document':
                if (drag) { setTimeout(function () { window.postMessage(msg, '*'); }, 50); return; }
                loadDocument(msg);
                break;
            case 'images':
                images = msg.images || {};
                render();
                break;
            case 'cursor': {
                if (!model || drag) return;
                var el = C.nodeAtOffset(model, msg.offset);
                if (el && el.id !== selId) {
                    if (ensureVisibleTab(el)) { selId = el.id; render(); }
                    select(el.id, { fromText: true, scroll: true });
                }
                break;
            }
            case 'editRejected':
                pendingSel = null;
                statusEl.textContent = 'The file changed meanwhile; try again';
                break;
        }
    });

    // For automated tests of the designer.
    window.__wpfDesigner = { model: function () { return model; }, select: select, render: render, text: function () { return text; } };

    vscode.postMessage({ type: 'ready' });
})();
