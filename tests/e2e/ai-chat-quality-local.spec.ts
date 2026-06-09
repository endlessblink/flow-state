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

async function seedWeeklyInlineFollowUpConversation(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem('flowstate-ai-conversations', JSON.stringify({
      activeConversationId: 'conv-weekly-inline-followup',
      conversations: [{
        id: 'conv-weekly-inline-followup',
        title: 'Seeded weekly follow-up',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'msg-seeded-weekly-user',
            role: 'user',
            content: 'תעזור לי לארגן את שארית השבוע',
            timestamp: now,
          },
          {
            id: 'msg-seeded-weekly-assistant',
            role: 'assistant',
            content: '',
            timestamp: now,
            metadata: {
              weeklyPlan: {
                schemaVersion: 'weekly-plan.v2',
                requestId: 'req-seeded-weekly-inline',
                locale: 'he',
                direction: 'rtl',
                source: 'quick_draft',
                headline: 'צריך תשובה אחת לפני דירוג',
                weekRead: {
                  summary: 'לא אציג דירוג רחב בלי הקשר אמין.',
                  workloadReality: '',
                  mainTradeoff: '',
                },
                recommendations: [],
                deferrals: [],
                openQuestions: [{
                  id: 'followup_ai-local-task-4',
                  entityType: 'task',
                  entityId: 'ai-local-task-4',
                  reason: 'follow_up_task_suggestion',
                  question: 'להוסיף משימת המשך אחרי "Draft follow-up tasks for the memory interview flow"?',
                  options: [
                    { id: 'add_followup', label: 'כן, להוסיף', effect: 'Create a follow-up task linked to this recommendation.' },
                    { id: 'ask_later', label: 'שאל אותי אחר כך', effect: 'Keep the suggestion visible without changing tasks now.' },
                    { id: 'no_followup', label: 'לא צריך', effect: 'Do not suggest a follow-up for this task again in this plan.' },
                  ],
                  allowFreeText: true,
                  relatedTaskIds: ['ai-local-task-4'],
                }],
                quality: {
                  selectedTaskCount: 0,
                  confidence: 'low',
                  caveats: [],
                },
              },
            },
          },
        ],
      }],
    }))
  })
}

async function seedWeeklyPriorityQuestionConversation(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem('flowstate-ai-conversations', JSON.stringify({
      activeConversationId: 'conv-weekly-priority-question',
      conversations: [{
        id: 'conv-weekly-priority-question',
        title: 'Seeded weekly priority',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'msg-seeded-weekly-priority-user',
            role: 'user',
            content: 'תעזור לי לארגן את שארית השבוע',
            timestamp: now,
          },
          {
            id: 'msg-seeded-weekly-priority-assistant',
            role: 'assistant',
            content: '',
            timestamp: now,
            metadata: {
              weeklyPlan: {
                schemaVersion: 'weekly-plan.v2',
                requestId: 'req-seeded-weekly-priority',
                locale: 'he',
                direction: 'rtl',
                source: 'quick_draft',
                headline: 'צריך תשובה אחת לפני דירוג',
                weekRead: {
                  summary: 'לא אציג דירוג רחב בלי הקשר אמין.',
                  workloadReality: '',
                  mainTradeoff: '',
                },
                recommendations: [],
                deferrals: [],
                openQuestions: [{
                  id: `week_importance_${new Date().toISOString().slice(0, 10)}`,
                  entityType: 'week',
                  entityId: new Date().toISOString().slice(0, 10),
                  reason: 'missing_week_priorities',
                  question: 'מה הכי חשוב להגן עליו השבוע?',
                  options: [
                    {
                      id: 'work_commitment',
                      label: 'התחייבות עבודה',
                      effect: 'Use work commitments as the weekly ranking lens.',
                      memoryPatch: {
                        entityType: 'week',
                        entityId: new Date().toISOString().slice(0, 10),
                        field: 'thisWeekImportance',
                        operation: 'set',
                        value: 'work_commitment',
                        confidence: 0.85,
                        source: 'clarification',
                      },
                    },
                    {
                      id: 'client_money',
                      label: 'לקוח/כסף',
                      effect: 'Use client or money impact as the weekly ranking lens.',
                      memoryPatch: {
                        entityType: 'week',
                        entityId: new Date().toISOString().slice(0, 10),
                        field: 'thisWeekImportance',
                        operation: 'set',
                        value: 'client_money',
                        confidence: 0.85,
                        source: 'clarification',
                      },
                    },
                    {
                      id: 'reduce_chaos',
                      label: 'להוריד עומס',
                      effect: 'Use load reduction as the weekly ranking lens.',
                      memoryPatch: {
                        entityType: 'week',
                        entityId: new Date().toISOString().slice(0, 10),
                        field: 'thisWeekImportance',
                        operation: 'set',
                        value: 'reduce_chaos',
                        confidence: 0.85,
                        source: 'clarification',
                      },
                    },
                  ],
                  allowFreeText: true,
                  freeTextPatch: { field: 'whyItMatters', operation: 'set' },
                  freeTextPlaceholder: 'אופציונלי: מה ייחשב שבוע טוב?',
                  relatedTaskIds: ['ai-local-task-1', 'ai-local-task-2', 'ai-local-task-3'],
                }],
                quality: {
                  selectedTaskCount: 0,
                  confidence: 'low',
                  caveats: [],
                },
              },
            },
          },
        ],
      }],
    }))
  })
}

