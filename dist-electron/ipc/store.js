"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushStore = flushStore;
exports.registerStoreHandlers = registerStoreHandlers;
const electron_1 = require("electron");
const path_1 = require("path");
const jsonStore_1 = require("./jsonStore");
/**
 * Simple JSON key-value store persisted to disk.
 * Replaces @tauri-apps/plugin-store.
 *
 * BUG-1874: backed by the atomic, serialized, corruption-safe store in `jsonStore.ts` so a kill
 * during an update handoff can't truncate `store.json` (which would wipe the auth session), and
 * concurrent writes (Supabase token + auth backup) can't clobber each other.
 */
let store = null;
function getStore() {
    if (!store) {
        store = (0, jsonStore_1.createJsonStore)((0, path_1.join)(electron_1.app.getPath('userData'), 'store.json'));
    }
    return store;
}
/**
 * Flush any pending store writes to disk. Called from the updater before the app exits so the
 * latest (possibly just-rotated) refresh token is durably persisted across the restart.
 */
async function flushStore() {
    if (!store)
        return;
    await store.flush();
}
function registerStoreHandlers() {
    electron_1.ipcMain.handle('store:get', async (_event, key) => {
        return getStore().get(key);
    });
    electron_1.ipcMain.handle('store:set', async (_event, key, value) => {
        await getStore().set(key, value);
    });
}
//# sourceMappingURL=store.js.map