<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bot, CheckCircle2, Loader2, Power, PowerOff, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { getAgentAuditLog } from '@/domain/agent'
import LocalAgentApprovalQueue from '@/components/agent/LocalAgentApprovalQueue.vue'
import { useAgentApprovalQueueStore } from '@/stores/agent/approvalQueue'
import SettingsSection from './SettingsSection.vue'

interface AgentBridgeStatus {
  enabled: boolean
  transport: 'stdio'
  bridgeReady: boolean
  tokenIssued: boolean
  bridgeUrl: string | null
  enabledAt: string | null
}

interface ElectronAgentApi {
  agentGetStatus?: () => Promise<unknown>
  agentEnable?: () => Promise<unknown>
  agentDisable?: () => Promise<unknown>
}

const status = ref<AgentBridgeStatus | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const auditCount = ref(0)
const approvalQueue = useAgentApprovalQueueStore()

const electronAgentApi = computed(() => (window as unknown as { electronAPI?: ElectronAgentApi }).electronAPI)
const isElectronAvailable = computed(() => Boolean(electronAgentApi.value?.agentGetStatus))

const statusLabel = computed(() => {
  if (!isElectronAvailable.value) return 'Desktop app required'
  if (!status.value?.enabled) return 'Disabled'
  if (!status.value.bridgeReady) return 'Starting'
  return 'Connected'
})

const statusTone = computed(() => {
  if (!isElectronAvailable.value || !status.value?.enabled) return 'muted'
  return status.value.bridgeReady ? 'ready' : 'warning'
})

function normalizeStatus(value: unknown): AgentBridgeStatus {
  const candidate = value as Partial<AgentBridgeStatus>
  return {
    enabled: candidate.enabled === true,
    transport: 'stdio',
    bridgeReady: candidate.bridgeReady === true,
    tokenIssued: candidate.tokenIssued === true,
    bridgeUrl: typeof candidate.bridgeUrl === 'string' ? candidate.bridgeUrl : null,
    enabledAt: typeof candidate.enabledAt === 'string' ? candidate.enabledAt : null,
  }
}

function refreshAuditCount() {
  auditCount.value = getAgentAuditLog().length
}

async function refreshStatus() {
  if (!electronAgentApi.value?.agentGetStatus) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    status.value = normalizeStatus(await electronAgentApi.value.agentGetStatus())
    refreshAuditCount()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to read agent bridge status'
  } finally {
    isLoading.value = false
  }
}

async function enableAgentAccess() {
  if (!electronAgentApi.value?.agentEnable) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    status.value = normalizeStatus(await electronAgentApi.value.agentEnable())
    refreshAuditCount()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to enable local agent access'
  } finally {
    isLoading.value = false
  }
}

async function disableAgentAccess() {
  if (!electronAgentApi.value?.agentDisable) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    status.value = normalizeStatus(await electronAgentApi.value.agentDisable())
    refreshAuditCount()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to disable local agent access'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  refreshAuditCount()
  void refreshStatus()
})
</script>

<template>
  <SettingsSection title="Local Agent Access">
    <div class="agent-access-card">
      <div class="agent-access-header">
        <div class="agent-icon" aria-hidden="true">
          <Bot :size="18" />
        </div>
        <div class="agent-copy">
          <div class="agent-title-row">
            <h4>FlowState MCP bridge</h4>
            <span class="status-pill" :class="statusTone">
              <CheckCircle2 v-if="statusTone === 'ready'" :size="13" />
              <span>{{ statusLabel }}</span>
            </span>
          </div>
          <p>
            Allows local AI agents to read FlowState context through the desktop app. Write tools can only submit dry-run previews for one-time approval.
          </p>
        </div>
      </div>

      <div class="agent-mode-grid">
        <div class="mode-tile active">
          <ShieldCheck :size="16" />
          <div>
            <span>Read-only mode</span>
            <small>Workspace-scoped tools only</small>
          </div>
        </div>
        <div class="mode-tile active">
          <Power :size="16" />
          <div>
            <span>Dry-run writes</span>
            <small>{{ approvalQueue.pendingRequests.length }} pending approvals</small>
          </div>
        </div>
      </div>

      <LocalAgentApprovalQueue />

      <dl class="agent-status-grid">
        <div>
          <dt>Transport</dt>
          <dd>{{ status?.transport ?? 'stdio' }}</dd>
        </div>
        <div>
          <dt>Bridge</dt>
          <dd>{{ status?.bridgeReady ? 'Ready' : 'Not ready' }}</dd>
        </div>
        <div>
          <dt>Audit entries</dt>
          <dd>{{ auditCount }}</dd>
        </div>
      </dl>

      <p v-if="!isElectronAvailable" class="agent-warning">
        Local agent access is available only in the Electron desktop app.
      </p>
      <p v-if="errorMessage" class="agent-error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="agent-actions">
        <button
          class="agent-action primary"
          :disabled="!isElectronAvailable || isLoading || status?.enabled === true"
          @click="enableAgentAccess"
        >
          <Loader2 v-if="isLoading && status?.enabled !== true" :size="14" class="spinning" />
          <Power v-else :size="14" />
          Enable local access
        </button>
        <button
          class="agent-action danger"
          :disabled="!isElectronAvailable || isLoading || status?.enabled !== true"
          @click="disableAgentAccess"
        >
          <PowerOff :size="14" />
          Disable
        </button>
        <button
          class="agent-action ghost"
          :disabled="!isElectronAvailable || isLoading"
          aria-label="Refresh local agent status"
          @click="refreshStatus"
        >
          <RefreshCw :size="14" :class="{ spinning: isLoading }" />
          Refresh
        </button>
      </div>
    </div>
  </SettingsSection>
</template>

<style scoped>
.agent-access-card {
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.08), rgba(16, 14, 28, 0.28));
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.agent-access-header {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.agent-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.12);
  border: 1px solid rgba(78, 205, 196, 0.22);
  flex: 0 0 auto;
}

.agent-copy {
  min-width: 0;
  flex: 1;
}

.agent-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.agent-title-row h4 {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.agent-copy p,
.agent-warning,
.agent-error {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-muted);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  border: 1px solid var(--glass-border-light);
  color: var(--text-muted);
  background: var(--glass-bg-light);
  white-space: nowrap;
}

.status-pill.ready {
  color: var(--brand-primary);
  border-color: rgba(78, 205, 196, 0.35);
  background: rgba(78, 205, 196, 0.12);
}

.status-pill.warning {
  color: var(--color-warning);
}

.agent-mode-grid,
.agent-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.mode-tile {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border-light);
  background: rgba(255, 255, 255, 0.03);
}

.mode-tile.active {
  border-color: rgba(78, 205, 196, 0.32);
}

.mode-tile.disabled {
  opacity: 0.58;
}

.mode-tile span,
.agent-status-grid dd {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.mode-tile small,
.agent-status-grid dt {
  display: block;
  margin-top: var(--space-0_5);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.agent-status-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.agent-status-grid > div {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.025);
}

.agent-status-grid dd {
  margin: var(--space-1) 0 0;
}

.agent-warning {
  color: var(--color-warning);
}

.agent-error {
  color: var(--color-danger);
}

.agent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.agent-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 2rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border-light);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--glass-bg-light);
  cursor: pointer;
}

.agent-action.primary {
  color: var(--bg-primary);
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.agent-action.danger:not(:disabled) {
  color: var(--color-danger);
}

.agent-action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .agent-title-row,
  .agent-access-header {
    align-items: flex-start;
  }

  .agent-title-row,
  .agent-mode-grid,
  .agent-status-grid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
