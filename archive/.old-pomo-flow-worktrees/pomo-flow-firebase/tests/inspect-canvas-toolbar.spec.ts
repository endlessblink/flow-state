import { test, expect } from '@playwright/test'

test('inspect canvas toolbar alignment and spacing', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5547')

  // Wait for app to load - wait for navigation tabs
  await page.waitForSelector('text=Canvas', { timeout: 10000 })

  // Navigate to Canvas view
  await page.click('text=Canvas')

  // Wait for canvas toolbar to appear
  await page.waitForSelector('.canvas-controls', { timeout: 5000 })

  // Get the toolbar element
  const toolbar = page.locator('.canvas-controls')

  // Get computed styles and measurements
  const measurements = await toolbar.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return {
      // Position
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,

      // Computed styles
      position: styles.position,
      insetInlineStart: styles.insetInlineStart,
      padding: styles.padding,
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
      display: styles.display,
      flexDirection: styles.flexDirection,
      alignItems: styles.alignItems,
      justifyContent: styles.justifyContent,
      gap: styles.gap
    }
  })

  console.log('📐 Canvas Toolbar Measurements:')
  console.log(JSON.stringify(measurements, null, 2))

  // Get control-group measurements
  const controlGroups = page.locator('.control-group')
  const groupCount = await controlGroups.count()

  for (let i = 0; i < Math.min(groupCount, 3); i++) {
    const group = controlGroups.nth(i)
    const groupMeasurements = await group.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()

      return {
        width: rect.width,
        display: styles.display,
        justifyContent: styles.justifyContent,
        gap: styles.gap,
        alignItems: styles.alignItems
      }
    })

    console.log(`\n📋 Control Group ${i + 1}:`)
    console.log(JSON.stringify(groupMeasurements, null, 2))
  }

  // Take screenshot
  await page.screenshot({
    path: '.claude/docs/debug/canvas-toolbar-playwright.png',
    fullPage: false
  })

  console.log('\n✅ Screenshot saved to .claude/docs/debug/canvas-toolbar-playwright.png')

  // Print analysis
  console.log('\n🔍 Analysis:')
  console.log(`- Toolbar left position: ${measurements.left}px`)
  console.log(`- Expected left position: 16px (var(--space-4))`)
  console.log(`- Difference: ${measurements.left - 16}px`)
  console.log(`- Toolbar padding: ${measurements.padding}`)
  console.log(`- Align items: ${measurements.alignItems}`)
})
