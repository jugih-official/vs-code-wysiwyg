import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';

/**
 * A local reverse proxy in front of the running app for the Razor designer's live view. It forwards HTTP and
 * WebSocket traffic (Blazor Server's circuit) unchanged, and adds one script tag to HTML pages: the agent
 * that reports what is under the pointer to the designer. The app itself is not modified.
 */
export interface LiveProxy {
    url: string;
    target: string;
    close(): void;
}

const AGENT_PATH = '/__razor_designer_agent.js';

export function startLiveProxy(target: string, agentFile: string): Promise<LiveProxy> {
    const t = new URL(target);
    const targetPort = Number(t.port) || (t.protocol === 'https:' ? 443 : 80);
    if (t.protocol !== 'http:') {
        return Promise.reject(new Error('The live view needs the app\'s http:// address (not https)'));
    }
    let proxyOrigin = '';

    const server = http.createServer((req, res) => {
        if (req.url === AGENT_PATH) {
            res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
            res.end(fs.readFileSync(agentFile));
            return;
        }
        const headers = { ...req.headers, host: t.host };
        if (headers.origin) {
            headers.origin = t.origin;
        }
        if (typeof headers.referer === 'string' && proxyOrigin && headers.referer.startsWith(proxyOrigin)) {
            headers.referer = t.origin + headers.referer.substring(proxyOrigin.length);
        }
        delete headers['accept-encoding']; // HTML must arrive uncompressed to add the agent
        const up = http.request({ host: t.hostname, port: targetPort, method: req.method, path: req.url, headers }, upRes => {
            const h = { ...upRes.headers };
            if (typeof h.location === 'string' && h.location.startsWith(t.origin)) {
                h.location = proxyOrigin + h.location.substring(t.origin.length);
            }
            // The page is shown in the designer's frame: drop headers that forbid framing.
            delete h['x-frame-options'];
            if (typeof h['content-security-policy'] === 'string') {
                h['content-security-policy'] = h['content-security-policy'].replace(/frame-ancestors[^;]*;?/i, '');
            }
            const type = String(h['content-type'] || '');
            if (!/text\/html/i.test(type)) {
                res.writeHead(upRes.statusCode || 200, h);
                upRes.pipe(res);
                return;
            }
            const chunks: Buffer[] = [];
            upRes.on('data', c => chunks.push(c));
            upRes.on('end', () => {
                let html = Buffer.concat(chunks).toString('utf8');
                const tag = `<script src="${AGENT_PATH}"></script>`;
                html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : tag + html;
                delete h['content-length'];
                delete h['transfer-encoding'];
                h['content-length'] = String(Buffer.byteLength(html));
                res.writeHead(upRes.statusCode || 200, h);
                res.end(html);
            });
        });
        up.on('error', err => {
            res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><body style="font:14px sans-serif;padding:24px;color:#444">
<h3>The app is not running at ${target}</h3><p>${String(err.message).replace(/</g, '&lt;')}</p>
<p>Start it (for example with <b>Start app</b> in the designer, which runs <code>dotnet watch</code>) and press Reload.</p></body></html>`);
        });
        req.pipe(up);
    });

    // WebSockets: a raw TCP tunnel after re-sending the upgrade request with the target's Host.
    server.on('upgrade', (req, socket, head) => {
        const upstream = net.connect(targetPort, t.hostname, () => {
            const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
                const name = req.rawHeaders[i];
                const value = name.toLowerCase() === 'host' ? t.host : name.toLowerCase() === 'origin' ? t.origin : req.rawHeaders[i + 1];
                lines.push(`${name}: ${value}`);
            }
            upstream.write(lines.join('\r\n') + '\r\n\r\n');
            if (head && head.length) {
                upstream.write(head);
            }
            upstream.pipe(socket);
            socket.pipe(upstream);
        });
        const close = () => { upstream.destroy(); socket.destroy(); };
        upstream.on('error', close);
        socket.on('error', close);
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as net.AddressInfo;
            proxyOrigin = `http://127.0.0.1:${addr.port}`;
            resolve({ url: proxyOrigin, target, close: () => server.close() });
        });
    });
}
