<template>
  <div class="value-display" :class="fieldType">
    <!-- Text Value -->
    <template v-if="fieldType === 'text'">
      <div class="text-value" :class="{ empty: !value }">
        {{ value || '(empty)' }}
      </div>
    </template>

    <!-- Array Value -->
    <template v-else-if="fieldType === 'array'">
      <div class="array-value">
        <div v-if="Array.isArray(value) && value.length > 0" class="array-items">
          <div
            v-for="(item, index) in value.slice(0, maxItems)"
            :key="index"
            class="array-item"
          >
            {{ formatArrayItem(item) }}
          </div>
          <div v-if="value.length > maxItems" class="array-more">
            ... and {{ value.length - maxItems }} more
          </div>
        </div>
        <div v-else class="empty-array">
          (empty)
        </div>
      </div>
    </template>

    <!-- Object Value -->
    <template v-else-if="fieldType === 'object'">
      <div class="object-value">
        <pre class="object-content">{{ JSON.stringify(value, null, 2) }}</pre>
      </div>
    </template>

    <!-- DateTime Value -->
    <template v-else-if="fieldType === 'datetime'">
      <div class="datetime-value">
        <div v-if="value" class="datetime-formatted">
          {{ formatDateTime(value) }}
        </div>
        <div v-else class="datetime-empty">
          (not set)
        </div>
      </div>
    </template>

    <!-- Boolean Value -->
    <template v-else-if="fieldType === 'boolean'">
      <div class="boolean-value">
        <span v-if="value === true" class="boolean-true">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          Yes
        </span>
        <span v-else-if="value === false" class="boolean-false">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          No
        </span>
        <span v-else class="boolean-undefined">(not set)</span>
      </div>
    </template>

    <!-- Default Display -->
    <template v-else>
      <div class="default-value">
        {{ formatDefaultValue(value) }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  value: unknown
  fieldType: string
  maxItems?: number
}

const _props = withDefaults(defineProps<Props>(), {
  maxItems: 5
})

// Format array item for display
function formatArrayItem(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'object') return JSON.stringify(item)
  return String(item)
}

// Format datetime
function formatDateTime(value: unknown): string {
  if (!value) return '(not set)'

  try {
    const date = new Date(value)
    return date.toLocaleString()
  } catch {
    return String(value)
  }
}

// Format default value
function formatDefaultValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toString()
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
</script>

<style scoped>
.value-display {
  @apply w-full;
}

.text-value {
  @apply text-gray-800 whitespace-pre-wrap break-words;
}

.text-value.empty {
  @apply text-gray-400 italic;
}

.array-value {
  @apply space-y-1;
}

.array-items {
  @apply space-y-1;
}

.array-item {
  @apply px-2 py-1 bg-gray-100 rounded text-sm text-gray-700;
}

.array-more {
  @apply px-2 py-1 bg-blue-50 rounded text-sm text-blue-600 italic;
}

.empty-array {
  @apply text-gray-400 italic;
}

.object-value {
  @apply bg-gray-50 rounded p-2;
}

.object-content {
  @apply text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto;
}

.datetime-value {
  @apply text-gray-800;
}

.datetime-formatted {
  @apply font-medium;
}

.datetime-empty {
  @apply text-gray-400 italic;
}

.boolean-value {
  @apply flex items-center;
}

.boolean-true {
  @apply flex items-center gap-1 text-green-600 font-medium;
}

.boolean-false {
  @apply flex items-center gap-1 text-red-600 font-medium;
}

.boolean-undefined {
  @apply text-gray-400 italic;
}

.default-value {
  @apply text-gray-800;
}
</style>