import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'settings-storage-layout.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/settings-local' }]],
  use: {
    baseURL: 'http://127.0.0.1:5549',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite ../.. --host 127.0.0.1 --port 5549 --strictPort',
    url: 'http://127.0.0.1:5549/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
