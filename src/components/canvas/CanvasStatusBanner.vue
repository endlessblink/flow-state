<template>
  <div
    v-if="activeStatusFilter"
    class="absolute top-4 left-4 z-20 px-4 py-2 bg-[rgba(99,102,241,0.2)] backdrop-blur-sm border border-indigo-500/30 rounded-lg text-indigo-300 text-sm font-medium flex items-center gap-2 shadow-lg"
  >
    <Filter :size="16" />
    <span>{{ filterLabel }} filter active</span>
    <button
      class="ml-2 text-indigo-400 hover:text-white transition-colors"
      title="Clear filter"
      @click="$emit('clear-filter')"
    >
      <X :size="14" />
    </button>
    <div class="text-xs text-indigo-400 ml-2">
      (Check Canvas Inbox for more tasks)
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Filter, X } from 'lucide-vue-next'

const props = defineProps<{
  activeStatusFilter: string | null
}>()

defineEmits<{
  (e: 'clear-filter'): void
}>()

const filterLabel = computed(() => {
  if (!props.activeStatusFilter) return ''
  const labels: Record<string, string> = {
    'done': 'Completed',
    'in_progress': 'In Progress',
    'planned': 'Planned',
    'backlog': 'Backlog',
    'on_hold': 'On Hold'
  }
  return labels[props.activeStatusFilter] || props.activeStatusFilter
})
</script>
