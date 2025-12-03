<template>
  <div class="datetime-diff">
    <div v-if="hasValidDates" class="date-comparison">
      <div class="date-display">
        <!-- Local Date -->
        <div class="date-value local">
          <div class="date-label">Local:</div>
          <div class="date-content">
            <div class="date-formatted">{{ formatDate(localDate) }}</div>
            <div class="date-raw">{{ localDateRaw }}</div>
          </div>
        </div>

        <!-- Remote Date -->
        <div class="date-value remote">
          <div class="date-label">Remote:</div>
          <div class="date-content">
            <div class="date-formatted">{{ formatDate(remoteDate) }}</div>
            <div class="date-raw">{{ remoteDateRaw }}</div>
          </div>
        </div>
      </div>

      <!-- Date Comparison -->
      <div class="date-comparison">
        <div class="comparison-result">
          <component :is="getComparisonIcon()" :class="getComparisonIconClass()" />
          <span :class="getComparisonTextClass()">
            {{ getComparisonText() }}
          </span>
        </div>

        <!-- Time Difference -->
        <div v-if="timeDifference" class="time-difference">
          <span class="diff-label">Difference:</span>
          <span class="diff-value">{{ formatTimeDifference(timeDifference) }}</span>
        </div>
      </div>

      <!-- Date Actions -->
      <div class="date-actions">
        <button
          @click="selectDate('local')"
          class="action-btn local"
          :class="{ active: selectedDate === 'local' }"
        >
          Use Local Date
        </button>
        <button
          @click="selectDate('remote')"
          class="action-btn remote"
          :class="{ active: selectedDate === 'remote' }"
        >
          Use Remote Date
        </button>
        <button
          @click="selectDate('newer')"
          class="action-btn newer"
          :class="{ active: selectedDate === 'newer' }"
        >
          Use Newer Date
        </button>
        <button
          @click="selectDate('now')"
          class="action-btn now"
        >
          Use Current Time
        </button>
      </div>
    </div>

    <div v-else class="no-dates">
      <div class="empty-message">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No valid date data to compare</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertTriangle, Equal, ArrowLeftRight } from 'lucide-vue-next'

interface Props {
  value: any
  compareValue: any
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

const selectedDate = ref<'local' | 'remote' | 'newer' | 'now' | null>(null)

const localDate = computed(() => {
  if (!props.value) return null
  try {
    return new Date(props.value)
  } catch {
    return null
  }
})

const remoteDate = computed(() => {
  if (!props.compareValue) return null
  try {
    return new Date(props.compareValue)
  } catch {
    return null
  }
})

const hasValidDates = computed(() => {
  return localDate.value instanceof Date || remoteDate.value instanceof Date
})

const localDateRaw = computed(() => String(props.value || '(empty)'))
const remoteDateRaw = computed(() => String(props.compareValue || '(empty)'))

const timeDifference = computed(() => {
  if (!localDate.value || !remoteDate.value) return null
  return Math.abs(localDate.value.getTime() - remoteDate.value.getTime())
})

const newerDate = computed(() => {
  if (!localDate.value || !remoteDate.value) return null
  return localDate.value.getTime() > remoteDate.value.getTime() ? 'local' : 'remote'
})

function formatDate(date: Date | null): string {
  if (!date || !(date instanceof Date)) return '(invalid)'
  return date.toLocaleString()
}

function getComparisonIcon() {
  if (!localDate.value || !remoteDate.value) return AlertTriangle
  if (localDate.value.getTime() === remoteDate.value.getTime()) return Equal
  return ArrowLeftRight
}

function getComparisonIconClass(): string {
  if (!localDate.value || !remoteDate.value) return 'text-yellow-500'
  if (localDate.value.getTime() === remoteDate.value.getTime()) return 'text-green-500'
  return 'text-orange-500'
}

function getComparisonText(): string {
  if (!localDate.value || !remoteDate.value) return 'Incomplete data'
  if (localDate.value.getTime() === remoteDate.value.getTime()) return 'Dates match'
  return newerDate.value === 'local' ? 'Local is newer' : 'Remote is newer'
}

function getComparisonTextClass(): string {
  if (!localDate.value || !remoteDate.value) return 'text-yellow-600'
  if (localDate.value.getTime() === remoteDate.value.getTime()) return 'text-green-600'
  return 'text-orange-600'
}

function formatTimeDifference(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  return `${seconds} second${seconds !== 1 ? 's' : ''}`
}

function selectDate(type: 'local' | 'remote' | 'newer' | 'now'): void {
  selectedDate.value = type
}
</script>

<style scoped>
.datetime-diff {
  @apply p-3;
}

.date-comparison {
  @apply space-y-3;
}

.date-display {
  @apply grid grid-cols-2 gap-3 mb-3;
}

.date-value {
  @apply p-3 rounded-lg border;
}

.date-value.local {
  @apply bg-blue-50 border-blue-200;
}

.date-value.remote {
  @apply bg-purple-50 border-purple-200;
}

.date-label {
  @apply text-sm font-medium text-gray-700 mb-1;
}

.date-content {
  @apply space-y-1;
}

.date-formatted {
  @apply font-mono text-sm text-gray-900;
}

.date-raw {
  @apply text-xs text-gray-500;
}

.date-comparison {
  @apply p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2;
}

.comparison-result {
  @apply flex items-center gap-2;
}

.comparison-result svg {
  @apply w-4 h-4;
}

.time-difference {
  @apply flex items-center gap-2 text-sm;
}

.diff-label {
  @apply text-gray-600;
}

.diff-value {
  @apply font-medium text-gray-900;
}

.date-actions {
  @apply flex flex-wrap gap-2 pt-3 border-t border-gray-200;
}

.action-btn {
  @apply px-3 py-1 text-xs rounded border font-medium transition-colors;
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

.action-btn.newer {
  @apply bg-green-50 text-green-700 border-green-200 hover:bg-green-100;
}

.action-btn.newer.active {
  @apply bg-green-500 text-white border-green-500;
}

.action-btn.now {
  @apply bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100;
}

.no-dates {
  @apply flex items-center justify-center py-8;
}

.empty-message {
  @apply text-center;
}

.empty-message p {
  @apply mt-2 text-gray-500;
}
</style>