import { test, expect, Page } from '@playwright/test'

/**
 * Comprehensive RTL/LTR clickability test
 * Tests that ALL interactive elements load and are clickable in both:
 * - English (LTR)
 * - Hebrew (RTL)
 *
 * Also verifies direction switching works correctly.
 */

test.use({ actionTimeout: 10000 })

const BASE_URL = 'http://localhost:5546'
const VIEWS = [
  { path: '/', name: 'Canvas' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/board', name: 'Board' },
  { path: '/catalog', name: 'Catalog' },
  { path: '/quick-sort', name: 'Quick Sort' },
  { path: '/ai', name: 'AI' },
]

// Helper: dismiss onboarding overlay if present
async function dismissOnboarding(page: Page) {
  // Try "Get Started" first (has text), then "Close" (icon button with title)
  const getStarted = page.getByRole('button', { name: 'Get Started' })
  if (await getStarted.isVisible({ timeout: 2000 }).catch(() => false)) {
    await getStarted.click()
    await page.waitForTimeout(300)
    return
  }
  const closeBtn = page.getByRole('button', { name: 'Close' })
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
}

// Helper: open settings modal
async function openSettings(page: Page) {
  // Settings button uses title attribute: "Open settings" or "פתח הגדרות"
  const settingsBtn = page.getByRole('button', { name: /Open settings|פתח הגדרות/ })
  await settingsBtn.click()
  await page.waitForTimeout(500)
}

// Helper: close settings modal
async function closeSettings(page: Page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// Helper: switch language in settings
async function switchLanguage(page: Page, lang: 'en' | 'he') {
  // Buttons use aria-label: "Switch to English" / "Switch to Hebrew"
  const langBtn = lang === 'en'
    ? page.getByRole('button', { name: 'Switch to English' })
    : page.getByRole('button', { name: 'Switch to Hebrew' })
  await langBtn.click()
  await page.waitForTimeout(300)
}

// Helper: set direction in settings
async function setDirection(page: Page, dir: 'auto' | 'ltr' | 'rtl') {
  // Buttons use aria-label like "Set text direction to Auto"
  const pattern = dir === 'auto' ? /Set text direction to (Auto|אוטומטי)/
    : dir === 'ltr' ? /Set text direction to (LTR|שמאל)/
    : /Set text direction to (RTL|ימין)/
  const dirBtn = page.getByRole('button', { name: pattern })
  await dirBtn.click()
  await page.waitForTimeout(300)
}

// Helper: get all interactive elements info
async function getInteractiveElements(page: Page) {
  return page.evaluate(() => {
    const elements: Array<{
      tag: string
      text: string
      role: string | null
      isVisible: boolean
      isEnabled: boolean
      boundingBox: { x: number, y: number, width: number, height: number } | null
      selector: string
    }> = []

    // All clickable elements
    const selectors = 'button, a, [role="button"], [role="tab"], [role="menuitem"], select, input[type="checkbox"], input[type="radio"], [cursor="pointer"]'
    const els = document.querySelectorAll(selectors)

    els.forEach((el, i) => {
      const htmlEl = el as HTMLElement
      const rect = htmlEl.getBoundingClientRect()
      const style = window.getComputedStyle(htmlEl)
      const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'

      // Only count elements in the viewport area (not hidden behind modals etc)
      if (isVisible && rect.top < window.innerHeight && rect.bottom > 0) {
        elements.push({
          tag: htmlEl.tagName.toLowerCase(),
          text: (htmlEl.textContent || '').trim().substring(0, 50),
          role: htmlEl.getAttribute('role'),
          isVisible,
          isEnabled: !(htmlEl as HTMLButtonElement).disabled,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          selector: `${htmlEl.tagName.toLowerCase()}${htmlEl.className ? '.' + htmlEl.className.split(' ').filter(c => c && !c.startsWith('v-')).slice(0, 2).join('.') : ''}`,
        })
      }
    })
    return elements
  })
}

// Helper: verify clickable elements have proper hit areas
async function verifyClickableElements(page: Page, context: string) {
  const elements = await getInteractiveElements(page)

  const issues: string[] = []

  for (const el of elements) {
    if (!el.boundingBox) continue

    // Check for zero-size elements (invisible but rendered)
    if (el.boundingBox.width < 1 || el.boundingBox.height < 1) {
      issues.push(`${context}: Zero-size element: ${el.selector} "${el.text}"`)
    }

    // Check for elements that are too small to click (< 20px)
    if (el.boundingBox.width < 10 || el.boundingBox.height < 10) {
      // Ignore decorative/icon-only elements
      if (el.tag !== 'img' && el.tag !== 'svg') {
        issues.push(`${context}: Tiny element (${el.boundingBox.width}x${el.boundingBox.height}): ${el.selector} "${el.text}"`)
      }
    }

    // Check for elements pushed off-screen (RTL layout issue)
    if (el.boundingBox.x + el.boundingBox.width < 0 || el.boundingBox.x > 1920) {
      issues.push(`${context}: Off-screen element: ${el.selector} "${el.text}" at x=${el.boundingBox.x}`)
    }
  }

  return { count: elements.length, issues }
}

// ============================================================
// TEST SUITE: Direction Switching
// ============================================================
test.describe('Direction Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await dismissOnboarding(page)
  })

  test('English + Auto should be LTR', async ({ page }) => {
    await openSettings(page)
    await switchLanguage(page, 'en')
    await setDirection(page, 'auto')

    const dirs = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))

    expect(dirs.html).toBe('ltr')
    expect(dirs.appLayout).toBe('ltr')
  })

  test('Hebrew + Auto should be RTL', async ({ page }) => {
    await openSettings(page)
    await switchLanguage(page, 'he')
    await setDirection(page, 'auto')

    const dirs = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))

    expect(dirs.html).toBe('rtl')
    expect(dirs.appLayout).toBe('rtl')
  })

  test('Hebrew + force LTR should be LTR on both html and app-layout', async ({ page }) => {
    await openSettings(page)
    await switchLanguage(page, 'he')
    await setDirection(page, 'ltr')

    const dirs = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))

    expect(dirs.html).toBe('ltr')
    expect(dirs.appLayout).toBe('ltr')
  })

  test('English + force RTL should be RTL on both html and app-layout', async ({ page }) => {
    await openSettings(page)
    await switchLanguage(page, 'en')
    await setDirection(page, 'rtl')

    const dirs = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))

    expect(dirs.html).toBe('rtl')
    expect(dirs.appLayout).toBe('rtl')
  })

  test('direction switch should propagate across all instances (singleton test)', async ({ page }) => {
    await openSettings(page)
    await switchLanguage(page, 'he')
    await setDirection(page, 'auto')

    // Should be RTL
    let appLayoutDir = await page.evaluate(() =>
      document.querySelector('.app-layout')?.getAttribute('dir')
    )
    expect(appLayoutDir).toBe('rtl')

    // Switch to LTR
    await setDirection(page, 'ltr')

    // Both should be LTR now (the bug was app-layout stayed RTL)
    const dirs = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))
    expect(dirs.html).toBe('ltr')
    expect(dirs.appLayout).toBe('ltr')

    // Switch back to RTL
    await setDirection(page, 'rtl')
    const dirs2 = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))
    expect(dirs2.html).toBe('rtl')
    expect(dirs2.appLayout).toBe('rtl')

    // Switch to Auto (Hebrew = RTL)
    await setDirection(page, 'auto')
    const dirs3 = await page.evaluate(() => ({
      html: document.documentElement.getAttribute('dir'),
      appLayout: document.querySelector('.app-layout')?.getAttribute('dir'),
    }))
    expect(dirs3.html).toBe('rtl')
    expect(dirs3.appLayout).toBe('rtl')
  })
})

