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

    <div class="toolbar-search" :class="{ active: searchQuery }">
      <Search :size="14" class="toolbar-search__icon" />
      <input
        dir="auto"
        class="toolbar-search__input"
        type="text"
        :value="searchQuery"
        placeholder="Search tasks..."
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        @keydown.escape="$emit('update:searchQuery', '')"
      >
      <button
        v-if="searchQuery"
        class="toolbar-search__clear"
        type="button"
        title="Clear search"
        @click="$emit('update:searchQuery', '')"
      >
        <X :size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
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
  searchQuery: string
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
  'update:searchQuery': [value: string]
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

.toolbar-search {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  min-width: 0;
  flex: 1;
  height: 28px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-tertiary);
  transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}

.toolbar-search:focus-within,
.toolbar-search.active {
  border-color: var(--brand-primary-dim);
  background: var(--surface-2);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.toolbar-search__icon {
  flex-shrink: 0;
}

.toolbar-search__input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-xs);
}

.toolbar-search__input::placeholder {
  color: var(--text-muted);
}

.toolbar-search__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.toolbar-search__clear:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
</style>
