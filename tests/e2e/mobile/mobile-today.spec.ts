import { test, expect } from '../../fixtures/auth'
import {
  MOBILE_PHONE_OPTIONS,
  registerModalHandlers,
  suppressOnboarding,
  dismissBlockingModals,
} from './mobile-helpers'

test.describe('Mobile Today View', () => {
  test.use(MOBILE_PHONE_OPTIONS)

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page)
    await suppressOnboarding(page)
    // Suppress swipe hint so it never blocks assertions
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-today-swipe-hint-dismissed', 'true')
    })
    // Navigate to inbox first to let auth/workspace initialize, then go to today
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await dismissBlockingModals(page)
    await expect(page.locator('.mobile-layout')).toBeVisible({ timeout: 10000 })
    // Now navigate to today view
    await page.goto('/#/today')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.mobile-today')).toBeVisible({ timeout: 10000 })
  })

  // 1. Renders date heading with the day name
  test('renders today view with date heading', async ({ page }) => {
    const heading = page.locator('.date-display h2')
    await expect(heading).toBeVisible()

    // The heading should be a day-of-week name (localised, so check non-empty)
    const text = await heading.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)

    // Sanity: it should be one of the seven English day names
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    expect(days).toContain(text?.trim())
  })

  // 2. Shows a full human-readable date string
  test('shows full date string', async ({ page }) => {
    const fullDate = page.locator('.full-date')
    await expect(fullDate).toBeVisible()

    const text = await fullDate.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)

    // Formatted as "Month D, YYYY" — check it contains the current year
    const currentYear = new Date().getFullYear().toString()
    expect(text).toContain(currentYear)
  })

  // 3. Displays task count badge or empty state (mutually exclusive)
  test('displays task count badge or empty state', async ({ page }) => {
    const taskCount = page.locator('.task-count')
    await expect(taskCount).toBeVisible()

    const countText = await taskCount.textContent()
    // Should contain a number followed by "tasks"
    expect(countText).toMatch(/\d+\s+tasks?/)

    const count = parseInt(countText?.match(/\d+/)?.[0] ?? '0', 10)

    if (count === 0) {
      // Empty state must be visible when there are no tasks
      await expect(page.locator('.empty-state')).toBeVisible()
      await expect.soft(page.locator('.empty-state h3')).toContainText(/All clear|No matching/)
    } else {
      // At least one time-section should be rendered
      await expect(page.locator('.time-section').first()).toBeVisible()
    }
  })

  // 4. Filter row contains exactly three filter buttons
  test('filter buttons are visible in filter row', async ({ page }) => {
    const filterRow = page.locator('.filter-row')
    await expect(filterRow).toBeVisible()

    const filterBtns = filterRow.locator('.filter-btn')
    const count = await filterBtns.count()
    expect(count).toBe(3)

    // Each button should be visible
    for (let i = 0; i < count; i++) {
      await expect.soft(filterBtns.nth(i)).toBeVisible()
    }
  })

  // 5. Clicking a filter button opens its dropdown menu
  test('clicking a filter button opens dropdown menu', async ({ page }) => {
    // Click the first filter button (Project)
    const firstFilterBtn = page.locator('.filter-row .filter-btn').first()
    await expect(firstFilterBtn).toBeVisible()
    await firstFilterBtn.click()

    // A dropdown should now be visible
    const dropdown = page.locator('.filter-dropdown-wrapper .dropdown-menu').first()
    await expect(dropdown).toBeVisible({ timeout: 3000 })

    // Dropdown should have at least one item ("All Projects" is always present)
    const items = dropdown.locator('.dropdown-item')
    const itemCount = await items.count()
    expect(itemCount).toBeGreaterThanOrEqual(1)

    // The first item ("All Projects") should be active by default
    await expect.soft(items.first()).toHaveClass(/active/)

    // Dismiss by clicking outside the wrapper
    await page.locator('.mobile-today').click({ position: { x: 10, y: 10 }, force: true })
    await expect(dropdown).toBeHidden({ timeout: 3000 })
  })

  // 6. Selecting a dropdown item closes the menu and marks it active
  test('selecting a dropdown item applies the active class', async ({ page }) => {
    // Open the Priority filter (second button)
    const priorityBtn = page.locator('.filter-row .filter-btn').nth(1)
    await priorityBtn.click()

    const dropdown = page.locator('.filter-dropdown-wrapper').nth(1).locator('.dropdown-menu')
    await expect(dropdown).toBeVisible({ timeout: 3000 })

    // Pick "High" priority option (index 2 — index 0 is "All Priorities", index 1 is Critical)
    const highOption = dropdown.locator('.dropdown-item').nth(2)
    await expect(highOption).toBeVisible()
    await highOption.click()

    // Dropdown should close
    await expect(dropdown).toBeHidden({ timeout: 3000 })

    // Clear filters button must now be visible (a filter is active)
    await expect(page.locator('.clear-btn')).toBeVisible({ timeout: 3000 })
  })

  // 7. Clear filters button removes active filters
  test('clear filters button resets active filters', async ({ page }) => {
    // First activate a filter
    const priorityBtn = page.locator('.filter-row .filter-btn').nth(1)
    await priorityBtn.click()
    const dropdown = page.locator('.filter-dropdown-wrapper').nth(1).locator('.dropdown-menu')
    await expect(dropdown).toBeVisible({ timeout: 3000 })
    await dropdown.locator('.dropdown-item').nth(1).click() // "Critical"
    await expect(dropdown).toBeHidden({ timeout: 3000 })

    const clearBtn = page.locator('.clear-btn')
    await expect(clearBtn).toBeVisible({ timeout: 3000 })

    // Clicking clear should hide the button (no active filters)
    await clearBtn.click()
    await expect(clearBtn).toBeHidden({ timeout: 3000 })
  })
})
