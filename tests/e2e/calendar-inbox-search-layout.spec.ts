import { test, expect } from '../fixtures/auth'

test.describe('Calendar inbox search layout', () => {
  test('search control is centered and not clipped in the calendar inbox', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({ seen: true, version: 2 }))
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })

    await page.setViewportSize({ width: 1042, height: 660 })
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const panel = page.locator('.unified-inbox-panel').first()
    await expect(panel).toBeVisible({ timeout: 10000 })

    if (await panel.evaluate((el) => el.classList.contains('collapsed'))) {
      await panel.locator('.collapse-btn').click({ force: true })
      await expect(panel).not.toHaveClass(/collapsed/, { timeout: 5000 })
    }

    const searchRow = panel.locator('.search-toggle-row')
    const searchButton = panel.locator('.search-toggle-btn')
    const quickAddInput = panel.locator('.quick-add-input')

    await expect(searchRow).toBeVisible()
    await expect(searchButton).toBeVisible()
    await expect(quickAddInput).toBeVisible()

    const metrics = await panel.evaluate((panelEl) => {
      const searchButtonEl = panelEl.querySelector('.search-toggle-btn')
      const quickAddInputEl = panelEl.querySelector('.quick-add-input')

      if (!searchButtonEl || !quickAddInputEl) {
        throw new Error('Expected calendar inbox search and quick-add controls to render')
      }

      const panelRect = panelEl.getBoundingClientRect()
      const searchRect = searchButtonEl.getBoundingClientRect()
      const quickAddRect = quickAddInputEl.getBoundingClientRect()
      const panelCenter = panelRect.left + panelRect.width / 2
      const searchCenter = searchRect.left + searchRect.width / 2

      return {
        searchCenterOffset: Math.abs(searchCenter - panelCenter),
        searchClipped:
          searchRect.left < panelRect.left ||
          searchRect.right > panelRect.right,
        quickAddClipped:
          quickAddRect.left < panelRect.left ||
          quickAddRect.right > panelRect.right,
      }
    })

    expect(metrics.searchCenterOffset).toBeLessThanOrEqual(2)
    expect(metrics.searchClipped).toBe(false)
    expect(metrics.quickAddClipped).toBe(false)

    await searchButton.click()
    await expect(panel.locator('.search-input-row')).toBeVisible()

    const expandedMetrics = await panel.evaluate((panelEl) => {
      const searchInputWrapperEl = panelEl.querySelector('.search-input-wrapper')

      if (!searchInputWrapperEl) {
        throw new Error('Expected expanded search input to render')
      }

      const panelRect = panelEl.getBoundingClientRect()
      const inputRect = searchInputWrapperEl.getBoundingClientRect()

      return {
        inputClipped:
          inputRect.left < panelRect.left ||
          inputRect.right > panelRect.right,
      }
    })

    expect(expandedMetrics.inputClipped).toBe(false)
  })
})
