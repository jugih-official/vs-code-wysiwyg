/*
 * WPF XAML core for the visual designer: a position-preserving XML parser, the WPF value system
 * (local values, styles, triggers, resources, bindings with FallbackValue) and a renderer that maps
 * WPF layout to HTML/CSS. The layout rules follow the Blazor renderer of the distribution_system
 * project (XamlRenderer.cs / wpf.css), which was measured against real WPF.
 *
 * Runs in the webview and in Node (for tests): no DOM access here.
 */
(function (root) {
    'use strict';

    // =====================================================================================
    // XML parser that keeps source offsets, so edits can touch only the changed characters.
    // =====================================================================================

    function XmlError(message, offset) {
        this.message = message;
        this.offset = offset;
    }

    var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

    function decodeEntities(s) {
        if (s.indexOf('&') < 0) return s;
        return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, function (m, e) {
            if (e[0] === '#') {
                var code = e[1] === 'x' ? parseInt(e.substring(2), 16) : parseInt(e.substring(1), 10);
                return isNaN(code) ? m : String.fromCodePoint(code);
            }
            return ENTITIES.hasOwnProperty(e) ? ENTITIES[e] : m;
        });
    }

    function isNameChar(c) {
        return !(c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '=' || c === '>' || c === '/' || c === '"' || c === "'" || c === '<');
    }

    /**
     * Parses XML text into element nodes:
     * { name, localName, attrs: [{ name, value, start, end, vStart, vEnd }], start, tagEnd, closeStart, end,
     *   selfClosing, children: [elements], items: [elements and { text, start, end }], parent }
     * start/end cover the whole element, tagEnd is the offset after the start tag's '>'.
     */
    function parseXml(text) {
        var doc = { name: '#document', children: [], items: [], parent: null };
        var stack = [doc];
        var i = 0, n = text.length;
        while (i < n) {
            var lt = text.indexOf('<', i);
            if (lt < 0) lt = n;
            if (lt > i && stack.length > 1) {
                var raw = text.substring(i, lt);
                stack[stack.length - 1].items.push({ text: decodeEntities(raw), start: i, end: lt });
            }
            if (lt >= n) break;
            i = lt;
            if (text.startsWith('<!--', i)) {
                var ce = text.indexOf('-->', i + 4);
                if (ce < 0) throw new XmlError('Unterminated comment', i);
                i = ce + 3;
                continue;
            }
            if (text.startsWith('<![CDATA[', i)) {
                var cd = text.indexOf(']]>', i + 9);
                if (cd < 0) throw new XmlError('Unterminated CDATA section', i);
                if (stack.length > 1) stack[stack.length - 1].items.push({ text: text.substring(i + 9, cd), start: i, end: cd + 3, cdata: true });
                i = cd + 3;
                continue;
            }
            if (text.startsWith('<?', i)) {
                var pe = text.indexOf('?>', i + 2);
                if (pe < 0) throw new XmlError('Unterminated processing instruction', i);
                i = pe + 2;
                continue;
            }
            if (text.startsWith('<!', i)) {
                var de = text.indexOf('>', i + 2);
                if (de < 0) throw new XmlError('Unterminated declaration', i);
                i = de + 1;
                continue;
            }
            if (text[i + 1] === '/') {
                var gt = text.indexOf('>', i + 2);
                if (gt < 0) throw new XmlError('Unterminated end tag', i);
                var closeName = text.substring(i + 2, gt).trim();
                var top = stack[stack.length - 1];
                if (stack.length === 1 || top.name !== closeName) {
                    throw new XmlError('Unexpected </' + closeName + '>' + (stack.length > 1 ? ', expected </' + top.name + '>' : ''), i);
                }
                top.closeStart = i;
                top.end = gt + 1;
                stack.pop();
                i = gt + 1;
                continue;
            }
            // Start tag
            var j = i + 1;
            while (j < n && isNameChar(text[j])) j++;
            var name = text.substring(i + 1, j);
            if (!name) throw new XmlError('Invalid tag', i);
            var el = {
                name: name,
                localName: name.indexOf(':') >= 0 ? name.substring(name.indexOf(':') + 1) : name,
                attrs: [], start: i, tagEnd: -1, closeStart: -1, end: -1, selfClosing: false,
                children: [], items: [], parent: stack[stack.length - 1], nameEnd: j,
            };
            for (;;) {
                while (j < n && /\s/.test(text[j])) j++;
                if (j >= n) throw new XmlError('Unterminated start tag <' + name, i);
                if (text[j] === '/' && text[j + 1] === '>') {
                    el.selfClosing = true;
                    el.tagEnd = j + 2;
                    el.closeStart = j;
                    el.end = j + 2;
                    j += 2;
                    break;
                }
                if (text[j] === '>') {
                    el.tagEnd = j + 1;
                    j++;
                    break;
                }
                var as = j;
                while (j < n && isNameChar(text[j])) j++;
                var an = text.substring(as, j);
                if (!an) throw new XmlError('Invalid attribute in <' + name, j);
                while (j < n && /\s/.test(text[j])) j++;
                if (text[j] !== '=') throw new XmlError('Expected = after ' + an, j);
                j++;
                while (j < n && /\s/.test(text[j])) j++;
                var q = text[j];
                if (q !== '"' && q !== "'") throw new XmlError('Expected quote for ' + an, j);
                var ve = text.indexOf(q, j + 1);
                if (ve < 0) throw new XmlError('Unterminated attribute value ' + an, j);
                el.attrs.push({ name: an, value: decodeEntities(text.substring(j + 1, ve)), start: as, end: ve + 1, vStart: j + 1, vEnd: ve });
                j = ve + 1;
            }
            var parent = stack[stack.length - 1];
            parent.children.push(el);
            parent.items.push(el);
            if (!el.selfClosing) stack.push(el);
            i = j;
        }
        if (stack.length > 1) throw new XmlError('Unclosed element <' + stack[stack.length - 1].name + '>', stack[stack.length - 1].start);
        if (doc.children.length === 0) throw new XmlError('No root element', 0);
        return doc.children[0];
    }

    function attrOf(node, name) {
        for (var i = 0; i < node.attrs.length; i++) if (node.attrs[i].name === name) return node.attrs[i];
        return null;
    }
    function attrValue(node, name) {
        var a = attrOf(node, name);
        return a ? a.value : null;
    }

    // =====================================================================================
    // Values: numbers, thickness, colours, markup extensions
    // =====================================================================================

    function num(s) {
        if (s === null || s === undefined) return null;
        if (typeof s === 'number') return s;
        var t = String(s).trim();
        if (/^(auto|nan)$/i.test(t)) return null;
        var v = Number(t);
        return isNaN(v) || t === '' ? null : v;
    }

    function fmt(v) {
        var r = Math.round(v * 10000) / 10000;
        if (Object.is(r, -0)) r = 0;
        return String(r);
    }

    function parseThickness(s) {
        if (s === null || s === undefined) return null;
        if (typeof s === 'number') return { l: s, t: s, r: s, b: s };
        var p = String(s).split(/[\s,]+/).filter(function (x) { return x.length; }).map(function (x) { return num(x) || 0; });
        if (p.length === 1) return { l: p[0], t: p[0], r: p[0], b: p[0] };
        if (p.length === 2) return { l: p[0], t: p[1], r: p[0], b: p[1] };
        if (p.length === 4) return { l: p[0], t: p[1], r: p[2], b: p[3] };
        return { l: 0, t: 0, r: 0, b: 0 };
    }
    function thicknessCss(t) { return fmt(t.t) + 'px ' + fmt(t.r) + 'px ' + fmt(t.b) + 'px ' + fmt(t.l) + 'px'; }
    function thicknessZero(t) { return !t || (t.l === 0 && t.t === 0 && t.r === 0 && t.b === 0); }
    function formatThickness(t, original) {
        var parts = original ? String(original).split(/[\s,]+/).filter(function (x) { return x.length; }).length : 4;
        if (parts === 1 && t.l === t.t && t.t === t.r && t.r === t.b) return fmt(t.l);
        if (parts === 2 && t.l === t.r && t.t === t.b) return fmt(t.l) + ',' + fmt(t.t);
        return fmt(t.l) + ',' + fmt(t.t) + ',' + fmt(t.r) + ',' + fmt(t.b);
    }

    function parseCornerRadius(s) {
        var p = String(s).split(/[\s,]+/).filter(function (x) { return x.length; }).map(function (x) { return num(x) || 0; });
        if (p.length === 4) return fmt(p[0]) + 'px ' + fmt(p[1]) + 'px ' + fmt(p[2]) + 'px ' + fmt(p[3]) + 'px';
        return p.length ? fmt(p[0]) + 'px' : '0';
    }

    var KNOWN_COLORS = {
        aliceblue: 0xFFF0F8FF, antiquewhite: 0xFFFAEBD7, aqua: 0xFF00FFFF, aquamarine: 0xFF7FFFD4, azure: 0xFFF0FFFF,
        beige: 0xFFF5F5DC, bisque: 0xFFFFE4C4, black: 0xFF000000, blanchedalmond: 0xFFFFEBCD, blue: 0xFF0000FF,
        blueviolet: 0xFF8A2BE2, brown: 0xFFA52A2A, burlywood: 0xFFDEB887, cadetblue: 0xFF5F9EA0, chartreuse: 0xFF7FFF00,
        chocolate: 0xFFD2691E, coral: 0xFFFF7F50, cornflowerblue: 0xFF6495ED, cornsilk: 0xFFFFF8DC, crimson: 0xFFDC143C,
        cyan: 0xFF00FFFF, darkblue: 0xFF00008B, darkcyan: 0xFF008B8B, darkgoldenrod: 0xFFB8860B, darkgray: 0xFFA9A9A9,
        darkgreen: 0xFF006400, darkkhaki: 0xFFBDB76B, darkmagenta: 0xFF8B008B, darkolivegreen: 0xFF556B2F,
        darkorange: 0xFFFF8C00, darkorchid: 0xFF9932CC, darkred: 0xFF8B0000, darksalmon: 0xFFE9967A,
        darkseagreen: 0xFF8FBC8F, darkslateblue: 0xFF483D8B, darkslategray: 0xFF2F4F4F, darkturquoise: 0xFF00CED1,
        darkviolet: 0xFF9400D3, deeppink: 0xFFFF1493, deepskyblue: 0xFF00BFFF, dimgray: 0xFF696969,
        dodgerblue: 0xFF1E90FF, firebrick: 0xFFB22222, floralwhite: 0xFFFFFAF0, forestgreen: 0xFF228B22,
        fuchsia: 0xFFFF00FF, gainsboro: 0xFFDCDCDC, ghostwhite: 0xFFF8F8FF, gold: 0xFFFFD700, goldenrod: 0xFFDAA520,
        gray: 0xFF808080, green: 0xFF008000, greenyellow: 0xFFADFF2F, honeydew: 0xFFF0FFF0, hotpink: 0xFFFF69B4,
        indianred: 0xFFCD5C5C, indigo: 0xFF4B0082, ivory: 0xFFFFFFF0, khaki: 0xFFF0E68C, lavender: 0xFFE6E6FA,
        lavenderblush: 0xFFFFF0F5, lawngreen: 0xFF7CFC00, lemonchiffon: 0xFFFFFACD, lightblue: 0xFFADD8E6,
        lightcoral: 0xFFF08080, lightcyan: 0xFFE0FFFF, lightgoldenrodyellow: 0xFFFAFAD2, lightgray: 0xFFD3D3D3,
        lightgreen: 0xFF90EE90, lightpink: 0xFFFFB6C1, lightsalmon: 0xFFFFA07A, lightseagreen: 0xFF20B2AA,
        lightskyblue: 0xFF87CEFA, lightslategray: 0xFF778899, lightsteelblue: 0xFFB0C4DE, lightyellow: 0xFFFFFFE0,
        lime: 0xFF00FF00, limegreen: 0xFF32CD32, linen: 0xFFFAF0E6, magenta: 0xFFFF00FF, maroon: 0xFF800000,
        mediumaquamarine: 0xFF66CDAA, mediumblue: 0xFF0000CD, mediumorchid: 0xFFBA55D3, mediumpurple: 0xFF9370DB,
        mediumseagreen: 0xFF3CB371, mediumslateblue: 0xFF7B68EE, mediumspringgreen: 0xFF00FA9A,
        mediumturquoise: 0xFF48D1CC, mediumvioletred: 0xFFC71585, midnightblue: 0xFF191970, mintcream: 0xFFF5FFFA,
        mistyrose: 0xFFFFE4E1, moccasin: 0xFFFFE4B5, navajowhite: 0xFFFFDEAD, navy: 0xFF000080, oldlace: 0xFFFDF5E6,
        olive: 0xFF808000, olivedrab: 0xFF6B8E23, orange: 0xFFFFA500, orangered: 0xFFFF4500, orchid: 0xFFDA70D6,
        palegoldenrod: 0xFFEEE8AA, palegreen: 0xFF98FB98, paleturquoise: 0xFFAFEEEE, palevioletred: 0xFFDB7093,
        papayawhip: 0xFFFFEFD5, peachpuff: 0xFFFFDAB9, peru: 0xFFCD853F, pink: 0xFFFFC0CB, plum: 0xFFDDA0DD,
        powderblue: 0xFFB0E0E6, purple: 0xFF800080, red: 0xFFFF0000, rosybrown: 0xFFBC8F8F, royalblue: 0xFF4169E1,
        saddlebrown: 0xFF8B4513, salmon: 0xFFFA8072, sandybrown: 0xFFF4A460, seagreen: 0xFF2E8B57, seashell: 0xFFFFF5EE,
        sienna: 0xFFA0522D, silver: 0xFFC0C0C0, skyblue: 0xFF87CEEB, slateblue: 0xFF6A5ACD, slategray: 0xFF708090,
        snow: 0xFFFFFAFA, springgreen: 0xFF00FF7F, steelblue: 0xFF4682B4, tan: 0xFFD2B48C, teal: 0xFF008080,
        thistle: 0xFFD8BFD8, tomato: 0xFFFF6347, transparent: 0x00FFFFFF, turquoise: 0xFF40E0D0, violet: 0xFFEE82EE,
        wheat: 0xFFF5DEB3, white: 0xFFFFFFFF, whitesmoke: 0xFFF5F5F5, yellow: 0xFFFFFF00, yellowgreen: 0xFF9ACD32,
    };

    // SystemColors with the Windows 10/11 default theme.
    var SYSTEM_COLORS = {
        HighlightTextBrushKey: '#FFFFFFFF', HighlightBrushKey: '#FF0078D7', ControlBrushKey: '#FFF0F0F0',
        ControlTextBrushKey: '#FF000000', WindowBrushKey: '#FFFFFFFF', WindowTextBrushKey: '#FF000000',
        GrayTextBrushKey: '#FF6D6D6D', InfoBrushKey: '#FFFFFFE1', InfoTextBrushKey: '#FF000000',
        MenuBarBrushKey: '#FFF0F0F0', MenuBrushKey: '#FFF0F0F0', MenuTextBrushKey: '#FF000000',
        ControlLightBrushKey: '#FFE3E3E3', ControlDarkBrushKey: '#FFA0A0A0', ControlDarkDarkBrushKey: '#FF696969',
        ControlLightLightBrushKey: '#FFFFFFFF', ActiveBorderBrushKey: '#FFB4B4B4', AppWorkspaceBrushKey: '#FFABABAB',
        ActiveCaptionBrushKey: '#FF99B4D1', InactiveCaptionBrushKey: '#FFBFCDDB', HotTrackBrushKey: '#FF0066CC',
    };

    /** Parses a WPF colour: #AARRGGBB, #RRGGBB, #ARGB, #RGB or a known name. Returns {a,r,g,b} or null. */
    function parseColor(s) {
        if (s === null || s === undefined) return null;
        var t = String(s).trim();
        if (!t) return null;
        if (t[0] === '#') {
            var h = t.substring(1);
            if (!/^[0-9a-fA-F]+$/.test(h)) return null;
            var v = parseInt(h, 16);
            var d = function (x) { return (x & 0xF) * 17; };
            switch (h.length) {
                case 8: return { a: (v >>> 24) & 255, r: (v >>> 16) & 255, g: (v >>> 8) & 255, b: v & 255 };
                case 6: return { a: 255, r: (v >>> 16) & 255, g: (v >>> 8) & 255, b: v & 255 };
                case 4: return { a: d(v >>> 12), r: d(v >>> 8), g: d(v >>> 4), b: d(v) };
                case 3: return { a: 255, r: d(v >>> 8), g: d(v >>> 4), b: d(v) };
                default: return null;
            }
        }
        if (/^sc#/i.test(t)) {
            var p = t.substring(3).split(',').map(Number);
            var to8 = function (x) { x = Math.max(0, Math.min(1, x)); x = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(x * 255); };
            if (p.length === 4) return { a: Math.round(p[0] * 255), r: to8(p[1]), g: to8(p[2]), b: to8(p[3]) };
            if (p.length === 3) return { a: 255, r: to8(p[0]), g: to8(p[1]), b: to8(p[2]) };
            return null;
        }
        var k = KNOWN_COLORS[t.toLowerCase()];
        if (k === undefined) return null;
        return { a: (k >>> 24) & 255, r: (k >>> 16) & 255, g: (k >>> 8) & 255, b: k & 255 };
    }

    function colorCss(c) {
        if (c.a === 255) return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + fmt(c.a / 255) + ')';
    }
    function colorHex(c) {
        var h = function (x) { return (x < 16 ? '0' : '') + x.toString(16).toUpperCase(); };
        return '#' + h(c.a) + h(c.r) + h(c.g) + h(c.b);
    }

    /** Parses "{Name positional, Key=Value, Key={Nested ...}}" into { name, positional: [], named: {} }. */
    function parseMarkup(s) {
        if (typeof s !== 'string') return null;
        var t = s.trim();
        if (t.length < 2 || t[0] !== '{' || t[t.length - 1] !== '}' || t.startsWith('{}')) return null;
        var body = t.substring(1, t.length - 1).trim();
        var sp = body.search(/[\s,]/);
        var name = sp < 0 ? body : body.substring(0, sp);
        var rest = sp < 0 ? '' : body.substring(sp).trim();
        var args = [];
        var depth = 0, cur = '', quote = null;
        for (var i = 0; i < rest.length; i++) {
            var c = rest[i];
            if (quote) {
                if (c === quote) quote = null; else cur += c;
                continue;
            }
            if (c === "'" && depth === 0 && cur.trim() === '' ) { quote = c; continue; }
            if (c === '\\' && i + 1 < rest.length) { cur += rest[++i]; continue; }
            if (c === '{') depth++;
            if (c === '}') depth--;
            if (c === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
            cur += c;
        }
        if (cur.trim().length || args.length) args.push(cur);
        var me = { name: name, positional: [], named: {} };
        args.forEach(function (a) {
            var eq = -1, dd = 0;
            for (var k = 0; k < a.length; k++) {
                if (a[k] === '{') dd++;
                else if (a[k] === '}') dd--;
                else if (a[k] === '=' && dd === 0) { eq = k; break; }
            }
            if (eq > 0) me.named[a.substring(0, eq).trim()] = a.substring(eq + 1).trim();
            else if (a.trim().length) me.positional.push(a.trim());
        });
        return me;
    }

    // =====================================================================================
    // Model: UI elements with styles, resources and property elements
    // =====================================================================================

    var INLINE_KINDS = { Run: 1, LineBreak: 1, Span: 1, Bold: 1, Italic: 1, Underline: 1, Hyperlink: 1, InlineUIContainer: 1 };

    function buildModel(xmlRoot) {
        var model = { root: null, all: [], byName: {}, styleCache: new Map() };

        function createUi(node, parent) {
            var el = {
                id: model.all.length,
                node: node,
                kind: node.localName,
                parent: parent,
                children: [],
                propEls: {},
                attrs: {},
                inlines: null,
                text: null,
                headerEl: null,
                contentEl: null,
                name: null,
                cache: {},
            };
            model.all.push(el);
            node.attrs.forEach(function (a) {
                var n = a.name;
                if (n === 'x:Name' || n === 'Name') { el.name = a.value; model.byName[a.value] = el; }
                if (n.indexOf('xmlns') === 0 || /^(d|mc|x):/.test(n)) return;
                el.attrs[n] = a;
            });
            var inl = [];
            var hasInline = false;
            node.items.forEach(function (item) {
                if (item.text !== undefined) {
                    inl.push({ text: item.text, isText: true });
                    return;
                }
                var ln = item.localName;
                var dot = ln.indexOf('.');
                if (dot > 0) {
                    var prop = ln.substring(dot + 1);
                    el.propEls[prop] = item;
                    if (prop === 'Header' || prop === 'Content') {
                        var first = item.children[0];
                        if (first && first.localName.indexOf('.') < 0) {
                            var sub = createUi(first, el);
                            if (prop === 'Header') el.headerEl = sub; else el.contentEl = sub;
                        } else if (!first) {
                            var tx = item.items.map(function (x) { return x.text || ''; }).join('').trim();
                            if (tx) {
                                if (prop === 'Header') el.headerText = tx; else el.text = tx;
                            }
                        }
                    }
                    return;
                }
                if (INLINE_KINDS[ln] && (el.kind === 'TextBlock' || el.kind === 'Span' || el.kind === 'Bold' || el.kind === 'Italic' || el.kind === 'Paragraph')) {
                    hasInline = true;
                    inl.push({ node: item, isText: false });
                    return;
                }
                el.children.push(createUi(item, el));
            });
            if (el.kind === 'TextBlock' || hasInline) {
                el.inlines = normalizeInlines(inl);
            } else {
                var t = inl.map(function (x) { return x.text; }).join('');
                if (t.trim().length) el.text = t.replace(/[ \t\r\n]+/g, ' ').trim();
            }
            return el;
        }

        model.root = createUi(xmlRoot, null);
        return model;
    }

    // XAML whitespace rules for a TextBlock's inlines: whitespace runs become one space; leading and
    // trailing whitespace of the content is dropped.
    function normalizeInlines(items) {
        var isBlank = function (i) { return i.isText && !i.text.trim().length; };
        var first = -1, last = -1;
        for (var i = 0; i < items.length; i++) if (!isBlank(items[i])) { if (first < 0) first = i; last = i; }
        var out = [];
        for (var k = first; k >= 0 && k <= last; k++) {
            var it = items[k];
            if (!it.isText) { out.push(it); continue; }
            var t = it.text.replace(/[ \t\r\n]+/g, ' ');
            if (k === first) t = t.replace(/^ /, '');
            if (k === last) t = t.replace(/ $/, '');
            if (t.length) out.push({ text: t, isText: true });
        }
        return out;
    }

    // ---------------------------------------------------------------- resources and styles

    function typeName(s) {
        if (!s) return null;
        var t = String(s).trim();
        var me = parseMarkup(t);
        if (me && me.name === 'x:Type') t = me.positional[0] || '';
        if (t.indexOf(':') >= 0) t = t.substring(t.indexOf(':') + 1);
        return t;
    }

    function resourceKey(node) {
        var k = attrValue(node, 'x:Key');
        if (k !== null) {
            var me = parseMarkup(k);
            if (me && me.name === 'x:Type') return 'type:' + typeName(k);
            return k;
        }
        if (node.localName === 'Style' || node.localName === 'DataTemplate' || node.localName === 'ControlTemplate') {
            var tt = attrValue(node, 'TargetType') || attrValue(node, 'DataType');
            if (tt) return 'type:' + typeName(tt);
        }
        return null;
    }

    /** Finds a resource by key walking up from el (element Resources, then ancestors). */
    function findResource(model, el, key) {
        for (var e = el; e; e = e.parent) {
            var res = e.propEls.Resources;
            if (!res) continue;
            var found = findInDictionary(res, key);
            if (found) return found;
        }
        return null;
    }
    function findInDictionary(resNode, key) {
        var list = resNode.children;
        // A single ResourceDictionary child holds the entries.
        if (list.length === 1 && list[0].localName === 'ResourceDictionary') list = list[0].children;
        for (var i = list.length - 1; i >= 0; i--) {
            if (resourceKey(list[i]) === key) return list[i];
        }
        return null;
    }

    function staticResourceKey(v) {
        var me = parseMarkup(v);
        if (!me || (me.name !== 'StaticResource' && me.name !== 'DynamicResource')) return null;
        var k = me.positional[0] || me.named.ResourceKey;
        if (!k) return null;
        var inner = parseMarkup(k);
        if (inner && inner.name === 'x:Type') return 'type:' + typeName(k);
        if (inner && inner.name === 'x:Static') return 'static:' + (inner.positional[0] || '');
        return k;
    }

    /** Style object for a <Style> node: { targetType, setters: [{prop, value}], triggers: [...], basedOn } */
    function readStyle(model, styleNode, contextEl) {
        if (model.styleCache.has(styleNode)) return model.styleCache.get(styleNode);
        var st = { node: styleNode, targetType: typeName(attrValue(styleNode, 'TargetType')), setters: [], triggers: [], basedOn: null };
        model.styleCache.set(styleNode, st);
        var based = attrValue(styleNode, 'BasedOn');
        if (based) {
            var bk = staticResourceKey(based);
            var bn = bk && findResource(model, contextEl, bk);
            if (bn && bn.localName === 'Style') st.basedOn = readStyle(model, bn, contextEl);
        }
        styleNode.children.forEach(function (c) {
            if (c.localName === 'Setter') st.setters.push(readSetter(c));
            else if (c.localName === 'Style.Setters') c.children.forEach(function (s) { if (s.localName === 'Setter') st.setters.push(readSetter(s)); });
            else if (c.localName === 'Style.Triggers') c.children.forEach(function (t) { var tr = readTrigger(t); if (tr) st.triggers.push(tr); });
        });
        return st;
    }

    function readSetter(node) {
        var prop = attrValue(node, 'Property') || '';
        var dot = prop.lastIndexOf('.');
        // "Border.Background" style names: the owner type is irrelevant here except attached properties.
        if (dot > 0 && !/^(Canvas|Grid|DockPanel|Panel|ToolTipService|TextElement|TextBlock|KeyboardNavigation|ScrollViewer)\./.test(prop)) prop = prop.substring(dot + 1);
        var valueAttr = attrOf(node, 'Value');
        var value = valueAttr ? valueAttr.value : null;
        if (value === null) {
            var sv = node.children.filter(function (c) { return c.localName === 'Setter.Value'; })[0];
            if (sv && sv.children[0]) value = { node: sv.children[0] };
            else if (sv) value = sv.items.map(function (x) { return x.text || ''; }).join('').trim();
        }
        return { prop: prop, value: value, targetName: attrValue(node, 'TargetName'), node: node };
    }

    function readTrigger(t) {
        var tr = { kind: t.localName, conditions: [], setters: [], node: t };
        var ln = t.localName;
        if (ln === 'Trigger') tr.conditions.push({ property: attrValue(t, 'Property'), value: attrValue(t, 'Value') });
        else if (ln === 'DataTrigger') tr.conditions.push({ binding: attrValue(t, 'Binding'), value: attrValue(t, 'Value') });
        else if (ln !== 'MultiTrigger' && ln !== 'MultiDataTrigger') return null;
        t.children.forEach(function (c) {
            if (c.localName === 'Setter') tr.setters.push(readSetter(c));
            else if (c.localName.endsWith('.Conditions')) {
                c.children.forEach(function (cond) {
                    tr.conditions.push({ property: attrValue(cond, 'Property'), binding: attrValue(cond, 'Binding'), value: attrValue(cond, 'Value') });
                });
            } else if (c.localName.endsWith('.Setters')) {
                c.children.forEach(function (s) { if (s.localName === 'Setter') tr.setters.push(readSetter(s)); });
            }
        });
        return tr;
    }

    /** The style that applies to el: explicit (Style property element or attribute) or implicit by type. */
    function styleOf(model, el) {
        if (el.cache.style !== undefined) return el.cache.style;
        var st = null;
        var pe = el.propEls.Style;
        if (pe && pe.children[0] && pe.children[0].localName === 'Style') {
            st = readStyle(model, pe.children[0], el);
        } else if (el.attrs.Style) {
            var k = staticResourceKey(el.attrs.Style.value);
            var n = k && findResource(model, el, k);
            if (n && n.localName === 'Style') st = readStyle(model, n, el);
        } else {
            // Implicit style: the nearest resource keyed by type (not from the element's own resources for
            // its own type, which WPF also looks up — include it).
            var n2 = findResource(model, el, 'type:' + el.kind);
            if (n2 && n2.localName === 'Style') st = readStyle(model, n2, el);
        }
        el.cache.style = st;
        return st;
    }

    // ---------------------------------------------------------------- value resolution

    var DESIGN_STATE = { IsMouseOver: 'False', IsPressed: 'False', IsFocused: 'False', IsKeyboardFocused: 'False', IsKeyboardFocusWithin: 'False', IsEnabled: 'True', IsSelected: 'False', IsHighlighted: 'False', IsChecked: 'False', IsExpanded: 'False', IsVisible: 'True' };

    /**
     * The effective value of a property: { value, source } where value is a string, a { node } for
     * complex values, or undefined (unset). Sources: 'local', 'trigger', 'style', 'default'.
     * opts.mouseOver evaluates IsMouseOver triggers as True.
     */
    function getValue(model, el, prop, opts) {
        var key = prop + (opts && opts.mouseOver ? '|hover' : '');
        if (el.cache.hasOwnProperty('v:' + key)) return el.cache['v:' + key];
        var guard = model._guard || (model._guard = new Set());
        var gk = el.id + ':' + key;
        if (guard.has(gk)) return { value: undefined, source: 'default' };
        guard.add(gk);
        try {
            var r = computeValue(model, el, prop, opts);
            el.cache['v:' + key] = r;
            return r;
        } finally {
            guard.delete(gk);
        }
    }

    function computeValue(model, el, prop, opts) {
        // Local attribute
        var a = el.attrs[prop];
        if (a) {
            var rv = resolveMarkup(model, el, a.value);
            return { value: rv.ok ? rv.value : undefined, source: 'local', attr: a };
        }
        // Property element (e.g. <Border.Background><SolidColorBrush .../></Border.Background>)
        var pe = el.propEls[prop];
        if (pe) {
            if (pe.children[0]) return { value: { node: pe.children[0] }, source: 'local' };
            var t = pe.items.map(function (x) { return x.text || ''; }).join('').trim();
            if (t) return { value: t, source: 'local' };
        }
        var st = styleOf(model, el);
        if (st) {
            // Style triggers: the last matching trigger wins.
            for (var s = st; s; s = s.basedOn) {
                for (var i = s.triggers.length - 1; i >= 0; i--) {
                    var tr = s.triggers[i];
                    var setter = null;
                    for (var j = tr.setters.length - 1; j >= 0; j--) if (tr.setters[j].prop === prop && !tr.setters[j].targetName) { setter = tr.setters[j]; break; }
                    if (!setter) continue;
                    if (triggerMatches(model, el, tr, opts)) {
                        var tv = setterValue(model, el, setter);
                        if (tv.ok) return { value: tv.value, source: 'trigger', setter: setter };
                    }
                }
            }
            for (var s2 = st; s2; s2 = s2.basedOn) {
                for (var k = s2.setters.length - 1; k >= 0; k--) {
                    if (s2.setters[k].prop === prop) {
                        var sv = setterValue(model, el, s2.setters[k]);
                        return { value: sv.ok ? sv.value : undefined, source: 'style', setter: s2.setters[k] };
                    }
                }
            }
        }
        return { value: undefined, source: 'default' };
    }

    function setterValue(model, el, setter) {
        if (setter.value && typeof setter.value === 'object') return { ok: true, value: setter.value };
        return resolveMarkup(model, el, setter.value);
    }

    /** Resolves a string that may be a markup extension. Returns { ok, value }. */
    function resolveMarkup(model, el, v) {
        if (v === null || v === undefined) return { ok: false };
        var me = parseMarkup(v);
        if (!me) {
            if (typeof v === 'string' && v.startsWith('{}')) return { ok: true, value: v.substring(2) };
            return { ok: true, value: v };
        }
        switch (me.name) {
            case 'x:Null': return { ok: true, value: null };
            case 'Binding':
            case 'TemplateBinding':
            case 'MultiBinding':
                return resolveBinding(model, el, me);
            case 'StaticResource':
            case 'DynamicResource': {
                var key = staticResourceKey(v);
                if (key && key.indexOf('static:SystemColors.') === 0) {
                    var sc = SYSTEM_COLORS[key.substring('static:SystemColors.'.length)];
                    if (sc) return { ok: true, value: sc };
                }
                var n = key && findResource(model, el, key);
                if (!n) return { ok: false };
                if (n.localName === 'Color' || n.localName === 'System:String' || n.localName === 'String' || n.localName === 'Double' || n.localName === 'Thickness') {
                    return { ok: true, value: n.items.map(function (x) { return x.text || ''; }).join('').trim() };
                }
                return { ok: true, value: { node: n } };
            }
            case 'x:Static': {
                var m = me.positional[0] || me.named.Member || '';
                if (m.indexOf('SystemColors.') === 0) {
                    var c = SYSTEM_COLORS[m.substring('SystemColors.'.length)];
                    if (c) return { ok: true, value: c };
                }
                return { ok: false };
            }
            default:
                return { ok: false };
        }
    }

    /**
     * Design-time binding: a binding to another named element of the document is evaluated (Path such as
     * Opacity, Fill.Color, Visibility, Text); every other path cannot be resolved without the running app,
     * so the FallbackValue applies — as in the Visual Studio designer.
     */
    function resolveBinding(model, el, me) {
        var path = me.named.Path || me.positional[0] || '';
        var elementName = me.named.ElementName;
        var hasConverter = !!me.named.Converter;
        if (elementName && !hasConverter && model.byName[elementName] && model.byName[elementName] !== model.root) {
            var target = model.byName[elementName];
            var segs = path.split('.');
            var r = getValue(model, target, segs[0]);
            var val = r.value;
            if (val === undefined) val = defaultValue(target, segs[0]);
            if (segs.length === 2 && segs[1] === 'Color') {
                var c = brushColor(model, target, val);
                if (c) return { ok: true, value: colorHex(c) };
            } else if (segs.length === 1 && val !== undefined && typeof val !== 'object') {
                return { ok: true, value: val };
            }
        }
        if (me.named.hasOwnProperty('FallbackValue')) {
            var fb = me.named.FallbackValue;
            if (fb.length >= 2 && fb[0] === "'" && fb[fb.length - 1] === "'") fb = fb.substring(1, fb.length - 1);
            if (fb.indexOf('{}') === 0) return { ok: true, value: fb.substring(2) };
            var inner = parseMarkup(fb);
            if (inner) return resolveMarkup(model, el, fb);
            return { ok: true, value: fb };
        }
        return { ok: false };
    }

    function defaultValue(el, prop) {
        switch (prop) {
            case 'Opacity': return '1';
            case 'Visibility': return 'Visible';
            case 'IsEnabled': return 'True';
            default: return undefined;
        }
    }

    function triggerMatches(model, el, tr, opts) {
        if (!tr.conditions.length) return false;
        for (var i = 0; i < tr.conditions.length; i++) {
            var c = tr.conditions[i];
            var actual;
            if (c.property) {
                var p = c.property;
                if (p === 'IsMouseOver' && opts && opts.mouseOver) actual = 'True';
                else if (DESIGN_STATE.hasOwnProperty(p)) actual = DESIGN_STATE[p];
                else {
                    var pv = getValue(model, el, p);
                    actual = pv.value === undefined ? defaultValue(el, p) : pv.value;
                }
            } else if (c.binding) {
                var bm = parseMarkup(c.binding);
                if (!bm) return false;
                var br = resolveBinding(model, el, bm);
                if (!br.ok) return false;
                actual = br.value;
            } else return false;
            if (!valuesEqual(actual, c.value)) return false;
        }
        return true;
    }

    function valuesEqual(actual, expected) {
        if (actual === undefined) return false;
        if (actual === null) return expected === '{x:Null}' || expected === null;
        if (typeof actual === 'object') return false;
        var a = String(actual).trim(), e = String(expected === null ? '' : expected).trim();
        if (a === e) return true;
        if (/^(true|false)$/i.test(a) && /^(true|false)$/i.test(e)) return a.toLowerCase() === e.toLowerCase();
        var na = num(a), ne = num(e);
        if (na !== null && ne !== null) return na === ne;
        var ca = parseColor(a), cexp = parseColor(e);
        if (ca && cexp) return ca.a === cexp.a && ca.r === cexp.r && ca.g === cexp.g && ca.b === cexp.b;
        return false;
    }

    /** Colour of a brush value: a colour string, a SolidColorBrush node or a resource. */
    function brushColor(model, el, v) {
        if (v === undefined || v === null) return null;
        if (typeof v === 'string') {
            var me = parseMarkup(v);
            if (me) {
                var r = resolveMarkup(model, el, v);
                return r.ok ? brushColor(model, el, r.value) : null;
            }
            return parseColor(v);
        }
        if (v.node) {
            var n = v.node;
            if (n.localName === 'SolidColorBrush') {
                var c = attrValue(n, 'Color');
                if (c === null) {
                    var cn = n.children.filter(function (x) { return x.localName === 'SolidColorBrush.Color'; })[0];
                    if (cn && cn.children[0]) c = cn.children[0].items.map(function (x) { return x.text || ''; }).join('').trim();
                }
                var rc = resolveMarkup(model, el, c);
                var col = rc.ok ? parseColor(rc.value) : null;
                var op = num(attrValue(n, 'Opacity'));
                if (col && op !== null) col = { a: Math.round(col.a * op), r: col.r, g: col.g, b: col.b };
                return col;
            }
            if (n.localName === 'Color') return parseColor(n.items.map(function (x) { return x.text || ''; }).join(''));
            if (/GradientBrush$/.test(n.localName)) {
                var stops = gradientStops(model, el, n);
                return stops.length ? stops[0].color : null;
            }
        }
        return null;
    }

    function gradientStops(model, el, n) {
        var stops = [];
        var holder = n.children.filter(function (x) { return /\.GradientStops$/.test(x.localName); })[0];
        var list = holder ? holder.children : n.children;
        if (list.length === 1 && list[0].localName === 'GradientStopCollection') list = list[0].children;
        list.forEach(function (s) {
            if (s.localName !== 'GradientStop') return;
            var rc = resolveMarkup(model, el, attrValue(s, 'Color'));
            var c = rc.ok ? parseColor(rc.value) : null;
            if (c) stops.push({ color: c, offset: num(attrValue(s, 'Offset')) || 0 });
        });
        return stops;
    }

    /** CSS for a brush: { color } for solid, { image } for gradients, or null. */
    function brushCss(model, el, v) {
        if (v && v.node && /GradientBrush$/.test(v.node.localName)) {
            var n = v.node;
            var stops = gradientStops(model, el, n).map(function (s) { return colorCss(s.color) + ' ' + fmt(s.offset * 100) + '%'; });
            if (!stops.length) return null;
            if (n.localName === 'LinearGradientBrush') {
                var sp = (attrValue(n, 'StartPoint') || '0,0').split(',').map(Number);
                var ep = (attrValue(n, 'EndPoint') || '1,1').split(',').map(Number);
                var ang = Math.atan2(ep[0] - sp[0], -(ep[1] - sp[1])) * 180 / Math.PI;
                return { image: 'linear-gradient(' + fmt(ang) + 'deg,' + stops.join(',') + ')' };
            }
            return { image: 'radial-gradient(' + stops.join(',') + ')' };
        }
        var c = brushColor(model, el, v);
        return c ? { color: colorCss(c), raw: c } : null;
    }

    // =====================================================================================
    // Renderer
    // =====================================================================================

    function Css() { this.parts = []; }
    Css.prototype.add = function (k, v) { this.parts.push(k + ':' + v); return this; };
    Css.prototype.px = function (k, v) { this.parts.push(k + ':' + fmt(v) + 'px'); return this; };
    Css.prototype.has = function (k) { for (var i = 0; i < this.parts.length; i++) if (this.parts[i].indexOf(k + ':') === 0) return true; return false; };
    Css.prototype.toString = function () { return this.parts.join(';'); };

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var FONT_STACK_DEFAULT = "'Segoe UI', 'Selawik', 'Segoe UI Symbol', 'Noto Sans Symbols2', 'Noto Sans', 'DejaVu Sans', sans-serif";
    var SYMBOL_FALLBACK = "'Segoe UI Symbol', 'Noto Sans Symbols2', sans-serif";

    function fontFamilyCss(name) {
        switch (name.trim()) {
            case 'Calibri Light': return "'Calibri Light', 'Calibri', 'Carlito', " + SYMBOL_FALLBACK;
            case 'Calibri': return "'Calibri', 'Carlito', " + SYMBOL_FALLBACK;
            case 'Consolas': return "'Consolas', 'DejaVu Sans Mono', 'Segoe UI Symbol', 'Noto Sans Symbols2', monospace";
            case 'Segoe UI': return FONT_STACK_DEFAULT;
            default:
                return name.split(',').map(function (f) { return "'" + f.trim().replace(/'/g, '') + "'"; }).join(', ') + ", 'Segoe UI', 'Selawik', " + SYMBOL_FALLBACK;
        }
    }
    function lineSpacing(name) {
        switch ((name || '').trim()) {
            case 'Calibri Light': case 'Calibri': return 1.220703125;
            case 'Consolas': return 1.1708984375;
            case 'IntoDotMatrix': return 1.0;
            case 'Arial': return 1.149;
            case 'Times New Roman': return 1.149;
            case 'Courier New': return 1.133;
            case 'Verdana': return 1.215;
            case 'Tahoma': return 1.207;
            default: return 1.330078125;
        }
    }
    var WEIGHTS = { thin: 100, extralight: 200, ultralight: 200, light: 300, normal: 400, regular: 400, medium: 500, demibold: 600, semibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900, extrablack: 950, ultrablack: 950 };
    var SEGOE_WEIGHTS = [300, 350, 400, 600, 700, 900];

    /**
     * Renders a model to HTML. ctx: { images: { source: { uri, w, h } }, selectedTabs: { tabControlId: tabItemId },
     * designChrome: bool }. Returns { html }.
     */
    function Renderer(model, ctx) {
        this.m = model;
        this.ctx = ctx || {};
        this.images = this.ctx.images || {};
        this.selectedTabs = this.ctx.selectedTabs || {};
        this.out = [];
        this.visibleTabItems = [];
    }

    Renderer.prototype.val = function (e, p, opts) {
        var r = getValue(this.m, e, p, opts);
        return r.value;
    };
    Renderer.prototype.str = function (e, p) {
        var v = this.val(e, p);
        return typeof v === 'string' ? v : (v === undefined || v === null ? null : null);
    };
    Renderer.prototype.num = function (e, p) { return num(this.str(e, p)); };
    Renderer.prototype.thick = function (e, p) { var s = this.str(e, p); return s === null ? null : parseThickness(s); };
    Renderer.prototype.color = function (e, p, opts) {
        var v = this.val(e, p, opts);
        return brushColor(this.m, e, v);
    };
    Renderer.prototype.brush = function (e, p, opts) { return brushCss(this.m, e, this.val(e, p, opts)); };

    Renderer.prototype.render = function (e, layout) {
        var o = this.out;
        switch (e.kind) {
            case 'Window': return this.renderWindow(e);
            case 'Page': case 'UserControl': case 'ContentControl': case 'ScrollViewer': case 'Frame': case 'GroupBox':
                return this.renderContentHost(e, layout);
            case 'Canvas': return this.renderPanel(e, layout, 'canvas');
            case 'Grid': return this.renderGrid(e, layout);
            case 'StackPanel': case 'VirtualizingStackPanel': return this.renderStack(e, layout);
            case 'WrapPanel': return this.renderWrap(e, layout);
            case 'DockPanel': return this.renderDock(e, layout);
            case 'UniformGrid': return this.renderUniformGrid(e, layout);
            case 'Viewbox': return this.renderViewbox(e, layout);
            case 'Border': return this.renderBorder(e, layout);
            case 'Image': return this.renderImage(e, layout);
            case 'Rectangle': case 'Ellipse': return this.renderShape(e, layout);
            case 'Line': case 'Polyline': case 'Polygon': case 'Path': return this.renderGeometry(e, layout);
            case 'Label': return this.renderLabel(e, layout);
            case 'TextBlock': case 'AccessText': return this.renderTextBlock(e, layout);
            case 'Button': case 'ToggleButton': case 'RepeatButton': return this.renderButton(e, layout);
            case 'TextBox': case 'PasswordBox': case 'RichTextBox': return this.renderTextBox(e, layout);
            case 'ProgressBar': return this.renderProgressBar(e, layout);
            case 'CheckBox': case 'RadioButton': return this.renderCheck(e, layout);
            case 'ComboBox': return this.renderCombo(e, layout);
            case 'ListBox': case 'ListView': case 'TreeView': case 'ItemsControl': return this.renderList(e, layout);
            case 'Slider': return this.renderSlider(e, layout);
            case 'Menu': return this.renderMenu(e, layout);
            case 'MenuItem': return this.renderMenuItem(e, layout, null);
            case 'StatusBar': return this.renderStatusBar(e, layout);
            case 'StatusBarItem': return this.renderContentHost(e, layout);
            case 'TabControl': return this.renderTabControl(e, layout);
            case 'DataGrid': return this.renderDataGrid(e, layout);
            case 'Separator': return this.renderSeparator(e, layout);
            case 'Expander': return this.renderContentHost(e, layout);
            default: return this.renderUnknown(e, layout);
        }
    };

    // ------------------------------------------------------------------ attributes shared by all

    Renderer.prototype.open = function (tag, e, cls, css, extra) {
        this.out.push('<' + tag + ' class="' + cls + '" data-i="' + e.id + '" style="' + esc(css.toString()) + '"' + (extra || '') + '>');
    };

    /** Position and size in the parent, following the parent panel's rules (XamlRenderer.Place). */
    Renderer.prototype.place = function (css, e, layout, canvasAutoSize, wOverride, hOverride) {
        var width = wOverride !== undefined && wOverride !== null ? wOverride : this.num(e, 'Width');
        var height = hOverride !== undefined && hOverride !== null ? hOverride : this.num(e, 'Height');
        var margin = this.thick(e, 'Margin') || { l: 0, t: 0, r: 0, b: 0 };
        var lk = layout.kind;
        if (lk === 'canvas') {
            css.add('position', 'absolute');
            var left = this.num(e, 'Canvas.Left'), right = this.num(e, 'Canvas.Right');
            var top = this.num(e, 'Canvas.Top'), bottom = this.num(e, 'Canvas.Bottom');
            if (left === null && right !== null) css.px('right', right + margin.r);
            else css.px('left', (left || 0) + margin.l);
            if (top === null && bottom !== null) css.px('bottom', bottom + margin.b);
            else css.px('top', (top || 0) + margin.t);
            this.sizeOrAuto(css, e, width, height, canvasAutoSize);
            var z = this.num(e, 'Panel.ZIndex');
            if (z !== null) css.add('z-index', String(z));
            return;
        }
        var ha = this.str(e, 'HorizontalAlignment') || 'Stretch';
        var va = this.str(e, 'VerticalAlignment') || 'Stretch';
        if (lk === 'stackV' || lk === 'stackH' || lk === 'wrapH' || lk === 'wrapV' || lk === 'flex') {
            css.add('position', 'relative').add('flex', 'none');
            var cross = (lk === 'stackV' || lk === 'wrapV') ? ha : va;
            css.add('align-self', {
                Left: 'flex-start', Top: 'flex-start', Right: 'flex-end', Bottom: 'flex-end', Center: 'center',
            }[cross] || ((lk === 'stackV' || lk === 'wrapV' ? width : height) !== null ? 'safe center' : 'stretch'));
            if (!thicknessZero(margin)) css.add('margin', thicknessCss(margin));
            this.sizeOrAuto(css, e, width, height, false);
            return;
        }
        css.add('position', 'relative').add('grid-area', layout.area ? layout.area(e) : '1/1');
        css.add('justify-self', { Left: 'start', Right: 'end', Center: 'center' }[ha] || (width !== null ? 'safe center' : 'stretch'));
        css.add('align-self', { Top: 'start', Bottom: 'end', Center: 'center' }[va] || (height !== null ? 'safe center' : 'stretch'));
        if (!thicknessZero(margin)) css.add('margin', thicknessCss(margin));
        this.sizeOrAuto(css, e, width, height, false);
        this.layoutClip(css, e, width, height, margin, ha, va);
    };

    Renderer.prototype.sizeOrAuto = function (css, e, w, h, auto) {
        if (w !== null) css.px('width', w); else if (auto) css.add('width', 'max-content');
        if (h !== null) css.px('height', h); else if (auto) css.add('height', 'max-content');
        var v;
        if ((v = this.num(e, 'MinWidth')) !== null) css.px('min-width', v);
        if ((v = this.num(e, 'MinHeight')) !== null) css.px('min-height', v);
        if ((v = this.num(e, 'MaxWidth')) !== null && isFinite(v)) css.px('max-width', v);
        if ((v = this.num(e, 'MaxHeight')) !== null && isFinite(v)) css.px('max-height', v);
    };

    // WPF clips an element larger than its layout slot to the slot minus margins (GetLayoutClip), where
    // the slot is fixed in XAML: a Border or a single-cell Grid with Width and Height.
    Renderer.prototype.layoutClip = function (css, e, width, height, margin, ha, va) {
        var slot = this.staticSlot(e);
        if (!slot) return;
        var cw = Math.max(0, slot.w - margin.l - margin.r), ch = Math.max(0, slot.h - margin.t - margin.b);
        var clipX = width !== null && width > cw, clipY = height !== null && height > ch;
        if (!clipX && !clipY) return;
        var off = function (al, client, ink) {
            if (al === 'Left' || al === 'Top') return 0;
            if (al === 'Right' || al === 'Bottom') return client - ink;
            if (al === 'Stretch' && ink > client) return 0;
            return (client - ink) * 0.5;
        };
        var OPEN = -100000;
        var ins = function (clip, al, client, ink) {
            if (!clip) return [OPEN, OPEN];
            var near = -off(al, client, ink);
            return [near, ink - near - client];
        };
        var x = ins(clipX, ha, cw, width || 0), y = ins(clipY, va, ch, height || 0);
        css.add('clip-path', 'inset(' + fmt(y[0]) + 'px ' + fmt(x[1]) + 'px ' + fmt(y[1]) + 'px ' + fmt(x[0]) + 'px)');
    };

    Renderer.prototype.staticSlot = function (e) {
        var p = e.parent;
        if (!p) return null;
        var w = this.num(p, 'Width'), h = this.num(p, 'Height');
        if (w === null || h === null) return null;
        if (p.kind === 'Border') {
            var b = this.thick(p, 'BorderThickness') || { l: 0, t: 0, r: 0, b: 0 };
            var pd = this.thick(p, 'Padding') || { l: 0, t: 0, r: 0, b: 0 };
            return { w: Math.max(0, w - b.l - b.r - pd.l - pd.r), h: Math.max(0, h - b.t - b.b - pd.t - pd.b) };
        }
        if (p.kind === 'Grid' && !gridDefs(p, 'Row').length && !gridDefs(p, 'Column').length) return { w: w, h: h };
        if (p.kind === 'Grid' && gridDefs(p, 'Row').length <= 1 && gridDefs(p, 'Column').length <= 1) return { w: w, h: h };
        return null;
    };

    /** Opacity, visibility, transform, effect, cursor. */
    Renderer.prototype.visual = function (css, e) {
        var op = num(this.str(e, 'Opacity'));
        if (op !== null && op < 1) css.add('opacity', fmt(Math.max(0, op)));
        var vis = this.str(e, 'Visibility');
        if (vis === 'Hidden') css.add('visibility', 'hidden');
        else if (vis === 'Collapsed') css.add('display', 'none');
        this.transform(css, e);
        var eff = this.val(e, 'Effect');
        if (eff && eff.node && eff.node.localName === 'BlurEffect') css.add('filter', 'blur(' + fmt((num(attrValue(eff.node, 'Radius')) || 5) / 2) + 'px)');
        else if (eff && eff.node && eff.node.localName === 'DropShadowEffect') {
            var sc = parseColor(attrValue(eff.node, 'Color') || 'Black') || { a: 255, r: 0, g: 0, b: 0 };
            var depth = num(attrValue(eff.node, 'ShadowDepth')); if (depth === null) depth = 5;
            var dir = (num(attrValue(eff.node, 'Direction')) || 315) * Math.PI / 180;
            var sop = num(attrValue(eff.node, 'Opacity')); if (sop === null) sop = 1;
            sc = { a: Math.round(sc.a * sop), r: sc.r, g: sc.g, b: sc.b };
            css.add('filter', 'drop-shadow(' + fmt(Math.cos(dir) * depth) + 'px ' + fmt(-Math.sin(dir) * depth) + 'px ' + fmt((num(attrValue(eff.node, 'BlurRadius')) || 5) / 2) + 'px ' + colorCss(sc) + ')');
        }
        var cur = this.str(e, 'Cursor');
        if (cur === 'Hand') css.add('cursor', 'pointer');
        var clip = this.str(e, 'ClipToBounds');
        if (clip === 'True') css.add('overflow', 'hidden');
    };

    Renderer.prototype.transform = function (css, e) {
        var v = this.val(e, 'RenderTransform');
        if (!v) return;
        var list = null;
        if (v.node) list = transformList(v.node);
        else if (typeof v === 'string') {
            var p = v.split(/[\s,]+/).map(Number);
            if (p.length === 6 && p.every(function (x) { return !isNaN(x); })) list = 'matrix(' + p.join(',') + ')';
        }
        if (!list) return;
        var origin = this.str(e, 'RenderTransformOrigin');
        var ox = 0, oy = 0;
        if (origin) { var q = origin.split(','); if (q.length === 2) { ox = num(q[0]) || 0; oy = num(q[1]) || 0; } }
        css.add('transform-origin', fmt(ox * 100) + '% ' + fmt(oy * 100) + '%');
        css.add('transform', list);
    };

    function transformList(n) {
        var a = function (name, d) { var x = num(attrValue(n, name)); return x === null ? d : x; };
        var around = function (cx, cy, f) {
            return cx === 0 && cy === 0 ? f : 'translate(' + fmt(cx) + 'px,' + fmt(cy) + 'px) ' + f + ' translate(' + fmt(-cx) + 'px,' + fmt(-cy) + 'px)';
        };
        switch (n.localName) {
            case 'TransformGroup': {
                var kids = n.children.filter(function (c) { return c.localName.indexOf('.') < 0; });
                if (kids.length === 1 && kids[0].localName === 'TransformCollection') kids = kids[0].children;
                // CSS applies the right-most function first; WPF applies a group's first child first.
                return kids.slice().reverse().map(transformList).filter(function (x) { return x; }).join(' ');
            }
            case 'TranslateTransform': return 'translate(' + fmt(a('X', 0)) + 'px,' + fmt(a('Y', 0)) + 'px)';
            case 'RotateTransform': return around(a('CenterX', 0), a('CenterY', 0), 'rotate(' + fmt(a('Angle', 0)) + 'deg)');
            case 'ScaleTransform': return around(a('CenterX', 0), a('CenterY', 0), 'scale(' + fmt(a('ScaleX', 1)) + ',' + fmt(a('ScaleY', 1)) + ')');
            case 'SkewTransform': return around(a('CenterX', 0), a('CenterY', 0), 'skew(' + fmt(a('AngleX', 0)) + 'deg,' + fmt(a('AngleY', 0)) + 'deg)');
            case 'MatrixTransform': {
                var m = (attrValue(n, 'Matrix') || '').split(/[\s,]+/).map(Number);
                return m.length === 6 ? 'matrix(' + m.join(',') + ')' : '';
            }
            default: return '';
        }
    }

    /** Font size, weight, family and foreground (inherited in CSS as in WPF). */
    Renderer.prototype.text = function (css, e, skipColor) {
        var size = this.num(e, 'FontSize');
        if (size !== null) css.px('font-size', size);
        var weight = this.str(e, 'FontWeight');
        if (weight) css.add('font-weight', this.fontWeightCss(e, weight));
        var family = this.str(e, 'FontFamily');
        if (family) {
            css.add('font-family', fontFamilyCss(family)).add('line-height', fmt(lineSpacing(family)));
            if (family.trim() === 'Calibri Light') css.add('font-weight', '300');
        }
        var style = this.str(e, 'FontStyle');
        if (style === 'Italic' || style === 'Oblique') css.add('font-style', 'italic');
        if (!skipColor) {
            var fg = this.brush(e, 'Foreground');
            if (fg && fg.color) css.add('color', fg.color);
        }
    };

    Renderer.prototype.fontWeightCss = function (e, weight) {
        var w = WEIGHTS[String(weight).trim().toLowerCase()] || num(weight) || 400;
        var fam = this.effectiveFontFamily(e);
        if (fam === 'Segoe UI') {
            var best = SEGOE_WEIGHTS[0];
            SEGOE_WEIGHTS.forEach(function (f) {
                var d = Math.abs(f - w), bd = Math.abs(best - w);
                if (d < bd || (d === bd && f > best)) best = f;
            });
            w = best;
        } else if (fam === 'Calibri Light') w = 300;
        return String(w);
    };
    Renderer.prototype.effectiveFontFamily = function (e) {
        for (var x = e; x; x = x.parent) { var f = this.str(x, 'FontFamily'); if (f) return f.trim(); }
        return 'Segoe UI';
    };

    Renderer.prototype.hitTest = function (css, on) { css.add('pointer-events', on ? 'auto' : 'none'); };

    Renderer.prototype.background = function (css, e, prop) {
        var b = this.brush(e, prop || 'Background');
        if (!b) return false;
        if (b.image) css.add('background-image', b.image); else css.add('background-color', b.color);
        return true;
    };

    Renderer.prototype.children = function (e, layout) {
        for (var i = 0; i < e.children.length; i++) this.render(e.children[i], layout);
    };

    // ------------------------------------------------------------------ window and hosts

    Renderer.prototype.renderWindow = function (e) {
        var o = this.out;
        var title = this.str(e, 'Title') || '';
        var w = num(attrValue(e.node, 'd:DesignWidth')) || this.num(e, 'Width') || 800;
        var h = num(attrValue(e.node, 'd:DesignHeight')) || this.num(e, 'Height') || 450;
        var style = this.str(e, 'WindowStyle');
        var chrome = style !== 'None';
        // Windows 10/11: 8 px resize borders left, right and bottom; 31 px caption with the top border.
        var cw = chrome ? Math.max(0, w - 16) : w, ch = chrome ? Math.max(0, h - 39) : h;
        o.push('<div class="x-window" data-i="' + e.id + '" style="width:' + fmt(chrome ? w - 14 : w) + 'px">');
        if (chrome) {
            o.push('<div class="x-window-caption"><span class="x-window-title">' + esc(title) + '</span><span class="x-window-buttons"><span>&#x2014;</span><span>&#x2610;</span><span>&#x2715;</span></span></div>');
        }
        var css = new Css();
        css.px('width', cw).px('height', ch).add('position', 'relative').add('overflow', 'hidden');
        if (!this.background(css, e)) css.add('background-color', '#FFFFFF');
        this.text(css, e);
        css.add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
        o.push('<div class="x-window-client" style="' + esc(css.toString()) + '">');
        var content = e.contentEl ? [e.contentEl] : e.children;
        for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
        o.push('</div></div>');
    };

    Renderer.prototype.renderContentHost = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        var bg = this.background(css, e);
        this.text(css, e);
        this.hitTest(css, bg);
        var pd = this.thick(e, 'Padding');
        if (pd && !thicknessZero(pd)) css.add('padding', thicknessCss(pd));
        var bt = this.thick(e, 'BorderThickness');
        var bb = this.brush(e, 'BorderBrush');
        if (bt && !thicknessZero(bt)) css.add('border-style', 'solid').add('border-width', thicknessCss(bt)).add('border-color', bb && bb.color ? bb.color : 'transparent');
        css.add('box-sizing', 'border-box').add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
        if (e.kind === 'ScrollViewer') css.add('overflow', 'hidden');
        this.open('div', e, 'x-host', css);
        var content = e.contentEl ? [e.contentEl] : e.children;
        if (content.length) for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
        else {
            var t = this.contentText(e);
            if (t) this.out.push('<span style="align-self:center;justify-self:start;white-space:pre">' + esc(t) + '</span>');
        }
        this.out.push('</div>');
    };

    // ------------------------------------------------------------------ panels

    Renderer.prototype.renderPanel = function (e, layout, childKind) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        var bg = this.background(css, e);
        this.hitTest(css, bg);
        this.open('div', e, childKind === 'canvas' ? 'x-canvas x-panel' : 'x-grid x-panel', css);
        this.children(e, { kind: childKind });
        this.out.push('</div>');
    };

    function gridDefs(e, which) {
        var pe = e.propEls[which + 'Definitions'];
        if (pe) return pe.children.filter(function (c) { return c.localName === which + 'Definition'; });
        var a = e.attrs[which + 'Definitions'];
        if (a) return a.value.split(',').map(function (s) { return { shorthand: s.trim() }; });
        return [];
    }

    function trackCss(def, which) {
        var size = def.shorthand !== undefined ? def.shorthand : (attrValue(def, which === 'Row' ? 'Height' : 'Width') || '*');
        size = size.trim();
        var min = def.shorthand !== undefined ? null : num(attrValue(def, which === 'Row' ? 'MinHeight' : 'MinWidth'));
        var max = def.shorthand !== undefined ? null : num(attrValue(def, which === 'Row' ? 'MaxHeight' : 'MaxWidth'));
        var t;
        if (/^auto$/i.test(size)) t = 'auto';
        else if (size.endsWith('*')) t = 'minmax(' + (min !== null ? fmt(min) + 'px' : '0') + ',' + fmt(num(size.substring(0, size.length - 1)) || 1) + 'fr)';
        else t = fmt(num(size) || 0) + 'px';
        if (max !== null && t === 'auto') t = 'minmax(auto,' + fmt(max) + 'px)';
        return t;
    }

    Renderer.prototype.renderGrid = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        var bg = this.background(css, e);
        this.hitTest(css, bg);
        var rows = gridDefs(e, 'Row'), cols = gridDefs(e, 'Column');
        var rowsCss = rows.length ? rows.map(function (r) { return trackCss(r, 'Row'); }).join(' ') : 'minmax(0,1fr)';
        var colsCss = cols.length ? cols.map(function (c) { return trackCss(c, 'Column'); }).join(' ') : 'minmax(0,1fr)';
        css.add('display', 'grid').add('grid-template-rows', rowsCss).add('grid-template-columns', colsCss);
        this.open('div', e, 'x-grid x-panel', css);
        var self = this;
        var nr = Math.max(1, rows.length), nc = Math.max(1, cols.length);
        var area = function (c) {
            var r = Math.min(nr - 1, Math.max(0, self.num(c, 'Grid.Row') || 0));
            var k = Math.min(nc - 1, Math.max(0, self.num(c, 'Grid.Column') || 0));
            var rs = Math.max(1, self.num(c, 'Grid.RowSpan') || 1), cs = Math.max(1, self.num(c, 'Grid.ColumnSpan') || 1);
            return (r + 1) + '/' + (k + 1) + '/span ' + Math.min(rs, nr - r) + '/span ' + Math.min(cs, nc - k);
        };
        this.children(e, { kind: 'cell', area: area });
        this.out.push('</div>');
    };

    Renderer.prototype.renderUniformGrid = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, this.background(css, e));
        var visible = e.children.filter(function (c) { return attrValue(c.node, 'Visibility') !== 'Collapsed'; }).length;
        var cols = this.num(e, 'Columns'), rows = this.num(e, 'Rows');
        if (!cols && !rows) { cols = Math.ceil(Math.sqrt(visible)) || 1; rows = Math.ceil(visible / cols) || 1; }
        else if (!cols) cols = Math.ceil(visible / rows) || 1;
        else if (!rows) rows = Math.ceil(visible / cols) || 1;
        css.add('display', 'grid').add('grid-template-columns', 'repeat(' + cols + ',minmax(0,1fr))').add('grid-template-rows', 'repeat(' + rows + ',minmax(0,1fr))');
        this.open('div', e, 'x-grid x-panel', css);
        var idx = 0;
        var area = function () { var i = idx++; return (Math.floor(i / cols) + 1) + '/' + (i % cols + 1); };
        this.children(e, { kind: 'cell', area: area });
        this.out.push('</div>');
    };

    Renderer.prototype.renderStack = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, this.background(css, e));
        var horizontal = this.str(e, 'Orientation') === 'Horizontal';
        css.add('display', 'flex').add('flex-direction', horizontal ? 'row' : 'column');
        this.open('div', e, 'x-stack x-panel', css);
        this.children(e, { kind: horizontal ? 'stackH' : 'stackV' });
        this.out.push('</div>');
    };

    Renderer.prototype.renderWrap = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, this.background(css, e));
        var vertical = this.str(e, 'Orientation') === 'Vertical';
        css.add('display', 'flex').add('flex-wrap', 'wrap').add('flex-direction', vertical ? 'column' : 'row').add('align-items', 'flex-start');
        this.open('div', e, 'x-wrap x-panel', css);
        this.children(e, { kind: vertical ? 'wrapV' : 'wrapH' });
        this.out.push('</div>');
    };

    // DockPanel as nested flex boxes: each docked child takes its side, the rest nests inward.
    Renderer.prototype.renderDock = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, this.background(css, e));
        this.text(css, e);
        css.add('display', 'flex').add('flex-direction', 'column');
        this.open('div', e, 'x-dock x-panel', css);
        var kids = e.children;
        var fill = this.str(e, 'LastChildFill') !== 'False';
        this.dockRest(kids, 0, fill);
        this.out.push('</div>');
    };
    Renderer.prototype.dockRest = function (kids, i, fill) {
        var o = this.out;
        if (i >= kids.length) return;
        var c = kids[i];
        if (i === kids.length - 1 && fill) {
            o.push('<div class="x-dock-fill" style="flex:1 1 auto;display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);min-width:0;min-height:0">');
            this.render(c, { kind: 'cell' });
            o.push('</div>');
            return;
        }
        var dock = this.str(c, 'DockPanel.Dock') || 'Left';
        var vertical = dock === 'Top' || dock === 'Bottom';
        var after = dock === 'Bottom' || dock === 'Right';
        o.push('<div class="x-dock-split" style="flex:1 1 auto;display:flex;flex-direction:' + (vertical ? 'column' : 'row') + ';min-width:0;min-height:0">');
        o.push('<div class="x-dock-slot" style="flex:none;display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);order:' + (after ? 2 : 0) + '">');
        this.render(c, { kind: 'cell' });
        o.push('</div>');
        o.push('<div class="x-dock-rest" style="flex:1 1 auto;display:flex;flex-direction:column;order:1;min-width:0;min-height:0">');
        this.dockRest(kids, i + 1, fill);
        o.push('</div></div>');
    };

    // Viewbox: the child is laid out at its natural size and scaled to the slot. The scale is computed
    // after layout by the designer (data-viewbox), because it depends on the measured child size.
    Renderer.prototype.renderViewbox = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        css.add('overflow', 'hidden');
        css.add('pointer-events', 'none');
        var stretch = this.str(e, 'Stretch') || 'Uniform';
        this.open('div', e, 'x-viewbox', css, ' data-viewbox="' + esc(stretch) + '" data-stretchdir="' + esc(this.str(e, 'StretchDirection') || 'Both') + '"');
        this.out.push('<div class="x-viewbox-inner" style="position:absolute;left:0;top:0;transform-origin:0 0;display:grid;width:max-content;height:max-content">');
        var content = e.children.length ? e.children : [];
        for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
        this.out.push('</div></div>');
    };

    // ------------------------------------------------------------------ Border

    Renderer.prototype.renderBorder = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        var hasBg = this.background(css, e);
        this.hitTest(css, hasBg);
        css.add('box-sizing', 'border-box').add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
        var pd = this.thick(e, 'Padding');
        if (pd && !thicknessZero(pd)) css.add('padding', thicknessCss(pd));
        var cr = this.str(e, 'CornerRadius');
        if (cr) css.add('border-radius', parseCornerRadius(cr));
        var hoverColor = this.color(e, 'BorderBrush', { mouseOver: true });
        var normalColor = this.color(e, 'BorderBrush');
        var normalT = this.thick(e, 'BorderThickness');
        var hoverT = parseThickness(this.str2(e, 'BorderThickness', { mouseOver: true }));
        var hover = !sameColor(hoverColor, normalColor) || !sameThickness(hoverT, normalT);
        if (!hover) {
            if (normalT && !thicknessZero(normalT)) css.add('border-style', 'solid').add('border-width', thicknessCss(normalT));
            css.add('border-color', normalColor ? colorCss(normalColor) : 'transparent');
        } else {
            css.add('--xb-n', normalColor ? colorCss(normalColor) : 'transparent');
            css.add('--xb-h', hoverColor ? colorCss(hoverColor) : 'transparent');
            css.add('--xw-n', thicknessCss(normalT || { l: 0, t: 0, r: 0, b: 0 }));
            css.add('--xw-h', thicknessCss(hoverT || { l: 0, t: 0, r: 0, b: 0 }));
        }
        this.text(css, e);
        this.open('div', e, hover ? 'x-border x-hover-border' : 'x-border', css);
        if (!hasBg && normalT && !thicknessZero(normalT) && normalColor) {
            var t = normalT, L = fmt(t.l), T = fmt(t.t), R = fmt(t.r), B = fmt(t.b);
            this.out.push('<div class="x-ring" data-hit="' + e.id + '" style="position:absolute;left:-' + L + 'px;top:-' + T + 'px;right:-' + R + 'px;bottom:-' + B + 'px;pointer-events:auto;clip-path:polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,' + L + 'px ' + T + 'px,' + L + 'px calc(100% - ' + B + 'px),calc(100% - ' + R + 'px) calc(100% - ' + B + 'px),calc(100% - ' + R + 'px) ' + T + 'px,' + L + 'px ' + T + 'px)"></div>');
        }
        var content = e.contentEl ? [e.contentEl] : e.children;
        for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
        this.out.push('</div>');
    };
    Renderer.prototype.str2 = function (e, p, opts) {
        var v = this.val(e, p, opts);
        return typeof v === 'string' ? v : null;
    };
    function sameColor(a, b) { if (!a || !b) return a === b; return a.a === b.a && a.r === b.r && a.g === b.g && a.b === b.b; }
    function sameThickness(a, b) { if (!a || !b) return (!a || thicknessZero(a)) && (!b || thicknessZero(b)); return a.l === b.l && a.t === b.t && a.r === b.r && a.b === b.b; }

    // ------------------------------------------------------------------ Image

    Renderer.prototype.imageInfo = function (e) {
        var src = this.str(e, 'Source');
        if (!src) {
            var v = this.val(e, 'Source');
            if (v && v.node && v.node.localName === 'BitmapImage') src = attrValue(v.node, 'UriSource');
        }
        if (!src) return null;
        return this.images[src] || { uri: null, w: 0, h: 0, missing: true, source: src };
    };

    Renderer.prototype.renderImage = function (e, layout) {
        var stretch = this.str(e, 'Stretch') || 'Uniform';
        var info = this.imageInfo(e);
        var url = info && info.uri ? info.uri : '';
        var W = this.num(e, 'Width'), H = this.num(e, 'Height');
        var natural = info && info.w > 0 && info.h > 0 ? info : null;
        var picture = null;
        if ((stretch === 'Uniform' || stretch === 'None') && W !== null && H !== null && natural) {
            var dw = natural.w, dh = natural.h;
            if (stretch === 'Uniform') { var s = Math.min(W / natural.w, H / natural.h); dw = natural.w * s; dh = natural.h * s; }
            var ha = this.str(e, 'HorizontalAlignment') || 'Stretch', va = this.str(e, 'VerticalAlignment') || 'Stretch';
            var off = function (a, slot, ink) {
                if (a === 'Stretch' && ink > slot) return 0;
                if (a === 'Left' || a === 'Top') return 0;
                if (a === 'Right' || a === 'Bottom') return slot - ink;
                return (slot - ink) * 0.5;
            };
            picture = { x: off(ha, W, dw), y: off(va, H, dh), w: dw, h: dh };
        }
        var missingCss = url ? '' : 'background:repeating-linear-gradient(45deg,rgba(128,128,128,.15) 0 6px,transparent 6px 12px);outline:1px dashed rgba(200,0,0,.5);';
        if (layout.kind !== 'canvas' && picture) {
            var box = new Css();
            this.place(box, e, layout, false);
            box.add('pointer-events', 'none');
            var inner = new Css();
            inner.add('position', 'absolute').px('left', picture.x).px('top', picture.y).px('width', picture.w).px('height', picture.h).add('object-fit', 'fill');
            this.visual(inner, e);
            this.hitTest(inner, true);
            this.out.push('<div class="x-imgbox" data-i="' + e.id + '" style="' + esc(box.toString()) + '">');
            this.out.push('<img class="x-image" data-hit="' + e.id + '" src="' + esc(url) + '" draggable="false" alt="" style="' + esc(inner.toString() + ';' + missingCss) + '"></div>');
            return;
        }
        var aw = null, ah = null;
        if (natural) {
            if (layout.kind === 'canvas' || stretch === 'Uniform' || stretch === 'None') {
                if (H !== null && W === null) aw = stretch === 'None' ? natural.w : H * natural.w / natural.h;
                else if (W !== null && H === null) ah = stretch === 'None' ? natural.h : W * natural.h / natural.w;
                else if (W === null && H === null && layout.kind === 'canvas') { aw = natural.w; ah = natural.h; }
            }
        }
        var css = new Css();
        this.place(css, e, layout, true, aw, ah);
        this.visual(css, e);
        this.hitTest(css, true);
        if (layout.kind === 'canvas' && picture) {
            // In a Canvas the Image's box is the scaled picture itself (WPF arranges it at its desired size).
            var m = this.thick(e, 'Margin') || { l: 0, t: 0, r: 0, b: 0 };
            css.px('left', (this.num(e, 'Canvas.Left') || 0) + m.l + picture.x).px('top', (this.num(e, 'Canvas.Top') || 0) + m.t + picture.y);
            css.px('width', picture.w).px('height', picture.h).add('object-fit', 'fill');
            this.out.push('<img class="x-image" data-i="' + e.id + '" src="' + esc(url) + '" draggable="false" alt="" style="' + esc(css.toString() + ';' + missingCss) + '">');
            return;
        }
        css.add('object-fit', { Fill: 'fill', UniformToFill: 'cover', None: 'none' }[stretch] || 'contain');
        var ap = function (a) { return a === 'Left' || a === 'Top' ? '0%' : a === 'Right' || a === 'Bottom' ? '100%' : '50%'; };
        css.add('object-position', ap(this.str(e, 'HorizontalAlignment')) + ' ' + ap(this.str(e, 'VerticalAlignment')));
        this.out.push('<img class="x-image" data-i="' + e.id + '" src="' + esc(url) + '" draggable="false" alt="" style="' + esc(css.toString() + ';' + missingCss) + '">');
    };

    // ------------------------------------------------------------------ shapes

    Renderer.prototype.renderShape = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        var ellipse = e.kind === 'Ellipse';
        var stroke = this.brush(e, 'Stroke');
        var fill = this.brush(e, 'Fill');
        var thickness = this.num(e, 'StrokeThickness');
        if (thickness === null) thickness = 1;
        if (!stroke || thickness <= 0) {
            if (fill) { if (fill.image) css.add('background-image', fill.image); else css.add('background-color', fill.color); }
            this.hitTest(css, !!fill);
            if (ellipse) css.add('border-radius', '50%');
            else {
                var rx = this.num(e, 'RadiusX');
                if (rx !== null && rx > 0) { var ry = this.num(e, 'RadiusY'); css.add('border-radius', fmt(rx) + 'px / ' + fmt(ry === null ? rx : ry) + 'px'); }
            }
            this.open('div', e, 'x-shape', css);
            this.out.push('</div>');
            return;
        }
        var w = this.num(e, 'Width'), h = this.num(e, 'Height');
        css.add('overflow', 'visible');
        this.hitTest(css, false);
        this.open('svg', e, 'x-shape', css, (w !== null ? ' width="' + fmt(w) + '"' : '') + (h !== null ? ' height="' + fmt(h) + '"' : ''));
        var sc = new Css().add('pointer-events', 'visiblePainted');
        sc.add('fill', fill ? (fill.color || colorCss(brushColor(this.m, e, this.val(e, 'Fill')) || { a: 0, r: 0, g: 0, b: 0 })) : 'none');
        sc.add('stroke', stroke.color || 'black').add('stroke-width', fmt(thickness));
        var dash = this.str(e, 'StrokeDashArray');
        if (dash) sc.add('stroke-dasharray', dash.split(/[\s,]+/).filter(Boolean).map(function (d) { return fmt((num(d) || 0) * thickness); }).join(' '));
        var inset = thickness / 2;
        var wExpr = w !== null ? fmt(Math.max(0, w - thickness)) : 'calc(100% - ' + fmt(thickness) + 'px)';
        var hExpr = h !== null ? fmt(Math.max(0, h - thickness)) : 'calc(100% - ' + fmt(thickness) + 'px)';
        if (ellipse) {
            if (w !== null && h !== null) this.out.push('<ellipse cx="' + fmt(w / 2) + '" cy="' + fmt(h / 2) + '" rx="' + fmt(Math.max(0, w / 2 - inset)) + '" ry="' + fmt(Math.max(0, h / 2 - inset)) + '" style="' + esc(sc.toString()) + '"/>');
            else this.out.push('<ellipse cx="50%" cy="50%" rx="calc(50% - ' + fmt(inset) + 'px)" ry="calc(50% - ' + fmt(inset) + 'px)" style="' + esc(sc.toString()) + '"/>');
        } else {
            var rxx = this.num(e, 'RadiusX'), ryy = this.num(e, 'RadiusY');
            this.out.push('<rect x="' + fmt(inset) + '" y="' + fmt(inset) + '" width="' + wExpr + '" height="' + hExpr + '"' +
                (rxx !== null ? ' rx="' + fmt(rxx) + '" ry="' + fmt(ryy === null ? rxx : ryy) + '"' : '') + ' style="' + esc(sc.toString()) + '"/>');
        }
        this.out.push('</svg>');
    };

    Renderer.prototype.renderGeometry = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        css.add('overflow', 'visible');
        this.hitTest(css, false);
        var stroke = this.brush(e, 'Stroke'), fill = this.brush(e, 'Fill');
        var th = this.num(e, 'StrokeThickness'); if (th === null) th = 1;
        var sc = new Css().add('pointer-events', 'visiblePainted').add('fill', fill && fill.color ? fill.color : 'none').add('stroke', stroke && stroke.color ? stroke.color : 'none').add('stroke-width', fmt(th));
        var stretch = this.str(e, 'Stretch');
        var shape = '';
        if (e.kind === 'Line') {
            var x1 = this.num(e, 'X1') || 0, y1 = this.num(e, 'Y1') || 0, x2 = this.num(e, 'X2') || 0, y2 = this.num(e, 'Y2') || 0;
            shape = '<line x1="' + fmt(x1) + '" y1="' + fmt(y1) + '" x2="' + fmt(x2) + '" y2="' + fmt(y2) + '" style="' + esc(sc.toString()) + '"/>';
            if (this.num(e, 'Width') === null) css.px('width', Math.max(x1, x2) + th / 2);
            if (this.num(e, 'Height') === null) css.px('height', Math.max(y1, y2) + th / 2);
        } else if (e.kind === 'Polyline' || e.kind === 'Polygon') {
            var pts = (this.str(e, 'Points') || '').trim();
            shape = '<' + e.kind.toLowerCase() + ' points="' + esc(pts) + '" style="' + esc(sc.toString()) + '"/>';
        } else {
            var data = this.str(e, 'Data') || '';
            var rule = 'evenodd';
            data = data.replace(/^\s*F([01])/, function (m, f) { rule = f === '1' ? 'nonzero' : 'evenodd'; return ''; });
            sc.add('fill-rule', rule);
            shape = '<path d="' + esc(data) + '" style="' + esc(sc.toString()) + '"/>';
        }
        var w = this.num(e, 'Width'), h = this.num(e, 'Height');
        var vb = '';
        if (stretch && stretch !== 'None' && w !== null && h !== null) vb = ' data-fitgeom="' + esc(stretch) + '"';
        this.open('svg', e, 'x-shape', css, vb);
        this.out.push(shape + '</svg>');
    };

    // ------------------------------------------------------------------ text

    Renderer.prototype.contentText = function (e) {
        var fmtStr = e.attrs.ContentStringFormat ? e.attrs.ContentStringFormat.value : null;
        var v = this.val(e, 'Content');
        var t = null;
        if (typeof v === 'string') t = v;
        else if (v === undefined && e.text) t = e.text;
        if (t !== null && fmtStr) t = formatString(fmtStr, t);
        return t;
    };

    function formatString(f, value) {
        if (f.indexOf('{}') === 0) f = f.substring(2); // XAML escape for a value that starts with {
        if (f.indexOf('{') < 0) return value;
        return f.replace(/\{\{/g, '\u0001').replace(/\}\}/g, '\u0002').replace(/\{0(?:,[^:}]*)?(?::[^}]*)?\}/g, value).replace(/\u0001/g, '{').replace(/\u0002/g, '}');
    }

    Renderer.prototype.renderLabel = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        if (layout.kind === 'cell') {
            var mg = this.thick(e, 'Margin') || { l: 0, t: 0, r: 0, b: 0 };
            var slotMinus = function (m) { return m === 0 ? '100%' : m < 0 ? 'calc(100% + ' + fmt(-m) + 'px)' : 'calc(100% - ' + fmt(m) + 'px)'; };
            if (this.num(e, 'Width') === null) css.add('max-width', slotMinus(mg.l + mg.r));
            if (this.num(e, 'Height') === null) css.add('max-height', slotMinus(mg.t + mg.b));
        }
        this.visual(css, e);
        this.background(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        var content = e.contentEl ? [e.contentEl] : e.children;
        if (!content.length) css.add('overflow', 'clip').add('overflow-clip-margin', 'content-box');
        var pd = this.thick(e, 'Padding') || { l: 5, t: 5, r: 5, b: 5 };
        css.add('padding', thicknessCss(pd));
        css.add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
        var bt = this.thick(e, 'BorderThickness');
        if (bt && !thicknessZero(bt)) {
            css.add('border-style', 'solid').add('border-width', thicknessCss(bt));
            var bb = this.color(e, 'BorderBrush');
            css.add('border-color', bb ? colorCss(bb) : 'transparent');
            if (!bb && !css.has('clip-path')) css.add('clip-path', 'inset(' + fmt(bt.t) + 'px ' + fmt(bt.r) + 'px ' + fmt(bt.b) + 'px ' + fmt(bt.l) + 'px)');
        }
        var hca = this.str(e, 'HorizontalContentAlignment') || 'Left', vca = this.str(e, 'VerticalContentAlignment') || 'Top';
        var presenter = 'grid-area:1/1;justify-self:' + selfAlign(hca) + ';align-self:' + selfAlign(vca);
        this.open('div', e, 'x-label', css);
        if (content.length) {
            this.out.push('<div class="x-presenter" style="' + presenter + '">');
            for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
            this.out.push('</div>');
        } else {
            this.out.push('<span style="' + presenter + '">' + esc(this.contentText(e) || '') + '</span>');
        }
        this.out.push('</div>');
    };
    function selfAlign(a) { return a === 'Center' ? 'safe center' : (a === 'Right' || a === 'Bottom') ? 'safe end' : a === 'Stretch' ? 'stretch' : 'start'; }
    function flexAlign(a) { return a === 'Center' ? 'center' : (a === 'Right' || a === 'Bottom') ? 'flex-end' : a === 'Stretch' ? 'stretch' : 'flex-start'; }

    Renderer.prototype.renderTextBlock = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.background(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        var wrap = this.str(e, 'TextWrapping');
        css.add('white-space', wrap === 'Wrap' || wrap === 'WrapWithOverflow' ? 'pre-wrap' : 'pre');
        if (wrap === 'Wrap') css.add('overflow-wrap', 'break-word');
        var ta = this.str(e, 'TextAlignment');
        if (ta) css.add('text-align', ta.toLowerCase());
        var pd = this.thick(e, 'Padding');
        if (pd && !thicknessZero(pd)) css.add('padding', thicknessCss(pd));
        var deco = this.str(e, 'TextDecorations');
        if (deco) css.add('text-decoration', /underline/i.test(deco) ? 'underline' : /strikethrough/i.test(deco) ? 'line-through' : 'none');
        var trim = this.str(e, 'TextTrimming');
        if (trim && trim !== 'None') css.add('overflow', 'hidden').add('text-overflow', 'ellipsis');
        this.open('div', e, 'x-text', css);
        if (e.inlines && e.inlines.length) this.renderInlines(e, e.inlines);
        else {
            var t = this.str(e, 'Text');
            if (t === null && e.text) t = e.text;
            this.out.push(esc(t || ''));
        }
        this.out.push('</div>');
    };

    Renderer.prototype.renderInlines = function (owner, inlines) {
        var o = this.out;
        for (var i = 0; i < inlines.length; i++) {
            var it = inlines[i];
            if (it.isText) { o.push(esc(it.text)); continue; }
            var n = it.node;
            var ln = n.localName;
            if (ln === 'LineBreak') { o.push('<br>'); continue; }
            var rc = new Css();
            var fs = num(attrValue(n, 'FontSize')); if (fs !== null) rc.px('font-size', fs);
            var fw = attrValue(n, 'FontWeight'); if (fw) rc.add('font-weight', this.fontWeightCss(owner, fw));
            if (ln === 'Bold') rc.add('font-weight', this.fontWeightCss(owner, 'Bold'));
            if (ln === 'Italic' || attrValue(n, 'FontStyle') === 'Italic') rc.add('font-style', 'italic');
            if (ln === 'Underline' || ln === 'Hyperlink') rc.add('text-decoration', 'underline');
            var fg = attrValue(n, 'Foreground');
            if (fg) { var r = resolveMarkup(this.m, owner, fg); var c = r.ok ? brushColor(this.m, owner, r.value) : null; if (c) rc.add('color', colorCss(c)); }
            if (ln === 'Hyperlink' && !fg) rc.add('color', '#0066CC');
            var ff = attrValue(n, 'FontFamily'); if (ff) rc.add('font-family', fontFamilyCss(ff));
            o.push('<span' + (rc.parts.length ? ' style="' + esc(rc.toString()) + '"' : '') + '>');
            if (ln === 'Run') {
                var ta = attrOf(n, 'Text');
                var txt;
                if (ta) { var rv = resolveMarkup(this.m, owner, ta.value); txt = rv.ok && typeof rv.value === 'string' ? rv.value : ''; }
                else txt = n.items.map(function (x) { return x.text || ''; }).join('');
                o.push(esc(txt));
            } else {
                var sub = [];
                n.items.forEach(function (x) { if (x.text !== undefined) sub.push({ text: x.text, isText: true }); else sub.push({ node: x, isText: false }); });
                this.renderInlines(owner, normalizeInlines(sub));
            }
            o.push('</span>');
        }
    };

    // ------------------------------------------------------------------ controls (Aero2 look)

    Renderer.prototype.implicitBorderCornerRadius = function (e) {
        var res = e.propEls.Resources;
        if (!res) return null;
        var st = findInDictionary(res, 'type:Border');
        if (!st || st.localName !== 'Style') return null;
        var s = readStyle(this.m, st, e);
        for (var i = s.setters.length - 1; i >= 0; i--) if (s.setters[i].prop === 'CornerRadius' && typeof s.setters[i].value === 'string') return s.setters[i].value;
        return null;
    };

    Renderer.prototype.renderButton = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e, true);
        this.hitTest(css, true);
        var enabled = this.str(e, 'IsEnabled') !== 'False';
        var bg = this.brush(e, 'Background');
        if (enabled && bg) css.add('--x-bg', bg.image || bg.color);
        var bd = this.color(e, 'BorderBrush');
        if (bd) css.add('--x-bd', colorCss(bd));
        var bt = this.thick(e, 'BorderThickness');
        if (bt) css.add('border-width', thicknessCss(bt));
        var fgR = getValue(this.m, e, 'Foreground');
        var fg = brushColor(this.m, e, fgR.value);
        if (fg && (enabled || fgR.source === 'local' || fgR.source === 'trigger')) css.add('color', colorCss(fg));
        var pd = this.thick(e, 'Padding');
        if (pd) css.add('padding', thicknessCss(pd));
        var cr = this.implicitBorderCornerRadius(e);
        if (cr) css.add('border-radius', parseCornerRadius(cr));
        css.add('justify-content', flexAlign(this.str(e, 'HorizontalContentAlignment') || 'Center'));
        css.add('align-items', flexAlign(this.str(e, 'VerticalContentAlignment') || 'Center'));
        this.open('div', e, 'x-button' + (enabled ? '' : ' x-disabled'), css);
        var content = e.contentEl ? [e.contentEl] : e.children;
        if (content.length) {
            this.out.push('<div class="x-presenter">');
            for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
            this.out.push('</div>');
        } else this.out.push('<span>' + esc(this.contentText(e) || '') + '</span>');
        this.out.push('</div>');
    };

    Renderer.prototype.renderTextBox = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e, true);
        this.hitTest(css, true);
        this.background(css, e);
        var fg = this.color(e, 'Foreground'); if (fg) css.add('color', colorCss(fg));
        var bd = this.color(e, 'BorderBrush'); if (bd) css.add('border-color', colorCss(bd));
        var bt = this.thick(e, 'BorderThickness'); if (bt) css.add('border-width', thicknessCss(bt));
        var tp = this.thick(e, 'Padding') || { l: 0, t: 0, r: 0, b: 0 };
        css.add('padding', thicknessCss({ l: tp.l + 2, t: tp.t, r: tp.r + 2, b: tp.b }));
        var cr = this.implicitBorderCornerRadius(e); if (cr) css.add('border-radius', parseCornerRadius(cr));
        css.add('text-align', ({ Center: 'center', Right: 'right' })[this.str(e, 'HorizontalContentAlignment')] || 'left');
        var vca = this.str(e, 'VerticalContentAlignment');
        css.add('display', 'flex').add('flex-direction', 'column').add('justify-content', vca === 'Center' ? 'center' : vca === 'Bottom' ? 'flex-end' : 'flex-start');
        var wrap = this.str(e, 'TextWrapping');
        this.open('div', e, 'x-textbox', css);
        var t = this.str(e, 'Text');
        if (t === null && e.kind === 'PasswordBox') t = '';
        if (t === null) t = e.text || '';
        if (e.kind === 'PasswordBox' && t) t = t.replace(/./g, '●');
        this.out.push('<span style="white-space:' + (wrap === 'Wrap' ? 'pre-wrap' : 'pre') + ';overflow:hidden">' + esc(t) + '\u200B</span></div>');
    };

    Renderer.prototype.renderProgressBar = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        this.hitTest(css, true);
        var bg = this.brush(e, 'Background'); if (bg) css.add('background', bg.image || bg.color);
        var bd = this.color(e, 'BorderBrush'); if (bd) css.add('border-color', colorCss(bd));
        var min = this.num(e, 'Minimum') || 0, max = this.num(e, 'Maximum'); if (max === null) max = 100;
        var value = this.num(e, 'Value') || 0;
        var fr = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
        var vertical = this.str(e, 'Orientation') === 'Vertical';
        var fg = this.brush(e, 'Foreground');
        this.open('div', e, 'x-progress', css);
        this.out.push('<div class="x-progress-indicator" style="' + (vertical ? 'top:auto;right:-1px;height:calc((100% + 2px) * ' + fmt(fr) + ')' : 'width:calc((100% + 2px) * ' + fmt(fr) + ')') + (fg ? ';background:' + (fg.image || fg.color) : '') + '"></div></div>');
    };

    Renderer.prototype.renderCheck = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        css.add('display', 'flex').add('align-items', 'center');
        var pd = this.thick(e, 'Padding'); if (pd) css.add('padding', thicknessCss(pd));
        var checked = this.str(e, 'IsChecked') === 'True';
        var radio = e.kind === 'RadioButton';
        this.open('div', e, 'x-check', css);
        this.out.push('<span class="x-check-box' + (radio ? ' x-radio' : '') + '">' + (checked ? (radio ? '<span class="x-radio-dot"></span>' : '&#x2714;') : '') + '</span>');
        var content = e.contentEl ? [e.contentEl] : e.children;
        if (content.length) { this.out.push('<div class="x-presenter" style="padding-left:4px">'); for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' }); this.out.push('</div>'); }
        else this.out.push('<span style="padding-left:4px;white-space:pre">' + esc(this.contentText(e) || '') + '</span>');
        this.out.push('</div>');
    };

    Renderer.prototype.renderCombo = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        var bg = this.brush(e, 'Background'); if (bg) css.add('background', bg.image || bg.color);
        var sel = this.num(e, 'SelectedIndex');
        var items = e.children;
        var txt = this.str(e, 'Text') || '';
        if (!txt && sel !== null && items[sel]) txt = this.contentText(items[sel]) || items[sel].text || '';
        this.open('div', e, 'x-combo', css);
        this.out.push('<span class="x-combo-text">' + esc(txt) + '</span><span class="x-combo-arrow"></span></div>');
    };

    Renderer.prototype.renderList = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        this.background(css, e);
        var bd = this.color(e, 'BorderBrush'); if (bd) css.add('border-color', colorCss(bd));
        var bt = this.thick(e, 'BorderThickness'); if (bt) css.add('border-width', thicknessCss(bt));
        this.open('div', e, 'x-list' + (e.kind === 'ItemsControl' ? ' x-itemscontrol' : ''), css);
        for (var i = 0; i < e.children.length; i++) {
            var c = e.children[i];
            if (/Item$/.test(c.kind) && !c.children.length && !c.contentEl) {
                var t = this.contentText(c) || this.str(c, 'Header') || c.text || '';
                this.out.push('<div class="x-list-item" data-i="' + c.id + '">' + esc(t) + '</div>');
            } else this.render(c, { kind: 'stackV' });
        }
        this.out.push('</div>');
    };

    Renderer.prototype.renderSlider = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, true);
        var min = this.num(e, 'Minimum') || 0, max = this.num(e, 'Maximum'); if (max === null) max = 10;
        var v = this.num(e, 'Value') || 0;
        var fr = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0;
        this.open('div', e, 'x-slider', css);
        this.out.push('<span class="x-slider-track"></span><span class="x-slider-thumb" style="left:calc(' + fmt(fr * 100) + '% - 5px)"></span></div>');
    };

    Renderer.prototype.renderSeparator = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        this.hitTest(css, true);
        var p = e.parent;
        var vertical = p && (p.kind === 'StatusBar' || p.kind === 'ToolBar' || (p.kind === 'StackPanel' && this.str(p, 'Orientation') === 'Horizontal'));
        var bg = this.color(e, 'Background');
        if (vertical) css.add('width', '1px').add('margin', '2px').add('background', bg ? colorCss(bg) : '#696969').add('align-self', 'stretch');
        else if (!css.has('height')) css.add('height', '1px').add('margin', '2px 0').add('background', bg ? colorCss(bg) : '#A0A0A0');
        this.open('div', e, 'x-separator', css);
        this.out.push('</div>');
    };

    Renderer.prototype.renderDataGrid = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        this.background(css, e);
        this.open('div', e, 'x-datagrid', css);
        var cols = [];
        var pe = e.propEls.Columns;
        if (pe) pe.children.forEach(function (c) { cols.push(attrValue(c, 'Header') || c.localName.replace('DataGrid', '').replace('Column', '')); });
        this.out.push('<div class="x-datagrid-header">');
        if (cols.length) cols.forEach(function (c) { this.out.push('<span>' + esc(c) + '</span>'); }, this);
        else this.out.push('<span class="x-datagrid-note">' + (this.str(e, 'AutoGenerateColumns') === 'False' ? 'DataGrid' : 'DataGrid — columns generated at run time') + '</span>');
        this.out.push('</div></div>');
    };

    Renderer.prototype.renderUnknown = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.hitTest(css, true);
        this.background(css, e);
        this.text(css, e);
        if (!css.has('width') || css.parts.indexOf('width:max-content') >= 0) css.add('min-width', '40px');
        if (!css.has('height') || css.parts.indexOf('height:max-content') >= 0) css.add('min-height', '20px');
        css.add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
        this.open('div', e, 'x-unknown', css, ' title="' + esc(e.node.name) + ' is drawn as a placeholder"');
        var content = e.contentEl ? [e.contentEl] : e.children;
        if (content.length) for (var i = 0; i < content.length; i++) this.render(content[i], { kind: 'cell' });
        else this.out.push('<span class="x-unknown-label">' + esc(e.node.name) + '</span>');
        this.out.push('</div>');
    };

    // ------------------------------------------------------------------ Menu, StatusBar, TabControl

    /** The ContentPresenter/Border of a control template set by an implicit style for kind. */
    Renderer.prototype.templateParts = function (e, kind, state) {
        var styleNode = findResource(this.m, e, 'type:' + kind);
        if (!styleNode || styleNode.localName !== 'Style') return null;
        var st = readStyle(this.m, styleNode, e);
        var tpl = null;
        for (var s = st; s && !tpl; s = s.basedOn) s.setters.forEach(function (x) { if (x.prop === 'Template' && x.value && x.value.node) tpl = x.value.node; });
        if (!tpl) return null;
        var rootNode = tpl.children.filter(function (c) { return c.localName.indexOf('.') < 0; })[0];
        if (!rootNode) return null;
        var parts = { border: null, presenter: null, triggers: [] };
        (function walk(n) {
            if (n.localName === 'Border' && !parts.border) parts.border = n;
            if (n.localName === 'ContentPresenter' && !parts.presenter) parts.presenter = n;
            n.children.forEach(function (c) { if (c.localName.indexOf('.') < 0) walk(c); });
        })(rootNode);
        var trig = tpl.children.filter(function (c) { return c.localName === 'ControlTemplate.Triggers'; })[0];
        // Template triggers for the given state: setters on named template parts.
        var borderName = parts.border ? (attrValue(parts.border, 'Name') || attrValue(parts.border, 'x:Name')) : null;
        parts.borderSet = {};
        if (trig) {
            trig.children.forEach(function (t) {
                var tr = readTrigger(t);
                if (!tr) return;
                var ok = tr.conditions.every(function (c) { return c.property && state.hasOwnProperty(c.property) ? valuesEqual(state[c.property], c.value) : false; });
                if (!ok) return;
                tr.setters.forEach(function (s) { if (!s.targetName || s.targetName === borderName) parts.borderSet[s.prop] = s.value; });
            });
        }
        return parts;
    };

    Renderer.prototype.renderMenu = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        if (!this.background(css, e)) css.add('background-color', '#F0F0F0');
        var pd = this.thick(e, 'Padding'); if (pd) css.add('padding', thicknessCss(pd));
        this.open('div', e, 'x-menu', css);
        for (var i = 0; i < e.children.length; i++) {
            var c = e.children[i];
            if (c.kind === 'MenuItem') this.renderMenuItem(c, { kind: 'flex' }, e);
            else {
                var tp = this.templateParts(e, 'MenuItem', { IsHighlighted: 'False' });
                var m = tp && tp.presenter ? attrValue(tp.presenter, 'Margin') : null;
                this.out.push('<div class="x-menuitem"><div class="x-menuitem-presenter" style="margin:' + thicknessCss(m ? parseThickness(m) : { l: 6, t: 2, r: 6, b: 2 }) + '">');
                this.render(c, { kind: 'cell' });
                this.out.push('</div></div>');
            }
        }
        this.out.push('</div>');
    };

    Renderer.prototype.renderMenuItem = function (e, layout, menu) {
        var css = new Css();
        var w = this.num(e, 'Width'), h = this.num(e, 'Height');
        if (w !== null) css.px('width', w);
        if (h !== null) css.px('height', h);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        this.background(css, e);
        var tp = this.templateParts(menu || e.parent || e, 'MenuItem', { IsHighlighted: 'False' });
        var m = tp && tp.presenter ? attrValue(tp.presenter, 'Margin') : null;
        this.open('div', e, 'x-menuitem', css);
        this.out.push('<div class="x-menuitem-presenter" style="margin:' + thicknessCss(m ? parseThickness(m) : { l: 6, t: 2, r: 6, b: 2 }) + '">');
        if (e.headerEl) this.render(e.headerEl, { kind: 'cell' });
        else this.out.push('<span class="x-menuitem-text">' + esc((this.str(e, 'Header') || e.headerText || '').replace(/_(.)/, '$1')) + '</span>');
        this.out.push('</div></div>');
    };

    Renderer.prototype.renderStatusBar = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, false);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, true);
        if (!this.background(css, e)) css.add('background-color', '#F1EDED');
        // ItemsPanel: a Grid with column definitions, or the default DockPanel (a row).
        var panel = null;
        var ip = e.propEls.ItemsPanel;
        if (ip) {
            var tpl = ip.children[0];
            panel = tpl && tpl.children.filter(function (c) { return c.localName.indexOf('.') < 0; })[0];
        }
        var gridCols = panel && panel.localName === 'Grid' ? gridDefs({ propEls: { ColumnDefinitions: panel.children.filter(function (c) { return c.localName === 'Grid.ColumnDefinitions'; })[0] }, attrs: {} }, 'Column') : null;
        if (gridCols && gridCols.length) css.add('display', 'grid').add('grid-template-columns', gridCols.map(function (c) { return trackCss(c, 'Column'); }).join(' '));
        else css.add('display', 'flex');
        this.open('div', e, 'x-statusbar', css);
        for (var i = 0; i < e.children.length; i++) {
            var c = e.children[i];
            var col = (this.num(c, 'Grid.Column') || 0) + 1;
            var isSep = c.kind === 'Separator';
            var ic = new Css();
            if (gridCols && gridCols.length) ic.add('grid-column', String(col)).add('grid-row', '1');
            this.visual(ic, c);
            this.text(ic, c);
            this.background(ic, c);
            if (isSep) { ic.add('pointer-events', 'auto'); this.open('div', c, 'x-statusbar-separator', ic); this.out.push('</div>'); continue; }
            ic.add('pointer-events', 'auto');
            var pd = this.thick(c, 'Padding'); if (pd) ic.add('padding', thicknessCss(pd));
            this.open('div', c, 'x-statusbaritem', ic);
            if (c.kind === 'StatusBarItem') {
                var content = c.contentEl ? [c.contentEl] : c.children;
                if (content.length) for (var k = 0; k < content.length; k++) this.render(content[k], { kind: 'cell' });
                else this.out.push('<span style="white-space:pre">' + esc(this.contentText(c) || '') + '</span>');
            } else this.render(c, { kind: 'cell' });
            this.out.push('</div>');
        }
        this.out.push('</div>');
    };

    Renderer.prototype.selectedTab = function (e) {
        var items = e.children.filter(function (c) { return c.kind === 'TabItem'; });
        var chosen = this.selectedTabs[e.id];
        if (chosen !== undefined) {
            var f = items.filter(function (c) { return c.id === chosen; })[0];
            if (f) return f;
        }
        var si = this.num(e, 'SelectedIndex');
        var sel = items.filter(function (c) { return attrValue(c.node, 'IsSelected') === 'True'; })[0];
        return sel || items[si !== null && items[si] ? si : 0] || null;
    };

    Renderer.prototype.renderTabControl = function (e, layout) {
        var css = new Css();
        this.place(css, e, layout, true);
        this.visual(css, e);
        this.text(css, e);
        this.hitTest(css, false);
        var placement = this.str(e, 'TabStripPlacement') || 'Top';
        css.add('display', 'flex').add('flex-direction', { Top: 'column', Bottom: 'column-reverse', Left: 'row', Right: 'row-reverse' }[placement] || 'column');
        this.open('div', e, 'x-tabcontrol', css);
        var selected = this.selectedTab(e);
        var vertical = placement === 'Left' || placement === 'Right';
        this.out.push('<div class="x-tabpanel" style="' + (vertical ? 'flex-direction:column;margin:2px 0 2px 2px' : '') + '">');
        var items = e.children.filter(function (c) { return c.kind === 'TabItem'; });
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var isSel = it === selected;
            var tc = new Css();
            var w = this.num(it, 'Width'), h = this.num(it, 'Height');
            if (w !== null) tc.px('width', w);
            if (h !== null) tc.px('height', h);
            this.text(tc, it);
            var va = this.str(it, 'VerticalAlignment') || 'Stretch';
            tc.add('align-self', va === 'Top' ? 'flex-start' : va === 'Bottom' ? 'flex-end' : va === 'Center' ? 'center' : 'stretch');
            this.visual(tc, it);
            var parts = this.templateParts(e, 'TabItem', { IsSelected: isSel ? 'True' : 'False', IsMouseOver: 'False', IsEnabled: 'True' });
            var bc = new Css(), pc;
            if (parts && parts.border) {
                var b = parts.border;
                var bt = parseThickness(attrValue(b, 'BorderThickness') || '0');
                var bb = parseColor(attrValue(b, 'BorderBrush')) ;
                bc.add('border-style', 'solid').add('border-width', thicknessCss(bt)).add('border-color', bb ? colorCss(bb) : 'transparent');
                if (attrValue(b, 'CornerRadius')) bc.add('border-radius', parseCornerRadius(attrValue(b, 'CornerRadius')));
                if (attrValue(b, 'Margin')) bc.add('margin', thicknessCss(parseThickness(attrValue(b, 'Margin'))));
                var bgv = parts.borderSet.Background || attrValue(b, 'Background');
                var ownBg = this.color(it, 'Background');
                var bgc = typeof bgv === 'string' && bgv.indexOf('{TemplateBinding') === 0 ? ownBg : parseColor(bgv);
                if (bgc) bc.add('background', colorCss(bgc));
                var pm = parts.presenter ? attrValue(parts.presenter, 'Margin') : null;
                pc = 'margin:' + thicknessCss(pm ? parseThickness(pm) : { l: 0, t: 0, r: 0, b: 0 }) + ';';
                var pha = parts.presenter ? attrValue(parts.presenter, 'HorizontalAlignment') : null;
                var pva = parts.presenter ? attrValue(parts.presenter, 'VerticalAlignment') : null;
                pc += '--x-ph:' + selfAlign(pha || 'Stretch') + ';--x-pv:' + selfAlign(pva || 'Stretch');
            } else {
                // Aero2 default TabItem: 1px #ACACAC, #F0F0F0→#E5E5E5, selected white and 2px larger.
                bc.add('border-style', 'solid').add('border-width', isSel ? '1px 1px 0 1px' : '1px 1px 0 1px').add('border-color', '#ACACAC');
                bc.add('background', isSel ? '#FFFFFF' : 'linear-gradient(#F0F0F0,#E5E5E5)');
                if (isSel) bc.add('margin', '-2px -2px 0 -2px');
                var ipd = this.thick(it, 'Padding') || { l: 6, t: 2, r: 6, b: 2 };
                pc = 'padding:' + thicknessCss(ipd) + ';--x-ph:safe center;--x-pv:safe center';
            }
            tc.add('pointer-events', 'auto');
            this.open('div', it, 'x-tabitem' + (isSel ? ' x-tabitem-selected' : ''), tc, ' data-tabcontrol="' + e.id + '"');
            this.out.push('<div class="x-tabitem-border" style="' + esc(bc.toString()) + '"><div class="x-tabitem-content" style="' + esc(pc) + '">');
            if (it.headerEl) this.render(it.headerEl, { kind: 'cell' });
            else this.out.push('<span>' + esc(this.str(it, 'Header') || it.headerText || '') + '</span>');
            this.out.push('</div></div></div>');
        }
        this.out.push('</div>');
        var cc = new Css();
        var bgc2 = this.brush(e, 'Background');
        if (bgc2) cc.add('background', bgc2.image || bgc2.color);
        var bdc = this.color(e, 'BorderBrush'); if (bdc) cc.add('border-color', colorCss(bdc));
        var cpd = this.thick(e, 'Padding'); if (cpd) cc.add('padding', thicknessCss(cpd));
        this.out.push('<div class="x-tabcontent" style="' + esc(cc.toString()) + '">');
        if (selected) {
            var fc = new Css();
            this.text(fc, selected);
            this.out.push('<div class="x-tabcontent-presenter" style="' + esc(fc.toString()) + '">');
            var content = selected.contentEl ? [selected.contentEl] : selected.children;
            for (var k = 0; k < content.length; k++) this.render(content[k], { kind: 'cell' });
            this.out.push('</div>');
        }
        this.out.push('</div></div>');
    };

    function renderModel(model, ctx) {
        var r = new Renderer(model, ctx);
        var root = model.root;
        if (root.kind === 'Window') r.renderWindow(root);
        else {
            var w = num(attrValue(root.node, 'd:DesignWidth')) || num(attrValue(root.node, 'Width'));
            var h = num(attrValue(root.node, 'd:DesignHeight')) || num(attrValue(root.node, 'Height'));
            var css = new Css();
            css.add('position', 'relative').add('display', 'grid').add('grid-template', 'minmax(0,1fr)/minmax(0,1fr)');
            if (w) css.px('width', w); else css.add('width', 'max-content');
            if (h) css.px('height', h); else css.add('height', 'max-content');
            r.out.push('<div class="x-root" style="' + esc(css.toString()) + '">');
            if (root.kind === 'ResourceDictionary' || root.kind === 'Application') {
                r.out.push('<div class="x-unknown" style="padding:20px">' + esc(root.node.name) + ' has no visual content</div>');
            } else r.render(root, { kind: 'cell' });
            r.out.push('</div>');
        }
        return r.out.join('');
    }

    /** HTML of one element of a model (for drawing a part of a XAML file elsewhere), laid out as a grid cell. */
    function renderElementHtml(model, el, ctx) {
        var r = new Renderer(model, ctx);
        r.render(el, { kind: 'cell' });
        return r.out.join('');
    }

    // =====================================================================================
    // Source edits: every change touches only the characters it must.
    // =====================================================================================

    function escAttr(v) {
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    /** Edit that sets (or removes, when value is null) an attribute on an element node. */
    function setAttrEdit(text, node, name, value) {
        var a = attrOf(node, name);
        if (a) {
            if (value === null) {
                // Remove the attribute and the whitespace before it.
                var s = a.start;
                while (s > 0 && /[ \t]/.test(text[s - 1])) s--;
                if (s > 0 && /[\r\n]/.test(text[s - 1])) {
                    // The attribute is on its own line: remove the line.
                    var ls = s;
                    while (ls > 0 && /[\r\n]/.test(text[ls - 1])) ls--;
                    var after = a.end;
                    while (after < text.length && /[ \t]/.test(text[after])) after++;
                    if (text[after] === '>' || text.startsWith('/>', after)) return { offset: ls, length: a.end - ls, text: '' };
                    return { offset: s, length: after - s, text: '' };
                }
                return { offset: s, length: a.end - s, text: '' };
            }
            return { offset: a.vStart, length: a.vEnd - a.vStart, text: escAttr(value) };
        }
        if (value === null) return null;
        // Insert after the last attribute (or the element name).
        var pos = node.attrs.length ? node.attrs[node.attrs.length - 1].end : node.nameEnd;
        return { offset: pos, length: 0, text: ' ' + name + '="' + escAttr(value) + '"' };
    }

    function lineIndent(text, offset) {
        var ls = offset;
        while (ls > 0 && text[ls - 1] !== '\n') ls--;
        var m = /^[ \t]*/.exec(text.substring(ls, offset));
        return m ? m[0] : '';
    }
    function eol(text) { return text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'; }

    /** Edit that removes an element (and its line when it stands alone). */
    function deleteElementEdit(text, node) {
        var s = node.start, e = node.end;
        var ls = s;
        while (ls > 0 && /[ \t]/.test(text[ls - 1])) ls--;
        var le = e;
        while (le < text.length && /[ \t]/.test(text[le])) le++;
        if ((ls === 0 || text[ls - 1] === '\n') && (le >= text.length || text[le] === '\r' || text[le] === '\n')) {
            if (text[le] === '\r') le++;
            if (text[le] === '\n') le++;
            return { offset: ls, length: le - ls, text: '' };
        }
        return { offset: s, length: e - s, text: '' };
    }

    /** Edits that append child XML as the last child of an element node. */
    function insertChildEdit(text, node, xml) {
        var nl = eol(text);
        var indent = lineIndent(text, node.start);
        var unit = detectIndentUnit(text);
        if (node.selfClosing) {
            var closePos = node.tagEnd - 2;
            var s = closePos;
            while (s > 0 && /\s/.test(text[s - 1])) s--;
            return { offset: s, length: node.tagEnd - s, text: '>' + nl + indent + unit + xml + nl + indent + '</' + node.name + '>' };
        }
        // Before the closing tag, on its own line.
        var cs = node.closeStart;
        var ls = cs;
        while (ls > 0 && /[ \t]/.test(text[ls - 1])) ls--;
        if (ls > 0 && text[ls - 1] === '\n') {
            return { offset: ls, length: 0, text: indent + unit + xml + nl };
        }
        return { offset: cs, length: 0, text: nl + indent + unit + xml + nl + indent };
    }

    function detectIndentUnit(text) {
        var m = /\n( +|\t)</.exec(text);
        if (m && m[1] === '\t') return '\t';
        var counts = {};
        var re = /\n( +)</g, r, n = 0;
        while ((r = re.exec(text)) && n < 200) { counts[r[1].length] = (counts[r[1].length] || 0) + 1; n++; }
        var lens = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
        for (var i = 1; i < lens.length; i++) { var d = lens[i] - lens[i - 1]; if (d === 2 || d === 4) return d === 2 ? '  ' : '    '; }
        return '    ';
    }

    /** Deepest element node whose start tag or content contains offset. */
    function nodeAtOffset(model, offset) {
        var best = null;
        for (var i = 0; i < model.all.length; i++) {
            var n = model.all[i].node;
            if (n.start <= offset && offset < n.end) {
                if (!best || n.start >= best.node.start) best = model.all[i];
            }
        }
        return best;
    }

    var api = {
        XmlError: XmlError,
        parseXml: parseXml,
        buildModel: buildModel,
        getValue: getValue,
        styleOf: styleOf,
        resolveMarkup: resolveMarkup,
        parseMarkup: parseMarkup,
        parseColor: parseColor,
        colorCss: colorCss,
        colorHex: colorHex,
        brushColor: brushColor,
        parseThickness: parseThickness,
        formatThickness: formatThickness,
        num: num,
        fmt: fmt,
        renderModel: renderModel,
        renderElementHtml: renderElementHtml,
        setAttrEdit: setAttrEdit,
        deleteElementEdit: deleteElementEdit,
        insertChildEdit: insertChildEdit,
        lineIndent: lineIndent,
        nodeAtOffset: nodeAtOffset,
        attrOf: attrOf,
        attrValue: attrValue,
        gridDefs: gridDefs,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.WpfCore = api;
})(typeof self !== 'undefined' ? self : this);
