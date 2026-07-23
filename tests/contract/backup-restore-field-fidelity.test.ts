import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('backup restore field fidelity', () => {
  it('does not use the legacy partial-field safe-create RPC', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/composables/supabase/useTasksDatabase.ts'),
      'utf8'
    )
    const safeCreateBody = source.slice(
      source.indexOf('const safeCreateTask = async'),
      source.indexOf('/**\n     * Manual implementation', source.indexOf('const safeCreateTask = async'))
    )

    expect(safeCreateBody).not.toContain(".rpc('safe_create_task'")
    expect(safeCreateBody).toContain('safeCreateTaskManual(task, userId)')
  })
})
