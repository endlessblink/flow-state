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
  color: var(--color-success, #22c55e);
}

.status-syncing {
  color: var(--color-info, #3b82f6);
}

.status-pending {
  color: var(--color-warning, #f59e0b);
}

.status-error {
  color: var(--color-danger, #ef4444);
}

.status-offline {
  color: var(--text-muted, #6b7280);
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
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.status-pending .sync-badge {
  background: var(--color-warning, #f59e0b);
  animation: pulse-amber 2s ease-in-out infinite;
}

.status-error .sync-badge {
  background: var(--color-danger, #ef4444);
  animation: pulse-red 1.5s ease-in-out infinite;
}

@keyframes pulse-amber {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}

@keyframes pulse-red {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

/* Hover effects */
.sync-indicator:hover.status-synced {
  color: var(--color-success-hover, #16a34a);
}

.sync-indicator:hover.status-syncing {
  color: var(--color-info-hover, #2563eb);
}

.sync-indicator:hover.status-pending {
  color: var(--color-warning-hover, #d97706);
}

.sync-indicator:hover.status-error {
  color: var(--color-danger-hover, #dc2626);
}
</style>