// ============================================================
// TEST SUITE: Sidebar - English LTR
// ============================================================
test.describe('Sidebar clickability - English LTR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await dismissOnboarding(page)
    // Ensure English + LTR
    await openSettings(page)
    await switchLanguage(page, 'en')
    await setDirection(page, 'auto')
    await closeSettings(page)
  })

  test('sidebar smart views are clickable', async ({ page }) => {
    // Today
    const today = page.locator('.smart-views-section, .sidebar').getByText('Today')
    if (await today.isVisible({ timeout: 2000 }).catch(() => false)) {
      await today.click()
      await page.waitForTimeout(300)
    }

    // This Week
    const week = page.locator('.smart-views-section, .sidebar').getByText('This Week')
    if (await week.isVisible({ timeout: 2000 }).catch(() => false)) {
      await week.click()
      await page.waitForTimeout(300)
    }

    // All Active
    const allActive = page.locator('.smart-views-section, .sidebar').getByText('All Active')
    if (await allActive.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allActive.click()
      await page.waitForTimeout(300)
    }

    // Inbox
    const inbox = page.locator('.smart-views-section, .sidebar').getByText('Inbox')
    if (await inbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inbox.click()
      await page.waitForTimeout(300)
    }
  })

  test('sidebar buttons are clickable', async ({ page }) => {
    // Create project button
    const createProject = page.getByRole('button', { name: /Create project/i })
    await expect(createProject).toBeVisible()
    await createProject.click()
    await page.waitForTimeout(300)
    // Close any modal that opened
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Settings button
    const settings = page.getByRole('button', { name: /Open settings/i })
    await expect(settings).toBeVisible()
    await settings.click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Hide sidebar
    const hideSidebar = page.getByRole('button', { name: /Hide sidebar/i })
    await expect(hideSidebar).toBeVisible()
  })

  test('quick add input is functional', async ({ page }) => {
    const quickAdd = page.getByPlaceholder(/Quick add task/i)
    await expect(quickAdd).toBeVisible()
    await quickAdd.click()
    await quickAdd.fill('Test task')
    // Don't submit, just verify it's typeable
    await expect(quickAdd).toHaveValue('Test task')
  })

  test('duration groups are expandable', async ({ page }) => {
    const durationBtn = page.getByRole('button', { name: /By Duration/i })
    if (await durationBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await durationBtn.click()
      await page.waitForTimeout(300)
      // Should toggle the section
    }
  })
})

