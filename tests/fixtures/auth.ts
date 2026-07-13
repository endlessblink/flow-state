import { test as base } from '@playwright/test'
import type { AdminUserAttributes, SupabaseClient, User } from '@supabase/supabase-js'

// TASK-1457: Dedicated Playwright test user — isolated from real users
// Created by global-setup.ts via Supabase Admin API
export const TEST_USER = {
  email: 'playwright@test.flowstate',
  password: 'pw-playwright-e2e-2026!',
} as const

export async function ensureAuthUser(
  client: SupabaseClient,
  attributes: AdminUserAttributes & { email: string; password: string },
): Promise<User> {
  const { data, error } = await client.auth.admin.createUser(attributes)
  if (data.user) return data.user

  const isDuplicate = error?.status === 422 && /already|registered|exists/i.test(error.message)
  if (!isDuplicate) throw error ?? new Error('Test user creation returned no user')

  // The local GoTrue build can fail listUsers even on a clean database. The
  // fixture owns these credentials, so signing in is the stable way to resolve
  // the existing disposable identity without querying the admin directory.
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email: attributes.email,
    password: attributes.password,
  })
  if (signInError || !signIn.user) {
    throw signInError ?? new Error('Existing test user sign-in returned no user')
  }
  const user = signIn.user
  const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
  if (signOutError) throw signOutError
  return user
}

// Re-export test and expect — tests import from here for authenticated context
export const test = base
export { expect } from '@playwright/test'
