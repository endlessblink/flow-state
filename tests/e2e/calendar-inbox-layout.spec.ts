import { test, expect } from '../fixtures/auth'

test.describe('Calendar inbox layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  test('renders the dedicated calendar inbox instead of the canvas inbox shell', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')

    const inbox = page.locator('.calendar-inbox-panel').first()
    await expect(inbox).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.unified-inbox-panel')).toHaveCount(0)

    const styles = await inbox.evaluate((element) => {
      const computed = window.getComputedStyle(element)
      return {
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        width: element.getBoundingClientRect().width,
        marginTop: computed.marginTop
      }
    })

    expect(styles.borderRadius).not.toBe('0px')
    expect(styles.boxShadow).not.toBe('none')
    expect(styles.width).toBeGreaterThanOrEqual(300)
    expect(styles.width).toBeLessThanOrEqual(340)
    expect(styles.marginTop).not.toBe('0px')
  })
})
