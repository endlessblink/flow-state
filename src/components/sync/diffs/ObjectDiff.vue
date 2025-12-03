<template>
  <div class="object-diff">
    <div v-if="hasObjects" class="object-comparison">
      <div class="object-header">
        <div class="object-stats">
          <span class="local-fields">{{ localFieldCount }} fields</span>
          <span class="remote-fields">{{ remoteFieldCount }} fields</span>
          <span class="diff-fields">{{ changedFields.length }} changed</span>
        </div>
      </div>

      <div class="object-fields">
        <div
          v-for="field in fieldDiff"
          :key="field.name"
          :class="getFieldClass(field)"
          class="object-field"
        >
          <div class="field-name">
            <component :is="getFieldIcon(field)" class="field-icon" />
            {{ field.name }}
          </div>

          <div class="field-values">
            <!-- Local Value -->
            <div class="field-value local">
              <div class="value-label">Local:</div>
              <div class="value-content">
                <ValueDisplay
                  :value="field.localValue"
                  field-type="text"
                />
              </div>
            </div>

            <!-- Remote Value -->
            <div class="field-value remote">
              <div class="value-label">Remote:</div>
              <div class="value-content">
                <ValueDisplay
                  :value="field.remoteValue"
                  field-type="text"
                />
              </div>
            </div>
          </div>

          <!-- Field Status -->
          <div class="field-status">
            <span :class="getStatusClass(field.status)">
              {{ field.status }}
            </span>
          </div>
        </div>
      </div>

      <!-- Object Actions -->
      <div class="object-actions">
        <button
          @click="showMergeOptions = !showMergeOptions"
          class="merge-toggle-btn"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Merge Options
        </button>

        <div v-if="showMergeOptions" class="merge-options">
          <button
            @click="mergeStrategy = 'union'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'union' }"
          >
            Union (All Fields)
          </button>
          <button
            @click="mergeStrategy = 'local'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'local' }"
          >
            Local Values
          </button>
          <button
            @click="mergeStrategy = 'remote'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'remote' }"
          >
            Remote Values
          </button>
          <button
            @click="mergeStrategy = 'merge'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'merge' }"
          >
            Smart Merge
          </button>
        </div>
      </div>
    </div>

    <div v-else class="no-objects">
      <div class="empty-message">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <p>No object data to compare</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Minus, Edit2, Check, Circle } from 'lucide-vue-next'
import ValueDisplay from '../ValueDisplay.vue'

interface Props {
  value: any
  compareValue: any
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

const showMergeOptions = ref(false)
const mergeStrategy = ref<'union' | 'local' | 'remote' | 'merge'>('merge')

const localObject = computed(() => {
  return props.value && typeof props.value === 'object' ? props.value : {}
})

const remoteObject = computed(() => {
  return props.compareValue && typeof props.compareValue === 'object' ? props.compareValue : {}
})

const hasObjects = computed(() => {
  return Object.keys(localObject.value).length > 0 || Object.keys(remoteObject.value).length > 0
})

const localFieldCount = computed(() => Object.keys(localObject.value).length)
const remoteFieldCount = computed(() => Object.keys(remoteObject.value).length)

interface FieldDiff {
  name: string
  localValue: any
  remoteValue: any
  status: 'unchanged' | 'added' | 'removed' | 'changed'
  localExists: boolean
  remoteExists: boolean
}

const fieldDiff = computed((): FieldDiff[] => {
  const fields: FieldDiff[] = []
  const allKeys = new Set([
    ...Object.keys(localObject.value),
    ...Object.keys(remoteObject.value)
  ])

  allKeys.forEach(key => {
    const localValue = localObject.value[key]
    const remoteValue = remoteObject.value[key]
    const localExists = key in localObject.value
    const remoteExists = key in remoteObject.value

    let status: FieldDiff['status'] = 'unchanged'

    if (!localExists && remoteExists) {
      status = 'added'
    } else if (localExists && !remoteExists) {
      status = 'removed'
    } else if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      status = 'changed'
    }

    fields.push({
      name: key,
      localValue,
      remoteValue,
      status,
      localExists,
      remoteExists
    })
  })

  return fields.sort((a, b) => a.name.localeCompare(b.name))
})

const changedFields = computed(() =>
  fieldDiff.value.filter(f => f.status !== 'unchanged')
)

function getFieldClass(field: FieldDiff): string {
  const baseClass = 'object-field'
  switch (field.status) {
    case 'added':
      return `${baseClass} field-added`
    case 'removed':
      return `${baseClass} field-removed`
    case 'changed':
      return `${baseClass} field-changed`
    case 'unchanged':
      return `${baseClass} field-unchanged`
    default:
      return baseClass
  }
}

function getFieldIcon(field: FieldDiff) {
  switch (field.status) {
    case 'added':
      return Plus
    case 'removed':
      return Minus
    case 'changed':
      return Edit2
    case 'unchanged':
      return Check
    default:
      return Circle
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'added':
      return 'status-added'
    case 'removed':
      return 'status-removed'
    case 'changed':
      return 'status-changed'
    case 'unchanged':
      return 'status-unchanged'
    default:
      return 'status-unchanged'
  }
}
</script>

<style scoped>
.object-diff {
  @apply p-3;
}

.object-comparison {
  @apply space-y-3;
}

.object-header {
  @apply border-b border-gray-200 pb-2;
}

.object-stats {
  @apply flex items-center gap-4 text-xs text-gray-600;
}

.local-fields {
  @apply text-blue-600;
}

.remote-fields {
  @apply text-purple-600;
}

.diff-fields {
  @apply text-orange-600 font-medium;
}

.object-fields {
  @apply space-y-2;
}

.object-field {
  @apply p-3 rounded-lg border transition-colors;
}

.field-added {
  @apply bg-green-50 border-green-200;
}

.field-removed {
  @apply bg-red-50 border-red-200;
}

.field-changed {
  @apply bg-orange-50 border-orange-200;
}

.field-unchanged {
  @apply bg-gray-50 border-gray-200;
}

.field-name {
  @apply flex items-center gap-2 font-medium text-gray-900 mb-2;
}

.field-icon {
  @apply w-4 h-4;
}

.field-values {
  @apply grid grid-cols-2 gap-3;
}

.field-value {
  @apply space-y-1;
}

.value-label {
  @apply text-xs font-medium text-gray-600;
}

.value-content {
  @apply text-sm;
}

.field-status {
  @apply mt-2;
}

.status-added {
  @apply px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium;
}

.status-removed {
  @apply px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium;
}

.status-changed {
  @apply px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium;
}

.status-unchanged {
  @apply px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium;
}

.object-actions {
  @apply pt-3 border-t border-gray-200;
}

.merge-toggle-btn {
  @apply flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium;
}

.merge-options {
  @apply mt-3 flex flex-wrap gap-2;
}

.merge-strategy-btn {
  @apply px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 transition-colors;
}

.merge-strategy-btn.active {
  @apply bg-blue-500 text-white border-blue-500 hover:bg-blue-600;
}

.no-objects {
  @apply flex items-center justify-center py-8;
}

.empty-message {
  @apply text-center;
}

.empty-message p {
  @apply mt-2 text-gray-500;
}
</style>