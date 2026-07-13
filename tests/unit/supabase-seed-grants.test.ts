import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')

describe('local Supabase API grants', () => {
  it('boots core user-scoped tables without granting protected receipt writes', () => {
    const grant = seed.match(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE([\s\S]*?)TO authenticated, service_role;/,
    )?.[1] ?? ''

    for (const table of ['tasks', 'groups', 'projects', 'user_settings', 'tombstones']) {
      expect(grant).toContain(`public.${table}`)
    }
    expect(grant).not.toContain('flowstate_action_receipts')
    expect(grant).not.toContain('task_audit_log')
    expect(seed).not.toMatch(/TO anon(?:ymous)?[,;]/)
  })
})
