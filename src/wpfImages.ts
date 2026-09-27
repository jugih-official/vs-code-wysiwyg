import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ImageInfo {
    uri: string | null;
    /** Size in WPF device-independent pixels (pixels × 96 / DPI), as WPF sizes an Image. */
    w: number;
    h: number;
}

/** The nearest folder at or above the XAML file that holds a .csproj: where "/Resources/x.png" is rooted. */
export function findProjectRoot(xamlPath: string): string {
    let dir = path.dirname(xamlPath);
    for (;;) {
        try {
            if (fs.readdirSync(dir).some(f => f.endsWith('.csproj') || f.endsWith('.vbproj'))) {
                return dir;
            }
        } catch {
            break;
        }
        const up = path.dirname(dir);
        if (up === dir) {
            break;
        }
        dir = up;
    }
    return path.dirname(xamlPath);
}

/** Resolves a WPF image Source ("/Resources/a.png", "pack://application:,,,/a.png", "img/a.png") to a file. */
export function resolveImagePath(source: string, xamlPath: string, projectRoot: string): string | null {
    let s = source.trim();
    if (!s || s.startsWith('{')) {
        return null;
    }
    s = s.replace(/^pack:\/\/application:,,,/i, '');
    s = s.replace(/^\/[^/;]+;component\//i, '/');
    if (/^[a-z]+:\/\//i.test(s) && !/^file:/i.test(s)) {
        return null;
    }
    s = s.replace(/^file:\/\/\/?/i, '');
    s = decodeURIComponent(s).replace(/\\/g, '/');
    const candidates: string[] = [];
    if (path.isAbsolute(s) && fs.existsSync(s) && !s.startsWith('/Resources')) {
        candidates.push(s);
    }
    if (s.startsWith('/')) {
        candidates.push(path.join(projectRoot, s));
    } else {
        candidates.push(path.join(path.dirname(xamlPath), s), path.join(projectRoot, s));
    }
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            return c;
        }
        // Windows paths are case-insensitive: try a case-insensitive match of the file name.
        const dir = path.dirname(c);
        try {
            const hit = fs.readdirSync(dir).find(f => f.toLowerCase() === path.basename(c).toLowerCase());
            if (hit) {
                return path.join(dir, hit);
            }
        } catch {
            // folder missing
        }
    }
    return null;
}

/** Image size in DIPs from the file header (PNG with pHYs, GIF, JPEG, BMP). */
export function readImageSize(file: string): { w: number; h: number } | null {
    let buf: Buffer;
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const size = Math.min(fs.fstatSync(fd).size, 512 * 1024);
            buf = Buffer.alloc(size);
            fs.readSync(fd, buf, 0, size, 0);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
    // PNG
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
        let w = 0, h = 0, dx = 96, dy = 96;
        let p = 8;
        while (p + 8 <= buf.length) {
            const len = buf.readUInt32BE(p);
            const type = buf.toString('ascii', p + 4, p + 8);
            const data = p + 8;
            if (type === 'IHDR') {
                w = buf.readUInt32BE(data);
                h = buf.readUInt32BE(data + 4);
            } else if (type === 'pHYs' && len >= 9 && buf[data + 8] === 1) {
                dx = buf.readUInt32BE(data) * 0.0254;
                dy = buf.readUInt32BE(data + 4) * 0.0254;
            } else if (type === 'IDAT' || type === 'IEND') {
                break;
            }
            p = data + len + 4;
        }
        return w && h ? { w: w * 96 / (dx || 96), h: h * 96 / (dy || 96) } : null;
    }
    // GIF
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
        return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    }
    // BMP
    if (buf.length > 26 && buf[0] === 0x42 && buf[1] === 0x4d) {
        const w = buf.readInt32LE(18), h = Math.abs(buf.readInt32LE(22));
        const ppm = buf.length > 42 ? buf.readInt32LE(38) : 0;
        const dpi = ppm > 0 ? ppm * 0.0254 : 96;
        return { w: w * 96 / dpi, h: h * 96 / dpi };
    }
    // JPEG: SOF marker gives the size; JFIF density gives the DPI.
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let p = 2, dpiX = 96, dpiY = 96;
        while (p + 9 < buf.length) {
            if (buf[p] !== 0xff) { p++; continue; }
            const marker = buf[p + 1];
            const len = buf.readUInt16BE(p + 2);
            if (marker === 0xe0 && buf.toString('ascii', p + 4, p + 8) === 'JFIF' && buf[p + 11] === 1) {
                dpiX = buf.readUInt16BE(p + 12) || 96;
                dpiY = buf.readUInt16BE(p + 14) || 96;
            }
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return { w: buf.readUInt16BE(p + 7) * 96 / dpiX, h: buf.readUInt16BE(p + 5) * 96 / dpiY };
            }
            p += 2 + len;
        }
    }
    return null;
}

const sizeCache = new Map<string, { mtime: number; size: { w: number; h: number } | null }>();

function cachedSize(file: string): { w: number; h: number } | null {
    let mtime = 0;
    try {
        mtime = fs.statSync(file).mtimeMs;
    } catch {
        return null;
    }
    const hit = sizeCache.get(file);
    if (hit && hit.mtime === mtime) {
        return hit.size;
    }
    const size = readImageSize(file);
    sizeCache.set(file, { mtime, size });
    return size;
}

/** Every image source in the XAML, resolved to a webview URI and its WPF size. */
export function collectImages(text: string, xamlPath: string, webview: vscode.Webview): Record<string, ImageInfo> {
    const root = findProjectRoot(xamlPath);
    const result: Record<string, ImageInfo> = {};
    const re = /\b(?:Source|UriSource|ImageSource)\s*=\s*"([^"{][^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const src = m[1];
        if (result[src]) {
            continue;
        }
        const file = resolveImagePath(src, xamlPath, root);
        if (!file) {
            result[src] = { uri: null, w: 0, h: 0 };
            continue;
        }
        const size = cachedSize(file);
        result[src] = { uri: webview.asWebviewUri(vscode.Uri.file(file)).toString(), w: size ? size.w : 0, h: size ? size.h : 0 };
    }
    return result;
}
