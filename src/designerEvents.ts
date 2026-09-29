import * as vscode from 'vscode';

/** Messages from the designer webviews, observable by the extension's integration tests. */
const emitter = new vscode.EventEmitter<{ designer: string; file: string; message: { type: string } }>();

export const onDesignerMessage = emitter.event;

export function designerMessage(designer: string, file: string, message: { type: string }): void {
    emitter.fire({ designer, file, message });
}

type Handler = (message: never) => Promise<void> | void;
const handlers = new Map<string, Handler>();

/** Providers register their webview message handler so tests can drive the extension side directly. */
export function registerDesignerHandler(designer: string, file: string, handler: Handler): vscode.Disposable {
    const key = designer + '|' + file;
    handlers.set(key, handler);
    return new vscode.Disposable(() => { if (handlers.get(key) === handler) { handlers.delete(key); } });
}

export async function simulateDesignerMessage(designer: string, file: string, message: unknown): Promise<boolean> {
    const h = handlers.get(designer + '|' + file);
    if (!h) {
        return false;
    }
    await h(message as never);
    return true;
}
