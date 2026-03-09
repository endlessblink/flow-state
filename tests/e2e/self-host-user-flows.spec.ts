/**
 * TASK-1471: Self-Host User Flow Tests
 *
 * Exercises every core feature a self-hosted user would need:
 * - Auth (login page, error handling)
 * - Task CRUD (create, view)
 * - Project visibility
 * - Views navigation (Board, Calendar, Canvas, Catalog)
 * - Timer visibility
 * - Settings access
 * - API health
 * - No critical JS errors
 */
import { test, expect } from '../fixtures/auth'

test.describe('Self-Host: Authenticated User Flows', () => {

  // ── Task CRUD ──────────────────────────────────────────────────────────

  test('can view seeded tasks on board view', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Should see at least one of the seeded tasks
    await expect(page.getByText('Design landing page')).toBeVisible({ timeout: 10000 })
  })

  test('can create a new task via quick-add', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Use the quick-add input in the sidebar
    const quickAdd = page.locator('input[placeholder*="Quick add task"], input[placeholder*="quick add"]').first()
    await expect(quickAdd).toBeVisible({ timeout: 10000 })
    await quickAdd.fill('Self-host test task')
    await page.keyboard.press('Enter')

    // Verify task appears
    await expect(page.getByText('Self-host test task')).toBeVisible({ timeout: 10000 })
  })

  // ── Views Navigation ──────────────────────────────────────────────────

  test('can navigate to all main views via nav tabs', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Board view — should show "All Tasks" or task list
    await expect(page.getByText('All Tasks')).toBeVisible({ timeout: 10000 })

    // Calendar view — click nav tab
    await page.getByText('Calendar', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // Calendar should have some calendar UI
    const calendarEl = page.locator('.vuecal, .calendar-view, .calendar-container').first()
    await expect(calendarEl).toBeVisible({ timeout: 10000 })

    // Canvas view — click nav tab
    await page.getByText('Canvas', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // Canvas should have vue-flow
    const canvasEl = page.locator('.vue-flow').first()
    await expect(canvasEl).toBeVisible({ timeout: 10000 })

    // Catalog view — click nav tab
    await page.getByText('Catalog', { exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // Should show some task content
    await expect(page.locator('.catalog-view, .task-catalog, main').first()).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to settings', async ({ page }) => {
    // Settings is accessible via the gear icon in sidebar
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Click the settings gear icon in sidebar
    const settingsBtn = page.locator('a[href*="settings"], button[title*="Settings"], .settings-link, [data-testid="settings-link"]').first()
    if (await settingsBtn.isVisible({ timeout: 3000 })) {
      await settingsBtn.click()
    } else {
      await page.goto('/#/settings')
    }
    await page.waitForLoadState('networkidle')

    // Settings page should render
    await expect(page.locator('text=Account, text=Preferences, text=Theme').first()).toBeVisible({ timeout: 10000 })
  })

  // ── Timer/Pomodoro ────────────────────────────────────────────────────

  test('timer component is visible in header', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Timer should show "25:00" or similar in the header
    await expect(page.getByText('25:00')).toBeVisible({ timeout: 10000 })
  })

  // ── Projects ──────────────────────────────────────────────────────────

  test('seeded projects are visible in sidebar', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Should see the seeded projects in sidebar
    const sidebar = page.locator('.sidebar, nav, aside').first()
    await expect(sidebar.getByText('Work')).toBeVisible({ timeout: 10000 })
    await expect(sidebar.getByText('Personal')).toBeVisible({ timeout: 10000 })
  })

  // ── No Console Errors ─────────────────────────────────────────────────

  test('no critical JavaScript errors on main views', async ({ page }) => {
    const criticalErrors: string[] = []

    page.on('pageerror', (error) => {
      const msg = error.message
      // Ignore known non-critical errors
      if (msg.includes('ResizeObserver')) return
      if (msg.includes('CHANNEL_ERROR')) return
      if (msg.includes('Non-Error promise rejection')) return
      if (msg.includes('AbortError')) return
      if (msg.includes('network')) return
      criticalErrors.push(msg)
    })

    for (const route of ['/#/tasks', '/#/calendar', '/#/canvas']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
    }

    if (criticalErrors.length > 0) {
      console.log('Critical JS errors found:', criticalErrors)
    }
    expect(criticalErrors.length).toBe(0)
  })

  // ── API Health ────────────────────────────────────────────────────────

  test('Supabase API responds correctly', async ({ request }) => {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

    // Auth health
    const authHealth = await request.get(`${supabaseUrl}/auth/v1/health`)
    expect(authHealth.ok()).toBeTruthy()

    // REST API accessible
    const restResponse = await request.get(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: anonKey },
    })
    expect(restResponse.ok()).toBeTruthy()
  })

  // ── Task Interaction ──────────────────────────────────────────────────

  test('can click on a task to open edit modal', async ({ page }) => {
    await page.goto('/#/tasks')
    await page.waitForLoadState('networkidle')

    // Click on a seeded task
    const task = page.getByText('Design landing page').first()
    await expect(task).toBeVisible({ timeout: 10000 })
    await task.click()

    // Edit modal/panel should appear
    await page.waitForTimeout(1000)
    const editArea = page.locator('.task-edit-modal, .task-detail, .edit-panel, [data-testid="task-edit"]').first()
    await expect(editArea).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Self-Host: Auth Flows (unauthenticated)', () => {

  test('unauthenticated user sees login form', async ({ browser }) => {
    // Fresh context with no auth state
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    await page.goto('http://127.0.0.1:5547/#/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Should be redirected to auth or show auth modal
    // Check for any auth-related UI element
    const hasAuthUI = await page.locator('.login-form, .auth-modal, .auth-page, input[type="email"], text=Sign In').first().isVisible({ timeout: 10000 }).catch(() => false)

    expect(hasAuthUI).toBeTruthy()
    await context.close()
  })

  test('invalid login shows error message', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()

    await page.goto('http://127.0.0.1:5547/#/auth')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Find and fill email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill('nonexistent@test.invalid')

    // Find and fill password input
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.fill('wrongpassword123')

    // Submit
    const loginBtn = page.locator('button[type="submit"]').first()
    await loginBtn.click()

    // Should show error message
    await expect(page.locator('.error-message, [role="alert"]').first()).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
