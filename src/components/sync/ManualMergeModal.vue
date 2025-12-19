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
  save: [value: any]
  cancel: []
}>()

const mergedValue = ref<any>(null)
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
function getEditorProps(): Record<string, any> {
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

  let result: any

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

function addToHistory(action: string, value: any): void {
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
function formatValueForHistory(value: any): string {
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
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.modal-container {
  @apply bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200;
}

.modal-header h3 {
  @apply text-lg font-semibold text-gray-900;
}

.close-btn {
  @apply p-1 text-gray-400 hover:text-gray-600 transition-colors;
}

.modal-body {
  @apply flex-1 overflow-y-auto p-6 space-y-6;
}

.merge-preview {
  @apply space-y-4;
}

.preview-header {
  @apply flex items-center justify-between;
}

.preview-header h4 {
  @apply font-medium text-gray-900;
}

.merge-actions {
  @apply flex items-center gap-2;
}

.merge-btn {
  @apply px-3 py-1 rounded text-sm font-medium transition-colors;
}

.merge-btn.combine {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.merge-btn.local {
  @apply bg-blue-50 text-blue-700 hover:bg-blue-100;
}

.merge-btn.remote {
  @apply bg-purple-50 text-purple-700 hover:bg-purple-100;
}

.merge-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.merge-editor {
  @apply border border-gray-300 rounded-lg overflow-hidden;
}

.merge-input {
  @apply w-full px-3 py-2 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.source-values {
  @apply grid grid-cols-2 gap-4;
}

.source-column h5 {
  @apply font-medium text-gray-900 mb-2;
}

.source-display {
  @apply p-3 bg-gray-50 rounded border border-gray-200;
}

.merge-history {
  @apply space-y-2;
}

.merge-history h5 {
  @apply font-medium text-gray-900;
}

.history-list {
  @apply space-y-1;
}

.history-entry {
  @apply flex items-center gap-3 text-sm p-2 bg-gray-50 rounded;
}

.history-action {
  @apply font-medium text-gray-600 min-w-32;
}

.history-value {
  @apply flex-1 text-gray-800 truncate;
}

.history-time {
  @apply text-gray-500 text-xs;
}

.modal-footer {
  @apply flex items-center justify-end gap-3 p-6 border-t border-gray-200;
}

.action-btn {
  @apply px-4 py-2 rounded text-sm font-medium transition-colors;
}

.cancel {
  @apply bg-gray-200 text-gray-700 hover:bg-gray-300;
}

.save {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.save:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>