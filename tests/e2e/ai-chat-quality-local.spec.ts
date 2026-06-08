import { expect, test, type Locator, type Page } from '@playwright/test'

const todayIso = () => new Date().toISOString()
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

type SeedTask = {
  id: string
  title: string
  description: string
  status: 'todo' | 'done'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Array<{
    id: string
    parentTaskId: string
    title: string
    description: string
    completedPomodoros: number
    isCompleted: boolean
    createdAt: string
    updatedAt: string
  }>
  dueDate: string
  estimatedDuration?: number
  isUncategorized: boolean
  projectId: string
  createdAt: string
  updatedAt: string
  isInInbox: boolean
  canvasDismissed: boolean
}

function task(id: string, title: string, overrides: Partial<SeedTask> = {}): SeedTask {
  const now = todayIso()
  return {
    id,
    title,
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    isUncategorized: true,
    projectId: 'uncategorized',
    createdAt: now,
    updatedAt: now,
    isInInbox: true,
    canvasDismissed: false,
    ...overrides,
  }
}

function seededTasks(): SeedTask[] {
  return [
    task('ai-local-task-1', 'Fix FlowState chat memory so it stops giving generic plans', {
      priority: 'medium',
      dueDate: inDays(3),
      estimatedDuration: 120,
      description: 'Broad product-quality work. The assistant should ask before ranking if context is missing.',
      subtasks: [
        {
          id: 'ai-local-subtask-1',
          parentTaskId: 'ai-local-task-1',
          title: 'Prove no barrage before clarification',
          description: '',
          completedPomodoros: 0,
          isCompleted: false,
          createdAt: todayIso(),
          updatedAt: todayIso(),
        },
      ],
    }),
    task('ai-local-task-2', 'Review Work bucket priorities', {
      priority: 'high',
      dueDate: inDays(-1),
      description: 'Ambiguous bucket. The assistant must not infer stakes from the label alone.',
    }),
    task('ai-local-task-3', 'Buy printer paper', {
      priority: 'high',
      dueDate: inDays(2),
      estimatedDuration: 20,
      description: 'Small admin task used to catch shallow priority-only ranking.',
    }),
    task('ai-local-task-4', 'Draft follow-up tasks for the memory interview flow', {
      priority: 'medium',
      dueDate: inDays(5),
      estimatedDuration: 90,
      description: 'Should be proposed only with confirmation, not silently created.',
    }),
  ]

}

async function seedGuestWorkspace(page: Page) {
  await page.goto('/src/main.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async (seedTasks) => {
    localStorage.clear()
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    localStorage.setItem('flowstate-ai-settings', JSON.stringify({
      provider: 'claude',
      model: 'claude',
      chatDirection: 'ltr',
      chatLanguage: 'en',
    }))
    localStorage.setItem('flowstate-guest-tasks', JSON.stringify(seedTasks))

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('FlowStateReadCache')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('FlowStateReadCache', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      }
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['tasks', 'meta'], 'readwrite')
        const taskStore = transaction.objectStore('tasks')
        const metaStore = transaction.objectStore('meta')
        for (const task of seedTasks) taskStore.put(task)
        metaStore.put({ key: 'tasks', updatedAt: Date.now(), count: seedTasks.length })
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }, seededTasks())
}

