import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSource = () => readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260801010000_repair_workspace_write_execute.sql'),
  'utf8',
)

describe('workspace write privilege repair migration', () => {
  it('restores authenticated execution without exposing the authorization function publicly', () => {
    const sql = migrationSource()

    expect(sql).toMatch(/revoke all on function public\.flowstate_can_write_workspace_v1\s*\(uuid\)\s*from\s+public\s*,\s*anon/i)
    expect(sql).toMatch(/grant execute on function public\.flowstate_can_write_workspace_v1\s*\(uuid\)\s+to\s+authenticated/i)
  })
})
