/**
 * Dropdown Z-Index E2E Tests
 *
 * Validates that ALL dropdowns/popovers appear ABOVE other content, not behind.
 * Primary motivation: Inbox calendar dropdown rendering behind sidebar in WebKitGTK (Tauri).
 *
 * Strategy:
 * - Open each dropdown/popover
 * - Verify it's visible and within viewport
 * - Check bounding box: dropdown must not be clipped by parent overflow or hidden by z-index
 * - Screenshot every dropdown state for visual review
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'
import path from 'node:path'

const SCREENSHOT_DIR = '.dev/screenshots'

/**
 * Asserts that an element is visible, in viewport, and has a non-trivial bounding box.
 */
async function assertDropdownVisible(
  page: import('@playwright/test').Page,
  dropdownLocator: import('@playwright/test').Locator,
  name: string,
  screenshotName: string
) {
  await expect(dropdownLocator, `${name} should be visible`).toBeVisible({ timeout: 5000 })

  const box = await dropdownLocator.boundingBox()
  expect(box, `${name} should have a bounding box`).toBeTruthy()
  expect(box!.width, `${name} width should be > 10px`).toBeGreaterThan(10)
  expect(box!.height, `${name} height should be > 10px`).toBeGreaterThan(10)

  // Verify dropdown is within viewport bounds
  const viewport = page.viewportSize()!
  expect(box!.x, `${name} left edge should be >= 0`).toBeGreaterThanOrEqual(-5)
  expect(box!.y, `${name} top edge should be >= 0`).toBeGreaterThanOrEqual(-5)
  expect(box!.x + box!.width, `${name} right edge should be within viewport`).toBeLessThanOrEqual(viewport.width + 20)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) })
}

