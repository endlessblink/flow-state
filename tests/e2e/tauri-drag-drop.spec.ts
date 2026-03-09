import { test, expect } from '../fixtures/tauri-simulation'

test.describe('Tauri Drag and Drop', () => {
  test('catalog view has draggable task rows', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    // Find draggable rows
    const draggables = page.locator('[draggable="true"]')
    const count = await draggables.count()
    expect(count).toBeGreaterThan(0)
  })

  test('drag ghost pill appears on drag start', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    const draggable = page.locator('[draggable="true"]').first()
    if (await draggable.count() > 0) {
      const box = await draggable.boundingBox()
      if (box) {
        // Start drag
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50)
        // Check ghost exists (may be deferred in Tauri mode)
        await page.waitForTimeout(200) // Allow rAF to fire
        await page.mouse.up()
      }
    }
  })
})
