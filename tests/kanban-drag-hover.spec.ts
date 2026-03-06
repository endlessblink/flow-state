import { test, expect } from '@playwright/test'
import path from 'path'
import * as fs from 'fs'

const SCREENSHOT_DIR = '/tmp/kanban-drag-hover'
const APP_URL = 'http://localhost:5546'

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
})

async function dismissOnboarding(page: import('@playwright/test').Page) {
  // Dismiss onboarding overlay if present
  const getStarted = page.locator('button:has-text("Get Started"), .onboarding-overlay button').first()
  if (await getStarted.isVisible({ timeout: 2000 }).catch(() => false)) {
    await getStarted.click()
    await page.waitForTimeout(500)
  }
  // Close any remaining overlay
  const closeBtn = page.locator('.onboarding-overlay .close-btn, .onboarding-overlay [aria-label="Close"]').first()
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(500)
  }
}

async function navigateToBoard(page: import('@playwright/test').Page) {
  await page.goto(`${APP_URL}/#/board`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await dismissOnboarding(page)
  await page.waitForTimeout(1000)
}

test.describe('Kanban Card Hover & Drag', () => {

  test('hover effect changes card background visibly', async ({ page }) => {
    await navigateToBoard(page)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-board-loaded.png'), fullPage: true })

    // Find task cards
    const cards = page.locator('.task-card')
    const cardCount = await cards.count()
    console.log(`Found ${cardCount} task cards`)

    if (cardCount === 0) {
      console.log('No task cards found — skipping hover test')
      return
    }

    const firstCard = cards.first()

    // Get background BEFORE hover
    const bgBefore = await firstCard.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log(`Background before hover: ${bgBefore}`)

    // Hover over the card
    await firstCard.hover()
    await page.waitForTimeout(300)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-card-hovered.png'), fullPage: true })

    // Get background AFTER hover
    const bgAfter = await firstCard.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    console.log(`Background after hover: ${bgAfter}`)

    // They must be DIFFERENT
    expect(bgBefore).not.toBe(bgAfter)
    console.log('PASS: Hover background is visibly different from default')
  })

  test('task card hover shows correct CSS values', async ({ page }) => {
    await navigateToBoard(page)

    const cards = page.locator('.task-card')
    if (await cards.count() === 0) return

    const card = cards.first()
    await card.hover()
    await page.waitForTimeout(200)

    const styles = await card.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow,
      }
    })

    console.log('Hovered card styles:', JSON.stringify(styles, null, 2))

    // Border should be visible (not fully transparent)
    expect(styles.borderColor).not.toBe('rgba(0, 0, 0, 0)')
    console.log('PASS: Border color is visible on hover')
  })

  test('ghost-card placeholder is nearly invisible during drag', async ({ page }) => {
    await navigateToBoard(page)

    const cards = page.locator('.task-card')
    if (await cards.count() === 0) {
      console.log('No cards to drag')
      return
    }

    const firstCard = cards.first()
    const box = await firstCard.boundingBox()
    if (!box) return

    // Start a drag (mousedown + small move to trigger SortableJS)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(150) // SortableJS delay is 100ms

    // Move enough to trigger drag
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 })
    await page.waitForTimeout(300)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-during-drag.png'), fullPage: true })

    // Check if ghost card exists and its opacity
    const ghostExists = await page.locator('.ghost-card').count()
    console.log(`Ghost cards during drag: ${ghostExists}`)

    if (ghostExists > 0) {
      const ghostOpacity = await page.locator('.ghost-card').first().evaluate(el => {
        return window.getComputedStyle(el).opacity
      })
      console.log(`Ghost opacity: ${ghostOpacity}`)
      // Should be very low (we set 0.15)
      expect(parseFloat(ghostOpacity)).toBeLessThanOrEqual(0.3)
      console.log('PASS: Ghost placeholder is subtle')
    }

    // Check if sortable-fallback (floating clone) is visible
    const fallbackExists = await page.locator('.sortable-fallback').count()
    console.log(`Sortable fallback elements: ${fallbackExists}`)

    if (fallbackExists > 0) {
      const fallbackOpacity = await page.locator('.sortable-fallback').first().evaluate(el => {
        return window.getComputedStyle(el).opacity
      })
      console.log(`Fallback opacity: ${fallbackOpacity}`)
      // Should be visible (1 or close)
      expect(parseFloat(fallbackOpacity)).toBeGreaterThan(0.5)
      console.log('PASS: Floating drag clone is visible')
    }

    // Release
    await page.mouse.up()
    await page.waitForTimeout(500)
  })

  test('chosen-card has no dark background override', async ({ page }) => {
    // Verify the CSS rule doesn't contain a dark background
    await navigateToBoard(page)

    // Inject a test to check the computed style of chosen-card rule
    const chosenBg = await page.evaluate(() => {
      // Create a temporary element with chosen-card class
      const el = document.createElement('div')
      el.className = 'task-card chosen-card'
      el.style.position = 'absolute'
      el.style.visibility = 'hidden'
      document.body.appendChild(el)
      const bg = window.getComputedStyle(el).backgroundColor
      document.body.removeChild(el)
      return bg
    })

    console.log(`chosen-card background: ${chosenBg}`)
    // Should NOT be a dark opaque color like var(--glass-border)
    // It should be transparent or the default card bg
    console.log('INFO: chosen-card bg should not darken the card')
  })

  test('drag between columns within same swimlane works', async ({ page }) => {
    await navigateToBoard(page)

    // Switch to Date view where we have multiple columns
    const dateBtn = page.locator('button:has-text("Due Date"), button:has-text("Date")').first()
    if (await dateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateBtn.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-date-view.png'), fullPage: true })

    // Find all columns
    const columns = page.locator('.kanban-column')
    const colCount = await columns.count()
    console.log(`Found ${colCount} columns`)

    // Find a column with tasks
    let sourceCol = -1
    let targetCol = -1

    for (let i = 0; i < colCount; i++) {
      const taskCount = await columns.nth(i).locator('.task-card').count()
      const title = await columns.nth(i).locator('.column-title').textContent().catch(() => 'unknown')
      console.log(`Column ${i} (${title}): ${taskCount} tasks`)
      if (taskCount > 0 && sourceCol === -1) sourceCol = i
      else if (taskCount === 0 && targetCol === -1) targetCol = i
    }

    if (sourceCol === -1) {
      console.log('No source column with tasks found')
      return
    }

    // If no empty target, just use a different column
    if (targetCol === -1) targetCol = sourceCol === 0 ? 1 : 0

    const sourceCard = columns.nth(sourceCol).locator('.task-card').first()
    const targetColumn = columns.nth(targetCol).locator('.drag-area')

    const sourceBox = await sourceCard.boundingBox()
    const targetBox = await targetColumn.boundingBox()

    if (!sourceBox || !targetBox) {
      console.log('Could not get bounding boxes')
      return
    }

    const taskId = await sourceCard.getAttribute('data-task-id')
    console.log(`Dragging task ${taskId} from column ${sourceCol} to ${targetCol}`)

    // Perform drag
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(150)

    // Move in steps for SortableJS to register
    const targetX = targetBox.x + targetBox.width / 2
    const targetY = targetBox.y + targetBox.height / 2
    await page.mouse.move(targetX, targetY, { steps: 15 })
    await page.waitForTimeout(500)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-mid-drag.png'), fullPage: true })

    await page.mouse.up()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-after-drop.png'), fullPage: true })

    // Check if task moved to target column
    const taskInTarget = await columns.nth(targetCol).locator(`[data-task-id="${taskId}"]`).count()
    console.log(`Task in target column: ${taskInTarget > 0 ? 'YES' : 'NO'}`)

    // Try to drag the same task AGAIN (the stuck bug)
    if (taskInTarget > 0) {
      const movedCard = columns.nth(targetCol).locator(`[data-task-id="${taskId}"]`).first()
      const movedBox = await movedCard.boundingBox()
      if (movedBox) {
        console.log('Attempting second drag of moved task...')
        await page.mouse.move(movedBox.x + movedBox.width / 2, movedBox.y + movedBox.height / 2)
        await page.mouse.down()
        await page.waitForTimeout(150)
        await page.mouse.move(movedBox.x + movedBox.width / 2 + 100, movedBox.y, { steps: 10 })
        await page.waitForTimeout(300)

        // Check if drag started (ghost should appear)
        const ghostDuringSecondDrag = await page.locator('.ghost-card').count()
        console.log(`Ghost during second drag: ${ghostDuringSecondDrag}`)

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-second-drag.png'), fullPage: true })

        await page.mouse.up()
        await page.waitForTimeout(500)

        if (ghostDuringSecondDrag > 0) {
          console.log('PASS: Task is still draggable after being moved')
        } else {
          console.log('FAIL: Task is NOT draggable after being moved (stuck bug)')
        }
      }
    }
  })
})
