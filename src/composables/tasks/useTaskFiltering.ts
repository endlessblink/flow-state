import { computed, type Ref } from 'vue'
import type { Task, Project } from '@/types/tasks'
import { useSmartViews } from '@/composables/useSmartViews'
import { formatDateKey } from '@/utils/dateUtils'


export type SmartView = 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null

export const useTaskFiltering = (
    tasks: Ref<Task[]>,
    projects: Ref<Project[]>,
    activeProjectId: Ref<string | null>,
    activeSmartView: Ref<SmartView>,
    activeStatusFilter: Ref<string | null>,
    activeDurationFilter: Ref<string | null>,
    hideDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks?: Ref<boolean>
) => {
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


    // Helper to recursively collect nested tasks
    const collectNestedTasks = (taskIds: string[]): string[] => {
        const allNestedIds: string[] = []
        const visited = new Set<string>()

        const collectChildren = (parentId: string) => {
            const children = tasks.value.filter(task => task.parentTaskId === parentId)
            children.forEach(child => {
                if (!visited.has(child.id)) {
                    visited.add(child.id)
                    allNestedIds.push(child.id)
                    collectChildren(child.id)
                }
            })
        }

        taskIds.forEach(parentId => {
            if (!visited.has(parentId)) {
                visited.add(parentId)
                collectChildren(parentId)
            }
        })
        return allNestedIds
    }

    // Recursive project ID helper
    const getChildProjectIds = (projectId: string): string[] => {
        const ids = [projectId]
        const childProjects = projects.value.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
            ids.push(...getChildProjectIds(child.id))
        })
        return ids
    }

    const filteredTasks = computed(() => {
        if (!tasks.value || !Array.isArray(tasks.value)) return []

        let filtered = tasks.value

        // 1. Smart View
        if (activeSmartView.value) {
            filtered = applySmartViewFilter(filtered, activeSmartView.value)
        }

        // 2. Project
        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            filtered = filtered.filter(task => projectIds.includes(task.projectId))
        }

        // 3. Status
        if (activeStatusFilter.value) {
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
        const nestedTaskIds = collectNestedTasks(filteredTaskIds)

        let nestedTasks: Task[] = []
        try {
            nestedTasks = tasks.value
                .filter(task => nestedTaskIds.includes(task.id))
                .filter(task => {
                    if (activeProjectId.value) {
                        const projectIds = getChildProjectIds(activeProjectId.value)
                        if (!projectIds.includes(task.projectId)) return false
                    }
                    // TASK-076: Only filter done tasks for Today smart view here
                    // View-specific done filtering handled locally by each view
                    if (task.status === 'done' && activeSmartView.value === 'today') return false
                    return true
                })
        } catch {
            nestedTasks = []
        }

        const allTasks = [...filtered, ...nestedTasks]
        return allTasks.filter((task, index, self) =>
            index === self.findIndex(t => t.id === task.id)
        )
    })

    const tasksByStatus = computed(() => {
        const tasksToGroup = filteredTasks.value
        return {
            planned: tasksToGroup.filter(task => task.status === 'planned'),
            in_progress: tasksToGroup.filter(task => task.status === 'in_progress'),
            done: tasksToGroup.filter(task => task.status === 'done'),
            backlog: tasksToGroup.filter(task => task.status === 'backlog'),
            on_hold: tasksToGroup.filter(task => task.status === 'on_hold')
        }
    })

    const filteredTasksWithCanvasPosition = computed(() => {
        return filteredTasks.value.filter(task => task.canvasPosition &&
            typeof task.canvasPosition.x === 'number' &&
            typeof task.canvasPosition.y === 'number')
    })

    const tasksWithCanvasPosition = computed(() => {
        return tasks.value.filter(task => task.canvasPosition &&
            typeof task.canvasPosition.x === 'number' &&
            typeof task.canvasPosition.y === 'number')
    })

    const calendarFilteredTasks = computed(() => {
        let filtered = tasks.value

        // 1. Project
        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            filtered = filtered.filter(task => projectIds.includes(task.projectId))
        }

        // 2. Hide Done (Calendar specific)
        if (hideCalendarDoneTasks?.value) {
            filtered = filtered.filter(task => task.status !== 'done')
        }

        return filtered
    })

    const totalTasks = computed(() => tasks.value.filter(task => task.status !== 'done').length)
    const completedTasks = computed(() => tasks.value.filter(task => task.status === 'done').length)

    const totalPomodoros = computed(() =>
        tasks.value.reduce((sum, task) => sum + (task.completedPomodoros || 0), 0)
    )

    const doneTasksForColumn = computed(() => {
        let doneTasks = tasks.value.filter(task => task.status === 'done')

        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            doneTasks = doneTasks.filter(task => projectIds.includes(task.projectId))
        }

        if (activeSmartView.value === 'today') {
            const todayStr = new Date().toISOString().split('T')[0]
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
        let baseTasks = tasks.value

        if (activeProjectId.value) {
            const projectIds = getChildProjectIds(activeProjectId.value)
            baseTasks = baseTasks.filter(task => projectIds.includes(task.projectId))
        }

        if (hideDoneTasks.value) {
            baseTasks = baseTasks.filter(task => task.status !== 'done')
        }

        return {
            today: baseTasks.filter(task => isTodayTask(task)).length,
            week: baseTasks.filter(task => isWeekTask(task)).length,
            uncategorized: baseTasks.filter(task => isUncategorizedTask(task)).length,
            unscheduled: baseTasks.filter(task => isUnscheduledTask(task)).length,
            inProgress: baseTasks.filter(task => isInProgressTask(task)).length,
            allActive: baseTasks.filter(task => task.status !== 'done').length,
            all: baseTasks.length,
            quick: baseTasks.filter(task => isQuickTask(task)).length,
            short: baseTasks.filter(task => isShortTask(task)).length,
            medium: baseTasks.filter(task => isMediumTask(task)).length,
            long: baseTasks.filter(task => isLongTask(task)).length,
            unestimated: baseTasks.filter(task => isUnestimatedTask(task)).length
        }
    })

    const getProjectTaskCount = (projectId: string): number => {
        const projectIds = getChildProjectIds(projectId)
        let projectTasks = tasks.value.filter(task => projectIds.includes(task.projectId))

        if (activeSmartView.value) {
            projectTasks = applySmartViewFilter(projectTasks, activeSmartView.value as any)
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
