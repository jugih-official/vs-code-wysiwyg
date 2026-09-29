/*
 * Razor designer live-view agent. The designer's proxy adds this script to the running app's pages. It talks
 * to the designer (the parent frame) with postMessage only: it describes elements under the pointer, finds
 * elements for a selection, and reports their boxes. In select mode it keeps clicks from reaching the app.
 */
(function () {
    'use strict';
    if (window.parent === window || window.__razorDesignerAgent) return;
    window.__razorDesignerAgent = true;

    var selectMode = true;
    var picked = null;          // the element the designer selected
    var tracked = [];           // elements whose boxes the designer draws
    var trackId = 0;

    function post(msg) { msg.rzLive = true; window.parent.postMessage(msg, '*'); }

    function attrsOf(el) {
        var out = {};
        for (var i = 0; i < el.attributes.length; i++) {
            var a = el.attributes[i];
            if (/^(b-[a-z0-9]{6,}|_bl_|style$)/i.test(a.name)) continue; // scope ids, Blazor internals
            out[a.name] = a.value;
        }
        return out;
    }
    function describe(el) {
        var chain = [];
        for (var e = el; e && e.nodeType === 1 && chain.length < 14; e = e.parentElement) {
            chain.push({ tag: e.tagName.toLowerCase(), attrs: attrsOf(e), text: e.children.length ? '' : (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) });
            if (e === document.body) break;
        }
        return chain;
    }
    function rect(el) {
        var r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    function pointTarget(x, y) {
        var list = document.elementsFromPoint(x, y);
        return list.filter(function (e) { return e !== document.documentElement; });
    }

    var lastHover = null;
    document.addEventListener('mousemove', function (ev) {
        if (!selectMode) return;
        var el = ev.target;
        if (el === lastHover) return;
        lastHover = el;
        post({ type: 'hover', chain: describe(el), rect: rect(el) });
    }, true);
    document.addEventListener('mouseleave', function () { lastHover = null; post({ type: 'hover', chain: null }); }, true);

    ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'submit', 'pointerdown', 'pointerup'].forEach(function (type) {
        document.addEventListener(type, function (ev) {
            if (!selectMode) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            // Cancelling pointerdown suppresses the mouse events that would follow, so the pick happens here.
            if (type === 'pointerdown' && ev.button === 0) {
                var stack = pointTarget(ev.clientX, ev.clientY);
                picked = ev.target;
                post({ type: 'pick', chain: describe(ev.target), rect: rect(ev.target), stack: stack.slice(0, 8).map(describe), mods: { ctrl: ev.ctrlKey || ev.metaKey, alt: ev.altKey, shift: ev.shiftKey } });
            }
            if (type === 'dblclick') post({ type: 'open', chain: describe(ev.target) });
        }, true);
    });
    document.addEventListener('keydown', function (ev) {
        if (!selectMode) return;
        if (/^(Delete|Escape)$/.test(ev.key) || ((ev.ctrlKey || ev.metaKey) && /^[dzy]$/i.test(ev.key)) || (ev.altKey && /^Arrow(Up|Down)$/.test(ev.key))) {
            ev.preventDefault();
            post({ type: 'key', key: ev.key, ctrl: ev.ctrlKey || ev.metaKey, alt: ev.altKey, shift: ev.shiftKey });
        }
    }, true);

    // Elements matching a signature: tag, static attributes (class = required class tokens), optional ancestor signature.
    function matches(el, sig) {
        if (el.tagName.toLowerCase() !== sig.tag) return false;
        for (var k in sig.attrs) {
            if (k === 'class') {
                // Tolerates one class that the page does not have yet (added in the designer, not hot-reloaded).
                var have = 0;
                for (var i = 0; i < sig.attrs.class.length; i++) if (el.classList.contains(sig.attrs.class[i])) have++;
                if (have < Math.max(1, sig.attrs.class.length - 1)) return false;
            } else if (el.getAttribute(k) !== sig.attrs[k]) return false;
        }
        if (sig.text !== undefined && sig.text !== null && (el.textContent || '').replace(/\s+/g, ' ').trim() !== sig.text) return false;
        return true;
    }
    function findAll(sig) {
        var all = document.getElementsByTagName(sig.tag);
        var out = [];
        for (var i = 0; i < all.length && out.length < 200; i++) {
            var el = all[i];
            if (!matches(el, sig)) continue;
            if (sig.parent) {
                var ok = false;
                for (var p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) if (matches(p, sig.parent)) { ok = true; break; }
                if (!ok) continue;
            }
            out.push(el);
        }
        return out;
    }

    function reportTracked() {
        post({ type: 'rects', id: trackId, rects: tracked.map(rect), scroll: { x: window.scrollX, y: window.scrollY } });
    }

    window.addEventListener('message', function (ev) {
        var m = ev.data;
        if (!m || !m.rzDesigner) return;
        switch (m.type) {
            case 'mode':
                selectMode = !!m.select;
                document.documentElement.style.cursor = selectMode ? 'default' : '';
                break;
            case 'track':
                // Select these elements: the designer draws their boxes. The picked element stays first.
                trackId = m.id;
                tracked = m.sig ? findAll(m.sig) : [];
                if (picked && tracked.indexOf(picked) > 0) { tracked.splice(tracked.indexOf(picked), 1); tracked.unshift(picked); }
                else if (picked && tracked.indexOf(picked) < 0 && m.keepPicked) tracked.unshift(picked);
                if (tracked[0]) picked = tracked[0];
                reportTracked();
                if (m.scroll && tracked[0]) { tracked[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }); reportTracked(); }
                break;
            case 'style': {
                // Computed style and matching CSS rules of the selected element.
                var el = picked;
                var res = { type: 'style', id: m.id, computed: {}, matched: [] };
                if (el) {
                    var cs = getComputedStyle(el);
                    (m.props || []).forEach(function (p) { res.computed[p] = cs.getPropertyValue(p); });
                    (m.selectors || []).forEach(function (s, i) {
                        try { if (el.matches(s)) res.matched.push(i); } catch (e) { /* unsupported selector */ }
                    });
                    res.position = cs.position;
                    res.box = rect(el);
                }
                post(res);
                break;
            }
            case 'reload':
                location.reload();
                break;
        }
    });

    var pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
            pending = false;
            // After a hot reload the tracked elements may have been replaced: ask the designer to track again.
            if (tracked.length && tracked.some(function (e) { return !document.contains(e); })) post({ type: 'changed' });
            else if (tracked.length) reportTracked();
        });
    }
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    new MutationObserver(function () { schedule(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

    post({ type: 'hello', url: location.href, title: document.title });
})();
