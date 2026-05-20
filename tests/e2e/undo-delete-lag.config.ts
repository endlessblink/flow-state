import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'undo-delete-second-ctrlz-lag.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/undo-delete-lag' }]],
  use: {
    baseURL: 'http://127.0.0.1:5548',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5548 --strictPort',
    url: 'http://127.0.0.1:5548',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
