import { test as base } from '@playwright/test'

// TASK-1457: Dedicated Playwright test user — isolated from real users
// Created by global-setup.ts via Supabase Admin API
export const TEST_USER = {
  email: 'playwright@test.flowstate',
  password: 'pw-playwright-e2e-2026!',
} as const

// Re-export test and expect — tests import from here for authenticated context
export const test = base
export { expect } from '@playwright/test'
