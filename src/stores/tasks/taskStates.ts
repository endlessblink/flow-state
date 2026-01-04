import { ref, toRef, computed } from 'vue'
import { useProjectStore } from '../projects'
import { useUIStore } from '../ui' // Import UI Store
import { useTaskMigrations } from '@/composables/tasks/useTaskMigrations'
import { useTaskFiltering } from '@/composables/tasks/useTaskFiltering'
import type { Task } from '@/types/tasks'

export function useTaskStates() {
    const projectStore = useProjectStore()
    const uiStore = useUIStore() // Init UI Store

    // State - Start with empty tasks array
    const tasks = ref<Task[]>([])

    // State for filtering
    const activeSmartView = ref<'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' | 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)
    const activeStatusFilter = ref<string | null>(null)
    const activeDurationFilter = ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>(null)

    // TASK-076: Separate done filters for Canvas vs Calendar views
    // Default to true - canvas loads with completed tasks hidden
    const hideCanvasDoneTasks = ref(true)
    const hideCalendarDoneTasks = ref(false)

    // TASK-082: Hide overdue tasks on canvas (tasks with due date before today)
    const hideCanvasOverdueTasks = ref(false)

    // Backward compatibility computed - used by useTaskFiltering and legacy code
    const hideDoneTasks = computed({
        get: () => hideCanvasDoneTasks.value || hideCalendarDoneTasks.value,
        set: (val: boolean) => {
            hideCanvasDoneTasks.value = val
            hideCalendarDoneTasks.value = val
        }
    })

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
        tasksWithCanvasPosition,
        calendarFilteredTasks
    } = useTaskFiltering(
        tasks,
        toRef(projectStore, 'projects'),
        toRef(projectStore, 'activeProjectId'),
        activeSmartView as any,
        activeStatusFilter,
        activeDurationFilter,
        hideDoneTasks,
        hideCalendarDoneTasks,
        toRef(uiStore, 'selectedProjectIds') // Pass global multi-select state
    )

    // Flags to manage store state
    const isLoadingFromDatabase = ref(false)
    const manualOperationInProgress = ref(false)
    const isLoadingFilters = ref(false)

    // BUG-057 FIX: Flag to prevent save watchers during sync updates
    // When true, store mutations should NOT trigger saves back to PouchDB
    const syncInProgress = ref(false)

    const currentView = ref('board')
    const selectedTaskIds = ref<string[]>([])

    return {
        tasks,
        activeSmartView,
        activeStatusFilter,
        activeDurationFilter,
        hideDoneTasks,
        hideCanvasDoneTasks,
        hideCalendarDoneTasks,
        hideCanvasOverdueTasks,
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
        calendarFilteredTasks,
        isLoadingFromDatabase,
        manualOperationInProgress,
        isLoadingFilters,
        syncInProgress,
        currentView,
        selectedTaskIds
    }
}
