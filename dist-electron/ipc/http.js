"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHttpHandlers = registerHttpHandlers;
const electron_1 = require("electron");
function registerHttpHandlers() {
    electron_1.ipcMain.handle('http:fetch', async (_event, url, options) => {
        const resp = await electron_1.net.fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers,
            body: options?.body,
        });
        const text = await resp.text();
        return {
            ok: resp.ok,
            status: resp.status,
            statusText: resp.statusText,
            text,
            headers: Object.fromEntries(resp.headers.entries()),
        };
    });
}
//# sourceMappingURL=http.js.map