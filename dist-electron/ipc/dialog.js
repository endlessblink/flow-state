"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDialogHandlers = registerDialogHandlers;
const electron_1 = require("electron");
function registerDialogHandlers() {
    electron_1.ipcMain.handle('dialog:showSave', async (_event, options) => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return { canceled: true, filePath: undefined };
        return electron_1.dialog.showSaveDialog(win, options);
    });
    electron_1.ipcMain.handle('dialog:showOpen', async (_event, options) => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return { canceled: true, filePaths: [] };
        return electron_1.dialog.showOpenDialog(win, options);
    });
}
//# sourceMappingURL=dialog.js.map