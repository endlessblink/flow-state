import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'undo-delete-second-ctrlz-lag.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5546',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5546',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
