<template>
  <div
    class="sync-indicator"
    :class="[statusClass, { 'has-badge': showBadge }]"
    :title="tooltipText"
    @click="handleClick"
  >
    <!-- Status Icon -->
    <component
      :is="iconComponent"
      :size="18"
      :class="{ spinning: isSyncing }"
    />

    <!-- Badge for pending/error count -->
    <span v-if="showBadge" class="sync-badge">
      {{ badgeCount }}
    </span>

    <!-- Popover for errors -->
    <SyncErrorPopover
      v-if="showPopover"
      :errors="failedOperations"
      :last-error="lastError"
      @retry="handleRetry"
      @clear="handleClear"
      @close="showPopover = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStatusStore } from '@/stores/syncStatus'
import {
  CloudCheck,
  CloudUpload,
  CloudCog,
  CloudOff,
  WifiOff,
  Cloud
} from 'lucide-vue-next'
import SyncErrorPopover from './SyncErrorPopover.vue'

const syncStore = useSyncStatusStore()
const {
  status,
  pendingCount,
  failedCount,
  lastError,
  failedOperations,
  statusText,
  lastSyncText
} = storeToRefs(syncStore)

const showPopover = ref(false)

// Map status to icon component
const iconComponent = computed(() => {
  switch (status.value) {
    case 'synced':
      return CloudCheck
    case 'syncing':
      return CloudUpload
    case 'pending':
      return CloudCog
    case 'error':
      return CloudOff
    case 'offline':
      return WifiOff
    default:
      return Cloud
  }
})

// Status-based CSS class
const statusClass = computed(() => {
  switch (status.value) {
    case 'synced':
      return 'status-synced'
    case 'syncing':
      return 'status-syncing'
    case 'pending':
      return 'status-pending'
    case 'error':
      return 'status-error'
    case 'offline':
      return 'status-offline'
    default:
      return ''
  }
})

// Is currently syncing (for animation)
const isSyncing = computed(() => status.value === 'syncing')

// Show badge for pending or error count
const showBadge = computed(() => {
  return (status.value === 'pending' && pendingCount.value > 0) ||
         (status.value === 'error' && failedCount.value > 0)
})

const badgeCount = computed(() => {
  if (status.value === 'error') {
    return failedCount.value > 9 ? '9+' : failedCount.value
  }
  return pendingCount.value > 9 ? '9+' : pendingCount.value
})

// Tooltip text
const tooltipText = computed(() => {
  let text = statusText.value
  if (lastSyncText.value !== 'Never synced') {
    text += ` • Last synced: ${lastSyncText.value}`
  }
  if (status.value === 'error' && lastError.value) {
    text += ` • Error: ${lastError.value}`
  }
  return text
})

// Handle click - show popover for errors, force sync otherwise
const handleClick = async () => {
  if (status.value === 'error') {
    showPopover.value = !showPopover.value
  } else if (status.value === 'pending') {
    await syncStore.forceSync()
  }
}

// Handle retry from popover
const handleRetry = async () => {
  showPopover.value = false
  await syncStore.retryFailed()
}

// Handle clear from popover
const handleClear = async () => {
  showPopover.value = false
  await syncStore.clearFailed()
}
</script>

<style scoped>
.sync-indicator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.sync-indicator:hover {
  background: var(--state-hover-bg);
}

/* Status Colors */
.status-synced {
  color: var(--color-success);
}

.status-syncing {
  color: var(--color-info);
}

.status-pending {
  color: var(--color-warning);
}

.status-error {
  color: var(--color-danger);
}

.status-offline {
  color: var(--text-muted);
}

/* Spinning animation for syncing */
.spinning {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Badge */
.sync-badge {
  position: absolute;
  top: var(--space-0_5);
  right: var(--space-0_5);
  min-width: var(--space-4);
  height: var(--space-4);
  padding: 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.status-pending .sync-badge {
  background: var(--color-warning);
  animation: pulse-amber 2s ease-in-out infinite;
}

.status-error .sync-badge {
  background: var(--color-danger);
  animation: pulse-red 1.5s ease-in-out infinite;
}

@keyframes pulse-amber {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--color-warning-rgb), 0.4);
  }
  50% {
    box-shadow: 0 0 0 var(--space-1) rgba(var(--color-warning-rgb), 0);
  }
}

@keyframes pulse-red {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--color-danger-rgb), 0.4);
  }
  50% {
    box-shadow: 0 0 0 var(--space-1) rgba(var(--color-danger-rgb), 0);
  }
}

/* Hover effects */
.sync-indicator:hover.status-synced {
  color: var(--color-success-hover);
}

.sync-indicator:hover.status-syncing {
  color: var(--color-info-hover);
}

.sync-indicator:hover.status-pending {
  color: var(--color-warning-hover);
}

.sync-indicator:hover.status-error {
  color: var(--color-danger-hover);
}
</style>
