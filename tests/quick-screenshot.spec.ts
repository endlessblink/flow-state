import { test } from '@playwright/test'

test('BUG-1076: right-click on Done group shows delete option', async ({ page }) => {
  await page.goto('http://localhost:5546/canvas')
  await page.waitForTimeout(3000)

  // Take screenshot of initial state
  await page.screenshot({ path: 'screenshots/1-canvas-initial.png', fullPage: true })
  console.log('Screenshot 1: Initial canvas state')

  // Find the Done group - look for the group node with "Done" text
  // Groups have class vue-flow__node and type sectionNode
  const groups = page.locator('.vue-flow__node-sectionNode')
  const groupCount = await groups.count()
  console.log(`Found ${groupCount} groups on canvas`)

  // Find Done group specifically
  let doneGroupFound = false
  for (let i = 0; i < groupCount; i++) {
    const group = groups.nth(i)
    const text = await group.textContent()
    console.log(`Group ${i}: "${text?.substring(0, 50)}"`)

    if (text?.includes('Done')) {
      doneGroupFound = true
      console.log('Found Done group, right-clicking...')

      // Right-click to open context menu
      await group.click({ button: 'right' })
      await page.waitForTimeout(500)

      // Take screenshot of context menu
      await page.screenshot({ path: 'screenshots/2-context-menu.png', fullPage: true })
      console.log('Screenshot 2: Context menu opened')

      // Look for Delete Group button
      const deleteBtn = page.locator('button:has-text("Delete Group")')
      const deleteBtnCount = await deleteBtn.count()
      console.log(`Delete Group button count: ${deleteBtnCount}`)

      if (deleteBtnCount > 0) {
        console.log('Delete button found! Clicking...')
        await deleteBtn.click()
        await page.waitForTimeout(500)

        // Take screenshot after clicking delete
        await page.screenshot({ path: 'screenshots/3-after-delete.png', fullPage: true })
        console.log('Screenshot 3: After clicking delete')

        // Check if confirmation modal appeared
        const modal = page.locator('[class*="modal"], [class*="Modal"]')
        console.log(`Modal elements found: ${await modal.count()}`)
      } else {
        console.log('ERROR: Delete Group button NOT found in context menu!')
      }
      break
    }
  }

  if (!doneGroupFound) {
    console.log('ERROR: No Done group found on canvas')
  }
})
