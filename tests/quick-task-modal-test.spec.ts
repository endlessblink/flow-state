import { test, expect } from '@playwright/test'

test('QuickTaskCreateModal - Full featured quick task creation', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5546')
  await page.waitForTimeout(3000)

  // Open quick task creation modal via JavaScript event
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-quick-task-create'))
  })
  await page.waitForTimeout(1000)

  // Take screenshot of modal
  await page.screenshot({ path: 'screenshots/quick-task-modal-1-open.png' })
  console.log('Screenshot 1: Quick task modal opened')

  // Title input
  const titleInput = page.locator('input[placeholder*="Task name"]')
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Test Task from Enhanced Modal')

  // Description input
  const descriptionInput = page.locator('input[placeholder*="Description"]')
  await expect(descriptionInput).toBeVisible()
  await descriptionInput.fill('This is a test description')

  // Check for date picker section
  const dateSection = page.locator('text=Schedule').first()
  await expect(dateSection).toBeVisible()

  // Check for details section with status/priority/project
  const detailsSection = page.locator('text=Details').first()
  await expect(detailsSection).toBeVisible()

  // Take screenshot with filled form
  await page.screenshot({ path: 'screenshots/quick-task-modal-2-filled.png' })
  console.log('Screenshot 2: Form filled')

  // Click one of the quick date shortcuts (Tomorrow)
  const tomorrowBtn = page.locator('button:has-text("Tomorrow")')
  if (await tomorrowBtn.count() > 0) {
    await tomorrowBtn.click()
    await page.waitForTimeout(300)
    console.log('Clicked Tomorrow button')
  }

  // Take screenshot with date selected
  await page.screenshot({ path: 'screenshots/quick-task-modal-3-date-selected.png' })
  console.log('Screenshot 3: Date selected')

  // Try to change priority (click on select dropdown)
  const prioritySelect = page.locator('.compact-select').nth(1) // Second select is priority
  if (await prioritySelect.count() > 0) {
    await prioritySelect.click()
    await page.waitForTimeout(500)

    // Take screenshot of dropdown
    await page.screenshot({ path: 'screenshots/quick-task-modal-4-priority-dropdown.png' })
    console.log('Screenshot 4: Priority dropdown opened')

    // Select "High"
    const highOption = page.locator('li:has-text("High")').first()
    if (await highOption.count() > 0) {
      await highOption.click()
      await page.waitForTimeout(300)
    }
  }

  // Take final screenshot before submitting
  await page.screenshot({ path: 'screenshots/quick-task-modal-5-ready-to-submit.png' })
  console.log('Screenshot 5: Ready to submit')

  // Click "Add task" button (use more specific selector for the modal button)
  const addTaskBtn = page.locator('.actions-row button.create-btn')
  if (await addTaskBtn.count() > 0) {
    await addTaskBtn.click()
    await page.waitForTimeout(1000)
    console.log('Clicked Add task button')
  }

  // Take screenshot after task creation
  await page.screenshot({ path: 'screenshots/quick-task-modal-6-after-submit.png', fullPage: true })
  console.log('Screenshot 6: After submitting task')

  console.log('\nTest completed successfully!')
  console.log('Check screenshots/ folder for visual verification')
})
