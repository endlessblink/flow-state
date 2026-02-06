import { computed } from 'vue'
import type { Task, useTaskStore } from '@/stores/tasks'
import { parseDateKey, getTaskInstances, formatDateKey } from '@/stores/tasks'

interface BoardStateDependencies {
    taskStore: ReturnType<typeof useTaskStore>
}

export function useBoardState(deps: BoardStateDependencies) {
    const { taskStore } = deps

    // Helper to get a project and all its descendants recursively with cycle detection
    const getProjectAndChildren = (projectId: string, visited = new Set<string>()): string[] => {
        if (visited.has(projectId)) return []
        visited.add(projectId)

        const ids = [projectId]
        const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
        childProjects.forEach(child => {
            ids.push(...getProjectAndChildren(child.id, visited))
        })
        return ids
    }

    // Group tasks by project (using filtered tasks from store)
    // TASK-243: Filter done tasks locally based on hideDoneTasks setting
    const tasksByProject = computed(() => {
        const grouped: Record<string, Task[]> = {}

        taskStore.filteredTasks
            .filter(task => !(taskStore.hideDoneTasks && task.status === 'done'))
            .forEach(task => {
                const projectId = task.projectId || 'uncategorized'
                if (!grouped[projectId]) {
                    grouped[projectId] = []
                }
                grouped[projectId].push(task)
            })

        return grouped
    })

    // Get projects to display (TASK-243: Filter out empty projects)
    const projectsWithTasks = computed(() => {
        // If a specific project is selected, show that project AND its children
        if (taskStore.activeProjectId) {
            const projectIds = getProjectAndChildren(taskStore.activeProjectId)
            return taskStore.projects.filter(project => projectIds.includes(project.id))
        }

        // Get real projects that have tasks (filter out empty ones)
        const projects = taskStore.projects.filter(project => {
            const tasksInProject = tasksByProject.value[project.id] || []
            return tasksInProject.length > 0
        })

        // Add virtual "Uncategorized" project only if there are VISIBLE uncategorized tasks
        // TASK-243: Use tasksByProject which already applies hideDoneTasks filter
        const uncategorizedTasks = tasksByProject.value['uncategorized'] || []
        if (uncategorizedTasks.length > 0) {
            projects.push({
                id: 'uncategorized',
                name: 'Uncategorized',
                color: '#6B7280',
                colorType: 'hex' as const,
                viewType: 'status' as const,
                createdAt: new Date(),
                updatedAt: new Date()
            })
        }

        return projects
    })

    // Total displayed tasks
    const totalDisplayedTasks = computed(() => {
        try {
            if (taskStore && typeof taskStore.nonDoneTaskCount === 'number') {
                return taskStore.nonDoneTaskCount
            }
            return taskStore?.filteredTasks?.length || 0
        } catch (error) {
            return 0
        }
    })

    return {
        tasksByProject,
        projectsWithTasks,
        totalDisplayedTasks,
        getProjectAndChildren
    }
}

// --- Grouping Helpers ---

export const addDays = (date: Date, amount: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + amount)
    next.setHours(0, 0, 0, 0)
    return next
}

export const isSameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

export const getUpcomingFriday = (base: Date) => {
    const friday = new Date(base)
    const diff = (5 - base.getDay() + 7) % 7
    friday.setDate(base.getDate() + diff)
    friday.setHours(0, 0, 0, 0)
    return friday
}

export const getNextMonday = (base: Date) => {
    const monday = new Date(base)
    const diff = (8 - base.getDay()) % 7 || 7
    monday.setDate(base.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
}

/** Sort tasks by order (ascending), then by createdAt as tiebreaker */
function sortByOrder(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

export function groupTasksByStatus(tasks: Task[]) {
    const result: Record<string, Task[]> = {
        planned: [],
        in_progress: [],
        backlog: [],
        on_hold: [],
        done: []
    }
    tasks.forEach(task => {
        if (result[task.status]) {
            result[task.status].push(task)
        }
    })
    for (const key of Object.keys(result)) {
        sortByOrder(result[key])
    }
    return result
}

export function groupTasksByPriority(tasks: Task[]) {
    const result: Record<string, Task[]> = {
        high: [],
        medium: [],
        low: [],
        no_priority: []
    }
    tasks.forEach(task => {
        const p = task.priority || 'no_priority'
        if (result[p]) {
            result[p].push(task)
        }
    })
    for (const key of Object.keys(result)) {
        sortByOrder(result[key])
    }
    return result
}

export function groupTasksByDate(tasks: Task[], hideDoneTasks: boolean = false) {
    const result: Record<string, Task[]> = {
        overdue: [],
        inbox: [],
        today: [],
        tomorrow: [],
        thisWeek: [],
        later: [],
        noDate: []
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // BUG-1093: Use formatDateKey for local timezone (toISOString returns UTC)
    const todayStr = formatDateKey(today)
    const tomorrow = addDays(today, 1)
    const weekendStart = getUpcomingFriday(today)
    const weekendEnd = addDays(weekendStart, 2)
    const nextWeekStart = getNextMonday(today)
    const nextWeekEnd = addDays(nextWeekStart, 6)
    const afterNextWeekStart = addDays(nextWeekEnd, 1)

    tasks.forEach(task => {
        const instances = getTaskInstances(task)
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)
        const oneDayAgo = new Date(today)
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)

        const isCreatedToday = taskCreatedDate.getTime() === today.getTime()
        const isDueToday = task.dueDate === todayStr
        const isInProgress = task.status === 'in_progress'
        const isOverdueByDate = task.dueDate && task.dueDate < todayStr

        const hasPastInstance = instances.length > 0 && instances.some((instance: any) => {
            const instanceDate = parseDateKey(instance.scheduledDate)
            return instanceDate && instanceDate < today
        })
        const isOldAndUnscheduled = taskCreatedDate < oneDayAgo && instances.length === 0 &&
            !task.dueDate && task.status !== 'backlog'

        // Overdue check
        if (task.status !== 'done' && (isOverdueByDate || hasPastInstance || isOldAndUnscheduled)) {
            result.overdue.push(task)
            return
        }

        if (instances.length === 0) {
            if (isCreatedToday || isDueToday || isInProgress) {
                result.today.push(task)
            } else {
                result.noDate.push(task)
            }
            return
        }

        instances.forEach((instance: any) => {
            if (instance.isLater) {
                result.later.push(task)
                return
            }

            const instanceDate = parseDateKey(instance.scheduledDate)
            if (!instanceDate) return

            if (instanceDate < today) {
                result.overdue.push(task)
            } else if (isSameDay(instanceDate, today)) {
                result.today.push(task)
            } else if (isSameDay(instanceDate, tomorrow) && !(instanceDate >= weekendStart && instanceDate <= weekendEnd)) {
                result.tomorrow.push(task)
            } else if ((instanceDate >= weekendStart && instanceDate <= weekendEnd) || (instanceDate >= nextWeekStart && instanceDate <= nextWeekEnd)) {
                result.thisWeek.push(task)
            } else if (instanceDate >= afterNextWeekStart) {
                result.later.push(task)
            }
        })
    })

    if (!hideDoneTasks) {
        tasks.forEach(task => {
            if (task.status === 'done' && !result.noDate.includes(task)) {
                result.noDate.push(task)
            }
        })
    }

    for (const key of Object.keys(result)) {
        sortByOrder(result[key])
    }

    return result
}
