import { test as authTest, expect } from './auth'

/**
 * Extended test fixture that injects window.__TAURI_INTERNALS__ and window.__TAURI__
 * into every page before navigation, simulating the Tauri desktop environment.
 */
const test = authTest.extend<{ page: Parameters<typeof authTest.extend>[0]['page'] extends infer T ? T : never }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' } },
      };
      (window as any).__TAURI__ = {
        convertFileSrc: (s: string) => s,
      };
    })
    await use(page)
  },
})

export { test, expect }
