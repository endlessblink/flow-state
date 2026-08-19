import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './',
    timeout: 30 * 1000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'html',
    use: {
        actionTimeout: 0,
        serviceWorkers: 'block',
        trace: 'off',
        video: 'off',
        screenshot: 'off',
        baseURL: 'http://localhost:4173',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ]
                }
            },
        },
    ],
    webServer: {
        command: 'npm run preview',
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
});
