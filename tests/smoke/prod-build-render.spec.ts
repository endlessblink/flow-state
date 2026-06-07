/**
 * TASK-1823 — Production-build render smoke test ("does the app actually load?").
 *
 * WHY THIS EXISTS (the recurring "Electron doesn't load" / white-screen class):
 *   Every other test in this repo runs against the Vite DEV server (`npx vite`).
 *   The dev server does NOT exercise the production bundle that actually ships to
 *   the web PWA and — via `dist/index.html` loaded over file:// — to the Electron
 *   desktop app. Two whole failure classes therefore ship UNDETECTED:
 *     1. A used-but-unimported symbol (BUG-1796): `npm run build` (esbuild) does
 *        not type-check, so a ReferenceError can abort mount/sync at runtime only.
 *     2. Any runtime throw during app bootstrap (bad dynamic import, chunk load
 *        failure, env-shape mismatch, top-level error in a store init) that leaves
 *        the static `#fs-loader` spinner on screen forever = blank/white screen.
 *
 * HOW IT CATCHES THEM:
 *   This spec runs against the REAL built bundle (served by `vite preview` over
 *   the freshly produced `dist/`, see playwright.smoke.config.ts). The static
 *   `#fs-loader` lives in index.html *inside* `#app`; Vue removes it only when it
 *   successfully mounts and replaces `#app`'s content. So:
 *     - loader detaches  → Vue mounted → app is NOT blank.
 *     - loader stuck      → mount threw → blank screen → THIS TEST FAILS.
 *   It also fails on any uncaught pageerror or fatal console error during boot.
 *
 * DELIBERATELY AUTH-FREE: mount happens before Supabase/auth resolve, so this
 * needs no service-role key, no seeded data, and no global-setup. A logged-out
 * app still mounts (it renders a login/loading view) — that is a SUCCESSFUL render.
 * Keeping it dependency-light is what makes it reliable enough to gate every deploy.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test'

// Console/error text that means the bundle is fundamentally broken at runtime.
// Kept narrow on purpose: we want zero false positives so this gate is never
// disabled "because it's flaky". Vue warnings, network 401/403 (logged-out),
// and Supabase fetch failures are NOT fatal — the app still renders.
const FATAL_PATTERNS: RegExp[] = [
  /is not defined/i,                       // ReferenceError (the BUG-1796 class)
  /Cannot access '.*' before initialization/i,
  /Cannot read propert(y|ies) of undefined \(reading/i, // only if it bubbles to console.error
  /Failed to fetch dynamically imported module/i, // broken chunk / bad import path
  /ChunkLoadError/i,
  /Unexpected token/i,                     // syntax error in shipped JS
  /Unexpected end of input/i,
  /SyntaxError/i,
  /Importing a module script failed/i,     // Electron file:// module load failure
]

// Routes that have historically gone blank independently of the shell.
// '' = the default landing route. Canvas is included because the
// undefined-symbol sync bug (BUG-1796) blanked the canvas specifically.
const ROUTES = ['', '#/board', '#/canvas', '#/calendar']

function isFatal(text: string): boolean {
  return FATAL_PATTERNS.some((re) => re.test(text))
}

test.describe('Production build renders (blank-screen guard)', () => {
  for (const route of ROUTES) {
    const label = route || '/(default)'
    test(`mounts without blank screen or fatal error: ${label}`, async ({ page }) => {
      const fatal: string[] = []

      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error' && isFatal(msg.text())) {
          fatal.push(`[console.error] ${msg.text()}`)
        }
      })
      page.on('pageerror', (err) => {
        // Any uncaught exception during bootstrap is fatal by definition.
        fatal.push(`[pageerror] ${err.message}`)
      })

      await page.goto(`/${route}`, { waitUntil: 'load' })

      // PRIMARY SIGNAL: the static index.html loader must be gone, which only
      // happens when Vue actually mounts. If mount throws, #fs-loader stays
      // forever — that is exactly the "Electron doesn't load" white screen.
      await expect(
        page.locator('#fs-loader'),
        'app never mounted — static #fs-loader spinner is still present (blank/white screen). ' +
          'Vue threw during bootstrap; check console output above and run `npm run type-check`.',
      ).toHaveCount(0, { timeout: 20_000 })

      // SECONDARY SIGNAL: #app has real rendered content (not an empty shell).
      const appChildCount = await page.locator('#app > *').count()
      expect(
        appChildCount,
        '#app mounted but rendered no content — empty root after Vue takeover.',
      ).toBeGreaterThan(0)

      // Give late async bootstrap (store init, dynamic imports) a beat to throw.
      await page.waitForTimeout(1500)

      expect(
        fatal,
        `Fatal runtime error(s) during boot of "${label}":\n${fatal.join('\n')}`,
      ).toEqual([])
    })
  }
})
