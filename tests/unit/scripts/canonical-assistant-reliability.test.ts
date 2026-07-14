import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const harnessPath = 'scripts/db/test-reliable-assistant-contract.sh'
const concurrencyPath = 'scripts/db/test-canonical-notion-concurrency.sh'

describe('TASK-1949 canonical assistant disposable reliability harness', () => {
  it('creates and always cleans a unique disposable database', () => {
    expect(existsSync(harnessPath)).toBe(true)
    const source = readFileSync(harnessPath, 'utf8')

    expect(source).toContain('set -euo pipefail')
    expect(source).toContain('canonical_assistant_${$}_${RANDOM}')
    expect(source).toContain('trap cleanup EXIT')
    expect(source).toContain('dropdb -U postgres --if-exists --force')
    expect(source).toContain('pg_dump -U postgres --schema-only --no-owner --no-privileges')
    expect(source).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated')
  })

  it('applies both ordered migrations before executable task, Notion, and race proofs', () => {
    const source = readFileSync(harnessPath, 'utf8')

    expect(source).toContain('20260713012000_canonical_task_contract.sql')
    expect(source).toContain('20260714010000_canonical_notion_activation.sql')
    expect(source).toContain('20260714020000_canonical_uuid_compatibility.sql')
    expect(source).toContain('test-canonical-task-contract.sql')
    expect(source).toContain('test-canonical-notion-activation.sql')
    expect(source).toContain('test-canonical-notion-concurrency.sh')
    expect(source.indexOf('20260713012000_canonical_task_contract.sql'))
      .toBeLessThan(source.indexOf('20260714010000_canonical_notion_activation.sql'))
    expect(source.indexOf('20260714010000_canonical_notion_activation.sql'))
      .toBeLessThan(source.indexOf('20260714020000_canonical_uuid_compatibility.sql'))
  })

  it('executes the watchdog authority signature and valid-index probe in the disposable database', () => {
    const source = readFileSync(harnessPath, 'utf8')

    expect(source).toContain('flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)')
    expect(source).toContain('flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)')
    expect(source).toContain('indisvalid AND index.indisready AND index.indisunique')
    expect(source).toContain('TASK-1949 disposable watchdog authority probe passed')
  })

  it('probes Notion replay, conflicts, exact-block deduplication, and injected rollback', () => {
    expect(existsSync(concurrencyPath)).toBe(true)
    const source = readFileSync(concurrencyPath, 'utf8')

    expect(source).toContain('same-operation')
    expect(source).toContain('idempotency_conflict')
    expect(source).toContain('different-operation')
    expect(source).toContain('injected notion activation failure')
    expect(source).toContain('failed apply left partial notion activation state')
    expect(source).toContain('canonical_change_log')
    expect(source).toContain('canonical_operation_previews')
  })

  it('exposes one package command for the complete disposable proof', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

    expect(packageJson.scripts['test:reliable-assistant-contract'])
      .toBe('bash scripts/db/test-reliable-assistant-contract.sh')
  })
})