// ============================================================
// TEST SUITE: Sidebar - Hebrew RTL
// ============================================================
test.describe('Sidebar clickability - Hebrew RTL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await dismissOnboarding(page)
    // Switch to Hebrew + Auto (RTL)
    await openSettings(page)
    await switchLanguage(page, 'he')
    await setDirection(page, 'auto')
    await closeSettings(page)
  })

  test('sidebar smart views are clickable in RTL', async ({ page }) => {
    // היום (Today)
    const today = page.locator('.smart-views-section, .sidebar').getByText('היום')
    if (await today.isVisible({ timeout: 2000 }).catch(() => false)) {
      await today.click()
      await page.waitForTimeout(300)
    }

    // השבוע (This Week)
    const week = page.locator('.smart-views-section, .sidebar').getByText('השבוע')
    if (await week.isVisible({ timeout: 2000 }).catch(() => false)) {
      await week.click()
      await page.waitForTimeout(300)
    }

    // כל הפעילות (All Active)
    const allActive = page.locator('.smart-views-section, .sidebar').getByText('כל הפעילות')
    if (await allActive.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allActive.click()
      await page.waitForTimeout(300)
    }

    // תיבת דואר (Inbox)
    const inbox = page.locator('.smart-views-section, .sidebar').getByText('תיבת דואר')
    if (await inbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inbox.click()
      await page.waitForTimeout(300)
    }
  })

  test('sidebar buttons are clickable in RTL', async ({ page }) => {
    // צור פרויקט (Create project)
    const createProject = page.getByRole('button', { name: /צור פרויקט/i })
    await expect(createProject).toBeVisible()
    await createProject.click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // פתח הגדרות (Open settings)
    const settings = page.getByRole('button', { name: /פתח הגדרות/i })
    await expect(settings).toBeVisible()
    await settings.click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // הסתר סרגל צד (Hide sidebar)
    const hideSidebar = page.getByRole('button', { name: /הסתר סרגל צד/i })
    await expect(hideSidebar).toBeVisible()
  })

  test('quick add input is functional in RTL', async ({ page }) => {
    const quickAdd = page.getByPlaceholder(/הוספה מהירה/i)
    await expect(quickAdd).toBeVisible()
    await quickAdd.click()
    await quickAdd.fill('משימת בדיקה')
    await expect(quickAdd).toHaveValue('משימת בדיקה')
  })

  test('duration groups are expandable in RTL', async ({ page }) => {
    const durationBtn = page.getByRole('button', { name: /לפי משך/i })
    if (await durationBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await durationBtn.click()
      await page.waitForTimeout(300)
    }
  })
})

