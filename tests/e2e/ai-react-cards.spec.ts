/**
 * TASK-1814 — the ReAct/freeform path must be as intelligent as the deterministic
 * one. A prioritization question whose phrasing matches NO routing keyword falls to
 * freeform → ReAct; this verifies that path now renders GROUPED interactive cards
 * (rich-data + cards feedback), so "no question jumps over" the intelligent path.
 */
import { test, expect, type Page } from '../fixtures/auth'

function sse(...events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

// Bridge stub: turn 1 emits a text tool-call; turn 2 (after tool feedback) emits a
// short prose answer + a `cards` block referencing tasks by their [N] index.
function stubBridge(page: Page) {
  const cardsBlock = '```cards\n' + JSON.stringify({
    groups: [
      { name: 'Money at risk', items: [{ i: 1, reason: 'revenue leaking until fixed' }] },
      { name: 'Do in order', items: [{ i: 2, reason: 'blocks the next step' }] },
    ],
  }) + '\n```'
  page.route('**/ai-bridge/health', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
  page.route('**/ai-bridge/v1/chat', async (r) => {
    let body: { stream?: boolean; messages?: { content?: string }[] } = {}
    try { body = r.request().postDataJSON() } catch { /* ignore */ }
    if (body.stream === false) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ brain: 'claude', content: 'ok' }) })
    }
    const sawResults = /You now have all the data|Tool results:|תוצאות כלים/i.test(JSON.stringify(body.messages || []))
    const payload = sawResults
      ? sse({ delta: `Here's what actually matters first.\n\n${cardsBlock}` }, { done: true, brain: 'claude' })
      : sse({ delta: 'list_tasks({})' }, { done: true, brain: 'claude' })
    await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: payload })
  })
}

