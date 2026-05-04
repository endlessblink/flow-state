import { expect, test, type Page } from '@playwright/test'

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

  await page.waitForFunction(({ groups, tasks }) => {
    return groups.every((group) => document.querySelector(`[data-id="section-${group.id}"]`))
      && tasks.every((task) => document.querySelector(`[data-id="${task.id}"]`))
  }, { groups, tasks }, { timeout: 15_000 })
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

test.describe('local canvas geometry regressions', () => {
  test.beforeEach(async ({ page }) => {
    await setupCanvas(page)
  })

  test('tidy keeps compact groups and lays tasks side-by-side with small gaps', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'alpha', name: 'Project Alpha', x: 900, y: 620, width: 400, height: 1000 },
      { id: 'beta', name: 'Project Beta', x: 100, y: 500, width: 400, height: 1000 },
    ], [
      { id: 'task-a', title: 'A', parentId: 'alpha', x: 920, y: 780 },
      { id: 'task-b', title: 'B', parentId: 'alpha', x: 920, y: 660 },
      { id: 'task-d', title: 'D', parentId: 'beta', x: 120, y: 560 },
    ])

    await clickToolbar(page, /tidy|layout/)
    await page.waitForTimeout(500)

    const geometry = await readGeometry(page)
    const alpha = geometry.groups.find((group) => group.id === 'alpha')!
    const beta = geometry.groups.find((group) => group.id === 'beta')!
    const alphaTasks = geometry.tasks.filter((task) => task.parentId === 'alpha').sort((a, b) => a.x - b.x)

    expect(alpha.width, JSON.stringify(geometry, null, 2)).toBe(700)
    expect(beta.width, JSON.stringify(geometry, null, 2)).toBe(400)
    expect(Math.abs(alpha.x - beta.x), JSON.stringify(geometry, null, 2)).toBe(416)
    expect(new Set([alpha.y, beta.y]).size, JSON.stringify(geometry, null, 2)).toBe(1)
    expect(alphaTasks.map((task) => task.y), JSON.stringify(geometry, null, 2)).toEqual([alpha.y + 70, alpha.y + 70])
    expect(alphaTasks[1].x - alphaTasks[0].x, JSON.stringify(geometry, null, 2)).toBe(240)
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

    expect(order.slice(0, 4), JSON.stringify(geometry, null, 2)).toEqual(['Today', 'Tomorrow', 'Wednesday', 'Thursday'])
    expect(geometry.groups.map((group) => group.width), JSON.stringify(geometry, null, 2)).toEqual([400, 400, 400, 400, 400])
  })

  test('rotate weekday-only groups starts from the current weekday', async ({ page }) => {
    await seedCanvas(page, [
      { id: 'wed', name: 'Wednesday', x: 3000, y: 200 },
      { id: 'thu', name: 'Thursday', x: 100, y: 200 },
      { id: 'sat', name: 'Saturday', x: 1800, y: 200 },
      { id: 'mon', name: 'Monday', x: 2400, y: 200 },
      { id: 'tue', name: 'Tuesday', x: 3600, y: 200 },
    ], [])

    await clickToolbar(page, /rotate/)
    await page.waitForTimeout(500)

    const geometry = await readGeometry(page)
    const order = [...geometry.groups]
      .sort((a, b) => a.x - b.x)
      .map((group) => group.name)

    expect(order, JSON.stringify(geometry, null, 2)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'])
  })
})
