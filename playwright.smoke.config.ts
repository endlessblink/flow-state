import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * TASK-1823 — Production-build render smoke config.
 *
 * Unlike playwright.config.ts (which boots the Vite DEV server, runs global-setup,
 * and depends on Supabase auth), this config serves the REAL built bundle from
 * `dist/` via `vite preview` and runs ONE dependency-light spec that proves the
 * app actually mounts. This is the gate that catches the "Electron doesn't load"
 * white-screen / blank-canvas regression class before it ships.
 *
 * Invariants that keep it reliable:
 *   - NO globalSetup  → no Supabase service key, no seeding, no auth coupling.
 *   - Runs against dist/ → tests the exact artifact that ships to web + Electron.
 *   - Single chromium project → fast, deterministic, safe to block every deploy.
 *
 * Build the bundle first (the runner script scripts/verify-build-renders.sh does
 * this), then: `npx playwright test --config playwright.smoke.config.ts`.
 */

const PORT = Number(process.env.SMOKE_PORT ?? 5548)
const distIndex = path.resolve(process.cwd(), 'dist/index.html')

if (!fs.existsSync(distIndex)) {
  // Fail loud and early rather than smoke-testing a stale/absent bundle.
  throw new Error(
    `[smoke] dist/index.html not found at ${distIndex}. Build first: ` +
      `\`ELECTRON_BUILD=true npm run build\` (or run scripts/verify-build-renders.sh).`,
  )
}

export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/prod-build-render.spec.ts',
  // No global-setup on purpose — this gate must not depend on auth/Supabase.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'smoke-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Serve the production build exactly as shipped (base './' for Electron is
    // preview-compatible). --strictPort so a stale server never masks failures.
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
})
