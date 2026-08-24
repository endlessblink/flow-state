<template>
  <div class="filter-controls" :class="{ 'filter-controls--compact': props.compact }">
    <!-- Project Filter -->
    <div class="filter-control" title="Projects">
      <Folder :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Projects"
        :model-value="activeProjectId || ''"
        :options="projectOptions"
        placeholder="All Projects"
        @update:model-value="updateProjectFilter"
      />
    </div>

    <!-- Smart View Filter -->
    <div class="filter-control" title="Smart views">
      <ListFilter :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Smart views"
        :model-value="activeSmartView || ''"
        :options="smartViewOptions"
        placeholder="All Tasks"
        @update:model-value="updateSmartView"
      />
    </div>

    <!-- Status Filter -->
    <div class="filter-control" title="Status">
      <CircleDot :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Status"
        :model-value="activeStatusFilter || ''"
        :options="statusOptions"
        placeholder="All Status"
        @update:model-value="updateStatusFilter"
      />
    </div>

    <div v-if="props.priorityFilter !== undefined" class="filter-control" title="Priority">
      <Flag :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Priority"
        :model-value="props.priorityFilter"
        :options="priorityOptions"
        placeholder="All Priorities"
        @update:model-value="$emit('update:priorityFilter', String($event))"
      />
    </div>

    <div v-if="props.showRecurringFilter" class="filter-control" title="Recurring tasks">
      <Repeat2 :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Recurring tasks"
        :model-value="props.recurringFilter || 'all'"
        :options="recurringOptions"
        placeholder="All Tasks"
        @update:model-value="$emit('update:recurringFilter', String($event))"
      />
    </div>

    <!-- Assignment Filter (workspace only) -->
    <div v-if="!isPersonalWorkspace" class="filter-control" title="Assignment">
      <Users :size="16" class="filter-icon" aria-hidden="true" />
      <CustomSelect
        aria-label="Assignment"
        :model-value="assignmentFilterMode"
        :options="assignmentOptions"
        placeholder="All Tasks"
        @update:model-value="updateAssignmentFilter"
      />
    </div>

    <!-- TASK-243: Hide Done checkbox removed - use icon toggle in view header instead -->

    <!-- FEATURE-1162: Saved Views -->
    <SavedViewsDropdown />

    <!-- Clear Filters -->
    <button
      class="clear-filters-btn"
      type="button"
      title="Clear filters"
      aria-label="Clear filters"
      @click="clearAllFilters"
    >
      <X :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAssignmentFilter, type AssignmentFilterMode } from '@/composables/workspace/useTaskAssignment'
import { CircleDot, Flag, Folder, ListFilter, Repeat2, Users, X } from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'
import SavedViewsDropdown from '@/components/filters/SavedViewsDropdown.vue'

const props = defineProps<{
  priorityFilter?: string
  recurringFilter?: string
  showRecurringFilter?: boolean
  compact?: boolean
}>()

defineEmits<{
  (event: 'update:priorityFilter', value: string): void
  (event: 'update:recurringFilter', value: string): void
}>()

const taskStore = useTaskStore()
const { projects, activeProjectId, activeSmartView, activeStatusFilter } = storeToRefs(taskStore)

const workspaceStore = useWorkspaceStore()
const isPersonalWorkspace = computed(() => workspaceStore.isPersonalWorkspace)

const { filterMode: assignmentFilterMode, setFilterMode } = useAssignmentFilter()

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
  { label: 'To Do', value: 'todo' },
  { label: 'Done', value: 'done' }
]

const priorityOptions = [
  { label: 'All Priorities', value: '' },
  { label: 'Immediate', value: 'immediate' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'No Priority', value: 'none' }
]

const recurringOptions = [
  { label: 'All Tasks', value: 'all' },
  { label: 'Recurring Only', value: 'recurring' },
  { label: 'Non-recurring Only', value: 'non_recurring' }
]

const assignmentOptions = [
  { label: 'All Tasks', value: 'all' },
  { label: 'My Tasks', value: 'mine' },
  { label: 'Unassigned', value: 'unassigned' }
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

const updateAssignmentFilter = (value: string | number) => {
  setFilterMode((value || 'all') as AssignmentFilterMode)
}

// TASK-243: Clear filters (hideDoneTasks now controlled by view header toggle)
const clearAllFilters = () => {
  taskStore.setActiveProject(null)
  taskStore.setSmartView(null)
  taskStore.setActiveStatusFilter(null)
  setFilterMode('all')
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
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 120px;
}

.filter-icon {
  display: none;
}

.filter-controls--compact {
  gap: var(--space-2);
  padding-inline: var(--space-2);
}

.filter-controls--compact .filter-control {
  width: 36px;
  min-width: 36px;
  height: 32px;
  justify-content: center;
}

.filter-controls--compact .filter-icon {
  display: block;
  position: absolute;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  color: var(--text-secondary);
  pointer-events: none;
  z-index: 1;
}

.filter-controls--compact .filter-control:focus-within .filter-icon,
.filter-controls--compact .filter-control:hover .filter-icon {
  color: var(--text-primary);
}

.filter-controls--compact :deep(.custom-select),
.filter-controls--compact :deep(.select-trigger) {
  width: 100%;
  height: 32px;
}

.filter-controls--compact :deep(.select-trigger) {
  justify-content: center;
  padding-inline: 0;
  border-color: var(--border-subtle);
}

.filter-controls--compact :deep(.select-value) {
  display: none;
}

.filter-controls--compact :deep(.select-icon) {
  display: none;
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
