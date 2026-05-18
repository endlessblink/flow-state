/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const packageVersion = JSON.parse(
    readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
).version;

const tauriStubPlugin = {
    name: 'tauri-stub',
    resolveId(id: string) {
        if (id.startsWith('@tauri-apps/')) return '\0tauri-stub';
    },
    load(id: string) {
        if (id === '\0tauri-stub') {
            return 'export default {}; export const invoke = () => {}; export const getCurrentWindow = () => ({}); export const homeDir = () => ""; export const attachConsole = () => {}; export const open = () => {}; export const load = () => ({}); export const check = () => ({}); export const relaunch = () => {}; export const Command = class {}; export const fetch = globalThis.fetch; export const writeTextFile = () => {}; export const mkdir = () => {}; export const exists = () => false;';
        }
    }
};

export default defineConfig({
    plugins: [
        tauriStubPlugin,
        vue(),
        storybookTest({
            configDir: path.join(dirname, '.storybook')
        })
    ],
    define: {
        '__APP_VERSION__': JSON.stringify(packageVersion),
    },
    test: {
        name: 'storybook',
        browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            instances: [{
                browser: 'chromium',
                launch: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ]
                }
            }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            'virtual:pwa-register/vue': fileURLToPath(new URL('./tests/mocks/pwa-register.ts', import.meta.url))
        }
    }
});
