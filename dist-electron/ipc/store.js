"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStoreHandlers = registerStoreHandlers;
const electron_1 = require("electron");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
/**
 * Simple JSON key-value store persisted to disk.
 * Replaces @tauri-apps/plugin-store.
 */
const storePath = () => (0, path_1.join)(electron_1.app.getPath('userData'), 'store.json');
let storeData = {};
let loaded = false;
async function loadStore() {
    if (loaded)
        return;
    const path = storePath();
    try {
        if ((0, fs_1.existsSync)(path)) {
            const raw = await (0, promises_1.readFile)(path, 'utf-8');
            storeData = JSON.parse(raw);
        }
    }
    catch {
        storeData = {};
    }
    loaded = true;
}
async function saveStore() {
    const path = storePath();
    const dir = (0, path_1.join)(path, '..');
    if (!(0, fs_1.existsSync)(dir)) {
        await (0, promises_1.mkdir)(dir, { recursive: true });
    }
    await (0, promises_1.writeFile)(path, JSON.stringify(storeData, null, 2), 'utf-8');
}
function registerStoreHandlers() {
    electron_1.ipcMain.handle('store:get', async (_event, key) => {
        await loadStore();
        return storeData[key] ?? null;
    });
    electron_1.ipcMain.handle('store:set', async (_event, key, value) => {
        await loadStore();
        storeData[key] = value;
        await saveStore();
    });
}
//# sourceMappingURL=store.js.map