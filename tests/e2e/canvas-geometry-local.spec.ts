import { expect, test, type Page } from '@playwright/test'

// TASK-1906: environment gate — all E2E specs share ONE seeded test user; under
// parallel workers another spec file mutates the same user's data concurrently
// (Supabase realtime) and clobbers this file's seed state. Runs green with
// --workers=1; skipped in multi-worker suites until per-worker test users land.
test.beforeEach(() => {
  test.skip(
    test.info().config.workers > 1,
    'TASK-1906: shared-test-user interference under parallel workers — run with --workers=1'
  )
})


type SeedGroup = {
  id: string
  name: string
  x: number
  y: number
  width?: number
  height?: number
}

type SeedTask = {
  id: string
  title: string
  parentId: string
  x: number
  y: number
}

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
    return !!pinia?._s.get('tasks') && !!pinia?._s.get('canvas') && !!pinia?._s.get('settings')
      && !!document.querySelector('.vue-flow__pane')
  }, { timeout: 30_000 })
}

const seedCanvas = async (page: Page, groups: SeedGroup[], tasks: SeedTask[]) => {
  await page.evaluate(async ({ groups, tasks }) => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const canvasStore = pinia._s.get('canvas')!
    const settingsStore = pinia._s.get('settings')!

    settingsStore.weekStartsOn = 1
    taskStore.clearAll()
    canvasStore.clearAll()
    canvasStore.setViewport?.({ x: 0, y: 0, zoom: 1 })

    canvasStore.setGroups(groups.map((group) => ({
      id: group.id,
      name: group.name,
      type: 'custom',
      isVisible: true,
      isCollapsed: false,
      parentGroupId: null,
      positionVersion: 1,
      positionFormat: 'absolute',
      position: {
        x: group.x,
        y: group.y,
        width: group.width ?? 400,
        height: group.height ?? 1000,
      },
    })), true)

    for (const task of tasks) {
      await taskStore.createTask({
        id: task.id,
        title: task.title,
        status: 'todo',
        priority: 'medium',
        isInInbox: false,
        parentId: task.parentId,
        canvasPosition: { x: task.x, y: task.y },
        positionFormat: 'absolute',
      })
    }

    await canvasStore.requestSync?.('user:manual')
  }, { groups, tasks })

  await expect.poll(async () => {
    try {
      return await page.evaluate(({ groups, tasks }) => {
        const hasNodes = groups.every((group) => document.querySelector(`[data-id="section-${group.id}"]`))
          && tasks.every((task) => document.querySelector(`[data-id="${task.id}"]`))
        if (!hasNodes) {
          const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
          const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
          pinia?._s.get('canvas')?.requestSync?.('user:manual')
          pinia?._s.get('canvasUi')?.requestSync?.('user:manual')
        }
        return hasNodes
      }, { groups, tasks })
    } catch (error) {
      if (String(error).includes('Execution context was destroyed')) return false
      throw error
    }
  }, {
    timeout: 15_000,
    message: `Expected seeded canvas nodes to render for groups=${groups.map((group) => group.id).join(',')} tasks=${tasks.map((task) => task.id).join(',')}`,
  }).toBe(true)

  await page.waitForFunction(() => {
    const pane = document.querySelector<HTMLElement>('.vue-flow__transformationpane')
    if (!pane) return false
    const transform = window.getComputedStyle(pane).transform
    const now = performance.now()
    const state = window as typeof window & {
      __flowstateCanvasTransformIdle?: { transform: string; since: number }
    }
    if (!state.__flowstateCanvasTransformIdle || state.__flowstateCanvasTransformIdle.transform !== transform) {
      state.__flowstateCanvasTransformIdle = { transform, since: now }
      return false
    }
    return now - state.__flowstateCanvasTransformIdle.since >= 250
  }, { timeout: 5_000 })
}

const clickToolbar = async (page: Page, titlePattern: RegExp) => {
  await page.waitForSelector('.canvas-toolbar-edge button', { timeout: 15_000 })
  await page.evaluate((source) => {
    const pattern = new RegExp(source, 'i')
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-toolbar-edge button'))
      .find((candidate) => pattern.test(candidate.title || '') || pattern.test(candidate.getAttribute('aria-label') || ''))
    if (!button) throw new Error(`Toolbar button not found: ${source}`)
    button.click()
  }, titlePattern.source)
}

const readGeometry = async (page: Page) => page.evaluate(() => {
  const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
  const pinia = root.__vue_app__._context.config.globalProperties.$pinia
  const taskStore = pinia._s.get('tasks')!
  const canvasStore = pinia._s.get('canvas')!

  return {
    groups: canvasStore.groups.map((group: any) => ({
      id: group.id,
      name: group.name,
      x: Math.round(group.position.x),
      y: Math.round(group.position.y),
      width: Math.round(group.position.width),
      height: Math.round(group.position.height),
    })),
    tasks: taskStore.rawTasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      parentId: task.parentId,
      x: Math.round(task.canvasPosition?.x ?? NaN),
      y: Math.round(task.canvasPosition?.y ?? NaN),
    })),
  }
})

const readVisibleGroupOrder = async (page: Page, ids: string[]) => page.evaluate((ids) => {
  return ids
    .map((id) => {
      const element = document.querySelector(`[data-id="section-${id}"]`) as HTMLElement | null
      if (!element) return null
      const renderedNode = element.closest('.vue-flow__node') as HTMLElement | null
      const rect = (renderedNode ?? element).getBoundingClientRect()
      return { id, left: Math.round(rect.left) }
    })
    .filter((entry): entry is { id: string; left: number } => !!entry)
    .sort((a, b) => a.left - b.left)
    .map((entry) => entry.id)
}, ids)

