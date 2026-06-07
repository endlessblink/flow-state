import { test, expect } from '../fixtures/auth'

async function seedCalendarInboxTasks(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const app = document.querySelector('#app') as {
      __vue_app__?: {
        _context?: {
          config?: {
            globalProperties?: {
              $pinia?: { _s: Map<string, any> }
            }
          }
        }
      }
    } | null
    const taskStore = app?.__vue_app__?._context?.config?.globalProperties?.$pinia?._s.get('tasks')
    const canvasStore = app?.__vue_app__?._context?.config?.globalProperties?.$pinia?._s.get('canvas')
    if (!taskStore?.createTask) throw new Error('Task store not available')

    const canvasGroup = canvasStore?.createGroup
      ? await canvasStore.createGroup({
          name: 'Calendar Inbox QA',
          type: 'custom',
          color: '#14b8a6',
          position: { x: 0, y: 0, width: 420, height: 260 },
          isVisible: true,
          isCollapsed: false,
          parentGroupId: null
        })
      : null

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const titles = [
      'לקנות כיסא חדש לעבודה',
      'לעשות סרטון על מערכת הרמס המקומית',
      'לקנות נעלי ספורט',
      'להכין דוחות דרך ההפקה',
      'לשים צלחות נקיות',
      'Review calendar inbox spacing',
      'Write focused regression notes',
      'Check hover actions alignment',
      'Completed calendar inbox task should stay hidden'
    ]

    const createdIds: string[] = []
    for (const [index, title] of titles.entries()) {
      const task = await taskStore.createTask({
        title,
        status: index === 8 ? 'done' : index === 3 ? 'in_progress' : 'todo',
        priority: index === 3 ? 'high' : 'medium',
        dueDate: index === 1 || index === 3 ? today : undefined,
        estimatedDuration: index === 3 ? 15 : undefined,
        canvasPosition: index === 6 && canvasGroup ? { x: 80, y: 80 } : undefined,
        isInInbox: true
      })
      if (task?.id) createdIds.push(task.id)
    }
    return createdIds
  })
}

