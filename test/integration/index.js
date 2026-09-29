// Integration test in a real VS Code: opens the WPF and Razor designers on distribution_system files and waits for
// the webviews to report what they rendered. Run with test/run-integration.sh (needs the Blazor app for the live step).
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const DS = process.env.DS_ROOT || '/home/jukka/repos/distribution_system';
const LIVE_URL = process.env.LIVE_URL || '';

async function run() {
    const results = [];
    const ext = vscode.extensions.getExtension('jugih-official.wysiwyg-designer');
    const api = await ext.activate();
    const messages = [];
    api.onDesignerMessage(m => messages.push(m));
    const waitFor = (pred, label, ms = 30000) => new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
            const hit = messages.find(pred);
            if (hit) return resolve(hit);
            if (Date.now() - t0 > ms) return reject(new Error('timeout: ' + label));
            setTimeout(tick, 100);
        };
        tick();
    });
    const check = async (label, fn) => {
        try { const detail = await fn(); results.push({ label, ok: true, detail }); }
        catch (e) { results.push({ label, ok: false, detail: String(e && e.message || e) }); }
    };

    const xaml = path.join(DS, 'MainWindow.xaml');
    const logRazor = path.join(DS, 'src/Distribution.Web/Components/Pages/LogWindow.razor');
    const mainRazor = path.join(DS, 'src/Distribution.Web/Components/Pages/MainWindow.razor');

    await check('WPF designer renders MainWindow.xaml', async () => {
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(xaml), 'xamlDesigner.visualEditor');
        const m = await waitFor(x => x.designer === 'wpf' && x.file === xaml && x.message.type === 'rendered', 'wpf rendered');
        if (m.message.elements < 1000 || m.message.images < 100) throw new Error(JSON.stringify(m.message));
        const im = await waitFor(x => x.designer === 'wpf' && x.file === xaml && x.message.type === 'imagesLoaded', 'wpf images');
        if (im.message.loaded !== im.message.total) throw new Error('images: ' + JSON.stringify(im.message));
        return Object.assign({}, m.message, { imagesLoaded: im.message.loaded + '/' + im.message.total });
    });

    await check('Razor designer renders LogWindow.razor with the project CSS', async () => {
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(logRazor), 'xamlDesigner.razorVisualEditor');
        const m = await waitFor(x => x.designer === 'razor' && x.file === logRazor && x.message.type === 'rendered' && x.message.elements > 0, 'razor rendered');
        // wpf.css sets .log-window { position: fixed }: the project CSS is really applied in the frame.
        if (m.message.probe !== 'fixed') throw new Error('project CSS not applied: ' + JSON.stringify(m.message));
        return m.message;
    });

    await check('Razor designer draws MainWindow.xaml in place of @RenderDock', async () => {
        await api.setRazorDesignState(mainRazor, {
            conds: { Modern: false, SettingsTabSelected: false }, cases: {}, loops: 3, placeholders: true, layout: true,
            samples: {}, frags: { RenderDock: { xaml, element: '', fit: true } },
        });
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(mainRazor), 'xamlDesigner.razorVisualEditor');
        const m = await waitFor(x => x.designer === 'razor' && x.file === mainRazor && x.message.type === 'rendered' && x.message.frags > 0, 'xaml drawn', 45000);
        const im = await waitFor(x => x.designer === 'razor' && x.file === mainRazor && x.message.type === 'imagesLoaded' && x.message.total > 100, 'razor images', 45000);
        if (im.message.loaded !== im.message.total) throw new Error('images: ' + JSON.stringify(im.message));
        return Object.assign({}, m.message, { imagesLoaded: im.message.loaded + '/' + im.message.total });
    });

    // The extension side of editing (run on a temporary copy of the project: these write files).
    const wpfCss = path.join(DS, 'src/Distribution.Web/wwwroot/css/wpf.css');
    await check('Razor edit changes only the attribute value', async () => {
        const doc = await vscode.workspace.openTextDocument(logRazor);
        const before = doc.getText();
        const at = before.indexOf('class="log-close"') + 'class="'.length;
        const ok = await api.simulateDesignerMessage('razor', logRazor, { type: 'edit', version: doc.version, edits: [{ offset: at, length: 9, text: 'log-close wide' }] });
        if (!ok) throw new Error('no Razor designer for ' + logRazor);
        const after = doc.getText();
        const expected = before.slice(0, at) + 'log-close wide' + before.slice(at + 9);
        if (after !== expected) throw new Error('unexpected text');
        // The designer's Undo button: the extension focuses the designer and runs VS Code's undo.
        await api.simulateDesignerMessage('razor', logRazor, { type: 'undo' });
        await new Promise(r => setTimeout(r, 500));
        if (doc.getText() !== before) throw new Error('undo did not restore the text');
        return 'edited, then undone';
    });
    await check('Stale Razor edit (old version) is rejected', async () => {
        const doc = await vscode.workspace.openTextDocument(logRazor);
        const before = doc.getText();
        await api.simulateDesignerMessage('razor', logRazor, { type: 'edit', version: doc.version - 1, edits: [{ offset: 0, length: 0, text: 'X' }] });
        if (doc.getText() !== before) throw new Error('stale edit was applied');
        return 'unchanged';
    });
    await check('CSS rule edit writes and saves the stylesheet', async () => {
        const text = fs.readFileSync(wpfCss, 'utf8');
        const rule = text.indexOf('.log-close {');
        const at = text.indexOf('min-width: 88px', rule) + 'min-width: '.length;
        await api.simulateDesignerMessage('razor', logRazor, { type: 'editFile', path: wpfCss, edits: [{ offset: at, length: 4, text: '96px', expect: '88px' }] });
        await new Promise(r => setTimeout(r, 500));
        const now = fs.readFileSync(wpfCss, 'utf8');
        if (now !== text.slice(0, at) + '96px' + text.slice(at + 4)) throw new Error('file not written as expected');
        return 'saved';
    });
    await check('CSS edit with a stale expected value is rejected', async () => {
        const text = fs.readFileSync(wpfCss, 'utf8');
        await api.simulateDesignerMessage('razor', logRazor, { type: 'editFile', path: wpfCss, edits: [{ offset: 10, length: 4, text: 'zzzz', expect: 'nope' }] });
        await new Promise(r => setTimeout(r, 300));
        if (fs.readFileSync(wpfCss, 'utf8') !== text) throw new Error('stale edit was applied');
        return 'unchanged';
    });
    await check('CSS edits outside the project are refused', async () => {
        const outside = path.join(DS, 'README.md');
        const text = fs.readFileSync(outside, 'utf8');
        await api.simulateDesignerMessage('razor', logRazor, { type: 'editFile', path: outside, edits: [{ offset: 0, length: 0, text: 'X', expect: '' }] });
        if (fs.readFileSync(outside, 'utf8') !== text) throw new Error('file outside the project was changed');
        return 'refused';
    });
    await check('WPF edit changes only the attribute value', async () => {
        const doc = await vscode.workspace.openTextDocument(xaml);
        const before = doc.getText();
        const at = before.indexOf('Canvas.Left="440"') + 'Canvas.Left="'.length;
        const ok = await api.simulateDesignerMessage('wpf', xaml, { type: 'edit', version: doc.version, edits: [{ offset: at, length: 3, text: '450' }] });
        if (!ok) throw new Error('no WPF designer');
        if (doc.getText() !== before.slice(0, at) + '450' + before.slice(at + 3)) throw new Error('unexpected text');
        await api.simulateDesignerMessage('wpf', xaml, { type: 'undo' });
        await new Promise(r => setTimeout(r, 500));
        if (doc.getText() !== before) throw new Error('undo did not restore the text');
        return 'edited, then undone';
    });
    await check('Open XAML from the Razor designer opens the WPF designer', async () => {
        await api.simulateDesignerMessage('razor', mainRazor, { type: 'openXaml', path: xaml });
        await new Promise(r => setTimeout(r, 1500));
        const tab = vscode.window.tabGroups.all.flatMap(g => g.tabs).find(t => t.input && t.input.viewType === 'xamlDesigner.visualEditor');
        if (!tab) throw new Error('no WPF designer tab');
        return tab.label;
    });

    // HTML designer: a flow page (its linked stylesheet must apply in the frame) and a fixed page.
    const flowHtml = path.join(DS, 'site/index.html');
    const hmiHtml = path.join(DS, 'site/hmi.html');
    await check('HTML designer renders a flow page with its linked stylesheet and images', async () => {
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(flowHtml), 'xamlDesigner.htmlVisualEditor');
        const m = await waitFor(x => x.designer === 'html' && x.file === flowHtml && x.message.type === 'rendered', 'html rendered');
        if (m.message.mode !== 'flow') throw new Error('mode ' + m.message.mode);
        // site.css sets .intro { font-size: 18px }.
        if (m.message.probe !== '18px') throw new Error('linked stylesheet not applied: ' + JSON.stringify(m.message));
        if (m.message.images !== 1 || m.message.imagesLoaded !== 1) throw new Error('image not loaded: ' + JSON.stringify(m.message));
        return m.message;
    });
    await check('HTML designer shows a fixed page at its resolution', async () => {
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(hmiHtml), 'xamlDesigner.htmlVisualEditor');
        const m = await waitFor(x => x.designer === 'html' && x.file === hmiHtml && x.message.type === 'rendered', 'hmi rendered');
        if (m.message.mode !== 'hmi' || !m.message.page || m.message.page.w !== 1280 || m.message.page.h !== 800) throw new Error(JSON.stringify(m.message));
        return m.message;
    });
    await check('HTML edit moves an element by changing only its style', async () => {
        const doc = await vscode.workspace.openTextDocument(hmiHtml);
        const before = doc.getText();
        const at = before.indexOf('left: 107px') + 'left: '.length;
        await api.simulateDesignerMessage('html', hmiHtml, { type: 'edit', version: doc.version, edits: [{ offset: at, length: 5, text: '120px' }] });
        if (doc.getText() !== before.slice(0, at) + '120px' + before.slice(at + 5)) throw new Error('unexpected text');
        await api.simulateDesignerMessage('html', hmiHtml, { type: 'undo' });
        await new Promise(r => setTimeout(r, 500));
        if (doc.getText() !== before) throw new Error('undo did not restore the text');
        return 'edited, then undone';
    });
    await check('CSS edit for a linked stylesheet is saved; other files are refused', async () => {
        const css = path.join(DS, 'site/site.css');
        const t = fs.readFileSync(css, 'utf8');
        const at = t.indexOf('18px');
        await api.simulateDesignerMessage('html', flowHtml, { type: 'editFile', path: css, edits: [{ offset: at, length: 4, text: '20px', expect: '18px' }] });
        await new Promise(r => setTimeout(r, 500));
        if (fs.readFileSync(css, 'utf8') !== t.slice(0, at) + '20px' + t.slice(at + 4)) throw new Error('site.css not written');
        const other = path.join(DS, 'README.md');
        const o = fs.readFileSync(other, 'utf8');
        await api.simulateDesignerMessage('html', flowHtml, { type: 'editFile', path: other, edits: [{ offset: 0, length: 0, text: 'X', expect: '' }] });
        if (fs.readFileSync(other, 'utf8') !== o) throw new Error('a file that is not a linked stylesheet was changed');
        return 'saved; refused';
    });

    if (LIVE_URL) {
        await check('Live view connects to the running app through the proxy', async () => {
            await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(logRazor), 'xamlDesigner.razorVisualEditor');
            await new Promise(r => setTimeout(r, 1500));
            const ok = await vscode.commands.executeCommand('xamlDesigner.razorLiveView', LIVE_URL);
            if (!ok) throw new Error('command found no designer');
            const m = await waitFor(x => x.designer === 'razor' && x.message.type === 'liveConnected', 'live connected', 45000);
            return m.message;
        });
    }

    fs.writeFileSync(process.env.RESULT_FILE || '/tmp/wysiwyg-integration.json', JSON.stringify(results, null, 2));
    const failed = results.filter(r => !r.ok);
    if (failed.length) throw new Error(failed.length + ' check(s) failed');
}

module.exports = { run };