async function seedAnsweredWeeklyFollowUpMemory(page: Page) {
  await page.evaluate(() => {
    const key = 'flowstate-ai-clarification-local-memory-v1'
    const existing = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({
      contextEntities: existing.contextEntities ?? [],
      events: [
        {
          entityKey: 'task:ai-local-task-4',
          entityType: 'task',
          displayName: 'Draft follow-up tasks for the memory interview flow',
          questionId: 'followup_ai-local-task-4',
          eventType: 'answered',
          question: 'להוסיף משימת המשך אחרי "Draft follow-up tasks for the memory interview flow"?',
          selectedOptionId: 'add_followup',
          selectedLabel: 'כן, להוסיף',
          createdAt: new Date().toISOString(),
        },
        ...(existing.events ?? []),
      ],
      parameterBeliefs: existing.parameterBeliefs ?? [],
      recommendationFeedback: existing.recommendationFeedback ?? [],
      memorySnapshots: existing.memorySnapshots ?? [],
    }))
  })
}

async function stubBridge(page: Page, options: { missingCardsFromChatCall?: number; hangFromChatCall?: number } = {}) {
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

      if (bridgeOptions.hangFromChatCall && bridgeWindow.__flowstateBridgeChatCallCount >= bridgeOptions.hangFromChatCall) {
        return new Response(new ReadableStream({
          start() {
            // Intentionally leave the stream open to prove the app-level watchdog
            // exits the weekly planning phase instead of waiting forever.
          },
        }), {
          status: 200,
          headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        })
      }

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
  try {
    await toggle.click({ timeout: 3_000 })
  } catch {
    await page.keyboard.press('Control+/')
  }

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

async function answerClarificationIfPresent(page: Page) {
  const card = page.locator('[data-testid="ai-clarification"]').last()
  if (await card.count()) {
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.locator('.weekly-question-option').first().click()
    await card.locator('.weekly-question-apply').first().click()
  }
}

async function sendChat(input: Locator, message: string) {
  await input.fill(message)
  try {
    await input.page().locator('.send-btn').click({ timeout: 3_000 })
  } catch {
    await input.press('Enter')
  }
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
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  const firstClarificationCount = await clarification.count()
  const firstWeeklyPlanCount = await page.locator('[data-testid="weekly-plan"]').count()
  expect(firstClarificationCount + firstWeeklyPlanCount).toBeGreaterThan(0)
  if (firstClarificationCount > 0) {
    await clarification.locator('summary', { hasText: /Why ask/i }).click()
    await expect(clarification.locator('.ai-debug-details')).toContainText(/coverage|reason|source/i)
    await expect(page.locator('[data-testid="weekly-plan"]')).toHaveCount(0)
  }
  if (firstClarificationCount > 0) {
    await expect(page.locator('[data-testid="inline-plan-card"]')).toHaveCount(0)
  } else {
    await expect(page.locator('[data-testid="inline-plan-card"]').first()).toBeVisible({ timeout: 10_000 })
  }
  await expect(page.locator('[data-testid="ai-clarification-candidate-card"]')).toHaveCount(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/best plan|Top Recommendations|Recommended Focus Areas/i)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/נמצאו\s+\d+\s+משימות|Found\s+\d+\s+tasks/i)
  await expect(input).toBeEnabled()

  await answerClarificationIfPresent(page)
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(input).toBeEnabled({ timeout: 10_000 })
  if (firstClarificationCount > 0) {
    await expect(page.locator('[data-testid="ai-clarification-saved"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="ai-clarification-saved"]').first()).toContainText('Saved locally on this device', { timeout: 10_000 })
  }
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

test('Hebrew rest-of-week prompt reaches weekly planning without a generic task dump', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page)

  const input = await openAIChat(page)
  await sendChat(input, 'תעזור לי לתכנן את שארית השבוע')

  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  const clarificationCount = await page.locator('[data-testid="ai-clarification"]').count()
  const weeklyPlanCount = await page.locator('[data-testid="weekly-plan"]').count()
  expect(clarificationCount + weeklyPlanCount).toBeGreaterThan(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/נמצאו\s+\d+\s+משימות|Found\s+\d+\s+tasks/i)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/What kind of project is "Work"|איזה סוג פרויקט הוא "Work"/i)
  if (clarificationCount > 0) {
    await expect(page.locator('[data-testid="inline-plan-card"]')).toHaveCount(0)
  } else {
    await expect(page.locator('[data-testid="inline-plan-card"]').first()).toBeVisible({ timeout: 10_000 })
  }

  if (clarificationCount > 0) {
    await answerVisibleClarification(page)
    await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
    await expect(page.locator('[data-testid="weekly-plan"]').last()).toBeVisible({ timeout: 30_000 })
  }

  await expect(input).toBeEnabled({ timeout: 10_000 })
})

