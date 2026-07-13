import { test, expect } from '../fixtures/auth'

test('TASK-1690: Canvas image node select, delete, lightbox', async ({ page }) => {
  // Inject test image into localStorage BEFORE navigating
  await page.goto('about:blank')
  await page.evaluate(() => {
    const origin = 'http://localhost:5546'
    // We need to be on the right origin to set localStorage
    return origin
  })

  // Navigate to app first to get on the right origin
  await page.goto('/#/canvas')
  await page.waitForTimeout(1000)

  // Inject a test image node into localStorage
  await page.evaluate(() => {
    const testImages = [{
      id: 'img-test-001',
      imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasCoAgBHhQMBf5LILQAAAABJRU5ErkJggg==',
      position: { x: 300, y: 300 },
      createdAt: new Date().toISOString(),
    }]
    localStorage.setItem('flowstate:canvas-images', JSON.stringify(testImages))
  })

  // Reload to pick up localStorage data
  await page.reload()
  await page.waitForTimeout(3000)

  const canvas = page.locator('.vue-flow')
  await expect(canvas).toBeVisible({ timeout: 10000 })

  // Check that image node is rendered
  const imageNode = page.locator('.vue-flow__node-imageNode')
  await expect(imageNode).toHaveCount(1)
  await page.screenshot({ path: '.dev/screenshots/canvas-image-rendered.png' })

  // --- Test 1: Click to select ---
  await imageNode.first().dispatchEvent('click')
  await page.waitForTimeout(500)

  await expect(imageNode.first()).toHaveClass(/selected/)

  await page.screenshot({ path: '.dev/screenshots/canvas-image-selected.png' })

  // --- Test 2: Double-click for lightbox ---
  const img = imageNode.first().locator('.node-image')
  await img.dispatchEvent('dblclick')
  await page.waitForTimeout(500)

  const lightbox = page.locator('.image-lightbox')
  await expect(lightbox).toBeVisible()
  await lightbox.click()
  await page.waitForTimeout(300)

  // --- Test 3: Select then Delete (goes through confirmation modal) ---
  // Click the node to select it
  await imageNode.first().dispatchEvent('click')
  await page.waitForTimeout(300)

  await page.keyboard.press('Delete')
  await page.waitForTimeout(500)

  // TASK-1722: Images now go through the same confirmation modal as tasks/groups
  const deleteModal = page.locator('[role="dialog"]').filter({ hasText: 'Delete' })
  await expect(deleteModal).toBeVisible()
  await deleteModal.getByRole('button', { name: 'Delete' }).click()
  await expect(imageNode).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const images = JSON.parse(localStorage.getItem('flowstate:canvas-images') || '[]') as Array<{ id: string }>
    return images.some(image => image.id === 'img-test-001')
  })).toBe(false)

  // --- Test 4: Ctrl+Z to undo delete ---
  // Click on canvas container to ensure focus for keyboard events
  await page.locator('.canvas-container').click({ position: { x: 50, y: 50 } })
  await page.waitForTimeout(300)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1000)

  await expect(imageNode).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => {
    const images = JSON.parse(localStorage.getItem('flowstate:canvas-images') || '[]') as Array<{ id: string }>
    return images.some(image => image.id === 'img-test-001')
  })).toBe(true)

  await page.screenshot({ path: '.dev/screenshots/canvas-image-after-undo.png' })

  // Redo must follow the same local-first deletion contract.
  await page.keyboard.press('Control+Shift+z')
  await expect(imageNode).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const images = JSON.parse(localStorage.getItem('flowstate:canvas-images') || '[]') as Array<{ id: string }>
    return images.some(image => image.id === 'img-test-001')
  })).toBe(false)

  // Clean up localStorage
  await page.evaluate(() => localStorage.removeItem('flowstate:canvas-images'))
})
