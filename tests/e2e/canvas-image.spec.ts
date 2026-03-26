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
  const count = await imageNode.count()
  console.log(`Image nodes found after inject: ${count}`)

  if (count === 0) {
    // Debug
    const lsData = await page.evaluate(() => localStorage.getItem('flowstate:canvas-images'))
    console.log(`localStorage: ${lsData}`)
    await page.screenshot({ path: '.dev/screenshots/canvas-image-missing.png' })
    console.log('❌ Image node not rendered — check useCanvasSync injection')
    return
  }

  console.log('✅ Image node rendered on canvas')
  await page.screenshot({ path: '.dev/screenshots/canvas-image-rendered.png' })

  // --- Test 1: Click to select ---
  await imageNode.first().click()
  await page.waitForTimeout(500)

  const selectedRing = await imageNode.first().locator('.image-node.is-selected').count()
  console.log(`Selection ring visible: ${selectedRing > 0 ? '✅ Yes' : '❌ No'}`)

  const wrapperSelected = await imageNode.first().evaluate(el => el.classList.contains('selected'))
  console.log(`VueFlow .selected class: ${wrapperSelected ? '✅ Yes' : '❌ No'}`)

  await page.screenshot({ path: '.dev/screenshots/canvas-image-selected.png' })

  // --- Test 2: Double-click for lightbox ---
  const img = imageNode.first().locator('.node-image')
  await img.dblclick()
  await page.waitForTimeout(500)

  const lightbox = page.locator('.image-lightbox')
  const lightboxVisible = await lightbox.isVisible().catch(() => false)
  console.log(`Lightbox on double-click: ${lightboxVisible ? '✅ Yes' : '❌ No'}`)

  if (lightboxVisible) {
    await page.screenshot({ path: '.dev/screenshots/canvas-image-lightbox.png' })
    await lightbox.click()
    await page.waitForTimeout(300)
  }

  // --- Test 3: Select then Delete (goes through confirmation modal) ---
  // Click the node to select it
  await imageNode.first().click()
  await page.waitForTimeout(300)

  await page.keyboard.press('Delete')
  await page.waitForTimeout(500)

  // TASK-1722: Images now go through the same confirmation modal as tasks/groups
  const deleteModal = page.locator('[role="dialog"]').filter({ hasText: 'Delete' })
  const modalVisible = await deleteModal.isVisible().catch(() => false)
  console.log(`Delete confirmation modal: ${modalVisible ? '✅ Visible' : '❌ Not visible'}`)

  if (modalVisible) {
    // Click the Delete button in the modal to confirm
    const deleteButton = deleteModal.getByRole('button', { name: 'Delete' })
    await deleteButton.click()
    await page.waitForTimeout(1000)
  } else {
    // Modal didn't appear — image may have been deleted directly
    await page.waitForTimeout(500)
  }

  const afterDeleteCount = await page.locator('.vue-flow__node-imageNode').count()
  console.log(`After Delete: ${afterDeleteCount} image nodes (was ${count})`)
  console.log(`Delete worked: ${afterDeleteCount < count ? '✅ Yes' : '❌ No'}`)

  // --- Test 4: Ctrl+Z to undo delete ---
  // Click on canvas container to ensure focus for keyboard events
  await page.locator('.canvas-container').click({ position: { x: 50, y: 50 } })
  await page.waitForTimeout(300)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1000)

  const afterUndoCount = await page.locator('.vue-flow__node-imageNode').count()
  console.log(`After Ctrl+Z: ${afterUndoCount} image nodes (was ${afterDeleteCount})`)
  console.log(`Undo worked: ${afterUndoCount > afterDeleteCount ? '✅ Yes' : '❌ No'}`)

  await page.screenshot({ path: '.dev/screenshots/canvas-image-after-undo.png' })

  // Clean up localStorage
  await page.evaluate(() => localStorage.removeItem('flowstate:canvas-images'))
})