test.describe('weekly planning prompt variants route to the same non-dump product flow', () => {
  const prompts = [
    'תעזור לי לארגן את שארית השבוע',
    'תעזור לי לתכנן את שארית השבוע',
    'ארגן לי את שארית השבוע',
    'organize the rest of my week',
  ]

  for (const prompt of prompts) {
    test(`${prompt} routes to weekly planning without hardcoded dump behavior`, async ({ page }) => {
      await seedGuestWorkspace(page)
      await stubBridge(page)
      const decisionLogs: string[] = []
      page.on('console', msg => {
        const text = msg.text()
        if (text.includes('[AIChat:WeeklyPlanDecision]')) decisionLogs.push(text)
      })

      const input = await openAIChat(page)
      await sendChat(input, prompt)

      await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
      const clarificationCount = await page.locator('[data-testid="ai-clarification"]').count()
      const weeklyPlanCount = await page.locator('[data-testid="weekly-plan"]').count()
      expect(clarificationCount + weeklyPlanCount).toBeGreaterThan(0)
      await expect(page.locator('.ai-chat-messages')).not.toContainText(/נמצאו\s+\d+\s+משימות|Found\s+\d+\s+tasks/i)
      await expect(page.locator('.ai-chat-messages')).not.toContainText(/What kind of project is "Work"|איזה סוג פרויקט הוא "Work"/i)
      await expect(page.locator('.ai-chat-messages')).not.toContainText(/להוסיף משימת המשך אחרי|Add a follow-up task after/i)
      expect(decisionLogs.some(line => /memory_retrieved|ask|proceed|plan_ready/.test(line))).toBe(true)

      if (clarificationCount > 0) {
        await expect(page.locator('[data-testid="inline-plan-card"]')).toHaveCount(0)
        const latestClarification = page.locator('[data-testid="ai-clarification"]').last()
        await expect(latestClarification).toContainText(/למה אני שואל|Why ask/i)
      } else {
        const plan = page.locator('[data-testid="weekly-plan"]').last()
        await expect(plan.locator('.weekly-plan-section').first()).toBeVisible({ timeout: 10_000 })
        const sectionCount = await plan.locator('.weekly-plan-section').count()
        expect(sectionCount).toBeGreaterThan(0)
        expect(sectionCount).toBeLessThanOrEqual(3)
        const textLength = await plan.evaluate(el => (el.textContent || '').trim().length)
        expect(textLength).toBeLessThan(1800)
      }
      await expect(input).toBeEnabled({ timeout: 10_000 })
    })
  }
})

test('weekly bridge stream hang falls back instead of staying in refining plan', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page, { hangFromChatCall: 1 })

  const input = await openAIChat(page)
  await sendChat(input, 'תעזור לי לתכנן את שארית השבוע')
  await answerClarificationIfPresent(page)

  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('[data-testid="weekly-plan"]').last()).toBeVisible({ timeout: 5_000 })
  const questionCount = await page.locator('[data-testid="weekly-plan-questions"]').count()
  const inlineCardCount = await page.locator('[data-testid="inline-plan-card"]').count()
  expect(questionCount + inlineCardCount).toBeGreaterThan(0)
  expect(inlineCardCount).toBeLessThanOrEqual(3)
  await expect(page.locator('.weekly-plan-section')).toHaveCount(inlineCardCount, { timeout: 5_000 })
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/נמצאו\s+\d+\s+משימות|Found\s+\d+\s+tasks/i)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/Refining plan|Bridge timeout/i)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/אותות במשימה מצביעים על כסף.*אותות במשימה מצביעים על כסף/s)
  await expect(input).toBeEnabled({ timeout: 5_000 })
})

