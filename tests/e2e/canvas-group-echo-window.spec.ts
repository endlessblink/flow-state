/**
 * BUG-1899 regression: a group MOVE issued moments after the group's creation
 * must survive the creation/update echo window.
 *
 * Manual-equivalent of the recorder-proven live failure: createGroup enqueues
 * remote writes whose realtime echoes land 0.2s–5s later; before the version
 * guards (total-order + geometry version-authority) and the single-writer
 * create fix, whichever stale snapshot echoed last stomped the moved position
 * ("Tidy 3 rows" / drag-doesn't-stick class).
 */

import { test, expect } from '../fixtures/auth'

test.describe.configure({ mode: 'serial' })

test('a group move within 2s of creation sticks through the echo window', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('flowstate-settings-v2')) {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    }
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })
  await page.goto('/#/canvas')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } } | null
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    return !!pinia?._s.get('canvas') && !!document.querySelector('.vue-flow__pane')
  }, { timeout: 30000 })

  const groupId: string = await page.evaluate(async () => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { createGroup: (g: Record<string, unknown>) => Promise<{ id: string }> }> } } } } } }
    const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
    const created = await canvasStore.createGroup({
      name: 'Echo Window Group',
      type: 'custom',
      color: '#4ECDC4',
      position: { x: 2600, y: 700, width: 360, height: 500 },
    })
    return created.id
  })

  // Move it IMMEDIATELY (inside the 2s echo window) via the single-writer path
  await page.evaluate(async (id) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { updateGroup: (id: string, u: Record<string, unknown>) => Promise<void> }> } } } } } }
    const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
    await canvasStore.updateGroup(id, { position: { x: 3100, y: 150, width: 360, height: 500 } })
  }, groupId)

  const readPos = () => page.evaluate((id) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { groups: Array<{ id: string; position?: { x: number; y: number } }> }> } } } } } }
    const groups = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.groups || []
    const g = groups.find(x => x.id === id)
    return g?.position ? { x: g.position.x, y: g.position.y } : null
  }, groupId)

  expect(await readPos()).toEqual(expect.objectContaining({ x: 3100, y: 150 }))

  // Ride out the full echo window (create + update ops drain and echo back)
  await page.waitForTimeout(8000)
  expect(
    await readPos(),
    'creation/update echoes reverted a move made within 2s of creation (BUG-1899 class)'
  ).toEqual(expect.objectContaining({ x: 3100, y: 150 }))

  // cleanup
  await page.evaluate(async (id) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, { deleteGroup?: (id: string) => Promise<void> }> } } } } } }
    await root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!.deleteGroup?.(id)
  }, groupId).catch(() => { /* page may close */ })
})
