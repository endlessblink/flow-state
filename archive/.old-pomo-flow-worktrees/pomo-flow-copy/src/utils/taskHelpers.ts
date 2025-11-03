/**
 * Task Helper Utilities
 *
 * Utility functions for task operations that don't require store access
 */

import type { Task, TaskInstance } from '@/types/task'

/**
 * Get task instances for a task, with backward compatibility
 */
export const getTaskInstances = (task: Task): TaskInstance[] => {
  // If task has instances array, return it
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }

  // Backward compatibility: create synthetic instance from legacy fields
  if (task.scheduledDate && task.scheduledTime) {
    return [{
      id: `legacy-${task.id}`,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }

  // No instances
  return []
}