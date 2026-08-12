import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.FLOWSTATE_LIVE_BASE_URL || 'https://in-theflow.com'
const EMAIL = process.env.FLOWSTATE_LIVE_EMAIL || ''
const PASSWORD = process.env.FLOWSTATE_LIVE_PASSWORD || ''
const ANON_KEY = process.env.FLOWSTATE_LIVE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const SUPABASE_URL = process.env.FLOWSTATE_LIVE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://api.in-theflow.com'
const HAS_LIVE_AUTH = Boolean(EMAIL && PASSWORD && ANON_KEY)

test('authenticated PWA task projection matches canonical readback without mutation', async ({ page }) => {
  test.skip(!HAS_LIVE_AUTH, 'authorized live credentials are required for authenticated readback')

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  expect(authError, 'live fixture authentication failed').toBeNull()
  const session = authData.session
  const userId = session?.user?.id
  expect(userId, 'live fixture did not return a user').toBeTruthy()

  const { data: canonicalTasks, error: readError } = await client
    .from('tasks')
    .select('id')
    .eq('user_id', userId!)
  expect(readError, 'canonical task read failed').toBeNull()

  await page.addInitScript(({ authValue }) => {
    localStorage.setItem('flowstate-supabase-auth', authValue)
    localStorage.setItem('flowstate-onboarding-v2', 'true')
    localStorage.setItem('flowstate-welcome-seen', 'true')
  }, {
    authValue: JSON.stringify({
      access_token: session!.access_token,
      refresh_token: session!.refresh_token,
      expires_in: session!.expires_in,
      expires_at: session!.expires_at,
      token_type: session!.token_type,
      user: session!.user,
    }),
  })

  try {
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText('FlowState', { timeout: 30_000 })

    const projection = await expect.poll(async () => page.evaluate(() => {
      const root = document.querySelector('#app') as any
      const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
      const auth = pinia?._s.get('auth')
      const tasks = pinia?._s.get('tasks')
      const rawTasks = Array.isArray(tasks?.rawTasks) ? tasks.rawTasks : []
      return {
        authenticated: Boolean(auth?.isAuthenticated),
        taskIds: rawTasks.map((task: { id?: string }) => task.id).filter(Boolean),
      }
    }), { timeout: 30_000 }).toMatchObject({ authenticated: true })

    const canonicalIds = new Set((canonicalTasks ?? []).map(task => task.id))
    const projectedIds = new Set(projection.taskIds)
    expect(projectedIds, 'authenticated renderer task IDs diverged from canonical readback').toEqual(canonicalIds)
  } finally {
    await client.auth.signOut()
  }
})
