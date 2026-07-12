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

  it('ships a rollback-only database smoke for the full lifecycle sequence', () => {
    expect(databaseSmoke).toContain("ARRAY['CREATED','STATUS_CHANGED','SOFT_DELETED','RESTORED','HARD_DELETED']")
    expect(databaseSmoke).toContain('gen_random_uuid() AS tid')
    expect(databaseSmoke).not.toContain('DELETE FROM public.task_audit_log')
    expect(databaseSmoke).toContain('hard delete must leave one tombstone')
    expect(databaseSmoke).toContain('ROLLBACK;')
  })
})
