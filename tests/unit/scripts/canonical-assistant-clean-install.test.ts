import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cleanInstallPath = 'scripts/db/test-clean-application-migrations.sh'

describe('TASK-1965 clean application migration gate', () => {
  it('builds a disposable database from platform schemas without copying public state', () => {
    expect(existsSync(cleanInstallPath)).toBe(true)
    const source = readFileSync(cleanInstallPath, 'utf8')

    expect(source).toContain('set -euo pipefail')
    expect(source).toContain('clean_migrations_${$}_${RANDOM}')
    expect(source).toContain('trap cleanup EXIT')
    expect(source).toContain('--schema=auth')
    expect(source).toContain('CREATE SCHEMA storage')
    expect(source).not.toContain('--schema=storage')
    expect(source).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions')
    expect(source).toContain('ALTER DATABASE')
    expect(source).toContain('public, extensions')
    expect(source).toContain('CREATE PUBLICATION supabase_realtime')
    expect(source).not.toContain('--schema=public')
    expect(source).not.toContain('--data-only')
  })

  it('applies every application migration once in filename order and fails fast', () => {
    const source = readFileSync(cleanInstallPath, 'utf8')

    expect(source).toContain('find "$root_dir/supabase/migrations"')
    expect(source).toContain("-name '*.sql'")
    expect(source).toContain('sort')
    expect(source).toContain('psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1')
    expect(source).toContain('applied_count')
    expect(source).toContain('migration_count')
    expect(source).toContain('PASS: clean ordered application migration install')
  })

  it('is part of the package and daily canonical assistant gate', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    const daily = readFileSync('scripts/daily-regression-hunt.cjs', 'utf8')

    expect(packageJson.scripts['test:clean-application-migrations'])
      .toBe('bash scripts/db/test-clean-application-migrations.sh')
    expect(daily).toContain('npm run test:clean-application-migrations')
  })
})