const readTaskEdgeGaps = async (page: Page, ids: string[]) => page.evaluate((ids) => {
  const rects = ids.map((id) => {
    const element = document.querySelector(`[data-task-id="${id}"]`) as HTMLElement | null
      ?? document.querySelector(`[data-id="${id}"]`) as HTMLElement | null
    const rect = element?.getBoundingClientRect()
    if (!rect) return null
    return { id, top: rect.top, bottom: rect.bottom, height: rect.height }
  }).filter((entry): entry is { id: string; top: number; bottom: number; height: number } => !!entry)

  rects.sort((a, b) => a.top - b.top)
  return {
    order: rects.map((rect) => rect.id),
    heights: rects.map((rect) => Math.round(rect.height)),
    gaps: rects.slice(1).map((rect, index) => Math.round(rect.top - rects[index].bottom)),
  }
}, ids)

const readRenderedTaskPositions = async (page: Page, ids: string[]) => page.evaluate((ids) => {
  return ids.map((id) => {
    const element = document.querySelector(`.vue-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
    const rect = element?.getBoundingClientRect()
    if (!rect) return null
    return {
      id,
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      hidden: element.classList.contains('hidden'),
    }
  })
}, ids)

const readRenderedNodePositions = async (page: Page, ids: string[]) => page.evaluate((ids) => {
  return ids.map((id) => {
    const element = document.querySelector(`.vue-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
    const rect = element?.getBoundingClientRect()
    if (!rect) return null
    return {
      id,
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      transform: element.style.transform || null,
    }
  })
}, ids)

const dragRenderedNode = async (page: Page, id: string, dx: number, dy: number) => {
  const node = page.locator(`.vue-flow__node[data-id="${id}"]`)
  const box = await node.boundingBox({ timeout: 10_000 })
  expect(box, `Node not found for drag: ${id}`).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 60))
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + dx, box!.y + Math.min(box!.height / 2, 60) + dy, { steps: 16 })
  await page.mouse.up()
}

const dragInboxTaskToCanvas = async (page: Page, title: string, targetSelector = '.canvas-container') => {
  const card = page.locator('.unified-inbox-panel .task-card').filter({ hasText: title })
  const target = page.locator(targetSelector)
  const targetBox = await target.boundingBox({ timeout: 10_000 })
  expect(targetBox, `Canvas drop target not found: ${targetSelector}`).not.toBeNull()
  await card.dragTo(target, {
    force: true,
    targetPosition: {
      x: targetBox!.width * 0.5,
      y: Math.min(targetBox!.height * 0.35, 220),
    },
  })
}

const readCanvasViewportTransform = async (page: Page) => page.evaluate(() => {
  const viewport = document.querySelector<HTMLElement>('.vue-flow__transformationpane')
  return viewport ? window.getComputedStyle(viewport).transform : null
})

const readCanvasViewportSnapshot = async (page: Page) => page.evaluate(() => {
  const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const canvasStore = pinia?._s.get('canvas')
  const viewport = document.querySelector<HTMLElement>('.vue-flow__viewport')
  const transformationPane = document.querySelector<HTMLElement>('.vue-flow__transformationpane')
  const pane = document.querySelector<HTMLElement>('.vue-flow')
  const container = document.querySelector<HTMLElement>('.canvas-container')

  return {
    domTransform: viewport?.style.transform || null,
    transformationPaneTransform: transformationPane ? window.getComputedStyle(transformationPane).transform : null,
    storeViewport: canvasStore?.viewport
      ? {
        x: Math.round(canvasStore.viewport.x),
        y: Math.round(canvasStore.viewport.y),
        zoom: Number(canvasStore.viewport.zoom?.toFixed?.(3) ?? canvasStore.viewport.zoom),
      }
      : null,
    windowScroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
    paneScroll: pane ? { left: Math.round(pane.scrollLeft), top: Math.round(pane.scrollTop) } : null,
    containerScroll: container ? { left: Math.round(container.scrollLeft), top: Math.round(container.scrollTop) } : null,
  }
})

