<template>
  <div class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Manual Merge: {{ formatFieldName(conflict?.field || '') }}</h3>
        <button
          class="close-btn"
          @click="$emit('cancel')"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Merge Preview -->
        <div class="merge-preview">
          <div class="preview-header">
            <h4>Merge Preview</h4>
            <div class="merge-actions">
              <button
                class="merge-btn combine"
                :disabled="!canCombineValues"
                @click="mergeAll"
              >
                Combine All
              </button>
              <button
                class="merge-btn local"
                @click="useLocalOnly"
              >
                Use Local Only
              </button>
              <button
                class="merge-btn remote"
                @click="useRemoteOnly"
              >
                Use Remote Only
              </button>
            </div>
          </div>

          <div class="merge-editor">
            <component
              :is="getEditorComponent()"
              v-model="mergedValue"
              v-bind="getEditorProps()"
              class="merge-input"
            />
          </div>
        </div>

        <!-- Source Values -->
        <div class="source-values">
          <div class="source-column local">
            <h5>Local Value</h5>
            <div class="source-display">
              <ValueDisplay
                :value="conflict?.localValue"
                :field-type="getFieldType()"
              />
            </div>
          </div>

          <div class="source-column remote">
            <h5>Remote Value</h5>
            <div class="source-display">
              <ValueDisplay
                :value="conflict?.remoteValue"
                :field-type="getFieldType()"
              />
            </div>
          </div>
        </div>

        <!-- Merge History -->
        <div v-if="mergeHistory.length > 0" class="merge-history">
          <h5>Recent Changes</h5>
          <div class="history-list">
            <div
              v-for="(entry, index) in mergeHistory"
              :key="index"
              class="history-entry"
            >
              <span class="history-action">{{ entry.action }}</span>
              <span class="history-value">{{ entry.value }}</span>
              <span class="history-time">{{ formatTime(entry.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="action-btn cancel"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="action-btn save"
          :disabled="!isValidMergeValue"
          @click="saveMerge"
        >
          Save Merge
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ConflictDiff } from '@/utils/conflictResolution'
import ValueDisplay from './ValueDisplay.vue'

interface Props {
  conflict: ConflictDiff | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  save: [value: unknown]
  cancel: []
}>()

const mergedValue = ref<unknown>(null)
const mergeHistory = ref<Array<{
  action: string
  value: string
  timestamp: number
}>>([])

// Initialize merged value
watch(() => props.conflict, (newConflict) => {
  if (newConflict) {
    // Start with local value as default
    mergedValue.value = newConflict.localValue
    mergeHistory.value = [{
      action: 'Started with local',
      value: formatValueForHistory(newConflict.localValue),
      timestamp: Date.now()
    }]
  }
}, { immediate: true })

// Get field type
function getFieldType(): string {
  if (!props.conflict) return 'text'

  const field = props.conflict.field
  if (field.includes('title') || field.includes('description')) return 'text'
  if (field.includes('date') || field.includes('time')) return 'datetime'
  if (field.includes('priority') || field.includes('completed')) return 'boolean'
  if (field.includes('tags')) return 'array'
  return 'text'
}

// Get editor component
function getEditorComponent(): string {
  const fieldType = getFieldType()
  switch (fieldType) {
    case 'datetime': return 'input'
    case 'boolean': return 'input'
    case 'array': return 'textarea'
    default: return 'textarea'
  }
}

// Get editor props
function getEditorProps(): Record<string, unknown> {
  const fieldType = getFieldType()
  switch (fieldType) {
    case 'datetime':
      return { type: 'datetime-local' }
    case 'boolean':
      return { type: 'checkbox' }
    default:
      return { rows: 6 }
  }
}

// Check if values can be combined
const canCombineValues = computed(() => {
  if (!props.conflict) return false

  const localType = typeof props.conflict.localValue
  const remoteType = typeof props.conflict.remoteValue

  // Can combine strings, arrays, and objects
  return ['string', 'object'].includes(localType) && localType === remoteType
})

// Check if merge value is valid
const isValidMergeValue = computed(() => {
  const value = mergedValue.value

  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
})

// Merge actions
function mergeAll(): void {
  if (!props.conflict) return

  const { localValue, remoteValue } = props.conflict
  const localType = typeof localValue

  let result: unknown

  if (localType === 'string') {
    // Combine strings
    const localStr = (localValue || '').toString().trim()
    const remoteStr = (remoteValue || '').toString().trim()

    if (localStr && remoteStr && localStr !== remoteStr) {
      result = localStr + ' ' + remoteStr
    } else {
      result = localStr || remoteStr
    }
  } else if (Array.isArray(localValue)) {
    // Combine arrays
    const localArr = (localValue || []) as unknown[]
    const remoteArr = (remoteValue || []) as unknown[]
    result = [...new Set([...localArr, ...remoteArr])]
  } else if (localType === 'object' && localValue !== null) {
    // Combine objects (shallow merge)
    const localObj = (localValue || {}) as Record<string, unknown>
    const remoteObj = (remoteValue || {}) as Record<string, unknown>
    result = { ...localObj, ...remoteObj }
  } else {
    result = localValue || remoteValue
  }

  mergedValue.value = result
  addToHistory('Combined values', result)
}

function useLocalOnly(): void {
  if (!props.conflict) return
  mergedValue.value = props.conflict.localValue
  addToHistory('Used local only', props.conflict.localValue)
}

function useRemoteOnly(): void {
  if (!props.conflict) return
  mergedValue.value = props.conflict.remoteValue
  addToHistory('Used remote only', props.conflict.remoteValue)
}

function addToHistory(action: string, value: unknown): void {
  mergeHistory.value.unshift({
    action,
    value: formatValueForHistory(value),
    timestamp: Date.now()
  })

  // Keep only last 10 entries
  if (mergeHistory.value.length > 10) {
    mergeHistory.value = mergeHistory.value.slice(0, 10)
  }
}

// Format field name
function formatFieldName(field: string): string {
  return field
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' > ')
}

// Format value for history display
function formatValueForHistory(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value.length > 50 ? value.substring(0, 50) + '...' : value
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...'
  return String(value)
}

// Format time
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

// Save merge
function saveMerge(): void {
  if (isValidMergeValue.value) {
    emit('save', mergedValue.value)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-container {
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-2xl);
  max-width: 1000px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--glass-border);
}

.modal-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  padding: var(--space-1);
  color: var(--text-muted);
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.merge-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-header h4 {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.merge-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.merge-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  transition: all 0.2s;
}

.merge-btn.combine {
  background: var(--brand-primary);
  color: white;
}

.merge-btn.local {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.merge-btn.remote {
  background: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.2);
}

.merge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.merge-editor {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
}

.merge-input {
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  color: var(--text-primary);
  border: none;
  font-family: inherit;
  font-size: var(--font-size-sm);
}

.merge-input:focus {
  outline: none;
}

.source-values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.source-column h5 {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.source-display {
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.merge-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.merge-history h5 {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.history-entry {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  padding: var(--space-2);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
}

.history-action {
  font-weight: var(--font-medium);
  color: var(--text-muted);
  min-width: 120px;
}

.history-value {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6);
  border-top: 1px solid var(--glass-border);
}

.action-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  transition: all 0.2s;
}

.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.save {
  background: var(--brand-primary);
  color: white;
}

.save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>