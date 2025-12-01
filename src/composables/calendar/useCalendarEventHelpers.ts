import { useCalendarCore } from '@/composables/useCalendarCore'

/**
 * Legacy wrapper for useCalendarEventHelpers
 * Re-exports core utilities for backward compatibility
 */
export function useCalendarEventHelpers() {
  const core = useCalendarCore()

  return {
    // Re-export all core utilities with same interface
    getDateString: core.getDateString,
    formatHour: core.formatHour,
    formatEventTime: core.formatEventTime,
    getPriorityColor: core.getPriorityColor,
    getPriorityClass: core.getPriorityClass,
    getPriorityLabel: core.getPriorityLabel,
    getTaskStatus: core.getTaskStatus,
    getStatusLabel: core.getStatusLabel,
    getStatusIcon: core.getStatusIcon,
    cycleTaskStatus: core.cycleTaskStatus,
    getTaskProject: core.getTaskProject,
    getProjectColor: core.getProjectColor,
    getProjectEmoji: core.getProjectEmoji,
    getProjectName: core.getProjectName
  }
}

// Re-export types for backward compatibility
export type { CalendarEvent } from '@/composables/useCalendarCore'
