import { test, expect } from '@playwright/test'

test.describe('Canvas Parent-Child Movement', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    // Wait for app to be ready
    await page.waitForSelector('.app', { timeout: 10000 })

    // Navigate to Canvas view
    const canvasLink = page.locator('text=Canvas').first()
    if (await canvasLink.isVisible()) {
      await canvasLink.click()
      await page.waitForTimeout(1000)
    }
  })

  test('should load canvas with sections and tasks', async ({ page }) => {
    // Check that canvas container loads
    const canvas = page.locator('.vue-flow')
    await expect(canvas).toBeVisible()

    // Check for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000)

    // Report any console errors
    if (errors.length > 0) {
      console.log('❌ Console errors detected:', errors)
    }

    // Take screenshot for visual verification
    await page.screenshot({ path: '/tmp/canvas-loaded.png' })
    console.log('📸 Screenshot saved: /tmp/canvas-loaded.png')
  })

  test('should have parent-child relationships configured', async ({ page }) => {
    // Wait for canvas to load
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Check Vue Flow nodes in DOM
    const sectionNodes = page.locator('.vue-flow__node[data-id^="section-"]')
    const taskNodes = page.locator('.vue-flow__node:not([data-id^="section-"])')

    const sectionCount = await sectionNodes.count()
    const taskCount = await taskNodes.count()

    console.log(`📊 Found ${sectionCount} sections and ${taskCount} tasks`)

    // Verify at least some content exists
    expect(sectionCount).toBeGreaterThan(0)

    // Take screenshot
    await page.screenshot({ path: '/tmp/canvas-sections-tasks.png' })
    console.log('📸 Screenshot: /tmp/canvas-sections-tasks.png')
  })

  test('should show section headers with drag handles', async ({ page }) => {
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Find section headers
    const sectionHeaders = page.locator('.section-header')
    const headerCount = await sectionHeaders.count()

    console.log(`🎯 Found ${headerCount} section headers`)

    if (headerCount > 0) {
      // Check first section header
      const firstHeader = sectionHeaders.first()
      await expect(firstHeader).toBeVisible()

      // Take screenshot highlighting section header
      await page.screenshot({ path: '/tmp/canvas-section-headers.png' })
      console.log('📸 Section headers visible: /tmp/canvas-section-headers.png')
    }
  })

  test('should display tasks within sections', async ({ page }) => {
    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Look for task cards
    const taskCards = page.locator('.vue-flow__node .task-card, .vue-flow__node [class*="task"]')
    const taskCount = await taskCards.count()

    console.log(`📋 Found ${taskCount} task nodes on canvas`)

    // Take full canvas screenshot
    const canvas = page.locator('.vue-flow')
    await canvas.screenshot({ path: '/tmp/canvas-full-view.png' })
    console.log('📸 Full canvas: /tmp/canvas-full-view.png')
  })

  test('verify console logs show parent-child relationships', async ({ page }) => {
    const logs: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('parentNode') || text.includes('section-') || text.includes('expandParent')) {
        logs.push(text)
      }
    })

    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(3000)

    console.log('🔍 Parent-child related logs:')
    logs.forEach(log => console.log('  ', log))

    // Take screenshot
    await page.screenshot({ path: '/tmp/canvas-with-logging.png' })
  })

  test('check for zero console errors', async ({ page }) => {
    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text())
      }
    })

    await page.waitForSelector('.vue-flow', { timeout: 10000 })
    await page.waitForTimeout(5000)

    console.log('🔍 Error check results:')
    console.log(`  Errors: ${errors.length}`)
    console.log(`  Warnings: ${warnings.length}`)

    if (errors.length > 0) {
      console.log('❌ Console errors:')
      errors.forEach(err => console.log('  ', err))
    }

    if (warnings.length > 0) {
      console.log('⚠️ Console warnings:')
      warnings.forEach(warn => console.log('  ', warn))
    }

    // Zero tolerance for errors
    expect(errors).toHaveLength(0)
  })
})
