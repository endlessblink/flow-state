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
  const isDuplicate = error?.status === 422 && /already|registered|exists/i.test(error.message)
  if (error && !isDuplicate) throw error
  if (!data.user && !isDuplicate) throw new Error('Test user creation returned no user')

  // Seed through the disposable signed-in user and normal RLS. Clean Supabase
  // stacks do not grant direct table writes to service_role, and tests should
  // exercise the same identity boundary as the UI rather than broaden grants.
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email: attributes.email,
    password: attributes.password,
  })
  if (signInError || !signIn.user) {
    throw signInError ?? new Error('Existing test user sign-in returned no user')
  }
  return signIn.user
}

// Re-export test and expect — tests import from here for authenticated context
export const test = base
export { expect } from '@playwright/test'
