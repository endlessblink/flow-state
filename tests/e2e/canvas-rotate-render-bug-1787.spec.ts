/**
 * BUG-1787 regression: clicking the rotate-days toolbar button must keep all
 * tasks visually rendered inside their groups. Before the fix, the count
 * badge would show N but the group rectangle would appear empty because
 * Vue Flow node positions got out of sync with Pinia after rotation.
 *
 * This test seeds canvas day groups with multiple tasks each, clicks rotate,
 * and asserts every task's DOM element is still positioned inside its
 * parent group's bounding rect.
 */

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
    settingsStore.enableDayGroupSuggestions = true
    settingsStore.enableDayGroupPositionRotation = true
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

/**
 * Read every task's bounding rect and its parent group's bounding rect.
 * Returns { taskId, parentId, taskRect, parentRect, fullyInside } per task.
 */
const readTaskContainment = async (page: Page, taskIds: string[]) => page.evaluate((taskIds) => {
  const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
  const pinia = root.__vue_app__._context.config.globalProperties.$pinia
  const taskStore = pinia._s.get('tasks')!

  return taskIds.map((id) => {
    const taskRow = taskStore.rawTasks.find((t: any) => t.id === id)
    const parentId = taskRow?.parentId as string | undefined

    const taskEl = document.querySelector(`[data-id="${id}"]`)?.closest('.vue-flow__node') as HTMLElement | null
    const parentEl = parentId
      ? (document.querySelector(`[data-id="section-${parentId}"]`)?.closest('.vue-flow__node') as HTMLElement | null)
      : null

    const taskRect = taskEl?.getBoundingClientRect()
    const parentRect = parentEl?.getBoundingClientRect()

    if (!taskRect || !parentRect) {
      return { id, parentId, hasDom: !!taskEl, parentHasDom: !!parentEl, fullyInside: false }
    }

    // A task is "fully inside" its parent group if its center is within the
    // parent's bounding rect. We use center (not all four corners) to allow
    // for the natural overflow some cards have via shadow/border.
    const centerX = taskRect.left + taskRect.width / 2
    const centerY = taskRect.top + taskRect.height / 2
    const fullyInside =
      centerX >= parentRect.left &&
      centerX <= parentRect.right &&
      centerY >= parentRect.top &&
      centerY <= parentRect.bottom

    return {
      id,
      parentId,
      hasDom: true,
      parentHasDom: true,
      fullyInside,
      taskCenter: { x: Math.round(centerX), y: Math.round(centerY) },
      parentBounds: {
        left: Math.round(parentRect.left),
        right: Math.round(parentRect.right),
        top: Math.round(parentRect.top),
        bottom: Math.round(parentRect.bottom),
      },
    }
  })
}, taskIds)

