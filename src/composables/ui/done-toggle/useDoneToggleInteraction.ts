import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export interface Ripple {
    id: number
    x: number
    y: number
    timestamp: number
}

export interface DoneToggleProps {
    completed: boolean
    disabled: boolean
    celebrationParticles: number
}

export interface DoneToggleEmits {
    (e: 'toggle', completed: boolean): void
    (e: 'click', event: MouseEvent | KeyboardEvent): void
    (e: 'celebrationStart'): void
    (e: 'celebrationEnd'): void
}

export function useDoneToggleInteraction(
    props: DoneToggleProps,
    emit: DoneToggleEmits
) {
    // State
    const ripples = ref<Ripple[]>([])
    const isHovered = ref(false)
    const isFocused = ref(false)
    const showCelebration = ref(false)
    const showTouchFeedback = ref(false)
    const animationFrameId = ref<number>()
    const nextRippleId = ref(0)

    // --- Ripple System ---

    const triggerRipple = (event?: MouseEvent) => {
        const id = ++nextRippleId.value
        let x = 50, y = 50 // Default center

        if (event && event.target instanceof HTMLElement) {
            const rect = event.target.getBoundingClientRect()
            x = ((event.clientX - rect.left) / rect.width) * 100
            y = ((event.clientY - rect.top) / rect.height) * 100
        }

        ripples.value.push({
            id,
            x,
            y,
            timestamp: Date.now()
        })

        // Auto-remove ripple after animation
        setTimeout(() => {
            ripples.value = ripples.value.filter(r => r.id !== id)
        }, 600)
    }

    // --- Celebration System ---

    const triggerCelebration = async () => {
        if (!props.completed || props.disabled) return

        showCelebration.value = true
        emit('celebrationStart')

        // Auto-hide celebration after animation
        setTimeout(() => {
            showCelebration.value = false
            emit('celebrationEnd')
        }, 2000)
    }

    // --- Interaction Handlers ---

    const handleClick = (event: MouseEvent) => {
        if (props.disabled) return

        event.stopPropagation()
        triggerRipple(event)

        const newCompletedState = !props.completed
        emit('toggle', newCompletedState)
        emit('click', event)

        if (newCompletedState) {
            nextTick(() => {
                triggerCelebration()
            })
        }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (props.disabled) return

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            triggerRipple()

            const newCompletedState = !props.completed
            emit('toggle', newCompletedState)
            emit('click', event)

            if (newCompletedState) {
                nextTick(() => {
                    triggerCelebration()
                })
            }
        }
    }

    // --- Touch Feedback ---

    const handleTouchStart = (_event: TouchEvent) => {
        if (props.disabled) return
        showTouchFeedback.value = true
        triggerRipple()
    }

    const handleTouchEnd = (_event: TouchEvent) => {
        if (props.disabled) return
        setTimeout(() => {
            showTouchFeedback.value = false
        }, 150)
    }

    // --- Lifecycle ---

    onMounted(() => {
        // Pre-compute animation frames for better performance
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Second RAF ensures browser paint completion
            })
        })
    })

    onUnmounted(() => {
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value)
        }
    })

    return {
        ripples,
        isHovered,
        isFocused,
        showCelebration,
        showTouchFeedback,
        handleClick,
        handleKeyDown,
        handleTouchStart,
        handleTouchEnd,
        triggerCelebration
    }
}
