"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWindowHandlers = registerWindowHandlers;
const electron_1 = require("electron");
function registerWindowHandlers() {
    electron_1.ipcMain.handle('window:minimize', () => {
        electron_1.BrowserWindow.getFocusedWindow()?.minimize();
    });
    electron_1.ipcMain.handle('window:maximize', () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (win?.isMaximized()) {
            win.unmaximize();
        }
        else {
            win?.maximize();
        }
    });
    electron_1.ipcMain.handle('window:close', () => {
        electron_1.BrowserWindow.getFocusedWindow()?.close();
    });
}
//# sourceMappingURL=window.js.map