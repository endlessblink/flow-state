import { test } from '@playwright/test'

test('Capture TEAL color option', async ({ page }) => {
  await page.goto('http://localhost:6006')
  await page.waitForSelector('[id="storybook-preview-iframe"]', { timeout: 15000 })
  
  // Click Design System
  await page.locator('text=Design System').first().click()
  await page.waitForTimeout(500)
  
  // Click Colors
  await page.locator('text=Colors').first().click()
  await page.waitForTimeout(500)
  
  // Click Brand Primary Decision
  await page.locator('text=Brand Primary Decision').first().click()
  await page.waitForTimeout(1000)
  
  // Click TEAL option story
  await page.locator('text=RECOMMENDED: TEAL').first().click()
  await page.waitForTimeout(2000)
  
  // Get iframe and take screenshot
  const iframe = page.frameLocator('[id="storybook-preview-iframe"]')
  await iframe.locator('body').screenshot({
    path: 'docs/screenshots/storybook-teal-option.png'
  })
  
  console.log('📸 TEAL option screenshot saved')
})

test('Capture BLUE color option', async ({ page }) => {
  await page.goto('http://localhost:6006')
  await page.waitForSelector('[id="storybook-preview-iframe"]', { timeout: 15000 })
  
  // Navigate to story
  await page.locator('text=Design System').first().click()
  await page.waitForTimeout(500)
  await page.locator('text=Colors').first().click()
  await page.waitForTimeout(500)
  await page.locator('text=Brand Primary Decision').first().click()
  await page.waitForTimeout(1000)
  
  // Click BLUE option story
  await page.locator('text=ALTERNATIVE: BLUE').first().click()
  await page.waitForTimeout(2000)
  
  // Get iframe and take screenshot
  const iframe = page.frameLocator('[id="storybook-preview-iframe"]')
  await iframe.locator('body').screenshot({
    path: 'docs/screenshots/storybook-blue-option.png'
  })
  
  console.log('📸 BLUE option screenshot saved')
})

test('Capture Side-by-Side comparison', async ({ page }) => {
  await page.goto('http://localhost:6006')
  await page.waitForSelector('[id="storybook-preview-iframe"]', { timeout: 15000 })
  
  // Navigate to story
  await page.locator('text=Design System').first().click()
  await page.waitForTimeout(500)
  await page.locator('text=Colors').first().click()
  await page.waitForTimeout(500)
  await page.locator('text=Brand Primary Decision').first().click()
  await page.waitForTimeout(1000)
  
  // Click comparison story
  await page.locator('text=Side-by-Side Comparison').first().click()
  await page.waitForTimeout(2000)
  
  // Get iframe and take screenshot
  const iframe = page.frameLocator('[id="storybook-preview-iframe"]')
  await iframe.locator('body').screenshot({
    path: 'docs/screenshots/storybook-comparison.png'
  })
  
  console.log('📸 Comparison screenshot saved')
})
