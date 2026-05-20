import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import LocalAgentSettingsSection from '@/components/settings/LocalAgentSettingsSection.vue'
import { AGENT_AUDIT_LOG_STORAGE_KEY } from '@/domain/agent'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'

async function flush() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('LocalAgentSettingsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem(AGENT_AUDIT_LOG_STORAGE_KEY)
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
  })

  it('shows desktop-only guidance when Electron APIs are unavailable', async () => {
    const wrapper = mount(LocalAgentSettingsSection)
    await flush()

    expect(wrapper.text()).toContain('Desktop app required')
    expect(wrapper.text()).toContain('Local agent access is available only in the Electron desktop app.')
    expect(wrapper.find('button.agent-action.primary').attributes('disabled')).toBeDefined()
  })

  it('renders connected read-only status from the Electron bridge', async () => {
    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      agentGetStatus: vi.fn().mockResolvedValue({
        enabled: true,
        transport: 'stdio',
        bridgeReady: true,
        tokenIssued: true,
        bridgeUrl: 'http://127.0.0.1:4567',
        enabledAt: '2026-05-19T00:00:00.000Z',
      }),
      agentEnable: vi.fn(),
      agentDisable: vi.fn(),
    }

    const wrapper = mount(LocalAgentSettingsSection)
    await flush()

    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.text()).toContain('Read-only mode')
    expect(wrapper.text()).toContain('Dry-run writes')
    expect(wrapper.text()).toContain('No pending agent write requests.')
  })

  it('enables and disables local agent access through preload methods', async () => {
    const api = {
      agentGetStatus: vi.fn().mockResolvedValue({ enabled: false, transport: 'stdio', bridgeReady: false, tokenIssued: false, bridgeUrl: null, enabledAt: null }),
      agentEnable: vi.fn().mockResolvedValue({ enabled: true, transport: 'stdio', bridgeReady: true, tokenIssued: true, bridgeUrl: 'http://127.0.0.1:4567', enabledAt: '2026-05-19T00:00:00.000Z' }),
      agentDisable: vi.fn().mockResolvedValue({ enabled: false, transport: 'stdio', bridgeReady: false, tokenIssued: false, bridgeUrl: null, enabledAt: null }),
    }
    ;(window as unknown as { electronAPI: unknown }).electronAPI = api

    const wrapper = mount(LocalAgentSettingsSection)
    await flush()

    await wrapper.find('button.agent-action.primary').trigger('click')
    await flush()
    expect(api.agentEnable).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Connected')

    await wrapper.find('button.agent-action.danger').trigger('click')
    await flush()
    expect(api.agentDisable).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Disabled')
  })

  it('shows pending dry-run approvals and records one-time decisions', async () => {
    const approvalQueue = useAgentApprovalQueueStore()
    approvalQueue.enqueueDryRun({
      requestId: 'request-1',
      actor: { id: 'agent', name: 'Agent', transport: 'stdio' },
      workspace: { type: 'personal' },
      dryRun: true,
      idempotencyKey: 'idem-1',
    }, 'flowstate_create_task', {
      status: 'success',
      command: 'flowstate_create_task',
      operation: 'dry_run',
      workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
      data: { task: { id: 'agent-preview-idem-1', title: 'Agent task' } },
      diff: [{ path: '/tasks/-', before: null, after: { title: 'Agent task' } }],
      audit: {
        operation: 'dry_run',
        command: 'flowstate_create_task',
        workspace: { type: 'personal', workspaceId: null, label: 'Personal' },
        affectedEntityType: 'task',
        affectedEntityIds: ['agent-preview-idem-1'],
      },
    })

    const wrapper = mount(LocalAgentSettingsSection)
    await flush()

    expect(wrapper.text()).toContain('1 pending')
    expect(wrapper.text()).toContain('create task')
    expect(wrapper.text()).toContain('Approve once')

    await wrapper.find('button.approval-button.approve').trigger('click')
    await flush()

    expect(wrapper.text()).toContain('0 pending')
    expect(wrapper.text()).toContain('Recent decisions')
    expect(wrapper.text()).toContain('approved')
  })
})