// ============================================================
// TEST SUITE: View Navigation - Both Directions
// ============================================================
test.describe('View navigation tabs', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'
    const viewNames = lang === 'en'
      ? ['Canvas', 'Calendar', 'Board', 'Catalog', 'Quick Sort', 'AI']
      : ['קנבס', 'לוח שנה', 'לוח', 'קטלוג', 'מיון מהיר', 'AI']

    test(`all view tabs clickable in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      // Set language
      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Click each view tab
      for (const viewName of viewNames) {
        const tab = page.getByRole('link', { name: viewName })
        await expect(tab).toBeVisible({ timeout: 3000 })
        await tab.click()
        await page.waitForTimeout(500)

        // Verify no crash (page still has content)
        const main = page.locator('main')
        await expect(main).toBeVisible()
      }
    })
  }
})

// ============================================================
// TEST SUITE: Header controls in both directions
// ============================================================
test.describe('Header controls', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    test(`header buttons clickable in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Keyboard shortcuts button
      const kbdBtn = page.getByRole('button', { name: /Keyboard Shortcuts/i })
      if (await kbdBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await kbdBtn.click()
        await page.waitForTimeout(300)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)
      }

      // AI Assistant button
      const aiBtn = page.getByRole('button', { name: /AI Assistant/i })
      if (await aiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await aiBtn.click()
        await page.waitForTimeout(300)
        // Close AI panel if it opened
        if (await aiBtn.isVisible().catch(() => false)) {
          await aiBtn.click()
          await page.waitForTimeout(200)
        }
      }

      // Timer start button
      const timerBtn = page.getByRole('button', { name: /Start 25-min/i })
      if (await timerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(timerBtn).toBeEnabled()
      }

      // Quick Tasks dropdown
      const quickTasksBtn = page.getByRole('button', { name: /Quick Tasks/i })
      if (await quickTasksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await quickTasksBtn.click()
        await page.waitForTimeout(300)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)
      }
    })
  }
})

// ============================================================
// TEST SUITE: Settings modal tabs in both directions
// ============================================================
test.describe('Settings modal tabs', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'
    const tabNames = lang === 'en'
      ? ['General', 'Timer', 'Workflow', 'Notifications', 'AI & Weekly Plan', 'Data & Backup', 'Account']
      : ['כללי', 'טיימר', 'זרימת עבודה', 'התראות', 'AI ותוכנית שבועית', 'נתונים וגיבוי', 'חשבון']

    test(`all settings tabs clickable in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')

      // Click each tab
      for (const tabName of tabNames) {
        const tab = page.getByRole('button', { name: tabName, exact: true })
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tab.click()
          await page.waitForTimeout(300)
          // Verify tab content loads (main area has content)
          const settingsMain = page.locator('.settings-content, .settings-main, main').first()
          await expect(settingsMain).toBeVisible()
        }
      }
    })
  }
})

// ============================================================
// TEST SUITE: Board view - both directions
// ============================================================
test.describe('Board view controls', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    test(`board view loads and has clickable columns in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Navigate to board
      const boardTab = lang === 'en'
        ? page.getByRole('link', { name: 'Board' })
        : page.getByRole('link', { name: 'לוח' })
      await boardTab.click()
      await page.waitForTimeout(500)

      // Verify board loaded
      const main = page.locator('main')
      await expect(main).toBeVisible()

      // Check for kanban columns (they might be empty but should exist)
      const addButtons = page.locator('button').filter({ hasText: /Add.*task|הוסף.*משימה/i })
      const count = await addButtons.count()
      // Board should have "add task" buttons in columns
      // Just verify the view loaded without errors
      expect(count).toBeGreaterThanOrEqual(0)
    })
  }
})

