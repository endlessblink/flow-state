/**
 * BUG-1902 regression (user-repro shape): the canvas must actually RESTORE the
 * saved viewport on startup.
 *
 * Before the fix, NO code ever called Vue Flow setViewport — the saved value
 * only rode the one-shot :default-viewport, which is captured before the async
 * loadSavedViewport() resolves, so the canvas always opened at the origin
 * (probe-proven: transform stayed `translate(0px, 0px) scale(1)` regardless of
 * the persisted viewport).
 */

import { test, expect } from '../fixtures/auth'

test('canvas restores the saved viewport on reload (BUG-1902)', async ({ page }) => {
  await page.goto('/#/canvas')
  await page.waitForSelector('.vue-flow__pane', { timeout: 30000 })
  await page.waitForTimeout(2000)

  // Persist a distinctive, sane viewport through the store (writes localStorage
  // + debounced cloud copy — same path a real pan/zoom uses)
  await page.evaluate(() => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { setViewport: (x: number, y: number, z: number) => void }> } } } } } }
    root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.setViewport(-321, -123, 0.8)
  })
  // Let the debounced cloud save land so reload restores from either store
  await page.waitForTimeout(3000)

  await page.reload()
  await page.waitForSelector('.vue-flow__pane', { timeout: 30000 })

  await expect
    .poll(async () =>
      page.evaluate(() =>
        (document.querySelector('.vue-flow__transformationpane') as HTMLElement)?.style.transform || ''
      ),
    { timeout: 15000, message: 'saved viewport was never applied — canvas reopened at the origin (BUG-1902)' })
    .toContain('translate(-321px, -123px)')
})
