import { test, expect } from '@playwright/test'

test('inspect CSS rules and specificity', async ({ page }) => {
  await page.goto('http://localhost:5547')
  await page.waitForSelector('.content-header', { timeout: 10000 })

  // Check if dark theme class is applied
  const appElement = page.locator('.app')
  const hasDarkTheme = await appElement.evaluate((el) => {
    return el.classList.contains('dark-theme')
  })

  console.log('\n🎨 Theme Status:')
  console.log(`Dark theme active: ${hasDarkTheme}`)

  // Get ALL CSS rules applied to content-header border
  const borderStyles = await page.locator('.content-header').evaluate((el) => {
    const styles = window.getComputedStyle(el)

    return {
      borderBottom: styles.borderBottom,
      borderBottomColor: styles.borderBottomColor,
      borderBottomWidth: styles.borderBottomWidth,
      borderBottomStyle: styles.borderBottomStyle,
    }
  })

  console.log('\n📋 Content Header Border Styles:')
  console.log(JSON.stringify(borderStyles, null, 2))

  // Get sidebar border for comparison
  const sidebarBorder = await page.locator('.sidebar').evaluate((el) => {
    const styles = window.getComputedStyle(el)

    return {
      borderRight: styles.borderRight,
      borderRightColor: styles.borderRightColor,
    }
  })

  console.log('\n📋 Sidebar Border Styles:')
  console.log(JSON.stringify(sidebarBorder, null, 2))

  // Check computed CSS variable values
  const cssVariables = await page.locator('.content-header').evaluate((el) => {
    const styles = window.getComputedStyle(el)

    return {
      borderSubtle: styles.getPropertyValue('--border-subtle').trim(),
      borderMedium: styles.getPropertyValue('--border-medium').trim(),
    }
  })

  console.log('\n🎨 CSS Variables on .content-header:')
  console.log(JSON.stringify(cssVariables, null, 2))

  // Check what --border-subtle resolves to on the app root
  const rootVariables = await page.locator('.app').evaluate((el) => {
    const styles = window.getComputedStyle(el)

    return {
      borderSubtle: styles.getPropertyValue('--border-subtle').trim(),
    }
  })

  console.log('\n🎨 CSS Variables on .app (root):')
  console.log(JSON.stringify(rootVariables, null, 2))

  console.log('\n🔍 Analysis:')
  console.log(`Expected border color (sidebar): ${sidebarBorder.borderRightColor}`)
  console.log(`Actual border color (header): ${borderStyles.borderBottomColor}`)
  console.log(`Colors match: ${sidebarBorder.borderRightColor === borderStyles.borderBottomColor}`)
})
