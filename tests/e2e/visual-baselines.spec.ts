/**
 * Capture web baseline screenshots for visual regression.
 * Run: npm run test:e2e -- --grep "baseline" --project=chromium --workers=1
 */
import { test } from '../fixtures/auth'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_DIR = path.resolve(__dirname, '../visual/baseline')

if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true })

const VIEWS = [
  { route: '/#/', name: 'canvas' },
  { route: '/#/board', name: 'board' },
  { route: '/#/tasks', name: 'catalog' },
  { route: '/#/calendar', name: 'calendar' },
]

test.describe('Web Baseline Screenshots', () => {
  for (const view of VIEWS) {
    test(`capture ${view.name} baseline`, async ({ page }) => {
      await page.goto(view.route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      await page.screenshot({
        path: path.join(BASELINE_DIR, `web-${view.name}.png`),
        fullPage: false,
      })
    })
  }

  test('capture inbox baseline', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const inbox = page.locator('.unified-inbox-panel, .inbox-panel').first()
    if (await inbox.isVisible()) {
      await inbox.screenshot({ path: path.join(BASELINE_DIR, 'web-inbox.png') })
    }
  })
})
