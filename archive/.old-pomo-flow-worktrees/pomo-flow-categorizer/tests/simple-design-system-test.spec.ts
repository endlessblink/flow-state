import { test, expect } from '@playwright/test'

test('design system renders context menu buttons', async ({ page }) => {
  // Navigate to design system
  await page.goto('http://localhost:5546/#/design-system')

  // Wait for design system to load
  await page.waitForSelector('.design-system-gallery', { timeout: 10000 })

  // Click the Interactive tab
  await page.click('button:has-text("Interactive")')

  // Wait a bit for rendering
  await page.waitForTimeout(500)

  // Just check that buttons exist (with or without active class)
  const priorityButtons = page.locator('button.icon-btn')
  const menuItemButtons = page.locator('button.menu-item')

  // Count all buttons
  const priorityCount = await priorityButtons.count()
  const menuCount = await menuItemButtons.count()

  console.log(`Found ${priorityCount} priority icon buttons`)
  console.log(`Found ${menuCount} menu item buttons`)

  // Just verify some buttons exist
  expect(priorityCount).toBeGreaterThan(0)
  expect(menuCount).toBeGreaterThan(0)

  // Get HTML of first few buttons to see structure
  const firstPriority = await priorityButtons.first().innerHTML()
  const firstMenu = await menuItemButtons.first().innerHTML()

  console.log('First priority button HTML:', firstPriority.substring(0, 100))
  console.log('First menu button HTML:', firstMenu.substring(0, 100))

  // Take screenshot
  await page.screenshot({ path: 'design-system-interactive-section.png' })

  console.log('✓ Design system renders context menu buttons successfully')
})
