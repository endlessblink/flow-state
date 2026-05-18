import { expect, test, type Page } from '@playwright/test'

type TaskStoreLike = {
  rawTasks: Array<{ id: string; title: string }>
  clearAll: () => void
  createTask: (task: Record<string, unknown>) => Promise<{ id: string } | undefined>
  deleteTaskWithUndo: (taskId: string) => Promise<void>
}

declare global {
  interface Window {
    __flowstateTestTaskStore?: () => TaskStoreLike
  }
}

const setupApp = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true, weekStartsOn: 1 }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    window.__flowstateTestTaskStore = () => {
      const root = document.querySelector('#app') as {
        __vue_app__?: {
          _context: {
            config: {
              globalProperties: {
                $pinia: { _s: Map<string, unknown> }
              }
            }
          }
        }
      } | null

      const taskStore = root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks') as TaskStoreLike | undefined
      if (!taskStore) throw new Error('Task store is not available')
      return taskStore
    }
  })

  await page.goto('/#/tasks')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as {
      __vue_app__?: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } }
    } | null
    return !!root?.__vue_app__?._context.config.globalProperties.$pinia._s.get('tasks')
  }, { timeout: 30_000 })
}

const seedTask = async (page: Page, taskId: string, title: string) => {
  await page.evaluate(async ({ taskId, title }) => {
    const taskStore = window.__flowstateTestTaskStore!()
    taskStore.clearAll()
    await taskStore.createTask({
      id: taskId,
      title,
      status: 'todo',
      priority: 'medium',
      isInInbox: true,
    })
  }, { taskId, title })

  await expect.poll(async () => page.evaluate((taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    return taskStore.rawTasks.some(task => task.id === taskId)
  }, taskId), { timeout: 10_000 }).toBe(true)
}

const deleteWithUndo = async (page: Page, taskId: string) => {
  await page.evaluate(async (taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    await taskStore.deleteTaskWithUndo(taskId)
  }, taskId)

  await expect.poll(async () => page.evaluate((taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    return taskStore.rawTasks.some(task => task.id === taskId)
  }, taskId), { timeout: 10_000 }).toBe(false)
}

const deleteVisibleTaskViaContextMenu = async (page: Page, taskId: string, title: string) => {
  const taskText = page.getByText(title).first()
  await expect(taskText).toBeVisible({ timeout: 10_000 })
  await taskText.click({ button: 'right' })

  const deleteOption = page.locator(
    '[role="menu"] [role="menuitem"]:has-text("Delete"), [role="menu"] li:has-text("Delete"), .context-menu button:has-text("Delete"), button.menu-item:has-text("Delete")'
  ).first()
  await expect(deleteOption).toBeVisible({ timeout: 5_000 })
  await deleteOption.click()

  const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")').first()
  if (await confirmButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await confirmButton.click()
  }

  await expect.poll(async () => page.evaluate((taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    return taskStore.rawTasks.some(task => task.id === taskId)
  }, taskId), { timeout: 10_000 }).toBe(false)
  await expect(page.getByText(title).first()).not.toBeVisible({ timeout: 10_000 })
}

const pressCtrlZAndMeasureRestore = async (page: Page, taskId: string) => {
  const startedAt = Date.now()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')

  await expect.poll(async () => page.evaluate((taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    return taskStore.rawTasks.some(task => task.id === taskId)
  }, taskId), {
    intervals: [25, 50, 100, 200, 500],
    timeout: 5_000,
  }).toBe(true)

  return Date.now() - startedAt
}

const pressCtrlZAndMeasureVisibleRestore = async (page: Page, taskId: string, title: string) => {
  const startedAt = Date.now()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')

  await expect.poll(async () => page.evaluate((taskId) => {
    const taskStore = window.__flowstateTestTaskStore!()
    return taskStore.rawTasks.some(task => task.id === taskId)
  }, taskId), {
    intervals: [25, 50, 100, 200, 500],
    timeout: 5_000,
  }).toBe(true)
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 5_000 })

  return Date.now() - startedAt
}

test.describe('delete undo responsiveness', () => {
  test('second Ctrl+Z restores the same deleted task without lag', async ({ page }) => {
    await setupApp(page)

    const taskId = `undo-lag-${Date.now()}`
    const title = `Undo lag regression ${Date.now()}`
    await seedTask(page, taskId, title)

    await deleteWithUndo(page, taskId)
    const firstUndoMs = await pressCtrlZAndMeasureRestore(page, taskId)

    await deleteWithUndo(page, taskId)
    const secondUndoMs = await pressCtrlZAndMeasureRestore(page, taskId)

    expect({ firstUndoMs, secondUndoMs }).toEqual({
      firstUndoMs: expect.any(Number),
      secondUndoMs: expect.any(Number),
    })
    expect(secondUndoMs, `first undo: ${firstUndoMs}ms, second undo: ${secondUndoMs}ms`).toBeLessThan(500)
  })

  test('second real UI delete plus Ctrl+Z restores without lag', async ({ page }) => {
    await setupApp(page)

    const taskId = `undo-ui-lag-${Date.now()}`
    const title = `Undo UI lag regression ${Date.now()}`
    await seedTask(page, taskId, title)

    await deleteVisibleTaskViaContextMenu(page, taskId, title)
    const firstUndoMs = await pressCtrlZAndMeasureVisibleRestore(page, taskId, title)

    await deleteVisibleTaskViaContextMenu(page, taskId, title)
    const secondUndoMs = await pressCtrlZAndMeasureVisibleRestore(page, taskId, title)

    expect(secondUndoMs, `first undo: ${firstUndoMs}ms, second undo: ${secondUndoMs}ms`).toBeLessThan(500)
  })
})
