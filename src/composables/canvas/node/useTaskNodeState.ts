import { ref, computed, onMounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import type { Task, TaskStatus } from '@/types/tasks'
import { Timer, Zap, Clock } from 'lucide-vue-next'

export function useTaskNodeState(props: { task: Task; isDragging?: boolean }) {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const { getAlignmentClasses } = useHebrewAlignment()

    // BUG-291 FIX: Read task from STORE (reactive) instead of PROPS (snapshot)
    // This ensures the node updates instantly when task properties change
    const task = computed(() => taskStore.tasks.find(t => t.id === props.task?.id) || props.task)

    // --- LOD Support ---
    // We use a safe wrapper to avoid breaking Storybook
    let vfContext: ReturnType<typeof useVueFlow> | null = null
    try {
        vfContext = useVueFlow()
    } catch (_e) {
        // Not in Vue Flow context (e.g. Storybook)
    }

    // Reactive Viewport Access
    const zoom = computed(() => {
        if (!vfContext) return 1
        const z = vfContext.viewport.value?.zoom
        return (typeof z === 'number' && Number.isFinite(z) && z > 0) ? z : 1
    })

    // LOD Levels
    const isLOD1 = computed(() => zoom.value < 0.6) // Hide description
    const isLOD2 = computed(() => zoom.value < 0.4) // Hide metadata
    const isLOD3 = computed(() => zoom.value < 0.2) // Hide title, simple block

    // --- Visual State ---

    // Hebrew text alignment - use reactive task from store
    const titleAlignmentClasses = computed(() => getAlignmentClasses(task.value?.title || ''))

    // Dragging state tracking
    const isNodeDragging = computed(() => props.isDragging || false)

    // Creation animation state
    const isRecentlyCreated = ref(false)

    onMounted(() => {
        if (task.value?.createdAt) {
            const createdDate = new Date(task.value.createdAt)
            const now = new Date()
            const ageInSeconds = (now.getTime() - createdDate.getTime()) / 1000

            if (ageInSeconds < 5) {
                isRecentlyCreated.value = true
                setTimeout(() => {
                    isRecentlyCreated.value = false
                }, 2500)
            }
        }
    })

    // --- Computed Props for Display ---

    // BUG-291: All computed properties now use reactive task from store
    const statusLabel = computed(() => {
        const labels: Record<TaskStatus, string> = {
            planned: 'Plan',
            in_progress: 'Active',
            done: 'Done',
            backlog: 'Back',
            on_hold: 'Hold'
        }
        return labels[task.value?.status] || 'Unknown'
    })

    const hasSchedule = computed(() =>
        task.value?.instances && task.value.instances.length > 0
    )

    const formattedDueDate = computed(() => {
        if (!task.value?.dueDate) return ''
        try {
            const date = new Date(task.value.dueDate)
            if (isNaN(date.getTime())) return task.value.dueDate
            return new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date)
        } catch (_e) {
            return task.value.dueDate
        }
    })

    // TASK-282: Overdue detection
    const isOverdue = computed(() => {
        if (!task.value?.dueDate) return false
        if (task.value.status === 'done') return false // Completed tasks aren't overdue
        try {
            const dueDate = new Date(task.value.dueDate)
            dueDate.setHours(23, 59, 59, 999) // End of due date day
            const today = new Date()
            return dueDate < today
        } catch (_e) {
            return false
        }
    })

    const isTimerActive = computed(() => {
        return timerStore.isTimerActive && timerStore.currentTaskId === task.value?.id
    })

    // Duration Logic
    const durationBadgeClass = computed(() => {
        const d = task.value?.estimatedDuration || 0
        if (d <= 15) return 'duration-quick'
        if (d <= 30) return 'duration-short'
        if (d <= 60) return 'duration-medium'
        return 'duration-long'
    })

    const durationIcon = computed(() => {
        const d = task.value?.estimatedDuration || 0
        if (d <= 15) return Zap
        if (d <= 60) return Timer
        return Clock
    })

    const formattedDuration = computed(() => {
        const d = task.value?.estimatedDuration || 0
        if (d < 60) return `${d}m`
        const h = Math.floor(d / 60)
        const m = d % 60
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    })

    return {
        // BUG-291: Export reactive task for instant updates
        task,
        zoom,
        isLOD1,
        isLOD2,
        isLOD3,
        titleAlignmentClasses,
        isNodeDragging,
        isRecentlyCreated,
        statusLabel,
        hasSchedule,
        formattedDueDate,
        isOverdue,
        isTimerActive,
        durationBadgeClass,
        durationIcon,
        formattedDuration
    }
}