async function stubBridge(page: Page, options: { missingCardsFromChatCall?: number } = {}) {
  await page.addInitScript(() => {
    ;(window as unknown as { __flowstateBridgeChatCallCount: number }).__flowstateBridgeChatCallCount = 0
  })
  await page.addInitScript((bridgeOptions) => {
    const originalFetch = window.fetch.bind(window)
    const encoder = new TextEncoder()

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/ai-bridge/')) return originalFetch(input, init)

      if (url.includes('/health')) {
        return new Response(JSON.stringify({ ok: true, brains: { claude: true, codex: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      const bridgeWindow = window as unknown as { __flowstateBridgeChatCallCount?: number }
      bridgeWindow.__flowstateBridgeChatCallCount = (bridgeWindow.__flowstateBridgeChatCallCount || 0) + 1

      if (bridgeOptions.missingCardsFromChatCall && bridgeWindow.__flowstateBridgeChatCallCount >= bridgeOptions.missingCardsFromChatCall) {
        const chunks = [
          `data: ${JSON.stringify({ delta: 'Formatter missed the cards block and wrote too much generic prose instead.' })}\n\n`,
          `data: ${JSON.stringify({ done: true, brain: 'claude' })}\n\n`,
        ]
        return new Response(new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
            controller.close()
          },
        }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        })
      }

      const conciseCards = {
        kind: 'weekly_plan',
        title: 'Short grounded draft',
        sections: [
          {
            title: 'Use the context you gave',
            items: [
              {
                title: 'Fix FlowState chat memory so it stops giving generic plans',
                reason: 'Uses your clarification evidence and the task notes instead of inferring stakes from a bucket name.',
                confidence: 0.7,
              },
            ],
          },
        ],
      }
      const chunks = [
        `data: ${JSON.stringify({ delta: 'Short draft from the saved clarification.\\n\\n' })}\n\n`,
        `data: ${JSON.stringify({ delta: `\`\`\`cards\n${JSON.stringify(conciseCards)}\n\`\`\`` })}\n\n`,
        `data: ${JSON.stringify({ done: true, brain: 'claude' })}\n\n`,
      ]

      return new Response(new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
          controller.close()
        },
      }), {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      })
    }
  }, options)
}

async function openAIChat(page: Page) {
  await page.goto('/#/tasks')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByText('Fix FlowState chat memory so it stops giving generic plans')).toBeVisible({ timeout: 20_000 })

  const toggle = page.locator('.ai-toggle-btn').first()
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  await toggle.click()

  const input = page.locator('.ai-chat-input').first()
  await expect(input).toBeVisible({ timeout: 15_000 })
  return input
}

async function openAISettingsMemoryDebug(page: Page) {
  await page.goto('/#/tasks')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByText('Fix FlowState chat memory so it stops giving generic plans')).toBeVisible({ timeout: 20_000 })

  const settingsButton = page.locator('.settings-mini-btn, [aria-label*="Settings"], [title*="Settings"]').first()
  await expect(settingsButton).toBeVisible({ timeout: 10_000 })
  await settingsButton.click()
  await expect(page.locator('.settings-modal')).toBeVisible({ timeout: 10_000 })
  await page.locator('.tab-btn').filter({ hasText: /AI/ }).click()
  await expect(page.locator('[data-testid="ai-memory-debug"]')).toBeVisible({ timeout: 15_000 })
  return page.locator('[data-testid="ai-memory-debug"]')
}

async function answerVisibleClarification(page: Page) {
  const card = page.locator('[data-testid="ai-clarification"]').last()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.locator('.weekly-question-option').first().click()
  await card.locator('.weekly-question-apply').first().click()
}

async function sendChat(input: Locator, message: string) {
  await input.fill(message)
  await input.page().locator('.send-btn').click()
}

async function visibleInlineCardTitles(scope: Locator): Promise<string[]> {
  return (await scope.locator('[data-testid="inline-ai-task-card"] .task-title').allTextContents()).map(title => title.trim())
}

test('weekly planning asks first, does not dump recommendations, and does not get stuck after answers', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page)

  const input = await openAIChat(page)
  await input.fill('Help me plan this week from my tasks')
  await page.locator('.send-btn').click()

  const clarification = page.locator('[data-testid="ai-clarification"]')
  await expect(clarification).toHaveCount(1, { timeout: 30_000 })
  await clarification.locator('summary', { hasText: /Why ask/i }).click()
  await expect(clarification.locator('.ai-debug-details')).toContainText(/coverage|reason|source/i)
  await expect(page.locator('[data-testid="weekly-plan"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="inline-plan-card"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="ai-clarification-candidate-card"]')).toHaveCount(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/best plan|Top Recommendations|Recommended Focus Areas/i)
  await expect(input).toBeEnabled()

  await answerVisibleClarification(page)
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(input).toBeEnabled({ timeout: 10_000 })
  await expect(page.locator('[data-testid="ai-clarification-saved"]').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="ai-clarification-saved"]').first()).toContainText('Saved locally on this device', { timeout: 10_000 })
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/project meaning\/stakes are unknown.*project meaning\/stakes are unknown/i)
  await expect(page.locator('[data-testid="ai-clarification-follow-up"]')).toHaveCount(0)

  await expect(page.locator('[data-testid="weekly-plan"]').last()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-testid="inline-plan-card"]').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.weekly-plan-section').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="weekly-plan-questions"]')).toHaveCount(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/project meaning\/stakes are unknown.*project meaning\/stakes are unknown/i)

  const firstRecommendation = page.locator('.weekly-plan-section').first()
  await firstRecommendation.getByRole('button', { name: /^Postpone$/ }).click()
  await expect(page.locator('[data-testid="weekly-feedback-detail"]').first()).toBeVisible({ timeout: 5_000 })
  await page.locator('[data-testid="weekly-feedback-detail"]').first().getByRole('button', { name: /Save feedback/i }).click()
  await expect(firstRecommendation).toBeHidden({ timeout: 10_000 })
  await expect(page.locator('.ai-chat-messages')).toContainText(/Postponed and saved as feedback|Feedback is local until signed in/i)
  await expect(input).toBeEnabled({ timeout: 10_000 })

  await page.screenshot({ path: '/tmp/flowstate-ai-chat-quality-stage8.png', fullPage: false })
})

test('too-much feedback makes the next broad fallback answer compact', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page, { missingCardsFromChatCall: 2 })

  const input = await openAIChat(page)
  await sendChat(input, 'Help me plan this week from my tasks')
  await answerVisibleClarification(page)
  await expect(page.locator('[data-testid="weekly-plan"]').last()).toBeVisible({ timeout: 30_000 })

  const firstRecommendation = page.locator('.weekly-plan-section').first()
  await firstRecommendation.getByRole('button', { name: /^Too much$/ }).click()
  const feedbackDetail = page.locator('[data-testid="weekly-feedback-detail"]').first()
  await expect(feedbackDetail).toBeVisible({ timeout: 5_000 })
  await feedbackDetail.getByRole('button', { name: /Save feedback/i }).click()
  await expect(page.locator('.ai-chat-messages')).toContainText(/Saved: too much|Feedback is local until signed in/i)

  await sendChat(input, 'what should I do next?')
  const clarification = page.locator('[data-testid="ai-clarification"]').last()
  await expect(clarification).toBeVisible({ timeout: 30_000 })
  await clarification.getByText('Energy fit', { exact: true }).click()
  await clarification.locator('.weekly-question-apply').first().click()
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })

  const latestMessage = page.locator('.chat-message').last()
  await expect(latestMessage).toContainText(/Extra-compact draft based on your feedback that the last answer was too much/i, { timeout: 30_000 })
  await expect(latestMessage.locator('[data-testid="inline-ai-task-card"]')).toHaveCount(1)
  await expect(latestMessage).not.toContainText(/Fast draft based on impact, dependency, and real risk/i)
  await expect(input).toBeEnabled({ timeout: 10_000 })
})

test('broad postpone feedback suppresses the same task in the next broad answer', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page, { missingCardsFromChatCall: 1 })

  const input = await openAIChat(page)
  await sendChat(input, 'what should I do next?')

  let clarification = page.locator('[data-testid="ai-clarification"]').last()
  await expect(clarification).toBeVisible({ timeout: 30_000 })
  await clarification.getByText('Energy fit', { exact: true }).click()
  await clarification.locator('.weekly-question-apply').first().click()
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })

  let latestMessage = page.locator('.chat-message').last()
  const firstCard = latestMessage.locator('[data-testid="inline-ai-task-card"]').first()
  await expect(firstCard).toBeVisible({ timeout: 30_000 })
  const postponedTitle = (await firstCard.locator('.task-title').textContent())?.trim()
  expect(postponedTitle).toBeTruthy()
  await firstCard.locator('.inline-postpone-btn').click()
  await expect.poll(() => visibleInlineCardTitles(latestMessage), { timeout: 10_000 }).not.toContain(postponedTitle!)
  await expect(latestMessage).toContainText(/Postponed and saved as feedback|Feedback is local until signed in/i)

  const clarificationCountBeforeRepeat = await page.locator('[data-testid="ai-clarification"]').count()
  await sendChat(input, 'what should I do next?')
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('[data-testid="ai-clarification"]')).toHaveCount(clarificationCountBeforeRepeat)

  latestMessage = page.locator('.chat-message').last()
  await expect(latestMessage.locator('[data-testid="inline-ai-task-card"]').first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => visibleInlineCardTitles(latestMessage), { timeout: 10_000 }).not.toContain(postponedTitle!)
  await expect(input).toBeEnabled({ timeout: 10_000 })
})

test('mechanical overdue list request shows data without a clarification gate', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page)

  const input = await openAIChat(page)
  await sendChat(input, 'show me overdue tasks')

  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('[data-testid="ai-clarification"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="inline-ai-task-card"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.chat-message').last()).not.toContainText(/How should I treat overdue tasks|What should guide this answer/i)
  await expect(input).toBeEnabled({ timeout: 10_000 })
})

test('settings memory debug shows local-only status on localhost guest fallback', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page)

  const debug = await openAISettingsMemoryDebug(page)
  await expect(debug).toContainText('Local-only memory on this device; sign in for cross-device memory')
  await expect(debug).toContainText('Local memory only')
  await expect(debug).not.toContainText('Server-backed context currently available to chat')
})

test.describe('broad task answers ask one specific question before recommendations', () => {
  const cases = [
    {
      prompt: 'prioritize my tasks',
      question: 'What should decide the priority order?',
      option: 'Project momentum',
    },
    {
      prompt: 'what should I do next?',
      question: 'What would make one task right for now?',
      option: 'Energy fit',
    },
    {
      prompt: 'triage my overdue tasks',
      question: 'How should I treat overdue tasks?',
      option: 'Hard commitments',
    },
    {
      prompt: "I'm overwhelmed, reorder my day",
      question: 'What should guide this answer?',
      option: 'Real impact',
    },
    {
      prompt: 'Suggest smart lanes for my current tasks',
      question: 'What should guide this answer?',
      option: 'Real impact',
    },
    {
      prompt: 'break down my tasks into next steps',
      question: 'What should guide this answer?',
      option: 'Real impact',
    },
  ]

  for (const scenario of cases) {
    test(`${scenario.prompt} uses a targeted one-card clarification and no-repeat memory`, async ({ page }) => {
      await seedGuestWorkspace(page)
      await stubBridge(page)

      const input = await openAIChat(page)
      await sendChat(input, scenario.prompt)

      const clarification = page.locator('[data-testid="ai-clarification"]').last()
      await expect(clarification).toBeVisible({ timeout: 30_000 })
      await expect(clarification).toContainText(scenario.question)
      await expect(clarification.getByText(scenario.option, { exact: true })).toBeVisible()
      await expect(page.locator('[data-testid="weekly-plan"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="inline-plan-card"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="ai-clarification-candidate-card"]')).toHaveCount(0)
      await expect(page.locator('.ai-chat-messages')).not.toContainText(/best plan|Top Recommendations|Recommended Focus Areas/i)

      await clarification.getByText(scenario.option, { exact: true }).click()
      await clarification.locator('.weekly-question-apply').first().click()
      await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
      await expect(page.locator('[data-testid="ai-clarification-saved"]').last()).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('[data-testid="ai-clarification-saved"]').last()).toContainText('Saved locally on this device', { timeout: 10_000 })
      await expect(input).toBeEnabled({ timeout: 10_000 })

      const clarificationCountAfterAnswer = await page.locator('[data-testid="ai-clarification"]').count()
      await sendChat(input, scenario.prompt)
      await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
      await expect(page.locator('[data-testid="ai-clarification"]')).toHaveCount(clarificationCountAfterAnswer)
      await expect(page.locator('.ai-chat-messages')).not.toContainText(new RegExp(`${scenario.question}.*${scenario.question}`, 's'))
      await expect(input).toBeEnabled({ timeout: 10_000 })
    })
  }
})
