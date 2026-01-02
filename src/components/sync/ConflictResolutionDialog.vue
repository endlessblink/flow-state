<template>
  <div class="conflict-resolution-dialog">
    <!-- Conflict Header -->
    <div class="conflict-header">
      <div class="conflict-icon">
        <svg
          class="w-6 h-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <div class="conflict-title">
        <h3>Sync Conflict Detected</h3>
        <p class="text-sm text-secondary opacity-70">
          {{ conflicts.length }} conflict{{ conflicts.length > 1 ? 's' : '' }} found in "{{ taskTitle }}"
        </p>
      </div>
      <div class="conflict-priority">
        <span :class="priorityClass">{{ conflictPriority }}</span>
      </div>
    </div>

    <!-- Conflict Summary -->
    <div class="conflict-summary">
      <div class="summary-item">
        <span class="label">Auto-resolved:</span>
        <span class="value text-green-600">{{ autoResolvedCount }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Manual review:</span>
        <span class="value text-orange-600">{{ manualResolutionRequired }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Merge complexity:</span>
        <span class="value" :class="complexityClass">{{ mergeComplexity }}</span>
      </div>
    </div>

    <!-- Conflict Fields -->
    <div class="conflict-fields">
      <div
        v-for="conflict in unresolvedConflicts"
        :key="conflict.field"
        class="conflict-field"
      >
        <div class="field-header">
          <h4 class="field-name">
            {{ formatFieldName(conflict.field) }}
          </h4>
          <div class="field-meta">
            <span :class="severityClass(conflict.severity)">{{ conflict.severity }}</span>
            <span v-if="conflict.autoResolvable" class="auto-resolvable">Auto-resolvable</span>
          </div>
        </div>

        <!-- Value Comparison -->
        <div class="value-comparison">
          <!-- Local Value -->
          <div class="value-column local">
            <div class="column-header">
              <div class="device-badge local">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Local (This Device)
              </div>
              <div class="timestamp">
                {{ formatTimestamp(localTask.updatedAt as number) }}
              </div>
            </div>
            <div class="value-display">
              <DiffViewer
                :value="conflict.localValue"
                :compare-value="conflict.remoteValue"
                :field-type="getFieldType(conflict.field)"
                mode="local"
              />
            </div>
            <div class="value-actions">
              <button
                class="action-btn select-local"
                :class="{ active: selectedResolution[conflict.field] === 'local' }"
                @click="selectLocalValue(conflict)"
              >
                Use This Value
              </button>
            </div>
          </div>

          <!-- Remote Value -->
          <div class="value-column remote">
            <div class="column-header">
              <div class="device-badge remote">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Remote (Synced)
              </div>
              <div class="timestamp">
                {{ formatTimestamp(remoteTask.updatedAt as number) }}
              </div>
            </div>
            <div class="value-display">
              <DiffViewer
                :value="conflict.remoteValue"
                :compare-value="conflict.localValue"
                :field-type="getFieldType(conflict.field)"
                mode="remote"
              />
            </div>
            <div class="value-actions">
              <button
                class="action-btn select-remote"
                :class="{ active: selectedResolution[conflict.field] === 'remote' }"
                @click="selectRemoteValue(conflict)"
              >
                Use This Value
              </button>
            </div>
          </div>
        </div>

        <!-- Resolution Options -->
        <div class="resolution-options">
          <!-- Suggested Resolution -->
          <div v-if="conflict.suggestedResolution !== undefined" class="suggested-resolution">
            <div class="suggestion-header">
              <svg
                class="w-4 h-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Suggested Resolution:
            </div>
            <div class="suggestion-value">
              <ValueDisplay
                :value="conflict.suggestedResolution"
                :field-type="getFieldType(conflict.field)"
              />
            </div>
            <button
              class="action-btn accept-suggestion"
              :class="{ active: selectedResolution[conflict.field] === 'suggested' }"
              @click="selectSuggestedValue(conflict)"
            >
              Accept Suggestion
            </button>
          </div>

          <!-- Manual Merge -->
          <div v-if="canMergeValues(conflict)" class="manual-merge">
            <button
              class="action-btn manual-merge-btn"
              @click="enterManualMerge(conflict)"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Merge Manually
            </button>
          </div>

          <!-- Custom Value Input -->
          <div v-if="selectedResolution[conflict.field] === 'custom'" class="custom-input">
            <label class="custom-label">Enter custom value:</label>
            <component
              :is="getInputComponent(conflict.field)"
              v-model="customValues[conflict.field]"
              v-bind="getInputProps(conflict.field)"
              class="custom-field"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Global Actions -->
    <div class="global-actions">
      <div class="bulk-actions">
        <button
          class="bulk-btn local"
          :disabled="!hasUnresolvedConflicts"
          @click="acceptAllLocal"
        >
          Keep All Local Changes
        </button>
        <button
          class="bulk-btn remote"
          :disabled="!hasUnresolvedConflicts"
          @click="acceptAllRemote"
        >
          Accept All Remote Changes
        </button>
        <button
          class="bulk-btn suggested"
          :disabled="!hasSuggestions"
          @click="acceptAllSuggestions"
        >
          Accept All Suggestions
        </button>
      </div>

      <div class="final-actions">
        <button
          class="action-btn cancel"
          @click="cancelResolution"
        >
          Cancel Sync
        </button>
        <button
          class="action-btn apply"
          :disabled="!hasSelectedResolutions"
          @click="applyResolutions"
        >
          Apply Resolutions ({{ selectedCount }})
        </button>
      </div>
    </div>

    <!-- Manual Merge Modal -->
    <ManualMergeModal
      v-if="showManualMerge"
      :conflict="currentMergeConflict"
      @save="saveManualMerge"
      @cancel="cancelManualMerge"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ConflictDiff, TaskConflict } from '@/utils/conflictResolution'
import DiffViewer from './DiffViewer.vue'
import ValueDisplay from './ValueDisplay.vue'
import ManualMergeModal from './ManualMergeModal.vue'

interface Props {
  taskConflict: TaskConflict
  onResolve: (resolutions: Record<string, unknown>) => void
  onCancel: () => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  resolve: [resolutions: Record<string, unknown>]
  cancel: []
}>()

const selectedResolution = ref<Record<string, 'local' | 'remote' | 'suggested' | 'custom'>>({})
const customValues = ref<Record<string, unknown>>({})
const showManualMerge = ref(false)
const currentMergeConflict = ref<ConflictDiff | null>(null)

const conflicts = computed(() => props.taskConflict.conflicts)
const localTask = computed(() => props.taskConflict.localTask)
const remoteTask = computed(() => props.taskConflict.remoteTask)
const taskTitle = computed(() => localTask.value.title || remoteTask.value.title || 'Unknown Task')

const unresolvedConflicts = computed(() =>
  conflicts.value.filter(c => !c.autoResolvable || selectedResolution.value[c.field] !== undefined)
)

const autoResolvedCount = computed(() =>
  conflicts.value.filter(c => c.autoResolvable && selectedResolution.value[c.field] === undefined).length
)

const manualResolutionRequired = computed(() => unresolvedConflicts.value.length)

const conflictPriority = computed(() => props.taskConflict.priority)
const mergeComplexity = computed(() => {
  const highSeverity = conflicts.value.filter(c => c.severity === 'high').length
  const mediumSeverity = conflicts.value.filter(c => c.severity === 'medium').length

  if (highSeverity > 0) return 'complex'
  if (mediumSeverity > 2) return 'moderate'
  return 'simple'
})

const priorityClass = computed(() => {
  switch (conflictPriority.value) {
    case 'high': return 'priority-high'
    case 'medium': return 'priority-medium'
    case 'low': return 'priority-low'
    default: return 'priority-medium'
  }
})

const complexityClass = computed(() => {
  switch (mergeComplexity.value) {
    case 'complex': return 'text-red-600'
    case 'moderate': return 'text-orange-600'
    case 'simple': return 'text-green-600'
    default: return 'text-gray-600'
  }
})

const hasUnresolvedConflicts = computed(() => unresolvedConflicts.value.length > 0)
const hasSuggestions = computed(() => conflicts.value.some(c => c.suggestedResolution !== undefined))
const hasSelectedResolutions = computed(() => Object.keys(selectedResolution.value).length > 0)
const selectedCount = computed(() => Object.keys(selectedResolution.value).length)

// Format field name for display
function formatFieldName(field: string): string {
  return field
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' > ')
}

