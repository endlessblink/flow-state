import { expect, test, type Page } from '@playwright/test'

/**
 * Anti-nudge regression: adding a task to the canvas (the result of an
 * inbox -> canvas drop) must NOT make the already-rendered nodes move,
 * even transiently. The old code called Vue Flow setNodes() on every
 * count change, which re-parsed every node, reset its measured
 * dimensions, and triggered a re-measure reflow -> the visible "nudge".
 *
 * This test samples each existing node's screen rect across animation
 * frames while the new node is being added, and asserts none of them
 * drift beyond a sub-pixel epsilon.
 */

const setupCanvas = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true, weekStartsOn: 1 }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })

  await page.goto('/#/canvas')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } } } | null
    const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
    const taskStore = pinia?._s.get('tasks') as { _hasInitializedOnce?: boolean } | undefined
    const canvasStore = pinia?._s.get('canvas') as { _hasInitializedOnce?: boolean } | undefined
    return !!taskStore?._hasInitializedOnce && !!canvasStore?._hasInitializedOnce && !!pinia?._s.get('settings')
  }, { timeout: 30_000 })
}

test('dropping an inbox task onto the canvas does not nudge rendered nodes', async ({ page }) => {
  await setupCanvas(page)

  const groups = [
    { id: 'nudge-g1', name: 'Nudge G1', x: 180, y: 160, width: 420, height: 900 },
    { id: 'nudge-g2', name: 'Nudge G2', x: 760, y: 160, width: 420, height: 900 },
  ]
  const tasks = [
    { id: 'nudge-a', title: 'Nudge A', parentId: 'nudge-g1', x: 244, y: 252 },
    { id: 'nudge-b', title: 'Nudge B', parentId: 'nudge-g1', x: 244, y: 396 },
    { id: 'nudge-c', title: 'Nudge C', parentId: 'nudge-g2', x: 824, y: 252 },
    { id: 'nudge-root', title: 'Nudge Root', parentId: '', x: 1220, y: 252 },
  ]

  await page.evaluate(async ({ groups, tasks }) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!
    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })
    canvasStore.setGroups(groups.map((group) => ({
      id: group.id, name: group.name, type: 'custom', isVisible: true, isCollapsed: false,
      parentGroupId: null, positionVersion: 1, positionFormat: 'absolute',
      position: { x: group.x, y: group.y, width: group.width, height: group.height },
    })), true)
    for (const task of tasks) {
      await taskStore.createTask({
        id: task.id, title: task.title, status: 'todo', priority: 'medium',
        isInInbox: false, parentId: task.parentId,
        canvasPosition: { x: task.x, y: task.y }, positionFormat: 'absolute',
      })
    }
    // The task that will be dragged out of the inbox onto the canvas.
    await taskStore.createTask({
      id: 'nudge-new', title: 'Nudge New', status: 'todo', priority: 'medium', isInInbox: true,
    })
    await canvasStore.requestSync?.('user:manual')
  }, { groups, tasks })

  const stableIds = ['section-nudge-g1', 'section-nudge-g2', 'nudge-a', 'nudge-b', 'nudge-c', 'nudge-root']

  // Wait for all existing nodes to be measured/rendered.
  for (const id of stableIds) {
    await expect(page.locator(`.vue-flow__node[data-id="${id}"]`)).toBeVisible()
  }
  await page.waitForTimeout(600)

  // Start a per-frame sampler of each existing node's screen rect + viewport,
  // then fire the REAL HTML5 drop the canvas listens for. Any movement of an
  // existing node (or the viewport) during the drop is the "nudge".
  const drift = await page.evaluate(async ({ stableIds }) => {
    const rectOf = (id: string) => {
      const el = document.querySelector(`.vue-flow__node[data-id="${id}"]`) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    const viewportTransform = () => {
      const vp = document.querySelector('.vue-flow__transformationpane') as HTMLElement | null
      return vp ? getComputedStyle(vp).transform : 'none'
    }

    const sampledIds = [...stableIds, 'nudge-new']
    const samples: Record<string, Array<{ x: number; y: number; w: number; h: number }>> = {}
    for (const id of sampledIds) samples[id] = []
    const viewportSamples = new Set<string>()

    let running = true
    const sample = () => {
      for (const id of sampledIds) {
        const r = rectOf(id)
        if (r) samples[id].push(r)
      }
      viewportSamples.add(viewportTransform())
      if (running) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)

    // Fire a native drop carrying the inbox task id (handleDrop reads
    // dataTransfer 'application/json' when no active drag data is present).
    const dropzone = document.querySelector('.canvas-drop-zone') as HTMLElement
    const groupEl = document.querySelector('.vue-flow__node[data-id="section-nudge-g1"]') as HTMLElement
    const gb = groupEl.getBoundingClientRect()
    const clientX = gb.x + gb.width / 2
    const clientY = gb.y + 240
    const dt = new DataTransfer()
    dt.setData('application/json', JSON.stringify({ taskId: 'nudge-new' }))
    const fire = (type: string, el: HTMLElement) => el.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, clientX, clientY, dataTransfer: dt })
    )
    fire('dragenter', dropzone)
    fire('dragover', dropzone)
    fire('drop', dropzone)

    // Let the 3x syncNodes + nextTicks settle so any reflow/nudge is captured.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    running = false

    const result: Record<string, { dx: number; dy: number; dw: number; dh: number; frames: number }> = {}
    for (const id of sampledIds) {
      const s = samples[id]
      if (!s.length) { result[id] = { dx: -1, dy: -1, dw: -1, dh: -1, frames: 0 }; continue }
      const xs = s.map((p) => p.x), ys = s.map((p) => p.y), ws = s.map((p) => p.w), hs = s.map((p) => p.h)
      result[id] = {
        dx: Math.max(...xs) - Math.min(...xs),
        dy: Math.max(...ys) - Math.min(...ys),
        dw: Math.max(...ws) - Math.min(...ws),
        dh: Math.max(...hs) - Math.min(...hs),
        frames: s.length,
      }
    }
    return { nodes: result, viewportTransforms: Array.from(viewportSamples) }
  }, { stableIds })

  // The dropped node must actually have been placed on the canvas.
  await expect(page.locator('.vue-flow__node[data-id="nudge-new"]')).toBeVisible()

  // The viewport must not have shifted during the drop.
  expect(drift.viewportTransforms.length, `viewport moved during drop: ${JSON.stringify(drift.viewportTransforms)}`).toBe(1)

  // No existing node may drift in position or size during the drop.
  const EPSILON = 1.0
  for (const id of stableIds) {
    const d = drift.nodes[id]
    expect(d.frames, `no samples for ${id}: ${JSON.stringify(drift.nodes)}`).toBeGreaterThan(2)
    expect(d.dx, `${id} drifted horizontally: ${JSON.stringify(drift.nodes)}`).toBeLessThanOrEqual(EPSILON)
    expect(d.dy, `${id} drifted vertically: ${JSON.stringify(drift.nodes)}`).toBeLessThanOrEqual(EPSILON)
    expect(d.dw, `${id} width changed: ${JSON.stringify(drift.nodes)}`).toBeLessThanOrEqual(EPSILON)
    expect(d.dh, `${id} height changed: ${JSON.stringify(drift.nodes)}`).toBeLessThanOrEqual(EPSILON)
  }
})
