import { test, expect } from '../fixtures/auth'

/**
 * Taskbar Nanny E2E tests
 *
 * Strategy overview:
 *
 * Test 1: Simple console log check — navigate, wait 3s, verify [NANNY] initialized appears.
 *         No fake clock needed. Confirms the nanny is wired into MainLayout.vue.
 *
 * Tests 2-4: Use page.clock.install() BEFORE page.goto() so ALL timers (setInterval etc.)
 *         created during page load are controlled by the fake clock.
 *         Then use page.clock.fastForward(ms) to advance time without blocking the event loop.
 *
 *         Key gotcha: page.clock.install() is called before goto(), so the `[NANNY] initialized`
 *         console.log (synchronous) fires during Vue setup. We must wait for it via
 *         page.waitForFunction or a longer runFor to flush the micro-task queue.
 *
 * Key facts from source:
 * - useTaskbarNanny() called in MainLayout.vue (at component setup time, not onMounted)
 * - setInterval starts immediately (not in onMounted) — so fake clock controls it
 * - useIdleDetector registers events + interval in onMounted — also controlled by fake clock
 * - Force fallback: threshold (5min=300s) + 2 extra min (120s) = 420s to guaranteed toast
 * - Toast text: "You've been working for a while without a chosen task..."
 * - Toast DOM: appended to #toast-container in document.body
 */

