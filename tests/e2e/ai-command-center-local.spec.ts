import { expect, test } from '@playwright/test'

test('renders the real command center from a synthetic day plan without mutation', async ({ page }) => {
  await page.goto('/src/main.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    const now = new Date().toISOString()
    const tasks = [
      {
        id: 'task1856-synthetic-1',
        title: 'Prepare synthetic launch notes',
        description: 'Synthetic acceptance data only.',
        status: 'todo',
        priority: 'high',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: 'uncategorized',
        isUncategorized: true,
        isInInbox: true,
        canvasDismissed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task1856-synthetic-2',
        title: 'Review synthetic release evidence',
        description: 'Synthetic acceptance data only.',
        status: 'todo',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: 'uncategorized',
        isUncategorized: true,
        isInInbox: true,
        canvasDismissed: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    localStorage.clear()
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    localStorage.setItem('flowstate-guest-tasks', JSON.stringify(tasks))
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    localStorage.setItem('flowstate-ai-settings', JSON.stringify({
      provider: 'bridge',
      model: 'codex',
      chatDirection: 'ltr',
      chatLanguage: 'en',
    }))
    localStorage.setItem('flowstate-ai-conversations', JSON.stringify({
      activeConversationId: 'task1856-synthetic-conversation',
      conversations: [{
        id: 'task1856-synthetic-conversation',
        title: 'Synthetic command center acceptance',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'task1856-synthetic-user',
            role: 'user',
            content: 'Plan my synthetic day',
            timestamp: now,
          },
          {
            id: 'task1856-synthetic-assistant',
            role: 'assistant',
            content: 'Review this synthetic order before applying anything.',
            timestamp: now,
            metadata: {
              cardGroups: {
                kind: 'day_plan',
                total: 2,
                groups: [
                  {
                    name: 'First focus block',
                    tasks: [{
                      id: 'task1856-synthetic-1',
                      title: 'Prepare synthetic launch notes',
                      status: 'todo',
                      priority: 'high',
                      reason: 'Unblocks the synthetic release review.',
                    }],
                  },
                  {
                    name: 'Second focus block',
                    tasks: [{
                      id: 'task1856-synthetic-2',
                      title: 'Review synthetic release evidence',
                      status: 'todo',
                      priority: 'medium',
                      reason: 'Verifies the synthetic release after the first block.',
                    }],
                  },
                ],
              },
            },
          },
        ],
      }],
    }))
  })

  await page.goto('/#/canvas')
  await expect(page.locator('button[title^="AI Assistant"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('button[title^="AI Assistant"]').click()
  await expect(page.getByText('Review this synthetic order before applying anything.')).toBeVisible()

  const previewButton = page.locator('.day-plan-apply-btn')
  await expect(previewButton).toContainText('Review this order')
  await previewButton.click()

  const commandCenter = page.getByTestId('ai-command-center')
  await expect(commandCenter).toBeVisible()
  await expect(commandCenter).toContainText('AI day plan')
  await expect(commandCenter).toContainText('Why this')
  await expect(commandCenter).toContainText('Unblocks the synthetic release review.')
  await expect(commandCenter).toContainText('Before')
  await expect(commandCenter).toContainText('After')
  const firstEditButton = commandCenter.getByLabel(/Edit proposed change/i).first()
  await expect(firstEditButton).toBeVisible()
  await expect(commandCenter.getByRole('button', { name: /Reject/i }).first()).toBeVisible()
  await expect(commandCenter.getByTestId('ai-command-apply')).toBeVisible()
  await expect(commandCenter).toContainText('Waiting for approval')

  await firstEditButton.click()
  const dateEditor = commandCenter.getByLabel('Edit proposed value').first()
  await expect(dateEditor).toHaveAttribute('type', 'date')
  await dateEditor.fill('2026-08-31')
  await expect(dateEditor).toHaveValue('2026-08-31')
  const firstCommand = commandCenter.locator('.command-item').first()
  await expect(firstCommand).toContainText('dueDate: 2026-08-31')
  await expect(firstCommand).not.toContainText('dueDate: 2026-08-30')

  const dueDates = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]')
      .filter((task: { id?: string }) => task.id?.startsWith('task1856-synthetic-'))
      .map((task: { dueDate?: string }) => task.dueDate),
  )
  expect(dueDates).toEqual(['', ''])

  await page.screenshot({ path: '/tmp/flowstate-task1856-command-center-e2e.png', fullPage: false })
  await firstEditButton.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/flowstate-task1856-command-center-controls-e2e.png', fullPage: false })
  await commandCenter.getByTestId('ai-command-apply').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/flowstate-task1856-command-center-apply-e2e.png', fullPage: false })
})

