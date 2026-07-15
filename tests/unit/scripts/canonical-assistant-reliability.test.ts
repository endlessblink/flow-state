import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const harnessPath = 'scripts/db/test-reliable-assistant-contract.sh'
const concurrencyPath = 'scripts/db/test-canonical-notion-concurrency.sh'
const recurrenceConcurrencyPath = 'scripts/db/test-merge-tasks-recurrence-concurrency.sh'
const h3RollbackPath = 'scripts/db/rollback-canonical-domain-receipts.sql'

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

  it('applies the full canonical migration chain before executable task, Notion, and race proofs', () => {
    const source = readFileSync(harnessPath, 'utf8')

    expect(source).toContain('20260713011000_merge_tasks_rpc.sql')
    expect(source).toContain('20260715010000_merge_tasks_recurrence_resolution.sql')
    expect(source).toContain('20260713012000_canonical_task_contract.sql')
    expect(source).toContain('20260714010000_canonical_notion_activation.sql')
    expect(source).toContain('20260714020000_canonical_uuid_compatibility.sql')
    expect(source).toContain('20260715030000_canonical_domain_receipts.sql')
    expect(source).toContain('test-canonical-task-contract.sql')
    expect(source).toContain('test-merge-tasks-rpc.sql')
    expect(source).toContain('test-merge-tasks-recurrence-concurrency.sh')
    expect(source).toContain('test-canonical-notion-activation.sql')
    expect(source).toContain('test-canonical-notion-concurrency.sh')
    expect(source).toContain('test-canonical-domain-receipts.sql')
    expect(source.indexOf('20260713012000_canonical_task_contract.sql'))
      .toBeLessThan(source.indexOf('20260714010000_canonical_notion_activation.sql'))
    expect(source.indexOf('20260714010000_canonical_notion_activation.sql'))
      .toBeLessThan(source.indexOf('20260714020000_canonical_uuid_compatibility.sql'))
    expect(source.indexOf('20260714020000_canonical_uuid_compatibility.sql'))
      .toBeLessThan(source.indexOf('20260715030000_canonical_domain_receipts.sql'))
    expect(source).toContain('< "$h3_migration" >/dev/null')
  })

  it('proves recurrence preview stability and concurrent receipt replay across sessions', () => {
    expect(existsSync(recurrenceConcurrencyPath)).toBe(true)
    const source = readFileSync(recurrenceConcurrencyPath, 'utf8')

    expect(source).toContain('concurrent-recurrence-request')
    expect(source).toContain('SELECT pg_sleep(1)')
    expect(source).toContain('committed|replayed')
    expect(source).toContain('hash_a="$(jq -r')
    expect(source).toContain('hash_b="$(jq -r')
    expect(source).toContain('"$hash_a" != "$hash_b"')
    expect(source).toContain('Added after approval')
    expect(source).toContain('state_conflict')
    expect(source).toContain('separate-transaction preview, related-state binding, and concurrent recurrence replay')
  })

  it('executes the watchdog authority signature and valid-index probe in the disposable database', () => {
    const source = readFileSync(harnessPath, 'utf8')

    expect(source).toContain('flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)')
    expect(source).toContain('flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamptz,uuid,text)')
    expect(source).toContain('flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)')
    expect(source).toContain('indisvalid AND index.indisready AND index.indisunique')
    expect(source).toContain('TASK-1949 disposable watchdog authority probe passed')
  })

  it('proves H3 can roll back to the exact legacy RPC surface and reapply cleanly', () => {
    const harness = readFileSync(harnessPath, 'utf8')

    expect(existsSync(h3RollbackPath)).toBe(true)
    const rollback = readFileSync(h3RollbackPath, 'utf8')
    expect(rollback).toContain('BEGIN;')
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.flowstate_patch_task_v1(')
    expect(rollback).toContain('RENAME TO flowstate_patch_task_v1')
    expect(rollback).toContain('RENAME TO flowstate_complete_task_v1')
    expect(rollback).toContain('RENAME TO flowstate_done_for_now')
    expect(rollback).toContain('RENAME TO flowstate_merge_tasks')
    expect(rollback).toContain('RENAME TO flowstate_merge_tasks_with_recurrence')
    expect(rollback).toContain('GRANT EXECUTE ON FUNCTION public.flowstate_patch_task_v1(')
    expect(rollback).toContain('FROM PUBLIC, anon;')
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.flowstate_h3_finalize_receipt(')
    expect(rollback).toContain("NOTIFY pgrst, 'reload schema';")
    expect(rollback).toContain('COMMIT;')
    expect(rollback).not.toContain('DROP COLUMN')

    expect(harness).toContain('rollback-canonical-domain-receipts.sql')
    expect(harness).toContain('H3 rollback legacy surface probe passed')
    expect(harness).toContain('H3 rollback failure atomicity probe passed')
    expect(harness).toContain('H3 reapply canonical surface probe passed')
    expect(harness.indexOf('rollback-canonical-domain-receipts.sql'))
      .toBeLessThan(harness.lastIndexOf('< "$h3_migration" >/dev/null'))
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