async function stubStreamingBridgeFetch(page: Page) {
  const cardsPayload = JSON.stringify({
    groups: [
      { name: 'Money at risk', items: [{ i: 1, reason: 'revenue leaking until fixed' }] },
    ],
  })

  await page.addInitScript((cardsJson) => {
    const originalFetch = window.fetch.bind(window)
    const encoder = new TextEncoder()
    const sseEvent = (event: object) => `data: ${JSON.stringify(event)}\n\n`

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/ai-bridge/')) return originalFetch(input, init)

      if (url.includes('/health')) {
        return new Response(JSON.stringify({ ok: true, brains: { claude: true, codex: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (!url.includes('/v1/chat')) return originalFetch(input, init)

      const bodyText = typeof init?.body === 'string' ? init.body : ''
      const body = bodyText ? JSON.parse(bodyText) : {}
      if (body.stream === false) {
        return new Response(JSON.stringify({ brain: 'claude', content: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      const sawResults = /You now have all the data|Tool results:|תוצאות כלים/i.test(JSON.stringify(body.messages || []))
      const chunks = sawResults
        ? [
            sseEvent({ delta: "Here's what actually matters first.\n\n" }),
            sseEvent({ delta: '```ca' }),
            sseEvent({ delta: `rds\n${cardsJson.slice(0, 14)}` }),
            sseEvent({ delta: `${cardsJson.slice(14)}\n\`\`\`` }),
            sseEvent({ done: true, brain: 'claude' }),
          ]
        : [
            sseEvent({ delta: 'list_tasks({})' }),
            sseEvent({ done: true, brain: 'claude' }),
          ]
      const delays = sawResults ? [0, 120, 120, 120, 0] : [0, 0]

      return new Response(new ReadableStream({
        start(controller) {
          let i = 0
          const push = () => {
            if (i >= chunks.length) {
              controller.close()
              return
            }
            controller.enqueue(encoder.encode(chunks[i]))
            setTimeout(push, delays[i])
            i += 1
          }
          push()
        },
      }), {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      })
    }
  }, cardsPayload)
}

test('freeform prioritization → ReAct → grouped cards with reasons render', async ({ page }) => {
  stubBridge(page)
  await page.goto('/#/ai')
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })

  // Phrasing that matches NO routing keyword → must go freeform → ReAct.
  await input.fill('i am feeling swamped right now, help me see where to even begin')
  await page.locator('.send-btn').click()

  // The intelligent path renders GROUPED cards (not the flat dump), each with a reason.
  await expect(page.locator('.card-group-name', { hasText: 'Money at risk' })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.grouped-card-reason', { hasText: 'revenue leaking until fixed' })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.grouped-card').first()).toBeVisible()
  // The raw cards JSON / [N] markers must not leak into the prose.
  await expect(page.getByText('```cards', { exact: false })).toHaveCount(0)
  await expect(page.locator('.message-text', { hasText: '"groups"' })).toHaveCount(0)
})

test('streaming cards block never flashes raw JSON while ReAct answer is still streaming', async ({ page }) => {
  await stubStreamingBridgeFetch(page)
  await page.goto('/#/ai')
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })

  await input.fill('i am feeling swamped right now, help me see where to even begin')
  await page.locator('.send-btn').click()

  await expect(page.locator('.message-text', { hasText: "Here's what actually matters first." })).toBeVisible({ timeout: 30000 })
  await page.waitForTimeout(260)
  await expect(page.getByText('```cards', { exact: false })).toHaveCount(0)
  await expect(page.locator('.message-text', { hasText: '"groups"' })).toHaveCount(0)
  await expect(page.locator('.message-text', { hasText: '"items"' })).toHaveCount(0)

  await expect(page.locator('.card-group-name', { hasText: 'Money at risk' })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.grouped-card-reason', { hasText: 'revenue leaking until fixed' })).toBeVisible({ timeout: 5000 })
})

test('overwhelmed prompt renders an applyable ordered day plan', async ({ page }) => {
  const cardsBlock = '```cards\n' + JSON.stringify({
    kind: 'day_plan',
    groups: [
      { name: 'First focus block', items: [{ i: 1, reason: 'highest external stake' }] },
      { name: 'Second focus block', items: [{ i: 2, reason: 'unblocks the next step' }] },
    ],
  }) + '\n```'

  await page.route('**/ai-bridge/health', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
  await page.route('**/ai-bridge/v1/chat', async (r) => {
    await r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: sse({ delta: `Start with the highest-stakes item and defer the rest.\n\n${cardsBlock}` }, { done: true, brain: 'claude' }),
    })
  })

  await page.goto('/#/ai')
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })

  await input.fill("I'm overwhelmed, reorder my day")
  await page.locator('.send-btn').click()

  await expect(page.locator('.card-group-name', { hasText: 'First focus block' })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.day-plan-apply-btn', { hasText: 'Apply this order (2)' })).toBeVisible()
  await page.locator('.day-plan-apply-btn').click()
  await expect(page.locator('.day-plan-apply-btn', { hasText: 'Plan applied' })).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: '.dev/screenshots/ai-day-plan-apply.png', fullPage: false }).catch(() => {})
})

test('smart-lane prompt renders reviewable lanes and applies them', async ({ page }) => {
  const cardsBlock = '```cards\n' + JSON.stringify({
    kind: 'smart_lanes',
    groups: [
      {
        name: 'Sales Push',
        items: [{ i: 1, reason: 'anchors the lane' }],
        newTasks: [{ title: 'Draft follow-up sequence', priority: 'medium', reason: 'turns list into outreach' }],
      },
    ],
  }) + '\n```'

  await page.route('**/ai-bridge/health', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, brains: { claude: true, codex: true } }) }))
  await page.route('**/ai-bridge/v1/chat', async (r) => {
    await r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: sse({ delta: `The strongest lane is the sales push.\n\n${cardsBlock}` }, { done: true, brain: 'claude' }),
    })
  })

  await page.goto('/#/ai')
  await page.locator('.new-chat-btn').first().click({ timeout: 10000 }).catch(() => {})
  const input = page.locator('.chat-input')
  await expect(input).toBeVisible({ timeout: 15000 })

  await input.fill('Suggest smart lanes for my current tasks')
  await page.locator('.send-btn').click()

  await expect(page.locator('.card-group-name', { hasText: 'Sales Push' })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.grouped-card-new', { hasText: 'Draft follow-up sequence' })).toBeVisible()
  await expect(page.locator('.day-plan-apply-btn', { hasText: 'Apply lanes (3)' })).toBeVisible()
  await page.locator('.day-plan-apply-btn').click()
  await expect(page.locator('.day-plan-apply-btn', { hasText: 'Lanes applied' })).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: '.dev/screenshots/ai-smart-lanes-apply.png', fullPage: false }).catch(() => {})
})
