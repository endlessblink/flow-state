import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const authFile = "tests/.auth/user.json";
const hasAuth = fs.existsSync(authFile);
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // TASK-1457: Global setup resets test data and authenticates dev user
  globalSetup: "./tests/global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // TASK-1977: report output must land somewhere .gitignore already covers.
  // 'test-artifacts/' is not ignored, so every E2E run left the worktree dirty —
  // and a dirty worktree is what forces release provenance to report dirty.
  reporter: [
    ["html", { outputFolder: "playwright-report/regression", open: "never" }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://127.0.0.1:5547",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Record video on failure */
    video: "retain-on-failure",

    // Browser-flow assertions exercise application behavior, not service-worker
    // activation timing. A waiting worker can trigger controllerchange and
    // reload the page in the middle of a context-menu action.
    serviceWorkers: "block",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
        // TASK-1457: Use saved auth state if available (from global-setup)
        ...(hasAuth ? { storageState: authFile } : {}),
      },
      testIgnore: "**/mobile/**/*.spec.ts",
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        ...(hasAuth ? { storageState: authFile } : {}),
      },
      testIgnore: "**/mobile/**/*.spec.ts",
    },

    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        ...(hasAuth ? { storageState: authFile } : {}),
      },
      testMatch: "**/mobile/**/*.spec.ts",
    },

    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 14 Pro Max"],
        ...(hasAuth ? { storageState: authFile } : {}),
      },
      testMatch: "**/mobile/**/*.spec.ts",
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Keep Playwright server startup minimal and deterministic.
    // `npm run dev` includes extra watchers and secret sync that can delay readiness.
    command: "npx vite --host 127.0.0.1 --port 5547 --strictPort",
    url: "http://127.0.0.1:5547",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
