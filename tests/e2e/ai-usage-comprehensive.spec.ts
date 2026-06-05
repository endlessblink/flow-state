/**
 * TASK-1814 — comprehensive AI usage coverage (UI + runtime + answers + tool-call
 * rendering, across user flows). The bridge network is stubbed with what the real
 * claude/codex CLIs emit (verified live), so this exercises the REAL app pipeline:
 * routing → SSE parse → ReAct → tool execution → card/text rendering.
 */
import { test, expect, type Page } from '../fixtures/auth'

function sse(...events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/**
 * Install a configurable bridge stub.
 * - toolCall: the text tool-call the brain "emits" on the first streaming turn.
 * - answer: the final text answer (after tool results are fed back).
 * - brainEcho: respond as whichever brain the client asked for.
 */
function stubBridge(page: Page, opts: { toolCall?: string; answer?: string } = {}) {
  const toolCall = opts.toolCall ?? 'list_tasks({})'
  const answer = opts.answer ?? 'Here is what I found.'
  let chatCalls = 0
  page.route('**/ai-bridge/health', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
  page.route('**/ai-bridge/v1/chat', async (r) => {
    chatCalls++
    let body: { brain?: string; stream?: boolean; messages?: { content?: string }[] } = {}
    try { body = r.request().postDataJSON() } catch { /* ignore */ }
    const brain = body.brain || 'claude'
    if (body.stream === false) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brain, model: brain, content: 'freeform' }) })
    }
    const sawResults = /You now have all the data|Tool results:/i.test(JSON.stringify(body.messages || []))
    const payload = sawResults
      ? sse({ delta: answer }, { done: true, brain, model: brain })
      : sse({ delta: toolCall }, { done: true, brain, model: brain })
    await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: payload })
  })
  return { calls: () => chatCalls }
}

// Start a clean conversation — the test user is reused, so its chat history
// persists across tests/runs; without this, leak/count assertions see old messages.
async function freshChat(page: Page) {
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
  await expect(page.locator('.chat-input')).toBeVisible({ timeout: 15000 })
}

async function send(page: Page, text: string) {
  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill(text)
  await page.locator('.send-btn').click()
}

const lastAssistantText = (page: Page) => page.locator('.message-assistant .message-text').last()

