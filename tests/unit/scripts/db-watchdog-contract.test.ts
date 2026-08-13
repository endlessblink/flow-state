import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const watchdog = readFileSync('scripts/vps/flowstate-db-watchdog.sh', 'utf8')
const databaseSmoke = readFileSync('scripts/db/test-task-lifecycle-audit.sql', 'utf8')

describe('production DB lifecycle watchdog contract', () => {
  it('fails visibly when the immutable lifecycle audit surface is missing', () => {
    expect(watchdog).toContain('q_checked()')
    expect(watchdog).toContain('task-audit-query-failed=')
    expect(watchdog).toContain("to_regclass('public.task_audit_log')")
    expect(watchdog).toContain('task-audit-log-missing')
    expect(watchdog).toContain('task-audit-triggers-missing')
    expect(watchdog).toContain("tgenabled<>'D'")
    expect(watchdog).toContain("tgfoid='public.fn_task_audit_log()'::regprocedure")
  })

  it('detects latest delete audit events that disagree with task and tombstone truth', () => {
    expect(watchdog).toContain("event_type IN ('SOFT_DELETED','HARD_DELETED','RESTORED')")
    expect(watchdog).toContain('lifecycle-audit-state-mismatches-24h')
    expect(watchdog).toContain("latest.event_type='SOFT_DELETED'")
    expect(watchdog).toContain("latest.event_type='HARD_DELETED'")
    expect(watchdog).toContain("latest.event_type='RESTORED'")
    expect(watchdog.match(/ORDER BY task_id,event_at DESC,id DESC/g)).toHaveLength(2)
    expect(watchdog).toContain('t.user_id=latest.user_id')
    expect(watchdog).toContain('ts.user_id=latest.user_id')
  })

  it('detects latest status audit events that disagree with the live task status', () => {
    expect(watchdog).toContain("event_type='STATUS_CHANGED'")
    expect(watchdog).toContain('status-audit-state-mismatches-24h')
  })

  it('detects broken recurring-completion and merge receipts without logging private task data', () => {
    expect(watchdog).toContain("operation='done_for_now'")
    expect(watchdog).toContain('done-for-now-broken-receipts=')
    expect(watchdog).toContain("operation='merge_tasks'")
    expect(watchdog).toContain('task-merge-broken-receipts=')
    expect(watchdog).toContain('t.id::text=')
    expect(watchdog).not.toContain('receipt->>\'title\'')
  })

  it('detects stale device versions and unresolved mobile task writes without task content', () => {
    expect(watchdog).toContain("to_regclass('public.device_sync_receipts')")
    expect(watchdog).toContain('device-sync-query-failed=')
    expect(watchdog).toContain('device-runtime-version-drift=')
    expect(watchdog).toContain('device-sync-runtime-missing=')
    expect(watchdog).toContain('count(DISTINCT receipt.runtime)')
    expect(watchdog).toContain('device-task-writes-unresolved=')
    expect(watchdog).toContain("receipt.runtime='pwa'")
    expect(watchdog).toContain("receipt.runtime='electron'")
    expect(watchdog).toContain('CROSS JOIN')
    expect(watchdog).toContain("receipt.last_seen_at > now()-interval '30 minutes'")
    expect(watchdog).toContain("operation->>'entityType'='task'")
    expect(watchdog).toContain("operation->>'status' IN ('pending','syncing','failed','conflict')")
    expect(watchdog).toContain("(now()-interval '24 hours')")
    expect(watchdog).toContain("(now()-interval '15 minutes')")
    expect(watchdog).toContain("(now()-interval '30 minutes')")
    expect(watchdog).not.toContain("(operation->>'createdAt')::timestamptz")
    expect(watchdog).not.toContain("operation->>'title'")
    expect(watchdog).not.toContain('titleSha256')
  })

  it('ships a rollback-only database smoke for the full lifecycle sequence', () => {
    expect(databaseSmoke).toContain("ARRAY['CREATED','STATUS_CHANGED','SOFT_DELETED','RESTORED','HARD_DELETED']")
    expect(databaseSmoke).toContain('gen_random_uuid() AS tid')
    expect(databaseSmoke).not.toContain('DELETE FROM public.task_audit_log')
    expect(databaseSmoke).toContain('hard delete must leave one tombstone')
    expect(databaseSmoke).toContain('ROLLBACK;')
  })

  it('fails visibly when canonical assistant authority is missing or unreadable', () => {
    expect(watchdog).toContain('canonical-schema-query-failed=')
    expect(watchdog).toContain("to_regclass('public.canonical_operations')")
    expect(watchdog).toContain("to_regclass('public.canonical_operation_previews')")
    expect(watchdog).toContain("to_regclass('public.canonical_change_log')")
    expect(watchdog).toContain("to_regprocedure('public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)')")
    expect(watchdog).toContain("to_regprocedure('public.flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)')")
    expect(watchdog).toContain('canonical-authority-missing=')
    expect(watchdog).toContain('canonical-triggers-missing=')
    expect(watchdog).toContain('canonical-notion-index-missing')
    expect(watchdog).toContain('index.indisvalid AND index.indisready AND index.indisunique')
  })

  it('detects stale or structurally incomplete canonical operations without payload content', () => {
    expect(watchdog).toContain('canonical-query-failed=stale-applying')
    expect(watchdog).toContain('canonical-stale-applying=')
    expect(watchdog).toContain("state='applying'")
    expect(watchdog).toContain("updated_at < now()-interval '15 minutes'")
    expect(watchdog).toContain('canonical-query-failed=incomplete-committed')
    expect(watchdog).toContain('canonical-incomplete-committed=')
    expect(watchdog).toContain('canonical_result IS NULL')
    expect(watchdog).toContain('canonical_revision IS NULL')
    expect(watchdog).toContain('change_sequence IS NULL')
  })

  it('detects task/change and Notion provenance integrity drift with count-only alerts', () => {
    expect(watchdog).toContain('canonical-query-failed=task-change-revision')
    expect(watchdog).toContain('canonical-task-change-revision-mismatches=')
    expect(watchdog).toContain('canonical-query-failed=notion-provenance')
    expect(watchdog).toContain('canonical-notion-provenance-malformed=')
    expect(watchdog).toContain('canonical-query-failed=notion-evidence')
    expect(watchdog).toContain('canonical-notion-commit-evidence-missing=')
    expect(watchdog).toContain('latest.entity_id=task.id::text')
    expect(watchdog).toContain('task.id::text=operation.entity_id')
    expect(watchdog).not.toContain('canonical-sequence-gap')
  })
})
