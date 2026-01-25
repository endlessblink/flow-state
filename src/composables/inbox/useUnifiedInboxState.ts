
import { ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useSmartViews } from '@/composables/useSmartViews'
import { useCanvasGroupMembership } from '@/composables/canvas/useCanvasGroupMembership'
// TASK-144: Use centralized duration categories
import { type DurationCategory, matchesDurationCategory } from '@/utils/durationCategories'

export interface InboxContextProps {
    context: 'calendar' | 'canvas' | 'standalone'
    hideDoneTasks?: boolean
}

export type TimeFilterType = 'all' | 'today' | 'week' | 'month'
export type SortByType = 'newest' | 'priority' | 'dueDate'

export function useUnifiedInboxState(props: InboxContextProps) {
    const taskStore = useTaskStore()
    const { isTodayTask, isWeekTask, isThisMonthTask } = useSmartViews()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()

    // --- Core Filter State ---
    const isCollapsed = ref(false)
    // BUG-1051: Persist filter to localStorage so it survives refresh
    const activeTimeFilter = useStorage<TimeFilterType>('canvas-inbox-time-filter', 'all')

    // --- Advanced Filter State ---
    const showAdvancedFilters = ref(false)
    const unscheduledOnly = ref(false)
    const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
    const selectedProject = ref<string | null>(null)
    const selectedDuration = ref<DurationCategory | null>(null)

    // TASK-1073: Sort state (persisted)
    const sortBy = useStorage<SortByType>('inbox-sort-by', 'newest')

    // TASK-1075: Search query
    const searchQuery = ref('')

    // TASK-106: Canvas group filter (primary filter)
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // --- Done Tasks Filter ---
    // showDoneOnly = false: Show active tasks (non-done)
    // showDoneOnly = true: Show ONLY done tasks
    const showDoneOnly = ref(false)
    // For backwards compatibility with prop name
    const currentHideDoneTasks = computed(() => !showDoneOnly.value)
    const toggleHideDoneTasks = () => {
        showDoneOnly.value = !showDoneOnly.value
    }

    interface GroupOption {
        label: string
        value: string
        color?: string
        count?: number
    }

    // --- Canvas Group Options ---
    const canvasGroupOptions = computed((): GroupOption[] => {
        const options: GroupOption[] = [
            { label: 'All', value: '', color: undefined }
        ]

        groupsWithCounts.value.forEach(group => {
            options.push({
                label: group.name,
                value: group.id,
                color: group.color || '#4ecdc4',
                count: group.taskCount
            })
        })

        return options
    })

    // --- Filter Logic ---

    // Base Inbox Tasks (Filtered by global rules + context rules)
    const baseInboxTasks = computed(() => {
        return taskStore.filteredTasks.filter(task => {
            // 1. Done/Active filter (exclusive - show one OR the other)
            const isDone = task.status === 'done'
            if (showDoneOnly.value) {
                // Show ONLY done tasks
                if (!isDone) return false
            } else {
                // Show ONLY active tasks (hide done)
                if (isDone) return false
            }

            // 2. Soft Deleted check (Safety)
            if (task._soft_deleted) {
                return false
            }

            // 3. Context Specific Rules
            if (props.context === 'calendar') {
                // CALENDAR INBOX: Show tasks NOT on the calendar grid
                const hasInstances = task.instances && task.instances.length > 0
                const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                    (task.scheduledTime && task.scheduledTime.trim() !== '')
                return !hasInstances && !hasLegacySchedule
            } else {
                // CANVAS INBOX: Show tasks NOT on the canvas
                // (Dec 16, 2025 FIX: ONLY check canvasPosition)
                return !task.canvasPosition
            }
        })
    })

    const todayCount = computed(() => {
        return baseInboxTasks.value.filter(task => isTodayTask(task)).length
    })

    const weekCount = computed(() => {
        return baseInboxTasks.value.filter(task => isWeekTask(task)).length
    })

    const monthCount = computed(() => {
        return baseInboxTasks.value.filter(task => isThisMonthTask(task)).length
    })

    // Done task count (for the visible Done toggle badge)
    // Counts tasks in inbox that are done (before the done filter is applied)
    const doneTaskCount = computed(() => {
        return taskStore.filteredTasks.filter(task => {
            // Must be a done task
            if (task.status !== 'done') return false
            // Must not be soft deleted
            if (task._soft_deleted) return false
            // Must be an inbox task (not on canvas/calendar)
            if (props.context === 'calendar') {
                const hasInstances = task.instances && task.instances.length > 0
                const hasLegacySchedule = (task.scheduledDate && task.scheduledDate.trim() !== '') &&
                    (task.scheduledTime && task.scheduledTime.trim() !== '')
                return !hasInstances && !hasLegacySchedule
            } else {
                return !task.canvasPosition
            }
        }).length
    })

    const isScheduledOnCalendar = (task: Task): boolean => {
        if (!task.instances || task.instances.length === 0) return false
        return task.instances.some(inst => inst.scheduledDate)
    }

    // Final Inbox Tasks (Apply all local filters)
    const inboxTasks = computed(() => {
        let tasks = baseInboxTasks.value

        // 1. Canvas Group Filter (Multi-select)
        if (selectedCanvasGroups.value.size > 0) {
            const groupIds = Array.from(selectedCanvasGroups.value)
            tasks = tasks.filter(task =>
                groupIds.some(groupId => filterTasksByGroup([task], groupId).length > 0)
            )
        }

        // 2. Time Filter
        if (activeTimeFilter.value === 'today') {
            tasks = tasks.filter(task => isTodayTask(task))
        } else if (activeTimeFilter.value === 'week') {
            tasks = tasks.filter(task => isWeekTask(task))
        } else if (activeTimeFilter.value === 'month') {
            tasks = tasks.filter(task => isThisMonthTask(task))
        }

        // 3. Unscheduled Filter
        if (unscheduledOnly.value) {
            tasks = tasks.filter(task => !isScheduledOnCalendar(task))
        }

        // 4. Priority Filter
        if (selectedPriority.value !== null) {
            tasks = tasks.filter(task => task.priority === selectedPriority.value)
        }

        // 5. Project Filter
        if (selectedProject.value !== null) {
            if (selectedProject.value === 'none') {
                tasks = tasks.filter(task => !task.projectId)
            } else {
                tasks = tasks.filter(task => task.projectId === selectedProject.value)
            }
        }

        // 6. Duration Filter
        if (selectedDuration.value !== null) {
            tasks = tasks.filter(task =>
                matchesDurationCategory(task.estimatedDuration, selectedDuration.value!)
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

        // TASK-1073: Apply sorting
        const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 }

        tasks = [...tasks].sort((a, b) => {
            switch (sortBy.value) {
                case 'priority':
                    // High priority first
                    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                    if (aPriority !== bPriority) return aPriority - bPriority
                    // Secondary: newest first
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()

                case 'dueDate':
                    // Tasks with due dates first, then by due date
                    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
                    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
                    if (aDue !== bDue) return aDue - bDue
                    // Secondary: newest first
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()

                case 'newest':
                default:
                    // Newest first (by createdAt)
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            }
        })

        return tasks
    })

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        selectedPriority.value = null
        selectedProject.value = null
        selectedDuration.value = null
        activeTimeFilter.value = 'all'
        selectedCanvasGroups.value = new Set()
        searchQuery.value = '' // TASK-1075
    }

    // FEATURE-254: Canvas Inbox Smart Minimization
    // Logic: Auto-collapse if empty on load, but respect manual toggles afterwards
    const hasInitialized = ref(false)

    watch(() => [taskStore.isLoadingFromDatabase, inboxTasks.value.length], ([isLoading, count]) => {
        // Only run initialization once, when DB load finishes
        if (!isLoading && !hasInitialized.value && props.context === 'canvas') {
            const taskCount = count as number

            if (taskCount === 0) {
                isCollapsed.value = true
                console.log('[UnifiedInbox] Smart Minimization: Empty on load -> Collapsed')
            } else {
                // Determine if we should be collapsed or expanded based on preference (or default expanded)
                // For now, default to expanded if tasks exist
                isCollapsed.value = false
                console.log('[UnifiedInbox] Smart Minimization: Has tasks -> Expanded')
            }

            hasInitialized.value = true
        }
    }, { immediate: true })

    return {
        // State
        isCollapsed,
        activeTimeFilter,
        showAdvancedFilters,
        unscheduledOnly,
        selectedPriority,
        selectedProject,
        selectedDuration,
        selectedCanvasGroups,
        currentHideDoneTasks,
        sortBy, // TASK-1073
        searchQuery, // TASK-1075

        // Computed (State)
        canvasGroupOptions,
        baseInboxTasks,
        inboxTasks,
        todayCount,
        weekCount,
        monthCount,
        doneTaskCount,

        // Actions (State Mutators)
        toggleHideDoneTasks,
        clearAllFilters
    }
}
