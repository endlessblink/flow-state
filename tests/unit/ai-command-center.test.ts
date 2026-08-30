import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AICommandCenterCard from '@/components/ai/AICommandCenterCard.vue'
import type { AICommandBatch, AICommandAuditEntry } from '@/services/ai/actionCommands'

function buildBatch(): AICommandBatch {
  return {
    id: 'batch-1',
    sourcePrompt: 'Apply today plan',
    sourceRunId: 'run-1',
    sourceMessageId: 'message-1',
    dataUsed: { taskCount: 2, calendarWindow: 'today' },
    createdAt: '2026-08-30T10:00:00.000Z',
    commands: [
      {
        id: 'create-1',
        kind: 'task.create',
        title: 'Draft proposal',
        priority: 'high',
        confidence: 0.82,
        impact: 'low',
      },
      {
        id: 'update-1',
        kind: 'task.update',
        taskId: 'task-1',
        updates: { priority: 'immediate' },
        confidence: 0.91,
        impact: 'low',
      },
    ],
    preview: {
      commands: [
        {
          id: 'create-1',
          kind: 'task.create',
          status: 'will_create',
          identity: {
            kind: 'task.create',
            sourceMessageId: 'message-1',
            targetEntityId: null,
            scope: 'tasks:root',
            fingerprint: 'create-fingerprint',
          },
          diff: {
            entityType: 'task',
            before: null,
            after: { title: 'Draft proposal', priority: 'high' },
          },
          requiresExplicitApproval: false,
        },
        {
          id: 'update-1',
          kind: 'task.update',
          status: 'will_reuse_existing',
          duplicateOf: 'task-1',
          identity: {
            kind: 'task.update',
            sourceMessageId: 'message-1',
            targetEntityId: 'task-1',
            scope: 'task:task-1',
            fingerprint: 'update-fingerprint',
          },
          diff: {
            entityType: 'task',
            before: { id: 'task-1', priority: 'high' },
            after: { id: 'task-1', priority: 'immediate' },
          },
          requiresExplicitApproval: false,
        },
      ],
    },
  }
}

describe('AI command center', () => {
  it('shows grounded diffs and lets the user edit, reject, and apply selected commands', async () => {
    const wrapper = mount(AICommandCenterCard, {
      props: {
        batch: buildBatch(),
        title: 'Today plan proposal',
        why: 'These tasks are due today and fit the available focus window.',
        sources: ['2 active tasks', 'Today calendar window'],
        steps: [
          { id: 'read', label: 'Reading context', status: 'completed' },
          { id: 'approval', label: 'Waiting for approval', status: 'waiting_approval' },
        ],
      },
    })

    expect(wrapper.get('[data-testid="ai-command-center"]').text()).toContain('Today plan proposal')
    expect(wrapper.text()).toContain('These tasks are due today')
    expect(wrapper.text()).toContain('Today calendar window')
    expect(wrapper.text()).toContain('high')
    expect(wrapper.text()).toContain('immediate')
    expect(wrapper.text()).toContain('Already matches an existing item')
    expect(wrapper.get('[data-testid="ai-command-expand-create-1"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="ai-command-edit-create-1"]').attributes('aria-label')).toContain('Draft proposal')

    await wrapper.get('[data-testid="ai-command-edit-create-1"]').trigger('click')
    await wrapper.get('[data-testid="ai-command-title-create-1"]').setValue('Draft launch proposal')
    await wrapper.get('[data-testid="ai-command-reject-update-1"]').trigger('click')
    await wrapper.get('[data-testid="ai-command-apply"]').trigger('click')

    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      selectedCommandIds: ['create-1'],
      explicitApproval: false,
      commands: [
        expect.objectContaining({ id: 'create-1', title: 'Draft launch proposal' }),
        expect.objectContaining({ id: 'update-1' }),
      ],
    })
  })

  it('requires explicit approval for high-impact commands and exposes retry for failed steps', async () => {
    const batch = buildBatch()
    batch.commands[0].impact = 'high'
    batch.preview.commands[0].requiresExplicitApproval = true
    batch.preview.commands[0].status = 'blocked_requires_approval'

    const wrapper = mount(AICommandCenterCard, {
      props: {
        batch,
        title: 'Risky proposal',
        why: 'Requested by the user.',
        steps: [{ id: 'validate', label: 'Validating proposal', status: 'failed', message: 'Connection lost', retryable: true }],
      },
    })

    expect(wrapper.get('[data-testid="ai-command-apply"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ai-command-approval"]').setValue(true)
    expect(wrapper.get('[data-testid="ai-command-apply"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="ai-command-retry-validate"]').trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual(['validate'])
  })

  it('shows the applied audit result and emits the persisted rollback pointer', async () => {
    const auditEntry: AICommandAuditEntry = {
      batchId: 'batch-1',
      sourcePrompt: 'Apply today plan',
      sourceRunId: 'run-1',
      sourceMessageId: 'message-1',
      dataUsed: { taskCount: 2 },
      commandsApplied: [],
      commandsRejected: [],
      timestamp: '2026-08-30T10:01:00.000Z',
      rollbackPointer: 'rollback-1',
      rollbackVersion: 2,
    }
    const wrapper = mount(AICommandCenterCard, {
      props: {
        batch: buildBatch(),
        title: 'Applied proposal',
        why: 'Requested by the user.',
        auditEntry,
        auditTrail: [auditEntry],
      },
    })

    expect(wrapper.text()).toContain('Recent AI actions')
    expect(wrapper.text()).toContain('Apply today plan')
    await wrapper.get('[data-testid="ai-command-undo"]').trigger('click')
    expect(wrapper.emitted('undo')?.[0]).toEqual(['rollback-1'])
  })

  it('does not offer unsafe undo for audit entries created before scoped rollback', () => {
    const legacyEntry: AICommandAuditEntry = {
      batchId: 'legacy-batch',
      sourcePrompt: 'Legacy action',
      sourceRunId: 'legacy-run',
      sourceMessageId: 'legacy-message',
      dataUsed: {},
      commandsApplied: [],
      commandsRejected: [],
      timestamp: '2026-06-01T10:00:00.000Z',
      rollbackPointer: 'legacy-rollback',
    }
    const wrapper = mount(AICommandCenterCard, {
      props: {
        batch: buildBatch(),
        title: 'History',
        why: 'Reviewing prior actions.',
        auditTrail: [legacyEntry],
      },
    })

    expect(wrapper.text()).toContain('Undo unavailable')
    expect(wrapper.find('[data-testid="ai-command-history-undo-legacy-rollback"]').exists()).toBe(false)
  })
})
