import { ref, computed } from 'vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasGroupMembership } from '@/composables/canvas/useCanvasGroupMembership'
import { useSmartViews } from '@/composables/useSmartViews'
import { useDirection } from '@/i18n/useDirection'
import { type DurationCategory, matchesDurationCategory } from '@/utils/durationCategories'
import type { SortByType, SortDirection } from '@/composables/inbox/useUnifiedInboxState'

export function useCalendarInboxState() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()
    const { isTodayTask } = useSmartViews()
    const { isRTL } = useDirection()

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
    const hideSubtasks = usePersistentRef<boolean>('flowstate:cal-inbox-hide-subtasks', false)

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

    // TASK-1303: Sort state (persistent per calendar inbox)
    const sortBy = usePersistentRef<SortByType>('flowstate:cal-inbox-sort-by', 'newest')
    // TASK-1412: Sort direction (asc/desc)
    const sortDirection = usePersistentRef<SortDirection>('flowstate:cal-inbox-sort-direction', 'asc', 'cal-inbox-sort-direction')

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

    // Helper: Get today's date string (BUG-1321: local time, not UTC)
    const getTodayStr = () => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const isDateToday = (dateStr?: string): boolean => {
        if (!dateStr) return false
        return dateStr.trim().substring(0, 10) === getTodayStr()
    }

    // Helper: Check if task is scheduled
    const isScheduledOnCalendar = (task: Task): boolean => {
        if (!task.instances || task.instances.length === 0) return false
        return task.instances.some(inst => inst.scheduledDate)
    }

    const isScheduledForToday = (task: Task): boolean => {
        if (task.instances && task.instances.length > 0) {
            return task.instances.some(inst => isDateToday(inst?.scheduledDate))
        }

        return isDateToday(task.scheduledDate)
    }

    const shouldShowDueTodayTask = (task: Task): boolean => {
        if (!isDateToday(task.dueDate) || isScheduledForToday(task)) return false

        return true
    }

    const embeddedSubtaskIds = computed(() => {
        const ids = new Set<string>()
        for (const task of taskStore.calendarFilteredTasks) {
            for (const subtask of task.subtasks || []) {
                ids.add(subtask.id)
            }
        }
        return ids
    })

    const isSubtaskCard = (task: Task): boolean =>
        Boolean(task.parentTaskId) || embeddedSubtaskIds.value.has(task.id)

    // Helper: Check if task is due today (status-agnostic, with proper date normalization)
    // Uses isTodayTask from useSmartViews but also handles done tasks (isTodayTask excludes them)
    const isTaskDueToday = (task: Task): boolean => {
        // isTodayTask handles normalization, instances, and legacy scheduledDate
        // but excludes done tasks — so we also check done tasks with dueDate
        if (task.status !== 'done') return isTodayTask(task)

        // For done tasks: normalize dueDate manually
        const todayStr = getTodayStr()
        if (task.dueDate) {
            const normalized = task.dueDate.trim().substring(0, 10)
            return normalized === todayStr
        }
        return false
    }

    // Base Inbox Tasks — BUG-1333: Use calendarFilteredTasks (project + hide-done only)
    // instead of filteredTasks which also applies board-level smart view/status/duration
    // filters that incorrectly restrict the calendar inbox.
    const baseInboxTasks = computed(() => {
        return taskStore.calendarFilteredTasks.filter(task => {
            if (hideCalendarDoneTasks.value && task.status === 'done') return false
            if (task.isPinned) return false

            // BUG-1530 port: Canvas tasks that are also scheduled on the calendar are included
            // when canvas-related filters are active (Canvas group filter, Canvas sort, or Today filter).
            // This lets users see their canvas tasks via these filters.
            // Without canvas filters, scheduled canvas tasks stay hidden (they're already on the calendar grid).
            const isOnCanvas = !!task.canvasPosition
            if (isScheduledOnCalendar(task) && shouldShowDueTodayTask(task)) {
                return true
            }

            if (isOnCanvas && isScheduledOnCalendar(task)) {
                const hasCanvasFilter = selectedCanvasGroups.value.size > 0
                const hasCanvasSort = sortBy.value === 'canvasOrder'
                const hasTimeFilter = showTodayOnly.value
                return hasCanvasFilter || hasCanvasSort || hasTimeFilter
            }

            return !isScheduledOnCalendar(task)
        })
    })

    // Count tasks due today (uses normalized date comparison)
    const todayCount = computed(() => {
        return baseInboxTasks.value.filter(task => isTaskDueToday(task)).length
    })

    // Active filters check
    const hasActiveFilters = computed(() => {
        return showTodayOnly.value ||
            unscheduledOnly.value ||
            hideSubtasks.value ||
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

        // 2. Today Filter (uses normalized date comparison via isTaskDueToday)
        if (showTodayOnly.value) {
            tasks = tasks.filter(task => isTaskDueToday(task))
        }

        // 3. Advanced Filters
        if (unscheduledOnly.value) {
            tasks = tasks.filter(task => !isScheduledOnCalendar(task))
        }

        if (hideSubtasks.value) {
            tasks = tasks.filter(task => !isSubtaskCard(task))
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

        // TASK-1412: Apply sorting with direction support
        const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 }
        const dir = sortDirection.value === 'desc' ? -1 : 1

        if (sortBy.value === 'canvasOrder') {
            // TASK-1412 + BUG-1758: Direction-aware canvas-order sort — group X sort and
            // task-row X tiebreaker both honor isRTL. Without the X tiebreaker, grid rows
            // (tasks sharing the same Y) come out in arbitrary array order.
            const groups = canvasStore.groups || []

            // Reading-order comparator: Y ascending primary (top→bottom),
            // X direction-aware secondary (LTR: left→right, RTL: right→left).
            const byReadingOrder = (a: Task, b: Task) => {
                const ay = a.canvasPosition?.y ?? 0
                const by = b.canvasPosition?.y ?? 0
                if (ay !== by) return ay - by
                const ax = a.canvasPosition?.x ?? 0
                const bx = b.canvasPosition?.x ?? 0
                return isRTL.value ? bx - ax : ax - bx
            }

            // Build a map of parentId → tasks for DFS bucketing
            const buckets = new Map<string | null, Task[]>()
            for (const task of tasks) {
                const key = task.parentId ?? null
                if (!buckets.has(key)) buckets.set(key, [])
                buckets.get(key)!.push(task)
            }

            // Group order: LTR = leftmost first (ASC), RTL = rightmost first (DESC)
            const sortedGroups = [...groups].sort((a, b) => {
                const ax = a.position?.x ?? 0
                const bx = b.position?.x ?? 0
                return isRTL.value ? bx - ax : ax - bx
            })

            // DFS: push a task then recursively push its children (by parentTaskId), in reading order
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
                    .sort(byReadingOrder)
                for (const child of children) dfs(child)
            }

            // Process grouped tasks in direction-aware group order
            for (const group of sortedGroups) {
                const bucket = buckets.get(group.id) ?? []
                // Root tasks in this group: parentTaskId is null/undefined or points outside this bucket
                const bucketIds = new Set(bucket.map(t => t.id))
                const roots = bucket
                    .filter(t => !t.parentTaskId || !bucketIds.has(t.parentTaskId))
                    .sort(byReadingOrder)
                for (const root of roots) dfs(root)
                // Catch any remaining (orphaned cycles or unvisited)
                for (const t of bucket) dfs(t)
            }

            // Ungrouped tasks (parentId is null/undefined) — same DFS logic
            const ungroupedBucket = buckets.get(null) ?? []
            const ungroupedIds = new Set(ungroupedBucket.map(t => t.id))
            const ungroupedRoots = ungroupedBucket
                .filter(t => !t.parentTaskId || !ungroupedIds.has(t.parentTaskId))
                .sort(byReadingOrder)
            for (const root of ungroupedRoots) dfs(root)
            for (const t of ungroupedBucket) dfs(t)

            // Catch tasks that weren't visited (edge cases: groups not in canvasStore.groups)
            for (const t of tasks) dfs(t)

            tasks = sortDirection.value === 'desc' ? result.reverse() : result
        } else {
            tasks = [...tasks].sort((a, b) => {
                switch (sortBy.value) {
                    case 'priority': {
                        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                        if (aPriority !== bPriority) return dir * (aPriority - bPriority)
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    }
                    case 'dueDate': {
                        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
                        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
                        if (aDue !== bDue) return dir * (aDue - bDue)
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    }
                    case 'newest':
                    default:
                        return dir * (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                }
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
        hideSubtasks.value = false
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
        hideSubtasks,
        searchQuery, // TASK-1075
        sortBy, // TASK-1303
        sortDirection, // TASK-1412

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
