import { describe, expect, it } from 'vitest'
import {
  AGENT_COMMAND_POLICIES,
  FORBIDDEN_AGENT_CAPABILITIES,
  READ_ONLY_AGENT_COMMANDS,
  WRITE_AGENT_COMMANDS,
} from '@/domain/agent'

describe('agent command contracts', () => {
  it('defines the expected read-only command surface', () => {
    expect(READ_ONLY_AGENT_COMMANDS).toEqual([
      'flowstate_get_context',
      'flowstate_list_workspaces',
      'flowstate_get_active_workspace',
      'flowstate_search_tasks',
      'flowstate_get_task',
      'flowstate_list_projects',
      'flowstate_get_today',
      'flowstate_get_sync_status',
    ])
  })

  it('keeps permanent delete out of the write command surface', () => {
    expect(WRITE_AGENT_COMMANDS).toEqual([
      'flowstate_create_task',
      'flowstate_update_task',
      'flowstate_complete_task',
      'flowstate_move_task_to_project',
      'flowstate_add_task_comment',
      'flowstate_soft_delete_task',
    ])

    expect(WRITE_AGENT_COMMANDS.join('\n')).not.toContain('permanent')
    expect(WRITE_AGENT_COMMANDS.join('\n')).not.toContain('hard_delete')
  })

  it('requires dry-run, idempotency, and approval for every write command', () => {
    for (const command of WRITE_AGENT_COMMANDS) {
      const policy = AGENT_COMMAND_POLICIES[command]

      expect(policy.operation, `${command} must begin as dry_run`).toBe('dry_run')
      expect(policy.supportsDryRun, `${command} must support dry-run diffs`).toBe(true)
      expect(policy.requiresIdempotencyKey, `${command} must require idempotency`).toBe(true)
      expect(policy.requiresApproval, `${command} must require approval initially`).toBe(true)
    }
  })

  it('keeps read-only commands non-destructive and approval-free', () => {
    for (const command of READ_ONLY_AGENT_COMMANDS) {
      const policy = AGENT_COMMAND_POLICIES[command]

      expect(policy.operation, `${command} must stay read-only`).toBe('read')
      expect(policy.destructive, `${command} cannot be destructive`).toBe(false)
      expect(policy.supportsDryRun, `${command} should not pretend to dry-run`).toBe(false)
      expect(policy.requiresIdempotencyKey, `${command} should not require idempotency`).toBe(false)
    }
  })

  it('documents forbidden capabilities as runtime constants for adapters to enforce', () => {
    expect(FORBIDDEN_AGENT_CAPABILITIES).toEqual([
      'supabase_service_role_key',
      'raw_sql',
      'direct_supabase_write',
      'direct_indexeddb_write',
      'direct_localstorage_write',
      'direct_raw_pinia_mutation',
      'permanent_delete',
      'unscoped_workspace_access',
    ])
  })
})
