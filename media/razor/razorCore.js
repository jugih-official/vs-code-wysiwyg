/*
 * Razor (Blazor) core for the visual designer: a Razor parser that keeps source offsets, a small C#
 * expression evaluator for design time, a renderer that turns components into static HTML (child
 * components from their own .razor files, scoped CSS), a CSS parser for rule lookup and editing, and
 * minimal text edits.
 *
 * Runs in the webview and in Node (for tests): no DOM access here.
 */
(function (root) {
    'use strict';

    function RazorError(message, offset) { this.message = message; this.offset = offset; }

    var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };
    var RAW_TEXT = { script: 1, style: 1, textarea: 0 };
    // Plain HTML: these hold text, not markup.
    var HTML_RAW_TEXT = { script: 1, style: 1, textarea: 1, title: 1, xmp: 1 };
    var P_CLOSERS = {};
    'address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul'.split(' ').forEach(function (n) { P_CLOSERS[n] = 1; });

    /** HTML's optional end tags: does a <child> start tag end an open <parent>? */
    function impliedEnd(parent, child) {
        parent = parent.toLowerCase(); child = child.toLowerCase();
        switch (parent) {
            case 'p': return !!P_CLOSERS[child];
            case 'li': return child === 'li';
            case 'dt': case 'dd': return child === 'dt' || child === 'dd';
            case 'option': return child === 'option' || child === 'optgroup';
            case 'optgroup': return child === 'optgroup';
            case 'tr': return child === 'tr' || child === 'tbody' || child === 'tfoot' || child === 'thead';
            case 'td': case 'th': return child === 'td' || child === 'th' || child === 'tr' || child === 'tbody' || child === 'tfoot';
            case 'thead': case 'tbody': return child === 'tbody' || child === 'tfoot';
            case 'rt': case 'rp': return child === 'rt' || child === 'rp';
            case 'head': return child === 'body';
            default: return false;
        }
    }
    var DIRECTIVES = { page: 1, using: 1, inject: 1, implements: 1, inherits: 1, layout: 1, attribute: 1, namespace: 1, typeparam: 1, rendermode: 1, preservewhitespace: 1, model: 1, addTagHelper: 1, removeTagHelper: 1, tagHelperPrefix: 1, section: 0 };
    var BLOCK_KW = { 'if': 1, 'foreach': 1, 'for': 1, 'while': 1, 'switch': 1, 'do': 1, 'using': 1, 'lock': 1, 'try': 1 };

    function isIdStart(c) { return /[A-Za-z_]/.test(c); }
    function isId(c) { return /[A-Za-z0-9_]/.test(c); }
    function isWs(c) { return c === ' ' || c === '\t' || c === '\r' || c === '\n'; }

    // ---------------------------------------------------------------- C# scanning helpers

    /** Skips a C# string/char literal or comment starting at i; returns the index after it, or -1 when none starts here. */
    function skipCsToken(t, i) {
        var c = t[i], n = t[i + 1];
        if (c === '/' && n === '/') { var e = t.indexOf('\n', i); return e < 0 ? t.length : e; }
        if (c === '/' && n === '*') { var e2 = t.indexOf('*/', i + 2); return e2 < 0 ? t.length : e2 + 2; }
        if (c === '@' && t[i + 1] === '*') { var e3 = t.indexOf('*@', i + 2); return e3 < 0 ? t.length : e3 + 2; }
        // Raw string literal """..."""
        if (c === '"' && n === '"' && t[i + 2] === '"') {
            var q = i; while (t[q] === '"') q++;
            var count = q - i;
            var close = t.indexOf('"'.repeat(count), q);
            return close < 0 ? t.length : close + count;
        }
        var interp = false, verbatim = false, j = i;
        while (t[j] === '$' || (t[j] === '@' && t[j + 1] !== '<')) {
            if (t[j] === '$') interp = true; else verbatim = true;
            j++;
        }
        if (t[j] === '"' && (interp || verbatim || j === i)) {
            j++;
            while (j < t.length) {
                var ch = t[j];
                if (verbatim) {
                    if (ch === '"') { if (t[j + 1] === '"') { j += 2; continue; } return j + 1; }
                } else {
                    if (ch === '\\') { j += 2; continue; }
                    if (ch === '"') return j + 1;
                    if (ch === '\n') return j;
                }
                if (interp && ch === '{') {
                    if (t[j + 1] === '{') { j += 2; continue; }
                    j = matchBalanced(t, j, '{', '}');
                    continue;
                }
                j++;
            }
            return t.length;
        }
        if (c === "'" && j === i) {
            var k = i + 1;
            while (k < t.length && t[k] !== "'" && t[k] !== '\n') { if (t[k] === '\\') k++; k++; }
            return k + 1;
        }
        return -1;
    }

    /** From an opening bracket at i, returns the index after the matching close (C#-aware). */
    function matchBalanced(t, i, open, close) {
        var depth = 0;
        var j = i;
        while (j < t.length) {
            var s = skipCsToken(t, j);
            if (s >= 0) { j = s; continue; }
            var c = t[j];
            if (c === open) depth++;
            else if (c === close) { depth--; if (depth === 0) return j + 1; }
            else if (open !== '(' && c === '(') { j = matchBalanced(t, j, '(', ')'); continue; }
            else if (open !== '[' && c === '[') { j = matchBalanced(t, j, '[', ']'); continue; }
            else if (open !== '{' && c === '{') { j = matchBalanced(t, j, '{', '}'); continue; }
            j++;
        }
        return t.length;
    }

    /** An implicit expression after '@': identifier(.identifier | ?.identifier | (...) | [...])* */
    function scanImplicit(t, i) {
        var j = i;
        if (!isIdStart(t[j])) return i;
        while (j < t.length) {
            while (j < t.length && isId(t[j])) j++;
            if (t[j] === '(') { j = matchBalanced(t, j, '(', ')'); }
            else if (t[j] === '[') { j = matchBalanced(t, j, '[', ']'); }
            else if (t[j] === '<' && /^<[A-Z][\w.]*>\(/.test(t.substring(j, j + 60))) { j = t.indexOf('>', j) + 1; continue; }
            if (t[j] === '(' || t[j] === '[') continue;
            if (t[j] === '.' && isIdStart(t[j + 1] || '')) { j++; continue; }
            if (t[j] === '?' && t[j + 1] === '.' && isIdStart(t[j + 2] || '')) { j += 2; continue; }
            if (t[j] === '!' && t[j + 1] === '.' && isIdStart(t[j + 2] || '')) { j += 2; continue; }
            break;
        }
        return j;
    }

    // ---------------------------------------------------------------- Razor parser

    /**
     * Parses a .razor file into a node tree:
     *   element { type, name, attrs: [{ name, raw, start, end, vStart, vEnd, quote }], children, start, tagEnd, closeStart, end, selfClosing }
     *   text { text }, expr { code, explicit }, if { branches: [{ cond, children, start, end }] }, loop { kw, header, children },
     *   switch { expr, cases: [{ label, children }] }, code { children } (an @{ } block), comment
     * Every node has start/end offsets and an id (index into result.nodes).
     */
    /** opts.html: plain HTML (no Razor; HTML's optional end tags, case-insensitive tags, lenient). */
    function parseRazor(text, opts) {
        var t = text;
        var html = !!(opts && opts.html);
        var openStack = [];
        var res = { nodes: [], directives: [], codeBlocks: [], templates: {}, params: {}, root: null, text: text };
        function node(o) { o.id = res.nodes.length; res.nodes.push(o); return o; }

        function atLineStart(i) {
            var k = i - 1;
            while (k >= 0 && (t[k] === ' ' || t[k] === '\t')) k--;
            return k < 0 || t[k] === '\n';
        }

        // Markup content until a closing tag, end, or (inCode) the end bound.
        function parseMarkupContent(i, end, parentName) {
            var kids = [];
            var textStart = i;
            function flushText(upto) {
                if (upto > textStart) {
                    var raw = t.substring(textStart, upto);
                    kids.push(node({ type: 'text', text: raw, start: textStart, end: upto }));
                }
            }
            while (i < end) {
                var c = t[i];
                if (c === '<') {
                    if (t.startsWith('<!--', i)) {
                        flushText(i);
                        var ce = t.indexOf('-->', i + 4);
                        i = ce < 0 ? end : ce + 3;
                        textStart = i;
                        continue;
                    }
                    if (t[i + 1] === '/') {
                        flushText(i);
                        return { kids: kids, pos: i };
                    }
                    if (t[i + 1] === '!') {
                        flushText(i);
                        var de = t.indexOf('>', i);
                        i = de < 0 ? end : de + 1;
                        textStart = i;
                        continue;
                    }
                    if (isIdStart(t[i + 1] || '')) {
                        if (html && parentName) {
                            var nm = /^<([\w:.\-]+)/.exec(t.substring(i, i + 64));
                            if (nm && impliedEnd(parentName, nm[1])) {
                                flushText(i);
                                return { kids: kids, pos: i, implied: true };
                            }
                        }
                        flushText(i);
                        var el = parseElement(i, end);
                        kids.push(el);
                        i = el.end;
                        textStart = i;
                        continue;
                    }
                    i++;
                    continue;
                }
                if (c === '@' && !html) {
                    if (t[i + 1] === '@') {
                        flushText(i);
                        kids.push(node({ type: 'text', text: '@', start: i, end: i + 2 }));
                        i += 2; textStart = i; continue;
                    }
                    if (i > 0 && isId(t[i - 1]) && isId(t[i + 1] || '')) { i++; continue; } // e-mail address
                    flushText(i);
                    var r = parseRazorConstruct(i, end, false);
                    if (r.node) kids.push(r.node);
                    i = r.pos;
                    textStart = i;
                    continue;
                }
                i++;
            }
            flushText(i);
            return { kids: kids, pos: i };
        }

        // At '@': directive, comment, code, block or expression.
        function parseRazorConstruct(i, end, inCode) {
            var j = i + 1;
            if (t[j] === '*') {
                var ce = t.indexOf('*@', j);
                var e = ce < 0 ? end : ce + 2;
                return { node: node({ type: 'comment', start: i, end: e }), pos: e };
            }
            if (t[j] === '{') {
                var close = matchBalanced(t, j, '{', '}');
                var n = node({ type: 'code', start: i, end: close, bodyStart: j + 1, bodyEnd: close - 1 });
                n.children = parseCode(j + 1, close - 1);
                return { node: n, pos: close };
            }
            if (t[j] === '(') {
                var pe = matchBalanced(t, j, '(', ')');
                return { node: node({ type: 'expr', code: t.substring(j + 1, pe - 1), explicit: true, start: i, end: pe }), pos: pe };
            }
            if (t[j] === ':') {
                var le = t.indexOf('\n', j);
                if (le < 0 || le > end) le = end;
                return { node: node({ type: 'text', text: t.substring(j + 1, le), start: i, end: le }), pos: le };
            }
            if (t[j] === '<') {
                var el = parseElement(j, end);
                el.template = true;
                return { node: el, pos: el.end };
            }
            var we = j;
            while (we < end && isId(t[we])) we++;
            var word = t.substring(j, we);
            if ((word === 'code' || word === 'functions') && /^\s*\{/.test(t.substring(we, we + 200))) {
                var ob = t.indexOf('{', we);
                var cb = matchBalanced(t, ob, '{', '}');
                var cn = node({ type: 'codeSection', start: i, end: cb, bodyStart: ob + 1, bodyEnd: cb - 1 });
                res.codeBlocks.push(cn);
                scanCodeSection(ob + 1, cb - 1);
                return { node: cn, pos: cb };
            }
            if (DIRECTIVES[word] && atLineStart(i)) {
                var de = t.indexOf('\n', we);
                if (de < 0) de = t.length;
                var d = { name: word, value: t.substring(we, de).trim(), start: i, end: de };
                res.directives.push(d);
                return { node: node({ type: 'directive', directive: d, start: i, end: de }), pos: de };
            }
            if (word === 'section' && atLineStart(i)) {
                var sb = t.indexOf('{', we);
                var se = matchBalanced(t, sb, '{', '}');
                var sn = node({ type: 'code', start: i, end: se, bodyStart: sb + 1, bodyEnd: se - 1 });
                sn.children = parseMarkupContent(sb + 1, se - 1).kids;
                return { node: sn, pos: se };
            }
            if (BLOCK_KW[word]) return parseBlock(j, end);
            if (isIdStart(t[j] || '')) {
                var ie = scanImplicit(t, j);
                // A trailing '.' ends the sentence, not the expression.
                return { node: node({ type: 'expr', code: t.substring(j, ie), explicit: false, start: i, end: ie }), pos: ie };
            }
            return { node: node({ type: 'text', text: '@', start: i, end: i + 1 }), pos: i + 1 };
        }

        // A C# block statement: keyword at i (no '@').
        function parseBlock(i, end) {
            var we = i;
            while (isId(t[we])) we++;
            var kw = t.substring(i, we);
            var j = skipWsC(we);
            if (kw === 'if') {
                var n = node({ type: 'if', branches: [], start: i - (t[i - 1] === '@' ? 1 : 0) });
                var cond = null, pos = j;
                for (;;) {
                    var bStart = pos;
                    if (t[pos] === '(') {
                        var ce = matchBalanced(t, pos, '(', ')');
                        cond = t.substring(pos + 1, ce - 1);
                        pos = skipWsC(ce);
                    } else cond = null;
                    var body = parseBody(pos, end);
                    n.branches.push({ cond: cond, children: body.kids, start: bStart, end: body.pos, bodyStart: body.bodyStart, bodyEnd: body.bodyEnd });
                    pos = body.pos;
                    var k = skipWsC(pos);
                    if (t.startsWith('else', k) && !isId(t[k + 4] || '')) {
                        var k2 = skipWsC(k + 4);
                        if (t.startsWith('if', k2) && !isId(t[k2 + 2] || '')) { pos = skipWsC(k2 + 2); continue; }
                        pos = k2;
                        var eb = parseBody(pos, end);
                        n.branches.push({ cond: null, isElse: true, children: eb.kids, start: k, end: eb.pos, bodyStart: eb.bodyStart, bodyEnd: eb.bodyEnd });
                        pos = eb.pos;
                    }
                    break;
                }
                n.end = pos;
                return { node: n, pos: pos };
            }
            if (kw === 'switch') {
                var se = matchBalanced(t, j, '(', ')');
                var expr = t.substring(j + 1, se - 1);
                var ob = skipWsC(se);
                var cb = matchBalanced(t, ob, '{', '}');
                var sn = node({ type: 'switch', expr: expr, cases: [], start: i - (t[i - 1] === '@' ? 1 : 0), end: cb });
                // Split the body at case/default labels.
                var body2 = t.substring(ob + 1, cb - 1);
                var re = /(^|\n)\s*(case\s+[^:\n]+|default)\s*:/g, m, labels = [];
                while ((m = re.exec(body2))) labels.push({ label: m[2].trim(), at: ob + 1 + m.index + m[0].length });
                for (var li = 0; li < labels.length; li++) {
                    var segEnd = li + 1 < labels.length ? ob + 1 + body2.lastIndexOf('\n', labels[li + 1].at - ob - 2) : cb - 1;
                    sn.cases.push({ label: labels[li].label, children: parseCode(labels[li].at, Math.max(labels[li].at, segEnd)) });
                }
                return { node: sn, pos: cb };
            }
            if (kw === 'do') {
                var db = parseBody(j, end);
                var p2 = skipWsC(db.pos);
                if (t.startsWith('while', p2)) { var wp = matchBalanced(t, skipWsC(p2 + 5), '(', ')'); p2 = skipWsC(wp); if (t[p2] === ';') p2++; }
                var dn = node({ type: 'loop', kw: 'do', header: '', children: db.kids, start: i, end: p2 });
                return { node: dn, pos: p2 };
            }
            if (kw === 'try') {
                var tb = parseBody(j, end);
                var p3 = tb.pos;
                for (;;) {
                    var k3 = skipWsC(p3);
                    if (t.startsWith('catch', k3)) { var c3 = skipWsC(k3 + 5); if (t[c3] === '(') c3 = skipWsC(matchBalanced(t, c3, '(', ')')); if (t.startsWith('when', c3)) c3 = skipWsC(matchBalanced(t, skipWsC(c3 + 4), '(', ')')); p3 = matchBalanced(t, c3, '{', '}'); continue; }
                    if (t.startsWith('finally', k3)) { p3 = matchBalanced(t, skipWsC(k3 + 7), '{', '}'); continue; }
                    break;
                }
                var tn = node({ type: 'code', start: i, end: p3, children: tb.kids });
                return { node: tn, pos: p3 };
            }
            // foreach / for / while / using / lock
            var he = t[j] === '(' ? matchBalanced(t, j, '(', ')') : j;
            var header = t[j] === '(' ? t.substring(j + 1, he - 1) : '';
            var lb = parseBody(skipWsC(he), end);
            var type = kw === 'using' || kw === 'lock' ? 'code' : 'loop';
            var ln = node({ type: type, kw: kw, header: header, children: lb.kids, start: i - (t[i - 1] === '@' ? 1 : 0), end: lb.pos, bodyStart: lb.bodyStart, bodyEnd: lb.bodyEnd });
            return { node: ln, pos: lb.pos };
        }

        function skipWsC(i) {
            for (;;) {
                while (i < t.length && isWs(t[i])) i++;
                if (t[i] === '/' && (t[i + 1] === '/' || t[i + 1] === '*')) { i = skipCsToken(t, i); continue; }
                if (t[i] === '@' && t[i + 1] === '*') { i = skipCsToken(t, i); continue; }
                return i;
            }
        }

        // Body of a block: { code } or a single statement.
        function parseBody(i, end) {
            if (t[i] === '{') {
                var close = matchBalanced(t, i, '{', '}');
                return { kids: parseCode(i + 1, close - 1), pos: close, bodyStart: i + 1, bodyEnd: close - 1 };
            }
            if (t[i] === '<') {
                var el = parseElement(i, end);
                return { kids: [el], pos: el.end, bodyStart: i, bodyEnd: el.end };
            }
            var s = scanStatement(i, end);
            return { kids: [], pos: s, bodyStart: i, bodyEnd: s };
        }

        function scanStatement(i, end) {
            var j = i;
            while (j < end) {
                var s = skipCsToken(t, j);
                if (s >= 0) { j = s; continue; }
                var c = t[j];
                if (c === '(') { j = matchBalanced(t, j, '(', ')'); continue; }
                if (c === '[') { j = matchBalanced(t, j, '[', ']'); continue; }
                if (c === '{') { j = matchBalanced(t, j, '{', '}'); continue; }
                if (c === ';') return j + 1;
                if (c === '}') return j;
                j++;
            }
            return end;
        }

        // C# code with embedded markup (the body of @{ }, @if { }, ...).
        function parseCode(i, end) {
            var kids = [];
            while (i < end) {
                i = skipWsC(i);
                if (i >= end) break;
                var c = t[i];
                if (c === '<' && t.startsWith('<!--', i)) {
                    var ce = t.indexOf('-->', i + 4);
                    i = ce < 0 || ce > end ? end : ce + 3;
                    continue;
                }
                if (c === '<' && (isIdStart(t[i + 1] || ''))) {
                    var el = parseElement(i, end);
                    kids.push(el);
                    i = el.end;
                    continue;
                }
                if (c === '@') {
                    var r = parseRazorConstruct(i, end, true);
                    if (r.node) kids.push(r.node);
                    i = Math.max(r.pos, i + 1);
                    continue;
                }
                if (c === '{') {
                    var close = matchBalanced(t, i, '{', '}');
                    var bn = node({ type: 'code', start: i, end: close });
                    bn.children = parseCode(i + 1, close - 1);
                    kids.push(bn);
                    i = close;
                    continue;
                }
                if (isIdStart(c)) {
                    var we = i;
                    while (isId(t[we])) we++;
                    var w = t.substring(i, we);
                    if (BLOCK_KW[w] && (t[skipWsC(we)] === '(' || t[skipWsC(we)] === '{' || w === 'do' || w === 'try')) {
                        var b = parseBlock(i, end);
                        kids.push(b.node);
                        i = b.pos;
                        continue;
                    }
                    if (w === 'case' || w === 'default') {
                        var colon = t.indexOf(':', we);
                        i = colon < 0 ? end : colon + 1;
                        continue;
                    }
                }
                var s = scanStatement(i, end);
                var st = node({ type: 'stmt', code: t.substring(i, s), start: i, end: s });
                kids.push(st);
                i = Math.max(s, i + 1);
            }
            return kids;
        }

        function parseElement(i, end) {
            var j = i + 1;
            while (j < t.length && /[\w:.\-]/.test(t[j])) j++;
            var name = t.substring(i + 1, j);
            var el = node({ type: 'element', name: name, attrs: [], children: [], start: i, nameEnd: j, tagEnd: -1, closeStart: -1, end: -1, selfClosing: false });
            for (;;) {
                while (j < t.length && isWs(t[j])) j++;
                if (j >= t.length) throw new RazorError('Unterminated tag <' + name, i);
                if (t[j] === '/' && t[j + 1] === '>') {
                    // In HTML "/>" closes only void elements and SVG/MathML ones; <div/> opens a div.
                    var foreign = openStack.indexOf('svg') >= 0 || openStack.indexOf('math') >= 0 || /^(svg|math)$/i.test(name);
                    if (!html || foreign || VOID[name.toLowerCase()]) { el.selfClosing = true; el.tagEnd = j + 2; el.closeStart = j; el.end = j + 2; return el; }
                    el.tagEnd = j + 2; j += 2; el.slashOpen = true; break;
                }
                if (t[j] === '>') { el.tagEnd = j + 1; j++; break; }
                if (!html && t[j] === '@' && t[j + 1] === '*') { j = skipCsToken(t, j); continue; }
                var as = j;
                if (!html && t[j] === '@' && t[j + 1] === '(') {
                    // @(...) as an attribute (rare): keep as a raw attribute
                    j = matchBalanced(t, j + 1, '(', ')');
                    el.attrs.push({ name: t.substring(as, j), raw: null, start: as, end: j, vStart: -1, vEnd: -1 });
                    continue;
                }
                while (j < t.length && !isWs(t[j]) && t[j] !== '=' && t[j] !== '>' && !(t[j] === '/' && t[j + 1] === '>')) j++;
                var an = t.substring(as, j);
                if (!an) { j++; continue; }
                var k = j;
                while (k < t.length && isWs(t[k])) k++;
                if (t[k] !== '=') { el.attrs.push({ name: an, raw: null, start: as, end: j, vStart: -1, vEnd: -1 }); continue; }
                k++;
                while (k < t.length && isWs(t[k])) k++;
                var q = t[k];
                if (q === '"' || q === "'") {
                    var ve = scanAttrValue(k + 1, q);
                    el.attrs.push({ name: an, raw: t.substring(k + 1, ve), start: as, end: ve + 1, vStart: k + 1, vEnd: ve, quote: q });
                    j = ve + 1;
                } else {
                    var vs = k;
                    while (k < t.length && !isWs(t[k]) && t[k] !== '>' && (html || !(t[k] === '/' && t[k + 1] === '>'))) {
                        if (!html && t[k] === '(') { k = matchBalanced(t, k, '(', ')'); continue; }
                        k++;
                    }
                    el.attrs.push({ name: an, raw: t.substring(vs, k), start: as, end: k, vStart: vs, vEnd: k, quote: '' });
                    j = k;
                }
            }
            var lname = name.toLowerCase();
            if (VOID[lname] && (html || name === lname)) { el.end = el.tagEnd; el.closeStart = el.tagEnd; el.isVoid = true; return el; }
            if ((html ? HTML_RAW_TEXT[lname] : RAW_TEXT[lname] && name === lname)) {
                var rc = t.toLowerCase().indexOf('</' + lname, j);
                if (rc < 0) {
                    if (!html) throw new RazorError('Unclosed <' + name + '>', i);
                    rc = t.length;
                }
                el.rawContent = t.substring(j, rc);
                el.closeStart = rc;
                el.end = rc < t.length ? t.indexOf('>', rc) + 1 : rc;
                return el;
            }
            openStack.push(lname);
            try {
                for (;;) {
                    var content = parseMarkupContent(j, end, name);
                    el.children = el.children.concat(content.kids);
                    var p = content.pos;
                    if (content.implied) {
                        // HTML: a start tag that ends this element (<li> after <li>, a block after <p>).
                        el.closeStart = p; el.end = p; el.unclosed = true;
                        return el;
                    }
                    if (p >= end || t[p] !== '<') {
                        if (!html) throw new RazorError('Missing </' + name + '>', i);
                        el.closeStart = p; el.end = p; el.unclosed = true;
                        return el;
                    }
                    var ge = t.indexOf('>', p);
                    var closeName = t.substring(p + 2, ge < 0 ? t.length : ge).trim();
                    var same = html ? closeName.toLowerCase() === lname : closeName === name;
                    if (same) {
                        el.closeStart = p;
                        el.end = ge + 1;
                        return el;
                    }
                    if (html && openStack.indexOf(closeName.toLowerCase()) < 0) {
                        // A stray end tag that closes nothing open: browsers ignore it, and so do we.
                        j = ge < 0 ? t.length : ge + 1;
                        continue;
                    }
                    // HTML leniency: an unclosed element ends where its parent does.
                    el.closeStart = p;
                    el.end = p;
                    el.unclosed = true;
                    if (!closeName) throw new RazorError('Invalid end tag', p);
                    return el;
                }
            } finally {
                openStack.pop();
            }
        }

        // Attribute value: until the closing quote, skipping Razor expressions (which may contain the quote).
        function scanAttrValue(i, q) {
            var j = i;
            if (html) {
                var hq = t.indexOf(q, i);
                if (hq < 0) throw new RazorError('Unterminated attribute value', i);
                return hq;
            }
            while (j < t.length) {
                var c = t[j];
                if (c === q) return j;
                if (c === '@') {
                    if (t[j + 1] === '@') { j += 2; continue; }
                    if (t[j + 1] === '(') { j = matchBalanced(t, j + 1, '(', ')'); continue; }
                    if (t[j + 1] === '*') { j = skipCsToken(t, j); continue; }
                    if (isIdStart(t[j + 1] || '')) {
                        var e = j + 1;
                        // Lambdas and calls inside an implicit expression can hold quotes.
                        e = scanImplicit(t, e);
                        j = Math.max(e, j + 1);
                        continue;
                    }
                }
                if (c === '(' && t.substring(i, j).trim().length === 0) {
                    // An event handler lambda without @, e.g. @onclick="() => Go("x")"
                    j = matchBalanced(t, j, '(', ')');
                    continue;
                }
                j++;
            }
            throw new RazorError('Unterminated attribute value', i);
        }

        // @code: [Parameter] declarations and RenderFragment templates.
        function scanCodeSection(s, e) {
            var body = t.substring(s, e);
            var pre = /\[\s*(Parameter|CascadingParameter)[^\]]*\]\s*(?:\[[^\]]*\]\s*)*(?:public|protected|internal|private)?\s*(?:required\s+)?([\w<>?,\[\]. ]+?)\s+(\w+)\s*\{[^}]*\}(?:\s*=\s*([^;]+);)?/g, m;
            while ((m = pre.exec(body))) {
                res.params[m[3]] = { type: m[2].trim(), def: m[4] ? m[4].trim() : null, cascading: m[1] === 'CascadingParameter' };
            }
            var tre = /(\w+)\s*(?:=>|=)\s*@</g;
            while ((m = tre.exec(body))) {
                var at = s + m.index + m[0].length - 1;
                try {
                    var el = parseElement(at, e);
                    el.template = true;
                    res.templates[m[1]] = el;
                    tre.lastIndex = el.end - s;
                } catch (err) { /* not markup */ }
            }
            // Simple fields and expression-bodied properties with literal values, for design-time evaluation.
            var fre = /(?:private|protected|public|internal)\s+(?:static\s+|readonly\s+|const\s+)*(bool|string|int|double|float|decimal|long)\??\s+(\w+)\s*(?:=|=>)\s*([^;{}]+);/g;
            res.fields = res.fields || {};
            while ((m = fre.exec(body))) res.fields[m[2]] = { type: m[1], expr: m[3].trim() };
        }

        var top = parseMarkupContent(0, t.length, null);
        var topKids = top.kids;
        while (html && top.pos < t.length) {
            // Stray end tags at the top level: skip them.
            var gt = t.indexOf('>', top.pos);
            top = parseMarkupContent(gt < 0 ? t.length : gt + 1, t.length, null);
            topKids = topKids.concat(top.kids);
        }
        if (top.pos < t.length) {
            throw new RazorError('Unexpected ' + t.substring(top.pos, t.indexOf('>', top.pos) + 1), top.pos);
        }
        res.root = { type: 'root', children: topKids, start: 0, end: t.length, id: -1 };
        // Parent links
        (function link(n, parent) {
            n.parent = parent;
            eachChild(n, function (c) { link(c, n); });
        })(res.root, null);
        return res;
    }

    function eachChild(n, f) {
        if (n.children) n.children.forEach(f);
        if (n.branches) n.branches.forEach(function (b) { b.children.forEach(f); });
        if (n.cases) n.cases.forEach(function (c) { c.children.forEach(f); });
    }

    // ---------------------------------------------------------------- C# expressions at design time

    var UNKNOWN = { unknown: true };
    function unk(atom) { return { unknown: true, atom: atom }; }

    function tokenizeCs(s) {
        var toks = [], i = 0;
        while (i < s.length) {
            var c = s[i];
            if (isWs(c)) { i++; continue; }
            var sk = skipCsToken(s, i);
            if (sk >= 0 && (c === '"' || c === '$' || c === '@' || c === "'")) {
                toks.push({ t: 'str', raw: s.substring(i, sk), s: i, e: sk });
                i = sk;
                continue;
            }
            if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
                var m = /^[0-9_]*\.?[0-9_]*(?:[eE][+-]?[0-9]+)?[fFdDmMlLuU]*/.exec(s.substring(i));
                toks.push({ t: 'num', raw: m[0], s: i, e: i + m[0].length });
                i += m[0].length;
                continue;
            }
            if (isIdStart(c)) {
                var j = i;
                while (j < s.length && isId(s[j])) j++;
                toks.push({ t: 'id', raw: s.substring(i, j), s: i, e: j });
                i = j;
                continue;
            }
            var ops = ['??=', '?.', '??', '==', '!=', '<=', '>=', '&&', '||', '=>', '++', '--', '::'];
            var op = null;
            for (var k = 0; k < ops.length; k++) if (s.startsWith(ops[k], i)) { op = ops[k]; break; }
            if (!op) op = c;
            toks.push({ t: 'op', raw: op, s: i, e: i + op.length });
            i += op.length;
        }
        return toks;
    }

    /** Evaluates a C# expression with design-time state. env: { lookup(name) -> value|undefined, cond(atom) -> bool } */
    function evalCs(src, env) {
        var toks;
        try { toks = tokenizeCs(src); } catch (e) { return unk(norm(src)); }
        if (toks.some(function (x) { return x.raw === '=>'; })) return unk(norm(src));
        var p = 0;
        function peek() { return toks[p] ? toks[p].raw : null; }
        function next() { return toks[p++]; }
        function fail() { throw new Error('parse'); }
        function text(a, b) { return b > a && toks[a] ? src.substring(toks[a].s, toks[b - 1].e) : ''; }

        function conditional() {
            var start = p;
            var c = coalesce();
            if (peek() === '?') {
                next();
                var a = conditional();
                if (peek() !== ':') fail();
                next();
                var b = conditional();
                var cb = truth(c, text(start, p));
                return cb ? a : b;
            }
            return c;
        }
        function coalesce() {
            var a = orExpr();
            while (peek() === '??') { next(); var b = orExpr(); a = (a && a.unknown) ? a : (a === null ? b : a); }
            return a;
        }
        function orExpr() {
            var a = andExpr();
            while (peek() === '||') { next(); var b = andExpr(); a = truthVal(a) || truthVal(b); }
            return a;
        }
        function andExpr() {
            var a = eqExpr();
            while (peek() === '&&') { next(); var b = eqExpr(); a = truthVal(a) && truthVal(b); }
            return a;
        }
        function eqExpr() {
            var start = p;
            var a = relExpr();
            while (peek() === '==' || peek() === '!=') {
                var op = next().raw;
                var b = relExpr();
                if ((a && a.unknown) || (b && b.unknown)) a = unk(norm(text(start, p)));
                else a = op === '==' ? a === b : a !== b;
            }
            return a;
        }
        function relExpr() {
            var start = p;
            var a = addExpr();
            while (['<', '>', '<=', '>='].indexOf(peek()) >= 0 || peek() === 'is') {
                var op = next().raw;
                if (op === 'is') { while (p < toks.length && ['&&', '||', '?', ':', ')'].indexOf(peek()) < 0) next(); a = unk(norm(text(start, p))); continue; }
                var b = addExpr();
                if ((a && a.unknown) || (b && b.unknown) || typeof a !== 'number' || typeof b !== 'number') a = unk(norm(text(start, p)));
                else a = op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
            }
            return a;
        }
        function addExpr() {
            var a = mulExpr();
            while (peek() === '+' || peek() === '-') {
                var op = next().raw;
                var b = mulExpr();
                if (op === '+' && (typeof a === 'string' || typeof b === 'string')) {
                    a = strOf(a) + strOf(b);
                } else if (typeof a === 'number' && typeof b === 'number') a = op === '+' ? a + b : a - b;
                else a = UNKNOWN;
            }
            return a;
        }
        function mulExpr() {
            var a = unary();
            while (peek() === '*' || peek() === '/' || peek() === '%') {
                var op = next().raw;
                var b = unary();
                a = typeof a === 'number' && typeof b === 'number' ? (op === '*' ? a * b : op === '/' ? a / b : a % b) : UNKNOWN;
            }
            return a;
        }
        function unary() {
            var start = p;
            if (peek() === '!') { next(); var v = unary(); return !truth(v, text(start + 1, p)); }
            if (peek() === '-') { next(); var n = unary(); return typeof n === 'number' ? -n : UNKNOWN; }
            if (peek() === '(' ) {
                // Cast: (Type)x
                var save = p;
                next();
                var q = p;
                while (toks[q] && (toks[q].t === 'id' || toks[q].raw === '.' || toks[q].raw === '?' || toks[q].raw === '<' || toks[q].raw === '>' || toks[q].raw === ',')) q++;
                if (toks[q] && toks[q].raw === ')' && q > p && toks[q + 1] && (toks[q + 1].t === 'id' || toks[q + 1].t === 'str' || toks[q + 1].raw === '(' || toks[q + 1].t === 'num') && /^[A-Z]/.test(toks[p].raw)) {
                    p = q + 1;
                    var inner = unary();
                    return inner && inner.unknown ? unk(norm(text(save, p))) : inner;
                }
                p = save;
            }
            return primary();
        }
        function primary() {
            var tk = next();
            if (!tk) fail();
            if (tk.t === 'num') return Number(tk.raw.replace(/[_fFdDmMlLuU]/g, ''));
            if (tk.t === 'str') return stringValue(tk.raw, env);
            if (tk.raw === '(') { var v = conditional(); if (next().raw !== ')') fail(); return postfix(v, p); }
            if (tk.t === 'id') {
                if (tk.raw === 'true') return true;
                if (tk.raw === 'false') return false;
                if (tk.raw === 'null') return null;
                if (tk.raw === 'new' || tk.raw === 'typeof' || tk.raw === 'nameof' || tk.raw === 'default') { skipRest(); return UNKNOWN; }
                var start = p - 1;
                // Member chain
                var names = [tk.raw];
                var simple = true;
                while (peek() === '.' || peek() === '?.' || peek() === '(' || peek() === '[' || peek() === '!') {
                    if (peek() === '!' ) { if (toks[p + 1] && toks[p + 1].raw === '.') { next(); continue; } break; }
                    var o = next().raw;
                    if (o === '.' || o === '?.') { var id = next(); if (!id || id.t !== 'id') fail(); names.push(id.raw); continue; }
                    // call or index: skip balanced
                    var depth = 1, close = o === '(' ? ')' : ']';
                    var argStart = p;
                    while (p < toks.length && depth > 0) { if (toks[p].raw === o) depth++; else if (toks[p].raw === close) depth--; p++; }
                    if (names.length === 1 && names[0] === 'Assets' && o === '[') {
                        var arg = text(argStart, p - 1);
                        var sv = evalCs(arg, env);
                        if (typeof sv === 'string') { names = null; return sv; }
                    }
                    simple = false;
                }
                var atomText = norm(text(start, p));
                if (simple && names.length === 1) {
                    var lv = env.lookup(names[0]);
                    if (lv !== undefined) return lv;
                }
                if (simple && names.length > 1) {
                    var lv2 = env.lookup(atomText);
                    if (lv2 !== undefined) return lv2;
                }
                return unk(atomText);
            }
            fail();
        }
        function postfix(v) { return v; }
        function skipRest() { var depth = 0; while (p < toks.length) { var r = toks[p].raw; if (r === '(' || r === '[' || r === '{') depth++; else if (r === ')' || r === ']' || r === '}') { if (depth === 0) break; depth--; } else if (depth === 0 && (r === '?' || r === ':' || r === '&&' || r === '||' || r === '??' || r === ',')) break; p++; } }
        function truth(v, src2) {
            if (v === true || v === false) return v;
            if (v && v.unknown) return env.cond(v.atom || norm(src2));
            if (v === null) return false;
            return !!v;
        }
        function truthVal(v) { return truth(v, ''); }
        try {
            var v = conditional();
            if (p < toks.length) return unk(norm(src));
            return v;
        } catch (e) {
            return unk(norm(src));
        }
    }

    function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

    function strOf(v) {
        if (v === null || v === undefined) return '';
        if (v && v.unknown) return '';
        return String(v);
    }

    function stringValue(raw, env) {
        var interp = false, verbatim = false, i = 0;
        while (raw[i] === '$' || raw[i] === '@') { if (raw[i] === '$') interp = true; else verbatim = true; i++; }
        if (raw[i] === "'") return raw.substring(i + 1, raw.length - 1);
        var body = raw.substring(i + 1, raw.length - 1);
        if (!interp) return verbatim ? body.replace(/""/g, '"') : unescapeCs(body);
        var out = '', j = 0, anyUnknown = false;
        while (j < body.length) {
            var c = body[j];
            if (c === '{') {
                if (body[j + 1] === '{') { out += '{'; j += 2; continue; }
                var e = matchBalanced(body, j, '{', '}');
                var inner = body.substring(j + 1, e - 1);
                var colon = -1, depth = 0;
                for (var k = 0; k < inner.length; k++) { var ch = inner[k]; if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--; else if (ch === ':' && depth === 0 && inner[k - 1] !== ':' && inner[k + 1] !== ':') { colon = k; break; } }
                var v = evalCs(colon >= 0 ? inner.substring(0, colon) : inner, env);
                if (v && v.unknown) anyUnknown = true;
                out += strOf(v);
                j = e;
                continue;
            }
            if (c === '}' && body[j + 1] === '}') { out += '}'; j += 2; continue; }
            if (!verbatim && c === '\\') { out += unescapeCs(body.substring(j, j + 2)); j += 2; continue; }
            out += c;
            j++;
        }
        return out;
    }
    function unescapeCs(s) { return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, function (m, e) { if (e[0] === 'u') return String.fromCharCode(parseInt(e.substring(1), 16)); return { n: '\n', t: '\t', r: '\r', '0': '\0' }[e] || e; }); }

    // ---------------------------------------------------------------- rendering

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    var BUILTIN_SKIP = { PageTitle: 1, HeadContent: 1, HeadOutlet: 1, ImportMap: 1, ResourcePreloader: 1, FocusOnNavigate: 1, DataAnnotationsValidator: 1, ObjectGraphDataAnnotationsValidator: 1, SectionContent: 1, SectionOutlet: 1 };
    var BUILTIN_CHILDREN = { CascadingValue: 1, CascadingAuthenticationState: 1, ErrorBoundary: 1, AuthorizeView: 1, Authorized: 1, ChildContent: 1, LayoutView: 1 };
    var BUILTIN_INPUT = { InputText: 'text', InputNumber: 'number', InputDate: 'date', InputCheckbox: 'checkbox', InputFile: 'file', InputRadio: 'radio' };

    /**
     * Renders a parsed file. project: { files: [{ path, name, parsed, scopeAttr }], byName: { Component: fileIndex } }.
     * state: { conds: { atom: bool }, loops: n, placeholders: bool }. Returns { html, atoms: { atom: default } }.
     */
    function render(project, fileIndex, state, opts) {
        opts = opts || {};
        var out = [];
        var atoms = {};
        var depthGuard = [];

        function makeEnv(file, params, locals) {
            return {
                lookup: function (name) {
                    if (locals && locals.hasOwnProperty(name)) return locals[name];
                    if (params && params.hasOwnProperty(name)) return params[name];
                    var parsed = file.parsed;
                    if (parsed.params[name]) {
                        var pd = parsed.params[name];
                        if (pd.def) { var dv = evalCs(pd.def, makeEnv(file, {}, {})); if (!(dv && dv.unknown)) return dv; }
                        if (/^bool\??$/.test(pd.type)) return undefined; // unknown: design toggle
                        return undefined;
                    }
                    if (parsed.fields && parsed.fields[name] && depthGuard.indexOf('f:' + name) < 0) {
                        depthGuard.push('f:' + name);
                        try {
                            var fv = evalCs(parsed.fields[name].expr, makeEnv(file, params, locals));
                            if (!(fv && fv.unknown)) return fv;
                            return fv.atom === norm(parsed.fields[name].expr) ? unk(name) : fv;
                        } finally { depthGuard.pop(); }
                    }
                    return undefined;
                },
                cond: function (atom) {
                    if (!atoms.hasOwnProperty(atom)) atoms[atom] = true;
                    return state.conds && state.conds.hasOwnProperty(atom) ? !!state.conds[atom] : true;
                },
            };
        }

        function renderNodes(list, ctx) { for (var i = 0; i < list.length; i++) renderNode(list[i], ctx); }

        function renderNode(n, ctx) {
            switch (n.type) {
                case 'text': out.push(n.text); return;
                case 'element': return renderElement(n, ctx);
                case 'expr': return renderExpr(n, ctx);
                case 'if': {
                    for (var i = 0; i < n.branches.length; i++) {
                        var b = n.branches[i];
                        if (b.cond === null) { renderNodes(b.children, ctx); return; }
                        var v = evalCs(b.cond, ctx.env);
                        var on = v === true || v === false ? v : (v && v.unknown ? ctx.env.cond(v.atom) : !!v);
                        if (on) { renderNodes(b.children, ctx); return; }
                    }
                    return;
                }
                case 'loop': {
                    var times = n.kw === 'foreach' || n.kw === 'for' || n.kw === 'while' || n.kw === 'do' ? Math.max(0, state.loops === undefined ? 3 : state.loops) : 1;
                    var locals = Object.create(ctx.locals || null);
                    var m = /^\s*(?:var|[\w<>?,.\[\] ]+?)\s+(\w+)\s+in\s+(.+)$/.exec(n.header || '');
                    if (m) locals[m[1]] = unk(m[1]);
                    var fm = /^\s*(?:var|int|long)\s+(\w+)\s*=\s*([^;]+);\s*\1\s*<\s*([^;]+);/.exec(n.header || '');
                    for (var k = 0; k < times; k++) {
                        var l2 = Object.create(locals);
                        if (fm) { var st = evalCs(fm[2], ctx.env); l2[fm[1]] = typeof st === 'number' ? st + k : unk(fm[1]); }
                        renderNodes(n.children, Object.assign({}, ctx, { locals: l2, env: makeEnv(ctx.file, ctx.params, l2) }));
                    }
                    return;
                }
                case 'switch': {
                    var sv = evalCs(n.expr, ctx.env);
                    var chosen = null;
                    for (var c = 0; c < n.cases.length; c++) {
                        var lab = n.cases[c].label;
                        if (lab === 'default') continue;
                        var cv = evalCs(lab.replace(/^case\s+/, ''), ctx.env);
                        if (!(sv && sv.unknown) && !(cv && cv.unknown) && cv === sv) { chosen = n.cases[c]; break; }
                    }
                    if (!chosen) {
                        var key = 'switch (' + norm(n.expr) + ')';
                        var labels = n.cases.map(function (x) { return x.label; });
                        var pick = state.cases && state.cases[key] !== undefined ? state.cases[key] : 0;
                        if (!atoms.hasOwnProperty(key)) atoms[key] = { cases: labels };
                        chosen = n.cases[Math.min(pick, n.cases.length - 1)];
                    }
                    if (chosen) renderNodes(chosen.children, ctx);
                    return;
                }
                case 'code': return renderNodes(n.children || [], ctx);
                case 'stmt': return declareLocal(n, ctx);
                default: return;
            }
        }

        // `var x = expr;` inside markup code makes x known (or an atom) for what follows.
        function declareLocal(n, ctx) {
            var m = /^\s*(?:var|bool|string|int|double)\s+(\w+)\s*=\s*([\s\S]+?);\s*$/.exec(n.code);
            if (!m || !ctx.locals) return;
            var v = evalCs(m[2], ctx.env);
            ctx.locals[m[1]] = v && v.unknown ? unk(m[1]) : v;
        }

        function renderExpr(n, ctx) {
            var code = n.code.trim();
            // RenderFragments: templates of the file, ChildContent/Body of the caller.
            var name = /^\w+$/.test(code) ? code : null;
            if (name && ctx.file.parsed.templates[name]) {
                var tpl = ctx.file.parsed.templates[name];
                return renderTemplate(tpl, ctx);
            }
            if (name && (name === 'ChildContent' || name === 'Body') && ctx.childContent) return ctx.childContent();
            if (name && ctx.fragments && ctx.fragments[name]) return ctx.fragments[name]();
            var rzx = ctx.fileIndex + ':' + n.id;
            // Design-time content for code the designer cannot run: a drawn XAML element, or sample text.
            if (opts.fragment) {
                var fr = opts.fragment(norm(code), ctx.file, n);
                if (fr !== null && fr !== undefined) {
                    out.push('<div class="rz-frag" data-rzx="' + rzx + '"' + (fr.fit ? ' data-fit="viewbox"' : '') + '>' + fr.html + '</div>');
                    return;
                }
            }
            var v = evalCs(code, ctx.env);
            var samples = state.samples || {};
            if (v && v.unknown && samples.hasOwnProperty(norm(code))) {
                out.push('<span class="rz-ph rz-sample" data-rzx="' + rzx + '" title="@' + esc(code) + '">' + esc(samples[norm(code)]) + '</span>');
                return;
            }
            if (v && v.unknown) {
                if (!state.placeholders) return;
                var label = (v.atom || code).replace(/^\(\w+\)\s*/, '');
                var last = label.split(/[.(\[]/).filter(Boolean);
                var shown = /^\w+$/.test(label) ? label : (last.length ? last[last.length === 1 ? 0 : last.length - 1] : label);
                if (/\(\)$/.test(label) || /\(/.test(label)) shown = label.replace(/\(.*$/, '').split('.').pop();
                out.push('<span class="rz-ph" data-rzx="' + rzx + '" title="@' + esc(code) + '">' + esc(shown) + '</span>');
                return;
            }
            if (v === null || v === undefined) return;
            out.push(esc(strOf(v)));
        }

        function renderTemplate(el, ctx) {
            if (el.name === 'text') return renderNodes(el.children, ctx);
            return renderElement(el, ctx);
        }

        function attrValue(a, ctx) {
            if (a.raw === null) return true;
            var raw = a.raw;
            if (raw.indexOf('@') < 0) return raw;
            // Parts: literal text and @expressions
            var parts = [], i = 0, lit = '';
            while (i < raw.length) {
                var c = raw[i];
                if (c === '@' && raw[i + 1] === '@') { lit += '@'; i += 2; continue; }
                if (c === '@' && raw[i + 1] === '(') {
                    var e = matchBalanced(raw, i + 1, '(', ')');
                    if (lit) { parts.push(lit); lit = ''; }
                    parts.push(evalCs(raw.substring(i + 2, e - 1), ctx.env));
                    i = e;
                    continue;
                }
                if (c === '@' && isIdStart(raw[i + 1] || '')) {
                    var e2 = scanImplicit(raw, i + 1);
                    if (lit) { parts.push(lit); lit = ''; }
                    parts.push(evalCs(raw.substring(i + 1, e2), ctx.env));
                    i = e2;
                    continue;
                }
                lit += c;
                i++;
            }
            if (lit) parts.push(lit);
            if (parts.length === 1 && typeof parts[0] !== 'string') {
                var only = parts[0];
                if (only === true) return true;
                if (only === false || only === null) return false;
                if (only && only.unknown) return false;
                return strOf(only);
            }
            return parts.map(function (x) { return typeof x === 'string' ? x : strOf(x); }).join('').replace(/\s+/g, ' ').trim();
        }

        function renderElement(el, ctx) {
            var name = el.name;
            if (name === 'text' && !opts.html) return renderNodes(el.children, ctx);
            var simple = name.indexOf('.') >= 0 ? name.substring(name.lastIndexOf('.') + 1) : name;
            if (!opts.html && /^[A-Z]/.test(simple)) return renderComponent(el, simple, ctx);
            var lname = name.toLowerCase();
            if (lname === 'script' || lname === 'base') return;
            if (lname === 'meta' && el.attrs.some(function (a) { return a.name.toLowerCase() === 'http-equiv' && /refresh/i.test(a.raw || ''); })) return;
            var tag = name;
            var attrs = [];
            var rzId = ctx.fileIndex + ':' + el.id;
            attrs.push('data-rz="' + rzId + '"');
            if (ctx.file.scopeAttr) attrs.push(ctx.file.scopeAttr);
            if (ctx.compRoot) { attrs.push('data-rzc="' + ctx.compRoot + '"'); }
            for (var i = 0; i < el.attrs.length; i++) {
                var a = el.attrs[i];
                if (a.name[0] === '@') continue; // directive attributes (@onclick, @bind, @ref, @key)
                if (/^on[a-z]+$/i.test(a.name)) continue; // no scripts in the design view
                var v = attrValue(a, ctx);
                if (v === false || v === null || v === undefined) continue;
                if (v === true) { attrs.push(a.name); continue; }
                attrs.push(a.name + '="' + esc(v) + '"');
            }
            // @bind="x" on an input: show its value as unknown.
            out.push('<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>');
            if (el.isVoid || VOID[lname]) return;
            var childCtx = ctx.compRoot ? Object.assign({}, ctx, { compRoot: null }) : ctx;
            if (el.rawContent !== undefined) out.push(lname === 'style' ? el.rawContent : esc(el.rawContent));
            else renderNodes(el.children, childCtx);
            out.push('</' + tag + '>');
        }

        function componentParams(el, file, ctx) {
            var params = {}, fragments = {};
            for (var i = 0; i < el.attrs.length; i++) {
                var a = el.attrs[i];
                if (a.name[0] === '@') continue;
                var pd = file && file.parsed.params[a.name];
                var isString = pd && /^string\??$/.test(pd.type);
                var val;
                var whole = a.raw === null ? null : /^@\(([\s\S]*)\)$|^@([\w.?!\[\]()"]+)$/.exec(a.raw.trim());
                if (a.raw === null) val = true;
                else if (whole) val = evalCs(whole[1] !== undefined ? whole[1] : whole[2], ctx.env);
                else if (a.raw.indexOf('@') >= 0) val = attrValue(a, ctx);
                else if (pd && !isString) val = evalCs(a.raw, ctx.env);
                else val = a.raw;
                params[a.name] = val;
            }
            return { params: params, fragments: fragments };
        }

        function renderComponent(el, simple, ctx) {
            var o = out;
            var rzId = ctx.fileIndex + ':' + el.id;
            if (BUILTIN_SKIP[simple]) return;
            var childContent = el.children.length ? function () { renderNodes(el.children, Object.assign({}, ctx, { compRoot: null })); } : null;
            if (BUILTIN_CHILDREN[simple]) {
                // Named child fragments (<Authorized>, <ChildContent>) render as their content.
                if (childContent) renderNodes(el.children, Object.assign({}, ctx, { compRoot: ctx.compRoot || rzId }));
                return;
            }
            if (BUILTIN_INPUT[simple]) {
                o.push('<input type="' + BUILTIN_INPUT[simple] + '" data-rz="' + rzId + '"' + (ctx.file.scopeAttr ? ' ' + ctx.file.scopeAttr : '') + classAttr(el, ctx) + '>');
                return;
            }
            if (simple === 'InputTextArea') { o.push('<textarea data-rz="' + rzId + '"' + classAttr(el, ctx) + '></textarea>'); return; }
            if (simple === 'InputSelect') { o.push('<select data-rz="' + rzId + '"' + classAttr(el, ctx) + '>'); if (childContent) childContent(); o.push('</select>'); return; }
            if (simple === 'EditForm') { o.push('<form data-rz="' + rzId + '"' + classAttr(el, ctx) + '>'); if (childContent) childContent(); o.push('</form>'); return; }
            if (simple === 'NavLink') {
                var href = el.attrs.filter(function (a) { return a.name === 'href'; })[0];
                o.push('<a data-rz="' + rzId + '"' + (ctx.file.scopeAttr ? ' ' + ctx.file.scopeAttr : '') + classAttr(el, ctx) + (href ? ' href="' + esc(href.raw || '') + '"' : '') + '>');
                if (childContent) childContent();
                o.push('</a>');
                return;
            }
            var fi = project.byName[simple];
            if (fi === undefined || depthGuard.length > 12 || depthGuard.indexOf(fi) >= 0) {
                o.push('<div class="rz-comp-ph" data-rz="' + rzId + '" title="' + esc(el.name) + ' (rendered at run time)">' + esc(simple) + '</div>');
                return;
            }
            var file = project.files[fi];
            var pr = componentParams(el, file, ctx);
            depthGuard.push(fi);
            try {
                var cctx = {
                    file: file, fileIndex: fi, params: pr.params, locals: {},
                    childContent: childContent, fragments: pr.fragments, compRoot: rzId,
                };
                cctx.env = makeEnv(file, pr.params, cctx.locals);
                renderNodes(file.parsed.root.children, cctx);
            } finally {
                depthGuard.pop();
            }
        }

        function classAttr(el, ctx) {
            var c = el.attrs.filter(function (a) { return a.name === 'class'; })[0];
            if (!c) return '';
            var v = attrValue(c, ctx);
            return typeof v === 'string' && v ? ' class="' + esc(v) + '"' : '';
        }

        var file = project.files[fileIndex];
        var ctx = { file: file, fileIndex: fileIndex, params: {}, locals: {}, compRoot: null };
        ctx.env = makeEnv(file, {}, ctx.locals);
        var layoutFi = opts.layout !== undefined ? opts.layout : null;
        if (layoutFi !== null && layoutFi !== fileIndex && project.files[layoutFi]) {
            var lf = project.files[layoutFi];
            var lctx = { file: lf, fileIndex: layoutFi, params: {}, locals: {}, compRoot: null };
            lctx.env = makeEnv(lf, {}, lctx.locals);
            lctx.childContent = function () { renderNodes(file.parsed.root.children, ctx); };
            renderNodes(lf.parsed.root.children, lctx);
        } else {
            renderNodes(file.parsed.root.children, ctx);
        }
        return { html: out.join(''), atoms: atoms };
    }

    // ---------------------------------------------------------------- CSS

    /** Parses CSS into style rules with offsets: { selector, selStart, selEnd, start, end, decls: [{ prop, value, start, end, vStart, vEnd }], media } */
    function parseCss(text) {
        var rules = [];
        function skipComment(i) { if (text.startsWith('/*', i)) { var e = text.indexOf('*/', i + 2); return e < 0 ? text.length : e + 2; } return i; }
        function block(i, end, media) {
            while (i < end) {
                while (i < end && (isWs(text[i]) || text.startsWith('/*', i))) i = isWs(text[i]) ? i + 1 : skipComment(i);
                if (i >= end) break;
                if (text[i] === '}') { i++; continue; }
                var s = i;
                // prelude up to '{' or ';'
                var j = i;
                while (j < end && text[j] !== '{' && text[j] !== ';') {
                    if (text[j] === '"' || text[j] === "'") { var q = text[j]; j++; while (j < end && text[j] !== q) { if (text[j] === '\\') j++; j++; } }
                    else if (text.startsWith('/*', j)) { j = skipComment(j) - 1; }
                    j++;
                }
                if (j >= end || text[j] === ';') { i = j + 1; continue; }
                var prelude = text.substring(s, j).trim();
                var close = matchCssBrace(j, end);
                if (prelude[0] === '@') {
                    if (/^@(media|supports|layer|container|document)/.test(prelude)) block(j + 1, close - 1, (media ? media + ' and ' : '') + prelude);
                    i = close;
                    continue;
                }
                var rule = { selector: prelude, selStart: s, selEnd: s + text.substring(s, j).replace(/\s+$/, '').length, start: s, end: close, bodyStart: j + 1, bodyEnd: close - 1, decls: [], media: media || null };
                parseDecls(rule);
                rules.push(rule);
                i = close;
            }
        }
        function matchCssBrace(i, end) {
            var depth = 0;
            for (var j = i; j < end; j++) {
                var c = text[j];
                if (c === '"' || c === "'") { var q = c; j++; while (j < end && text[j] !== q) { if (text[j] === '\\') j++; j++; } continue; }
                if (text.startsWith('/*', j)) { j = skipComment(j) - 1; continue; }
                if (c === '{') depth++;
                else if (c === '}') { depth--; if (depth === 0) return j + 1; }
            }
            return end;
        }
        function parseDecls(rule) {
            var i = rule.bodyStart, end = rule.bodyEnd;
            while (i < end) {
                while (i < end && (isWs(text[i]) || text[i] === ';' || text.startsWith('/*', i))) i = text.startsWith('/*', i) ? skipComment(i) : i + 1;
                if (i >= end) break;
                var ps = i;
                while (i < end && text[i] !== ':' && text[i] !== ';') i++;
                if (text[i] !== ':') { i++; continue; }
                var prop = text.substring(ps, i).trim();
                i++;
                var vs = i, depth = 0;
                while (i < end) {
                    var c = text[i];
                    if (c === '"' || c === "'") { var q = c; i++; while (i < end && text[i] !== q) { if (text[i] === '\\') i++; i++; } i++; continue; }
                    if (c === '(') depth++;
                    else if (c === ')') depth--;
                    else if (c === ';' && depth === 0) break;
                    i++;
                }
                var rawV = text.substring(vs, i);
                var lead = rawV.length - rawV.replace(/^\s+/, '').length;
                var trail = rawV.length - rawV.replace(/\s+$/, '').length;
                rule.decls.push({ prop: prop.toLowerCase(), value: rawV.trim(), start: ps, end: i < end ? i + 1 : i, vStart: vs + lead, vEnd: i - trail });
                i++;
            }
        }
        block(0, text.length, null);
        return rules;
    }

    function splitTopLevel(s, sep) {
        var out = [], depth = 0, cur = '', q = null;
        for (var i = 0; i < s.length; i++) {
            var c = s[i];
            if (q) { cur += c; if (c === q) q = null; continue; }
            if (c === '"' || c === "'") { q = c; cur += c; continue; }
            if (c === '(' || c === '[') depth++;
            if (c === ')' || c === ']') depth--;
            if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        out.push(cur);
        return out;
    }

    /** Blazor CSS isolation: the scope attribute goes on the last compound selector (before ::deep, if any). */
    function scopeSelector(sel, attr) {
        return splitTopLevel(sel, ',').map(function (part) {
            var p = part.trim();
            var deep = p.indexOf('::deep');
            if (deep >= 0) {
                var left = p.substring(0, deep).trim(), right = p.substring(deep + 6).trim();
                return (left ? addToLast(left, attr) : '[' + attr + ']') + (right ? ' ' + right : '');
            }
            return addToLast(p, attr);
        }).join(', ');
    }
    function addToLast(sel, attr) {
        // Find the start of the last compound selector.
        var depth = 0, lastStart = 0;
        for (var i = 0; i < sel.length; i++) {
            var c = sel[i];
            if (c === '(' || c === '[') depth++;
            else if (c === ')' || c === ']') depth--;
            else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~')) lastStart = i + 1;
        }
        var head = sel.substring(0, lastStart), comp = sel.substring(lastStart);
        // Before the first pseudo-class/element of that compound.
        depth = 0;
        for (var k = 0; k < comp.length; k++) {
            var ch = comp[k];
            if (ch === '(' || ch === '[') depth++;
            else if (ch === ')' || ch === ']') depth--;
            else if (ch === ':' && depth === 0) return head + comp.substring(0, k) + '[' + attr + ']' + comp.substring(k);
        }
        return head + comp + '[' + attr + ']';
    }

    /** The CSS text of a .razor.css file with every selector scoped to attr. */
    function scopeCss(text, attr) {
        var rules = parseCss(text);
        var out = '', pos = 0;
        rules.forEach(function (r) {
            if (/^\s*(from|to|\d+%)/.test(r.selector)) return; // keyframe steps
            out += text.substring(pos, r.selStart) + scopeSelector(r.selector, attr);
            pos = r.selEnd;
        });
        return out + text.substring(pos);
    }

    // ---------------------------------------------------------------- edits

    function escAttr(v, quote) {
        var s = String(v).replace(/&/g, '&amp;');
        return quote === "'" ? s.replace(/'/g, '&#39;') : s.replace(/"/g, '&quot;');
    }

    function findAttr(el, name) { for (var i = 0; i < el.attrs.length; i++) if (el.attrs[i].name === name) return el.attrs[i]; return null; }

    /** Sets (or removes, value null) an attribute's raw value. Raw means Razor source (may contain @expressions). */
    function setAttrEdit(text, el, name, value) {
        var a = findAttr(el, name);
        if (a) {
            if (value === null) {
                var s = a.start;
                while (s > 0 && /[ \t]/.test(text[s - 1])) s--;
                if (s > 0 && text[s - 1] === '\n') {
                    var ls = s;
                    while (ls > 0 && /[\r\n]/.test(text[ls - 1])) ls--;
                    return { offset: ls, length: a.end - ls, text: '' };
                }
                return { offset: s, length: a.end - s, text: '' };
            }
            var raw = value.indexOf('@') >= 0 ? value : escAttr(value, a.quote || '"');
            if (a.raw === null) return { offset: a.end, length: 0, text: '="' + raw + '"' };
            if (!a.quote) return { offset: a.vStart, length: a.vEnd - a.vStart, text: '"' + raw + '"' };
            return { offset: a.vStart, length: a.vEnd - a.vStart, text: raw };
        }
        if (value === null) return null;
        var pos = el.attrs.length ? el.attrs[el.attrs.length - 1].end : el.nameEnd;
        return { offset: pos, length: 0, text: ' ' + name + '="' + (value.indexOf('@') >= 0 ? value : escAttr(value)) + '"' };
    }

    function lineIndent(text, offset) {
        var ls = offset;
        while (ls > 0 && text[ls - 1] !== '\n') ls--;
        var m = /^[ \t]*/.exec(text.substring(ls, offset));
        return m ? m[0] : '';
    }
    function eol(text) { return text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'; }

    /** The range of a node including its line when it stands alone. */
    function nodeLineRange(text, n) {
        var s = n.start, e = n.end;
        var ls = s;
        while (ls > 0 && /[ \t]/.test(text[ls - 1])) ls--;
        var le = e;
        while (le < text.length && /[ \t]/.test(text[le])) le++;
        if ((ls === 0 || text[ls - 1] === '\n') && (le >= text.length || text[le] === '\r' || text[le] === '\n')) {
            if (text[le] === '\r') le++;
            if (text[le] === '\n') le++;
            return { start: ls, end: le, whole: true };
        }
        return { start: s, end: e, whole: false };
    }

    function deleteNodeEdit(text, n) {
        var r = nodeLineRange(text, n);
        return { offset: r.start, length: r.end - r.start, text: '' };
    }

    /** Text of a node re-indented from its own indentation to newIndent. */
    function reindent(text, n, newIndent) {
        var src = text.substring(n.start, n.end);
        var old = lineIndent(text, n.start);
        var nl = eol(text);
        return src.split(/\r?\n/).map(function (line, i) {
            if (i === 0) return line;
            return line.indexOf(old) === 0 ? newIndent + line.substring(old.length) : line;
        }).join(nl);
    }

    /** Edit inserting markup before or after a node (on its own line) or as the last child of an element. */
    function insertEdit(text, target, where, markup) {
        var nl = eol(text);
        var unit = detectIndentUnit(text);
        if (where === 'inside') {
            var ind = lineIndent(text, target.start) + unit;
            if (target.selfClosing) {
                var s = target.tagEnd - 2;
                while (s > 0 && /\s/.test(text[s - 1])) s--;
                return { offset: s, length: target.tagEnd - s, text: '>' + nl + ind + markup + nl + lineIndent(text, target.start) + '</' + target.name + '>' };
            }
            var cs = target.closeStart;
            var ls = cs;
            while (ls > 0 && /[ \t]/.test(text[ls - 1])) ls--;
            if (ls > 0 && text[ls - 1] === '\n') return { offset: ls, length: 0, text: ind + markup + nl };
            return { offset: cs, length: 0, text: nl + ind + markup + nl + lineIndent(text, target.start) };
        }
        var r = nodeLineRange(text, target);
        var indent = lineIndent(text, target.start);
        if (r.whole) {
            if (where === 'before') return { offset: r.start, length: 0, text: indent + markup + nl };
            return { offset: r.end, length: 0, text: indent + markup + nl };
        }
        if (where === 'before') return { offset: target.start, length: 0, text: markup };
        return { offset: target.end, length: 0, text: markup };
    }

    function detectIndentUnit(text) {
        if (/\n\t+</.test(text)) return '\t';
        var re = /\n( +)</g, r, counts = {}, n = 0;
        while ((r = re.exec(text)) && n < 200) { counts[r[1].length] = 1; n++; }
        var lens = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
        for (var i = 1; i < lens.length; i++) { var d = lens[i] - lens[i - 1]; if (d === 2 || d === 4) return d === 2 ? '  ' : '    '; }
        return '    ';
    }

    /** Parses an inline style into [{ prop, value }]; serialize keeps the order. */
    function parseStyle(s) {
        return splitTopLevel(s || '', ';').map(function (d) {
            var i = d.indexOf(':');
            if (i < 0) return null;
            return { prop: d.substring(0, i).trim().toLowerCase(), value: d.substring(i + 1).trim() };
        }).filter(function (x) { return x && x.prop; });
    }
    function serializeStyle(list) { return list.map(function (d) { return d.prop + ': ' + d.value; }).join('; ') + (list.length ? ';' : ''); }
    function setStyleProps(style, changes) {
        var list = parseStyle(style);
        Object.keys(changes).forEach(function (p) {
            var v = changes[p];
            var idx = -1;
            for (var i = 0; i < list.length; i++) if (list[i].prop === p) idx = i;
            if (v === null || v === '') { if (idx >= 0) list.splice(idx, 1); }
            else if (idx >= 0) list[idx].value = v;
            else list.push({ prop: p, value: v });
        });
        return serializeStyle(list);
    }

    /** Deepest node (element, component, block) containing offset. */
    function nodeAtOffset(parsed, offset) {
        var best = null;
        parsed.nodes.forEach(function (n) {
            if (n.type !== 'element' && n.type !== 'if' && n.type !== 'loop' && n.type !== 'expr') return;
            if (n.start <= offset && offset < n.end && (!best || n.start >= best.start)) best = n;
        });
        return best;
    }

    var api = {
        RazorError: RazorError,
        parseRazor: parseRazor,
        eachChild: eachChild,
        evalCs: evalCs,
        render: render,
        parseCss: parseCss,
        scopeSelector: scopeSelector,
        scopeCss: scopeCss,
        setAttrEdit: setAttrEdit,
        deleteNodeEdit: deleteNodeEdit,
        insertEdit: insertEdit,
        nodeLineRange: nodeLineRange,
        reindent: reindent,
        lineIndent: lineIndent,
        parseStyle: parseStyle,
        setStyleProps: setStyleProps,
        findAttr: findAttr,
        nodeAtOffset: nodeAtOffset,
        norm: norm,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RazorCore = api;
})(typeof self !== 'undefined' ? self : this);
