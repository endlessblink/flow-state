/**
 * Group Settings Composable
 *
 * Handles auto-fill logic for group settings based on keywords detected in group names.
 * Works with the unified groups system where all groups can have assignOnDrop settings.
 */

import { computed, ref, watch } from 'vue'
import { detectPowerKeyword, type PowerKeywordResult } from './useTaskSmartGroups'
import type { AssignOnDropSettings, CollectFilterSettings } from '@/stores/canvas'
// TASK-144: Use centralized duration defaults
import { DURATION_DEFAULTS, type DurationCategory } from '@/utils/durationCategories'

/**
 * Format date key as YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Resolve a smart date value (like 'today', 'tomorrow') to an actual date string
 */
export function resolveDueDate(dueDateValue: string | null | undefined): string | null {
  if (!dueDateValue) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (dueDateValue.toLowerCase()) {
    case 'today':
      return formatDateKey(today)

    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return formatDateKey(tomorrow)
    }

    case 'this_week':
    case 'this week': {
      // End of this week (Sunday)
      const endOfWeek = new Date(today)
      const dayOfWeek = today.getDay()
      const daysUntilSunday = (7 - dayOfWeek) % 7 || 7
      endOfWeek.setDate(today.getDate() + daysUntilSunday)
      return formatDateKey(endOfWeek)
    }

    case 'this_weekend':
    case 'this weekend': {
      // Saturday of this week
      const saturday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
      saturday.setDate(today.getDate() + daysUntilSaturday)
      return formatDateKey(saturday)
    }

    case 'later':
      // "Later" is a special case - returns empty string to indicate indefinite
      return ''

    default:
      // If it's already a date string (YYYY-MM-DD format), return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
        return dueDateValue
      }
      return null
  }
}

/**
 * Get human-readable description of assignOnDrop settings
 */
export function getSettingsDescription(settings: AssignOnDropSettings | undefined): string {
  if (!settings) return ''

  const parts: string[] = []

  if (settings.priority) {
    parts.push(`Priority: ${settings.priority.charAt(0).toUpperCase() + settings.priority.slice(1)}`)
  }
  if (settings.status) {
    const statusLabel = settings.status.replace('_', ' ')
    parts.push(`Status: ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`)
  }
  if (settings.dueDate) {
    const dateLabel = settings.dueDate.replace('_', ' ')
    parts.push(`Due: ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`)
  }
  if (settings.projectId) {
    parts.push('Project assigned')
  }
  if (settings.estimatedDuration !== undefined && settings.estimatedDuration !== null) {
    const d = settings.estimatedDuration
    let label = ''
    if (d === 15) label = 'Quick (<15m)'
    else if (d === 30) label = 'Short (15-30m)'
    else if (d === 60) label = 'Medium (30-60m)'
    else if (d === 120) label = 'Long (>60m)'
    else label = `${d}m`
    parts.push(`Duration: ${label}`)
  } else if (settings.estimatedDuration === null) {
    // This case might be used if we explicitly want to clear duration, but usually we just don't include it.
    // However, if we want to show 'Unestimated' as a set property:
  }

  return parts.join(', ')
}

/**
 * Composable for managing group settings with auto-fill from keywords
 */
export function useGroupSettings() {
  /**
   * Auto-fill assignOnDrop settings based on section name
   * Detects keywords like "Today", "High Priority", "Done" and returns appropriate settings
   */
  function getAutoFilledSettings(sectionName: string): AssignOnDropSettings {
    const keyword = detectPowerKeyword(sectionName)
    if (!keyword) return {}

    const settings: AssignOnDropSettings = {}

    switch (keyword.category) {
      case 'date':
        settings.dueDate = keyword.value
        break
      case 'priority':
        settings.priority = keyword.value as 'high' | 'medium' | 'low'
        break
      case 'status':
        settings.status = keyword.value as AssignOnDropSettings['status']
        break
      case 'duration': {
        // TASK-144: Use centralized duration defaults
        const d = keyword.value as DurationCategory
        if (d === 'unestimated') {
          settings.estimatedDuration = null // Use null to indicate "clear duration"
        } else {
          settings.estimatedDuration = DURATION_DEFAULTS[d]
        }
        break
      }
    }

    return settings
  }

  /**
   * Auto-fill collectFilter settings based on section name
   * Mirrors assignOnDrop logic - sections that assign a property should also collect matching tasks
   */
  function getAutoFilledCollectFilter(sectionName: string): CollectFilterSettings {
    const keyword = detectPowerKeyword(sectionName)
    if (!keyword) return {}

    const filter: CollectFilterSettings = {}

    switch (keyword.category) {
      case 'date':
        filter.matchDueDate = keyword.value as CollectFilterSettings['matchDueDate']
        break
      case 'priority':
        filter.matchPriority = keyword.value as 'high' | 'medium' | 'low'
        break
      case 'status':
        filter.matchStatus = keyword.value as CollectFilterSettings['matchStatus']
        break
      case 'duration':
        filter.matchDuration = keyword.value // 'quick', 'short', etc.
        break
    }

    return filter
  }

  /**
   * Create a reactive section settings manager
   * Watches the section name and auto-fills settings when keywords are detected
   */
  function createSettingsManager(initialName: string = '') {
    const sectionName = ref(initialName)
    const detectedKeyword = ref<PowerKeywordResult | null>(null)

    // Settings with explicit user overrides
    const assignOnDrop = ref<AssignOnDropSettings>({})
    const collectFilter = ref<CollectFilterSettings>({})

    // Track if settings were manually modified (to prevent auto-fill from overwriting)
    const manuallyModified = ref(false)

    // Watch section name and auto-fill settings when keywords detected
    watch(sectionName, (newName) => {
      const keyword = detectPowerKeyword(newName)
      detectedKeyword.value = keyword

      // Only auto-fill if not manually modified
      if (!manuallyModified.value && keyword) {
        assignOnDrop.value = getAutoFilledSettings(newName)
        collectFilter.value = getAutoFilledCollectFilter(newName)
      }
    }, { immediate: true })

    // Computed for UI display
    const settingsDescription = computed(() => getSettingsDescription(assignOnDrop.value))
    const hasSettings = computed(() => Object.keys(assignOnDrop.value).length > 0)

    return {
      sectionName,
      detectedKeyword,
      assignOnDrop,
      collectFilter,
      manuallyModified,
      settingsDescription,
      hasSettings,

      // Methods
      updateAssignOnDrop(updates: Partial<AssignOnDropSettings>) {
        assignOnDrop.value = { ...assignOnDrop.value, ...updates }
        manuallyModified.value = true
      },

      updateCollectFilter(updates: Partial<CollectFilterSettings>) {
        collectFilter.value = { ...collectFilter.value, ...updates }
        manuallyModified.value = true
      },

      resetToAutoFill() {
        manuallyModified.value = false
        assignOnDrop.value = getAutoFilledSettings(sectionName.value)
        collectFilter.value = getAutoFilledCollectFilter(sectionName.value)
      },

      clearSettings() {
        assignOnDrop.value = {}
        collectFilter.value = {}
        manuallyModified.value = true
      }
    }
  }

  return {
    getAutoFilledSettings,
    getAutoFilledCollectFilter,
    resolveDueDate,
    getSettingsDescription,
    createSettingsManager
  }
}

export type GroupSettingsManager = ReturnType<ReturnType<typeof useGroupSettings>['createSettingsManager']>