test('weekly inline follow-up card is suppressed instead of advancing obsolete action-only flow', async ({ page }) => {
  await seedGuestWorkspace(page)
  await seedWeeklyInlineFollowUpConversation(page)
  await stubBridge(page)
  const weeklyLogs: string[] = []
  const continuationLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[AIChat:WeeklyInlineQuestion]')) weeklyLogs.push(text)
    if (text.includes('[AIChat:Continuation]')) continuationLogs.push(text)
  })

  await openAIChat(page)
  const seededPlan = page.locator('[data-testid="weekly-plan"]').first()
  await expect(seededPlan).toBeVisible({ timeout: 10_000 })
  const assistantCountBefore = await page.locator('.message-assistant').count()

  await expect(seededPlan).not.toContainText(/להוסיף משימת המשך אחרי|Add a follow-up task after/i)
  await expect(seededPlan.locator('[data-testid="weekly-plan-questions"]')).toHaveCount(0)
  await expect(seededPlan.getByRole('button', { name: 'כן, להוסיף' })).toHaveCount(0)
  await expect(seededPlan.getByRole('button', { name: 'הוסף משימת מעקב' })).toHaveCount(0)
  await expect.poll(async () => page.locator('.message-assistant').count(), {
    timeout: 5_000,
  }).toBe(assistantCountBefore)
  expect(weeklyLogs.some(line => line.includes('continuation_emitted'))).toBe(false)
  expect(weeklyLogs.some(line => line.includes('followup_create_started'))).toBe(false)
  expect(continuationLogs.some(line => line.includes('send_started'))).toBe(false)
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.ai-chat-input-container textarea')).toBeEnabled({ timeout: 5_000 })
})

test('old persisted weekly follow-up card is suppressed instead of asking again', async ({ page }) => {
  await seedGuestWorkspace(page)
  await seedWeeklyInlineFollowUpConversation(page)
  await seedAnsweredWeeklyFollowUpMemory(page)
  await stubBridge(page)

  await openAIChat(page)
  await expect(page.locator('[data-testid="weekly-plan"]')).toHaveCount(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/צריך תשובה אחת לפני דירוג|One answer before ranking/i)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/להוסיף משימת המשך אחרי|Add a follow-up task after/i)
  await expect(page.getByRole('button', { name: 'כן, להוסיף' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'הוסף משימת מעקב' })).toHaveCount(0)
})

test('answered weekly priority question disappears and continues to compact plan without re-asking', async ({ page }) => {
  await seedGuestWorkspace(page)
  await seedWeeklyPriorityQuestionConversation(page)
  await stubBridge(page)

  await openAIChat(page)
  const seededPlan = page.locator('[data-testid="weekly-plan"]').first()
  await expect(seededPlan).toBeVisible({ timeout: 10_000 })
  await expect(seededPlan).toContainText('מה הכי חשוב להגן עליו השבוע?', { timeout: 5_000 })
  const assistantCountBefore = await page.locator('.message-assistant').count()

  await seededPlan.getByRole('button', { name: 'לקוח/כסף' }).click()
  await seededPlan.getByRole('button', { name: 'שמור תשובה' }).click()

  await expect(seededPlan).not.toContainText('מה הכי חשוב להגן עליו השבוע?', { timeout: 5_000 })
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 30_000 })
  await expect.poll(async () => page.locator('.message-assistant').count(), {
    timeout: 15_000,
  }).toBeGreaterThan(assistantCountBefore)

  const compactPlan = page.locator('[data-testid="weekly-plan"]').last()
  await expect(compactPlan).toContainText(/תשובה קצרה מההקשר ששמרת|Short plan after your clarification/, { timeout: 10_000 })
  await expect(compactPlan.locator('[data-testid="weekly-plan-questions"]')).toHaveCount(0)
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/מה הכי חשוב להגן עליו השבוע\?.*מה הכי חשוב להגן עליו השבוע\?/s)
  await expect(page.locator('.ai-chat-input-container textarea')).toBeEnabled({ timeout: 5_000 })
})

test('too-much feedback makes the next broad fallback answer compact', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page, { missingCardsFromChatCall: 2 })

  const input = await openAIChat(page)
  await sendChat(input, 'Help me plan this week from my tasks')
  await answerClarificationIfPresent(page)
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

test('weekly accept feedback saves a positive signal without hiding the recommendation or sticking activity', async ({ page }) => {
  await seedGuestWorkspace(page)
  await stubBridge(page)

  const input = await openAIChat(page)
  await sendChat(input, 'Help me plan this week from my tasks')
  await answerClarificationIfPresent(page)
  await expect(page.locator('[data-testid="weekly-plan"]').last()).toBeVisible({ timeout: 30_000 })

  const firstRecommendation = page.locator('.weekly-plan-section').first()
  await expect(firstRecommendation).toBeVisible({ timeout: 10_000 })
  await firstRecommendation.getByRole('button', { name: /^Accept$/ }).click()

  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(firstRecommendation).toBeVisible({ timeout: 10_000 })
  await expect(firstRecommendation).toContainText(/Saved as feedback|Feedback is local until signed in/i)
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
