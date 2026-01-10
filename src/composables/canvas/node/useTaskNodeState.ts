import { ref, computed, onMounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useTimerStore } from '@/stores/timer'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import type { Task, TaskStatus } from '@/types/tasks'
import { Timer, Zap, Clock } from 'lucide-vue-next'

export function useTaskNodeState(props: { task: Task; isDragging?: boolean }) {
    const timerStore = useTimerStore()
    const { getAlignmentClasses } = useHebrewAlignment()

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

    // Hebrew text alignment
    const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task?.title || ''))

    // Dragging state tracking
    const isNodeDragging = computed(() => props.isDragging || false)

    // Creation animation state
    const isRecentlyCreated = ref(false)

    onMounted(() => {
        if (props.task?.createdAt) {
            const createdDate = new Date(props.task.createdAt)
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

    const statusLabel = computed(() => {
        const labels: Record<TaskStatus, string> = {
            planned: 'Plan',
            in_progress: 'Active',
            done: 'Done',
            backlog: 'Back',
            on_hold: 'Hold'
        }
        return labels[props.task.status] || 'Unknown'
    })

    const hasSchedule = computed(() =>
        props.task?.instances && props.task.instances.length > 0
    )

    const formattedDueDate = computed(() => {
        if (!props.task?.dueDate) return ''
        try {
            const date = new Date(props.task.dueDate)
            if (isNaN(date.getTime())) return props.task.dueDate
            return new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date)
        } catch (_e) {
            return props.task.dueDate
        }
    })

    const isTimerActive = computed(() => {
        return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
    })

    // Duration Logic
    const durationBadgeClass = computed(() => {
        const d = props.task?.estimatedDuration || 0
        if (d <= 15) return 'duration-quick'
        if (d <= 30) return 'duration-short'
        if (d <= 60) return 'duration-medium'
        return 'duration-long'
    })

    const durationIcon = computed(() => {
        const d = props.task?.estimatedDuration || 0
        if (d <= 15) return Zap
        if (d <= 60) return Timer
        return Clock
    })

    const formattedDuration = computed(() => {
        const d = props.task?.estimatedDuration || 0
        if (d < 60) return `${d}m`
        const h = Math.floor(d / 60)
        const m = d % 60
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    })

    return {
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
        isTimerActive,
        durationBadgeClass,
        durationIcon,
        formattedDuration
    }
}
