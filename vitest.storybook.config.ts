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

export default defineConfig({
    plugins: [
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
