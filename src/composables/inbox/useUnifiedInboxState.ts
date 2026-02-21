
import { ref, computed, watch } from 'vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useSmartViews } from '@/composables/useSmartViews'
import { useCanvasGroupMembership } from '@/composables/canvas/useCanvasGroupMembership'
// TASK-144: Use centralized duration categories
import { type DurationCategory, matchesDurationCategory } from '@/utils/durationCategories'

export interface InboxContextProps {
    context: 'calendar' | 'canvas' | 'standalone'
    hideDoneTasks?: boolean
}

export type TimeFilterType = 'all' | 'today' | 'next3days' | 'week' | 'month'
export type SortByType = 'newest' | 'priority' | 'dueDate' | 'canvasOrder'

export function useUnifiedInboxState(props: InboxContextProps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { isTodayTask, isNext3DaysTask, isWeekTask, isThisMonthTask } = useSmartViews()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()

    // --- Core Filter State ---
    // TASK-1215: Persist inbox open/closed per context (canvas vs calendar)
    const isCollapsed = usePersistentRef<boolean>(`flowstate:inbox-collapsed-${props.context}`, false)
    // BUG-1051: Persist filter (TASK-1215: upgraded to Tauri-aware persistence)
    const activeTimeFilter = usePersistentRef<TimeFilterType>('flowstate:inbox-time-filter', 'all', 'canvas-inbox-time-filter')

    // --- Advanced Filter State (TASK-1215: Persist across restarts via Tauri store + localStorage) ---
    const showAdvancedFilters = usePersistentRef<boolean>('flowstate:inbox-advanced-filters', false)
    const unscheduledOnly = usePersistentRef<boolean>('flowstate:inbox-unscheduled-only', false)
    // TASK-1246: Multi-select filters (array-backed for JSON-safe persistence, Set API via computed)
    const _selectedPriorities = usePersistentRef<string[]>('flowstate:inbox-priority-filters', [])
    const _selectedProjects = usePersistentRef<string[]>('flowstate:inbox-project-filters', [])
    const _selectedDurations = usePersistentRef<string[]>('flowstate:inbox-duration-filters', [])

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

    // TASK-1073: Sort state (TASK-1215: upgraded to Tauri-aware persistence)
    const sortBy = usePersistentRef<SortByType>('flowstate:inbox-sort-by', 'newest', 'inbox-sort-by')

    // TASK-1075: Search query
    const searchQuery = ref('')

    // TASK-106: Canvas group filter (primary filter)
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // --- Done Tasks Filter ---
    // showDoneOnly = false: Show active tasks (non-done)
    // showDoneOnly = true: Show ONLY done tasks
    const showDoneOnly = usePersistentRef<boolean>('flowstate:inbox-show-done', false)
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
    // BUG-1351: Calendar inbox must NOT be affected by board-level smart view/status/duration
    // filters. Use calendarFilteredTasks (project + hide-done only) for calendar context.
    const baseInboxTasks = computed(() => {
        const sourceTasks = props.context === 'calendar'
            ? taskStore.calendarFilteredTasks
            : taskStore.filteredTasks
        return sourceTasks.filter(task => {
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

            // 3. isInInbox gate — both inboxes only show tasks flagged as inbox
            // Tasks are removed from inbox explicitly, NOT by being placed on canvas/calendar
            if (!task.isInInbox) return false

            // 4. Context Specific Rules (cross-context independent)
            // Canvas inbox does NOT filter by calendar scheduling, and vice versa
            if (props.context === 'calendar') {
                // CALENDAR INBOX: Hide tasks already scheduled on the calendar grid
                const isScheduledOnCalendar = task.instances &&
                    task.instances.length > 0 &&
                    task.instances.some(inst => inst.scheduledDate)
                return !isScheduledOnCalendar
            } else {
                // CANVAS INBOX: Hide tasks already placed on the canvas
                return !task.canvasPosition
            }
        })
    })

    const todayCount = computed(() => {
        return baseInboxTasks.value.filter(task => isTodayTask(task)).length
    })

    const next3DaysCount = computed(() => {
        return baseInboxTasks.value.filter(task => isNext3DaysTask(task)).length
    })

    const weekCount = computed(() => {
        return baseInboxTasks.value.filter(task => isWeekTask(task)).length
    })

    const monthCount = computed(() => {
        return baseInboxTasks.value.filter(task => isThisMonthTask(task)).length
    })

    // Done task count (for the visible Done toggle badge)
    // Counts tasks in inbox that are done (before the done filter is applied)
    // BUG-1351: Use same source as baseInboxTasks
    const doneTaskCount = computed(() => {
        const sourceTasks = props.context === 'calendar'
            ? taskStore.calendarFilteredTasks
            : taskStore.filteredTasks
        return sourceTasks.filter(task => {
            // Must be a done task
            if (task.status !== 'done') return false
            // Must not be soft deleted
            if (task._soft_deleted) return false
            // Must be in inbox
            if (!task.isInInbox) return false
            // Must be an inbox task (not on canvas/calendar)
            if (props.context === 'calendar') {
                // BUG-1351: Match baseInboxTasks logic
                const isScheduledOnCalendar = task.instances &&
                    task.instances.length > 0 &&
                    task.instances.some(inst => inst.scheduledDate)
                return !isScheduledOnCalendar
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
        } else if (activeTimeFilter.value === 'next3days') {
            tasks = tasks.filter(task => isNext3DaysTask(task))
        } else if (activeTimeFilter.value === 'week') {
            tasks = tasks.filter(task => isWeekTask(task))
        } else if (activeTimeFilter.value === 'month') {
            tasks = tasks.filter(task => isThisMonthTask(task))
        }

        // 3. Unscheduled Filter
        if (unscheduledOnly.value) {
            tasks = tasks.filter(task => !isScheduledOnCalendar(task))
        }

        // 4. Priority Filter (TASK-1246: multi-select, OR within)
        if (selectedPriorities.value.size > 0) {
            tasks = tasks.filter(task => selectedPriorities.value.has(task.priority ?? ''))
        }

        // 5. Project Filter (TASK-1246: multi-select, OR within, handles 'none' sentinel)
        if (selectedProjects.value.size > 0) {
            tasks = tasks.filter(task => {
                if (selectedProjects.value.has('none') && !task.projectId) return true
                return selectedProjects.value.has(task.projectId ?? '')
            })
        }

        // 6. Duration Filter (TASK-1246: multi-select, OR within)
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

        // TASK-1073: Apply sorting
        const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 }

        tasks = [...tasks].sort((a, b) => {
            switch (sortBy.value) {
                case 'priority': {
                    // High priority first
                    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                    if (aPriority !== bPriority) return aPriority - bPriority
                    // Secondary: newest first
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                }

                case 'dueDate': {
                    // Tasks with due dates first, then by due date
                    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
                    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
                    if (aDue !== bDue) return aDue - bDue
                    // Secondary: newest first
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                }

                case 'canvasOrder': {
                    // TASK-1303: Sort by group column (left→right), then top→bottom within group
                    const groups = canvasStore.groups || []
                    const aGroup = a.parentId ? groups.find(g => g.id === a.parentId) : null
                    const bGroup = b.parentId ? groups.find(g => g.id === b.parentId) : null
                    const aGroupX = aGroup?.position?.x ?? Infinity
                    const bGroupX = bGroup?.position?.x ?? Infinity
                    if (aGroupX !== bGroupX) return aGroupX - bGroupX
                    // Within same group: sort by task Y (top to bottom)
                    const aPos = a.canvasPosition
                    const bPos = b.canvasPosition
                    if (!aPos && !bPos) return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    if (!aPos) return 1
                    if (!bPos) return -1
                    if (aPos.y !== bPos.y) return aPos.y - bPos.y
                    if (aPos.x !== bPos.x) return aPos.x - bPos.x
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                }

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
        selectedPriorities.value = new Set()
        selectedProjects.value = new Set()
        selectedDurations.value = new Set()
        activeTimeFilter.value = 'all'
        selectedCanvasGroups.value = new Set()
        searchQuery.value = '' // TASK-1075
    }

    // FEATURE-254: Canvas Inbox Smart Minimization
    // Logic: Auto-collapse if empty on load, respect persisted preference otherwise
    const hasInitialized = ref(false)

    watch(() => [taskStore.isLoadingFromDatabase, inboxTasks.value.length], ([isLoading, count]) => {
        // Only run initialization once, when DB load finishes
        if (!isLoading && !hasInitialized.value && props.context === 'canvas') {
            const taskCount = count as number

            if (taskCount === 0) {
                isCollapsed.value = true
                console.log('[UnifiedInbox] Smart Minimization: Empty on load -> Collapsed')
            }
            // TASK-1215: If tasks exist, respect persisted isCollapsed value (don't override)

            hasInitialized.value = true
        }
    }, { immediate: true })

    return {
        // State
        isCollapsed,
        activeTimeFilter,
        showAdvancedFilters,
        unscheduledOnly,
        selectedPriorities,
        selectedProjects,
        selectedDurations,
        selectedCanvasGroups,
        currentHideDoneTasks,
        sortBy, // TASK-1073
        searchQuery, // TASK-1075

        // Computed (State)
        canvasGroupOptions,
        baseInboxTasks,
        inboxTasks,
        todayCount,
        next3DaysCount,
        weekCount,
        monthCount,
        doneTaskCount,

        // Actions (State Mutators)
        toggleHideDoneTasks,
        clearAllFilters
    }
}
