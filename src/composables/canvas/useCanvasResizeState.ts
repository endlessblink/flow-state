import { ref, computed, type ComputedRef, type Ref } from 'vue'

export interface ResizeState {
    isResizing: boolean
    sectionId: string | null
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    currentX: number
    currentY: number
    currentWidth: number
    currentHeight: number
    handlePosition: string | null
    isDragging: boolean
    resizeStartTime: number
    childStartPositions: Record<string, { x: number; y: number }>
}

export function useCanvasResizeState() {
    // Track resize state for preview
    const resizeState: Ref<ResizeState> = ref({
        isResizing: false,
        sectionId: null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        currentX: 0,
        currentY: 0,
        currentWidth: 0,
        currentHeight: 0,
        handlePosition: null,
        isDragging: false,
        resizeStartTime: 0,
        childStartPositions: {}
    })

    // BUG-055 FIX: Track resize settling period
    const isResizeSettling = ref(false)

    // Computed styles for template
    const resizeLineStyle: ComputedRef<Record<string, string>> = computed(() => ({
        backgroundColor: 'var(--brand-primary)',
        opacity: '0.2', // Fixed: string value for CSS
        transition: 'background-color 0.2s ease'
    }))

    const edgeHandleStyle: ComputedRef<Record<string, string>> = computed(() => ({
        width: '6px',
        height: '24px',
        borderRadius: '3px',
        background: 'rgba(255, 255, 255, 0.25)',
        border: '1px solid rgba(99, 102, 241, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    }))

    return {
        resizeState,
        isResizeSettling,
        resizeLineStyle,
        edgeHandleStyle
    }
}
