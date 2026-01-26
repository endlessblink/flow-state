import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
// TASK-144: Use centralized duration categories
import { type DurationCategory, matchesDurationCategory } from '@/utils/durationCategories'

export function useInboxFiltering() {
    const taskStore = useTaskStore()

    // Filter state
    const activeTimeFilter = ref<'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'>('all')
    const unscheduledOnly = ref(false)
    const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
    const selectedProject = ref<string | null>(null)
    const selectedDuration = ref<DurationCategory | null>(null)

    // Helper functions for date calculations
    const getToday = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return today
    }

    const getTomorrow = () => {
        const tomorrow = new Date(getToday())
        tomorrow.setDate(tomorrow.getDate() + 1)
        return tomorrow
    }

    // TASK-1089: Use calendar week ending at Sunday 00:00 (exclusive)
    const getWeekEnd = () => {
        const today = getToday()
        const dayOfWeek = today.getDay()
        // When today is Sunday (0), we want NEXT Sunday (7 days away)
        // When today is Monday (1), we want this Sunday (6 days away)
        const daysUntilSunday = dayOfWeek === 0 ? 7 : (7 - dayOfWeek)
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + daysUntilSunday)
        return weekEnd
    }

    // TASK-1089: Use calendar week (include overdue + tasks until Sunday 00:00)
    const isThisWeek = (dateStr?: string) => {
        if (!dateStr) return false
        const weekEnd = getWeekEnd()
        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)
        // Include overdue tasks and tasks due before Sunday
        return date < weekEnd
    }

    const hasDate = (task: Task) => {
        // Check dueDate first (set via context menu)
        if (task.dueDate) return true
        // Check instances (new format)
        if (task.instances && task.instances.length > 0) {
            return task.instances.some((inst) => inst.scheduledDate)
        }
        // Fallback to legacy scheduledDate
        return !!task.scheduledDate
    }

    const isScheduledOnCalendar = (task: Task): boolean => {
        if (!task.instances || task.instances.length === 0) return false
        return task.instances.some((inst) => inst.scheduledDate)
    }

    // Get ONLY inbox tasks (tasks without canvas position, excluding done tasks)
    const baseInboxTasks = computed(() =>
        taskStore.filteredTasks.filter(task =>
            !task.canvasPosition && task.status !== 'done'
        )
    )

    // Check if task is scheduled/due for a specific date
    const isTaskForDate = (task: Task, dateStr: string): boolean => {
        // Check dueDate first (set via context menu "Set Due Date")
        if (task.dueDate === dateStr) return true
        // Check instances (calendar scheduling)
        if (task.instances && task.instances.length > 0) {
            if (task.instances.some((inst) => inst.scheduledDate === dateStr)) return true
        }
        // Check legacy scheduledDate
        if (task.scheduledDate === dateStr) return true
        return false
    }

    // Count tasks scheduled/due for today
    const todayCount = computed(() => {
        const todayStr = getToday().toISOString().split('T')[0]
        return baseInboxTasks.value.filter(task => isTaskForDate(task, todayStr)).length
    })

    // Apply time-based filtering
    const timeFilteredTasks = computed(() => {
        const tasks = baseInboxTasks.value

        switch (activeTimeFilter.value) {
            case 'all':
                return tasks

            case 'today':
            case 'now': {
                // BUG-046 FIX: Check dueDate, instances, AND scheduledDate
                const today = getToday().toISOString().split('T')[0]
                return tasks.filter(task => isTaskForDate(task, today))
            }

            case 'tomorrow': {
                const tomorrow = getTomorrow().toISOString().split('T')[0]
                return tasks.filter(task => isTaskForDate(task, tomorrow))
            }

            case 'thisWeek':
                return tasks.filter(task => {
                    // Check dueDate
                    if (isThisWeek(task.dueDate)) return true
                    // Check instances
                    if (task.instances && task.instances.length > 0) {
                        if (task.instances.some((inst) => isThisWeek(inst.scheduledDate))) return true
                    }
                    // Check legacy scheduledDate
                    if (isThisWeek(task.scheduledDate)) return true
                    return false
                })

            case 'noDate':
                return tasks.filter(task => !hasDate(task))

            default:
                return tasks
        }
    })

    // Apply additional filters (Unscheduled, Priority, Project, Duration)
    const inboxTasks = computed(() => {
        let tasks = timeFilteredTasks.value

        if (unscheduledOnly.value) {
            tasks = tasks.filter(task => !isScheduledOnCalendar(task))
        }

        if (selectedPriority.value !== null) {
            tasks = tasks.filter(task => task.priority === selectedPriority.value)
        }

        if (selectedProject.value !== null) {
            if (selectedProject.value === 'none') {
                tasks = tasks.filter(task => !task.projectId)
            } else {
                tasks = tasks.filter(task => task.projectId === selectedProject.value)
            }
        }

        // TASK-144: Use centralized duration matching
        if (selectedDuration.value !== null) {
            tasks = tasks.filter(task =>
                matchesDurationCategory(task.estimatedDuration, selectedDuration.value!)
            )
        }

        return tasks
    })

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        selectedPriority.value = null
        selectedProject.value = null
        selectedDuration.value = null
    }

    return {
        activeTimeFilter,
        unscheduledOnly,
        selectedPriority,
        selectedProject,
        selectedDuration,
        baseInboxTasks,
        todayCount,
        inboxTasks,
        clearAllFilters
    }
}
