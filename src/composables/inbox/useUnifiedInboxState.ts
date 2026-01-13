import { ref, computed, onMounted, watch } from 'vue'
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

export function useUnifiedInboxState(props: InboxContextProps) {
    const taskStore = useTaskStore()
    const { isTodayTask } = useSmartViews()
    const { groupsWithCounts, filterTasksByGroup } = useCanvasGroupMembership()

    // --- Core Filter State ---
    const isCollapsed = ref(false)
    const activeTimeFilter = ref<'all' | 'today'>('all')

    // --- Advanced Filter State ---
    const showAdvancedFilters = ref(false)
    const unscheduledOnly = ref(false)
    const selectedPriority = ref<'high' | 'medium' | 'low' | null>(null)
    const selectedProject = ref<string | null>(null)
    const selectedDuration = ref<DurationCategory | null>(null)

    // TASK-106: Canvas group filter (primary filter)
    const selectedCanvasGroups = ref<Set<string>>(new Set())

    // --- Local Done Filter ---
    // Default to hiding done tasks in Calendar context
    const hideInboxDoneTasks = ref(props.context === 'calendar')
    const currentHideDoneTasks = computed(() => hideInboxDoneTasks.value)
    const toggleHideDoneTasks = () => {
        hideInboxDoneTasks.value = !hideInboxDoneTasks.value
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
            // 1. Hide Done tasks (Local View Filter)
            if (currentHideDoneTasks.value && task.status === 'done') {
                return false
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

        // 2. Today Filter
        if (activeTimeFilter.value === 'today') {
            tasks = tasks.filter(task => isTodayTask(task))
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

        return tasks
    })

    const clearAllFilters = () => {
        unscheduledOnly.value = false
        selectedPriority.value = null
        selectedProject.value = null
        selectedDuration.value = null
        activeTimeFilter.value = 'all'
        selectedCanvasGroups.value = new Set()
    }

    // FEATURE-254: Canvas inbox starts minimized always unless it has tasks inside
    // Reactive behavior: auto-collapse when empty, auto-expand when tasks appear (on start)
    watch(() => inboxTasks.value.length, (count) => {
        if (props.context === 'canvas') {
            if (count === 0) {
                isCollapsed.value = true
            } else {
                isCollapsed.value = false
            }
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

        // Computed (State)
        canvasGroupOptions,
        baseInboxTasks,
        inboxTasks,
        todayCount,

        // Actions (State Mutators)
        toggleHideDoneTasks,
        clearAllFilters
    }
}
