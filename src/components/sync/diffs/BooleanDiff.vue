<template>
  <div class="boolean-diff">
    <div class="boolean-comparison">
      <div class="boolean-values">
        <!-- Local Value -->
        <div class="boolean-value local">
          <div class="value-label">Local:</div>
          <div class="value-content">
            <component :is="getBooleanIcon(props.value)" :class="getBooleanIconClass(props.value)" />
            <span class="value-text">{{ formatBoolean(props.value) }}</span>
          </div>
        </div>

        <!-- Remote Value -->
        <div class="boolean-value remote">
          <div class="value-label">Remote:</div>
          <div class="value-content">
            <component :is="getBooleanIcon(props.compareValue)" :class="getBooleanIconClass(props.compareValue)" />
            <span class="value-text">{{ formatBoolean(props.compareValue) }}</span>
          </div>
        </div>
      </div>

      <!-- Comparison Result -->
      <div class="comparison-result">
        <div v-if="valuesEqual" class="result-equal">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-green-600">Values match</span>
        </div>

        <div v-else class="result-different">
          <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span class="text-orange-600">Values differ</span>
        </div>
      </div>

      <!-- Boolean Actions -->
      <div class="boolean-actions">
        <button
          @click="selectValue(props.value)"
          class="action-btn local"
          :class="{ active: selectedValue === props.value }"
        >
          Use Local ({{ formatBoolean(props.value) }})
        </button>
        <button
          @click="selectValue(props.compareValue)"
          class="action-btn remote"
          :class="{ active: selectedValue === props.compareValue }"
        >
          Use Remote ({{ formatBoolean(props.compareValue) }})
        </button>
        <button
          v-if="props.value === true || props.compareValue === true"
          @click="selectValue(true)"
          class="action-btn true"
          :class="{ active: selectedValue === true }"
        >
          Force True
        </button>
        <button
          v-if="props.value === false || props.compareValue === false"
          @click="selectValue(false)"
          class="action-btn false"
          :class="{ active: selectedValue === false }"
        >
          Force False
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, X, HelpCircle } from 'lucide-vue-next'

interface Props {
  value: any
  compareValue: any
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

const selectedValue = ref<boolean | null>(null)

const valuesEqual = computed(() => {
  return props.value === props.compareValue
})

function getBooleanIcon(value: any) {
  if (value === true) return Check
  if (value === false) return X
  return HelpCircle
}

function getBooleanIconClass(value: any): string {
  if (value === true) return 'w-5 h-5 text-green-500'
  if (value === false) return 'w-5 h-5 text-red-500'
  return 'w-5 h-5 text-gray-400'
}

function formatBoolean(value: any): string {
  if (value === true) return 'True'
  if (value === false) return 'False'
  return 'Not set'
}

function selectValue(value: boolean | null): void {
  selectedValue.value = value
}
</script>

<style scoped>
.boolean-diff {
  @apply p-3;
}

.boolean-comparison {
  @apply space-y-3;
}

.boolean-values {
  @apply grid grid-cols-2 gap-3;
}

.boolean-value {
  @apply p-3 rounded-lg border;
}

.boolean-value.local {
  @apply bg-blue-50 border-blue-200;
}

.boolean-value.remote {
  @apply bg-purple-50 border-purple-200;
}

.value-label {
  @apply text-sm font-medium text-gray-700 mb-2;
}

.value-content {
  @apply flex items-center gap-2;
}

.value-text {
  @apply font-medium text-gray-900;
}

.comparison-result {
  @apply p-3 bg-gray-50 rounded-lg border border-gray-200;
}

.result-equal,
.result-different {
  @apply flex items-center gap-2;
}

.boolean-actions {
  @apply flex flex-wrap gap-2 pt-3 border-t border-gray-200;
}

.action-btn {
  @apply px-3 py-2 text-sm rounded border font-medium transition-colors;
}

.action-btn.local {
  @apply bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100;
}

.action-btn.local.active {
  @apply bg-blue-500 text-white border-blue-500;
}

.action-btn.remote {
  @apply bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100;
}

.action-btn.remote.active {
  @apply bg-purple-500 text-white border-purple-500;
}

.action-btn.true {
  @apply bg-green-50 text-green-700 border-green-200 hover:bg-green-100;
}

.action-btn.true.active {
  @apply bg-green-500 text-white border-green-500;
}

.action-btn.false {
  @apply bg-red-50 text-red-700 border-red-200 hover:bg-red-100;
}

.action-btn.false.active {
  @apply bg-red-500 text-white border-red-500;
}
</style>