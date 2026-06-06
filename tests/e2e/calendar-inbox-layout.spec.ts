import { test, expect } from '../fixtures/auth'

test.describe('Calendar inbox layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  test('renders the inbox as an integrated calendar side rail', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')

    const inbox = page.locator('.unified-inbox-panel.is-calendar-side').first()
    await expect(inbox).toBeVisible({ timeout: 10000 })

    const styles = await inbox.evaluate((element) => {
      const computed = window.getComputedStyle(element)
      return {
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        width: element.getBoundingClientRect().width,
        borderTopWidth: computed.borderTopWidth,
        borderRightWidth: computed.borderRightWidth,
        borderBottomWidth: computed.borderBottomWidth,
        borderLeftWidth: computed.borderLeftWidth
      }
    })

    expect(styles.borderRadius).toBe('0px')
    expect(styles.boxShadow).toBe('none')
    expect(styles.width).toBeGreaterThanOrEqual(300)
    expect(styles.width).toBeLessThanOrEqual(340)
    expect(styles.borderTopWidth).toBe('0px')
    expect(styles.borderBottomWidth).toBe('0px')
    expect(
      styles.borderRightWidth === '1px' || styles.borderLeftWidth === '1px'
    ).toBe(true)
  })
})
