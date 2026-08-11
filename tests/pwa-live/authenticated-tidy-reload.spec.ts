import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const BASE_URL = process.env.FLOWSTATE_LIVE_BASE_URL || 'https://in-theflow.com'
const EMAIL = process.env.FLOWSTATE_LIVE_EMAIL || ''
const PASSWORD = process.env.FLOWSTATE_LIVE_PASSWORD || ''
const ANON_KEY = process.env.FLOWSTATE_LIVE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const SUPABASE_URL = process.env.FLOWSTATE_LIVE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://api.in-theflow.com'
const MUTATION_CONFIRMATION = 'I_UNDERSTAND_DISPOSABLE_FIXTURE'
const MUTATION_ENABLED = process.env.FLOWSTATE_LIVE_ALLOW_MUTATION === MUTATION_CONFIRMATION

test.describe.serial('authenticated production Tidy persistence', () => {
  test.skip(!MUTATION_ENABLED, `set FLOWSTATE_LIVE_ALLOW_MUTATION=${MUTATION_CONFIRMATION} to enable disposable production mutations`)

  test('visible Tidy layout survives an authenticated renderer reload', async ({ page }) => {
    expect(EMAIL, 'FLOWSTATE_LIVE_EMAIL is required').not.toBe('')
    expect(PASSWORD, 'FLOWSTATE_LIVE_PASSWORD is required').not.toBe('')
    expect(ANON_KEY, 'FLOWSTATE_LIVE_ANON_KEY or VITE_SUPABASE_ANON_KEY is required').not.toBe('')

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

    const alphaId = randomUUID()
    const betaId = randomUUID()
    const taskAId = randomUUID()
    const taskBId = randomUUID()
    const groupIds = [alphaId, betaId]
    const taskIds = [taskAId, taskBId]

    await page.addInitScript(({ authKey, authValue }) => {
      localStorage.setItem(authKey, authValue)
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    }, {
      authKey: 'flowstate-supabase-auth',
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
      const { error: groupError } = await client.from('groups').insert([
        {
          id: alphaId,
          user_id: userId,
          name: `Live Tidy Alpha ${alphaId.slice(0, 8)}`,
          type: 'custom',
          color: '#4ECDC4',
          layout: 'freeform',
          position_json: { x: 1200, y: 240, width: 420, height: 900 },
          position_version: 1,
        },
        {
          id: betaId,
          user_id: userId,
          name: `Live Tidy Beta ${betaId.slice(0, 8)}`,
          type: 'custom',
          color: '#FF6B6B',
          layout: 'freeform',
          position_json: { x: 200, y: 240, width: 420, height: 900 },
          position_version: 1,
        },
      ])
      expect(groupError).toBeNull()

      const { error: taskError } = await client.from('tasks').insert([
        {
          id: taskAId,
          user_id: userId,
          title: `Live Tidy Task A ${taskAId.slice(0, 8)}`,
          status: 'planned',
          priority: 'medium',
          is_in_inbox: false,
          position: { x: 1220, y: 820, format: 'absolute', parentId: alphaId },
          position_version: 1,
        },
        {
          id: taskBId,
          user_id: userId,
          title: `Live Tidy Task B ${taskBId.slice(0, 8)}`,
          status: 'planned',
          priority: 'medium',
          is_in_inbox: false,
          position: { x: 1220, y: 520, format: 'absolute', parentId: alphaId },
          position_version: 1,
        },
      ])
      expect(taskError).toBeNull()

      await page.goto(`${BASE_URL}/#/canvas`, { waitUntil: 'networkidle' })
      await expect(page.locator('.canvas-toolbar-edge')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator(`[data-id="section-${alphaId}"]`)).toBeVisible({ timeout: 30_000 })
      await expect(page.locator(`[data-id="${taskAId}"]`)).toBeVisible({ timeout: 30_000 })

      const tidyButton = page.locator('button[title*="Tidy"], button[aria-label*="Tidy"]').first()
      await expect(tidyButton).toBeVisible({ timeout: 10_000 })
      await tidyButton.click()

      const readFixtureGeometry = async () => page.evaluate(({ groupIds: ids, taskIds: tids }) => {
        const root = document.querySelector('#app') as any
        const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
        const canvas = pinia?._s.get('canvas')
        const tasks = pinia?._s.get('tasks')
        return {
          groups: ids.map((id: string) => {
            const group = canvas?.groups?.find((candidate: any) => candidate.id === id)
            return group ? { id, position: group.position, parentGroupId: group.parentGroupId ?? null } : null
          }),
          tasks: tids.map((id: string) => {
            const task = tasks?.rawTasks?.find((candidate: any) => candidate.id === id)
            return task ? { id, position: task.canvasPosition, parentId: task.parentId ?? null } : null
          }),
        }
      }, { groupIds, taskIds })

      await expect.poll(readFixtureGeometry, { timeout: 20_000 }).toMatchObject({
        groups: [expect.objectContaining({ id: alphaId }), expect.objectContaining({ id: betaId })],
        tasks: [expect.objectContaining({ id: taskAId }), expect.objectContaining({ id: taskBId })],
      })
      const afterTidy = await readFixtureGeometry()

      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator(`[data-id="section-${alphaId}"]`)).toBeVisible({ timeout: 30_000 })
      await expect.poll(readFixtureGeometry, { timeout: 20_000 }).toEqual(afterTidy)
    } finally {
      await client.from('tasks').delete().in('id', taskIds)
      await client.from('groups').delete().in('id', groupIds)
      await client.auth.signOut()
    }
  })
})