// Get field type
function getFieldType(field: string): string {
  if (field.includes('title') || field.includes('description')) return 'text'
  if (field.includes('date') || field.includes('time')) return 'datetime'
  if (field.includes('priority') || field.includes('completed')) return 'boolean'
  if (field.includes('tags')) return 'array'
  return 'text'
}

// Get severity class
function severityClass(severity: string): string {
  switch (severity) {
    case 'high': return 'severity-high'
    case 'medium': return 'severity-medium'
    case 'low': return 'severity-low'
    default: return 'severity-medium'
  }
}

// Format timestamp
function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

// Resolution selection
function selectLocalValue(conflict: ConflictDiff): void {
  selectedResolution.value[conflict.field] = 'local'
  delete customValues.value[conflict.field]
}

function selectRemoteValue(conflict: ConflictDiff): void {
  selectedResolution.value[conflict.field] = 'remote'
  delete customValues.value[conflict.field]
}

function selectSuggestedValue(conflict: ConflictDiff): void {
  selectedResolution.value[conflict.field] = 'suggested'
  customValues.value[conflict.field] = conflict.suggestedResolution
}

// Check if values can be merged
function canMergeValues(conflict: ConflictDiff): boolean {
  const localType = typeof conflict.localValue
  const remoteType = typeof conflict.remoteValue

  // Can merge strings, arrays, and objects
  return ['string', 'object'].includes(localType) && localType === remoteType
}