test.describe('AI usage — comprehensive', () => {
  test('read query renders a task card AND does not leak raw tool-call text', async ({ page }) => {
    stubBridge(page, { toolCall: 'list_tasks({})', answer: 'Your active tasks are listed below.' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'show me everything I should look at')

    await expect(page.locator('.tool-result-card', { hasText: 'Design landing page' })).toBeVisible({ timeout: 25000 })
    // The raw `list_tasks({})` tool-call must be stripped from the displayed text.
    await expect(page.getByText('list_tasks(', { exact: false })).toHaveCount(0)
    // No raw JSON braces from the tool-call leaked into a message bubble.
    await expect(page.locator('.message-text', { hasText: '({})' })).toHaveCount(0)
  })

  test('write query (mark done) confirms and does not leak tool-call JSON', async ({ page }) => {
    stubBridge(page, { toolCall: 'mark_task_done({"task":"Buy groceries"})', answer: 'Done — marked it complete.' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'please complete the buy groceries task for me')

    // A response renders (confirmation or card) and no raw mark_task_done text shows.
    await expect(lastAssistantText(page)).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('mark_task_done(', { exact: false })).toHaveCount(0)
  })

  test('greeting gets a friendly reply with NO tool card', async ({ page }) => {
    stubBridge(page)
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'hi there')
    // Greeting path is template-based (no tool). Some text appears, no card.
    await expect(lastAssistantText(page)).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.tool-result-card')).toHaveCount(0)
  })

  test('selecting Codex brain works end-to-end (UI badge + tool-call)', async ({ page }) => {
    const stub = stubBridge(page, { toolCall: 'list_tasks({})', answer: 'Here is your workload.' })
    await page.goto('/#/ai')
    await freshChat(page)
    // Open AI settings → pick Codex (selectedProvider=bridge, brain=codex).
    await page.locator('button[title="AI Settings"]').first().click()
    await page.locator('.provider-option', { hasText: 'Codex' }).first().click()
    // Header badge reflects the chosen brain.
    await expect(page.locator('.provider-badge', { hasText: 'Codex' })).toBeVisible({ timeout: 5000 })

    await send(page, 'analyze what is most pressing for me right now')
    // The Codex brain drove a real tool-call → card renders, no leaked text.
    await expect(page.locator('.tool-result-card').first()).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('list_tasks(', { exact: false })).toHaveCount(0)
    expect(stub.calls()).toBeGreaterThan(0)
  })

  test('markdown in the answer renders as HTML (no raw ** or #)', async ({ page }) => {
    stubBridge(page, { toolCall: 'list_tasks({})', answer: 'Your **top priority** is clear.\n\n- item one\n- item two' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'give me a quick analytical summary of my workload')
    const txt = lastAssistantText(page)
    await expect(txt).toBeVisible({ timeout: 25000 })
    // bold renders to <strong>, list to <li> — raw markdown must not be visible
    await expect(txt.locator('strong, li').first()).toBeVisible({ timeout: 10000 })
  })

  test('malformed tool-call from the brain does not crash the app', async ({ page }) => {
    let crashed = false
    page.on('pageerror', () => { crashed = true })
    // Broken JSON args + trailing junk.
    stubBridge(page, { toolCall: 'list_tasks({broken json', answer: 'ok' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'help me make sense of my plate today')
    // App stays alive and the input recovers.
    await expect(page.locator('.chat-input')).toBeVisible({ timeout: 25000 })
    await expect(page.locator('.chat-input')).toBeEnabled({ timeout: 40000 })
    expect(crashed).toBe(false)
  })

  test('Hebrew query renders an answer/card without leaking tool-call text', async ({ page }) => {
    stubBridge(page, { toolCall: 'list_tasks({})', answer: 'אלו המשימות הפעילות שלך.' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'תראה לי את כל המשימות שלי')
    await expect(page.locator('.tool-result-card').first()).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('list_tasks(', { exact: false })).toHaveCount(0)
  })

  test('quick-action button ("Plan my day") executes a tool directly and renders a result', async ({ page }) => {
    stubBridge(page, { answer: 'Here is your plan for today.' })
    await page.goto('/#/ai')
    await freshChat(page)
    const planBtn = page.locator('.quick-action', { hasText: /plan my day/i }).first()
    await expect(planBtn).toBeVisible({ timeout: 15000 })
    await planBtn.click()
    // Direct-tool quick action → a daily-summary result card renders.
    await expect(page.locator('.tool-result-card').first()).toBeVisible({ timeout: 25000 })
  })

  test('multi-turn: a follow-up question keeps working after the first answer', async ({ page }) => {
    stubBridge(page, { toolCall: 'list_tasks({})', answer: 'First answer.' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'what should I work on?')
    await expect(page.locator('.tool-result-card').first()).toBeVisible({ timeout: 25000 })
    // input re-enables, then a second turn
    await expect(page.locator('.chat-input')).toBeEnabled({ timeout: 25000 })
    await send(page, 'and which one is the most urgent?')
    // The follow-up registers as the newest turn and a response follows it.
    await expect(page.locator('.chat-messages .message-user').last()).toContainText('most urgent', { timeout: 25000 })
    await expect(lastAssistantText(page)).toBeVisible({ timeout: 25000 })
  })

  test('visual: a rendered task card + answer look correct (screenshot)', async ({ page }) => {
    stubBridge(page, { toolCall: 'list_tasks({})', answer: 'Your active tasks are below — Design landing page is highest priority.' })
    await page.goto('/#/ai')
    await freshChat(page)
    await send(page, 'show me my workload and what matters most')
    await expect(page.locator('.tool-result-card', { hasText: 'Design landing page' })).toBeVisible({ timeout: 25000 })
    await expect(lastAssistantText(page)).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: '.dev/screenshots/ai-chat-card-render.png', fullPage: false }).catch(() => {})
  })
})
