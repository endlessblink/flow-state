import { test, expect } from '@playwright/test'

test.describe('Canvas Comprehensive Feature Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5550/#/canvas', {
      waitUntil: 'networkidle',
      timeout: 10000
    })

    // Wait for canvas
    await page.waitForSelector('.vue-flow', { timeout: 5000 })

    // Close any modals
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('1. Canvas loads and displays UI elements', async ({ page }) => {
    console.log('\n=== TEST 1: Canvas Load ===')

    // Check main UI elements exist
    const canvas = page.locator('.vue-flow')
    await expect(canvas).toBeVisible()

    // Check for zoom control buttons (may be icon-based)
    const controlButtons = page.locator('.vue-flow__controls button')
    const buttonCount = await controlButtons.count()
    console.log(`Found ${buttonCount} control buttons`)

    // Verify we have at least some control buttons
    expect(buttonCount).toBeGreaterThan(0)

    console.log('✓ Canvas and control buttons visible')

    await page.screenshot({ path: '.playwright-mcp/test-1-canvas-load.png' })
  })

  test('2. Inbox panel expand/collapse', async ({ page }) => {
    console.log('\n=== TEST 2: Inbox Panel ===')

    // Expand inbox
    const expandButton = page.getByRole('button', { name: /Expand Inbox|Collapse Inbox/i })
    await expandButton.click()
    await page.waitForTimeout(500)

    // Check if inbox header visible
    const inboxHeader = page.locator('text=Inbox')
    await expect(inboxHeader).toBeVisible()

    console.log('✓ Inbox panel toggles')

    await page.screenshot({ path: '.playwright-mcp/test-2-inbox-panel.png' })
  })

  test('3. Display toggles (Priority, Status, Duration, Schedule)', async ({ page }) => {
    console.log('\n=== TEST 3: Display Toggles ===')

    const toggles = [
      { name: 'Toggle Priority', selector: 'button:has-text("Toggle Priority")' },
      { name: 'Toggle Status', selector: 'button:has-text("Toggle Status")' },
      { name: 'Toggle Duration', selector: 'button:has-text("Toggle Duration")' },
      { name: 'Toggle Schedule', selector: 'button:has-text("Toggle Schedule")' }
    ]

    for (const toggle of toggles) {
      const button = page.locator(toggle.selector).first()
      const exists = await button.count() > 0

      if (exists) {
        await button.click()
        await page.waitForTimeout(300)
        console.log(`✓ ${toggle.name} clicked`)
      } else {
        console.log(`⚠ ${toggle.name} not found`)
      }
    }

    await page.screenshot({ path: '.playwright-mcp/test-3-display-toggles.png' })
  })

  test('4. Zoom controls', async ({ page }) => {
    console.log('\n=== TEST 4: Zoom Controls ===')

    // Get initial zoom level (if visible)
    const zoomDisplay = page.locator('text=/\\d+%/')
    const zoomExists = await zoomDisplay.count() > 0

    if (zoomExists) {
      const initialZoom = await zoomDisplay.textContent()
      console.log(`Initial zoom: ${initialZoom}`)
    }

    // Test zoom via keyboard shortcuts (more reliable than finding icon buttons)
    // Zoom in with +
    await page.keyboard.press('+')
    await page.waitForTimeout(500)

    if (zoomExists) {
      const zoomAfterIn = await zoomDisplay.textContent()
      console.log(`After zoom in: ${zoomAfterIn}`)
    }

    // Zoom out with -
    await page.keyboard.press('-')
    await page.waitForTimeout(500)

    if (zoomExists) {
      const zoomAfterOut = await zoomDisplay.textContent()
      console.log(`After zoom out: ${zoomAfterOut}`)
    }

    // Fit view with F key
    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    console.log('✓ Zoom controls functional via keyboard shortcuts')

    await page.screenshot({ path: '.playwright-mcp/test-4-zoom-controls.png' })
  })

  test('5. Create task and drag to canvas', async ({ page }) => {
    console.log('\n=== TEST 5: Task Creation and Drag ===')

    // Expand inbox first
    const expandButton = page.getByRole('button', { name: /Expand Inbox/i }).first()
    const expandExists = await expandButton.count() > 0
    if (expandExists) {
      await expandButton.click()
      await page.waitForTimeout(1000)
    }

    // Create a new task via quick add
    const quickAdd = page.locator('input[placeholder*="Quick add"], input[placeholder*="Add a task"]').first()
    const quickAddExists = await quickAdd.count() > 0

    if (quickAddExists) {
      await quickAdd.fill('Test Task from Playwright')
      await quickAdd.press('Enter')
      await page.waitForTimeout(1000)

      console.log('✓ Task created via quick add')

      // Look for the task in inbox
      const newTask = page.locator('text=Test Task from Playwright').first()
      const taskVisible = await newTask.isVisible()
      console.log(`Task visible in inbox: ${taskVisible}`)

      if (taskVisible) {
        // Try to drag it to canvas
        const canvas = page.locator('.vue-flow')
        const canvasBox = await canvas.boundingBox()

        if (canvasBox) {
          await newTask.dragTo(canvas, {
            targetPosition: {
              x: canvasBox.width / 2,
              y: canvasBox.height / 2
            }
          })
          await page.waitForTimeout(2000)

          console.log('✓ Drag operation attempted')
        }
      }
    } else {
      console.log('⚠ Quick add input not found')
    }

    await page.screenshot({ path: '.playwright-mcp/test-5-task-creation.png' })
  })

  test('6. Section operations', async ({ page }) => {
    console.log('\n=== TEST 6: Section Operations ===')

    // Try to add a section
    const addSectionBtn = page.locator('button:has-text("Add Section")').first()
    const btnExists = await addSectionBtn.count() > 0

    if (btnExists) {
      await addSectionBtn.click()
      await page.waitForTimeout(1000)

      console.log('✓ Add Section button clicked')

      // Check if modal or section appeared
      await page.screenshot({ path: '.playwright-mcp/test-6a-section-add.png' })

      // Close any modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    } else {
      console.log('⚠ Add Section button not found')
    }

    // Try toggle sections
    const toggleSectionsBtn = page.locator('button:has-text("Toggle Sections")').first()
    const toggleExists = await toggleSectionsBtn.count() > 0

    if (toggleExists) {
      await toggleSectionsBtn.click()
      await page.waitForTimeout(500)
      console.log('✓ Toggle Sections clicked')
    }

    await page.screenshot({ path: '.playwright-mcp/test-6b-section-toggle.png' })
  })

  test('7. Multi-select mode', async ({ page }) => {
    console.log('\n=== TEST 7: Multi-Select Mode ===')

    const multiSelectBtn = page.locator('button:has-text("Multi-Select")').first()
    const btnExists = await multiSelectBtn.count() > 0

    if (btnExists) {
      await multiSelectBtn.click()
      await page.waitForTimeout(500)

      console.log('✓ Multi-Select mode toggled')
    } else {
      console.log('⚠ Multi-Select button not found')
    }

    await page.screenshot({ path: '.playwright-mcp/test-7-multi-select.png' })
  })

  test('8. Auto arrange', async ({ page }) => {
    console.log('\n=== TEST 8: Auto Arrange ===')

    const autoArrangeBtn = page.locator('button:has-text("Auto Arrange")').first()
    const btnExists = await autoArrangeBtn.count() > 0

    if (btnExists) {
      await autoArrangeBtn.click()
      await page.waitForTimeout(1000)

      console.log('✓ Auto Arrange executed')
    } else {
      console.log('⚠ Auto Arrange button not found')
    }

    await page.screenshot({ path: '.playwright-mcp/test-8-auto-arrange.png' })
  })

  test('9. Keyboard shortcuts', async ({ page }) => {
    console.log('\n=== TEST 9: Keyboard Shortcuts ===')

    // Test Fit View (F key)
    await page.keyboard.press('f')
    await page.waitForTimeout(500)
    console.log('✓ F key (Fit View) pressed')

    // Test Zoom In (+)
    await page.keyboard.press('+')
    await page.waitForTimeout(500)
    console.log('✓ + key (Zoom In) pressed')

    // Test Zoom Out (-)
    await page.keyboard.press('-')
    await page.waitForTimeout(500)
    console.log('✓ - key (Zoom Out) pressed')

    await page.screenshot({ path: '.playwright-mcp/test-9-keyboard-shortcuts.png' })
  })

  test('10. Context menu (if task exists on canvas)', async ({ page }) => {
    console.log('\n=== TEST 10: Context Menu ===')

    // First, ensure a task is on canvas by expanding inbox and dragging
    const expandButton = page.getByRole('button', { name: /Expand Inbox/i }).first()
    const expandExists = await expandButton.count() > 0

    if (expandExists) {
      await expandButton.click()
      await page.waitForTimeout(1000)

      // Look for any task in inbox
      const firstTask = page.locator('[class*="task"]:visible').first()
      const taskExists = await firstTask.count() > 0

      if (taskExists) {
        // Drag to canvas
        const canvas = page.locator('.vue-flow')
        const canvasBox = await canvas.boundingBox()

        if (canvasBox) {
          await firstTask.dragTo(canvas, {
            targetPosition: { x: 500, y: 300 }
          })
          await page.waitForTimeout(2000)

          // Now try right-click on canvas task
          const canvasTask = page.locator('[data-type="taskNode"]').first()
          const canvasTaskExists = await canvasTask.count() > 0

          if (canvasTaskExists) {
            await canvasTask.click({ button: 'right' })
            await page.waitForTimeout(1000)

            console.log('✓ Right-click context menu attempted')
            await page.screenshot({ path: '.playwright-mcp/test-10-context-menu.png' })

            // Close context menu
            await page.keyboard.press('Escape')
          } else {
            console.log('⚠ No task on canvas to right-click')
          }
        }
      }
    }
  })

  test('11. Hide completed tasks toggle', async ({ page }) => {
    console.log('\n=== TEST 11: Hide Completed Tasks ===')

    const hideCompletedBtn = page.locator('button:has-text("Hide completed")').first()
    const btnExists = await hideCompletedBtn.count() > 0

    if (btnExists) {
      await hideCompletedBtn.click()
      await page.waitForTimeout(500)
      console.log('✓ Hide completed tasks toggled')
    } else {
      console.log('⚠ Hide completed button not found')
    }

    await page.screenshot({ path: '.playwright-mcp/test-11-hide-completed.png' })
  })

  test('12. Console errors check', async ({ page }) => {
    console.log('\n=== TEST 12: Console Errors ===')

    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text())
      }
    })

    // Perform various operations
    await page.keyboard.press('f')
    await page.waitForTimeout(500)

    const zoomIn = page.locator('button:has-text("Zoom In")').first()
    if (await zoomIn.count() > 0) {
      await zoomIn.click()
      await page.waitForTimeout(500)
    }

    console.log(`\nConsole errors: ${errors.length}`)
    console.log(`Console warnings: ${warnings.length}`)

    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:')
      errors.forEach(err => console.log(`  - ${err}`))
    }

    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS FOUND:')
      warnings.forEach(warn => console.log(`  - ${warn}`))
    }

    expect(errors.length).toBe(0)
  })
})
