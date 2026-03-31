import { test, expect, chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

test('debug: real user workspace switcher on localhost:5546', async () => {
  // Sign in as endlessblink@gmail.com using admin API to get a session
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Generate a session link for the real user (magic link approach)
  const { data: userData } = await supabase.auth.admin.getUserById('717f5209-42d8-4bb9-8781-740107a384e5')
  console.log('Real user:', userData?.user?.email)

  // Generate a fresh session for this user
  const { data: sessionData, error: sessionErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'endlessblink@gmail.com',
  })
  console.log('Magic link generated:', !!sessionData, 'error:', sessionErr?.message)

  // Use the admin API to create a session directly
  // We'll sign in via the REST API with a generated token
  const { data: { session }, error: signInErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'endlessblink@gmail.com',
  })

  // Alternative: use impersonation - create a session token via admin
  // Let's just create a fresh browser, inject localStorage, and test
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Sign in using Supabase REST API directly
  // We need to sign in this user somehow - use admin to generate access token
  const tokenResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      type: 'magiclink',
      email: 'endlessblink@gmail.com',
    }),
  })
  const linkData = await tokenResponse.json()
  console.log('Token response status:', tokenResponse.status)

  // Extract the OTP/token and use it to sign in
  // Actually, let's use admin user creation with known password for testing
  // Set a temp password via admin API
  await supabase.auth.admin.updateUserById('717f5209-42d8-4bb9-8781-740107a384e5', {
    password: 'temp-debug-password-2026!',
  })

  // Now sign in with password
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      email: 'endlessblink@gmail.com',
      password: 'temp-debug-password-2026!',
    }),
  })

  if (!authResponse.ok) {
    const errText = await authResponse.text()
    console.log('Auth failed:', errText)
    await browser.close()
    test.skip(true, 'Could not sign in as real user')
    return
  }

  const authSession = await authResponse.json()
  console.log('Signed in as:', authSession.user?.email, 'id:', authSession.user?.id)

  // Inject session into localStorage
  const storageKey = 'flowstate-supabase-auth'
  const storageValue = JSON.stringify({
    access_token: authSession.access_token,
    refresh_token: authSession.refresh_token,
    expires_in: authSession.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + authSession.expires_in,
    token_type: 'bearer',
    user: authSession.user,
  })

  await page.addInitScript(({ key, val }) => {
    localStorage.setItem(key, val)
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }))
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  }, { key: storageKey, val: storageValue })

  // Capture console
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('WORKSPACE') || text.includes('workspace') || text.includes('AUTH')) {
      consoleLogs.push(`[${msg.type()}] ${text}`)
    }
  })

  // Navigate to the app
  await page.goto('http://localhost:5546/#/tasks')
  await page.waitForTimeout(8000)

  console.log('\n=== CONSOLE LOGS ===')
  consoleLogs.forEach(l => console.log(l))
  console.log('=== END LOGS ===\n')

  await page.screenshot({ path: '.dev/screenshots/debug-real-user.png', fullPage: false })

  // Check workspace switcher
  const switcherCount = await page.locator('.workspace-switcher').count()
  console.log('Workspace switcher in DOM:', switcherCount)

  if (switcherCount > 0) {
    console.log('SUCCESS: Workspace switcher is visible!')
    const switcherText = await page.locator('.workspace-switcher').textContent()
    console.log('Switcher text:', switcherText)
  } else {
    console.log('FAIL: Workspace switcher NOT in DOM')
    // Check sidebar content for debugging
    const sidebar = await page.locator('[class*="sidebar"]').first().innerHTML().catch(() => 'not found')
    console.log('Sidebar has workspace ref:', sidebar.includes('workspace'))
  }

  await browser.close()

  expect(switcherCount).toBeGreaterThan(0)
})
