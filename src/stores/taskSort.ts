import { defineStore } from 'pinia'
import { usePersistentRef } from '@/composables/usePersistentRef'
import type { TaskSortDirection, TaskSortKey } from '@/utils/taskSort'

export const useTaskSortStore = defineStore('task-sort', () => {
  // Keep the existing Catalog keys so upgrades retain the user's chosen main order.
  const mainSortKey = usePersistentRef<TaskSortKey>('flowstate:all-tasks-sort-by', 'dueDate')
  const mainSortDirection = usePersistentRef<TaskSortDirection>('flowstate:all-tasks-sort-direction', 'asc')

  return {
    mainSortKey,
    mainSortDirection,
  }
})