test.describe('Taskbar Nanny', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('flowstate-settings-v2')) {
        localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
      }
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Smoke test — nanny initializes (real time, no fake clock)
  // ─────────────────────────────────────────────────────────────────────────
  test('nanny fires toast after threshold — real time with low threshold', async ({ page }) => {
    const nannyLogs: string[] = []
    page.on('console', msg => {
      if (msg.text().includes('[NANNY]')) {
        nannyLogs.push(msg.text())
      }
    })

    // Override the nanny threshold to 10 seconds for testing
    await page.addInitScript(() => {
      (window as any).__NANNY_THRESHOLD_MINUTES = 10 / 60 // 10 seconds
    })

    await page.goto('/#/tasks')
    // Wait 20 real seconds — threshold at 10s, toast should appear
    await page.waitForTimeout(20000)

    console.log('=== ALL NANNY LOGS (20s) ===')
    nannyLogs.forEach(l => console.log(l))
    console.log('=== END ===')

    const initLog = nannyLogs.find(l => l.includes('initialized'))
    expect(initLog, '[NANNY] initialized log missing').toBeTruthy()

    const thresholdLog = nannyLogs.find(l => l.includes('threshold crossed'))
    expect(thresholdLog, '[NANNY] threshold crossed log missing — not reaching threshold?').toBeTruthy()

    const toastLog = nannyLogs.find(l => l.includes('showing toast'))
    expect(toastLog, '[NANNY] showing toast log missing — toast not triggered?').toBeTruthy()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Nanny accumulates unchosen time (fake clock)
  // Install clock BEFORE goto so all timers run under fake time.
  // ─────────────────────────────────────────────────────────────────────────
  test('nanny accumulates unchosen time and logs 30s ticks', async ({ page }) => {
    const nannyLogs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[NANNY]')) {
        nannyLogs.push(text)
        console.log('[TEST collected]', text)
      }
    })

    // Install fake clock before navigation — all timers in the page will be fake
    await page.clock.install()

    await page.goto('/#/tasks')

    // fastForward flushes all pending timers up to the given time delta.
    // We advance 5s to let Vue mount and the nanny's console.log('[NANNY] initialized') fire.
    await page.clock.fastForward(5000)

    // Console events from the browser arrive asynchronously via IPC.
    // A small real-time wait ensures they flush to the Node.js listener before we assert.
    await page.waitForTimeout(500)

    console.log('After 5s fastForward + 500ms flush, NANNY logs so far:', nannyLogs)

    const initLog = nannyLogs.find(l => l.includes('initialized'))
    expect(initLog, '[NANNY] initialized log not found — is the app loading with fake clock?').toBeTruthy()
    console.log('Init log:', initLog)

    // Advance 31s more — nanny logs at every 30s boundary
    await page.clock.fastForward(31000)
    await page.waitForTimeout(500) // flush IPC console events

    console.log('After 31s more, all NANNY logs:', nannyLogs)

    const tickLog = nannyLogs.find(l => l.includes('unchosen time:'))
    expect(tickLog, 'Expected [NANNY] unchosen time: 30s tick log — nanny interval not firing?').toBeTruthy()
    console.log('30s tick log:', tickLog)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Nanny fires toast after threshold + force-fallback (fake clock)
  // ─────────────────────────────────────────────────────────────────────────
  test('nanny triggers toast after threshold (5 min) + force-fallback (2 extra min)', async ({ page }) => {
    const nannyLogs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[NANNY]')) {
        nannyLogs.push(text)
        console.log('[TEST collected]', text)
      }
    })

    await page.clock.install()
    await page.goto('/#/tasks')

    // Flush mount phase + allow IPC console events to arrive
    await page.clock.fastForward(5000)
    await page.waitForTimeout(500)

    const initLog = nannyLogs.find(l => l.includes('initialized'))
    expect(initLog, 'Nanny must initialize').toBeTruthy()
    console.log('Init log:', initLog)

    // Advance to just past force-fallback trigger:
    // threshold = 5min (300s) + force-fallback = 2min (120s) → 420s total
    // We advance 425s to ensure the 420th interval tick fires.
    console.log('Advancing clock 425s to trigger threshold + force-fallback...')
    await page.clock.fastForward(425000)
    await page.waitForTimeout(500) // flush IPC console events

    console.log('After 425s, all NANNY logs:', JSON.stringify(nannyLogs, null, 2))

    const thresholdLog = nannyLogs.find(l => l.includes('threshold crossed'))
    expect(thresholdLog, 'Expected [NANNY] threshold crossed! log at 5min').toBeTruthy()
    console.log('Threshold log:', thresholdLog)

    const toastLog = nannyLogs.find(l => l.includes('showing toast'))
    expect(toastLog, 'Expected [NANNY] showing toast log').toBeTruthy()
    console.log('Toast trigger log:', toastLog)

    // Verify the actual toast DOM element
    const toastContainer = page.locator('#toast-container')
    await expect(toastContainer).toBeAttached({ timeout: 3000 })

    const toastText = toastContainer.getByText("You've been working for a while without a chosen task")
    await expect(toastText).toBeVisible({ timeout: 3000 })
    console.log('Toast DOM visible: YES')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Nanny resets when a real task is assigned (fake clock + Pinia mutation)
  // ─────────────────────────────────────────────────────────────────────────
  test('nanny resets when a real task is set on timer store', async ({ page }) => {
    const nannyLogs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[NANNY]') || text.includes('[TEST]')) {
        nannyLogs.push(text)
        console.log('[TEST collected]', text)
      }
    })

    await page.clock.install()
    await page.goto('/#/tasks')
    await page.clock.fastForward(5000)
    await page.waitForTimeout(500) // flush IPC console events

    expect(nannyLogs.find(l => l.includes('initialized')), 'Nanny must initialize').toBeTruthy()

    // Accumulate 31s of unchosen time
    await page.clock.fastForward(31000)

    const tickLog = nannyLogs.find(l => l.includes('unchosen time:'))
    expect(tickLog, 'Should have accumulated 30s of unchosen time').toBeTruthy()
    console.log('Accumulated tick log:', tickLog)

    // Simulate user picking a real task: mutate timerStore via Pinia
    await page.evaluate(() => {
      const app = (window as unknown as {
        __vue_app__?: {
          config: {
            globalProperties: {
              $pinia?: {
                state: { value: Record<string, { currentTaskId?: string | null }> }
              }
            }
          }
        }
      }).__vue_app__

      if (!app) {
        console.error('[TEST] Could not find __vue_app__')
        return
      }
      const pinia = app.config.globalProperties.$pinia
      if (!pinia) {
        console.error('[TEST] Could not find $pinia on app')
        return
      }
      const state = pinia.state.value
      const storeNames = Object.keys(state)
      console.log('[TEST] Pinia store names:', storeNames.join(', '))

      // The timer store in Pinia is keyed by store id — check common names
      const timerStore = state['timer'] || state['timerStore'] || state['useTimerStore']
      if (timerStore) {
        timerStore.currentTaskId = 'real-task-uuid-abc123'
        console.log('[TEST] Set currentTaskId to real-task-uuid-abc123 in store:', Object.keys(state).find(k => state[k] === timerStore))
      } else {
        console.error('[TEST] Timer store not found. Available stores:', storeNames.join(', '))
      }
    })

    // Advance 1s so the nanny's setInterval fires and the watch() watcher resolves
    await page.clock.fastForward(1000)
    // Give Vue reactivity a chance to settle (real-time microtask flush)
    await page.waitForTimeout(200)

    const resetLog = nannyLogs.find(l => l.includes('reset'))
    expect(resetLog, 'Nanny should log [NANNY] reset — real task chosen when currentTaskId is set').toBeTruthy()
    console.log('Reset log:', resetLog)
  })
})
