import { createClient } from '@supabase/supabase-js'
import { chromium, type FullConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// TASK-1457: Dedicated Playwright test user — completely isolated from real users
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const TEST_USER_EMAIL = 'playwright@test.flowstate'
const TEST_USER_PASSWORD = 'pw-playwright-e2e-2026!'

async function ensureTestUser() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[global-setup] SUPABASE_SERVICE_ROLE_KEY is required to create the test user')
    console.error('[global-setup] Run: export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2)')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if test user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === TEST_USER_EMAIL)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    console.log('[global-setup] Test user exists:', userId)
  } else {
    // Create the test user via Admin API — just like any real sign-up
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Playwright Test User' },
    })

    if (error) {
      console.error('[global-setup] Failed to create test user:', error.message)
      process.exit(1)
    }

    userId = data.user.id
    console.log('[global-setup] Created test user:', userId)
  }

  // Clean slate: delete all existing data for this user (FK-safe order)
  await supabase.from('notifications').delete().eq('user_id', userId)
  await supabase.from('timer_sessions').delete().eq('user_id', userId)
  await supabase.from('pomodoro_history').delete().eq('user_id', userId)
  await supabase.from('quick_sort_sessions').delete().eq('user_id', userId)
  await supabase.from('tasks').delete().eq('user_id', userId)
  await supabase.from('groups').delete().eq('user_id', userId)
  await supabase.from('projects').delete().eq('user_id', userId)
  await supabase.from('user_settings').delete().eq('user_id', userId)

  // Seed projects
  const workProjectId = '11111111-1111-1111-1111-111111111111'
  const personalProjectId = '22222222-2222-2222-2222-222222222222'

  await supabase.from('projects').insert([
    { id: workProjectId, user_id: userId, name: 'Work', color: '#4ECDC4', color_type: 'hex', view_type: 'status' },
    { id: personalProjectId, user_id: userId, name: 'Personal', color: '#FF6B6B', color_type: 'hex', view_type: 'priority' },
  ])

  // Seed tasks
  const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

  await supabase.from('tasks').insert([
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', user_id: userId, project_id: workProjectId, title: 'Design landing page', status: 'planned', priority: 'high', due_date: inDays(3) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', user_id: userId, project_id: workProjectId, title: 'Set up CI/CD pipeline', status: 'in_progress', priority: 'high', due_date: inDays(1) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', user_id: userId, project_id: workProjectId, title: 'Write unit tests', status: 'planned', priority: 'medium', due_date: inDays(7) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', user_id: userId, project_id: workProjectId, title: 'Code review PR #42', status: 'done', priority: 'medium', completed_at: daysAgo(1) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', user_id: userId, project_id: personalProjectId, title: 'Buy groceries', status: 'planned', priority: 'low', due_date: inDays(1) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06', user_id: userId, project_id: personalProjectId, title: 'Morning workout routine', status: 'planned', priority: 'medium' },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa07', user_id: userId, project_id: personalProjectId, title: 'Read chapter 5', status: 'done', priority: 'low', completed_at: daysAgo(2) },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa08', user_id: userId, project_id: personalProjectId, title: 'Plan weekend trip', status: 'planned', priority: 'high', due_date: inDays(5) },
  ])

  // Seed canvas groups
  await supabase.from('groups').insert([
    { id: 'group-todo-test', user_id: userId, name: 'To Do', type: 'custom', color: '#4ECDC4', position_json: { x: 100, y: 100, width: 300, height: 400 }, layout: 'vertical' },
    { id: 'group-done-test', user_id: userId, name: 'Completed', type: 'custom', color: '#2ECC71', position_json: { x: 500, y: 100, width: 300, height: 400 }, layout: 'vertical' },
  ])

  // Seed user settings (prevents first-time setup wizard)
  await supabase.from('user_settings').insert({
    user_id: userId,
    theme: 'dark',
    language: 'en',
    work_duration: 1200,
    short_break_duration: 300,
    long_break_duration: 900,
    auto_start_breaks: true,
    auto_start_pomodoros: true,
  })

  console.log('[global-setup] Test data seeded: 2 projects, 8 tasks, 2 groups, 1 settings')
  return userId
}

async function globalSetup(config: FullConfig) {
  // Step 1: Create test user and seed data
  await ensureTestUser()

  // Step 2: Sign in via Supabase REST API (Node.js side)
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!anonKey) {
    console.error('[global-setup] VITE_SUPABASE_ANON_KEY required for auth')
    process.exit(1)
  }

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
  })

  if (!authResponse.ok) {
    console.error('[global-setup] Auth failed:', await authResponse.text())
    process.exit(1)
  }

  const session = await authResponse.json()
  console.log('[global-setup] Authenticated as', TEST_USER_EMAIL)

  // Step 3: Inject session into browser localStorage and save storageState
  const browser = await chromium.launch()
  const baseURL = config.projects[0].use.baseURL || 'http://127.0.0.1:5547'

  // Build the localStorage value that Supabase client expects
  const storageKey = 'flowstate-supabase-auth'
  const storageValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    token_type: 'bearer',
    user: session.user,
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  // Set localStorage before navigating so the app picks up the session
  // Also set settings/onboarding flags to prevent wizard overlays during tests
  const settingsValue = JSON.stringify({ aiSetupComplete: true })
  await page.addInitScript(({ authKey, authVal, settingsVal }) => {
    localStorage.setItem(authKey, authVal)
    localStorage.setItem('flowstate-settings-v2', settingsVal)
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  }, { authKey: storageKey, authVal: storageValue, settingsVal: settingsValue })

  await page.goto(baseURL)
  await page.waitForLoadState('networkidle')

  // Save authenticated state
  const authDir = 'tests/.auth'
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
  await context.storageState({ path: path.join(authDir, 'user.json') })
  console.log('[global-setup] Auth saved to tests/.auth/user.json')

  await browser.close()
}

export default globalSetup
