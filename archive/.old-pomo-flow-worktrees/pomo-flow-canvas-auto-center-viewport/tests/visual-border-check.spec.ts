import { test, expect } from '@playwright/test'

test('visual border alignment check with screenshot', async ({ page }) => {
  await page.goto('http://localhost:5546')
  await page.waitForSelector('.content-header', { timeout: 10000 })

  // Zoom in on the exact area where borders should meet
  const sidebar = page.locator('.sidebar')
  const contentHeader = page.locator('.content-header')

  // Get the exact position where borders meet
  const sidebarBox = await sidebar.boundingBox()
  const headerBox = await contentHeader.boundingBox()

  if (!sidebarBox || !headerBox) {
    throw new Error('Could not get element positions')
  }

  // Take a screenshot of the junction area
  await page.screenshot({
    path: 'tests/screenshots/border-junction.png',
    clip: {
      x: sidebarBox.x + sidebarBox.width - 50, // 50px before sidebar edge
      y: headerBox.y - 10, // 10px above header
      width: 100, // Show 50px on each side
      height: 50, // Show border area
    }
  })

  // Also take a full screenshot for context
  await page.screenshot({
    path: 'tests/screenshots/full-view.png',
    fullPage: false
  })

  // Get actual computed styles
  const sidebarBorder = await sidebar.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return {
      borderRight: styles.borderRight,
      borderRightColor: styles.borderRightColor,
    }
  })

  const headerBorder = await contentHeader.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return {
      borderBottom: styles.borderBottom,
      borderBottomColor: styles.borderBottomColor,
    }
  })

  console.log('\n🔍 ACTUAL BROWSER RENDERING:')
  console.log('Sidebar border:', sidebarBorder.borderRight)
  console.log('Header border:', headerBorder.borderBottom)
  console.log('\nSidebar right edge:', sidebarBox.x + sidebarBox.width)
  console.log('Header left edge:', headerBox.x)
  console.log('Gap:', headerBox.x - (sidebarBox.x + sidebarBox.width))

  console.log('\n📸 Screenshots saved:')
  console.log('- tests/screenshots/border-junction.png (zoomed on junction)')
  console.log('- tests/screenshots/full-view.png (full context)')
})
