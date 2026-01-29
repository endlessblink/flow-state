/**
 * Shared filter state for mobile views (Inbox, Today)
 *
 * Uses module-level refs so filter state persists across view navigation.
 * This ensures that selecting a project filter in Inbox keeps it selected
 * when navigating to Today view and vice versa.
 */
import { ref, computed } from 'vue'

// Shared filter types
export type GroupByType = 'none' | 'time' | 'date' | 'project' | 'priority'

// Module-level state (persists across component mounts)
const selectedProject = ref<string | null>(null)
const selectedPriority = ref<string | null>(null)
const groupBy = ref<GroupByType>('none')
const hideDoneTasks = ref(true)

// Priority label mapping
const priorityLabels: Record<string, string> = {
  critical: 'P0',
  high: 'P1',
  medium: 'P2',
  low: 'P3'
}

export function useMobileFilters() {
  // Computed: Check if any filters are active
  const hasActiveFilters = computed(() => {
    return selectedProject.value !== null || selectedPriority.value !== null
  })

  // Helper: Get priority label
  const priorityLabel = (priority: string | null | undefined): string => {
    return priorityLabels[priority || ''] || ''
  }

  // Action: Clear all filters
  const clearFilters = () => {
    selectedProject.value = null
    selectedPriority.value = null
  }

  // Action: Set project filter
  const setProjectFilter = (projectId: string | null) => {
    selectedProject.value = projectId
  }

  // Action: Set priority filter
  const setPriorityFilter = (priority: string | null) => {
    selectedPriority.value = priority
  }

  // Action: Set group by
  const setGroupBy = (value: GroupByType) => {
    groupBy.value = value
  }

  // Action: Toggle hide done tasks
  const toggleHideDoneTasks = () => {
    hideDoneTasks.value = !hideDoneTasks.value
  }

  return {
    // State (refs)
    selectedProject,
    selectedPriority,
    groupBy,
    hideDoneTasks,

    // Computed
    hasActiveFilters,

    // Helpers
    priorityLabel,

    // Actions
    clearFilters,
    setProjectFilter,
    setPriorityFilter,
    setGroupBy,
    toggleHideDoneTasks
  }
}
