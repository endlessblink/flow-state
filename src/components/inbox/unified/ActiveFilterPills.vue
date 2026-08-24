<script setup lang="ts">
import { computed } from 'vue'
import { CalendarOff, LayoutGrid, Flag, Clock, FolderOpen, X } from 'lucide-vue-next'
import type { Project } from '@/stores/tasks'
import type { DurationCategory } from '@/utils/durationCategories'
import { DURATION_FILTER_OPTIONS } from '@/utils/durationCategories'

interface Props {
  unscheduledOnly: boolean
  onCanvasOnly: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  projects: Project[]
  context?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: undefined,
})

const emit = defineEmits<{
  'update:unscheduledOnly': [value: boolean]
  'update:onCanvasOnly': [value: boolean]
  'update:selectedPriorities': [value: Set<string>]
  'update:selectedProjects': [value: Set<string>]
  'update:selectedDurations': [value: Set<DurationCategory>]
  'clearAll': []
}>()

const hasActiveFilters = computed(() => {
  return (
    props.unscheduledOnly ||
    props.onCanvasOnly ||
    props.selectedPriorities.size > 0 ||
    props.selectedProjects.size > 0 ||
    props.selectedDurations.size > 0
  )
})

const priorityLabel = computed(() => {
  const labels: Record<string, string> = {
    immediate: 'Immediate',
    high: 'High',
    medium: 'Med',
    low: 'Low',
    relaxed: 'Relaxed',
    none: 'No priority',
  }
  return Array.from(props.selectedPriorities)
    .map((p) => labels[p] || p)
    .join(', ')
})

const durationLabel = computed(() => {
  if (props.selectedDurations.size === 1) {
    const val = [...props.selectedDurations][0]
    return DURATION_FILTER_OPTIONS.find((d) => d.value === val)?.label.split(' ')[0] || val
  }
  return `${props.selectedDurations.size} durations`
})

const projectLabel = computed(() => {
  if (props.selectedProjects.size === 1) {
    const id = [...props.selectedProjects][0]
    if (id === 'none') return 'No project'
    return props.projects.find((p) => p.id === id)?.name || 'Project'
  }
  return `${props.selectedProjects.size} projects`
})
</script>

<template>
  <div v-if="hasActiveFilters" class="active-filter-pills">
    <TransitionGroup name="pill">
      <button
        v-if="unscheduledOnly"
        key="unsched"
        class="filter-pill"
        @click="emit('update:unscheduledOnly', false)"
      >
        <CalendarOff :size="12" />
        <span>Unscheduled</span>
        <X :size="10" class="pill-remove" />
      </button>

      <button
        v-if="onCanvasOnly && context !== 'canvas'"
        key="canvas"
        class="filter-pill"
        @click="emit('update:onCanvasOnly', false)"
      >
        <LayoutGrid :size="12" />
        <span>Canvas</span>
        <X :size="10" class="pill-remove" />
      </button>

      <button
        v-if="selectedPriorities.size > 0"
        key="priority"
        class="filter-pill"
        @click="emit('update:selectedPriorities', new Set())"
      >
        <Flag :size="12" />
        <span>{{ priorityLabel }}</span>
        <X :size="10" class="pill-remove" />
      </button>

      <button
        v-if="selectedDurations.size > 0"
        key="duration"
        class="filter-pill"
        @click="emit('update:selectedDurations', new Set())"
      >
        <Clock :size="12" />
        <span>{{ durationLabel }}</span>
        <X :size="10" class="pill-remove" />
      </button>

      <button
        v-if="selectedProjects.size > 0"
        key="project"
        class="filter-pill"
        @click="emit('update:selectedProjects', new Set())"
      >
        <FolderOpen :size="12" />
        <span>{{ projectLabel }}</span>
        <X :size="10" class="pill-remove" />
      </button>

      <button key="clear" class="filter-pill clear-pill" @click="emit('clearAll')">
        <X :size="12" />
        <span>Clear</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.active-filter-pills {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-inline-size: 0;
}

.active-filter-pills::-webkit-scrollbar {
  display: none;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  block-size: 24px;
  padding-inline: var(--space-2);
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  border-radius: var(--radius-full);
  color: var(--state-active-text);
  font-size: var(--text-2xs);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-pill:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.pill-remove {
  opacity: 0.6;
  transition: opacity var(--duration-fast);
}

.filter-pill:hover .pill-remove {
  opacity: 1;
}

.clear-pill {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
  color: var(--text-muted);
}

.clear-pill:hover {
  background: var(--danger-bg-light);
  border-color: var(--danger-border-medium);
  color: var(--color-danger);
}

/* TransitionGroup animations */
.pill-enter-active,
.pill-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.pill-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.pill-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.pill-move {
  transition: transform var(--duration-normal) var(--ease-out);
}
</style>
