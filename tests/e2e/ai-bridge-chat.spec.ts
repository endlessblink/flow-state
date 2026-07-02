/**
 * TASK-1814 — in-app e2e for the subscription bridge (Claude/Codex).
 *
 * The bridge network layer is stubbed to return EXACTLY what the real claude/codex
 * CLIs emit (verified live): a text tool-call `list_tasks({})`, then a final answer.
 * This drives the REAL app pipeline end-to-end — the router selects the bridge, the
 * SSE client parses the stream in-browser, the ReAct loop extracts the TEXT tool-call,
 * executeTool runs it against the user's seeded data, and an interactive task card
 * renders. Proves the UI actually executes actions and renders cards from a text-CLI
 * brain (the gap unit/CLI tests cannot cover). Verified flow (browser console):
 *   [AIChat] ReAct step 1 - detected 1 text-based tool call(s)
 *   [AIChat] ReAct step 1 - executing text-detected tool: list_tasks {}
 */
import { test, expect } from '../fixtures/auth'

// TASK-1905: rewrite for AI sidebar UX — /#/ai full page removed in d0f90130
test.beforeEach(() => {
  test.skip(true, 'TASK-1905: rewrite for AI sidebar UX — /#/ai full page removed in d0f90130')
})

function sse(...events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

test.describe('AI chat e2e via subscription bridge', () => {
  test('bridge stream tool-call executes and renders an interactive task card', async ({ page }) => {
    let chatCalls = 0
    let healthHits = 0

    // Health → the router selects the bridge as the active brain.
    await page.route('**/ai-bridge/health', (r) => {
      healthHits++
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }),
      })
    })

    await page.route('**/ai-bridge/v1/chat', async (r) => {
      chatCalls++
      let body: { brain?: string; stream?: boolean; messages?: { content?: string }[] } = {}
      try { body = r.request().postDataJSON() } catch { /* ignore */ }
      const brain = body.brain || 'claude'

      // Non-streaming calls (intent classification) expect JSON, like the real server.
      // Return a non-classifiable blob so the query falls through to the ReAct loop.
      if (body.stream === false) {
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ brain, model: brain, content: 'freeform request — analyze and respond' }),
        })
      }

      // Streaming (ReAct). The tool-feedback turn carries this exact phrase
      // (buildToolFeedbackMessage), so only the SECOND step returns the final answer.
      const convo = JSON.stringify(body.messages || [])
      const sawResults = /You now have all the data|Tool results:/i.test(convo)
      const payload = sawResults
        ? sse({ delta: 'These are your active tasks — Design landing page is the high-priority one.' }, { done: true, brain, model: brain })
        : sse({ delta: 'list_tasks({})' }, { done: true, brain, model: brain })
      await r.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        body: payload,
      })
    })

    await page.goto('/#/ai')
    await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})

    const input = page.locator('.chat-input')
    await expect(input).toBeVisible({ timeout: 15000 })
    // Freeform query → ReAct path, so the BRIDGE itself must emit the tool-call.
    await input.fill('Looking at everything on my plate, which single task deserves my attention and why?')
    await page.locator('.send-btn').click()

    // The tool-call emitted by the bridge stream must have executed and rendered a
    // card with a real seeded task — proving in-app tool execution from the brain.
    await expect(
      page.locator('.tool-result-card', { hasText: 'Design landing page' }),
    ).toBeVisible({ timeout: 25000 })

    expect(healthHits).toBeGreaterThan(0)        // bridge was selected
    expect(chatCalls).toBeGreaterThanOrEqual(2)  // ReAct drove a tool-call through the bridge
  })

  test('Hebrew query: bridge tool-call executes and renders a card', async ({ page }) => {
    await page.route('**/ai-bridge/health', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
    await page.route('**/ai-bridge/v1/chat', async (r) => {
      let body: { brain?: string; stream?: boolean; messages?: { content?: string }[] } = {}
      try { body = r.request().postDataJSON() } catch { /* ignore */ }
      const brain = body.brain || 'claude'
      if (body.stream === false) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brain, model: brain, content: 'freeform' }) })
      }
      const sawResults = /You now have all the data|Tool results:/i.test(JSON.stringify(body.messages || []))
      const payload = sawResults
        ? sse({ delta: 'אלו המשימות הפעילות שלך.' }, { done: true, brain, model: brain })
        : sse({ delta: 'list_tasks({})' }, { done: true, brain, model: brain })
      await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: payload })
    })

    await page.goto('/#/ai')
    await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
    const input = page.locator('.chat-input')
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill('תראה לי את כל המשימות שלי')
    await page.locator('.send-btn').click()

    // A Hebrew query must still drive tool execution → an interactive card renders.
    await expect(page.locator('.tool-result-card').first()).toBeVisible({ timeout: 25000 })
  })

  test('pressing send gives instant feedback: input clears, message shows, loading indicator appears', async ({ page }) => {
    await page.route('**/ai-bridge/health', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
    // Delay the response so the loading/thinking state is observable.
    await page.route('**/ai-bridge/v1/chat', async (r) => {
      let body: { brain?: string; stream?: boolean } = {}
      try { body = r.request().postDataJSON() } catch { /* ignore */ }
      const brain = body.brain || 'claude'
      await new Promise((res) => setTimeout(res, 2500))
      if (body.stream === false) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brain, model: brain, content: 'freeform' }) })
      }
      await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: sse({ delta: 'Here is what I found.' }, { done: true, brain, model: brain }) })
    })

    await page.goto('/#/ai')
    // Fresh conversation so the (reused) user's history doesn't collide with this query.
    await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
    const input = page.locator('.chat-input')
    await expect(input).toBeVisible({ timeout: 15000 })
    const uniqueQuery = 'placeholder-loading-check unique query 9f3a'
    await input.fill(uniqueQuery)
    await page.locator('.send-btn').click()

    // 1) Input clears immediately (the press is acknowledged)
    await expect(input).toHaveValue('', { timeout: 3000 })
    // 2) The user's message is echoed into the visible thread
    await expect(page.locator('.chat-messages .message-user').last()).toContainText('unique query 9f3a', { timeout: 5000 })
    // 3) A clear "loading" indicator appears while the model works
    await expect(page.locator('.thinking-indicator').first()).toBeVisible({ timeout: 5000 })
  })

  test('bridge failure is handled gracefully (no crash, input recovers)', async ({ page }) => {
    let crashed = false
    page.on('pageerror', () => { crashed = true })
    await page.route('**/ai-bridge/health', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
    // Brain token dead → 502 brain_unavailable (and JSON path errors too).
    await page.route('**/ai-bridge/v1/chat', (r) =>
      r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'brain_unavailable', reason: 'auth' }) }))
    // Cloud fallbacks (Groq/OpenRouter via the edge proxy) also fail fast, so the
    // router exhausts all providers quickly rather than hanging on the network.
    await page.route('**/functions/v1/**', (r) =>
      r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) }))

    await page.goto('/#/ai')
    const input = page.locator('.chat-input')
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill('Help me figure out what matters most right now')
    await page.locator('.send-btn').click()

    // The app must NOT crash — the chat view stays mounted and usable throughout.
    await expect(input).toBeVisible({ timeout: 10000 })
    // …and the input recovers (no permanent "can't send" lock) once providers are
    // exhausted. Generous headroom: all-providers-down exhausts the retry chain.
    await expect(input).toBeEnabled({ timeout: 60000 })
    expect(crashed).toBe(false)
  })
})
