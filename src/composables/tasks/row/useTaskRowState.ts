import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

export function useTaskRowState(props: {
    task: Task
    indentLevel: number
    selected: boolean
    expandedTasks: Set<string>
    visitedIds: Set<string>
}) {
    const taskStore = useTaskStore()
    const { getAlignmentClasses } = useHebrewAlignment()

    // --- Local State ---
    const isMobile = ref(false)
    const isFocused = ref(false)
    const isHovered = ref(false)
    const isDragging = ref(false)
    const isDropTarget = ref(false)

    // --- Computed State ---

    const hasSubtasks = computed(() =>
        taskStore.hasNestedTasks(props.task.id)
    )

    const isExpanded = computed(() =>
        props.expandedTasks.has(props.task.id)
    )

    const childTasks = computed(() => {
        // Cycle detection: filter out children that are already in the visited chain
        return taskStore.getTaskChildren(props.task.id)
            .filter(child => !props.visitedIds.has(child.id))
    })

    // Subtask Stats
    const completedSubtaskCount = computed(() =>
        childTasks.value.filter(task => task.status === 'done').length
    )

    const isAllSubtasksCompleted = computed(() =>
        hasSubtasks.value && completedSubtaskCount.value === childTasks.value.length
    )

    // Alignment
    const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task.title))

    // Project Visual
    const projectVisual = computed(() =>
        taskStore.getProjectVisual(props.task.projectId)
    )

    // Date Logic
    const formattedDueDate = computed(() => {
        if (!props.task.dueDate) return '-' // Using simple dash for empty
        const date = new Date(props.task.dueDate)
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        if (date.toDateString() === today.toDateString()) return 'Today'
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    const isOverdue = computed(() => {
        if (!props.task.dueDate) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dueDate = new Date(props.task.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
    })

    // --- Mobile Detection ---

    let resizeTimeout: ReturnType<typeof setTimeout>

    const checkMobile = () => {
        isMobile.value = window.innerWidth < 768
    }

    const handleResize = () => {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(checkMobile, 100)
    }

    onMounted(() => {
        checkMobile()
        window.addEventListener('resize', handleResize, { passive: true })
    })

    onUnmounted(() => {
        window.removeEventListener('resize', handleResize)
        clearTimeout(resizeTimeout)
    })

    return {
        isMobile,
        isFocused,
        isHovered,
        isDragging,
        isDropTarget,
        hasSubtasks,
        isExpanded,
        childTasks,
        completedSubtaskCount,
        isAllSubtasksCompleted,
        titleAlignmentClasses,
        projectVisual,
        formattedDueDate,
        isOverdue
    }
}
