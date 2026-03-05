import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import type { Task } from '@/types/tasks'

/**
 * TASK-1451: Returns default task properties based on active filters.
 * When a user creates a task while viewing a filtered list (e.g. "Today"),
 * the new task inherits properties so it stays visible in the current view.
 *
 * Override priority: Explicit user input > Column defaults > Filter defaults > Base defaults
 */
export function useFilterDefaults() {
  const taskStore = useTaskStore()
  const uiStore = useUIStore()

  const filterDefaults = computed<Partial<Task>>(() => {
    const defaults: Partial<Task> = {}
    const smartView = taskStore.activeSmartView
    const durationFilter = taskStore.activeDurationFilter

    // Date-based filters
    if (smartView === 'today' || smartView === 'week') {
      const today = new Date()
      defaults.dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    }

    // Status filter
    if (smartView === 'in_progress') {
      defaults.status = 'in_progress' as Task['status']
    }

    // Duration filters (separate ref from smartView)
    const durationMap: Record<string, number> = { quick: 15, short: 30, medium: 60, long: 90 }
    if (durationFilter && durationFilter in durationMap) {
      defaults.estimatedDuration = durationMap[durationFilter]
    }

    // Project filter — single project selected
    const selectedIds = uiStore.selectedProjectIds
    if (selectedIds?.size === 1) {
      defaults.projectId = [...selectedIds][0]
    }

    // Active project in sidebar (single-select mode)
    if (!defaults.projectId && taskStore.activeProjectId) {
      defaults.projectId = taskStore.activeProjectId
    }

    return defaults
  })

  return { filterDefaults }
}