test.describe('BUG-1787: rotate-days keeps tasks visible inside their groups', () => {
  test.beforeEach(async ({ page }) => {
    await setupCanvas(page)
  })

  test('all tasks remain visually inside their groups after rotate-days click', async ({ page }) => {
    // Seed: 3 day-of-week groups + Today + Tomorrow, with multiple tasks each.
    // This mirrors the user's reported screenshot where Tuesday counted 12
    // but the group rect was visually empty.
    await seedCanvas(page, [
      { id: 'today-grp', name: 'Today', x: 100, y: 200, width: 400, height: 800 },
      { id: 'tomorrow-grp', name: 'Tomorrow', x: 600, y: 200, width: 400, height: 800 },
      { id: 'tuesday-grp', name: 'Tuesday', x: 1100, y: 200, width: 400, height: 800 },
      { id: 'wednesday-grp', name: 'Wednesday', x: 1600, y: 200, width: 400, height: 800 },
    ], [
      // Today (2 tasks)
      { id: 'today-1', title: 'T1', parentId: 'today-grp', x: 120, y: 280 },
      { id: 'today-2', title: 'T2', parentId: 'today-grp', x: 120, y: 360 },
      // Tomorrow (1 task)
      { id: 'tomorrow-1', title: 'Tom1', parentId: 'tomorrow-grp', x: 620, y: 280 },
      // Tuesday (5 tasks — mimic the high-count case)
      { id: 'tue-1', title: 'Tue1', parentId: 'tuesday-grp', x: 1120, y: 280 },
      { id: 'tue-2', title: 'Tue2', parentId: 'tuesday-grp', x: 1120, y: 360 },
      { id: 'tue-3', title: 'Tue3', parentId: 'tuesday-grp', x: 1120, y: 440 },
      { id: 'tue-4', title: 'Tue4', parentId: 'tuesday-grp', x: 1120, y: 520 },
      { id: 'tue-5', title: 'Tue5', parentId: 'tuesday-grp', x: 1120, y: 600 },
      // Wednesday (3 tasks)
      { id: 'wed-1', title: 'Wed1', parentId: 'wednesday-grp', x: 1620, y: 280 },
      { id: 'wed-2', title: 'Wed2', parentId: 'wednesday-grp', x: 1620, y: 360 },
      { id: 'wed-3', title: 'Wed3', parentId: 'wednesday-grp', x: 1620, y: 440 },
    ])

    const taskIds = [
      'today-1', 'today-2',
      'tomorrow-1',
      'tue-1', 'tue-2', 'tue-3', 'tue-4', 'tue-5',
      'wed-1', 'wed-2', 'wed-3',
    ]

    // Sanity: tasks are visible inside groups BEFORE rotation.
    const before = await readTaskContainment(page, taskIds)
    const beforeMissing = before.filter((t) => !t.hasDom)
    expect(beforeMissing.length, `Tasks missing DOM before rotate: ${JSON.stringify(beforeMissing)}`).toBe(0)

    // Click the rotate-days toolbar button.
    await clickToolbar(page, /rotate/)

    // Give the canvas time to settle: rotation does double-nextTick + force sync.
    await page.waitForTimeout(800)

    // After rotation, EVERY seeded task must still have:
    //   1. A DOM element in Vue Flow
    //   2. A parent group with a DOM element
    //   3. Its center positioned inside its parent's bounding rect
    const after = await readTaskContainment(page, taskIds)

    const missing = after.filter((t) => !t.hasDom)
    expect(missing.length, `BUG-1787: tasks missing DOM after rotate: ${JSON.stringify(missing, null, 2)}`).toBe(0)

    const orphaned = after.filter((t) => !t.parentHasDom)
    expect(orphaned.length, `BUG-1787: tasks with missing parent DOM after rotate: ${JSON.stringify(orphaned, null, 2)}`).toBe(0)

    const outsideParent = after.filter((t) => !t.fullyInside)
    expect(outsideParent.length, `BUG-1787: tasks rendered OUTSIDE their parent group after rotate (this is the bug — count badge would show them but they're invisible inside the rect): ${JSON.stringify(outsideParent, null, 2)}`).toBe(0)
  })

  test('rotate updates Today/Tomorrow group children dueDate (BUG-1787 part 2)', async ({ page }) => {
    // Direct dueDate-staleness check: tasks parented to Today/Tomorrow should
    // have their dueDate rewritten on rotate, not just day-of-week children.
    await seedCanvas(page, [
      { id: 'today-grp', name: 'Today', x: 100, y: 200, width: 400, height: 800 },
      { id: 'tomorrow-grp', name: 'Tomorrow', x: 600, y: 200, width: 400, height: 800 },
    ], [
      { id: 'today-stale', title: 'Stale Today', parentId: 'today-grp', x: 120, y: 280 },
      { id: 'tomorrow-stale', title: 'Stale Tomorrow', parentId: 'tomorrow-grp', x: 620, y: 280 },
    ])

    // Force stale dueDate on both tasks (write directly through the store).
    await page.evaluate(() => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      taskStore.updateTask('today-stale', { dueDate: '2020-01-01' }, 'USER')
      taskStore.updateTask('tomorrow-stale', { dueDate: '2020-01-01' }, 'USER')
    })

    await clickToolbar(page, /rotate/)
    await page.waitForTimeout(800)

    const dates = await page.evaluate(() => {
      const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
      const pinia = root.__vue_app__._context.config.globalProperties.$pinia
      const taskStore = pinia._s.get('tasks')!
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return {
        todayTaskDate: taskStore.rawTasks.find((t: any) => t.id === 'today-stale')?.dueDate?.slice(0, 10),
        tomorrowTaskDate: taskStore.rawTasks.find((t: any) => t.id === 'tomorrow-stale')?.dueDate?.slice(0, 10),
        expectedToday: fmt(today),
        expectedTomorrow: fmt(tomorrow),
      }
    })

    expect(dates.todayTaskDate, 'Today-group child should have dueDate = today after rotate').toBe(dates.expectedToday)
    expect(dates.tomorrowTaskDate, 'Tomorrow-group child should have dueDate = tomorrow after rotate').toBe(dates.expectedTomorrow)
  })
})
