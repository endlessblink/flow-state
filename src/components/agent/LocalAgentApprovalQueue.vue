<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Check, GitCompareArrows, X } from 'lucide-vue-next'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'
import type { AgentApprovalRequest } from '@/domain/agent'

const approvalQueue = useAgentApprovalQueueStore()

const pendingRequests = computed(() => approvalQueue.pendingRequests)
const resolvedRequests = computed(() => approvalQueue.resolvedRequests.slice(0, 3))

function formatCommand(command: string) {
  return command.replace(/^flowstate_/, '').replaceAll('_', ' ')
}

function formatWorkspace(request: AgentApprovalRequest) {
  return request.workspace.label
}

function formatDiffValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'empty'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
</script>

<template>
  <section class="approval-queue" aria-label="Local agent write approvals">
    <div class="approval-header">
      <div>
        <h5>Write approvals</h5>
        <p>Dry-run previews wait here. Approval is one-time and does not grant permanent write access.</p>
      </div>
      <span class="approval-count">{{ pendingRequests.length }} pending</span>
    </div>

    <div v-if="pendingRequests.length === 0" class="approval-empty">
      No pending agent write requests.
    </div>

    <article
      v-for="request in pendingRequests"
      :key="request.id"
      class="approval-card"
      :class="request.risk"
    >
      <div class="approval-card-header">
        <div>
          <strong>{{ formatCommand(request.command) }}</strong>
          <span>{{ formatWorkspace(request) }} · {{ request.risk }} risk</span>
        </div>
        <AlertTriangle v-if="request.risk === 'high'" :size="16" aria-label="High risk" />
      </div>

      <div class="approval-meta">
        <span>{{ request.affectedEntityType ?? 'task' }}</span>
        <span>{{ request.affectedEntityIds.length }} affected</span>
        <span>{{ request.syncStatus }}{{ request.pendingSyncCount ? ` (${request.pendingSyncCount} pending)` : '' }}</span>
        <span>ID {{ request.idempotencyKey }}</span>
      </div>

      <div class="approval-diff">
        <div v-for="entry in request.diff.slice(0, 4)" :key="entry.path" class="diff-row">
          <GitCompareArrows :size="13" />
          <span class="diff-path">{{ entry.path }}</span>
          <span class="diff-value">{{ formatDiffValue(entry.before) }} -> {{ formatDiffValue(entry.after) }}</span>
        </div>
      </div>

      <div class="approval-actions">
        <button class="approval-button approve" type="button" @click="approvalQueue.approveOnce(request.id)">
          <Check :size="14" />
          Approve once
        </button>
        <button class="approval-button deny" type="button" @click="approvalQueue.deny(request.id)">
          <X :size="14" />
          Deny
        </button>
      </div>
    </article>

    <div v-if="resolvedRequests.length > 0" class="approval-resolved">
      <div class="resolved-header">
        <span>Recent decisions</span>
        <button type="button" @click="approvalQueue.clearResolved">
          Clear
        </button>
      </div>
      <div v-for="request in resolvedRequests" :key="request.id" class="resolved-row">
        <span>{{ formatCommand(request.command) }}</span>
        <strong>{{ request.status }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.approval-queue {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-top: 1px solid var(--glass-border-light);
  padding-top: var(--space-4);
}

.approval-header,
.approval-card-header,
.approval-actions,
.resolved-header,
.resolved-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.approval-header h5 {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.approval-header p,
.approval-empty,
.approval-card-header span,
.approval-meta,
.diff-row,
.resolved-row {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.approval-count {
  flex: 0 0 auto;
  border: 1px solid rgba(78, 205, 196, 0.28);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.1);
}

.approval-card {
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.03);
}

.approval-card.high {
  border-color: rgba(255, 107, 107, 0.35);
}

.approval-card-header strong {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.approval-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.approval-diff {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.diff-row {
  display: grid;
  grid-template-columns: auto minmax(6rem, 0.6fr) minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
}

.diff-path,
.diff-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-actions {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

.approval-button,
.resolved-header button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--glass-bg-light);
  cursor: pointer;
}

.approval-button.approve {
  color: var(--bg-primary);
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.approval-button.deny {
  color: var(--color-danger);
}

.approval-resolved {
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.025);
  padding: var(--space-3);
}

.resolved-header {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.resolved-header button {
  padding: var(--space-1) var(--space-2);
}

.resolved-row strong {
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .approval-header,
  .approval-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .diff-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .diff-value {
    grid-column: 2;
  }
}
</style>
