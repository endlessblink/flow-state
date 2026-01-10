import { ref, computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

export function useTaskCardState(props: { task: Task; disabled?: boolean }) {
    const taskStore = useTaskStore()
    const { enabled: progressiveDisclosureEnabled } = useProgressiveDisclosure()
    const { getAlignmentClasses } = useHebrewAlignment()

    // Local UI state
    const isExpanded = ref(true)
    const isFocused = ref(false)
    const isPressed = ref(false)
    const cardRef = ref<HTMLElement | null>(null)

    // Computed state
    const isSelected = computed(() => {
        return taskStore.selectedTaskIds.includes(props.task.id)
    })

    const hasDependencies = computed(() =>
        props.task.dependsOn && props.task.dependsOn.length > 0
    )

    const completedSubtasks = computed(() =>
        props.task.subtasks?.filter(st => st.isCompleted).length || 0
    )

    const formattedDueDate = computed(() => {
        if (!props.task.dueDate) return ''
        const [year, month, day] = props.task.dueDate.split('-')
        return `${day}-${month}-${year}`
    })

    // Format duration
    const formattedDuration = computed(() => {
        const d = props.task.estimatedDuration || 0
        if (d < 60) return `${d}m`
        const h = Math.floor(d / 60)
        const m = d % 60
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    })

    // Duration Badge styling
    const durationBadgeClass = computed(() => {
        const d = props.task.estimatedDuration || 0
        if (d <= 15) return 'duration-quick'
        if (d <= 30) return 'duration-short'
        if (d <= 60) return 'duration-medium'
        return 'duration-long'
    })

    // Hebrew alignment
    const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task.title))

    // Project visual
    const projectVisual = computed(() =>
        taskStore.getProjectVisual(props.task.projectId)
    )

    // Accessibility
    const taskAriaLabel = computed(() => {
        const status = props.task.progress === 100 ? 'completed' : 'pending'
        const priority = props.task.priority || 'medium'
        const selectedStatus = isSelected.value ? ', selected' : ''
        return `Task: ${props.task.title}, ${status}, priority ${priority}${selectedStatus}`
    })

    return {
        isExpanded,
        isFocused,
        isPressed,
        cardRef,
        isSelected,
        hasDependencies,
        completedSubtasks,
        formattedDueDate,
        formattedDuration,
        durationBadgeClass,
        titleAlignmentClasses,
        projectVisual,
        taskAriaLabel,
        progressiveDisclosureEnabled
    }
}
