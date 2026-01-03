import { ref, computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
// TASK-089: Canvas state lock to prevent sync from overwriting user changes
import { lockGroupPosition } from '@/utils/canvasStateLock'

export function useCanvasResize() {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { findNode, nodes } = useVueFlow() // Access nodes directly from Vue Flow context if possible, or expect them passed? 
    // better to use the one from useVueFlow if we are inside the provider, but safe to expect valid context.

    // Track resize state for preview
    const resizeState = ref({
        isResizing: false,
        sectionId: null as string | null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        currentX: 0,
        currentY: 0,
        currentWidth: 0,
        currentHeight: 0,
        handlePosition: null as string | null,
        isDragging: false,
        resizeStartTime: 0
    })


    // BUG-055 FIX: Track resize settling period
    const isResizeSettling = ref(false)

    // Handlers
    const handleSectionResizeStart = ({ sectionId, event: _event }: { sectionId: string; event: unknown }) => {
        const section = canvasStore.sections.find(s => s.id === sectionId)
        if (section) {
            resizeState.value = {
                isResizing: true,
                sectionId: sectionId,
                startX: section.position.x,
                startY: section.position.y,
                startWidth: section.position.width,
                startHeight: section.position.height,
                currentX: section.position.x,
                currentY: section.position.y,
                currentWidth: section.position.width,
                currentHeight: section.position.height,
                handlePosition: null, // Set by handle if needed, but often unused in start
                isDragging: false,
                resizeStartTime: Date.now()
            }
            console.log('🎬 [Resize] Started:', {
                sectionId,
                startX: section.position.x,
                startY: section.position.y,
                startWidth: section.position.width,
                startHeight: section.position.height
            })
        }
    }

    const handleSectionResize = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
        // NodeResizer provides dimensions in event.params as { width, height, x, y }
        const typedEvent = event as { params?: { width?: number; height?: number; x?: number; y?: number }; width?: number; height?: number }
        const width = typedEvent?.params?.width || typedEvent?.width
        const height = typedEvent?.params?.height || typedEvent?.height

        if (width && height) {
            // Update resize state for real-time preview overlay
            resizeState.value.currentWidth = width
            resizeState.value.currentHeight = height

            // BUG-050 FIX: Always read position from Vue Flow node (source of truth)
            const vueFlowNode = findNode(`section-${sectionId}`)
            if (vueFlowNode) {
                resizeState.value.currentX = vueFlowNode.position.x
                resizeState.value.currentY = vueFlowNode.position.y
            } else {
                // Fallback
                if (typeof typedEvent?.params?.x === 'number') {
                    resizeState.value.currentX = typedEvent.params.x
                }
                if (typeof typedEvent?.params?.y === 'number') {
                    resizeState.value.currentY = typedEvent.params.y
                }
            }
        }
    }

    const handleSectionResizeEnd = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
        console.log('🎯 [CanvasView] Section resize END:', { sectionId })

        const vueFlowNode = findNode(`section-${sectionId}`)
        if (!vueFlowNode) {
            console.error('❌ [CanvasView] Vue Flow node not found:', sectionId)
            return
        }

        const typedEvent = event as { params?: { width?: number; height?: number }; width?: number; height?: number }
        const width = typedEvent?.params?.width || typedEvent?.width
        const height = typedEvent?.params?.height || typedEvent?.height

        // Calculate final absolute positions
        let newX = vueFlowNode.position.x
        let newY = vueFlowNode.position.y

        // Check nested group status
        const sectionForParentCheck = canvasStore.sections.find(s => s.id === sectionId)
        if (sectionForParentCheck?.parentGroupId) {
            const parentGroup = canvasStore.sections.find(s => s.id === sectionForParentCheck.parentGroupId)
            if (parentGroup) {
                newX = vueFlowNode.position.x + parentGroup.position.x
                newY = vueFlowNode.position.y + parentGroup.position.y
                console.log('🔄 [BUG-055] Converted nested group position from relative to absolute')
            }
        }

        if (width && height) {
            const section = canvasStore.sections.find(s => s.id === sectionId)
            if (section) {
                const deltaX = newX - resizeState.value.startX
                const deltaY = newY - resizeState.value.startY
                const validatedWidth = Math.max(200, Math.min(2000, Math.abs(width)))
                const validatedHeight = Math.max(80, Math.min(2000, Math.abs(height)))

                // Update store
                canvasStore.updateSection(sectionId, {
                    position: {
                        x: newX,
                        y: newY,
                        width: validatedWidth,
                        height: validatedHeight
                    }
                })

                // TASK-089: Lock group position to prevent sync from overwriting during push
                lockGroupPosition(sectionId, {
                    x: newX,
                    y: newY,
                    width: validatedWidth,
                    height: validatedHeight
                }, 'resize')

                // BUG-055 FIX: Inverse delta compensation for children
                if (deltaX !== 0 || deltaY !== 0) {
                    const vueFlowParentId = `section-${sectionId}`
                    // We need to access nodes.value. Since we are inside a composable using useVueFlow(), 
                    // nodes is a Ref<Node[]>.
                    const childTaskNodes = nodes.value.filter(node =>
                        node.type === 'task' && node.parentNode === vueFlowParentId
                    )

                    console.log('📋 [BUG-055] Child task nodes to offset:', childTaskNodes.length)

                    childTaskNodes.forEach(node => {
                        const currentPos = node.position || { x: 0, y: 0 }
                        const childRelativeX = currentPos.x - deltaX
                        const childRelativeY = currentPos.y - deltaY

                        // 1. Visual update (Relative)
                        // Using node.position assignment usually triggers Vue Flow update if reactive, 
                        // but explicit updateNode is safer if we have it. 
                        // We strictly don't have updateNode imported from useVueFlow in the destructure yet.
                        // Let's rely on direct mutation or get updateNode.
                        node.position = { x: childRelativeX, y: childRelativeY }

                        // 2. Persist absolute
                        const task = taskStore.getTask(node.id)
                        if (task) {
                            taskStore.updateTask(node.id, {
                                canvasPosition: {
                                    x: newX + childRelativeX,
                                    y: newY + childRelativeY
                                }
                            })
                        }
                    })
                }
            }
        }

        // Settling logic
        isResizeSettling.value = true
        resizeState.value.isResizing = false
        // Clear after delay
        setTimeout(() => {
            isResizeSettling.value = false
        }, 500)
    }

    // Computed styles for template
    const resizeLineStyle = computed(() => ({
        backgroundColor: 'var(--brand-primary)',
        opacity: 0.2,
        transition: 'background-color 0.2s ease'
    }))

    const edgeHandleStyle = computed(() => ({
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
        handleSectionResizeStart,
        handleSectionResize,
        handleSectionResizeEnd,
        resizeLineStyle,
        edgeHandleStyle
    }
}
