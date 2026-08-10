import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('self-host migration runner', () => {
  it('does not skip the atomic backup schema on an initialized database', () => {
    const source = readFileSync(join(process.cwd(), 'docker/self-host/run-migrations.sh'), 'utf8')

    expect(source).toContain('run_post_init_migrations')
    expect(source).toContain('20260724030000_atomic_backup_restore.sql')
    expect(source).toContain('Applying post-init migrations.')
  })
})