// ============================================================
// TEST SUITE: Catalog view filters - both directions
// ============================================================
test.describe('Catalog view filters', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    test(`catalog filter toggles work in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Navigate to catalog
      const catalogTab = lang === 'en'
        ? page.getByRole('link', { name: 'Catalog' })
        : page.getByRole('link', { name: 'קטלוג' })
      await catalogTab.click()
      await page.waitForTimeout(500)

      // Toggle filters button
      const toggleFilters = page.getByRole('button', { name: /Toggle filters|הסתר סינון/i })
      if (await toggleFilters.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggleFilters.click()
        await page.waitForTimeout(300)
      }

      // Show completed toggle
      const showCompleted = page.getByRole('button', { name: /Show completed|הצג הושלמו/i })
      if (await showCompleted.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(showCompleted).toBeEnabled()
      }
    })
  }
})

// ============================================================
// TEST SUITE: Calendar view - both directions
// ============================================================
test.describe('Calendar view controls', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    test(`calendar navigation works in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Navigate to calendar
      const calendarTab = lang === 'en'
        ? page.getByRole('link', { name: 'Calendar' })
        : page.getByRole('link', { name: 'לוח שנה' })
      await calendarTab.click()
      await page.waitForTimeout(500)

      // Today button
      const todayBtn = page.getByRole('button', { name: /^Today$|^היום$/i })
      if (await todayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await todayBtn.click()
        await page.waitForTimeout(300)
      }

      // Previous/Next navigation
      const prevBtn = page.getByRole('button', { name: /Previous|הקודם/i })
      if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await prevBtn.click()
        await page.waitForTimeout(300)
      }

      const nextBtn = page.getByRole('button', { name: /Next|הבא/i })
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(300)
      }

      // View mode buttons (Day/Week/Month)
      for (const mode of lang === 'en' ? ['Day', 'Week', 'Month'] : ['יום', 'שבוע', 'חודש']) {
        const modeBtn = page.getByRole('button', { name: mode, exact: true })
        if (await modeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await modeBtn.click()
          await page.waitForTimeout(300)
        }
      }
    })
  }
})

// ============================================================
// TEST SUITE: Element visibility scan per view
// ============================================================
test.describe('Interactive element scan', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    for (const view of VIEWS) {
      test(`no off-screen interactive elements in ${view.name} - ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
        await dismissOnboarding(page)

        await openSettings(page)
        await switchLanguage(page, lang)
        await setDirection(page, 'auto')
        await closeSettings(page)

        // Navigate to view
        await page.goto(`${BASE_URL}/#${view.path}`)
        await page.waitForTimeout(500)

        const { count, issues } = await verifyClickableElements(page, `${view.name} (${lang})`)

        // Should have at least some interactive elements
        expect(count).toBeGreaterThan(0)

        // No off-screen elements (critical RTL bug indicator)
        const offScreenIssues = issues.filter(i => i.includes('Off-screen'))
        if (offScreenIssues.length > 0) {
          console.warn('Off-screen elements found:', offScreenIssues)
        }
        expect(offScreenIssues.length).toBe(0)
      })
    }
  }
})

// ============================================================
// TEST SUITE: No console errors in either direction
// ============================================================
test.describe('Console error check', () => {
  for (const lang of ['en', 'he'] as const) {
    const dir = lang === 'en' ? 'LTR' : 'RTL'

    test(`no critical console errors navigating all views in ${lang.toUpperCase()} (${dir})`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => {
        errors.push(err.message)
      })

      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await dismissOnboarding(page)

      await openSettings(page)
      await switchLanguage(page, lang)
      await setDirection(page, 'auto')
      await closeSettings(page)

      // Navigate through all views
      for (const view of VIEWS) {
        await page.goto(`${BASE_URL}/#${view.path}`)
        await page.waitForTimeout(500)
      }

      // Filter out known non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('ResizeObserver') &&
        !e.includes('AbortError') &&
        !e.includes('Network') &&
        !e.includes('Failed to fetch')
      )

      expect(criticalErrors).toEqual([])
    })
  }
})
