import { test, expect, type Page } from '../fixtures/auth'

function sse(...events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

async function stubShallowWeeklyFormatter(page: Page) {
  await page.route('**/ai-bridge/health', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }),
    }))

  await page.route('**/ai-bridge/v1/chat', async (r) => {
    let body: { stream?: boolean; messages?: { content?: string }[] } = {}
    try { body = r.request().postDataJSON() } catch { /* ignore */ }

    if (body.stream === false) {
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ brain: 'claude', model: 'claude', content: 'weekly planning request' }),
      })
    }

    const cardsBlock = '```cards\n' + JSON.stringify({
      kind: 'week_plan',
      groups: [
        {
          name: 'Shallow list',
          items: [
            { i: 1, reason: 'deadline soon' },
            { i: 2, reason: 'high priority' },
            { i: 3, reason: 'medium priority' },
          ],
        },
      ],
    }) + '\n```'
    const shallowAnswer = [
      'Here are your tasks due soon:',
      '- Design landing page - deadline 2026-06-07; priority medium',
      '- Set up CI/CD pipeline - due today; high priority',
      '- Write unit tests - priority medium',
      cardsBlock,
    ].join('\n')

    await r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: sse({ delta: shallowAnswer }, { done: true, brain: 'claude', model: 'claude' }),
    })
  })
}

test('weekly planner repairs shallow bridge output into rich inline task recommendations', async ({ page }) => {
  await stubShallowWeeklyFormatter(page)

  await page.goto('/#/ai')
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})

  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill('Help me plan my week')
  await page.locator('.send-btn').click()

  const inlineCards = page.locator('[data-testid="inline-ai-task-card"]')
  await expect(inlineCards.first()).toBeVisible({ timeout: 30000 })
  await expect.poll(() => inlineCards.count()).toBeGreaterThan(2)

  const assistant = page.locator('.message-assistant').last()
  await expect(assistant).toContainText(/Why now|Expected impact|Tradeoff\/slot/, { timeout: 10000 })
  await expect(assistant).toContainText(/unblock|risk|sequence|commitment|decision|open load|stuck|slot|capacity/i)

  await expect(page.locator('.card-groups')).toHaveCount(0)
  await expect(page.getByText('```cards', { exact: false })).toHaveCount(0)
  await expect(page.locator('.message-text', { hasText: '"groups"' })).toHaveCount(0)
  await expect(assistant).not.toContainText('deadline 2026-06-07; priority medium')
  await expect(assistant).not.toContainText('due today; high priority')

  const blocks = page.locator('.inline-response-block')
  await expect(blocks.first().locator('[data-testid="inline-ai-task-card"]')).toBeVisible()
})
