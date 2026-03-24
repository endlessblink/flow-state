"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerShellHandlers = registerShellHandlers;
const electron_1 = require("electron");
function registerShellHandlers() {
    electron_1.ipcMain.handle('shell:openExternal', async (_event, url) => {
        await electron_1.shell.openExternal(url);
    });
}
//# sourceMappingURL=shell.js.map