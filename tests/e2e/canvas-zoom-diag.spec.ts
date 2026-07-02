/**
 * Diagnostic: capture [ZOOM PERF] console output during zoom-out gestures.
 * Run with: npm run test:e2e -- tests/e2e/canvas-zoom-diag.spec.ts --workers=1
 */
import { test, expect } from '../fixtures/auth'
import type { Page } from '@playwright/test'

// Shares the one Playwright test user's canvas state; run serially within the
// file so its own tests don't race each other under fullyParallel:true. Cross-file
// parallelism with other canvas specs is a separate limitation (see suite report).
test.describe.configure({ mode: 'serial' })

async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    if (!localStorage.getItem('flowstate-settings-v2')) {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    }
  })
}

test.describe('Canvas Zoom Diagnostics', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOverlays(page)
  })

  test('Capture zoom-out perf logs and long tasks', async ({ page, context }) => {
    // Collect ALL console messages
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('ZOOM PERF') || text.includes('ORCH') || text.includes('syncNodes') || text.includes('watcher:')) {
        consoleLogs.push(`[${msg.type()}] ${text}`)
      }
    })

    await page.goto('/#/canvas')
    await page.waitForSelector('.vue-flow', { timeout: 15000 })
    await page.waitForTimeout(3000) // let everything initialize

    // Setup long task tracking
    await page.evaluate(() => {
      (window as any).__longTasks = [];
      (window as any).__frameTimes = []
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTasks.push({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          })
        }
      })
      observer.observe({ type: 'longtask', buffered: false })

      // Also track frame times with rAF
      let lastFrame = performance.now()
      let frameCount = 0
      function trackFrame() {
        const now = performance.now()
        const delta = now - lastFrame
        if (delta > 30) { // only log frames slower than 30ms (< 33fps)
          (window as any).__frameTimes.push({ frame: frameCount, delta: Math.round(delta), at: Math.round(now) })
        }
        lastFrame = now
        frameCount++
        if (frameCount < 300) requestAnimationFrame(trackFrame) // ~5 seconds of tracking
      }
      requestAnimationFrame(trackFrame)
    })

    const canvas = page.locator('.vue-flow__pane')
    const box = await canvas.boundingBox()
    if (!box) { test.skip(); return }

    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)

    // Clear any startup long tasks
    await page.evaluate(() => {
      (window as any).__longTasks = [];
      (window as any).__frameTimes = []
    })

    // Check initial zoom
    const initialZoom = await page.evaluate(() => {
      const pane = document.querySelector('.vue-flow__transformationpane')
      return pane?.getAttribute('style') || 'not found'
    })
    console.log(`\n=== Initial transform: ${initialZoom} ===`)

    console.log('\n=== ZOOM-OUT GESTURE: 30 scroll events ===\n')

    // Vue Flow has zoom-on-scroll enabled with zoomActivationKeyCode=null
    // Use page.evaluate to dispatch wheel events directly on the Vue Flow pane
    for (let i = 0; i < 30; i++) {
      await page.evaluate(({ x, y }) => {
        const pane = document.querySelector('.vue-flow__pane')
        if (pane) {
          pane.dispatchEvent(new WheelEvent('wheel', {
            deltaY: 100,
            deltaX: 0,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }))
        }
      }, { x: cx, y: cy })
      await page.waitForTimeout(80)
    }

    // Check if zoom changed
    const midZoom = await page.evaluate(() => {
      const pane = document.querySelector('.vue-flow__transformationpane')
      return pane?.getAttribute('style') || 'not found'
    })
    console.log(`After scroll: ${midZoom}`)

    // Check if .is-zooming class was applied
    const hasZoomingClass = await page.evaluate(() => {
      const el = document.querySelector('.canvas-drop-zone') || document.querySelector('.vue-flow')
      return { element: el?.className || 'not found', hasClass: el?.classList.contains('is-zooming') ?? false }
    })
    console.log(`Has .is-zooming class: ${hasZoomingClass.hasClass} (on ${hasZoomingClass.element?.substring(0, 60)})`)

    // Wait for the perf flush (150ms debounce + margin)
    await page.waitForTimeout(500)

    // Collect results
    const longTasks = await page.evaluate(() => (window as any).__longTasks) as Array<{ duration: number; startTime: number }>
    const frameTimes = await page.evaluate(() => (window as any).__frameTimes) as Array<{ frame: number; delta: number; at: number }>

    // Print everything
    console.log('\n--- Console logs (ZOOM PERF / ORCH / watcher) ---')
    for (const log of consoleLogs) {
      console.log(log)
    }

    console.log(`\n--- Long tasks (>50ms): ${longTasks.length} ---`)
    for (const lt of longTasks) {
      console.log(`  ${lt.duration}ms at t=${lt.startTime}ms`)
    }

    console.log(`\n--- Slow frames (>30ms): ${frameTimes.length} ---`)
    for (const ft of frameTimes) {
      console.log(`  frame ${ft.frame}: ${ft.delta}ms`)
    }

    // Get final zoom level
    const finalZoom = await page.evaluate(() => {
      const vf = document.querySelector('.vue-flow')
      const transform = vf?.querySelector('.vue-flow__transformationpane')?.getAttribute('style') || ''
      return transform
    })
    console.log(`\n--- Final viewport transform: ${finalZoom} ---`)

    // Summary
    const maxLongTask = longTasks.length > 0 ? Math.max(...longTasks.map(t => t.duration)) : 0
    const maxFrameTime = frameTimes.length > 0 ? Math.max(...frameTimes.map(f => f.delta)) : 0
    console.log(`\n=== SUMMARY ===`)
    console.log(`Long tasks: ${longTasks.length} (worst: ${maxLongTask}ms)`)
    console.log(`Slow frames: ${frameTimes.length} (worst: ${maxFrameTime}ms)`)
    console.log(`Console events captured: ${consoleLogs.length}`)

    // Don't fail — this is diagnostic
    expect(true).toBe(true)
  })

  test('Zoom-out with empty state + background HIDDEN', async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('.vue-flow', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // Hide expensive elements
    await page.evaluate(() => {
      // Hide canvas empty state (backdrop-filter + 32 animations)
      document.querySelectorAll('.canvas-empty-state').forEach(el => (el as HTMLElement).style.display = 'none')
      // Hide Vue Flow background (SVG dot grid)
      document.querySelectorAll('.vue-flow__background').forEach(el => (el as HTMLElement).style.display = 'none')
      // Hide minimap
      document.querySelectorAll('.vue-flow__minimap').forEach(el => (el as HTMLElement).style.display = 'none')
    })

    await page.evaluate(() => {
      (window as any).__frameTimes = []
      let lastFrame = performance.now()
      let frameCount = 0
      function trackFrame() {
        const now = performance.now()
        const delta = now - lastFrame
        if (delta > 30) {
          (window as any).__frameTimes.push({ frame: frameCount, delta: Math.round(delta) })
        }
        lastFrame = now
        frameCount++
        if (frameCount < 300) requestAnimationFrame(trackFrame)
      }
      requestAnimationFrame(trackFrame)
    })

    const canvas = page.locator('.vue-flow__pane')
    const box = await canvas.boundingBox()
    if (!box) { test.skip(); return }
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.evaluate(() => { (window as any).__frameTimes = [] })

    for (let i = 0; i < 30; i++) {
      await page.evaluate(({ x, y }) => {
        const pane = document.querySelector('.vue-flow__pane')
        pane?.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 100, clientX: x, clientY: y, bubbles: true, cancelable: true,
        }))
      }, { x: cx, y: cy })
      await page.waitForTimeout(80)
    }

    await page.waitForTimeout(500)

    const frameTimes = await page.evaluate(() => (window as any).__frameTimes) as Array<{ frame: number; delta: number }>
    const maxFrameTime = frameTimes.length > 0 ? Math.max(...frameTimes.map(f => f.delta)) : 0

    console.log(`\n=== WITHOUT empty state + background ===`)
    console.log(`Slow frames (>30ms): ${frameTimes.length} (worst: ${maxFrameTime}ms)`)
    for (const ft of frameTimes) {
      console.log(`  frame ${ft.frame}: ${ft.delta}ms`)
    }

    expect(true).toBe(true)
  })
})
