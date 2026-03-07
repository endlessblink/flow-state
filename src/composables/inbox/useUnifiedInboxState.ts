
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
export type SortDirection = 'asc' | 'desc'

export function useUnifiedInboxState(props: InboxContextProps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { isTodayTask, isNext3DaysTask, isWeekTask, isThisMonthTask } = useSmartViews()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()

    // --- Core Filter State ---
    // TASK-1215: Persist inbox open/closed per context (canvas vs calendar)
    const isCollapsed = usePersistentRef<boolean>(`flowstate:inbox-collapsed-${props.context}`, false)
    // BUG-1468: All filter keys are context-scoped so canvas/calendar inboxes are independent
    const ctx = props.context
    // BUG-1051: Persist filter (TASK-1215: upgraded to Tauri-aware persistence)
    const activeTimeFilter = usePersistentRef<TimeFilterType>(`flowstate:inbox-time-filter-${ctx}`, 'all', `${ctx}-inbox-time-filter`)

    // --- Advanced Filter State (TASK-1215: Persist across restarts via Tauri store + localStorage) ---
    const showAdvancedFilters = usePersistentRef<boolean>(`flowstate:inbox-advanced-filters-${ctx}`, false)
    const unscheduledOnly = usePersistentRef<boolean>(`flowstate:inbox-unscheduled-only-${ctx}`, false)
    const onCanvasOnly = usePersistentRef<boolean>(`flowstate:inbox-on-canvas-only-${ctx}`, false)

    // TASK-1246: Multi-select filters (array-backed for JSON-safe persistence, Set API via computed)
    const _selectedPriorities = usePersistentRef<string[]>(`flowstate:inbox-priority-filters-${ctx}`, [])
    const _selectedProjects = usePersistentRef<string[]>(`flowstate:inbox-project-filters-${ctx}`, [])
    const _selectedDurations = usePersistentRef<string[]>(`flowstate:inbox-duration-filters-${ctx}`, [])

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
    const sortBy = usePersistentRef<SortByType>(`flowstate:inbox-sort-by-${ctx}`, 'newest', `${ctx}-inbox-sort-by`)
    // TASK-1412: Sort direction state
    const sortDirection = usePersistentRef<SortDirection>(`flowstate:inbox-sort-direction-${ctx}`, 'asc', `${ctx}-inbox-sort-direction`)

    // TASK-1075: Search query
    const searchQuery = ref('')

    // TASK-106: Canvas group filter (primary filter)
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // --- Done Tasks Filter ---
    // showDoneOnly = false: Show active tasks (non-done)
    // showDoneOnly = true: Show ONLY done tasks
    const showDoneOnly = usePersistentRef<boolean>(`flowstate:inbox-show-done-${ctx}`, false)
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
            // BUG-1481: Calendar inbox should show canvas tasks regardless of sort order,
            // not just when canvasOrder sort is active. Tasks on the canvas are real tasks
            // that belong in the calendar inbox (unless scheduled on the calendar grid).
            const isOnCanvas = !!task.canvasPosition
            if (!task.isInInbox && !(props.context === 'calendar' && isOnCanvas)) {
                return false
            }

            // 4. Context Specific Rules (cross-context independent)
            // Canvas inbox does NOT filter by calendar scheduling, and vice versa
            if (props.context === 'calendar') {
                // TASK-1412: When canvasOrder sort is active, include ALL canvas tasks
                // regardless of calendar scheduling — the inbox should mirror the canvas.
                if (sortBy.value === 'canvasOrder' && isOnCanvas) {
                    // BUG-1429: Still exclude tasks scheduled on the calendar
                    const isScheduled = task.instances &&
                        task.instances.length > 0 &&
                        task.instances.some(inst => inst.scheduledDate)
                    return !isScheduled
                }

                if (import.meta.env.DEV && task.instances?.length) {
                    console.log(`[INBOX-FILTER] Task "${task.title?.slice(0,25)}" has ${task.instances.length} instances, isScheduled=${task.instances.some(inst => inst.scheduledDate)}`)
                }

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

    // TASK-1451: Recently created tasks bypass filters so they're visible immediately
    const recentlyCreatedTaskIds = ref<Set<string>>(new Set())

    const registerNewTask = (taskId: string) => {
        recentlyCreatedTaskIds.value = new Set([...recentlyCreatedTaskIds.value, taskId])
        setTimeout(() => {
            const next = new Set(recentlyCreatedTaskIds.value)
            next.delete(taskId)
            recentlyCreatedTaskIds.value = next
        }, 5000)
    }

    // Final Inbox Tasks (Apply all local filters)
    const inboxTasks = computed(() => {
        // Pull out recently created tasks before filtering
        const recentIds = recentlyCreatedTaskIds.value
        const recentTasks = recentIds.size > 0
            ? baseInboxTasks.value.filter(t => recentIds.has(t.id))
            : []

        let tasks = baseInboxTasks.value

        // 1. Canvas Group Filter (Multi-select)
        if (selectedCanvasGroups.value.size > 0) {
            const groupIds = Array.from(selectedCanvasGroups.value)
            tasks = tasks.filter(task =>
                groupIds.some(groupId => filterTasksByGroup([task], groupId).length > 0)
            )
        }

        // 2. Time Filter (skip when Unscheduled is active — dateless tasks can't match date ranges)
        if (!unscheduledOnly.value) {
            if (activeTimeFilter.value === 'today') {
                tasks = tasks.filter(task => isTodayTask(task))
            } else if (activeTimeFilter.value === 'next3days') {
                tasks = tasks.filter(task => isNext3DaysTask(task))
            } else if (activeTimeFilter.value === 'week') {
                tasks = tasks.filter(task => isWeekTask(task))
            } else if (activeTimeFilter.value === 'month') {
                tasks = tasks.filter(task => isThisMonthTask(task))
            }
        }

        // 3. Unscheduled Filter
        if (unscheduledOnly.value) {
            tasks = tasks.filter(task => !isScheduledOnCalendar(task))
        }

        // On Canvas filter — show only tasks placed on the canvas
        if (onCanvasOnly.value) {
            tasks = tasks.filter(task => !!task.canvasPosition)
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

        // TASK-1451: Merge back recently created tasks that were filtered out
        if (recentTasks.length > 0) {
            const existingIds = new Set(tasks.map(t => t.id))
            for (const t of recentTasks) {
                if (!existingIds.has(t.id)) {
                    tasks = [...tasks, t]
                }
            }
        }

        // TASK-1073 / TASK-1412: Apply sorting with direction support
        const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 }
        const dir = sortDirection.value === 'desc' ? -1 : 1

        if (sortBy.value === 'canvasOrder') {
            // TASK-1412: Right-to-left group ordering + connection-aware DFS within each group
            const groups = canvasStore.groups || []

            // Build a map of parentId → tasks for DFS bucketing
            const buckets = new Map<string | null, Task[]>()
            for (const task of tasks) {
                const key = task.parentId ?? null
                if (!buckets.has(key)) buckets.set(key, [])
                buckets.get(key)!.push(task)
            }

            // Sort groups by X DESCENDING (rightmost first = right-to-left)
            const sortedGroups = [...groups].sort((a, b) => (b.position?.x ?? 0) - (a.position?.x ?? 0))

            // DFS: push a task then recursively push its children (by parentTaskId), sorted by y
            const result: Task[] = []
            const visited = new Set<string>()

            const dfs = (task: Task) => {
                if (visited.has(task.id)) return
                visited.add(task.id)
                result.push(task)
                // Find children: tasks whose parentTaskId === task.id, within same canvas group bucket
                const siblings = buckets.get(task.parentId ?? null) ?? []
                const children = siblings
                    .filter(t => t.parentTaskId === task.id && !visited.has(t.id))
                    .sort((a, b) => (a.canvasPosition?.y ?? 0) - (b.canvasPosition?.y ?? 0))
                for (const child of children) dfs(child)
            }

            // Process grouped tasks (rightmost group first)
            for (const group of sortedGroups) {
                const bucket = buckets.get(group.id) ?? []
                // Root tasks in this group: parentTaskId is null/undefined or points outside this bucket
                const bucketIds = new Set(bucket.map(t => t.id))
                const roots = bucket
                    .filter(t => !t.parentTaskId || !bucketIds.has(t.parentTaskId))
                    .sort((a, b) => (a.canvasPosition?.y ?? 0) - (b.canvasPosition?.y ?? 0))
                for (const root of roots) dfs(root)
                // Catch any remaining (orphaned cycles or unvisited)
                for (const t of bucket) dfs(t)
            }

            // Ungrouped tasks (parentId is null/undefined) — same DFS logic
            const ungroupedBucket = buckets.get(null) ?? []
            const ungroupedIds = new Set(ungroupedBucket.map(t => t.id))
            const ungroupedRoots = ungroupedBucket
                .filter(t => !t.parentTaskId || !ungroupedIds.has(t.parentTaskId))
                .sort((a, b) => (a.canvasPosition?.y ?? 0) - (b.canvasPosition?.y ?? 0))
            for (const root of ungroupedRoots) dfs(root)
            for (const t of ungroupedBucket) dfs(t)

            // Catch tasks that weren't visited (edge cases: groups not in canvasStore.groups)
            for (const t of tasks) dfs(t)

            tasks = sortDirection.value === 'desc' ? result.reverse() : result
        } else {
            tasks = [...tasks].sort((a, b) => {
                switch (sortBy.value) {
                    case 'priority': {
                        // asc: high→low, desc: low→high
                        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                        if (aPriority !== bPriority) return dir * (aPriority - bPriority)
                        // Secondary: newest first (always)
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    }

                    case 'dueDate': {
                        // asc: earliest first, desc: latest first
                        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
                        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
                        if (aDue !== bDue) return dir * (aDue - bDue)
                        // Secondary: newest first (always)
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    }

                    case 'newest':
                    default: {
                        // asc: newest first, desc: oldest first
                        const aTime = new Date(a.createdAt || 0).getTime()
                        const bTime = new Date(b.createdAt || 0).getTime()
                        return dir * (bTime - aTime)
                    }
                }
            })
        }

        return tasks
    })

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        onCanvasOnly.value = false
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
        onCanvasOnly,
        selectedPriorities,
        selectedProjects,
        selectedDurations,
        selectedCanvasGroups,
        currentHideDoneTasks,
        sortBy, // TASK-1073
        sortDirection, // TASK-1412
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
        clearAllFilters,
        registerNewTask
    }
}
