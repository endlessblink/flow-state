import { ref, computed } from 'vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
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
    // TASK-1246: Multi-select filters with persistence (array-backed for JSON-safe, Set API via computed)
    const _selectedPriorities = usePersistentRef<string[]>('flowstate:cal-inbox-priority-filters', [])
    const _selectedProjects = usePersistentRef<string[]>('flowstate:cal-inbox-project-filters', [])
    const _selectedDurations = usePersistentRef<string[]>('flowstate:cal-inbox-duration-filters', [])

    const selectedPriorities = computed({
        get: () => new Set(_selectedPriorities.value),
        set: (val: Set<string>) => { _selectedPriorities.value = Array.from(val) }
    })
    const selectedProjects = computed({
        get: () => new Set(_selectedProjects.value),
        set: (val: Set<string>) => { _selectedProjects.value = Array.from(val) }
    })
    const selectedDurations = computed({
        get: () => new Set<DurationCategory>(_selectedDurations.value as DurationCategory[]),
        set: (val: Set<DurationCategory>) => { _selectedDurations.value = Array.from(val) }
    })
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // TASK-1075: Search query
    const searchQuery = ref('')

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
            selectedPriorities.value.size > 0 ||
            selectedProjects.value.size > 0 ||
            selectedDurations.value.size > 0 ||
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

        // TASK-1246: Multi-select filters (OR within each)
        if (selectedPriorities.value.size > 0) {
            tasks = tasks.filter(task => selectedPriorities.value.has(task.priority ?? ''))
        }

        if (selectedProjects.value.size > 0) {
            tasks = tasks.filter(task => {
                if (selectedProjects.value.has('none') && !task.projectId) return true
                return selectedProjects.value.has(task.projectId ?? '')
            })
        }

        if (selectedDurations.value.size > 0) {
            const durCats = Array.from(selectedDurations.value)
            tasks = tasks.filter(task =>
                durCats.some(cat => matchesDurationCategory(task.estimatedDuration, cat))
            )
        }

        // TASK-1075: Search Filter (title and description)
        if (searchQuery.value.trim()) {
            const query = searchQuery.value.toLowerCase().trim()
            tasks = tasks.filter(task => {
                const titleMatch = task.title?.toLowerCase().includes(query)
                const descMatch = task.description?.toLowerCase().includes(query)
                return titleMatch || descMatch
            })
        }

        return tasks
    })

    // --- Actions ---

    const toggleHideDoneTasks = () => {
        taskStore.toggleCalendarDoneTasks()
    }

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        selectedPriorities.value = new Set()
        selectedProjects.value = new Set()
        selectedDurations.value = new Set()
        selectedCanvasGroups.value = new Set()
        searchQuery.value = '' // TASK-1075
    }

    return {
        // State
        isCollapsed,
        showTodayOnly,
        showAdvancedFilters,
        unscheduledOnly,
        selectedPriorities,
        selectedProjects,
        selectedDurations,
        selectedCanvasGroups,
        searchQuery, // TASK-1075

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
