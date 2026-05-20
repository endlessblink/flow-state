import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  AGENT_COMMAND_POLICIES,
  type AgentApprovalRequest,
  type AgentAppContextSnapshot,
  type AgentCommandResult,
  type AgentWriteContext,
  type WriteAgentCommandName,
} from '@/domain/agent/types'

function getApprovalId(command: WriteAgentCommandName, idempotencyKey: string) {
  return `${command}:${idempotencyKey}`
}

function getDryRunFingerprint(result: AgentCommandResult) {
  return JSON.stringify({
    workspace: result.workspace,
    affectedEntityType: result.audit.affectedEntityType,
    affectedEntityIds: result.audit.affectedEntityIds,
    diff: result.diff ?? [],
    data: result.data ?? null,
  })
}

export const useAgentApprovalQueueStore = defineStore('agentApprovalQueue', () => {
  const requests = ref<AgentApprovalRequest[]>([])

  const pendingRequests = computed(() => requests.value.filter(request => request.status === 'pending'))
  const resolvedRequests = computed(() => requests.value.filter(request => request.status !== 'pending'))

  function getIdempotencyConflict(context: AgentWriteContext, command: WriteAgentCommandName, result: AgentCommandResult) {
    const existing = requests.value.find(item => item.id === getApprovalId(command, context.idempotencyKey))
    if (!existing) return null
    const fingerprint = getDryRunFingerprint(result)
    return existing.resultFingerprint === fingerprint ? null : existing
  }

  function enqueueDryRun(
    context: AgentWriteContext,
    command: WriteAgentCommandName,
    result: AgentCommandResult,
    sync?: Pick<AgentAppContextSnapshot, 'syncStatus' | 'pendingSyncCount'>
  ) {
    const policy = AGENT_COMMAND_POLICIES[command]
    if (!policy.requiresApproval || result.status !== 'success' || result.operation !== 'dry_run') return null

    const id = getApprovalId(command, context.idempotencyKey)
    const resultFingerprint = getDryRunFingerprint(result)
    const existing = requests.value.find(item => item.id === id)
    if (existing?.resultFingerprint === resultFingerprint) return existing

    const request: AgentApprovalRequest = {
      id,
      requestId: context.requestId,
      command,
      risk: policy.risk,
      workspace: result.workspace,
      affectedEntityType: result.audit.affectedEntityType,
      affectedEntityIds: result.audit.affectedEntityIds,
      diff: result.diff ?? [],
      data: result.data,
      idempotencyKey: context.idempotencyKey,
      resultFingerprint,
      syncStatus: sync?.syncStatus ?? 'synced',
      pendingSyncCount: sync?.pendingSyncCount,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    }

    const existingIndex = requests.value.findIndex(item => item.id === id)
    if (existingIndex >= 0) {
      requests.value.splice(existingIndex, 1, request)
    } else {
      requests.value.unshift(request)
    }
    return request
  }

  function approveOnce(id: string) {
    const request = requests.value.find(item => item.id === id && item.status === 'pending')
    if (!request) return false
    request.status = 'approved'
    request.resolvedAt = new Date().toISOString()
    return true
  }

  function deny(id: string) {
    const request = requests.value.find(item => item.id === id && item.status === 'pending')
    if (!request) return false
    request.status = 'denied'
    request.resolvedAt = new Date().toISOString()
    return true
  }

  function clearResolved() {
    requests.value = requests.value.filter(request => request.status === 'pending')
  }

  return { requests, pendingRequests, resolvedRequests, getIdempotencyConflict, enqueueDryRun, approveOnce, deny, clearResolved }
})
