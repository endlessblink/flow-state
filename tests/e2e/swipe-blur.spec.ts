import { test, expect } from '@playwright/test'

test.describe('Mobile Today View - Swipe Blur', () => {
  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  })

  test('swiping task should blur content', async ({ page }) => {
    // Navigate to mobile today view
    await page.goto('http://localhost:5546/mobile/today')

    // Wait for tasks to load
    await page.waitForTimeout(2000)

    // Take screenshot before swipe
    await page.screenshot({ path: 'tests/e2e/screenshots/before-swipe.png' })

    // Find the first swipeable task item
    const taskItem = page.locator('.swipeable-task-item').first()

    if (await taskItem.count() === 0) {
      console.log('No tasks found in Today view')
      return
    }

    const box = await taskItem.boundingBox()
    if (!box) {
      console.log('Could not get task item bounding box')
      return
    }

    // Simulate swipe left (for delete)
    const startX = box.x + box.width - 20
    const startY = box.y + box.height / 2
    const endX = box.x + 50

    await page.mouse.move(startX, startY)
    await page.mouse.down()

    // Swipe in steps to trigger the gesture
    for (let x = startX; x > endX; x -= 20) {
      await page.mouse.move(x, startY)
      await page.waitForTimeout(16)
    }

    // Take screenshot during swipe (before mouse up)
    await page.screenshot({ path: 'tests/e2e/screenshots/during-swipe.png' })

    // Check if blur filter is applied
    const slotWrapper = page.locator('.swipeable-task-item .slot-wrapper').first()
    const filterStyle = await slotWrapper.evaluate(el => {
      return window.getComputedStyle(el).filter
    })

    console.log('Filter style during swipe:', filterStyle)

    // Check if dim overlay is visible
    const dimOverlay = page.locator('.swipeable-task-item .dim-overlay').first()
    const overlayExists = await dimOverlay.count() > 0
    console.log('Dim overlay exists:', overlayExists)

    if (overlayExists) {
      const bgColor = await dimOverlay.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor
      })
      console.log('Overlay background-color:', bgColor)
    }

    await page.mouse.up()

    // Take screenshot after swipe
    await page.screenshot({ path: 'tests/e2e/screenshots/after-swipe.png' })
  })
})
