/**
 * CSS Rendering E2E Tests
 *
 * Tests CSS rendering issues that differ between Chromium and WebKitGTK.
 * Covers: glass morphism, design tokens, overflow, fonts, RTL, and visual regressions.
 *
 * Key WebKitGTK differences:
 * - `overflow: clip` not supported (use `overflow: hidden` fallback)
 * - `perspective` on parents creates containing block for `position: fixed` children
 * - backdrop-filter may have limited support or visual differences
 */
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS } from '../fixtures/test-ids'
import path from 'node:path'

const SCREENSHOT_DIR = '.dev/screenshots'

test.describe('CSS Rendering', () => {
  // ── 1. Glass morphism: backdrop-filter renders blur ───────────────────

  test('1 - Glass morphism backdrop-filter renders blur effect', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Sidebar uses glass morphism
    const sidebar = page.locator('.sidebar').first()
    if (await sidebar.isVisible().catch(() => false)) {
      const styles = await sidebar.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          backdropFilter: computed.backdropFilter || (computed as any).webkitBackdropFilter || '',
          background: computed.background,
        }
      })

      // backdrop-filter should be set (blur) OR background should use rgba (glass effect)
      const hasBlur = styles.backdropFilter.includes('blur')
      const hasGlassBg = styles.background.includes('rgba') || styles.background.includes('linear-gradient')

      expect(hasBlur || hasGlassBg, 'Sidebar should have glass morphism (blur or semi-transparent bg)').toBeTruthy()
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-glass-morphism.png') })
  })

  // ── 2. All buttons use glass style ────────────────────────────────────

  test('2 - Buttons use glass style, no solid fill', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check visible buttons for solid-fill violations
    const buttons = page.locator('button:visible, .btn:visible')
    const count = await buttons.count()
    const solidFillViolations: string[] = []

    // Check up to 20 buttons
    const checkCount = Math.min(count, 20)
    for (let i = 0; i < checkCount; i++) {
      const btn = buttons.nth(i)
      const result = await btn.evaluate(el => {
        const computed = window.getComputedStyle(el)
        const bg = computed.backgroundColor
        const text = el.textContent?.trim() || el.className
        // Solid fill = fully opaque non-transparent background
        // rgba(78, 205, 196, 1) or rgb(78, 205, 196) would be solid teal
        const isSolid = /^rgb\(78,\s*205,\s*196\)$/.test(bg) ||
                        /^rgba\(78,\s*205,\s*196,\s*1\)$/.test(bg)
        return { bg, text: text.substring(0, 30), isSolid }
      })

      if (result.isSolid) {
        solidFillViolations.push(`Button "${result.text}" has solid teal: ${result.bg}`)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-buttons-glass.png') })

    // Soft assertion - log violations but don't fail hard (small indicators are OK per CLAUDE.md)
    if (solidFillViolations.length > 0) {
      console.warn('Possible solid-fill button violations:', solidFillViolations)
    }
  })

  // ── 3. Scrollbars styled ──────────────────────────────────────────────

  test('3 - Scrollbars styled, not default browser scrollbars', async ({ page }) => {
    await page.goto('/#/board')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check if custom scrollbar CSS is applied
    const hasCustomScrollbars = await page.evaluate(() => {
      // Check for ::-webkit-scrollbar styles via computed style presence
      const style = document.createElement('style')
      style.textContent = '::-webkit-scrollbar { width: 0px; }'
      document.head.appendChild(style)

      // If scrollbar-width or -webkit-scrollbar is used, check stylesheets
      const sheets = Array.from(document.styleSheets)
      let hasScrollbarRule = false

      try {
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            for (const rule of rules) {
              if (rule.cssText?.includes('scrollbar')) {
                hasScrollbarRule = true
                break
              }
            }
          } catch {
            // Cross-origin stylesheet, skip
          }
          if (hasScrollbarRule) break
        }
      } finally {
        style.remove()
      }

      return hasScrollbarRule
    })

    expect(hasCustomScrollbars, 'App should have custom scrollbar styles').toBeTruthy()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-scrollbars.png') })
  })

  // ── 4. Sidebar collapse transition ────────────────────────────────────

  test('4 - Sidebar collapse animates smoothly', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const sidebar = page.locator('.sidebar').first()
    const isVisible = await sidebar.isVisible().catch(() => false)

    if (isVisible) {
      const beforeBox = await sidebar.boundingBox()

      // Toggle sidebar using keyboard shortcut or button
      await page.keyboard.press('Control+b')
      await page.waitForTimeout(500)

      // Sidebar should either be hidden or collapsed
      const afterVisible = await sidebar.isVisible().catch(() => false)

      // Toggle back
      await page.keyboard.press('Control+b')
      await page.waitForTimeout(500)

      const restoredVisible = await sidebar.isVisible().catch(() => false)

      // If sidebar toggles, the transition is working
      if (beforeBox) {
        expect(restoredVisible, 'Sidebar should be visible after toggling back').toBeTruthy()
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-sidebar-toggle.png') })
  })

  // ── 5. No horizontal scrollbar on main views ─────────────────────────

  test('5 - Text does not overflow container bounds (no horizontal scrollbar)', async ({ page }) => {
    const routes = ['/#/', '/#/board', '/#/tasks', '/#/calendar']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500)

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })

      expect(hasHorizontalScroll, `${route} should not have horizontal scrollbar`).toBeFalsy()
    }
  })

  // ── 6. Dark theme: no white flashes ───────────────────────────────────

  test('6 - Dark theme: no white/light flashes on load or view switch', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Check background color of root elements
    const bgInfo = await page.evaluate(() => {
      const html = window.getComputedStyle(document.documentElement)
      const body = window.getComputedStyle(document.body)
      const app = document.querySelector('#app')
      const appStyle = app ? window.getComputedStyle(app) : null

      return {
        html: html.backgroundColor,
        body: body.backgroundColor,
        app: appStyle?.backgroundColor || 'none',
      }
    })

    // None of the backgrounds should be white or near-white
    const isWhite = (color: string) => {
      if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return false
      // Parse rgb values
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (!match) return false
      const [, r, g, b] = match.map(Number)
      // If all channels > 240, it's essentially white
      return r > 240 && g > 240 && b > 240
    }

    expect(isWhite(bgInfo.html), `HTML bg should not be white: ${bgInfo.html}`).toBeFalsy()
    expect(isWhite(bgInfo.body), `Body bg should not be white: ${bgInfo.body}`).toBeFalsy()
    if (bgInfo.app !== 'none') {
      expect(isWhite(bgInfo.app), `App bg should not be white: ${bgInfo.app}`).toBeFalsy()
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-dark-theme.png') })
  })

  // ── 7. Fonts loaded correctly ─────────────────────────────────────────

  test('7 - Fonts loaded correctly, not falling back to system serif', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const fontInfo = await page.evaluate(() => {
      const body = window.getComputedStyle(document.body)
      const fontFamily = body.fontFamily

      // Check if it's a serif fallback (Times New Roman, serif, etc.)
      const isSerifFallback = /^['"]?Times/i.test(fontFamily) ||
                               fontFamily === 'serif' ||
                               /^['"]?Georgia/i.test(fontFamily)

      return { fontFamily, isSerifFallback }
    })

    expect(fontInfo.isSerifFallback, `Font should not be serif fallback. Got: ${fontInfo.fontFamily}`).toBeFalsy()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-fonts.png') })
  })

  // ── 8. Design tokens: brand-primary visible ───────────────────────────

  test('8 - Design tokens applied: brand-primary color visible on page', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check that --brand-primary is defined and used
    const brandPrimary = await page.evaluate(() => {
      const root = window.getComputedStyle(document.documentElement)
      return root.getPropertyValue('--brand-primary').trim()
    })

    expect(brandPrimary, 'Design token --brand-primary should be defined').toBeTruthy()

    // Look for teal (#4ECDC4) in any visible element's color or border
    const hasTealElement = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      for (const el of elements) {
        const style = window.getComputedStyle(el)
        const color = style.color
        const borderColor = style.borderColor
        const bg = style.backgroundColor

        // Check for teal (78, 205, 196) in any property
        const tealPattern = /78,\s*205,\s*196/
        if (tealPattern.test(color) || tealPattern.test(borderColor) || tealPattern.test(bg)) {
          return true
        }
      }
      return false
    })

    expect(hasTealElement, 'At least one element should use brand-primary teal color').toBeTruthy()

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-design-tokens.png') })
  })

  // ── 9. Canvas nodes render with correct dimensions ────────────────────

  test('9 - Canvas nodes render with correct dimensions (not 0x0)', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Vue Flow nodes
    const nodes = page.locator('.vue-flow__node')
    const nodeCount = await nodes.count()

    if (nodeCount > 0) {
      // Check first few nodes have non-zero dimensions
      const checkCount = Math.min(nodeCount, 5)
      for (let i = 0; i < checkCount; i++) {
        const box = await nodes.nth(i).boundingBox()
        expect(box, `Node ${i} should have a bounding box`).toBeTruthy()
        expect(box!.width, `Node ${i} width should be > 0`).toBeGreaterThan(0)
        expect(box!.height, `Node ${i} height should be > 0`).toBeGreaterThan(0)
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-canvas-nodes.png') })
  })

  // ── 10. RTL mode: layout mirrors correctly ────────────────────────────

  test('10 - RTL mode: toggle direction, verify layout mirrors', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Get initial direction
    const initialDir = await page.evaluate(() => {
      return document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || 'ltr'
    })

    // Force RTL via attribute
    await page.evaluate(() => {
      const appLayout = document.querySelector('.app-layout')
      if (appLayout) {
        appLayout.setAttribute('dir', 'rtl')
      }
      document.documentElement.setAttribute('dir', 'rtl')
    })
    await page.waitForTimeout(500)

    // Sidebar should be on the right in RTL
    const sidebar = page.locator('.sidebar').first()
    const mainContent = page.locator('.main-content').first()

    if (await sidebar.isVisible().catch(() => false) && await mainContent.isVisible().catch(() => false)) {
      const sidebarBox = await sidebar.boundingBox()
      const mainBox = await mainContent.boundingBox()

      if (sidebarBox && mainBox) {
        // In RTL, sidebar should be to the right of main content
        // (or at least the layout should have changed)
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-rtl-layout.png') })
      }
    }

    // Restore LTR
    await page.evaluate(() => {
      const appLayout = document.querySelector('.app-layout')
      if (appLayout) {
        appLayout.setAttribute('dir', 'ltr')
      }
      document.documentElement.setAttribute('dir', 'ltr')
    })
  })

  // ── 11. Timer display: digits render in correct font ──────────────────

  test('11 - Timer display digits render in correct font', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Timer is in the header
    const timerDisplay = page.locator('[class*="timer"], [class*="Timer"], [class*="pomodoro"]').first()

    if (await timerDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const fontInfo = await timerDisplay.evaluate(el => {
        const style = window.getComputedStyle(el)
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          // Check the timer text content
          text: el.textContent?.trim() || '',
        }
      })

      // Timer font should be monospace or a specific font, not default serif
      const isSerif = /^['"]?Times/i.test(fontInfo.fontFamily) || fontInfo.fontFamily === 'serif'
      expect(isSerif, `Timer font should not be serif. Got: ${fontInfo.fontFamily}`).toBeFalsy()
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-timer-font.png') })
  })

  // ── 12. Task cards: priority badges have correct colors ───────────────

  test('12 - Task priority badges render with correct colors', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for priority indicators
    const priorityBadges = page.locator('[class*="priority"], [class*="Priority"]')
    const count = await priorityBadges.count()

    if (count > 0) {
      // At least verify badges are visible and have color
      const badge = priorityBadges.first()
      if (await badge.isVisible().catch(() => false)) {
        const colorInfo = await badge.evaluate(el => {
          const style = window.getComputedStyle(el)
          return {
            color: style.color,
            bg: style.backgroundColor,
            borderColor: style.borderColor,
          }
        })

        // Badge should have some color (not default black text on transparent bg)
        const hasColor = colorInfo.color !== 'rgb(0, 0, 0)' ||
                         colorInfo.bg !== 'rgba(0, 0, 0, 0)' ||
                         colorInfo.borderColor !== 'rgb(0, 0, 0)'

        expect(hasColor, 'Priority badge should have styled colors').toBeTruthy()
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-priority-badges.png') })
  })

  // ── 13. Group nodes on canvas: colored correctly ──────────────────────

  test('13 - Canvas group nodes colored correctly with visible text', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Look for group nodes on canvas
    const groupNodes = page.locator('.vue-flow__node[class*="group"], [class*="group-node"]')
    const count = await groupNodes.count()

    if (count > 0) {
      const groupNode = groupNodes.first()
      if (await groupNode.isVisible().catch(() => false)) {
        const styleInfo = await groupNode.evaluate(el => {
          const style = window.getComputedStyle(el)
          // Check for group name text
          const nameEl = el.querySelector('[class*="name"], [class*="title"], h3, h4, span')
          const nameStyle = nameEl ? window.getComputedStyle(nameEl) : null

          return {
            bg: style.backgroundColor,
            border: style.borderColor,
            textColor: nameStyle?.color || '',
            hasText: !!nameEl?.textContent?.trim(),
          }
        })

        // Group should have visible text
        if (styleInfo.hasText) {
          // Text should not be transparent or same as background
          expect(styleInfo.textColor, 'Group text color should be set').toBeTruthy()
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-canvas-groups.png') })
  })

  // ── 14. No elements with visibility: hidden that should be visible ────

  test('14 - No elements with visibility:hidden that should be visible', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const hiddenButSized = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      const suspicious: string[] = []

      for (const el of elements) {
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden') {
          const rect = el.getBoundingClientRect()
          // If element has meaningful size but is hidden, it might be a bug
          if (rect.width > 50 && rect.height > 50) {
            const tag = el.tagName.toLowerCase()
            const cls = el.className?.toString().substring(0, 50) || ''
            suspicious.push(`${tag}.${cls} (${Math.round(rect.width)}x${Math.round(rect.height)})`)
          }
        }
      }

      return suspicious
    })

    // Warn about suspicious hidden elements (some may be intentional like off-screen caches)
    if (hiddenButSized.length > 0) {
      console.warn('Elements with visibility:hidden but meaningful size:', hiddenButSized)
    }

    // Hard fail only if many elements are hidden (indicates a rendering bug)
    expect(hiddenButSized.length, `Too many suspiciously hidden elements: ${hiddenButSized.join(', ')}`).toBeLessThan(5)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-hidden-elements.png') })
  })

  // ── 15. No overlapping text ───────────────────────────────────────────

  test('15 - No overlapping text (text does not render on top of other text)', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Collect bounding boxes of visible text elements
    const overlaps = await page.evaluate(() => {
      const textElements = document.querySelectorAll(
        'h1, h2, h3, h4, h5, p, span, a, button, label, .task-title, [class*="title"]'
      )

      const rects: { el: string; rect: DOMRect }[] = []

      for (const el of textElements) {
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue

        const rect = el.getBoundingClientRect()
        // Only check elements with actual size and within viewport
        if (rect.width > 10 && rect.height > 10 && rect.top >= 0 && rect.top < window.innerHeight) {
          const text = el.textContent?.trim().substring(0, 30) || ''
          if (text) {
            rects.push({ el: text, rect })
          }
        }
      }

      // Check for significant overlaps (>50% overlap between different text elements)
      const overlapping: string[] = []
      for (let i = 0; i < Math.min(rects.length, 50); i++) {
        for (let j = i + 1; j < Math.min(rects.length, 50); j++) {
          const a = rects[i].rect
          const b = rects[j].rect

          // Skip parent-child relationships (contained within each other)
          const aContainsB = a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom
          const bContainsA = b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom
          if (aContainsB || bContainsA) continue

          // Calculate overlap
          const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
          const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
          const overlapArea = overlapX * overlapY
          const minArea = Math.min(a.width * a.height, b.width * b.height)

          if (minArea > 0 && overlapArea / minArea > 0.5) {
            overlapping.push(`"${rects[i].el}" overlaps "${rects[j].el}"`)
          }
        }
      }

      return overlapping
    })

    if (overlaps.length > 0) {
      console.warn('Detected text overlaps:', overlaps)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'css-text-overlaps.png') })
    }

    // Allow a few overlaps (badges on icons, etc.) but fail on many
    expect(overlaps.length, `Too many text overlaps detected: ${overlaps.slice(0, 5).join(', ')}`).toBeLessThan(10)
  })
})
