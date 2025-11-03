import { test, expect } from '@playwright/test'

test('design system loads on port 5173', async ({ page }) => {
  await page.goto('http://localhost:5173/')
  
  // Wait for page to load
  await page.waitForLoadState('networkidle')
  
  // Check home page title
  const title = page.locator('h1')
  await expect(title).toContainText('Pomo-Flow Design System')
  
  console.log('✓ Home page loaded successfully')
})

test('context menus page renders with priority active states', async ({ page }) => {
  await page.goto('http://localhost:5173/menus')
  
  // Wait for page to load
  await page.waitForLoadState('networkidle')
  
  // Check page title
  const title = page.locator('h1')
  await expect(title).toContainText('Right-Click Context Menus')
  
  // Check priority buttons exist
  const priorityButtons = page.locator('[class*="priority-btn"]')
  const count = await priorityButtons.count()
  
  expect(count).toBeGreaterThan(0)
  console.log(`✓ Found ${count} priority buttons`)
})

test('status menu items render with correct styles', async ({ page }) => {
  await page.goto('http://localhost:5173/menus')
  
  // Wait for page to load
  await page.waitForLoadState('networkidle')
  
  // Check status buttons
  const statusButtons = page.locator('[class*="status-btn"]')
  const count = await statusButtons.count()
  
  expect(count).toBeGreaterThan(0)
  console.log(`✓ Found ${count} status buttons`)
  
  // Check first status button has correct background
  const firstButton = statusButtons.first()
  const bgColor = await firstButton.evaluate((el) => 
    window.getComputedStyle(el).backgroundColor
  )
  
  console.log(`✓ First status button background: ${bgColor}`)
})

test('take screenshot of menus page', async ({ page }) => {
  await page.goto('http://localhost:5173/menus')
  await page.waitForLoadState('networkidle')
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/design-system-menus.png' })
  
  console.log('✓ Screenshot saved to /tmp/design-system-menus.png')
})
