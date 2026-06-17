/**
 * Two-Independent-Client Realtime Harness
 * =======================================
 * Foundation for reproducing the recurring multi-device sync/canvas bugs.
 *
 * Why this exists: the existing `multi-tab-sync.spec.ts` opens two PAGES in the
 * SAME browser context. They share one localStorage, one BroadcastChannel and
 * one Supabase auth session — so they only exercise cross-tab BroadcastChannel,
 * NOT two independent Realtime clients over the websocket. The bugs that keep
 * resurfacing (sync "gets cut", "all nodes shift", position drift) are
 * multi-device races that ONLY appear when two genuinely separate clients each
 * receive the other's `postgres_changes` broadcasts.
 *
 * This fixture gives each "client" its OWN `browser.newContext({ storageState })`
 * — separate localStorage, separate websocket, separate Pinia/Vue runtime — both
 * authenticated as the same seeded Playwright user (tests/.auth/user.json,
 * produced by tests/global-setup.ts). That makes A→B realtime propagation real.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/two-client'
 *   test('A change propagates to B', async ({ clientA, clientB }) => {
 *     await clientA.goto('/#/canvas')
 *     await clientB.goto('/#/canvas')
 *     ...
 *   })
 *
 * `clientA` is the default authenticated page (same storageState the rest of the
 * suite uses). `clientB` is a page in a brand-new independent context.
 */
import { test as base, expect } from '@playwright/test'
import fs from 'node:fs'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const AUTH_FILE = 'tests/.auth/user.json'

/** True when global-setup produced a seeded auth state we can reuse. */
export const hasSeededAuth = fs.existsSync(AUTH_FILE)

/**
 * Spin up an independent, authenticated client (own context + websocket).
 * Caller is responsible for closing the returned context.
 */
export async function createIndependentClient(
  browser: Browser
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(
    hasSeededAuth ? { storageState: AUTH_FILE } : {}
  )
  const page = await context.newPage()
  // Suppress onboarding overlays so canvas/tasks are interactable immediately.
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  })
  return { context, page }
}

type TwoClientFixtures = {
  /** Default authenticated page (shares the suite's storageState). */
  clientA: Page
  /** A fully independent authenticated client — own context + realtime socket. */
  clientB: Page
}

export const test = base.extend<TwoClientFixtures>({
  clientA: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
    await use(page)
  },
  clientB: async ({ browser }, use) => {
    const { context, page } = await createIndependentClient(browser)
    await use(page)
    await context.close()
  },
})

export { expect }

// ─── Canvas geometry helpers ────────────────────────────────────────────────

export type NodePositions = Record<string, { x: number; y: number }>

/**
 * Read every rendered Vue Flow node's absolute position by parsing the
 * `transform: translate(Xpx, Ypx)` on `.vue-flow__node` elements. Returns a
 * map of node id → {x, y}. Used to assert that an operation did NOT move
 * unrelated nodes (the "all nodes shift" regression).
 */
export async function readCanvasNodePositions(page: Page): Promise<NodePositions> {
  return page.evaluate(() => {
    const out: Record<string, { x: number; y: number }> = {}
    const nodes = document.querySelectorAll<HTMLElement>('.vue-flow__node')
    nodes.forEach((el) => {
      const id = el.getAttribute('data-id')
      if (!id) return
      const t = el.style.transform || ''
      const m = t.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/)
      if (m) out[id] = { x: parseFloat(m[1]), y: parseFloat(m[2]) }
    })
    return out
  })
}

/**
 * Assert that none of the nodes in `before` moved (within `tolerance` px) in
 * `after`, optionally ignoring a set of node ids that were legitimately added
 * or intentionally moved (e.g. the node the user just dropped).
 */
export function expectNoNodesMoved(
  before: NodePositions,
  after: NodePositions,
  opts: { ignore?: string[]; tolerance?: number } = {}
): void {
  const ignore = new Set(opts.ignore ?? [])
  const tol = opts.tolerance ?? 0.5
  const moved: string[] = []
  for (const [id, pos] of Object.entries(before)) {
    if (ignore.has(id)) continue
    const now = after[id]
    if (!now) continue // disappearance is checked separately
    if (Math.abs(now.x - pos.x) > tol || Math.abs(now.y - pos.y) > tol) {
      moved.push(`${id}: (${pos.x},${pos.y}) -> (${now.x},${now.y})`)
    }
  }
  expect(moved, `Unrelated nodes shifted:\n${moved.join('\n')}`).toEqual([])
}

/** Wait until the canvas has rendered at least `min` Vue Flow nodes. */
export async function waitForCanvasNodes(page: Page, min = 1, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (m) => document.querySelectorAll('.vue-flow__node').length >= m,
    min,
    { timeout }
  )
}
