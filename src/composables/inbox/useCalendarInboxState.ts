import { ref, computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasGroupMembership } from '@/composables/canvas/useCanvasGroupMembership'
import { type DurationCategory, matchesDurationCategory } from '@/utils/durationCategories'

export function useCalendarInboxState() {
    const taskStore = useTaskStore()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()

    // --- State ---
    const isCollapsed = ref(false)
    const showTodayOnly = ref(false)

    // Advanced Filters
    const showAdvancedFilters = ref(false)
    const unscheduledOnly = ref(false)
    const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
    const selectedProject = ref<string | null>(null)
    const selectedDuration = ref<DurationCategory | null>(null)
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // --- Computed ---

    // TASK-076: Get calendar-specific hide done filter from store
    const hideCalendarDoneTasks = computed(() => taskStore.hideCalendarDoneTasks)

    // Canvas group options for dropdown
    const canvasGroupOptions = computed(() => {
        const options = [
            { label: 'All Tasks', value: '' }
        ]

        groupsWithCounts.value.forEach(group => {
            options.push({
                label: `${group.name} (${group.taskCount})`,
                value: group.id
            })
        })

        return options
    })

    // Helper: Get today's date string
    const getTodayStr = () => new Date().toISOString().split('T')[0]

    // Helper: Check if task is scheduled
    const isScheduledOnCalendar = (task: Task): boolean => {
        if (!task.instances || task.instances.length === 0) return false
        return task.instances.some(inst => inst.scheduledDate)
    }

    // Base Inbox Tasks (Respects store filters + calendar specific logic)
    const baseInboxTasks = computed(() => {
        return taskStore.filteredTasks.filter(task => {
            if (hideCalendarDoneTasks.value && task.status === 'done') return false
            return !isScheduledOnCalendar(task)
        })
    })

    // Count tasks due today
    const todayCount = computed(() => {
        const todayStr = getTodayStr()
        return baseInboxTasks.value.filter(task => task.dueDate === todayStr).length
    })

    // Active filters check
    const hasActiveFilters = computed(() => {
        return showTodayOnly.value ||
            unscheduledOnly.value ||
            selectedPriority.value !== null ||
            selectedProject.value !== null ||
            selectedDuration.value !== null ||
            (selectedCanvasGroups.value.size > 0)
    })

    // Final Filtered Inbox Tasks
    const inboxTasks = computed(() => {
        let tasks = baseInboxTasks.value

        // 1. Canvas Group Filter (Primary)
        if (selectedCanvasGroups.value.size > 0) {
            const groupIds = Array.from(selectedCanvasGroups.value)
            tasks = tasks.filter(task =>
                groupIds.some(groupId => filterTasksByGroup([task], groupId).length > 0)
            )
        }

        // 2. Today Filter
        if (showTodayOnly.value) {
            const todayStr = getTodayStr()
            tasks = tasks.filter(task => task.dueDate === todayStr)
        }

        // 3. Advanced Filters
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
            tasks = tasks.filter(task =>
                matchesDurationCategory(task.estimatedDuration, selectedDuration.value!)
            )
        }

        return tasks
    })

    // --- Actions ---

    const toggleHideDoneTasks = () => {
        taskStore.toggleCalendarDoneTasks()
    }

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        selectedPriority.value = null
        selectedProject.value = null
        selectedDuration.value = null
        selectedCanvasGroups.value = new Set()
    }

    return {
        // State
        isCollapsed,
        showTodayOnly,
        showAdvancedFilters,
        unscheduledOnly,
        selectedPriority,
        selectedProject,
        selectedDuration,
        selectedCanvasGroups,

        // Computed
        hideCalendarDoneTasks,
        canvasGroupOptions,
        baseInboxTasks,
        inboxTasks,
        todayCount,
        hasActiveFilters,

        // Methods
        toggleHideDoneTasks,
        clearAllFilters
    }
}
