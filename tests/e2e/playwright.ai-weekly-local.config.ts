import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: '../../tests/global-setup.ts',
  testDir: '.',
  testMatch: 'ai-weekly-plan-quality.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5547',
    storageState: '../../tests/.auth/user.json',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
