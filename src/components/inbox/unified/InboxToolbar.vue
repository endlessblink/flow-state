<template>
  <div class="inbox-toolbar">
    <InboxSortDropdown
      :sort-by="sortBy"
      :sort-direction="sortDirection"
      :context="context"
      @update:sort-by="$emit('update:sortBy', $event)"
      @update:sort-direction="$emit('update:sortDirection', $event)"
    />

    <ActiveFilterPills
      :unscheduled-only="unscheduledOnly"
      :on-canvas-only="onCanvasOnly"
      :selected-priorities="selectedPriorities"
      :selected-projects="selectedProjects"
      :selected-durations="selectedDurations"
      :projects="projects"
      :context="context"
      @update:unscheduled-only="$emit('update:unscheduledOnly', $event)"
      @update:on-canvas-only="$emit('update:onCanvasOnly', $event)"
      @update:selected-priorities="$emit('update:selectedPriorities', $event)"
      @update:selected-projects="$emit('update:selectedProjects', $event)"
      @update:selected-durations="$emit('update:selectedDurations', $event)"
      @clear-all="$emit('clearAll')"
    />

    <InboxFilterPopover
      :tasks="tasks"
      :projects="projects"
      :unscheduled-only="unscheduledOnly"
      :on-canvas-only="onCanvasOnly"
      :selected-priorities="selectedPriorities"
      :selected-projects="selectedProjects"
      :selected-durations="selectedDurations"
      :context="context"
      :on-canvas-count="onCanvasCount"
      @update:unscheduled-only="$emit('update:unscheduledOnly', $event)"
      @update:on-canvas-only="$emit('update:onCanvasOnly', $event)"
      @update:selected-priorities="$emit('update:selectedPriorities', $event)"
      @update:selected-projects="$emit('update:selectedProjects', $event)"
      @update:selected-durations="$emit('update:selectedDurations', $event)"
      @clear-all="$emit('clearAll')"
    />
  </div>
</template>

<script setup lang="ts">
import type { Task, Project } from '@/stores/tasks'
import type { SortByType, SortDirection } from '@/composables/inbox/useUnifiedInboxState'
import type { DurationCategory } from '@/utils/durationCategories'
import InboxSortDropdown from './InboxSortDropdown.vue'
import ActiveFilterPills from './ActiveFilterPills.vue'
import InboxFilterPopover from './InboxFilterPopover.vue'

interface Props {
  sortBy: SortByType
  sortDirection: SortDirection
  context?: string
  // Filter state
  unscheduledOnly: boolean
  onCanvasOnly: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  // Data for counts/labels
  tasks: Task[]
  projects: Project[]
  onCanvasCount?: number
}

defineProps<Props>()

defineEmits<{
  'update:sortBy': [value: SortByType]
  'update:sortDirection': [value: SortDirection]
  'update:unscheduledOnly': [value: boolean]
  'update:onCanvasOnly': [value: boolean]
  'update:selectedPriorities': [value: Set<string>]
  'update:selectedProjects': [value: Set<string>]
  'update:selectedDurations': [value: Set<DurationCategory>]
  'clearAll': []
}>()
</script>

<style scoped>
.inbox-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-ground);
  min-height: 32px;
  flex-shrink: 0;
}
</style>
