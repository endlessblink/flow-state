import { test, expect } from '@playwright/test'

test('Capture color comparison from Storybook', async ({ page }) => {
  // Navigate to Storybook
  await page.goto('http://localhost:6006')
  
  // Wait for Storybook to load
  await page.waitForSelector('[id="storybook-preview-iframe"]', { timeout: 15000 })
  
  // Wait a bit for stories to load
  await page.waitForTimeout(3000)
  
  // Try to navigate to the Design System colors story
  // Click on "Design System" in sidebar if it exists
  const designSystemLink = page.locator('text=Design System').first()
  if (await designSystemLink.isVisible({ timeout: 5000 })) {
    await designSystemLink.click()
    await page.waitForTimeout(1000)
    
    // Click on Colors
    const colorsLink = page.locator('text=Colors').first()
    if (await colorsLink.isVisible({ timeout: 5000 })) {
      await colorsLink.click()
      await page.waitForTimeout(1000)
    }
  }
  
  // Take full page screenshot
  await page.screenshot({
    path: 'docs/screenshots/storybook-landing.png',
    fullPage: false
  })
  
  console.log('📸 Screenshot saved: docs/screenshots/storybook-landing.png')
})
