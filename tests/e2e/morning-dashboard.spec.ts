import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'

test.describe('Morning Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure wizard flags are set in localStorage (global-setup saves them in storageState,
    // but re-set as safety net in case storageState didn't capture them properly)
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })

    // Navigate to morning dashboard
    await page.goto('/#/morning')

    // Safety: dismiss any wizard overlays that might still appear
    const skipBtn = page.locator('text=Skip for now')
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // Wait for task store to load from DB (auth + DB fetch is async)
    await page.waitForFunction(() => {
      return document.querySelectorAll('.pool-card').length > 0
    }, { timeout: 15000 }).catch(() => {
      // Tasks may genuinely be empty in some test scenarios
    })
  })

  test('renders inline (no overlay) with sidebar visible', async ({ page }) => {
    // Morning dashboard should be inline — sidebar and header remain visible
    const sidebar = page.locator('nav[aria-label="Main navigation"]')
    await expect(sidebar).toBeVisible()

    // No Teleport overlay (no fixed full-screen element)
    const overlay = page.locator('.morning-overlay')
    await expect(overlay).toHaveCount(0)

    // Morning content should be visible inline
    const greeting = page.locator('h1:has-text("Good")')
    await expect(greeting).toBeVisible()

    // Big Three card visible
    const bigThree = page.locator('h2:has-text("Today\'s Big 3")')
    await expect(bigThree).toBeVisible()
  })

  test('task pool shows non-done tasks grouped by category', async ({ page }) => {
    // Should see pool cards for non-done tasks (6 out of 8 seed tasks are non-done)
    const poolCards = page.locator('.pool-card')
    const count = await poolCards.count()
    expect(count).toBeGreaterThan(0)

    // Should have section headers
    const sectionHeaders = page.locator('.section-label')
    const headerCount = await sectionHeaders.count()
    expect(headerCount).toBeGreaterThan(0)
  })

  test('dismiss button navigates to home', async ({ page }) => {
    const dismissBtn = page.locator('button[aria-label="Close morning dashboard"]')
    await expect(dismissBtn).toBeVisible()

    await dismissBtn.click()
    await page.waitForURL(/#\/$/)
    expect(page.url()).toMatch(/#\/$/)
  })

  test('search filters tasks across all non-done tasks', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search tasks..."]')
    await expect(searchInput).toBeVisible()

    // Search for a known task
    await searchInput.fill('landing')

    // Should show search results
    const poolCards = page.locator('.pool-card')
    await expect(poolCards.first()).toBeVisible({ timeout: 3000 })

    // The "Design landing page" task should appear
    await expect(page.locator('.pool-card-title:has-text("Design landing page")')).toBeVisible()

    // Clear search
    await searchInput.fill('')

    // Should revert to grouped view
    const sectionHeaders = page.locator('.section-label')
    const headerCount = await sectionHeaders.count()
    expect(headerCount).toBeGreaterThan(0)
  })

  test('task creation adds a new task to the pool', async ({ page }) => {
    const createInput = page.locator('input[placeholder="Create a new task..."]')
    await expect(createInput).toBeVisible()

    const addBtn = page.locator('button:has-text("Add")')

    // Button should be disabled when input is empty
    await expect(addBtn).toBeDisabled()

    // Type a new task
    await createInput.fill('My morning test task')
    await expect(addBtn).toBeEnabled()

    // Create the task
    await addBtn.click()

    // Input should clear
    await expect(createInput).toHaveValue('')

    // Search for the new task to verify it was created
    const searchInput = page.locator('input[placeholder="Search tasks..."]')
    await searchInput.fill('morning test task')
    await page.waitForTimeout(500)

    const resultCard = page.locator('.pool-card-title:has-text("My morning test task")')
    await expect(resultCard).toBeVisible({ timeout: 5000 })
  })

  test('right-click on pool card shows context menu', async ({ page }) => {
    // Wait for at least one pool card
    const firstCard = page.locator('.pool-card').first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })

    // Right-click
    await firstCard.click({ button: 'right' })

    // TaskContextMenu should appear (it uses .context-menu class)
    const contextMenu = page.locator('.context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    // Should have Edit option
    await expect(page.locator('.menu-text:has-text("Edit")')).toBeVisible()

    // Close by clicking elsewhere
    await page.mouse.click(10, 10)
    await expect(contextMenu).not.toBeVisible({ timeout: 2000 })
  })

  test('drop zones show empty placeholders', async ({ page }) => {
    // Three drop zones with placeholder text
    await expect(page.locator('text=Drop your top priority')).toBeVisible()
    await expect(page.locator('text=Drop your second focus')).toBeVisible()
    await expect(page.locator('text=Drop one more thing')).toBeVisible()
  })

  test('Start My Day button is disabled until all 3 slots filled', async ({ page }) => {
    const startBtn = page.locator('button:has-text("Start My Day")')
    await expect(startBtn).toBeDisabled()
  })

  test('exit preserves tasks unchanged', async ({ page }) => {
    // Get a task title before dismissing
    const firstCard = page.locator('.pool-card').first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })
    const taskTitle = await firstCard.locator('.pool-card-title').textContent()

    // Dismiss
    await page.locator('button[aria-label="Close morning dashboard"]').click()
    await page.waitForURL(/#\/$/)

    // Navigate back
    await page.goto('/#/morning')
    await page.waitForTimeout(2000)

    // Task should still be in pool
    if (taskTitle) {
      const searchInput = page.locator('input[placeholder="Search tasks..."]')
      await searchInput.fill(taskTitle.trim())
      await page.waitForTimeout(500)
      const resultCard = page.locator(`.pool-card-title:has-text("${taskTitle.trim()}")`)
      await expect(resultCard).toBeVisible({ timeout: 5000 })
    }
  })
})