test.describe('Calendar inbox layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
      localStorage.setItem('flowstate:cal-inbox-hide-done', 'true')
    })
  })

  test('renders the dedicated calendar inbox instead of the canvas inbox shell', async ({ page }) => {
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')

    const inbox = page.locator('.calendar-inbox-panel').first()
    await expect(inbox).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.unified-inbox-panel')).toHaveCount(0)

    const styles = await inbox.evaluate((element) => {
      const computed = window.getComputedStyle(element)
      return {
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        width: element.getBoundingClientRect().width,
        marginTop: computed.marginTop
      }
    })

    expect(styles.borderRadius).not.toBe('0px')
    expect(styles.boxShadow).not.toBe('none')
    expect(styles.width).toBeGreaterThanOrEqual(300)
    expect(styles.width).toBeLessThanOrEqual(340)
    expect(styles.marginTop).not.toBe('0px')
  })

  test('keeps quick add, RTL task cards, hover actions, and scrolling visually contained', async ({ page }) => {
    await page.setViewportSize({ width: 1705, height: 967 })
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await seedCalendarInboxTasks(page)
    await page.waitForTimeout(500)

    const inbox = page.locator('.calendar-inbox-panel').first()
    await expect(inbox).toBeVisible({ timeout: 10000 })

    const quickAdd = page.locator('.calendar-inbox-panel .quick-add-field').first()
    const brainDump = page.locator('.calendar-inbox-panel .brain-dump-toggle').first()
    const completedTask = page.locator('.calendar-inbox-panel .task-card', { hasText: 'Completed calendar inbox task should stay hidden' })
    await expect(quickAdd).toBeVisible()
    await expect(brainDump).toBeVisible()
    await expect(completedTask).toHaveCount(0)

    const controlLayout = await page.evaluate(() => {
      const quick = document.querySelector('.calendar-inbox-panel .quick-add-field')?.getBoundingClientRect()
      const brain = document.querySelector('.calendar-inbox-panel .brain-dump-toggle')?.getBoundingClientRect()
      return quick && brain
        ? {
            gap: brain.top - quick.bottom,
            quickHeight: quick.height,
            brainHeight: brain.height,
            quickWidth: quick.width,
            brainWidth: brain.width
          }
        : null
    })
    expect(controlLayout).not.toBeNull()
    expect(controlLayout!.gap).toBeGreaterThanOrEqual(6)
    expect(controlLayout!.quickHeight).toBeGreaterThan(controlLayout!.brainHeight)
    expect(controlLayout!.quickWidth).toBeGreaterThan(260)
    expect(controlLayout!.brainWidth).toBeGreaterThan(260)

    const firstHebrewCard = page.locator('.calendar-inbox-panel .task-card', { hasText: 'לקנות כיסא חדש לעבודה' }).first()
    await expect(firstHebrewCard).toBeVisible()
    await firstHebrewCard.hover()
    await page.waitForTimeout(100)

    const hoverLayout = await firstHebrewCard.evaluate((card) => {
      const title = card.querySelector('.task-title .overflow-text')?.getBoundingClientRect()
      const actions = card.querySelector('.task-actions')?.getBoundingClientRect()
      const cardBox = card.getBoundingClientRect()
      return title && actions
        ? {
            titleRight: title.right,
            actionsLeft: actions.left,
            actionsRight: actions.right,
            cardRight: cardBox.right,
            cardLeft: cardBox.left
          }
        : null
    })
    expect(hoverLayout).not.toBeNull()
    expect(hoverLayout!.titleRight).toBeLessThanOrEqual(hoverLayout!.actionsLeft - 4)
    expect(hoverLayout!.actionsRight).toBeLessThanOrEqual(hoverLayout!.cardRight - 4)
    expect(hoverLayout!.actionsLeft).toBeGreaterThan(hoverLayout!.cardLeft)

    const scrollContainment = await page.evaluate(() => {
      const list = document.querySelector('.calendar-inbox-panel .inbox-tasks')
      const last = document.querySelector('.calendar-inbox-panel .task-card:last-child')
      if (!list || !last) return null
      list.scrollTop = list.scrollHeight
      const listBox = list.getBoundingClientRect()
      const lastBox = last.getBoundingClientRect()
      return {
        listBottom: listBox.bottom,
        lastBottom: lastBox.bottom,
        overflowY: window.getComputedStyle(list).overflowY,
        minHeight: window.getComputedStyle(list).minHeight
      }
    })
    expect(scrollContainment).not.toBeNull()
    expect(scrollContainment!.overflowY).toBe('auto')
    expect(scrollContainment!.minHeight).toBe('0px')
    expect(scrollContainment!.lastBottom).toBeLessThanOrEqual(scrollContainment!.listBottom)
  })

  test('keeps expanded filter chips and select menus contained inside the calendar inbox panel', async ({ page }) => {
    await page.setViewportSize({ width: 688, height: 781 })
    await page.goto('/#/calendar')
    await page.waitForLoadState('networkidle')
    await seedCalendarInboxTasks(page)
    await page.waitForTimeout(500)

    const inbox = page.locator('.calendar-inbox-panel').first()
    await expect(inbox).toBeVisible({ timeout: 10000 })

    const filtersToggle = inbox.locator('.toggle-filters-btn')
    await filtersToggle.click()

    const containment = await inbox.evaluate((panel) => {
      const panelBox = panel.getBoundingClientRect()
      const controls = [...panel.querySelectorAll('.sort-btn, .filter-chip, .clear-filters-btn')]
      return controls.map((control) => {
        const box = control.getBoundingClientRect()
        return {
          left: box.left,
          right: box.right,
          panelLeft: panelBox.left,
          panelRight: panelBox.right,
        }
      })
    })

    expect(containment.length).toBeGreaterThan(0)
    for (const box of containment) {
      expect(box.left).toBeGreaterThanOrEqual(box.panelLeft - 1)
      expect(box.right).toBeLessThanOrEqual(box.panelRight + 1)
    }

    await inbox.locator('.canvas-group-filter .select-trigger').click()
    const dropdownBox = await page.locator('.select-dropdown').first().evaluate((dropdown) => {
      const box = dropdown.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        viewportWidth: window.innerWidth,
      }
    })
    expect(dropdownBox.left).toBeGreaterThanOrEqual(0)
    expect(dropdownBox.right).toBeLessThanOrEqual(dropdownBox.viewportWidth)
  })
})
