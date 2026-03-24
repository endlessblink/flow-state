/**
 * Visual audit script — injected via WebDriver `browser.execute()` into real Tauri/WebKitGTK.
 * Returns structured array of visual issues found in the DOM.
 *
 * Usage in WebdriverIO:
 *   const issues = await browser.execute(auditVisualIssues);
 *   expect(issues).toHaveLength(0);
 */

function auditVisualIssues() {
  const issues = []

  // Helper: is element supposed to be visible?
  function shouldBeVisible(el) {
    const s = getComputedStyle(el)
    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      s.opacity !== '0' &&
      !el.hasAttribute('aria-hidden') &&
      !el.closest('[aria-hidden="true"]')
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. Elements with 0 width/height that should be visible
  // ═══════════════════════════════════════════════════════════════
  const importantSelectors = [
    '.sidebar', '.main-content', '.nav-label', '.project-name',
    '.inbox-title', '.section-title', '.task-title', '.task-name',
    '.base-nav-item', '.view-wrapper', '.content-header'
  ]
  importantSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect()
      if (shouldBeVisible(el) && (r.width === 0 || r.height === 0)) {
        issues.push({
          type: 'zero-dimension',
          selector: sel,
          text: (el.textContent || '').trim().substring(0, 30),
          rect: { width: Math.round(r.width), height: Math.round(r.height) }
        })
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 2. Task card text overlapped by action icons
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll(
    '.inbox-task-card, .task-card, [class*="task-item"], [class*="inbox-task"]'
  ).forEach(card => {
    const title = card.querySelector('[class*="title"], [class*="task-name"], [class*="task-text"]')
    const actions = card.querySelector('[class*="actions"], [class*="action-btn"]')
    if (title && actions) {
      const tR = title.getBoundingClientRect()
      const aR = actions.getBoundingClientRect()
      const dir = getComputedStyle(card).direction
      const overlap = dir === 'rtl'
        ? (aR.right > tR.left + 5 && aR.width > 0 && tR.width > 0)
        : (aR.left < tR.right - 5 && aR.width > 0 && tR.width > 0)
      if (overlap) {
        issues.push({
          type: 'text-action-overlap',
          text: (title.textContent || '').trim().substring(0, 25),
          titleRight: Math.round(tR.right),
          actionsLeft: Math.round(aR.left),
          direction: dir
        })
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. Icons/SVGs not rendering (0 dimensions or wrong opacity)
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll(
    'svg, .lucide, .n-icon, [class*="icon"], .done-toggle, .task-check'
  ).forEach(el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    if (shouldBeVisible(el) && (r.width < 8 || r.height < 8)) {
      issues.push({
        type: 'icon-too-small',
        className: (el.className || '').toString().substring(0, 40),
        rect: { width: Math.round(r.width), height: Math.round(r.height) },
        opacity: s.opacity
      })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 4. backdrop-filter not applying (glass morphism missing)
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll(
    '.sidebar, .empty-card, .glass, [class*="glass"], .base-nav-item.is-active'
  ).forEach(el => {
    const s = getComputedStyle(el)
    const bf = s.backdropFilter || s.webkitBackdropFilter || ''
    const bg = s.backgroundColor
    // If element should have glass but background is fully opaque → backdrop not working
    if (bf && bf !== 'none' && bf.includes('blur')) {
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
      if (m) {
        const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1
        if (alpha === 1) {
          issues.push({
            type: 'backdrop-opaque-bg',
            selector: el.className.toString().substring(0, 40),
            backdropFilter: bf,
            backgroundColor: bg
          })
        }
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 5. Text truncated by parent overflow
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll(
    '.nav-label, .task-title, .project-name, .inbox-title, .section-title'
  ).forEach(el => {
    if (el.scrollWidth > el.clientWidth + 2 && el.textContent.trim().length > 0) {
      const r = el.getBoundingClientRect()
      if (r.width < 30) {
        issues.push({
          type: 'text-severely-truncated',
          text: (el.textContent || '').trim().substring(0, 25),
          containerWidth: Math.round(r.width),
          scrollWidth: el.scrollWidth
        })
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 6. RTL text direction issues
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll('[dir="rtl"], *').forEach(el => {
    const s = getComputedStyle(el)
    if (s.direction === 'rtl' && s.textAlign === 'left' && el.textContent.trim().length > 5) {
      // RTL container with LTR text alignment — potential issue
      const hasHebrew = /[\u0590-\u05FF]/.test(el.textContent)
      if (hasHebrew) {
        issues.push({
          type: 'rtl-align-mismatch',
          text: (el.textContent || '').trim().substring(0, 30),
          textAlign: s.textAlign,
          direction: s.direction
        })
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 7. CSP blocking runtime styles (Naive UI css-render)
  // ═══════════════════════════════════════════════════════════════
  const cspEl = document.createElement('div')
  cspEl.id = '__csp_audit__'
  cspEl.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;'
  document.body.appendChild(cspEl)
  const st = document.createElement('style')
  st.textContent = '#__csp_audit__ { width: 42px !important; }'
  document.head.appendChild(st)
  const cspWidth = document.getElementById('__csp_audit__').getBoundingClientRect().width
  if (Math.round(cspWidth) !== 42) {
    issues.push({
      type: 'csp-blocks-styles',
      detail: 'Runtime <style> injection blocked — NPopover/NDropdown will be invisible',
      expectedWidth: 42,
      actualWidth: Math.round(cspWidth)
    })
  }
  cspEl.remove()
  st.remove()

  // ═══════════════════════════════════════════════════════════════
  // 8. Sidebar grid layout check
  // ═══════════════════════════════════════════════════════════════
  const sidebar = document.querySelector('.sidebar, aside')
  const mainContent = document.querySelector('.main-content, main')
  if (sidebar && mainContent) {
    const sR = sidebar.getBoundingClientRect()
    const mR = mainContent.getBoundingClientRect()
    if (sR.width < 200) {
      issues.push({ type: 'sidebar-too-narrow', width: Math.round(sR.width) })
    }
    if (mR.left < sR.right - 5) {
      issues.push({
        type: 'sidebar-main-overlap',
        sidebarRight: Math.round(sR.right),
        mainLeft: Math.round(mR.left)
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. Horizontal overflow (content wider than viewport)
  // ═══════════════════════════════════════════════════════════════
  document.querySelectorAll(
    '.sidebar, .main-content, .inbox-header, .content-header, .app-layout'
  ).forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.right > window.innerWidth + 10) {
      issues.push({
        type: 'horizontal-overflow',
        selector: (el.className || '').toString().substring(0, 30),
        right: Math.round(r.right),
        viewportWidth: window.innerWidth
      })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 10. Console errors captured
  // ═══════════════════════════════════════════════════════════════
  const captured = window.__visualAuditErrors || []
  if (captured.length > 0) {
    issues.push({
      type: 'console-errors',
      count: captured.length,
      errors: captured.slice(0, 5)
    })
  }

  return issues
}

// Export for both WebDriver execute() and Node.js require()
if (typeof module !== 'undefined') module.exports = { auditVisualIssues }
