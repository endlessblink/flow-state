import { computed } from 'vue'
import type { Task, TaskInstance, useTaskStore } from '@/stores/tasks'
import { parseDateKey, getTaskInstances } from '@/stores/tasks'
import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'
import { sortTasksBySharedOrder } from '@/utils/taskOrdering'

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
                const projectId = task.projectId || UNCATEGORIZED_PROJECT_ID
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
        const uncategorizedTasks = tasksByProject.value[UNCATEGORIZED_PROJECT_ID] || []
        if (uncategorizedTasks.length > 0) {
            projects.push({
                id: UNCATEGORIZED_PROJECT_ID,
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
        } catch (_error) {
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
    return sortTasksBySharedOrder(tasks)
}

export function groupTasksByStatus(tasks: Task[]) {
    const result: Record<string, Task[]> = {
        todo: [],
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
    // TASK-1348: Removed dead 'inbox' bucket (was never populated)
    const result: Record<string, Task[]> = {
        noDate: [],
        overdue: [],
        today: [],
        tomorrow: [],
        thisWeek: [],
        later: []
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = addDays(today, 1)
    const weekendStart = getUpcomingFriday(today)
    const weekendEnd = addDays(weekendStart, 2)
    const nextWeekStart = getNextMonday(today)
    const nextWeekEnd = addDays(nextWeekStart, 6)
    const afterNextWeekStart = addDays(nextWeekEnd, 1)

    // BUG-1935: One arm for both the dueDate and the instance path, so they cannot drift apart.
    const bucketForDate = (date: Date): keyof typeof result => {
        if (isSameDay(date, today)) return 'today'
        // BUG-1455: Always show tomorrow's tasks in Tomorrow column,
        // even when tomorrow falls on a weekend day
        if (isSameDay(date, tomorrow)) return 'tomorrow'
        if ((date >= weekendStart && date <= weekendEnd) || (date >= nextWeekStart && date <= nextWeekEnd)) return 'thisWeek'
        if (date >= afterNextWeekStart) return 'later'
        // Between today and weekend/next week but not matching specific buckets
        return 'thisWeek'
    }

    tasks.forEach(task => {
        const instances = getTaskInstances(task)

        // TASK-1348: Normalize dueDate from ISO format ("2026-02-22T00:00:00+00:00") to "YYYY-MM-DD"
        // Supabase returns full ISO timestamps but parseDateKey/formatDateKey use "YYYY-MM-DD"
        const dueDateKey = task.dueDate ? task.dueDate.slice(0, 10) : null

        // TASK-1492: Tasks with no due date and no instances → "No Date" immediately
        if (!dueDateKey && instances.length === 0) {
            if (hideDoneTasks && task.status === 'done') return
            result.noDate.push(task)
            return
        }

        // BUG-1935: A task belongs to exactly ONE bucket, keyed on a single effective date.
        // dueDate wins when set; instances are only a fallback for tasks scheduled on the
        // calendar without a deadline. Previously instances overrode dueDate, so a drop that
        // wrote only dueDate re-bucketed straight back to its origin column — the drag
        // silently did nothing. Instances also each pushed the task into their own bucket,
        // rendering one task in several columns under a duplicate `item-key="id"`.
        let effectiveKey: string | null = dueDateKey

        if (!effectiveKey) {
            const scheduled = instances.filter((instance: TaskInstance) => !instance.isLater)
            if (scheduled.length === 0) {
                // Only isLater instances → no concrete date to bucket on
                result.later.push(task)
                return
            }
            effectiveKey = scheduled.reduce(
                (earliest: string, instance: TaskInstance) =>
                    instance.scheduledDate < earliest ? instance.scheduledDate : earliest,
                scheduled[0].scheduledDate
            )
        }

        const effectiveDate = parseDateKey(effectiveKey)
        if (!effectiveDate) {
            result.noDate.push(task)
            return
        }

        if (effectiveDate < today) {
            // Done tasks never surface as overdue; they have no future bucket either.
            result[task.status === 'done' ? 'noDate' : 'overdue'].push(task)
            return
        }

        result[bucketForDate(effectiveDate)].push(task)
    })

    for (const key of Object.keys(result)) {
        sortByOrder(result[key])
    }

    return result
}
