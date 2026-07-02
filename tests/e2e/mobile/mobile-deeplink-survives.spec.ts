/**
 * BUG-1903 regression (user-repro shape): a mobile DEEP-LINK / reload must land
 * on the requested route, not get stomped to /tasks.
 *
 * Repro: MobileLayout.onMounted did `router.replace('/tasks')` when the route
 * was '/' — but main.ts mounts before router.isReady() resolves and the router
 * beforeEach awaits auth init, so the layout always mounted while the initial
 * route was still the unresolved '/'. Every mobile deep-link/reload (/#/timer,
 * /#/today, …) therefore landed on Tasks. Fix: await router.isReady() first.
 */

import { test, expect } from '../../fixtures/auth'
import { MOBILE_PHONE_OPTIONS, registerModalHandlers, suppressOnboarding } from './mobile-helpers'

test.describe('BUG-1903 — mobile deep-links survive the /tasks default', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
  })

  for (const { path, marker } of [
    { path: '/#/timer', marker: '.mobile-timer-view' },
    { path: '/#/today', marker: '.mobile-today' },
  ]) {
    test(`deep-link to ${path} stays on ${path} (not stomped to /tasks)`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // The target view must render — the bug redirected to /tasks, so the
      // marker never appeared and the hash became #/tasks.
      await expect(page.locator(marker)).toBeVisible({ timeout: 10000 })
      expect(page.url()).toContain(path.replace('/#', '#'))
    })
  }

  test('reloading a mobile route stays on that route', async ({ page }) => {
    await page.goto('/#/timer')
    await expect(page.locator('.mobile-timer-view')).toBeVisible({ timeout: 10000 })
    await page.reload()
    await page.waitForLoadState('networkidle')
    // The reload path is the exact repro: fresh mount at unresolved '/' → the
    // fix's router.isReady() gate must prevent the /tasks stomp.
    await expect(page.locator('.mobile-timer-view')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain('#/timer')
  })
})
