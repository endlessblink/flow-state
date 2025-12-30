import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'

export function useInboxFiltering() {
    const taskStore = useTaskStore()

    // Filter state
    const activeTimeFilter = ref<'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'>('all')
    const unscheduledOnly = ref(false)
    const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
    const selectedProject = ref<string | null>(null)
    const selectedDuration = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)

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

    const getWeekEnd = () => {
        const weekEnd = new Date(getToday())
        weekEnd.setDate(weekEnd.getDate() + 7)
        return weekEnd
    }

    const isThisWeek = (dateStr?: string) => {
        if (!dateStr) return false
        const today = getToday()
        const weekEnd = getWeekEnd()
        const date = new Date(dateStr)
        date.setHours(0, 0, 0, 0)
        return date >= today && date < weekEnd
    }

    const hasDate = (task: Task) => {
        // Check instances first (new format)
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

    // Count tasks scheduled for today
    const todayCount = computed(() => {
        const todayStr = getToday().toISOString().split('T')[0]
        return baseInboxTasks.value.filter(task => {
            if (task.instances && task.instances.length > 0) {
                return task.instances.some((inst) => inst.scheduledDate === todayStr)
            }
            return task.scheduledDate === todayStr
        }).length
    })

    // Apply time-based filtering
    const timeFilteredTasks = computed(() => {
        const tasks = baseInboxTasks.value

        switch (activeTimeFilter.value) {
            case 'all':
                return tasks

            case 'now': {
                const today = getToday().toISOString().split('T')[0]
                return tasks.filter(task => {
                    if (task.instances && task.instances.length > 0) {
                        if (task.instances.some((inst) => inst.scheduledDate === today)) return true
                    }
                    if (task.scheduledDate === today) return true
                    return false
                })
            }

            case 'tomorrow': {
                const tomorrow = getTomorrow().toISOString().split('T')[0]
                return tasks.filter(task => {
                    if (task.instances && task.instances.length > 0) {
                        if (task.instances.some((inst) => inst.scheduledDate === tomorrow)) return true
                    }
                    if (task.scheduledDate === tomorrow) return true
                    return false
                })
            }

            case 'thisWeek':
                return tasks.filter(task => {
                    if (task.instances && task.instances.length > 0) {
                        if (task.instances.some((inst) => isThisWeek(inst.scheduledDate))) return true
                    }
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

        if (selectedDuration.value !== null) {
            tasks = tasks.filter(task => {
                const d = task.estimatedDuration
                if (selectedDuration.value === 'unestimated') return !d
                if (!d) return false

                switch (selectedDuration.value) {
                    case 'quick': return d <= 15
                    case 'short': return d > 15 && d <= 30
                    case 'medium': return d > 30 && d <= 60
                    case 'long': return d > 60
                    default: return false
                }
            })
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
