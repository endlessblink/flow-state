<template>
  <div class="filter-controls">
    <!-- Project Filter -->
    <div class="filter-control">
      <select
        :value="activeProjectId || ''"
        class="filter-select"
        @input="updateProjectFilter($event)"
      >
        <option value="">
          All Projects
        </option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <!-- Smart View Filter -->
    <div class="filter-control">
      <select
        :value="activeSmartView || ''"
        class="filter-select"
        @input="updateSmartView($event)"
      >
        <option value="">
          All Tasks
        </option>
        <option value="today">
          Today
        </option>
        <option value="week">
          This Week
        </option>
        <option value="uncategorized">
          Uncategorized
        </option>
        <option value="all_active">
          All Active
        </option>
        <option value="unscheduled">
          Unscheduled
        </option>
      </select>
    </div>

    <!-- Status Filter -->
    <div class="filter-control">
      <select
        :value="activeStatusFilter || ''"
        class="filter-select"
        @input="updateStatusFilter($event)"
      >
        <option value="">
          All Status
        </option>
        <option value="planned">
          Planned
        </option>
        <option value="in_progress">
          In Progress
        </option>
        <option value="done">
          Done
        </option>
        <option value="backlog">
          Backlog
        </option>
        <option value="on_hold">
          On Hold
        </option>
      </select>
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
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()
const { projects, activeProjectId, activeSmartView, activeStatusFilter, hideDoneTasks } = storeToRefs(taskStore)

// Filter update methods
const updateProjectFilter = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const projectId = target.value || null
  taskStore.setActiveProject(projectId)
}

const updateSmartView = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const view = target.value as 'today' | 'week' | 'uncategorized' | 'all_active' | 'unscheduled' | null
  taskStore.setSmartView(view)
}

const updateStatusFilter = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const statusFilter = target.value || null
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
/* Main container with glass morphism effect */
.filter-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: transparent; /* Remove heavy glass bg */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none; /* Remove border for cleaner look */
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
}

/* Select dropdown styling */
.filter-select {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-hover);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  min-width: 120px;
  height: 32px;
  box-sizing: border-box;
}

.filter-select option {
  background: var(--surface-secondary);
  color: var(--text-primary);
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

/* Clear button styling - using existing design tokens */
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