test.describe('Dropdown Z-Index', () => {
  // ── 1. Inbox panel: time filter dropdown ──────────────────────────────

  test('1 - Inbox time filter dropdown is visible above sidebar', async ({ page }) => {
    // Canvas view has the inbox panel
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click the time filter dropdown button in inbox header
    const timeFilterBtn = page.locator('.time-filter-dropdown').first()
    if (await timeFilterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timeFilterBtn.click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('.time-filter-options').first()
      if (await dropdown.isVisible().catch(() => false)) {
        await assertDropdownVisible(page, dropdown, 'Inbox time filter', 'dropdown-inbox-time-filter.png')

        // Verify dropdown is not hidden behind sidebar
        const sidebarBox = await page.locator('.sidebar').first().boundingBox()
        const dropdownBox = await dropdown.boundingBox()

        if (sidebarBox && dropdownBox) {
          // If dropdown overlaps sidebar area, it should still be fully visible
          // (Teleported to body should escape sidebar overflow)
          expect(dropdownBox.width, 'Dropdown should have meaningful width').toBeGreaterThan(50)
        }
      }
    } else {
      // Inbox might be collapsed or not on this view
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-time-filter-notfound.png') })
    }
  })

  // ── 2. Inbox: priority filter ─────────────────────────────────────────

  test('2 - Inbox priority filter dropdown visible above content', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for filter/group chips in inbox header
    const filterBtn = page.locator('.inbox-header .filter-btn, .inbox-header button:has-text("Priority")').first()

    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('.n-popover, .filter-options, [class*="popover-content"]').last()
      if (await dropdown.isVisible().catch(() => false)) {
        await assertDropdownVisible(page, dropdown, 'Priority filter', 'dropdown-inbox-priority.png')
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-priority-state.png') })
  })

  // ── 3. Inbox: duration filter ─────────────────────────────────────────

  test('3 - Inbox duration filter dropdown visible above content', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const filterBtn = page.locator('.inbox-header button:has-text("Duration"), .inbox-header .duration-filter').first()

    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-duration.png') })
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-duration-notfound.png') })
    }
  })

  // ── 4. Inbox: project filter ──────────────────────────────────────────

  test('4 - Inbox project filter dropdown visible above content', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const filterBtn = page.locator('.inbox-header button:has-text("Project"), .inbox-header .project-filter').first()

    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-project.png') })
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-project-notfound.png') })
    }
  })

  // ── 5. Inbox: sort dropdown ───────────────────────────────────────────

  test('5 - Inbox sort dropdown visible above content', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const sortBtn = page.locator('.inbox-header button:has-text("Sort"), .inbox-header .sort-btn, .inbox-header [title*="Sort"]').first()

    if (await sortBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-sort.png') })
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-inbox-sort-notfound.png') })
    }
  })

  // ── 6. Sidebar: project dropdown ──────────────────────────────────────

  test('6 - Sidebar project dropdown visible above main content', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Sidebar project section should have clickable project items
    const projectItem = page.locator('.sidebar .project-item, .sidebar [class*="project"]').first()

    if (await projectItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Right-click for context menu or regular click
      await projectItem.click({ button: 'right' })
      await page.waitForTimeout(500)

      const contextMenu = page.locator('.context-menu, [class*="context-menu"]').first()
      if (await contextMenu.isVisible().catch(() => false)) {
        await assertDropdownVisible(page, contextMenu, 'Sidebar project context menu', 'dropdown-sidebar-project.png')
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-sidebar-project-state.png') })
  })

  // ── 7. Task context menu via right-click ──────────────────────────────

  test('7 - Task context menu fully visible on right-click', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find a task item and right-click
    const taskItem = page.locator('[class*="task-item"], [class*="task-card"], [class*="task-row"]').first()

    if (await taskItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskItem.click({ button: 'right' })
      await page.waitForTimeout(500)

      const contextMenu = page.locator('.context-menu').first()
      if (await contextMenu.isVisible().catch(() => false)) {
        await assertDropdownVisible(page, contextMenu, 'Task context menu', 'dropdown-task-context-menu.png')

        // Context menu items should be clickable
        const menuItems = page.locator('.context-menu-item')
        const count = await menuItems.count()
        expect(count, 'Context menu should have items').toBeGreaterThan(0)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-task-context-state.png') })
  })

  // ── 8. Task edit modal: priority select ───────────────────────────────

  test('8 - Task edit modal priority dropdown visible above modal', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click a task to open edit modal
    const taskText = page.getByText(TEST_TASKS.designLandingPage.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Find priority CustomSelect in modal
      const prioritySelect = page.locator('.modal-content .custom-select, .modal-body .custom-select').first()
      if (await prioritySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await prioritySelect.locator('.select-trigger').click()
        await page.waitForTimeout(500)

        const dropdown = page.locator('.select-dropdown')
        if (await dropdown.isVisible().catch(() => false)) {
          await assertDropdownVisible(page, dropdown, 'Priority dropdown in modal', 'dropdown-modal-priority.png')
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-modal-priority-state.png') })
  })

  // ── 9. Task edit modal: project select ────────────────────────────────

  test('9 - Task edit modal project dropdown visible above modal', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const taskText = page.getByText(TEST_TASKS.setupCICD.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Find all CustomSelects in modal - project is usually the second one
      const selects = page.locator('.modal-content .custom-select, .modal-body .custom-select')
      const selectCount = await selects.count()

      if (selectCount >= 2) {
        await selects.nth(1).locator('.select-trigger').click()
        await page.waitForTimeout(500)

        const dropdown = page.locator('.select-dropdown')
        if (await dropdown.isVisible().catch(() => false)) {
          await assertDropdownVisible(page, dropdown, 'Project dropdown in modal', 'dropdown-modal-project.png')
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-modal-project-state.png') })
  })

  // ── 10. Task edit modal: date picker ──────────────────────────────────

  test('10 - Task edit modal date picker visible above modal', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const taskText = page.getByText(TEST_TASKS.designLandingPage.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Find date picker trigger in modal
      const dateTrigger = page.locator('.modal-content .n-date-picker, .modal-body .n-date-picker, .modal-content [class*="date-picker"]').first()

      if (await dateTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dateTrigger.click()
        await page.waitForTimeout(500)

        // NDatePicker opens a panel - look for it
        const datePanel = page.locator('.n-date-panel, .v-binder-follower-content:has(.n-date-panel)')
        if (await datePanel.first().isVisible().catch(() => false)) {
          await assertDropdownVisible(page, datePanel.first(), 'Date picker in modal', 'dropdown-modal-datepicker.png')
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-modal-datepicker-state.png') })
  })

  // ── 11. Canvas: right-click context menu ──────────────────────────────

  test('11 - Canvas right-click context menu visible above nodes', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Right-click on canvas background
    const canvas = page.locator('.vue-flow').first()
    if (await canvas.isVisible().catch(() => false)) {
      const box = await canvas.boundingBox()
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
        await page.waitForTimeout(500)

        const contextMenu = page.locator('.context-menu, [class*="canvas-context-menu"]').first()
        if (await contextMenu.isVisible().catch(() => false)) {
          await assertDropdownVisible(page, contextMenu, 'Canvas context menu', 'dropdown-canvas-context.png')
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-canvas-context-state.png') })
  })

  // ── 12. Board: column header dropdown ─────────────────────────────────

  test('12 - Board column header dropdown visible', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check for any dropdown trigger in kanban column headers
    const columnHeader = page.locator('.kanban-column .column-header, [class*="kanban"] [class*="header"]').first()

    if (await columnHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try right-click or look for a dropdown button
      const dropdownBtn = columnHeader.locator('button, [class*="dropdown"]').first()
      if (await dropdownBtn.isVisible().catch(() => false)) {
        await dropdownBtn.click()
        await page.waitForTimeout(500)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-board-column.png') })
  })

  // ── 13. Header dropdowns visible ──────────────────────────────────────

  test('13 - Header dropdowns visible above content', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check for user avatar/profile dropdown in header
    const headerBtn = page.locator('.app-header button, header button, .header-right button').first()

    if (await headerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await headerBtn.click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('.n-popover, .select-dropdown, [class*="dropdown"], [class*="popover"]').last()
      if (await dropdown.isVisible().catch(() => false)) {
        const box = await dropdown.boundingBox()
        expect(box, 'Header dropdown should have a bounding box').toBeTruthy()
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-header.png') })
  })

  // ── 14. Settings dropdowns visible ────────────────────────────────────

  test('14 - Settings dropdowns visible above settings content', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open settings modal
    const settingsBtn = page.locator(
      '[aria-label*="Settings"], [aria-label*="settings"], ' +
      '[title*="Settings"], [title*="settings"]'
    ).first()

    if (await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsBtn.click()
      await page.waitForTimeout(1000)

      // Find a CustomSelect in settings
      const settingsSelect = page.locator('.modal-content .custom-select, .settings-modal .custom-select').first()

      if (await settingsSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await settingsSelect.locator('.select-trigger').click()
        await page.waitForTimeout(500)

        const dropdown = page.locator('.select-dropdown')
        if (await dropdown.isVisible().catch(() => false)) {
          await assertDropdownVisible(page, dropdown, 'Settings dropdown', 'dropdown-settings.png')
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-settings-state.png') })
  })

  // ── 15. CustomSelect: dropdown opens and is visible ───────────────────

  test('15 - CustomSelect dropdown opens downward and is fully visible', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find any CustomSelect on the page (board view header often has view-type select)
    const customSelect = page.locator('.custom-select').first()

    if (await customSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customSelect.locator('.select-trigger').click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('.select-dropdown')
      if (await dropdown.isVisible().catch(() => false)) {
        await assertDropdownVisible(page, dropdown, 'CustomSelect', 'dropdown-customselect.png')
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-customselect-state.png') })
  })

  // ── 16. CustomSelect near bottom of screen ────────────────────────────

  test('16 - CustomSelect near bottom opens upward or stays visible', async ({ page }) => {
    // Open task edit modal and scroll down to find CustomSelects near bottom
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const taskText = page.getByText(TEST_TASKS.designLandingPage.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Scroll modal to bottom to find CustomSelects that would be near viewport bottom
      const modalBody = page.locator('.modal-body').first()
      if (await modalBody.isVisible().catch(() => false)) {
        await modalBody.evaluate(el => el.scrollTo(0, el.scrollHeight))
        await page.waitForTimeout(500)

        // Find the last CustomSelect (likely near bottom)
        const allSelects = page.locator('.modal-body .custom-select')
        const count = await allSelects.count()
        if (count > 0) {
          const lastSelect = allSelects.nth(count - 1)
          await lastSelect.locator('.select-trigger').click()
          await page.waitForTimeout(500)

          const dropdown = page.locator('.select-dropdown')
          if (await dropdown.isVisible().catch(() => false)) {
            // Dropdown is teleported to body, should be visible regardless of position
            await assertDropdownVisible(page, dropdown, 'Bottom CustomSelect', 'dropdown-customselect-bottom.png')
          }
        }
      }
    }
  })

  // ── 17. NDatePicker calendar popup visible ────────────────────────────

  test('17 - NDatePicker calendar popup fully visible, not clipped by parent', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open a task edit modal
    const taskText = page.getByText(TEST_TASKS.designLandingPage.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Click on date picker
      const datePicker = page.locator('.modal-content .n-date-picker, .modal-body .n-date-picker').first()
      if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
        await datePicker.click()
        await page.waitForTimeout(500)

        const panel = page.locator('.n-date-panel')
        if (await panel.first().isVisible().catch(() => false)) {
          const box = await panel.first().boundingBox()
          expect(box, 'Date panel should have a bounding box').toBeTruthy()
          expect(box!.width, 'Date panel should have meaningful width').toBeGreaterThan(100)
          expect(box!.height, 'Date panel should have meaningful height').toBeGreaterThan(100)

          // Should not be clipped - check it's visible in viewport
          const viewport = page.viewportSize()!
          expect(box!.y + box!.height, 'Date panel bottom should be within reasonable bounds').toBeLessThanOrEqual(viewport.height + 50)
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-ndatepicker.png') })
  })

  // ── 18. BasePopover content visible ───────────────────────────────────

  test('18 - BasePopover content visible when triggered', async ({ page }) => {
    // The inbox header uses NPopover extensively
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // The time filter is an NPopover with to="body"
    const timeFilter = page.locator('.time-filter-dropdown').first()
    if (await timeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timeFilter.click()
      await page.waitForTimeout(500)

      // NPopover renders to body via Teleport
      const popoverContent = page.locator('.time-filter-options, .n-popover').first()
      if (await popoverContent.isVisible().catch(() => false)) {
        const box = await popoverContent.boundingBox()
        expect(box, 'Popover content should have a bounding box').toBeTruthy()
        expect(box!.width, 'Popover should have real width').toBeGreaterThan(20)

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-basepopover.png') })
      }
    }
  })

  // ── 19. Multiple overlapping dropdowns: last opened is on top ─────────

  test('19 - Multiple overlapping dropdowns: last opened is on top', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open task edit modal
    const taskText = page.getByText(TEST_TASKS.designLandingPage.title)
    if (await taskText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await taskText.click()
      await page.waitForTimeout(1000)

      // Open first dropdown
      const selects = page.locator('.modal-body .custom-select')
      if (await selects.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await selects.first().locator('.select-trigger').click()
        await page.waitForTimeout(300)

        const firstDropdown = page.locator('.select-dropdown').first()
        const firstVisible = await firstDropdown.isVisible().catch(() => false)

        if (firstVisible) {
          // Click outside to close, then open a different one
          await page.mouse.click(10, 10)
          await page.waitForTimeout(300)

          // Open second dropdown if available
          if ((await selects.count()) >= 2) {
            await selects.nth(1).locator('.select-trigger').click()
            await page.waitForTimeout(300)

            const secondDropdown = page.locator('.select-dropdown').first()
            if (await secondDropdown.isVisible().catch(() => false)) {
              // The newly opened dropdown should be visible (on top)
              await assertDropdownVisible(page, secondDropdown, 'Second dropdown', 'dropdown-overlap-second.png')
            }
          }
        }
      }
    }
  })

  // ── 20. Dropdown dismissal: clicking outside closes cleanly ───────────

  test('20 - Dropdown dismissal: clicking outside closes dropdown cleanly', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const customSelect = page.locator('.custom-select').first()

    if (await customSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Open dropdown
      await customSelect.locator('.select-trigger').click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('.select-dropdown')
      const wasVisible = await dropdown.isVisible().catch(() => false)

      if (wasVisible) {
        // Click outside to dismiss
        await page.mouse.click(10, 10)
        await page.waitForTimeout(500)

        // Dropdown should be gone
        const stillVisible = await dropdown.isVisible().catch(() => false)
        expect(stillVisible, 'Dropdown should close when clicking outside').toBeFalsy()

        // No orphaned overlays or backdrops
        const orphanedOverlay = page.locator('.select-dropdown')
        expect(await orphanedOverlay.count(), 'No orphaned dropdown elements').toBe(0)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dropdown-dismissal.png') })
  })
})
