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
    const element = document.querySelector(`[data-id="${id}"]`) as HTMLElement | null
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
  test.beforeEach(async ({ page }) => {
    await setupCanvas(page)
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
    expect(alphaTasks[0].y, JSON.stringify(geometry, null, 2)).toBeGreaterThan(alpha.y + 300)
    const alphaGaps = await readTaskEdgeGaps(page, ['task-a', 'task-b'])
    expect(alphaGaps.gaps, JSON.stringify(alphaGaps, null, 2)).toEqual([22])
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
    expect(fridayGaps.gaps, JSON.stringify(fridayGaps, null, 2)).toEqual([22, 22])
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
    let wednesdayGaps = await readTaskEdgeGaps(page, ['task-wed-a', 'task-wed-b'])
    expect(wednesdayGaps.gaps, JSON.stringify(wednesdayGaps, null, 2)).toEqual([22])

    await clickToolbar(page, /rotate/)
    await expect.poll(async () => readVisibleGroupOrder(page, ['wed', 'mon', 'today', 'tomorrow', 'thu']))
      .toEqual(['today', 'tomorrow', ...expectedAfterSmart])

    geometry = await readGeometry(page)
    wednesday = geometry.groups.find((group) => group.id === 'wed')!
    expect(wednesday.width, JSON.stringify(geometry, null, 2)).toBe(400)
    wednesdayGaps = await readTaskEdgeGaps(page, ['task-wed-a', 'task-wed-b'])
    expect(wednesdayGaps.gaps, JSON.stringify(wednesdayGaps, null, 2)).toEqual([22])
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
