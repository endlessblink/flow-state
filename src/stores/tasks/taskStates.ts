import { ref, toRef } from 'vue'
import { useProjectStore } from '../projects'
import { useTaskMigrations } from '@/composables/tasks/useTaskMigrations'
import { useTaskFiltering } from '@/composables/tasks/useTaskFiltering'
import type { Task } from '@/types/tasks'

export function useTaskStates() {
    const projectStore = useProjectStore()

    // State - Start with empty tasks array
    const tasks = ref<Task[]>([])

    // State for filtering
    const activeSmartView = ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | null>(null)
    const activeStatusFilter = ref<string | null>(null)
    const activeDurationFilter = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)
    const hideDoneTasks = ref(false)

    // Initialize extracted composables
    const { runAllTaskMigrations } = useTaskMigrations(tasks)

    const {
        filteredTasks,
        tasksByStatus,
        filteredTasksWithCanvasPosition,
        smartViewTaskCounts,
        getProjectTaskCount,
        totalTasks,
        nonDoneTaskCount,
        completedTasks,
        totalPomodoros,
        doneTasksForColumn,
        tasksWithCanvasPosition
    } = useTaskFiltering(
        tasks,
        toRef(projectStore, 'projects'),
        toRef(projectStore, 'activeProjectId'),
        activeSmartView,
        activeStatusFilter,
        activeDurationFilter,
        hideDoneTasks
    )

    // Flags to manage store state
    const isLoadingFromDatabase = ref(false)
    const manualOperationInProgress = ref(false)
    const isLoadingFilters = ref(false)

    const currentView = ref('board')
    const selectedTaskIds = ref<string[]>([])

    return {
        tasks,
        activeSmartView,
        activeStatusFilter,
        activeDurationFilter,
        hideDoneTasks,
        runAllTaskMigrations,
        filteredTasks,
        tasksByStatus,
        filteredTasksWithCanvasPosition,
        smartViewTaskCounts,
        getProjectTaskCount,
        totalTasks,
        nonDoneTaskCount,
        completedTasks,
        totalPomodoros,
        doneTasksForColumn,
        tasksWithCanvasPosition,
        isLoadingFromDatabase,
        manualOperationInProgress,
        isLoadingFilters,
        currentView,
        selectedTaskIds
    }
}
