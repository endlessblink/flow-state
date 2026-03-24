/**
 * WebKitGTK Layout Bug Tests — runs inside the REAL Tauri WebKitGTK window.
 *
 * These tests catch bugs that Playwright WebKit (Apple's engine) CANNOT detect:
 * - CSS Grid sidebar clipping (BUG-1672)
 * - Z-index dropdown stacking (BUG-1674)
 * - overflow:clip not supported
 * - backdrop-filter rendering
 * - position:fixed inside transforms
 *
 * Prerequisites:
 *   1. tauri-driver running on port 4444
 *   2. WebKitWebDriver on PATH (/usr/bin/WebKitWebDriver)
 *   3. Built Tauri binary (src-tauri/target/release/flow-state)
 *
 * Run: npx wdio tests/webdriver/wdio.conf.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../.dev/screenshots/webdriver')

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function saveScreenshot(browser: WebdriverIO.Browser, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`)
  await browser.saveScreenshot(filePath)
  return filePath
}

async function waitForApp(browser: WebdriverIO.Browser) {
  // Wait for Vue app to mount and Supabase to hydrate
  await browser.waitUntil(
    async () => {
      const el = await browser.$('.app-layout')
      return el.isExisting()
    },
    { timeout: 30000, timeoutMsg: 'App layout did not mount within 30s' }
  )
  await browser.pause(3000) // Allow Supabase store hydration
}

/* BUG-1698 */
async function getBaseUrl(browser: WebdriverIO.Browser): Promise<string> {
  const currentUrl = await browser.getUrl()
  // Extract base URL (everything before the hash)
  // e.g., "tauri://localhost/" or "http://localhost:1420/"
  const hashIndex = currentUrl.indexOf('#')
  return hashIndex >= 0 ? currentUrl.substring(0, hashIndex) : currentUrl
}

// ═══════════════════════════════════════════════════════════════════
// A. SIDEBAR CSS GRID BUG (BUG-1672)
// The sidebar renders at ~48px (icon-only) in WebKitGTK instead of 240-340px
// ═══════════════════════════════════════════════════════════════════

describe('BUG-1672: Sidebar CSS Grid in WebKitGTK', () => {

  it('sidebar width is at least 240px (not collapsed to icon-only)', async () => {
    await waitForApp(browser)
    await saveScreenshot(browser, 'sidebar-initial')

    const sidebar = await browser.$('.sidebar, .app-sidebar, [class*="sidebar"]')
    expect(await sidebar.isExisting()).toBe(true)

    const size = await sidebar.getSize()
    const location = await sidebar.getLocation()

    console.log(`Sidebar dimensions: ${size.width}x${size.height} at (${location.x}, ${location.y})`)

    // THE BUG: In WebKitGTK, this might be ~48px (icon-only)
    // It SHOULD be >= 240px per our CSS grid minmax(240px, 340px)
    expect(size.width).toBeGreaterThanOrEqual(240)
  })

  it('sidebar text content is visible (not clipped)', async () => {
    await waitForApp(browser)

    // Find text elements inside the sidebar
    const sidebarTexts = await browser.$$('.sidebar .nav-item-text, .sidebar .project-name, .sidebar span')

    let visibleTextCount = 0
    for (const el of sidebarTexts) {
      const text = await el.getText()
      const displayed = await el.isDisplayed()
      if (displayed && text.length > 0) {
        visibleTextCount++
        const size = await el.getSize()
        // Text should have non-zero width (not clipped)
        expect(size.width).toBeGreaterThan(0)
      }
    }

    console.log(`Visible text elements in sidebar: ${visibleTextCount}`)
    // There should be at least a few text labels visible
    expect(visibleTextCount).toBeGreaterThanOrEqual(3)

    await saveScreenshot(browser, 'sidebar-text-visible')
  })

  it('grid-template-columns computed correctly', async () => {
    await waitForApp(browser)

    const gridColumns = await browser.execute(() => {
      const layout = document.querySelector('.app-layout') as HTMLElement
      if (!layout) return 'NOT FOUND'
      return getComputedStyle(layout).gridTemplateColumns
    })

    console.log(`grid-template-columns: ${gridColumns}`)

    // Should be something like "280px 1fr" or "280px 1000px"
    // NOT "48px 1fr" which means sidebar collapsed
    if (gridColumns !== 'NOT FOUND' && gridColumns !== 'none') {
      const firstCol = parseInt(gridColumns.split(' ')[0])
      expect(firstCol).toBeGreaterThanOrEqual(240)
    }
  })

  it('sidebar project names have readable width', async () => {
    await waitForApp(browser)

    const projectItems = await browser.$$('.sidebar .project-item, .sidebar [class*="project"]')

    for (const item of projectItems) {
      if (await item.isDisplayed()) {
        const size = await item.getSize()
        // Project items should be wide enough to show text, not just an icon
        expect(size.width).toBeGreaterThan(100)
      }
    }
  })

  it('sidebar doesn\'t overflow the viewport', async () => {
    await waitForApp(browser)

    const viewportSize = await browser.getWindowSize()
    const sidebar = await browser.$('.sidebar, .app-sidebar')
    const sidebarSize = await sidebar.getSize()
    const sidebarLoc = await sidebar.getLocation()

    // Sidebar should be within viewport
    expect(sidebarLoc.x + sidebarSize.width).toBeLessThanOrEqual(viewportSize.width)
    expect(sidebarSize.height).toBeLessThanOrEqual(viewportSize.height)
  })
})

