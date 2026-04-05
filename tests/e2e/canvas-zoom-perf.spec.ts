import { test, expect } from '../fixtures/auth'
import type { Page } from '@playwright/test'

async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
    if (!localStorage.getItem('flowstate-settings-v2')) {
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    }
  })
}

async function waitForCanvas(page: Page) {
  await page.waitForSelector('.vue-flow', { timeout: 15000 })
  await page.waitForTimeout(2000) // let nodes render
}

test.describe('Canvas Zoom Performance', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP only available on Chromium')

  test.beforeEach(async ({ page }) => {
    await dismissOverlays(page)
  })

  test('1 - Zoom out: no long frames (>100ms) during scroll-wheel zoom', async ({ page, context }) => {
    await page.goto('/#/canvas')
    await waitForCanvas(page)

    const client = await context.newCDPSession(page)

    // Enable performance tracing
    await client.send('Performance.enable')

    // Record long tasks via PerformanceObserver
    await page.evaluate(() => {
      (window as any).__longTasks = []
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTasks.push({
            duration: entry.duration,
            name: entry.name,
            startTime: entry.startTime
          })
        }
      })
      observer.observe({ type: 'longtask', buffered: true })
    })

    // Get the canvas element
    const canvas = page.locator('.vue-flow__pane')
    const box = await canvas.boundingBox()
    if (!box) {
      test.skip()
      return
    }

    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await page.mouse.move(centerX, centerY)

    // Warmup: initial scroll events trigger compositor layer promotion (one-time cost)
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 50)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(500)

    // Clear long tasks from warmup — only measure sustained zoom performance
    await page.evaluate(() => { (window as any).__longTasks = [] })

    // Actual measurement: 20 scroll wheel events (zoom out)
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 100) // zoom out
      await page.waitForTimeout(50) // space out wheel events
    }

    // Wait for animations to settle
    await page.waitForTimeout(500)

    // Collect long tasks
    const longTasks = await page.evaluate(() => (window as any).__longTasks as Array<{ duration: number; name: string; startTime: number }>)

    // Get performance metrics
    const metrics = await client.send('Performance.getMetrics')
    const scriptDuration = metrics.metrics.find(m => m.name === 'ScriptDuration')?.value ?? 0
    const layoutCount = metrics.metrics.find(m => m.name === 'LayoutCount')?.value ?? 0
    const layoutDuration = metrics.metrics.find(m => m.name === 'LayoutDuration')?.value ?? 0

    console.log(`[ZOOM PERF] Script duration: ${(scriptDuration * 1000).toFixed(0)}ms`)
    console.log(`[ZOOM PERF] Layout count: ${layoutCount}`)
    console.log(`[ZOOM PERF] Layout duration: ${(layoutDuration * 1000).toFixed(0)}ms`)
    console.log(`[ZOOM PERF] Long tasks (>50ms): ${longTasks.length}`)

    if (longTasks.length > 0) {
      const maxTask = longTasks.reduce((a, b) => a.duration > b.duration ? a : b)
      console.log(`[ZOOM PERF] Longest task: ${maxTask.duration.toFixed(0)}ms`)

      // Log all long tasks for debugging
      for (const lt of longTasks) {
        console.log(`[ZOOM PERF]   - ${lt.duration.toFixed(0)}ms at ${lt.startTime.toFixed(0)}ms`)
      }
    }

    // ASSERTIONS:
    // No single frame should take >100ms (that causes visible stutter)
    const stutterFrames = longTasks.filter(t => t.duration > 100)
    expect(
      stutterFrames.length,
      `${stutterFrames.length} frames took >100ms during zoom (stutter). Max: ${stutterFrames.length > 0 ? stutterFrames.reduce((a, b) => a.duration > b.duration ? a : b).duration.toFixed(0) : 0}ms`
    ).toBe(0)

    await client.send('Performance.disable')
  })

  test('2 - Zoom in: no long frames (>100ms) during scroll-wheel zoom', async ({ page, context }) => {
    await page.goto('/#/canvas')
    await waitForCanvas(page)

    const client = await context.newCDPSession(page)
    await client.send('Performance.enable')

    await page.evaluate(() => {
      (window as any).__longTasks = []
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTasks.push({ duration: entry.duration })
        }
      })
      observer.observe({ type: 'longtask', buffered: true })
    })

    const canvas = page.locator('.vue-flow__pane')
    const box = await canvas.boundingBox()
    if (!box) { test.skip(); return }

    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    await page.mouse.move(centerX, centerY)

    // Warmup
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -50)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(500)
    await page.evaluate(() => { (window as any).__longTasks = [] })

    // Actual measurement
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, -100) // zoom in
      await page.waitForTimeout(50)
    }

    await page.waitForTimeout(500)

    const longTasks = await page.evaluate(() => (window as any).__longTasks as Array<{ duration: number }>)

    console.log(`[ZOOM-IN PERF] Long tasks (>50ms): ${longTasks.length}`)
    if (longTasks.length > 0) {
      const maxDuration = Math.max(...longTasks.map(t => t.duration))
      console.log(`[ZOOM-IN PERF] Longest task: ${maxDuration.toFixed(0)}ms`)
    }

    const stutterFrames = longTasks.filter(t => t.duration > 100)
    expect(
      stutterFrames.length,
      `${stutterFrames.length} frames took >100ms during zoom-in`
    ).toBe(0)

    await client.send('Performance.disable')
  })

  test('3 - Rapid zoom in/out cycle: layout count stays reasonable', async ({ page, context }) => {
    await page.goto('/#/canvas')
    await waitForCanvas(page)

    const client = await context.newCDPSession(page)
    await client.send('Performance.enable')

    // Reset metrics baseline
    const baselineMetrics = await client.send('Performance.getMetrics')
    const baselineLayouts = baselineMetrics.metrics.find(m => m.name === 'LayoutCount')?.value ?? 0

    const canvas = page.locator('.vue-flow__pane')
    const box = await canvas.boundingBox()
    if (!box) { test.skip(); return }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    // Rapid zoom in/out cycle (10 out, 10 in)
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 200)
      await page.waitForTimeout(30)
    }
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -200)
      await page.waitForTimeout(30)
    }

    await page.waitForTimeout(500)

    const finalMetrics = await client.send('Performance.getMetrics')
    const finalLayouts = finalMetrics.metrics.find(m => m.name === 'LayoutCount')?.value ?? 0
    const layoutsDuringZoom = finalLayouts - baselineLayouts

    console.log(`[ZOOM CYCLE] Layouts during 20 scroll events: ${layoutsDuringZoom}`)

    // 20 scroll events should not cause more than 200 layouts
    // (excessive layouts = layout thrashing from reactive updates)
    expect(
      layoutsDuringZoom,
      `${layoutsDuringZoom} layouts during zoom cycle (possible thrashing)`
    ).toBeLessThan(200)

    await client.send('Performance.disable')
  })
})
