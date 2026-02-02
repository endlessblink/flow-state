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
            <h3 class="header-title">Sync Errors</h3>
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
            <div class="error-message">{{ lastError }}</div>
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
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 60px 20px 20px;
}

.sync-error-popover {
  width: 360px;
  max-height: calc(100vh - 100px);
  background: var(--glass-bg-medium, rgba(30, 30, 32, 0.95));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(var(--blur-lg, 24px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.popover-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--danger-bg-subtle, rgba(239, 68, 68, 0.15));
  border-radius: var(--radius-md, 8px);
  color: var(--color-danger, #ef4444);
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: var(--text-base, 16px);
  font-weight: var(--font-semibold, 600);
  color: var(--text-primary, #fff);
  margin: 0;
}

.header-subtitle {
  font-size: var(--text-sm, 14px);
  color: var(--text-muted, #9ca3af);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 6px);
  color: var(--text-muted, #9ca3af);
  cursor: pointer;
  transition: all var(--duration-fast, 100ms);
}

.close-btn:hover {
  background: var(--state-hover-bg, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, #fff);
}

/* Body */
.popover-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4, 16px);
}

.error-summary {
  padding: var(--space-3, 12px);
  background: var(--danger-bg-subtle, rgba(239, 68, 68, 0.1));
  border-radius: var(--radius-md, 8px);
  margin-bottom: var(--space-4, 16px);
}

.error-message {
  font-size: var(--text-sm, 14px);
  color: var(--color-danger, #ef4444);
  line-height: 1.5;
}

/* Error List */
.error-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.error-item {
  padding: var(--space-3, 12px);
  background: var(--surface-subtle, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-md, 8px);
}

.error-entity {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  margin-bottom: var(--space-1, 4px);
  color: var(--text-secondary, #d1d5db);
}

.entity-type {
  font-weight: var(--font-medium, 500);
}

.entity-id {
  font-family: monospace;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #9ca3af);
}

/* TASK-1183: Permanent/corrupted error styling */
.permanent-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: var(--danger-bg-subtle, rgba(239, 68, 68, 0.15));
  color: var(--color-danger, #ef4444);
  font-size: var(--text-xs, 12px);
  font-weight: var(--font-medium, 500);
  border-radius: var(--radius-sm, 4px);
  margin-left: auto;
}

.permanent-error {
  border-color: var(--color-danger, #ef4444);
  border-style: dashed;
}

.no-retry-hint {
  color: var(--color-danger, #ef4444);
  font-style: italic;
}

.error-operation {
  font-size: var(--text-sm, 14px);
  color: var(--text-muted, #9ca3af);
  margin-bottom: var(--space-1, 4px);
}

.error-detail {
  font-size: var(--text-xs, 12px);
  color: var(--color-danger, #ef4444);
  background: var(--danger-bg-subtle, rgba(239, 68, 68, 0.1));
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-sm, 6px);
  margin-bottom: var(--space-2, 8px);
}

.error-meta {
  display: flex;
  gap: var(--space-3, 12px);
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #9ca3af);
}

/* Show More */
.show-more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-3, 12px);
}

.show-more button {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  background: transparent;
  border: none;
  color: var(--color-info, #3b82f6);
  font-size: var(--text-sm, 14px);
  cursor: pointer;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-sm, 6px);
}

.show-more button:hover {
  background: var(--state-hover-bg, rgba(255, 255, 255, 0.06));
}

.show-more .rotated {
  transform: rotate(180deg);
}

/* Footer */
.popover-footer {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.retry-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2_5, 10px) var(--space-4, 16px);
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: var(--radius-md, 8px);
  color: white;
  font-weight: var(--font-medium, 500);
  cursor: pointer;
  transition: all var(--duration-fast, 100ms);
}

.retry-btn:hover {
  background: var(--color-primary-hover, #2563eb);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2_5, 10px) var(--space-4, 16px);
  background: var(--color-danger, #ef4444);
  border: none;
  border-radius: var(--radius-md, 8px);
  color: white;
  font-weight: var(--font-medium, 500);
  cursor: pointer;
  transition: all var(--duration-fast, 100ms);
}

.clear-btn:hover {
  background: var(--color-danger-hover, #dc2626);
}

.dismiss-btn {
  padding: var(--space-2_5, 10px) var(--space-4, 16px);
  background: transparent;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-md, 8px);
  color: var(--text-secondary, #d1d5db);
  font-weight: var(--font-medium, 500);
  cursor: pointer;
  transition: all var(--duration-fast, 100ms);
}

.dismiss-btn:hover {
  background: var(--state-hover-bg, rgba(255, 255, 255, 0.06));
  border-color: var(--border-hover, rgba(255, 255, 255, 0.15));
}
</style>
