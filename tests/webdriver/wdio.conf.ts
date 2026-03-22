/**
 * WebdriverIO config for testing inside the REAL Tauri/WebKitGTK window.
 *
 * This connects to tauri-driver → WebKitWebDriver → actual WebKitGTK engine.
 * Unlike Playwright WebKit (Apple's WebKit), this tests the EXACT same engine
 * that Tauri users see on Linux.
 *
 * Usage:
 *   # Terminal 1: Start tauri-driver
 *   tauri-driver
 *
 *   # Terminal 2: Run tests
 *   npx wdio tests/webdriver/wdio.conf.ts
 */

import path from 'path'

const TAURI_BINARY = path.resolve(__dirname, '../../src-tauri/target/release/flow-state')

export const config: WebdriverIO.Config = {
  // Connect to tauri-driver (which wraps WebKitWebDriver)
  hostname: '127.0.0.1',
  port: 4444,

  specs: ['./tests/webdriver/specs/**/*.ts'],

  capabilities: [{
    // @ts-expect-error — tauri:options is not in standard WebDriver types
    'tauri:options': {
      application: TAURI_BINARY,
    },
  }],

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,  // WebKitGTK can be slow to start
  },

  // Screenshot directory for visual regression
  screenshotPath: '.dev/screenshots/webdriver/',
}
