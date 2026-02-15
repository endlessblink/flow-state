<template>
  <Teleport to="body">
    <div class="sync-popover-overlay" @click="$emit('close')">
      <div
        class="sync-error-popover"
        @click.stop
      >
        <!-- Header -->
        <div class="popover-header">
          <div class="header-icon">
            <AlertTriangle :size="20" />
          </div>
          <div class="header-content">
            <h3 class="header-title">
              Sync Errors
            </h3>
            <p class="header-subtitle">
              {{ errors.length }} error{{ errors.length !== 1 ? 's' : '' }}
              <template v-if="permanentCount > 0">
                ({{ permanentCount }} corrupted - click Clear All)
              </template>
            </p>
          </div>
          <button class="close-btn" @click="$emit('close')">
            <X :size="16" />
          </button>
        </div>

        <!-- Error Details -->
        <div class="popover-body">
          <!-- Last Error Summary -->
          <div v-if="lastError" class="error-summary">
            <div class="error-message">
              {{ lastError }}
            </div>
          </div>

          <!-- Error List -->
          <div v-if="errors.length > 0" class="error-list">
            <div
              v-for="error in displayedErrors"
              :key="error.id"
              class="error-item"
              :class="{ 'permanent-error': isPermanentError(error) }"
            >
              <div class="error-entity">
                <component :is="getEntityIcon(error.entityType)" :size="14" />
                <span class="entity-type">{{ formatEntityType(error.entityType) }}</span>
                <span class="entity-id">{{ error.entityId.slice(0, 8) }}...</span>
                <span v-if="isPermanentError(error)" class="permanent-badge">
                  <Ban :size="10" /> Corrupted
                </span>
              </div>
              <div class="error-operation">
                {{ formatOperation(error.operation) }}
              </div>
              <div v-if="error.lastError" class="error-detail">
                {{ formatErrorMessage(error.lastError) }}
              </div>
              <div class="error-meta">
                <span class="retry-count">Attempt {{ error.retryCount + 1 }}</span>
                <span v-if="error.lastAttemptAt" class="last-attempt">
                  {{ formatTime(error.lastAttemptAt) }}
                </span>
                <span v-if="isPermanentError(error)" class="no-retry-hint">Cannot retry</span>
              </div>
            </div>
          </div>

          <!-- Show more link -->
          <div v-if="errors.length > 3" class="show-more">
            <button @click="showAll = !showAll">
              {{ showAll ? 'Show less' : `Show ${errors.length - 3} more` }}
              <ChevronDown :size="14" :class="{ rotated: showAll }" />
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="popover-footer">
          <button v-if="showRetryButton" class="retry-btn" @click="$emit('retry')">
            <RefreshCw :size="16" />
            Retry {{ retryableCount === errors.length ? 'All' : retryableCount }}
          </button>
          <button class="clear-btn" @click="$emit('clear')">
            <Trash2 :size="16" />
            Clear All
          </button>
          <button class="dismiss-btn" @click="$emit('close')">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WriteOperation, SyncEntityType, SyncOperationType } from '@/types/sync'
import { classifyError } from '@/services/offline/retryStrategy'
import {
  AlertTriangle,
  X,
  RefreshCw,
  ChevronDown,
  CheckSquare,
  FolderKanban,
  Folder,
  Timer,
  Trash2,
  Ban
} from 'lucide-vue-next'

const props = defineProps<{
  errors: WriteOperation[]
  lastError?: string
}>()

defineEmits<{
  retry: []
  clear: []
  close: []
}>()

const showAll = ref(false)

// TASK-1183: Check if an error is permanent (cannot be retried)
const isPermanentError = (error: WriteOperation): boolean => {
  if (!error.lastError) return false
  return classifyError(error.lastError) === 'permanent'
}

// Count retryable vs permanent errors
const retryableCount = computed(() => {
  return props.errors.filter(e => !isPermanentError(e)).length
})

const permanentCount = computed(() => {
  return props.errors.filter(e => isPermanentError(e)).length
})

// Hide retry button if ALL errors are permanent
const showRetryButton = computed(() => retryableCount.value > 0)

// Only show first 3 errors unless expanded
const displayedErrors = computed(() => {
  if (showAll.value) {
    return props.errors
  }
  return props.errors.slice(0, 3)
})

// Get icon for entity type
const getEntityIcon = (entityType: SyncEntityType) => {
  switch (entityType) {
    case 'task':
      return CheckSquare
    case 'group':
      return FolderKanban
    case 'project':
      return Folder
    case 'timer_session':
      return Timer
    default:
      return CheckSquare
  }
}

// Format entity type for display
const formatEntityType = (entityType: SyncEntityType): string => {
  switch (entityType) {
    case 'task':
      return 'Task'
    case 'group':
      return 'Group'
    case 'project':
      return 'Project'
    case 'timer_session':
      return 'Timer'
    default:
      return entityType
  }
}

// Format operation type for display
const formatOperation = (operation: SyncOperationType): string => {
  switch (operation) {
    case 'create':
      return 'Create'
    case 'update':
      return 'Update'
    case 'delete':
      return 'Delete'
    default:
      return operation
  }
}

// Format error message (handles legacy [object Object] from before fix)
const formatErrorMessage = (error: string): string => {
  if (!error) return 'Unknown error'
  // Handle legacy corrupted entries stored before error handling fix
  if (error === '[object Object]') {
    return 'Error details unavailable (legacy entry - consider clearing)'
  }
  // Truncate very long error messages
  if (error.length > 150) {
    return error.slice(0, 147) + '...'
  }
  return error
}

// Format timestamp
const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) {
    return 'Just now'
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.sync-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-slate-900), 0.3);
  backdrop-filter: blur(var(--blur-xs));
  z-index: var(--z-tooltip);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--space-15) var(--space-5) var(--space-5);
}

.sync-error-popover {
  width: 360px;
  max-height: calc(100vh - var(--space-25));
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(var(--blur-lg));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.popover-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-9);
  height: var(--space-9);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-md);
  color: var(--color-danger);
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.header-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-7);
  height: var(--space-7);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

/* Body */
.popover-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.error-summary {
  padding: var(--space-3);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.error-message {
  font-size: var(--text-sm);
  color: var(--color-danger);
  line-height: 1.5;
}

/* Error List */
.error-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.error-item {
  padding: var(--space-3);
  background: var(--surface-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.error-entity {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
  color: var(--text-secondary);
}

.entity-type {
  font-weight: var(--font-medium);
}

.entity-id {
  font-family: monospace;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* TASK-1183: Permanent/corrupted error styling */
.permanent-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
  margin-left: auto;
}

.permanent-error {
  border-color: var(--color-danger);
  border-style: dashed;
}

.no-retry-hint {
  color: var(--color-danger);
  font-style: italic;
}

.error-operation {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

.error-detail {
  font-size: var(--text-xs);
  color: var(--color-danger);
  background: var(--danger-bg-subtle);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}

.error-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Show More */
.show-more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-3);
}

.show-more button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: transparent;
  border: none;
  color: var(--color-info);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.show-more button:hover {
  background: var(--state-hover-bg);
}

.show-more .rotated {
  transform: rotate(180deg);
}

/* Footer */
.popover-footer {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.retry-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.retry-btn:hover {
  background: var(--color-primary-hover);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--color-danger);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.clear-btn:hover {
  background: var(--color-danger-hover);
}

.dismiss-btn {
  padding: var(--space-2_5) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dismiss-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--border-hover);
}
</style>