// Enter manual merge mode
function enterManualMerge(conflict: ConflictDiff): void {
  currentMergeConflict.value = conflict
  showManualMerge.value = true
}

// Save manual merge
function saveManualMerge(mergedValue: unknown): void {
  if (currentMergeConflict.value) {
    selectedResolution.value[currentMergeConflict.value.field] = 'custom'
    customValues.value[currentMergeConflict.value.field] = mergedValue
  }
  showManualMerge.value = false
  currentMergeConflict.value = null
}

// Cancel manual merge
function cancelManualMerge(): void {
  showManualMerge.value = false
  currentMergeConflict.value = null
}

// Get input component for custom value
function getInputComponent(field: string): string {
  const fieldType = getFieldType(field)
  switch (fieldType) {
    case 'datetime': return 'input'
    case 'boolean': return 'input'
    case 'array': return 'textarea'
    default: return 'textarea'
  }
}

// Get input props
function getInputProps(field: string): Record<string, unknown> {
  const fieldType = getFieldType(field)
  switch (fieldType) {
    case 'datetime':
      return { type: 'datetime-local' }
    case 'boolean':
      return { type: 'checkbox' }
    default:
      return { rows: 3 }
  }
}

// Bulk actions
function acceptAllLocal(): void {
  unresolvedConflicts.value.forEach(conflict => {
    selectedResolution.value[conflict.field] = 'local'
  })
}

function acceptAllRemote(): void {
  unresolvedConflicts.value.forEach(conflict => {
    selectedResolution.value[conflict.field] = 'remote'
  })
}

function acceptAllSuggestions(): void {
  conflicts.value.forEach(conflict => {
    if (conflict.suggestedResolution !== undefined) {
      selectedResolution.value[conflict.field] = 'suggested'
      customValues.value[conflict.field] = conflict.suggestedResolution
    }
  })
}

// Apply resolutions
function applyResolutions(): void {
  const resolutions: Record<string, unknown> = {}

  Object.entries(selectedResolution.value).forEach(([field, resolution]) => {
    switch (resolution) {
      case 'local':
        resolutions[field] = localTask.value[field] || getNestedValue(localTask.value as Record<string, unknown>, field)
        break
      case 'remote':
        resolutions[field] = remoteTask.value[field] || getNestedValue(remoteTask.value as Record<string, unknown>, field)
        break
      case 'suggested':
      case 'custom':
        resolutions[field] = customValues.value[field]
        break
    }
  })

  emit('resolve', resolutions)
}

// Cancel resolution
function cancelResolution(): void {
  emit('cancel')
}

