"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFsHandlers = registerFsHandlers;
const electron_1 = require("electron");
const promises_1 = require("fs/promises");
function registerFsHandlers() {
    electron_1.ipcMain.handle('fs:readFile', async (_event, path) => {
        return (0, promises_1.readFile)(path, 'utf-8');
    });
    electron_1.ipcMain.handle('fs:writeFile', async (_event, path, data) => {
        await (0, promises_1.writeFile)(path, data, 'utf-8');
    });
    electron_1.ipcMain.handle('fs:exists', async (_event, path) => {
        try {
            await (0, promises_1.access)(path);
            return true;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle('fs:mkdir', async (_event, path) => {
        await (0, promises_1.mkdir)(path, { recursive: true });
    });
}
//# sourceMappingURL=fs.js.map