// ═══════════════════════════════════════════════════════════════════
// B. Z-INDEX DROPDOWN BUG (BUG-1674)
// Dropdowns render BEHIND the sidebar in WebKitGTK
// ═══════════════════════════════════════════════════════════════════

describe('BUG-1674: Z-Index Stacking in WebKitGTK', () => {

  it('sidebar z-index doesn\'t trap child dropdowns', async () => {
    await waitForApp(browser)

    // Check if sidebar creates an unwanted stacking context
    const stackingInfo = await browser.execute(() => {
      const sidebar = document.querySelector('.sidebar, .app-sidebar') as HTMLElement
      if (!sidebar) return null
      const style = getComputedStyle(sidebar)
      return {
        zIndex: style.zIndex,
        position: style.position,
        transform: style.transform,
        filter: style.filter,
        isolation: style.isolation,
        // Any of these create a stacking context that traps children
        createsStackingContext: (
          style.zIndex !== 'auto' ||
          style.transform !== 'none' ||
          style.filter !== 'none' ||
          style.isolation === 'isolate'
        )
      }
    })

    console.log('Sidebar stacking context info:', JSON.stringify(stackingInfo, null, 2))

    // If sidebar creates a stacking context, dropdowns inside it
    // can't escape — this is the bug mechanism
    if (stackingInfo?.createsStackingContext) {
      console.warn('WARNING: Sidebar creates a stacking context — dropdowns may be trapped')
    }

    await saveScreenshot(browser, 'z-index-sidebar')
  })

  it('NDatePicker popup is not behind sidebar', async () => {
    await waitForApp(browser)

    // Try to find and click a date picker trigger
    const dateTriggers = await browser.$$('[class*="date"] button, .n-date-picker, .n-input[type="date"]')

    if (dateTriggers.length === 0) {
      console.log('No date picker triggers found on current view — skipping')
      return
    }

    await dateTriggers[0].click()
    await browser.pause(500)

    // Check if a date panel appeared
    const datePanel = await browser.$('.n-date-panel, .n-picker-panel')
    if (await datePanel.isExisting()) {
      const panelZ = await browser.execute((selector: string) => {
        const el = document.querySelector(selector) as HTMLElement
        if (!el) return -1
        return parseInt(getComputedStyle(el).zIndex) || 0
      }, '.n-date-panel, .n-picker-panel')

      const sidebarZ = await browser.execute(() => {
        const el = document.querySelector('.sidebar, .app-sidebar') as HTMLElement
        if (!el) return -1
        return parseInt(getComputedStyle(el).zIndex) || 0
      })

      console.log(`Date panel z-index: ${panelZ}, Sidebar z-index: ${sidebarZ}`)
      expect(panelZ).toBeGreaterThan(sidebarZ)

      await saveScreenshot(browser, 'z-index-datepicker')
    }
  })

  it('context menu renders above all content', async () => {
    await waitForApp(browser)

    // Right-click on a task to trigger context menu
    const task = await browser.$('.task-card, .task-item, [class*="task"]')
    if (await task.isExisting()) {
      await task.click({ button: 2 }) // right-click
      await browser.pause(500)

      const contextMenu = await browser.$('.context-menu, [class*="context-menu"]')
      if (await contextMenu.isExisting()) {
        const menuSize = await contextMenu.getSize()
        expect(menuSize.width).toBeGreaterThan(0)
        expect(menuSize.height).toBeGreaterThan(0)

        // Menu should be within viewport (not off-screen)
        const menuLoc = await contextMenu.getLocation()
        const viewport = await browser.getWindowSize()
        expect(menuLoc.x).toBeGreaterThanOrEqual(0)
        expect(menuLoc.y).toBeGreaterThanOrEqual(0)
        expect(menuLoc.x + menuSize.width).toBeLessThanOrEqual(viewport.width)

        await saveScreenshot(browser, 'z-index-contextmenu')
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// C. CSS COMPATIBILITY (WebKitGTK-specific rendering)
// ═══════════════════════════════════════════════════════════════════

describe('WebKitGTK CSS Compatibility', () => {

  it('overflow:clip doesn\'t hide scrollable content', async () => {
    await waitForApp(browser)

    // Find elements that might use overflow:clip
    const overflowIssues = await browser.execute(() => {
      const issues: string[] = []
      document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el)
        if (style.overflow === 'clip' || style.overflowX === 'clip' || style.overflowY === 'clip') {
          const rect = el.getBoundingClientRect()
          // If element has scroll content but overflow:clip, content may vanish
          if (el.scrollHeight > rect.height || el.scrollWidth > rect.width) {
            issues.push(`${el.tagName}.${el.className}: overflow:clip with scrollable content`)
          }
        }
      })
      return issues
    })

    if (overflowIssues.length > 0) {
      console.warn('Elements using overflow:clip with scrollable content:', overflowIssues)
    }
    // In WebKitGTK, overflow:clip may cause content to disappear entirely
    expect(overflowIssues.length).toBe(0)
  })

  it('backdrop-filter renders (glass morphism visible)', async () => {
    await waitForApp(browser)

    const blurElements = await browser.execute(() => {
      let count = 0
      document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el)
        const bf = style.backdropFilter || (style as any).webkitBackdropFilter
        if (bf && bf !== 'none' && bf.includes('blur')) {
          count++
        }
      })
      return count
    })

    console.log(`Elements with backdrop-filter blur: ${blurElements}`)
    // Should have at least some glass morphism elements
    expect(blurElements).toBeGreaterThan(0)

    await saveScreenshot(browser, 'css-backdrop-filter')
  })

  it('position:fixed elements are not trapped by transforms', async () => {
    await waitForApp(browser)

    const fixedIssues = await browser.execute(() => {
      const issues: string[] = []
      document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el)
        if (style.position === 'fixed') {
          // Walk up ancestors looking for transform
          let parent = el.parentElement
          while (parent) {
            const parentStyle = getComputedStyle(parent)
            if (parentStyle.transform !== 'none' ||
                parentStyle.perspective !== 'none' ||
                parentStyle.willChange === 'transform') {
              issues.push(
                `Fixed element ${el.tagName}.${el.className} trapped by ` +
                `transformed ancestor ${parent.tagName}.${parent.className}`
              )
              break
            }
            parent = parent.parentElement
          }
        }
      })
      return issues
    })

    if (fixedIssues.length > 0) {
      console.warn('Fixed elements inside transformed ancestors:', fixedIssues)
    }
    // This is the known WebKitGTK gotcha — fixed becomes absolute relative to transform
    expect(fixedIssues.length).toBe(0)
  })

  it('fonts render correctly (not fallback serif)', async () => {
    await waitForApp(browser)

    const fontFamily = await browser.execute(() => {
      const body = document.body
      return getComputedStyle(body).fontFamily
    })

    console.log(`Body font-family: ${fontFamily}`)
    expect(fontFamily.toLowerCase()).not.toContain('serif')
    expect(fontFamily.toLowerCase()).not.toContain('times')
  })

  it('dark theme background renders (no white flash)', async () => {
    await waitForApp(browser)

    const bgColor = await browser.execute(() => {
      return getComputedStyle(document.body).backgroundColor
    })

    console.log(`Body background: ${bgColor}`)

    // Parse RGB and verify it's dark
    const match = bgColor.match(/\d+/g)
    if (match) {
      const [r, g, b] = match.map(Number)
      const luminance = (r + g + b) / 3
      expect(luminance).toBeLessThan(50) // dark theme
    }
  })

  it('all views render content (no blank pages)', async () => {
    await waitForApp(browser)

    const routes = ['#/', '#/board', '#/tasks', '#/calendar']
    const results: Record<string, { hasContent: boolean; screenshot: string }> = {}
    const baseUrl = await getBaseUrl(browser)

    for (const route of routes) {
      await browser.url(`${baseUrl}${route}`)
      await browser.pause(3000)

      const hasContent = await browser.execute(() => {
        const main = document.querySelector('.main-content, main, [class*="view"]')
        if (!main) return false
        return main.getBoundingClientRect().height > 100
      })

      const screenshot = await saveScreenshot(browser, `view-${route.replace('#/', '') || 'canvas'}`)
      results[route] = { hasContent, screenshot }

      console.log(`${route}: hasContent=${hasContent}`)
      expect(hasContent).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// D. VISUAL REGRESSION BASELINES
// Capture screenshots for future comparison
// ═══════════════════════════════════════════════════════════════════

describe('Visual Regression Baselines', () => {

  it('captures full-page screenshots for each view', async () => {
    await waitForApp(browser)

    const views = [
      { route: '#/', name: 'canvas' },
      { route: '#/board', name: 'board' },
      { route: '#/tasks', name: 'catalog' },
      { route: '#/calendar', name: 'calendar' },
      { route: '#/quick-sort', name: 'quicksort' },
    ]

    const baseUrl = await getBaseUrl(browser)

    for (const view of views) {
      await browser.url(`${baseUrl}${view.route}`)
      await browser.pause(3000)

      const path = await saveScreenshot(browser, `baseline-${view.name}`)
      console.log(`Baseline saved: ${path}`)
    }
  })
})
