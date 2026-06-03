import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'canvas-collapse-local.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5548',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite ../.. --host 127.0.0.1 --port 5548 --strictPort',
    url: 'http://127.0.0.1:5548/index.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
