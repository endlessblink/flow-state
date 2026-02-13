<template>
  <div class="filter-controls">
    <!-- Project Filter -->
    <div class="filter-control">
      <CustomSelect
        :model-value="activeProjectId || ''"
        :options="projectOptions"
        placeholder="All Projects"
        @update:model-value="updateProjectFilter"
      />
    </div>

    <!-- Smart View Filter -->
    <div class="filter-control">
      <CustomSelect
        :model-value="activeSmartView || ''"
        :options="smartViewOptions"
        placeholder="All Tasks"
        @update:model-value="updateSmartView"
      />
    </div>

    <!-- Status Filter -->
    <div class="filter-control">
      <CustomSelect
        :model-value="activeStatusFilter || ''"
        :options="statusOptions"
        placeholder="All Status"
        @update:model-value="updateStatusFilter"
      />
    </div>

    <!-- TASK-243: Hide Done checkbox removed - use icon toggle in view header instead -->

    <!-- Clear Filters -->
    <button
      class="clear-filters-btn"
      @click="clearAllFilters"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import CustomSelect from '@/components/common/CustomSelect.vue'

const taskStore = useTaskStore()
const { projects, activeProjectId, activeSmartView, activeStatusFilter } = storeToRefs(taskStore)

// Options for CustomSelect components
const projectOptions = computed(() => [
  { label: 'All Projects', value: '' },
  ...projects.value.map(p => ({ label: p.name, value: p.id }))
])

const smartViewOptions = [
  { label: 'All Tasks', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'Uncategorized', value: 'uncategorized' },
  { label: 'All Active', value: 'all_active' },
  { label: 'Unscheduled', value: 'unscheduled' }
]

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Planned', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

// Filter update methods
const updateProjectFilter = (value: string | number) => {
  const projectId = value === '' ? null : String(value)
  taskStore.setActiveProject(projectId)
}

const updateSmartView = (value: string | number) => {
  const view = value === '' ? null : value as 'today' | 'week' | 'uncategorized' | 'all_active' | 'unscheduled'
  taskStore.setSmartView(view)
}

const updateStatusFilter = (value: string | number) => {
  const statusFilter = value === '' ? null : String(value)
  taskStore.setActiveStatusFilter(statusFilter)
}

// TASK-243: Clear filters (hideDoneTasks now controlled by view header toggle)
const clearAllFilters = () => {
  taskStore.setActiveProject(null)
  taskStore.setSmartView(null)
  taskStore.setActiveStatusFilter(null)
}
</script>

<style scoped>
/* Main container */
.filter-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  height: auto;
  min-height: 44px;
  width: auto;
  flex-wrap: nowrap;
  flex-shrink: 0;
  box-sizing: border-box;
}

/* Filter control containers */
.filter-control {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 120px;
}

/* Clear button styling - matches CustomSelect height (22px) */
.clear-filters-btn {
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-medium);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1_5);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1;
  outline: none;
  cursor: pointer;
  height: 22px;
  box-sizing: border-box;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.clear-filters-btn:hover {
  background: var(--danger-bg-medium);
}
</style>
