import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @vitest-environment node

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260713010000_done_for_now_rpc.sql'),
  'utf8'
)
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260924120000_done_for_now_reset_next_timing.sql'),
  'utf8'
)

function anchor(name: string): string {
  const match = migration.match(new RegExp(`${name} text := \\$block\\$([\\s\\S]*?)\\$block\\$;`))
  expect(match, `${name} must exist`).not.toBeNull()
  return match![1]!.trim()
}

describe('Done for now timing migration', () => {
  it('matches the shipped RPC and removes only the next occurrence timing', () => {
    const oldInstance = anchor('v_old_next_instance')
    const oldDueTimestamp = anchor('v_old_due_timestamp')
    const oldUpdate = anchor('v_old_update')
    const oldReceiptTime = anchor('v_old_receipt_time')

    for (const original of [oldInstance, oldDueTimestamp, oldUpdate, oldReceiptTime]) {
      expect(source.split(original)).toHaveLength(2)
    }

    expect(migration).toContain("v_next_instances := ''[]''::jsonb;")
    expect(migration).toContain("v_next_due_timestamp := (v_next_due::text || 'T00:00:00Z')::timestamptz")
    expect(migration).toContain('due_time = null,')
    expect(migration).toContain('scheduled_date = null,')
    expect(migration).toContain('scheduled_time = null,')
    expect(migration).toContain("'scheduledTime', null")
    expect(migration).toContain("'duration', null")

    // The current timed occurrence is still copied to its completed history record.
    expect(source).toContain('v_completion_instances, null, v_parent_id')
    expect(source).toContain('v_task.due_date, v_task.due_time, v_task.estimated_duration')
    expect(source).toContain('v_task.scheduled_date, v_task.scheduled_time, v_task.is_uncategorized')
    expect(migration).not.toContain('v_completion_instances :=')
  })
})
