<template>
  <div class="diff-viewer" :class="fieldType">
    <!-- Text Field Diff -->
    <template v-if="fieldType === 'text'">
      <TextDiff
        :value="value"
        :compare-value="compareValue"
        :mode="mode"
      />
    </template>

    <!-- Array Field Diff -->
    <template v-else-if="fieldType === 'array'">
      <ArrayDiff
        :value="value"
        :compare-value="compareValue"
        :mode="mode"
      />
    </template>

    <!-- Object Field Diff -->
    <template v-else-if="fieldType === 'object'">
      <ObjectDiff
        :value="value"
        :compare-value="compareValue"
        :mode="mode"
      />
    </template>

    <!-- DateTime Field Diff -->
    <template v-else-if="fieldType === 'datetime'">
      <DateTimeDiff
        :value="value"
        :compare-value="compareValue"
        :mode="mode"
      />
    </template>

    <!-- Boolean Field Diff -->
    <template v-else-if="fieldType === 'boolean'">
      <BooleanDiff
        :value="value"
        :compare-value="compareValue"
        :mode="mode"
      />
    </template>

    <!-- Default Text Display -->
    <template v-else>
      <div class="default-display">
        <div class="value-content" :class="{ empty: !value }">
          {{ formatValue(value) }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed as _computed } from 'vue'
import TextDiff from './diffs/TextDiff.vue'
import ArrayDiff from './diffs/ArrayDiff.vue'
import ObjectDiff from './diffs/ObjectDiff.vue'
import DateTimeDiff from './diffs/DateTimeDiff.vue'
import BooleanDiff from './diffs/BooleanDiff.vue'

interface Props {
  value: any
  compareValue: any
  fieldType: string
  mode: 'local' | 'remote'
}

const _props = defineProps<Props>()

// Format value for display
function formatValue(value: any): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toString()
  if (Array.isArray(value)) return `[${value.length} item${value.length !== 1 ? 's' : ''}]`
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
</script>

<style scoped>
.diff-viewer {
  @apply w-full;
}

.value-content {
  @apply text-gray-800 whitespace-pre-wrap break-words;
}

.value-content.empty {
  @apply text-gray-400 italic;
}

.default-display {
  @apply p-2;
}
</style>