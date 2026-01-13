/**
 * Day-Group Suggestions
 *
 * Detects when a day-based canvas group (e.g., "Friday") matches today's date
 * and creates a suggestion to move tasks to the "Today" group.
 *
 * This is a user-triggered approach that respects TASK-255 geometry invariants:
 * - User clicks "Move Tasks" to initiate the move
 * - Tasks are moved via proper drag-handler code path
 * - No automatic geometry changes
 *
 * @see TASK-266 in MASTER_PLAN.md
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSmartSuggestionsSingleton } from './useSmartSuggestions'
import { detectPowerKeyword, SMART_GROUPS } from '@/composables/usePowerKeywords'
import { useDateTransition } from '@/composables/useDateTransition'
import type { DayGroupTransitionSuggestion, DayGroupTransitionMetadata } from '@/types/suggestions'
import type { CanvasGroup } from '@/stores/canvas/types'
import type { Task } from '@/types/tasks'

/**
 * Get the current day of week index (0=Sunday, 6=Saturday)
 */
const getTodayDayIndex = (): number => {
  return new Date().getDay()
}



/**
 * Check if a group is a day-of-week group and matches today
 */
const isDayGroupMatchingToday = (group: CanvasGroup): { matches: boolean; dayName: string } => {
  const powerKeyword = group.powerKeyword || detectPowerKeyword(group.name)

  if (!powerKeyword || powerKeyword.category !== 'day_of_week') {
    return { matches: false, dayName: '' }
  }

  const groupDayIndex = parseInt(powerKeyword.value, 10)
  const todayIndex = getTodayDayIndex()

  return {
    matches: groupDayIndex === todayIndex,
    dayName: powerKeyword.displayName
  }
}

/**
 * Find the "Today" group on the canvas
 */
const findTodayGroup = (groups: CanvasGroup[]): CanvasGroup | null => {
  return groups.find(group => {
    const powerKeyword = group.powerKeyword || detectPowerKeyword(group.name)
    return powerKeyword?.category === 'date' && powerKeyword.value === SMART_GROUPS.TODAY
  }) || null
}

/**
 * Get tasks that belong to a specific group
 * Uses spatial containment to determine membership
 */
const getTasksInGroup = (
  groupId: string,
  tasks: Task[],
  groups: CanvasGroup[]
): Task[] => {
  const group = groups.find(g => g.id === groupId)
  if (!group) return []

  return tasks.filter(task => {
    // Check if task is spatially within the group
    if (!task.canvasPosition) return false

    const pos = task.canvasPosition
    return (
      pos.x >= group.position.x &&
      pos.x <= group.position.x + group.position.width &&
      pos.y >= group.position.y &&
      pos.y <= group.position.y + group.position.height
    )
  })
}

/**
 * Day-group suggestions composable.
 * Detects day-based groups matching today and creates move suggestions.
 */
export function useDayGroupSuggestions() {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()
  const suggestionSystem = useSmartSuggestionsSingleton()

  // Track if we've already shown suggestions for today
  const checkedToday = ref(false)
  const lastCheckedDate = ref<string>('')

  /**
   * Generate a unique suggestion ID for a day-group transition
   */
  const generateSuggestionId = (sourceGroupId: string, date: string): string => {
    return `day-group-transition-${sourceGroupId}-${date}`
  }

  /**
   * Move tasks from source group to target group.
   * This uses the task store's update method with 'DRAG' source
   * to respect geometry invariants.
   */
  const moveTasksToGroup = async (
    taskIds: string[],
    targetGroup: CanvasGroup
  ): Promise<void> => {
    // Calculate positions within the target group
    const startX = targetGroup.position.x + 20
    const startY = targetGroup.position.y + 60 // Below header
    const spacing = 80

    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i]

      // Update task position to be inside target group
      // Use 'DRAG' source to respect geometry invariants
      await taskStore.updateTask(
        taskId,
        {
          canvasPosition: {
            x: startX,
            y: startY + (i * spacing)
          },
          parentId: targetGroup.id
        },
        'DRAG' // Critical: Use DRAG source for geometry changes
      )
    }
  }

  /**
   * Check for day-group matches and create suggestions
   */
  const checkForDayGroupMatches = () => {
    // Don't check if feature is disabled
    if (!suggestionSystem.isDayGroupSuggestionsEnabled.value) {
      return
    }

    // Get current date string for deduplication
    const today = new Date()
    const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

    // Don't check multiple times for the same day
    if (lastCheckedDate.value === dateKey && checkedToday.value) {
      return
    }

    lastCheckedDate.value = dateKey

    const groups = canvasStore.groups
    const tasks = taskStore.filteredTasks

    // Find the Today group (target for moves)
    const todayGroup = findTodayGroup(groups)

    // Check each group for day-of-week match
    for (const group of groups) {
      const { matches, dayName } = isDayGroupMatchingToday(group)

      if (!matches) continue

      // Get tasks in this day group
      const tasksInGroup = getTasksInGroup(group.id, tasks, groups)

      if (tasksInGroup.length === 0) continue

      // Create suggestion
      const suggestionId = generateSuggestionId(group.id, dateKey)

      const metadata: DayGroupTransitionMetadata = {
        sourceGroupId: group.id,
        sourceGroupName: group.name,
        targetGroupId: todayGroup?.id,
        targetGroupName: todayGroup?.name || 'Today',
        taskIds: tasksInGroup.map(t => t.id),
        taskCount: tasksInGroup.length,
        dayName
      }

      const suggestion: DayGroupTransitionSuggestion = {
        id: suggestionId,
        type: 'day_group_transition',
        title: `${dayName} is today!`,
        description: `You have ${tasksInGroup.length} task${tasksInGroup.length === 1 ? '' : 's'} in your ${group.name} group. Move them to Today?`,
        source: 'rule',
        confidence: 1.0,
        priority: 100, // High priority
        createdAt: new Date(),
        dismissed: false,
        metadata,
        actions: [
          {
            id: 'move',
            label: 'Move Tasks',
            icon: 'ArrowRight',
            primary: true,
            handler: async () => {
              if (todayGroup) {
                await moveTasksToGroup(metadata.taskIds, todayGroup)
              } else {
                // If no Today group exists, just update the due date
                for (const taskId of metadata.taskIds) {
                  const todayDate = new Date().toISOString().split('T')[0]
                  await taskStore.updateTask(taskId, { dueDate: todayDate }, 'SMART-GROUP')
                }
              }
            }
          },
          {
            id: 'dismiss',
            label: 'Not Now',
            icon: 'X',
            handler: () => {
              suggestionSystem.dismissSuggestion(suggestionId)
            }
          }
        ]
      }

      suggestionSystem.addSuggestion(suggestion)
    }

    checkedToday.value = true
  }

  /**
   * Set up date transition watcher to re-check at midnight
   */
  const setupDateTransitionWatcher = () => {
    useDateTransition({
      onDayChange: () => {
        // Reset check flag and re-check
        checkedToday.value = false
        checkForDayGroupMatches()
      }
    })

    // Also watch for visibility changes (user returns to app)
    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          checkForDayGroupMatches()
        }
      }

      onMounted(() => {
        document.addEventListener('visibilitychange', handleVisibility)
      })

      onUnmounted(() => {
        document.removeEventListener('visibilitychange', handleVisibility)
      })
    }
  }

  /**
   * Initialize the day-group suggestion system
   */
  const initialize = () => {
    setupDateTransitionWatcher()

    // Initial check after a short delay (wait for stores to load)
    setTimeout(() => {
      checkForDayGroupMatches()
    }, 1000)
  }

  return {
    checkForDayGroupMatches,
    initialize
  }
}
