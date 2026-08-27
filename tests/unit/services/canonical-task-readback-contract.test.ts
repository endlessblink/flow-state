import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('canonical task preview read-back contract', () => {
  it('includes every task field required by the Electron preview validator', () => {
    for (const filename of [
      '20260715030000_canonical_domain_receipts.sql',
      '20260827000000_fix_canonical_task_readback.sql',
    ]) {
      const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations', filename), 'utf8')
      const readBack = migration.slice(
        migration.indexOf('CREATE OR REPLACE FUNCTION public.flowstate_h3_task_read_back'),
        migration.indexOf('CREATE OR REPLACE FUNCTION public.flowstate_h3_task_affected'),
      )

      for (const field of ['description', 'priority', 'progress']) {
        expect(readBack).toContain(`'${field}'`)
      }
    }
  })
})