test('organizer exposes lower uncovered work before review and applies only the selected lane', async ({ page }) => {
  await page.goto('/src/main.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    const now = new Date().toISOString()
    const task = (id: string, title: string) => ({
      id,
      title,
      description: 'Synthetic organizer acceptance data only.',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '',
      projectId: 'uncategorized',
      isUncategorized: true,
      isInInbox: true,
      canvasDismissed: false,
      createdAt: now,
      updatedAt: now,
    })
    const tasks = [
      task('task1857-synthetic-1', 'Prepare launch brief'),
      task('task1857-synthetic-2', 'Review launch evidence'),
      task('task1857-synthetic-3', 'Clarify website request'),
    ]

    localStorage.clear()
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    localStorage.setItem('flowstate-guest-tasks', JSON.stringify(tasks))
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    localStorage.setItem('flowstate-ai-settings', JSON.stringify({
      provider: 'bridge',
      model: 'codex',
      chatDirection: 'ltr',
      chatLanguage: 'en',
    }))
    localStorage.setItem('flowstate-ai-conversations', JSON.stringify({
      activeConversationId: 'task1857-synthetic-conversation',
      conversations: [{
        id: 'task1857-synthetic-conversation',
        title: 'Synthetic organizer acceptance',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'task1857-synthetic-user',
            role: 'user',
            content: 'Organize these selected synthetic tasks',
            timestamp: now,
          },
          {
            id: 'task1857-synthetic-assistant',
            role: 'assistant',
            content: 'Review these synthetic lanes before applying anything.',
            timestamp: now,
            metadata: {
              cardGroups: {
                kind: 'smart_lanes',
                total: 3,
                groups: [
                  {
                    name: 'Launch preparation',
                    tasks: [{ ...tasks[0], reason: 'Creates the launch input.' }],
                  },
                  {
                    name: 'Release review',
                    tasks: [{ ...tasks[1], reason: 'Checks the launch evidence.' }],
                  },
                ],
                uncoveredTasks: [tasks[2]],
              },
            },
          },
        ],
      }],
    }))
  })

  await page.goto('/#/canvas')
  await expect(page.locator('button[title^="AI Assistant"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('button[title^="AI Assistant"]').click()
  await expect(page.getByText('Review these synthetic lanes before applying anything.')).toBeVisible()
  await expect(page.getByTestId('smart-lane-uncovered')).toContainText('Outside this proposal: Clarify website request')
  await page.locator('.day-plan-apply-btn').click()

  const commandCenter = page.getByTestId('ai-command-center')
  await expect(commandCenter).toBeVisible()
  await expect(commandCenter).toContainText('Outside this proposal: Clarify website request')

  await commandCenter.getByTestId('ai-command-reject-smart-lane:0:lane').click()
  await expect(commandCenter.locator('.command-item.is-rejected')).toHaveCount(2)
  await commandCenter.getByTestId('ai-command-apply').click()
  await expect(page.locator('.day-plan-apply-btn')).toContainText('Lanes applied')

  const appliedState = await page.evaluate(() => {
    const root = document.querySelector('#app') as { __vue_app__: { _context: { config: { globalProperties: { $pinia: { _s: Map<string, any> } } } } } }
    const pinia = root.__vue_app__._context.config.globalProperties.$pinia
    const taskStore = pinia._s.get('tasks')!
    const laneStore = pinia._s.get('lanes')!
    const tasks = taskStore.rawTasks || taskStore.tasks || []
    return {
      firstLaneId: tasks.find((candidate: any) => candidate.id === 'task1857-synthetic-1')?.laneId || null,
      secondLaneId: tasks.find((candidate: any) => candidate.id === 'task1857-synthetic-2')?.laneId || null,
      laneNames: (laneStore.lanes || []).map((lane: any) => lane.name),
    }
  })
  expect(appliedState.firstLaneId).toBeNull()
  expect(appliedState.secondLaneId).toBeTruthy()
  expect(appliedState.laneNames).not.toContain('Launch preparation')
  expect(appliedState.laneNames).toContain('Release review')

  await page.screenshot({ path: '/tmp/flowstate-task1857-organizer-e2e.png', fullPage: false })
})