const readCanvasNodeSnapshot = async (page: Page, ids: string[]) => page.evaluate((ids) => {
  return ids.map((id) => {
    const node = document.querySelector<HTMLElement>(`.vue-flow__node[data-id="${CSS.escape(id)}"]`)
    const rect = node?.getBoundingClientRect()
    const style = node ? window.getComputedStyle(node) : null
    const ancestors: Array<{ className: string; transform: string; rect: { left: number; top: number; width: number; height: number } }> = []
    let parent = node?.parentElement ?? null
    while (parent && ancestors.length < 8) {
      const parentStyle = window.getComputedStyle(parent)
      const parentRect = parent.getBoundingClientRect()
      ancestors.push({
        className: String(parent.className || parent.tagName),
        transform: parentStyle.transform,
        rect: {
          left: Math.round(parentRect.left),
          top: Math.round(parentRect.top),
          width: Math.round(parentRect.width),
          height: Math.round(parentRect.height),
        },
      })
      parent = parent.parentElement
    }
    return {
      id,
      rect: rect
        ? {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
        : null,
      style: style
        ? {
          transform: style.transform,
          display: style.display,
          visibility: style.visibility,
          position: style.position,
        }
        : null,
      className: node?.className ?? null,
      ancestors,
    }
  })
}, ids)

const dayIdByIndex = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const dayNameByIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const expectedWeekdayIds = (availableIds: string[], startFrom: number) => {
  const available = new Set(availableIds)
  return Array.from({ length: 7 }, (_, index) => dayIdByIndex[(startFrom + index) % 7])
    .filter((id) => available.has(id))
}

const expectedWeekdayNames = (availableNames: string[], startFrom: number) => {
  const available = new Set(availableNames)
  return Array.from({ length: 7 }, (_, index) => dayNameByIndex[(startFrom + index) % 7])
    .filter((name) => available.has(name))
}

test.describe('local canvas geometry regressions', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await setupCanvas(page)
  })

  test('idle sync activity and refresh do not persist group position changes', async ({ page }) => {
    const groupWriteLogs: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (text.includes('[GROUP-POS-WRITE]')) groupWriteLogs.push(text)
    })

    const createdIds = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      const ids: string[] = []

      for (const seed of [
        { name: 'Idle Drift Alpha', position: { x: 1440, y: 240, width: 360, height: 720 } },
        { name: 'Idle Drift Beta', position: { x: 1920, y: 240, width: 360, height: 720 } },
      ]) {
        const group = await canvasStore.createGroup({
          ...seed,
          type: 'custom',
          color: '#4ECDC4',
          layout: 'freeform',
        })
        ids.push(group.id)
      }

      await canvasStore.requestSync?.('user:manual')
      return ids
    })

    const readCreatedPositions = async () => page.evaluate((ids) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const canvasStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('canvas')!
      const groups = canvasStore.groups || canvasStore.sections || canvasStore._rawGroups || []
      return ids.map((id: string) => {
        const group = groups.find((candidate: any) => candidate.id === id)
        return group ? {
          id,
          x: Math.round(group.position.x),
          y: Math.round(group.position.y),
          width: Math.round(group.position.width),
          height: Math.round(group.position.height),
          parentGroupId: group.parentGroupId ?? null,
        } : null
      })
    }, createdIds)

    try {
      await page.waitForFunction((ids) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const canvasStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('canvas')
        const groups = canvasStore?.groups || canvasStore?.sections || canvasStore?._rawGroups || []
        return ids.every((id: string) => groups.some((group: any) => group.id === id))
      }, createdIds, { timeout: 15_000 })

      const before = await readCreatedPositions()
      expect(before.every(Boolean), JSON.stringify(before, null, 2)).toBe(true)

      await page.evaluate(async () => {
        const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
        const pinia = root.__vue_app__._context.config.globalProperties.$pinia
        const taskStore = pinia._s.get('tasks')!
        const canvasStore = pinia._s.get('canvas')!
        const task = taskStore.rawTasks?.[0] || taskStore.tasks?.[0]
        if (task) await taskStore.updateTask(task.id, { title: `${task.title} idle-sync-ping` }, 'TEST')
        await canvasStore.requestSync?.('user:manual')
      })

      await page.waitForTimeout(750)
      expect(await readCreatedPositions()).toEqual(before)

      await page.reload()
      await setupCanvas(page)
      await page.waitForFunction((ids) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const canvasStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('canvas')
        const groups = canvasStore?.groups || canvasStore?.sections || canvasStore?._rawGroups || []
        return ids.every((id: string) => groups.some((group: any) => group.id === id))
      }, createdIds, { timeout: 20_000 })

      expect(await readCreatedPositions()).toEqual(before)
      expect(groupWriteLogs, groupWriteLogs.join('\n')).toEqual([])
    } finally {
      await page.evaluate(async (ids) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const canvasStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('canvas')
        if (!canvasStore) return
        for (const id of ids) await canvasStore.deleteGroup?.(id)
      }, createdIds).catch(() => { /* page may be closed after assertion failure */ })
    }
  })

  test('idle sync activity and refresh do not persist task position changes', async ({ page }) => {
    const taskGeometryLogs: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (text.includes('[GEOMETRY-') && text.includes('pos:')) taskGeometryLogs.push(text)
    })

    await seedCanvas(page, [
      { id: 'idle-drift-task-group', name: 'Idle Drift Task Group', x: 1040, y: 260, width: 360, height: 720 },
    ], [])

    await page.waitForFunction(() => {
      const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
      const canvasStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('canvas')
      return (canvasStore?.groups?.length || canvasStore?.sections?.length || canvasStore?._rawGroups?.length || 0) > 0
    }, { timeout: 20_000 })

    const seed = await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const canvasStore = pinia._s.get('canvas')!
      const taskStore = pinia._s.get('tasks')!
      const groups = canvasStore.groups || canvasStore.sections || canvasStore._rawGroups || []
      const group = groups.find((candidate: any) => candidate.name === 'To Do') || groups[0]
      if (!group?.position) throw new Error('Seeded canvas group not found')

      const x = group.position.x + 32
      const taskIds: string[] = []
      for (const item of [
        { title: 'Idle Drift Task A', x, y: group.position.y + 160 },
        { title: 'Idle Drift Task B', x, y: group.position.y + 260 },
        { title: 'Idle Drift Task C', x, y: group.position.y + 360 },
      ]) {
        const task = await taskStore.createTask({
          title: item.title,
          status: 'todo',
          priority: 'medium',
          isInInbox: false,
          parentId: group.id,
          canvasPosition: { x: item.x, y: item.y },
          positionFormat: 'absolute',
        })
        taskIds.push(task.id)
      }

      await canvasStore.requestSync?.('user:manual')
      return { taskIds }
    })

    const readSeedTaskPositions = async () => page.evaluate((taskIds) => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const taskStore = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
      const tasks = taskStore.rawTasks || taskStore.tasks || []
      return taskIds.map((id: string) => {
        const task = tasks.find((candidate: any) => candidate.id === id)
        return task ? {
          id,
          parentId: task.parentId ?? null,
          x: Math.round(task.canvasPosition?.x ?? NaN),
          y: Math.round(task.canvasPosition?.y ?? NaN),
        } : null
      })
    }, seed.taskIds)

    try {
      await page.waitForFunction((taskIds) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const taskStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks')
        const tasks = taskStore?.rawTasks || taskStore?.tasks || []
        return taskIds.every((id: string) => tasks.some((task: any) => task.id === id && task.canvasPosition))
      }, seed.taskIds, { timeout: 15_000 })

      const before = await readSeedTaskPositions()
      expect(before.every(Boolean), JSON.stringify(before, null, 2)).toBe(true)

      await page.evaluate(async () => {
        const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
        const pinia = root.__vue_app__._context.config.globalProperties.$pinia
        const taskStore = pinia._s.get('tasks')!
        const canvasStore = pinia._s.get('canvas')!
        const unrelated = (taskStore.rawTasks || taskStore.tasks || []).find((task: any) => !task.title?.startsWith('Idle Drift Task'))
        if (unrelated) await taskStore.updateTask(unrelated.id, { title: `${unrelated.title} idle-task-sync-ping` }, 'TEST')
        await canvasStore.requestSync?.('user:manual')
      })

      await page.waitForTimeout(750)
      expect(await readSeedTaskPositions()).toEqual(before)

      await page.reload()
      await setupCanvas(page)
      await page.waitForFunction((taskIds) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const taskStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks')
        const tasks = taskStore?.rawTasks || taskStore?.tasks || []
        return taskIds.every((id: string) => tasks.some((task: any) => task.id === id))
      }, seed.taskIds, { timeout: 20_000 })

      expect(await readSeedTaskPositions()).toEqual(before)
      expect(taskGeometryLogs, taskGeometryLogs.join('\n')).toEqual([])
    } finally {
      await page.evaluate(async (taskIds) => {
        const root = document.querySelector('#app') as { __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } } | null
        const taskStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks')
        if (!taskStore) return
        for (const id of taskIds) await taskStore.deleteTask?.(id)
      }, seed.taskIds).catch(() => { /* page may be closed after assertion failure */ })
    }
  })

  test('marking a canvas task done does not shift sibling task geometry', async ({ page }) => {
    const traceLogs: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (text.includes('[CANVAS-DONE-TRACE]')) traceLogs.push(text)
    })

    await seedCanvas(page, [
      { id: 'done-shift-group', name: 'Done Shift Group', x: 180, y: 160, width: 420, height: 900 },
    ], [
      { id: 'done-shift-a', title: 'Done Shift A', parentId: 'done-shift-group', x: 244, y: 252 },
      { id: 'done-shift-b', title: 'Done Shift B', parentId: 'done-shift-group', x: 244, y: 396 },
      { id: 'done-shift-c', title: 'Done Shift C', parentId: 'done-shift-group', x: 244, y: 540 },
    ])

    const trackedIds = ['done-shift-a', 'done-shift-b', 'done-shift-c']
    const beforeStore = await readGeometry(page)
    const beforeTasks = beforeStore.tasks
      .filter((task) => trackedIds.includes(task.id))
      .sort((a, b) => a.id.localeCompare(b.id))
    const beforeRendered = await readRenderedTaskPositions(page, trackedIds)
    const beforeViewport = await readCanvasViewportSnapshot(page)
    const beforeNodes = await readCanvasNodeSnapshot(page, ['section-done-shift-group', ...trackedIds])

    await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      const canvasStore = pinia._s.get('canvas')!

      await taskStore.updateTask('done-shift-b', { status: 'done' }, 'USER')
      await canvasStore.requestSync?.('user:context-menu')
    })

    await page.waitForTimeout(1000)

    const afterStore = await readGeometry(page)
    const afterTasks = afterStore.tasks
      .filter((task) => trackedIds.includes(task.id))
      .sort((a, b) => a.id.localeCompare(b.id))
    const afterRendered = await readRenderedTaskPositions(page, trackedIds)
    const afterViewport = await readCanvasViewportSnapshot(page)
    const afterNodes = await readCanvasNodeSnapshot(page, ['section-done-shift-group', ...trackedIds])
    const beforeTaskGeometry = beforeTasks.map((task) => ({
      id: task.id,
      canvasPosition: task.canvasPosition,
      parentId: task.parentId,
      isInInbox: task.isInInbox,
      positionVersion: task.positionVersion,
    }))
    const afterTaskGeometry = afterTasks.map((task) => ({
      id: task.id,
      canvasPosition: task.canvasPosition,
      parentId: task.parentId,
      isInInbox: task.isInInbox,
      positionVersion: task.positionVersion,
    }))

    expect(afterTaskGeometry, JSON.stringify({ beforeTaskGeometry, afterTaskGeometry, beforeViewport, afterViewport, beforeNodes, afterNodes, traceLogs }, null, 2)).toEqual(beforeTaskGeometry)
    expect(afterRendered[0], JSON.stringify({ beforeRendered, afterRendered, beforeViewport, afterViewport, beforeNodes, afterNodes, traceLogs }, null, 2)).toEqual(beforeRendered[0])
    expect(afterRendered[2], JSON.stringify({ beforeRendered, afterRendered, beforeViewport, afterViewport, beforeNodes, afterNodes, traceLogs }, null, 2)).toEqual(beforeRendered[2])
    expect(afterRendered[1], JSON.stringify({ beforeRendered, afterRendered, traceLogs }, null, 2)).toBeNull()
    expect(traceLogs.some((line) => line.includes('drag-stop:start')), traceLogs.join('\n')).toBe(false)
  })

  test('canvas remains visible when group loading fails after cached tasks load', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'missing-groups-root', name: 'Missing Groups Root', x: 1000, y: 300, width: 420, height: 900 },
    ], [
      { id: 'missing-groups-a', title: 'Missing Groups A', parentId: 'missing-groups-root', x: 1024, y: 420 },
      { id: 'missing-groups-b', title: 'Missing Groups B', parentId: 'missing-groups-root', x: 1024, y: 560 },
    ])

    await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const canvasStore = pinia._s.get('canvas')!

      canvasStore.setGroups([], true)
      await canvasStore.requestSync?.('test:groups-unavailable')
    })

    await page.waitForTimeout(500)

    const rendered = await readRenderedTaskPositions(page, ['missing-groups-a', 'missing-groups-b'])
    expect(rendered.every(Boolean), JSON.stringify(rendered, null, 2)).toBe(true)
  })

  test('startup recovers when the saved viewport points at empty canvas space', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'startup-blank-group', name: 'Startup Blank Group', x: 880, y: 220, width: 420, height: 900 },
    ], [
      { id: 'startup-blank-a', title: 'Startup Blank A', parentId: 'startup-blank-group', x: 920, y: 360 },
      { id: 'startup-blank-b', title: 'Startup Blank B', parentId: 'startup-blank-group', x: 920, y: 500 },
    ])

    await page.evaluate(() => {
      localStorage.setItem('flowstate-canvas-viewport', JSON.stringify({ x: -20000, y: -20000, zoom: 1 }))
    })

    await page.reload()
    await setupCanvas(page)

    await expect.poll(async () => {
      return page.evaluate(() => {
        const container = document.querySelector<HTMLElement>('.canvas-container')
        if (!container) return 0
        const bounds = container.getBoundingClientRect()
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.vue-flow__node'))
          .filter((node) => !node.classList.contains('hidden'))
        const visibleNodes = nodes.filter((node) => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 &&
            rect.height > 0 &&
            rect.right > bounds.left &&
            rect.left < bounds.right &&
            rect.bottom > bounds.top &&
            rect.top < bounds.bottom
        })
        return visibleNodes.length
      })
    }, {
      timeout: 10_000,
      message: 'Expected startup viewport recovery to make at least one canvas node visible',
    }).toBeGreaterThan(0)

    const visibility = await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('.canvas-container')!
      const bounds = container.getBoundingClientRect()
      return Array.from(document.querySelectorAll<HTMLElement>('.vue-flow__node'))
        .filter((node) => !node.classList.contains('hidden'))
        .map((node) => {
          const rect = node.getBoundingClientRect()
          return {
            id: node.dataset.id,
            visible: rect.width > 0 &&
              rect.height > 0 &&
              rect.right > bounds.left &&
              rect.left < bounds.right &&
              rect.bottom > bounds.top &&
              rect.top < bounds.bottom,
          }
        })
    })

    expect(visibility.some((node) => node.visible), JSON.stringify(visibility, null, 2)).toBe(true)

    const persistedViewport = await page.evaluate(() => {
      const raw = localStorage.getItem('flowstate-canvas-viewport')
      return raw ? JSON.parse(raw) as { x: number; y: number; zoom: number } : null
    })

    expect(
      persistedViewport,
      'Startup recovery must heal the saved viewport so Electron restarts do not reopen to empty space',
    ).not.toEqual(expect.objectContaining({ x: -20000, y: -20000 }))
  })

  test('moving one grouped canvas task does not shift sibling task geometry', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'drag-shift-group', name: 'Drag Shift Group', x: 1000, y: 300, width: 420, height: 900 },
    ], [
      { id: 'drag-shift-a', title: 'Drag Shift A', parentId: 'drag-shift-group', x: 1024, y: 420 },
      { id: 'drag-shift-b', title: 'Drag Shift B', parentId: 'drag-shift-group', x: 1024, y: 560 },
      { id: 'drag-shift-c', title: 'Drag Shift C', parentId: 'drag-shift-group', x: 1024, y: 700 },
    ])

    const trackedIds = ['drag-shift-a', 'drag-shift-b', 'drag-shift-c']
    const beforeRendered = await readRenderedTaskPositions(page, trackedIds)
    await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      const canvasUiStore = pinia._s.get('canvasUi')!

      await taskStore.updateTask('drag-shift-b', {
        canvasPosition: { x: 1120, y: 592 },
        positionFormat: 'absolute',
      }, 'DRAG')
      canvasUiStore.requestSync?.('user:manual')
    })
    await page.waitForTimeout(1000)

    const afterRendered = await readRenderedTaskPositions(page, trackedIds)
    const afterStore = await readGeometry(page)
    const movedStore = afterStore.tasks.find((task) => task.id === 'drag-shift-b')
    const siblingStore = afterStore.tasks
      .filter((task) => task.id === 'drag-shift-a' || task.id === 'drag-shift-c')
      .sort((a, b) => a.id.localeCompare(b.id))

    expect(movedStore, JSON.stringify({ afterStore, beforeRendered, afterRendered }, null, 2)).toEqual(
      expect.objectContaining({ id: 'drag-shift-b', x: 1120, y: 592, parentId: 'drag-shift-group' })
    )
    expect(afterRendered[0], JSON.stringify({ afterStore, beforeRendered, afterRendered }, null, 2)).toEqual(beforeRendered[0])
    expect(afterRendered[2], JSON.stringify({ afterStore, beforeRendered, afterRendered }, null, 2)).toEqual(beforeRendered[2])
    expect(afterRendered[1], JSON.stringify({ afterStore, beforeRendered, afterRendered }, null, 2)).not.toEqual(beforeRendered[1])
    expect(siblingStore).toEqual([
      expect.objectContaining({ id: 'drag-shift-a', x: 1024, y: 420, parentId: 'drag-shift-group' }),
      expect.objectContaining({ id: 'drag-shift-c', x: 1024, y: 700, parentId: 'drag-shift-group' }),
    ])
  })

  test('dragging one root canvas task does not nudge unrelated nodes', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'root-drag-g1', name: 'Root Drag G1', x: 760, y: 160, width: 420, height: 900 },
      { id: 'root-drag-g2', name: 'Root Drag G2', x: 1180, y: 160, width: 420, height: 900 },
    ], [
      { id: 'root-drag-a', title: 'Root Drag A', parentId: '', x: 244, y: 252 },
      { id: 'root-drag-b', title: 'Root Drag B', parentId: '', x: 244, y: 396 },
      { id: 'root-drag-c', title: 'Root Drag C', parentId: '', x: 244, y: 540 },
      { id: 'root-drag-grouped', title: 'Root Drag Grouped', parentId: 'root-drag-g1', x: 824, y: 252 },
    ])

    const stableIds = [
      'section-root-drag-g1',
      'section-root-drag-g2',
      'root-drag-a',
      'root-drag-c',
      'root-drag-grouped',
    ]
    const beforeRendered = await readRenderedNodePositions(page, stableIds)
    const beforeViewport = await readCanvasViewportTransform(page)

    await dragRenderedNode(page, 'root-drag-b', 96, 32)
    await page.waitForTimeout(1000)

    const afterRendered = await readRenderedNodePositions(page, stableIds)
    const afterViewport = await readCanvasViewportTransform(page)
    const afterStore = await readGeometry(page)
    const movedTask = afterStore.tasks.find((task) => task.id === 'root-drag-b')

    expect(movedTask, JSON.stringify({ afterStore, beforeRendered, afterRendered }, null, 2)).toEqual(expect.objectContaining({
      id: 'root-drag-b',
    }))
    expect(movedTask?.parentId ?? '', JSON.stringify(movedTask, null, 2)).toBe('')
    expect(movedTask!.x, JSON.stringify(movedTask, null, 2)).not.toBe(244)
    expect(movedTask!.y, JSON.stringify(movedTask, null, 2)).not.toBe(396)
    expect(movedTask!.x % 16, JSON.stringify(movedTask, null, 2)).toBe(0)
    expect(movedTask!.y % 16, JSON.stringify(movedTask, null, 2)).toBe(0)
    expect(afterViewport, JSON.stringify({ beforeViewport, afterViewport }, null, 2)).toEqual(beforeViewport)
    expect(afterRendered, JSON.stringify({ beforeRendered, afterRendered, beforeViewport, afterViewport }, null, 2)).toEqual(beforeRendered)
  })

  test('dragging one group does not nudge unrelated canvas nodes', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'group-drag-g1', name: 'Group Drag G1', x: 180, y: 160, width: 420, height: 900 },
      { id: 'group-drag-g2', name: 'Group Drag G2', x: 760, y: 160, width: 420, height: 900 },
    ], [
      { id: 'group-drag-child-a', title: 'Group Drag Child A', parentId: 'group-drag-g1', x: 244, y: 252 },
      { id: 'group-drag-child-b', title: 'Group Drag Child B', parentId: 'group-drag-g1', x: 244, y: 396 },
      { id: 'group-drag-other', title: 'Group Drag Other', parentId: 'group-drag-g2', x: 824, y: 252 },
      { id: 'group-drag-root', title: 'Group Drag Root', parentId: '', x: 1220, y: 252 },
    ])

    const stableIds = [
      'section-group-drag-g2',
      'group-drag-other',
      'group-drag-root',
    ]
    const childIds = [
      'group-drag-child-a',
      'group-drag-child-b',
    ]
    const beforeStableRendered = await readRenderedNodePositions(page, stableIds)
    const beforeViewport = await readCanvasViewportTransform(page)
    const beforeChildRendered = (await readRenderedNodePositions(page, childIds))
      .map((node) => node ? { id: node.id, transform: node.transform } : node)

    await dragRenderedNode(page, 'section-group-drag-g1', 96, 32)
    await page.waitForTimeout(1000)

    const afterStableRendered = await readRenderedNodePositions(page, stableIds)
    const afterViewport = await readCanvasViewportTransform(page)
    const afterChildRendered = (await readRenderedNodePositions(page, childIds))
      .map((node) => node ? { id: node.id, transform: node.transform } : node)
    const afterStore = await readGeometry(page)
    const movedGroup = afterStore.groups.find((group) => group.id === 'group-drag-g1')

    expect(movedGroup, JSON.stringify({ afterStore, beforeStableRendered, afterStableRendered }, null, 2)).toEqual(expect.objectContaining({
      id: 'group-drag-g1',
    }))
    expect(movedGroup!.x, JSON.stringify(movedGroup, null, 2)).not.toBe(180)
    expect(movedGroup!.y, JSON.stringify(movedGroup, null, 2)).not.toBe(160)
    expect(afterViewport, JSON.stringify({ beforeViewport, afterViewport }, null, 2)).toEqual(beforeViewport)
    expect(afterStableRendered, JSON.stringify({ beforeStableRendered, afterStableRendered, beforeViewport, afterViewport }, null, 2)).toEqual(beforeStableRendered)
    expect(afterChildRendered, JSON.stringify({ beforeChildRendered, afterChildRendered }, null, 2)).not.toEqual(beforeChildRendered)
  })

  test('topology sync after dragging one grouped task does not nudge unrelated nodes', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'nudge-sync-g1', name: 'Nudge Sync G1', x: 180, y: 160, width: 420, height: 900 },
      { id: 'nudge-sync-g2', name: 'Nudge Sync G2', x: 760, y: 160, width: 420, height: 900 },
    ], [
      { id: 'nudge-sync-a', title: 'Nudge Sync A', parentId: 'nudge-sync-g1', x: 244, y: 252 },
      { id: 'nudge-sync-b', title: 'Nudge Sync B', parentId: 'nudge-sync-g1', x: 244, y: 396 },
      { id: 'nudge-sync-c', title: 'Nudge Sync C', parentId: 'nudge-sync-g2', x: 824, y: 252 },
      { id: 'nudge-sync-root', title: 'Nudge Sync Root', parentId: '', x: 1220, y: 252 },
    ])

    const stableIds = [
      'section-nudge-sync-g1',
      'section-nudge-sync-g2',
      'nudge-sync-a',
      'nudge-sync-c',
      'nudge-sync-root',
    ]
    const beforeRendered = (await readRenderedNodePositions(page, stableIds))
      .map((node) => node ? { id: node.id, transform: node.transform } : node)

    await dragRenderedNode(page, 'nudge-sync-b', 96, 32)
    await page.waitForTimeout(800)

    const afterDragStore = await readGeometry(page)
    const movedTask = afterDragStore.tasks.find((task) => task.id === 'nudge-sync-b')
    expect(movedTask, JSON.stringify(afterDragStore, null, 2)).toEqual(expect.objectContaining({
      id: 'nudge-sync-b',
      parentId: 'nudge-sync-g1',
    }))
    expect(movedTask!.x % 16, JSON.stringify(movedTask, null, 2)).toBe(0)
    expect(movedTask!.y % 16, JSON.stringify(movedTask, null, 2)).toBe(0)

    await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      await taskStore.createTask({
        id: 'nudge-sync-new',
        title: 'Nudge Sync New',
        status: 'todo',
        priority: 'medium',
        isInInbox: false,
        canvasPosition: { x: 1220, y: 440 },
        positionFormat: 'absolute',
      })
    })
    await page.waitForTimeout(1200)

    const afterRendered = (await readRenderedNodePositions(page, stableIds))
      .map((node) => node ? { id: node.id, transform: node.transform } : node)
    expect(afterRendered, JSON.stringify({ beforeRendered, afterRendered }, null, 2)).toEqual(beforeRendered)
  })

  test('dragging an inbox task onto the canvas does not nudge existing nodes', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'inbox-drop-g1', name: 'Inbox Drop G1', x: 180, y: 160, width: 420, height: 900 },
      { id: 'inbox-drop-g2', name: 'Inbox Drop G2', x: 760, y: 160, width: 420, height: 900 },
    ], [
      { id: 'inbox-drop-a', title: 'Inbox Drop A', parentId: 'inbox-drop-g1', x: 244, y: 252 },
      { id: 'inbox-drop-b', title: 'Inbox Drop B', parentId: 'inbox-drop-g1', x: 244, y: 396 },
      { id: 'inbox-drop-c', title: 'Inbox Drop C', parentId: 'inbox-drop-g2', x: 824, y: 252 },
      { id: 'inbox-drop-root', title: 'Inbox Drop Root', parentId: '', x: 1220, y: 252 },
    ])

    await page.evaluate(async () => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      await taskStore.createTask({
        id: 'inbox-drop-new',
        title: 'Inbox Drop New',
        status: 'todo',
        priority: 'medium',
        isInInbox: true,
      })
    })

    const expandInboxButton = page.getByRole('button', { name: /expand inbox/i })
    if (await expandInboxButton.isVisible().catch(() => false)) {
      await expandInboxButton.click()
    }
    await expect(page.locator('.unified-inbox-panel .task-card').filter({ hasText: 'Inbox Drop New' })).toBeVisible()

    const stableIds = [
      'section-inbox-drop-g1',
      'section-inbox-drop-g2',
      'inbox-drop-a',
      'inbox-drop-b',
      'inbox-drop-c',
      'inbox-drop-root',
    ]
    const beforeRendered = await readRenderedNodePositions(page, stableIds)
    const beforeViewport = await readCanvasViewportTransform(page)

    await dragInboxTaskToCanvas(page, 'Inbox Drop New', '.vue-flow__node[data-id="section-inbox-drop-g1"]')
    await page.waitForTimeout(1200)

    await expect(page.locator('.vue-flow__node[data-id="inbox-drop-new"]')).toBeVisible()
    const afterRendered = await readRenderedNodePositions(page, stableIds)
    const afterViewport = await readCanvasViewportTransform(page)
    expect(afterViewport, JSON.stringify({ beforeViewport, afterViewport }, null, 2)).toEqual(beforeViewport)
    expect(afterRendered, JSON.stringify({ beforeRendered, afterRendered, beforeViewport, afterViewport }, null, 2)).toEqual(beforeRendered)
  })

  test('tidy keeps compact groups and stacks tasks with vertical spacing', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'alpha', name: 'Project Alpha', x: 900, y: 200, width: 400, height: 1000 },
      { id: 'beta', name: 'Project Beta', x: 100, y: 200, width: 400, height: 1000 },
    ], [
      { id: 'task-a', title: 'A', parentId: 'alpha', x: 920, y: 900 },
      { id: 'task-b', title: 'B', parentId: 'alpha', x: 920, y: 600 },
      { id: 'task-d', title: 'D', parentId: 'beta', x: 120, y: 560 },
    ])

    await clickToolbar(page, /tidy|layout/)
    await page.waitForTimeout(500)

    const geometry = await readGeometry(page)
    const alpha = geometry.groups.find((group) => group.id === 'alpha')!
    const beta = geometry.groups.find((group) => group.id === 'beta')!
    const alphaTasks = geometry.tasks.filter((task) => task.parentId === 'alpha').sort((a, b) => a.y - b.y)

    expect(alpha.width, JSON.stringify(geometry, null, 2)).toBe(400)
    expect(beta.width, JSON.stringify(geometry, null, 2)).toBe(400)
    expect(Math.abs(alpha.x - beta.x), JSON.stringify(geometry, null, 2)).toBe(416)
    expect(new Set([alpha.y, beta.y]).size, JSON.stringify(geometry, null, 2)).toBe(1)
    expect(alphaTasks.map((task) => task.x), JSON.stringify(geometry, null, 2)).toEqual([alpha.x + 20, alpha.x + 20])
    const alphaGaps = await readTaskEdgeGaps(page, ['task-a', 'task-b'])
    expect(alphaGaps.gaps.every((gap) => gap > 0), JSON.stringify(alphaGaps, null, 2)).toBe(true)
  })

  test('tidy day-group button preserves today-first order and compact vertical spacing', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
      { id: 'fri', name: 'Friday', x: 700, y: 200 },
      { id: 'sat', name: 'Saturday', x: 1300, y: 200 },
      { id: 'sun', name: 'Sunday', x: 1900, y: 200 },
      { id: 'mon', name: 'Monday', x: 2500, y: 200 },
      { id: 'tue', name: 'Tuesday', x: 3100, y: 200 },
    ], [
      { id: 'task-fri-a', title: 'Friday A', parentId: 'fri', x: 720, y: 620 },
      { id: 'task-fri-b', title: 'Friday B', parentId: 'fri', x: 720, y: 500 },
      { id: 'task-fri-c', title: 'Friday C', parentId: 'fri', x: 720, y: 380 },
    ])

    await expect.poll(async () => readVisibleGroupOrder(page, ['thu', 'fri', 'sat', 'sun', 'mon', 'tue']))
      .toEqual(['thu', 'fri', 'sat', 'sun', 'mon', 'tue'])

    await clickToolbar(page, /tidy|layout/)

    const todayIndex = new Date().getDay()
    const expectedOrder = expectedWeekdayIds(['thu', 'fri', 'sat', 'sun', 'mon', 'tue'], todayIndex)
    await expect.poll(async () => readVisibleGroupOrder(page, ['thu', 'fri', 'sat', 'sun', 'mon', 'tue']))
      .toEqual(expectedOrder)

    const geometry = await readGeometry(page)
    const friday = geometry.groups.find((group) => group.id === 'fri')!
    const fridayTasks = geometry.tasks.filter((task) => task.parentId === 'fri').sort((a, b) => a.y - b.y || a.x - b.x)

    expect(friday.width, JSON.stringify(geometry, null, 2)).toBe(400)
    expect(fridayTasks.map((task) => task.x), JSON.stringify(geometry, null, 2)).toEqual([friday.x + 20, friday.x + 20, friday.x + 20])
    const fridayGaps = await readTaskEdgeGaps(page, ['task-fri-a', 'task-fri-b', 'task-fri-c'])
    expect(fridayGaps.gaps.every((gap) => gap > 0), JSON.stringify(fridayGaps, null, 2)).toBe(true)
  })

  test('tidy stacks variable-height cards without overlap', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
      { id: 'fri', name: 'Friday', x: 700, y: 200 },
    ], [
      { id: 'task-thu-a', title: 'Long Thursday task title that wraps across multiple lines in the card', parentId: 'thu', x: 120, y: 380 },
      { id: 'task-thu-b', title: 'Another wrapped Thursday task title with enough text to grow vertically', parentId: 'thu', x: 120, y: 500 },
      { id: 'task-thu-c', title: 'Third wrapped Thursday task title to catch overlap at zoomed viewport sizes', parentId: 'thu', x: 120, y: 620 },
    ])

    await page.waitForTimeout(2600)
    await clickToolbar(page, /tidy|layout/)

    await expect.poll(async () => {
      const gaps = await readTaskEdgeGaps(page, ['task-thu-a', 'task-thu-b', 'task-thu-c'])
      return gaps.gaps.every((gap) => gap > 0)
    }).toBe(true)
  })

  test('rotate orders Today, Tomorrow, then the day after tomorrow on Monday', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'wed', name: 'Wednesday', x: 3000, y: 200 },
      { id: 'mon', name: 'Monday', x: 1400, y: 200 },
      { id: 'today', name: 'Today', x: 900, y: 200 },
      { id: 'tomorrow', name: 'Tomorrow', x: 2200, y: 200 },
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
    ], [])

    await clickToolbar(page, /rotate/)
    await page.waitForTimeout(500)

    const geometry = await readGeometry(page)
    const order = [...geometry.groups]
      .sort((a, b) => a.x - b.x)
      .map((group) => group.name)

    const todayIndex = new Date().getDay()
    const expectedAfterSmart = expectedWeekdayNames(['Wednesday', 'Monday', 'Thursday'], (todayIndex + 2) % 7)
    expect(order.slice(0, 4), JSON.stringify(geometry, null, 2)).toEqual(['Today', 'Tomorrow', ...expectedAfterSmart].slice(0, 4))
    expect(geometry.groups.map((group) => group.width), JSON.stringify(geometry, null, 2)).toEqual([400, 400, 400, 400, 400])
  })

  test('rotate and tidy complement each other without resetting order', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'wed', name: 'Wednesday', x: 3000, y: 200 },
      { id: 'mon', name: 'Monday', x: 1400, y: 200 },
      { id: 'today', name: 'Today', x: 900, y: 200 },
      { id: 'tomorrow', name: 'Tomorrow', x: 2200, y: 200 },
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
    ], [
      { id: 'task-wed-a', title: 'Wednesday A', parentId: 'wed', x: 3020, y: 760 },
      { id: 'task-wed-b', title: 'Wednesday B', parentId: 'wed', x: 3020, y: 640 },
    ])

    await clickToolbar(page, /rotate/)
    const todayIndex = new Date().getDay()
    const expectedAfterSmart = expectedWeekdayIds(['wed', 'mon', 'thu'], (todayIndex + 2) % 7)
    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'mon', 'today', 'tomorrow', 'thu']))
      .toEqual(['today', 'tomorrow', ...expectedAfterSmart])

    await clickToolbar(page, /tidy|layout/)
    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'mon', 'today', 'tomorrow', 'thu']))
      .toEqual(['today', 'tomorrow', ...expectedAfterSmart])

    let geometry = await readGeometry(page)
    let wednesday = geometry.groups.find((group) => group.id === 'wed')!
    expect(wednesday.width, JSON.stringify(geometry, null, 2)).toBe(400)
    await expect.poll(async () => {
      const gaps = await readTaskEdgeGaps(page, ['task-wed-a', 'task-wed-b'])
      return gaps.gaps[0] > 0
    }).toBe(true)

    await clickToolbar(page, /rotate/)
    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'mon', 'today', 'tomorrow', 'thu']))
      .toEqual(['today', 'tomorrow', ...expectedAfterSmart])

    geometry = await readGeometry(page)
    wednesday = geometry.groups.find((group) => group.id === 'wed')!
    expect(wednesday.width, JSON.stringify(geometry, null, 2)).toBe(400)
    await expect.poll(async () => {
      const gaps = await readTaskEdgeGaps(page, ['task-wed-a', 'task-wed-b'])
      return gaps.gaps[0] > 0
    }).toBe(true)
  })

  test('rotate weekday-only groups starts from the current weekday', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'wed', name: 'Wednesday', x: 3000, y: 200 },
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
      { id: 'sat', name: 'Saturday', x: 1800, y: 200 },
      { id: 'mon', name: 'Monday', x: 2400, y: 200 },
      { id: 'tue', name: 'Tuesday', x: 3600, y: 200 },
    ], [])

    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'thu', 'sat', 'mon', 'tue']))
      .toEqual(['thu', 'sat', 'mon', 'wed', 'tue'])

    await clickToolbar(page, /rotate/)
    await page.waitForTimeout(500)

    const geometry = await readGeometry(page)
    const order = [...geometry.groups]
      .sort((a, b) => a.x - b.x)
      .map((group) => group.name)

    const todayIndex = new Date().getDay()
    const expectedOrder = expectedWeekdayNames(['Wednesday', 'Thursday', 'Saturday', 'Monday', 'Tuesday'], todayIndex)
    expect(order, JSON.stringify(geometry, null, 2)).toEqual(expectedOrder)

    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'thu', 'sat', 'mon', 'tue']))
      .toEqual(expectedWeekdayIds(['wed', 'thu', 'sat', 'mon', 'tue'], todayIndex))
  })
})
