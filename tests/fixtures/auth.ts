import { test as base } from '@playwright/test'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// TASK-1457: Dedicated Playwright test user — isolated from real users
// Created by global-setup.ts via Supabase Admin API
export const TEST_USER = {
  email: 'playwright@test.flowstate',
  password: 'pw-playwright-e2e-2026!',
} as const

export async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  const perPage = 1000
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const user = data.users.find(candidate => candidate.email === email)
    if (user) return user
    if (data.users.length < perPage) return null
  }
  throw new Error('Auth user lookup exceeded the bounded page limit')
}

// Re-export test and expect — tests import from here for authenticated context
export const test = base
export { expect } from '@playwright/test'
