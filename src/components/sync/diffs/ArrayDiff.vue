<template>
  <div class="array-diff">
    <div v-if="hasArrays" class="array-comparison">
      <div class="array-header">
        <div class="array-stats">
          <span class="local-count">
            Local: {{ localArray.length }} item{{ localArray.length !== 1 ? 's' : '' }}
          </span>
          <span class="remote-count">
            Remote: {{ remoteArray.length }} item{{ remoteArray.length !== 1 ? 's' : '' }}
          </span>
          <span class="merge-count">
            Merged: {{ mergedArray.length }} item{{ mergedArray.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <div class="array-items">
        <div
          v-for="(item, index) in diffItems"
          :key="getItemKey(item, index)"
          :class="getItemClass(item)"
          class="array-item"
        >
          <div class="item-icon">
            <component :is="getItemIcon(item)" />
          </div>
          <div class="item-content">
            <div class="item-value">{{ formatItemValue(item.value) }}</div>
            <div class="item-meta">
              <span v-if="item.source" class="item-source">{{ item.source }}</span>
              <span v-if="item.index !== undefined" class="item-index">#{{ item.index + 1 }}</span>
            </div>
          </div>
          <div v-if="item.duplicates" class="item-duplicates">
            <span class="duplicate-count">{{ item.duplicates.length }}× duplicate</span>
          </div>
        </div>
      </div>

      <!-- Array Actions -->
      <div class="array-actions">
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
            Union (All Items)
          </button>
          <button
            @click="mergeStrategy = 'local'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'local' }"
          >
            Local Only
          </button>
          <button
            @click="mergeStrategy = 'remote'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'remote' }"
          >
            Remote Only
          </button>
          <button
            @click="mergeStrategy = 'intersection'"
            class="merge-strategy-btn"
            :class="{ active: mergeStrategy === 'intersection' }"
          >
            Intersection (Common Only)
          </button>
        </div>
      </div>
    </div>

    <div v-else class="no-arrays">
      <div class="empty-message">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>No array data to compare</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Minus, Check, Copy, Circle } from 'lucide-vue-next'

interface Props {
  value: any
  compareValue: any
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

const showMergeOptions = ref(false)
const mergeStrategy = ref<'union' | 'local' | 'remote' | 'intersection'>('union')

const localArray = computed(() => {
  return Array.isArray(props.value) ? props.value : []
})

const remoteArray = computed(() => {
  return Array.isArray(props.compareValue) ? props.compareValue : []
})

const hasArrays = computed(() => {
  return localArray.value.length > 0 || remoteArray.value.length > 0
})

const mergedArray = computed(() => {
  switch (mergeStrategy.value) {
    case 'union':
      return [...new Set([...localArray.value, ...remoteArray.value])]
    case 'local':
      return localArray.value
    case 'remote':
      return remoteArray.value
    case 'intersection':
      return localArray.value.filter(item =>
        remoteArray.value.some(remoteItem => deepEqual(item, remoteItem))
      )
    default:
      return [...new Set([...localArray.value, ...remoteArray.value])]
  }
})

interface DiffItem {
  value: any
  type: 'added' | 'removed' | 'unchanged' | 'duplicate'
  source?: 'local' | 'remote' | 'both'
  index?: number
  duplicates?: any[]
}

const diffItems = computed((): DiffItem[] => {
  const items: DiffItem[] = []
  const seen = new Set()

  // Add local items
  localArray.value.forEach((item, index) => {
    const key = getItemKeyInternal(item)
    const inRemote = remoteArray.value.some(remoteItem => deepEqual(item, remoteItem))

    if (inRemote) {
      items.push({
        value: item,
        type: 'unchanged',
        source: 'both',
        index
      })
    } else {
      items.push({
        value: item,
        type: props.mode === 'local' ? 'unchanged' : 'removed',
        source: 'local',
        index
      })
    }

    seen.add(key)
  })

  // Add remote items not in local
  remoteArray.value.forEach((item, index) => {
    const key = getItemKeyInternal(item)
    if (!seen.has(key)) {
      items.push({
        value: item,
        type: props.mode === 'remote' ? 'unchanged' : 'added',
        source: 'remote',
        index
      })
    }
  })

  // Check for duplicates
  const counts = new Map()
  items.forEach(item => {
    const key = JSON.stringify(item.value)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return items.map(item => {
    const key = JSON.stringify(item.value)
    const count = counts.get(key)
    return {
      ...item,
      type: count > 1 ? 'duplicate' : item.type
    }
  })
})

function getItemKey(item: DiffItem, index: number): string {
  return `${getItemKeyInternal(item.value)}-${index}`
}

function getItemKeyInternal(item: any): string {
  if (typeof item === 'object' && item !== null && 'id' in item) {
    return String(item.id)
  }
  return JSON.stringify(item)
}

function getItemClass(item: DiffItem): string {
  const baseClass = 'array-item'
  switch (item.type) {
    case 'added':
      return `${baseClass} item-added`
    case 'removed':
      return `${baseClass} item-removed`
    case 'unchanged':
      return `${baseClass} item-unchanged`
    case 'duplicate':
      return `${baseClass} item-duplicate`
    default:
      return baseClass
  }
}

function getItemIcon(item: DiffItem) {
  switch (item.type) {
    case 'added':
      return Plus
    case 'removed':
      return Minus
    case 'unchanged':
      return Check
    case 'duplicate':
      return Copy
    default:
      return Circle
  }
}

function formatItemValue(item: any): string {
  if (item === null || item === undefined) return '(null)'
  if (typeof item === 'string') return item
  if (typeof item === 'object') return JSON.stringify(item, null, 2)
  return String(item)
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  return a === b
}
</script>

<style scoped>
.array-diff {
  @apply p-3;
}

.array-comparison {
  @apply space-y-3;
}

.array-header {
  @apply border-b border-gray-200 pb-2;
}

.array-stats {
  @apply flex items-center gap-4 text-xs text-gray-600;
}

.local-count {
  @apply text-blue-600;
}

.remote-count {
  @apply text-purple-600;
}

.merge-count {
  @apply text-green-600 font-medium;
}

.array-items {
  @apply space-y-2;
}

.array-item {
  @apply flex items-start gap-3 p-3 rounded-lg border transition-colors;
}

.item-added {
  @apply bg-green-50 border-green-200;
}

.item-removed {
  @apply bg-red-50 border-red-200;
}

.item-unchanged {
  @apply bg-gray-50 border-gray-200;
}

.item-duplicate {
  @apply bg-yellow-50 border-yellow-200;
}

.item-icon {
  @apply flex-shrink-0 mt-0.5;
}

.item-content {
  @apply flex-1 min-w-0;
}

.item-value {
  @apply text-sm text-gray-900 break-words font-mono bg-gray-100 rounded px-2 py-1;
}

.item-meta {
  @apply flex items-center gap-2 mt-1 text-xs text-gray-500;
}

.item-source {
  @apply font-medium;
}

.item-source:contains("local") {
  @apply text-blue-600;
}

.item-source:contains("remote") {
  @apply text-purple-600;
}

.item-source:contains("both") {
  @apply text-green-600;
}

.item-duplicates {
  @apply flex-shrink-0;
}

.duplicate-count {
  @apply text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium;
}

.array-actions {
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

.no-arrays {
  @apply flex items-center justify-center py-8;
}

.empty-message {
  @apply text-center;
}

.empty-message p {
  @apply mt-2 text-gray-500;
}
</style>