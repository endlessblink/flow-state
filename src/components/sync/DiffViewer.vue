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
import { computed } from 'vue'
import TextDiff from './diffs/TextDiff.vue'
import ArrayDiff from './diffs/ArrayDiff.vue'
import ObjectDiff from './diffs/ObjectDiff.vue'
import DateTimeDiff from './diffs/DateTimeDiff.vue'
import BooleanDiff from './diffs/BooleanDiff.vue'

interface Props {
  value: unknown
  compareValue: unknown
  fieldType: string
  mode: 'local' | 'remote'
}

const _props = defineProps<Props>()

// Format value for display
function formatValue(value: unknown): string {
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
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.value-content.empty {
  color: var(--text-muted);
  font-style: italic;
}

.default-display {
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
}
</style>