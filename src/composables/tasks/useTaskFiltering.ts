import { computed, type Ref } from 'vue'
import type { Task, Project } from '@/types/tasks'
import { useSmartViews } from '@/composables/useSmartViews'
import { formatDateKey } from '@/utils/dateUtils'
import { useWorkspaceStore } from '@/stores/workspace'


export type SmartView = 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null

export const useTaskFiltering = (
    tasks: Ref<Task[]>,
    projects: Ref<Project[]>,
    activeProjectId: Ref<string | null>,
    activeSmartView: Ref<SmartView>,
    activeStatusFilter: Ref<string | null>,
    activeDurationFilter: Ref<string | null>,
    hideDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks?: Ref<boolean>,
    selectedProjectIds?: Ref<Set<string>> // TASK-084: Multi-select support
) => {
    const workspaceStore = useWorkspaceStore()

    const filterByWorkspace = (taskList: Task[]): Task[] => {
        const wsId = workspaceStore.activeWorkspaceId
        if (wsId === null) {
            // Personal workspace: show tasks with no workspace
            return taskList.filter(t => !t.workspaceId)
        }
        return taskList.filter(t => t.workspaceId === wsId)
    }

    const {
        applySmartViewFilter,
        isUncategorizedTask,
        isQuickTask,
        isShortTask,
        isMediumTask,
        isLongTask,
        isUnestimatedTask,
        isTodayTask,
        isWeekTask,
        isUnscheduledTask,
        isInProgressTask
    } = useSmartViews()


    // Helper to recursively collect nested tasks - Optimized to O(N) using Map
    const collectNestedTasks = (taskIds: string[], allTasks: Task[]): string[] => {
        const allNestedIds: string[] = []
        const visited = new Set<string>(taskIds) // Pre-fill with starting IDs to prevent duplicates

        // 1. Build Parent-Child Map (O(N))
        const parentMap = new Map<string, string[]>()
        allTasks.forEach(task => {
            if (task.parentTaskId && !task._soft_deleted) {
                if (!parentMap.has(task.parentTaskId)) {
                    parentMap.set(task.parentTaskId, [])
                }
                parentMap.get(task.parentTaskId)?.push(task.id)
            }
        })

        // 2. Traverse (O(N) in worst case of full tree)
        const traverse = (parentId: string) => {
            const children = parentMap.get(parentId)
            if (children) {
                children.forEach(childId => {
                    if (!visited.has(childId)) {
                        visited.add(childId)
                        allNestedIds.push(childId)
                        traverse(childId)
                    }
                })
            }
        }

        taskIds.forEach(parentId => traverse(parentId))
        return allNestedIds
    }

    // Recursive project ID helper with cycle detection
    const getChildProjectIds = (projectId: string, visited = new Set<string>()): string[] => {
        if (visited.has(projectId)) {
            return [] // Already visited, break recursion to prevent cycles
        }
        visited.add(projectId)

        const ids = [projectId] // Include the current project ID
        const childProjects = projects.value.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
            ids.push(...getChildProjectIds(child.id, visited))
        })
        return ids
    }

    const filteredTasks = computed(() => {
        if (!tasks.value || !Array.isArray(tasks.value)) {
            // console.debug('⚠️ [FILTER-DEBUG] No tasks to filter')
            return []
        }

        // TASK-1532: Completion records are calendar-only history — exclude from board/canvas/inbox
        // Pinned tasks are excluded from main views — they appear in PinnedTasksSection (Inbox)
        let filtered = filterByWorkspace(tasks.value).filter(task => !task._soft_deleted && !task.isCompletionRecord && !task.isPinned)
        // console.debug(`🔍 [FILTER-DEBUG] Starting filter with ${filtered.length} tasks (excluding deleted)`)

        // 1. Smart View
        if (activeSmartView.value) {
            filtered = applySmartViewFilter(filtered, activeSmartView.value)
            // console.debug(`🔍 [FILTER-DEBUG] After SmartView (${activeSmartView.value}): ${filtered.length}`)
        }

        // 2. Project (Single or Multi-select)
        if (selectedProjectIds?.value && selectedProjectIds.value.size > 0) {
            // TASK-084: Multi-select mode
            const allTargetProjectIds = new Set<string>()
            selectedProjectIds.value.forEach(pid => {
                const childIds = getChildProjectIds(pid)
                childIds.forEach(cid => allTargetProjectIds.add(cid))
            })
            filtered = filtered.filter(task => allTargetProjectIds.has(task.projectId))
        } else if (activeProjectId.value) {
            // Standard single project mode
            const projectIds = getChildProjectIds(activeProjectId.value)
            filtered = filtered.filter(task => projectIds.includes(task.projectId))
            // console.debug(`🔍 [FILTER-DEBUG] After Project (${activeProjectId.value}): ${filtered.length}`)
        }

        // 3. Status
        if (activeStatusFilter.value && activeStatusFilter.value !== 'all') {
            filtered = filtered.filter(task => task.status === activeStatusFilter.value)
        }

        // 4. Duration
        if (activeDurationFilter.value) {
            filtered = filtered.filter(t => {
                switch (activeDurationFilter.value) {
                    case 'quick': return isQuickTask(t)
                    case 'short': return isShortTask(t)
                    case 'medium': return isMediumTask(t)
                    case 'long': return isLongTask(t)
                    case 'unestimated': return isUnestimatedTask(t)
                    default: return true
                }
            })
        }

        // 5. Hide Done - REMOVED (TASK-076)
        // Each view (Canvas, Calendar, Inbox) handles done filtering locally
        // Canvas: CanvasView.vue filteredTasks computed
        // Calendar: CalendarView.vue local filter
        // Inbox: UnifiedInboxPanel.vue hideInboxDoneTasks ref
        // This ensures canvas toggle doesn't affect inbox and vice versa

        // Include nested tasks
        const filteredTaskIds = filtered.map(task => task.id)
        const nestedTaskIds = collectNestedTasks(filteredTaskIds, tasks.value)

        let nestedTasks: Task[] = []
        try {
            // Optimization: Get project IDs once instead of inside filter loop
            let activeProjectTreeIds: string[] | null = null

            if (activeProjectId.value) {
                activeProjectTreeIds = getChildProjectIds(activeProjectId.value)
            }

            // TASK-084: Handle nesting for multi-select
            if (selectedProjectIds?.value && selectedProjectIds.value.size > 0) {
                activeProjectTreeIds = []
                selectedProjectIds.value.forEach(pid => {
                    activeProjectTreeIds!.push(...getChildProjectIds(pid))
                })
            }

            nestedTasks = filterByWorkspace(tasks.value)
                .filter(task => nestedTaskIds.includes(task.id) && !task._soft_deleted)
                .filter(task => {
                    if (activeProjectTreeIds) {
                        if (!activeProjectTreeIds.includes(task.projectId)) return false
                    }
                    // TASK-076: Only filter done tasks for Today smart view here
                    // View-specific done filtering handled locally by each view
                    if (task.status === 'done' && activeSmartView.value === 'today') return false
                    return true
                })

            // BUG-1210: Apply smart view filter to nested tasks too.
            // Without this, child tasks bypass the date-based filter and appear
            // even when their dates are outside the active view (e.g., next-week
            // tasks showing in "This Week" because their parent matched).
            if (activeSmartView.value) {
                nestedTasks = applySmartViewFilter(nestedTasks, activeSmartView.value)
            }
        } catch {
            nestedTasks = []
        }

        const allTasks = [...filtered, ...nestedTasks]
        const seen = new Map<string, Task>()
        for (const task of allTasks) {
            if (!seen.has(task.id)) seen.set(task.id, task)
        }
        const finalResult = Array.from(seen.values())

        // BUG-1673: Always log when raw has tasks but filtered is empty (detect Realtime desync)
        if (tasks.value.length > 0 && finalResult.length === 0) {
            console.warn(`🔴 [BUG-1673] FILTER EMPTY: raw=${tasks.value.length} → afterBasic=${filtered.length} → final=${finalResult.length}`, {
                smartView: activeSmartView.value,
                statusFilter: activeStatusFilter.value,
                durationFilter: activeDurationFilter.value,
                projectId: activeProjectId.value,
                selectedProjects: selectedProjectIds?.value?.size ?? 0,
            })
        }
        return finalResult
    })

    const tasksByStatus = computed(() => {
        const tasksToGroup = filteredTasks.value
        return {
            todo: tasksToGroup.filter(task => task.status !== 'done'),
            done: tasksToGroup.filter(task => task.status === 'done')
        }
    })

    const filteredTasksWithCanvasPosition = computed(() => {
        return filteredTasks.value.filter(task => task.canvasPosition &&
            typeof task.canvasPosition.x === 'number' &&
            typeof task.canvasPosition.y === 'number')
    })

    const tasksWithCanvasPosition = computed(() => {
        return filterByWorkspace(tasks.value).filter(task => task.canvasPosition &&
            typeof task.canvasPosition.x === 'number' &&
            typeof task.canvasPosition.y === 'number')
    })

    const calendarFilteredTasks = computed(() => {
        let filtered = filterByWorkspace(tasks.value).filter(task => !task._soft_deleted)

        // 1. Project
        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            filtered = filtered.filter(task => projectIds.includes(task.projectId))
        }

        // 2. Hide Done (Calendar specific)
        if (hideCalendarDoneTasks?.value) {
            filtered = filtered.filter(task => task.status !== 'done')
        }

        // BUG-FIX: Deduplicate — calendarFilteredTasks lacked dedup unlike filteredTasks.
        // If _rawTasks has two entries with the same ID (realtime echo race), both would render.
        const seen = new Map<string, Task>()
        for (const task of filtered) {
            if (!seen.has(task.id)) seen.set(task.id, task)
        }
        return Array.from(seen.values())
    })

    const totalTasks = computed(() => filterByWorkspace(tasks.value).filter(task => task.status !== 'done' && !task._soft_deleted).length)
    const completedTasks = computed(() => filterByWorkspace(tasks.value).filter(task => task.status === 'done' && !task._soft_deleted).length)

    const totalPomodoros = computed(() =>
        filterByWorkspace(tasks.value).reduce((sum, task) => sum + (task.completedPomodoros || 0), 0)
    )

    const doneTasksForColumn = computed(() => {
        let doneTasks = filterByWorkspace(tasks.value).filter(task => task.status === 'done')

        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            doneTasks = doneTasks.filter(task => projectIds.includes(task.projectId))
        }

        if (activeSmartView.value === 'today') {
            // BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
            const _now = new Date()
            const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            doneTasks = doneTasks.filter(task => {
                const taskCreatedDate = new Date(task.createdAt)
                taskCreatedDate.setHours(0, 0, 0, 0)
                if (taskCreatedDate.getTime() === today.getTime()) return true

                if (task.dueDate) {
                    const taskDueDate = new Date(task.dueDate)
                    if (!isNaN(taskDueDate.getTime()) && formatDateKey(taskDueDate) === todayStr) return true
                }
                return false
            })
        }

        return doneTasks
    })

    const smartViewTaskCounts = computed(() => {
        let baseTasks = filterByWorkspace(tasks.value).filter(task => !task._soft_deleted)

        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            baseTasks = baseTasks.filter(task => projectIds.includes(task.projectId))
        }

        if (hideDoneTasks.value) {
            baseTasks = baseTasks.filter(task => task.status !== 'done')
        }

        const counts = {
            today: 0, week: 0, uncategorized: 0, unscheduled: 0,
            inProgress: 0, allActive: 0, all: 0,
            quick: 0, short: 0, medium: 0, long: 0, unestimated: 0
        }
        for (const task of baseTasks) {
            counts.all++
            if (isTodayTask(task)) counts.today++
            if (isWeekTask(task)) counts.week++
            if (isUncategorizedTask(task)) counts.uncategorized++
            if (isUnscheduledTask(task)) counts.unscheduled++
            if (isInProgressTask(task)) counts.inProgress++
            if (task.status !== 'done') counts.allActive++
            if (isQuickTask(task)) counts.quick++
            if (isShortTask(task)) counts.short++
            if (isMediumTask(task)) counts.medium++
            if (isLongTask(task)) counts.long++
            if (isUnestimatedTask(task)) counts.unestimated++
        }
        return counts
    })

    const getProjectTaskCount = (projectId: string): number => {
        const projectIds = getChildProjectIds(projectId)
        let projectTasks = filterByWorkspace(tasks.value).filter(task => projectIds.includes(task.projectId))

        if (activeSmartView.value) {
            projectTasks = applySmartViewFilter(projectTasks, activeSmartView.value)
        }

        if (activeStatusFilter.value) {
            projectTasks = projectTasks.filter(task => task.status === activeStatusFilter.value)
        }

        if (hideDoneTasks.value) {
            projectTasks = projectTasks.filter(task => task.status !== 'done')
        }

        return projectTasks.length
    }

    return {
        filteredTasks,
        tasksByStatus,
        filteredTasksWithCanvasPosition,
        smartViewTaskCounts,
        getProjectTaskCount,
        totalTasks,
        nonDoneTaskCount: totalTasks,
        completedTasks,
        totalPomodoros,
        doneTasksForColumn,
        tasksWithCanvasPosition,
        calendarFilteredTasks
    }
}
