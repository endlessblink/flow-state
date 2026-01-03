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

    <!-- Hide Done Tasks Toggle -->
    <div class="checkbox-control">
      <input
        id="hide-done"
        :checked="hideDoneTasks"
        type="checkbox"
        class="hide-done-checkbox"
        @input="updateHideDone"
      >
      <label for="hide-done" class="checkbox-label">
        Hide Done
      </label>
    </div>

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
const { projects, activeProjectId, activeSmartView, activeStatusFilter, hideDoneTasks } = storeToRefs(taskStore)

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

const updateHideDone = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newValue = target.checked

  // Only toggle if the state actually changed
  if (newValue !== hideDoneTasks.value) {
    taskStore.toggleHideDoneTasks()
  }
}

const clearAllFilters = () => {
  taskStore.setActiveProject(null)
  taskStore.setSmartView(null)
  taskStore.setActiveStatusFilter(null)

  // Ensure hide done tasks is set to false
  if (hideDoneTasks.value !== false) {
    taskStore.toggleHideDoneTasks()
  }
}
</script>

<style scoped>
/* Main container */
.filter-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 16px;
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

/* Checkbox control container */
.checkbox-control {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Checkbox styling */
.hide-done-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-hover);
  cursor: pointer;
  accent-color: var(--brand-teal);
  flex-shrink: 0;
}

/* Checkbox label styling */
.checkbox-label {
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Clear button styling */
.clear-filters-btn {
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-medium);
  color: var(--color-danger);
  border-radius: var(--radius-md);
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  height: 32px;
  box-sizing: border-box;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.clear-filters-btn:hover {
  background: var(--danger-bg-medium);
}
</style>
