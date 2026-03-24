import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

test.describe('Morning Dashboard - Drag & Drop + Click-to-Assign', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any persisted morning visit so the dashboard shows
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('flowstate-last-morning')
      // Clear any Big 3 data from previous runs
      const today = new Date().toISOString().slice(0, 10)
      localStorage.removeItem(`flowstate-big3-${today}`)
    })
    // Navigate to morning dashboard
    await page.goto('/#/morning')
    await page.waitForTimeout(1000) // Let composables initialize
  })

  test('morning dashboard renders with task pool and empty drop zones', async ({ page }) => {
    // The Big 3 card should be visible
    await expect(page.getByText("Today's Big 3")).toBeVisible()

    // Drop zones should show placeholder text
    await expect(page.getByText('Top priority')).toBeVisible()
    await expect(page.getByText('Second focus')).toBeVisible()
    await expect(page.getByText('One more thing')).toBeVisible()

    // Task pool should have draggable cards
    const poolCards = page.locator('.pool-card')
    const cardCount = await poolCards.count()
    console.log(`[DRAG-TEST] Pool cards visible: ${cardCount}`)
    expect(cardCount).toBeGreaterThan(0)
  })

  test('click-to-assign fills the first empty slot', async ({ page }) => {
    // Get the first pool card's text
    const firstCard = page.locator('.pool-card').first()
    await expect(firstCard).toBeVisible()
    const taskTitle = await firstCard.locator('.pool-card-title').textContent()
    console.log(`[DRAG-TEST] Clicking task: "${taskTitle}"`)

    // Click the card to assign it
    await firstCard.click()
    await page.waitForTimeout(300)

    // First slot should now show the task title
    const slot1 = page.locator('.drop-zone--filled .zone-title, .zone-wrapper').first()
    const slotContent = await slot1.textContent()
    console.log(`[DRAG-TEST] Slot 1 after click: "${slotContent}"`)

    // Verify the slot got filled (either via filled class or the title appearing)
    const filledSlots = page.locator('.drop-zone--filled')
    const filledCount = await filledSlots.count()
    console.log(`[DRAG-TEST] Filled slots: ${filledCount}`)
    expect(filledCount).toBe(1)
  })

  test('click-to-assign fills slots in order (1, 2, 3)', async ({ page }) => {
    const poolCards = page.locator('.pool-card')
    const cardCount = await poolCards.count()
    const clickCount = Math.min(cardCount, 3)

    for (let i = 0; i < clickCount; i++) {
      const card = poolCards.nth(i)
      const title = await card.locator('.pool-card-title').textContent()
      console.log(`[DRAG-TEST] Click ${i + 1}: "${title}"`)
      await card.click()
      await page.waitForTimeout(200)
    }

    const filledSlots = page.locator('.drop-zone--filled')
    const filledCount = await filledSlots.count()
    console.log(`[DRAG-TEST] Filled slots after ${clickCount} clicks: ${filledCount}`)
    expect(filledCount).toBe(clickCount)
  })

  test('drag-and-drop: pool card to drop zone', async ({ page }) => {
    // Find source (first pool card) and target (first empty drop zone)
    const sourceCard = page.locator('.pool-card').first()
    await expect(sourceCard).toBeVisible()

    const taskTitle = await sourceCard.locator('.pool-card-title').textContent()
    console.log(`[DRAG-TEST] Dragging task: "${taskTitle}"`)

    // Get the first empty drop zone
    const dropZone = page.locator('.zone-drop-target, .zone-wrapper').first()
    await expect(dropZone).toBeVisible()

    // Get bounding boxes for precise coordinates
    const sourceBBox = await sourceCard.boundingBox()
    const targetBBox = await dropZone.boundingBox()

    if (!sourceBBox || !targetBBox) {
      console.log('[DRAG-TEST] ERROR: Could not get bounding boxes')
      console.log(`[DRAG-TEST] Source bbox: ${JSON.stringify(sourceBBox)}`)
      console.log(`[DRAG-TEST] Target bbox: ${JSON.stringify(targetBBox)}`)
      test.fail()
      return
    }

    console.log(`[DRAG-TEST] Source bbox: ${JSON.stringify(sourceBBox)}`)
    console.log(`[DRAG-TEST] Target bbox: ${JSON.stringify(targetBBox)}`)

    const sourceX = sourceBBox.x + sourceBBox.width / 2
    const sourceY = sourceBBox.y + sourceBBox.height / 2
    const targetX = targetBBox.x + targetBBox.width / 2
    const targetY = targetBBox.y + targetBBox.height / 2

    console.log(`[DRAG-TEST] Dragging from (${sourceX}, ${sourceY}) to (${targetX}, ${targetY})`)

    // Perform drag with intermediate steps (SortableJS needs gradual mouse movement)
    await page.mouse.move(sourceX, sourceY)
    await page.mouse.down()
    await page.waitForTimeout(200) // SortableJS needs delay to recognize drag

    // Move in steps to simulate real drag
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const ratio = i / steps
      const x = sourceX + (targetX - sourceX) * ratio
      const y = sourceY + (targetY - sourceY) * ratio
      await page.mouse.move(x, y)
      await page.waitForTimeout(30)
    }

    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(500)

    // Check if a slot got filled
    const filledSlots = page.locator('.drop-zone--filled')
    const filledCount = await filledSlots.count()
    console.log(`[DRAG-TEST] Filled slots after drag: ${filledCount}`)

    // Log DOM state for debugging
    const zoneWrappers = page.locator('.zone-wrapper')
    for (let i = 0; i < 3; i++) {
      const wrapper = zoneWrappers.nth(i)
      const html = await wrapper.innerHTML()
      console.log(`[DRAG-TEST] Zone ${i} HTML: ${html.slice(0, 200)}`)
    }

    expect(filledCount).toBeGreaterThanOrEqual(1)
  })

  test('clear button removes assigned task from slot', async ({ page }) => {
    // First assign a task via click
    const firstCard = page.locator('.pool-card').first()
    await firstCard.click()
    await page.waitForTimeout(300)

    // Verify it's filled
    let filledCount = await page.locator('.drop-zone--filled').count()
    expect(filledCount).toBe(1)

    // Click the clear button
    const clearBtn = page.locator('.zone-clear').first()
    await clearBtn.click()
    await page.waitForTimeout(300)

    // Verify it's empty again
    filledCount = await page.locator('.drop-zone--filled').count()
    expect(filledCount).toBe(0)
  })

  test('Start My Day button enables after all 3 slots filled', async ({ page }) => {
    const startBtn = page.getByText('Start My Day')
    await expect(startBtn).toBeDisabled()

    // Fill all 3 slots
    const poolCards = page.locator('.pool-card')
    for (let i = 0; i < 3; i++) {
      await poolCards.nth(i).click()
      await page.waitForTimeout(200)
    }

    // Button should now be enabled
    await expect(startBtn).toBeEnabled()
  })

  test('filters are cleared when leaving morning dashboard', async ({ page }) => {
    // Set a smart view filter while on morning dashboard
    await page.evaluate(() => {
      const stored = localStorage.getItem('flowstate-filters')
      const filters = stored ? JSON.parse(stored) : {}
      filters.activeSmartView = 'today'
      localStorage.setItem('flowstate-filters', JSON.stringify(filters))
    })

    // Navigate away (triggers onBeforeRouteLeave)
    await page.goto('/#/')
    await page.waitForTimeout(500)

    // Check that the filter was cleared
    const smartView = await page.evaluate(() => {
      const stored = localStorage.getItem('flowstate-filters')
      if (!stored) return null
      return JSON.parse(stored).activeSmartView
    })

    console.log(`[DRAG-TEST] Smart view after leaving morning: ${smartView}`)
    expect(smartView).toBeNull()
  })
})
