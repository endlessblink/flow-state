import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260830170000_extend_canonical_task_priority_domain.sql',
)

describe('canonical task priority domain repair', () => {
  it('ships a forward migration for the production task patch RPC', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it.skipIf(!existsSync(migrationPath))('accepts every priority exposed by the Board', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')
    expect(sql).toContain('flowstate_patch_task_v1')
    expect(sql).toContain('flowstate_patch_task_v1_h3_base')
    expect(sql).toContain("''low'', ''medium'', ''high'', ''immediate'', ''relaxed''")
    expect(sql).toContain('unexpected flowstate_patch_task_v1 priority validator')
  })
})
