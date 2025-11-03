import { test, expect } from '@playwright/test'

test('inspect navigation and sidebar border alignment', async ({ page }) => {
  await page.goto('http://localhost:5547')
  await page.waitForSelector('.content-header', { timeout: 10000 })

  // Get sidebar measurements
  const sidebar = page.locator('.sidebar')
  const sidebarMeasurements = await sidebar.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return {
      width: rect.width,
      right: rect.right,
      borderRight: styles.borderRight,
      borderRightColor: styles.borderRightColor,
      borderRightWidth: styles.borderRightWidth,
    }
  })

  console.log('\n📐 Sidebar Measurements:')
  console.log(JSON.stringify(sidebarMeasurements, null, 2))

  // Get content header measurements
  const contentHeader = page.locator('.content-header')
  const headerMeasurements = await contentHeader.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      borderBottom: styles.borderBottom,
      borderBottomColor: styles.borderBottomColor,
      borderBottomWidth: styles.borderBottomWidth,
      marginLeft: styles.marginLeft,
      marginRight: styles.marginRight,
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
    }
  })

  console.log('\n📐 Content Header Measurements:')
  console.log(JSON.stringify(headerMeasurements, null, 2))

  // Get main-content measurements to understand the offset
  const mainContent = page.locator('.main-content')
  const mainContentMeasurements = await mainContent.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    return {
      left: rect.left,
      paddingLeft: styles.paddingLeft,
      paddingRight: styles.paddingRight,
    }
  })

  console.log('\n📐 Main Content Measurements:')
  console.log(JSON.stringify(mainContentMeasurements, null, 2))

  // Calculate alignment
  console.log('\n🔍 Border Alignment Analysis:')
  console.log(`Sidebar right edge: ${sidebarMeasurements.right}px`)
  console.log(`Content header left edge: ${headerMeasurements.left}px`)
  console.log(`Main content left edge: ${mainContentMeasurements.left}px`)
  console.log(`Gap between sidebar and header: ${headerMeasurements.left - sidebarMeasurements.right}px`)

  console.log('\n🎨 Border Colors:')
  console.log(`Sidebar border: ${sidebarMeasurements.borderRightColor}`)
  console.log(`Header border: ${headerMeasurements.borderBottomColor}`)
  console.log(`Colors match: ${sidebarMeasurements.borderRightColor === headerMeasurements.borderBottomColor}`)

  // Take screenshot highlighting the problem area
  await page.screenshot({
    path: 'tests/screenshots/border-alignment.png',
    fullPage: false
  })

  console.log('\n✅ Screenshot saved to tests/screenshots/border-alignment.png')
})