// Get nested value from object
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: any, key: string) => current?.[key], obj)
}

onMounted(() => {
  // Auto-select suggestions for conflicts that have them
  conflicts.value.forEach(conflict => {
    if (conflict.suggestedResolution !== undefined && conflict.autoResolvable) {
      selectedResolution.value[conflict.field] = 'suggested'
      customValues.value[conflict.field] = conflict.suggestedResolution
    }
  })
})
</script>

<style scoped>
.conflict-resolution-dialog {
  background: rgba(20, 20, 20, 0.36);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-xl);
  max-width: 1000px;
  margin: 0 auto;
  overflow: hidden;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  border-bottom: 1px solid var(--glass-border);
}

.conflict-title h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.conflict-priority span {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.priority-high {
  @apply bg-red-100 text-red-800;
}

.priority-medium {
  @apply bg-orange-100 text-orange-800;
}

.priority-low {
  @apply bg-yellow-100 text-yellow-800;
}

.conflict-summary {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-6);
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--glass-border);
}

.summary-item {
  @apply flex items-center gap-2 text-sm;
}

.summary-item .label {
  color: var(--text-muted);
}

.conflict-fields {
  max-height: 600px;
  overflow-y: auto;
}

.conflict-field {
  border-bottom: 1px solid var(--glass-border);
}

.conflict-field:last-child {
  border-bottom: none;
}

.field-header {
  background: rgba(40, 40, 40, 0.4);
  padding: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.field-meta {
  @apply flex items-center gap-2;
}

.severity-high {
  @apply px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium;
}

.severity-medium {
  @apply px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium;
}

.severity-low {
  @apply px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium;
}

.auto-resolvable {
  @apply px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium;
}

.value-comparison {
  @apply grid grid-cols-2 gap-4 p-4;
}

.value-column {
  background: rgba(30, 30, 30, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--glass-border);
}

.device-badge {
  @apply flex items-center gap-2 text-sm font-medium;
}

.device-badge.local {
  @apply text-blue-600;
}

.device-badge.remote {
  @apply text-purple-600;
}

.timestamp {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.value-display {
  @apply p-4 min-h-24;
}

.value-actions {
  padding: var(--space-3);
  border-top: 1px solid var(--glass-border);
  background: rgba(0, 0, 0, 0.2);
}

.action-btn {
  @apply px-4 py-2 rounded text-sm font-medium transition-colors;
}

.select-local {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.select-local.active {
  @apply bg-blue-700 ring-2 ring-blue-300;
}

.select-remote {
  @apply bg-purple-500 text-white hover:bg-purple-600;
}

.select-remote.active {
  @apply bg-purple-700 ring-2 ring-purple-300;
}

.accept-suggestion {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.accept-suggestion:hover {
  background: rgba(34, 197, 94, 0.2);
}

.accept-suggestion.active {
  background: rgba(34, 197, 94, 0.3);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

.resolution-options {
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.suggested-resolution {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: rgba(59, 130, 246, 0.1);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: #60a5fa;
  flex-shrink: 0;
}

.suggestion-value {
  flex: 1;
  color: var(--text-primary);
  opacity: 0.9;
}

.manual-merge {
  display: flex;
  justify-content: flex-start;
}

.manual-merge-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
}

.manual-merge-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--glass-border-heavy);
}

.manual-merge-btn svg {
  color: var(--text-muted);
}

.custom-input {
  @apply space-y-2;
}

.custom-label {
  @apply block text-sm font-medium text-gray-700;
}

.custom-field {
  @apply w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.global-actions {
  padding: var(--space-6);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bulk-actions {
  @apply flex items-center gap-3;
}

.bulk-btn {
  @apply px-4 py-2 rounded text-sm font-medium border transition-colors;
}

.bulk-btn.local {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.bulk-btn.local:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
}

.bulk-btn.remote {
  background: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.bulk-btn.remote:hover:not(:disabled) {
  background: rgba(168, 85, 247, 0.2);
}

.bulk-btn.suggested {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.bulk-btn.suggested:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
}

.bulk-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.final-actions {
  @apply flex items-center justify-end gap-3;
}

.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

.apply {
  background: var(--brand-primary);
  color: white;
}

.apply:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>