import { expect, test, type Page } from '@playwright/test'

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
      dueDate: inDays(1),
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
  await page.addInitScript((seedTasks) => {
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
  }, seededTasks())
}

async function createTasksThroughQuickAdd(page: Page) {
  const quickAdd = page.locator('input[placeholder*="Quick add task"], input[placeholder*="quick add"]').first()
  await expect(quickAdd).toBeVisible({ timeout: 15_000 })

  for (const seedTask of seededTasks()) {
    await quickAdd.fill(seedTask.title)
    await page.keyboard.press('Enter')
    await expect(page.getByText(seedTask.title).first()).toBeVisible({ timeout: 10_000 })
  }
}

async function stubBridge(page: Page) {
  await page.addInitScript(() => {
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
  })
}

async function openAIChat(page: Page) {
  await page.goto('/#/tasks')
  await page.waitForLoadState('domcontentloaded')
  if (!(await page.getByText('Fix FlowState chat memory so it stops giving generic plans').isVisible({ timeout: 3_000 }).catch(() => false))) {
    await createTasksThroughQuickAdd(page)
  }
  await expect(page.getByText('Fix FlowState chat memory so it stops giving generic plans')).toBeVisible({ timeout: 20_000 })

  const toggle = page.locator('.ai-toggle-btn').first()
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  await toggle.click()

  const input = page.locator('.ai-chat-input').first()
  await expect(input).toBeVisible({ timeout: 15_000 })
  return input
}

async function answerVisibleClarification(page: Page) {
  const card = page.locator('[data-testid="ai-clarification"]').last()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.locator('.weekly-question-option').first().click()
  await card.locator('.weekly-question-apply').first().click()
}

async function continueFromSavedClarification(page: Page) {
  const saved = page.locator('[data-testid="ai-clarification-saved"]').first()
  await expect(saved).toBeVisible({ timeout: 10_000 })
  const continueButton = saved.locator('.weekly-question-apply').first()
  if (await continueButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await continueButton.click()
  }
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
  await expect(page.locator('[data-testid="ai-clarification-follow-up"]')).toBeVisible({ timeout: 15_000 })

  for (let i = 0; i < 4; i += 1) {
    const followUp = page.locator('[data-testid="ai-clarification-follow-up"]').last()
    if (!(await followUp.isVisible({ timeout: 2_000 }).catch(() => false))) break
    await followUp.locator('.weekly-question-option').first().click()
    await followUp.locator('.weekly-question-apply').first().click()
  }

  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
  await expect(input).toBeEnabled({ timeout: 10_000 })
  await expect(page.locator('[data-testid="ai-clarification-saved"]').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.ai-chat-messages')).not.toContainText(/project meaning\/stakes are unknown.*project meaning\/stakes are unknown/i)

  await continueFromSavedClarification(page)
  await expect(page.locator('[data-testid="ai-activity-running"]')).toHaveCount(0, { timeout: 45_000 })
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
