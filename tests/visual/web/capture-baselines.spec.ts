/**
 * Capture web baseline screenshots for visual regression.
 * Run: npx playwright test tests/visual/web/ --project=chromium
 *
 * Saves screenshots to tests/visual/baseline/web-{view}.png
 */
import { test, expect } from '../../fixtures/auth'
import path from 'path'

const BASELINE_DIR = path.resolve(__dirname, '../baseline')
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
      await page.waitForTimeout(2000) // Let animations settle

      await page.screenshot({
        path: path.join(BASELINE_DIR, `web-${view.name}.png`),
        fullPage: false,
      })
    })
  }

  test('capture inbox panel baseline', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Focus on the inbox panel area
    const inbox = page.locator('.unified-inbox-panel, .inbox-panel').first()
    if (await inbox.isVisible()) {
      await inbox.screenshot({
        path: path.join(BASELINE_DIR, 'web-inbox.png'),
      })
    }
  })
})
