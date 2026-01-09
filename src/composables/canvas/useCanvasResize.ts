import { ref, computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '../../stores/canvas'
import { useTaskStore } from '../../stores/tasks'
// TASK-089: Canvas state lock to prevent sync from overwriting user changes
import { lockTaskPosition, lockGroupPosition } from '../../utils/canvasStateLock'

import { type Ref } from 'vue'

export function useCanvasResize(deps?: {
    findNode: (id: string) => any
    updateNode: (id: string, node: any) => void
    nodes: Ref<any[]>
}) {
    // BUG-056 FIX: Use provided deps if available, otherwise fallback to useVueFlow() with safety check
    let vueFlow: ReturnType<typeof useVueFlow> | null = null
    try {
        if (!deps) {
            vueFlow = useVueFlow()
        }
    } catch (e) {
        console.warn('⚠️ [CANVAS-RESIZE] useVueFlow context not found and deps not provided')
    }

    const findNode = deps?.findNode || vueFlow?.findNode || (() => null)
    const updateNode = deps?.updateNode || vueFlow?.updateNode || (() => { })
    const nodes = (deps?.nodes || vueFlow?.nodes || ref([])) as Ref<any[]>

    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()

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
        resizeStartTime: 0,
        childStartPositions: {} as Record<string, { x: number; y: number }>
    })


    // BUG-055 FIX: Track resize settling period
    const isResizeSettling = ref(false)

    // Handlers
    const handleSectionResizeStart = ({ sectionId, event: _event }: { sectionId: string; event: unknown }) => {
        const section = canvasStore.groups.find(s => s.id === sectionId)
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
                resizeStartTime: Date.now(),
                childStartPositions: {} as Record<string, { x: number; y: number }>
            }

            // BUG-055: Capture start positions from Vue Flow node directly for coordinate space alignment
            const vueFlowNode = findNode(`section-${sectionId}`)
            if (vueFlowNode) {
                resizeState.value.startX = vueFlowNode.position.x
                resizeState.value.startY = vueFlowNode.position.y
            }

            // Capture initial positions of children for continuous auto-correction
            const vueFlowParentId = `section-${sectionId}`
            // Note: nodes is a Ref from useVueFlow
            if (nodes.value) {
                nodes.value.forEach(node => {
                    // FIX: node.type in Pomo Flow is 'taskNode', not 'task'
                    if (node.type === 'taskNode' && node.parentNode === vueFlowParentId) {
                        resizeState.value.childStartPositions[node.id] = { ...node.position }
                    }
                })
            }

            console.log('🎬 [Resize] Started:', {
                sectionId,
                startX: section.position.x,
                startY: section.position.y,
                startWidth: section.position.width,
                startHeight: section.position.height,
                resizeState: { ...resizeState.value },
                childCount: Object.keys(resizeState.value.childStartPositions).length
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

            // BUG-055 FIX: Continuous inverse delta compensation for children during resize
            // This prevents visual "riding" of tasks when resizing from Top/Left
            const deltaX = resizeState.value.currentX - resizeState.value.startX
            const deltaY = resizeState.value.currentY - resizeState.value.startY

            if (deltaX !== 0 || deltaY !== 0) {
                const childIds = Object.keys(resizeState.value.childStartPositions)

                // Add window log to ensure it's visible in browser tests
                if (typeof window !== 'undefined') {
                    (window as any).lastResizeEvent = { deltaX, deltaY, children: childIds.length }
                }

                if (childIds.length > 0) {
                    const vueFlowParentId = `section-${sectionId}`

                    if (nodes.value) {
                        nodes.value.forEach(node => {
                            if (node.type === 'taskNode' && node.parentNode === vueFlowParentId && resizeState.value.childStartPositions[node.id]) {
                                const startPos = resizeState.value.childStartPositions[node.id]
                                const newRelX = startPos.x - deltaX
                                const newRelY = startPos.y - deltaY

                                // Use updateNode for reliable reactivity during continuous resize
                                updateNode(node.id, {
                                    position: { x: newRelX, y: newRelY }
                                })
                            }
                        })
                    }
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
        const sectionForParentCheck = canvasStore.groups.find(s => s.id === sectionId)
        if (sectionForParentCheck?.parentGroupId) {
            const parentGroup = canvasStore.groups.find(s => s.id === sectionForParentCheck.parentGroupId)
            if (parentGroup) {
                newX = vueFlowNode.position.x + parentGroup.position.x
                newY = vueFlowNode.position.y + parentGroup.position.y
                console.log('🔄 [BUG-055] Converted nested group position from relative to absolute')
            }
        }

        if (width && height) {
            const section = canvasStore.groups.find(s => s.id === sectionId)
            if (section) {
                // TASK-149 FIX: Set settling flags BEFORE any async store operations
                // This prevents syncNodes from running during the update sequence
                isResizeSettling.value = true
                resizeState.value.isResizing = false

                const deltaX = newX - resizeState.value.startX
                const deltaY = newY - resizeState.value.startY
                const validatedWidth = Math.max(200, Math.min(50000, Math.abs(width)))
                const validatedHeight = Math.max(80, Math.min(50000, Math.abs(height)))

                // CRITICAL FIX: Lock BEFORE store update to prevent watcher race condition
                // Store update triggers watchers → syncNodes, lock must exist first
                lockGroupPosition(sectionId, {
                    x: newX,
                    y: newY,
                    width: validatedWidth,
                    height: validatedHeight
                }, 'resize')

                console.log('🔄 [Resize Debug] Updating section in store:', {
                    sectionId, deltaX, deltaY, newX, newY, resizeState: { ...resizeState.value }
                })

                // Update store (now protected by lock)
                canvasStore.updateSection(sectionId, {
                    position: {
                        x: newX,
                        y: newY,
                        width: validatedWidth,
                        height: validatedHeight
                    }
                })

                // BUG-055 FIX: Inverse delta compensation for children
                if (deltaX !== 0 || deltaY !== 0) {
                    const vueFlowParentId = `section-${sectionId}`
                    // We need to access nodes.value. Since we are inside a composable using useVueFlow(),
                    // nodes is a Ref<Node[]>.
                    const childTaskNodes = nodes.value.filter(node =>
                        node.type === 'taskNode' && node.parentNode === vueFlowParentId
                    )

                    console.log('📋 [BUG-055] Child task nodes to offset:', childTaskNodes.length)

                    childTaskNodes.forEach(node => {
                        const currentPos = node.position || { x: 0, y: 0 }
                        const childRelativeX = currentPos.x - deltaX
                        const childRelativeY = currentPos.y - deltaY

                        // 1. Visual update (Relative)
                        // Use updateNode for final authoritative position
                        updateNode(node.id, {
                            position: { x: childRelativeX, y: childRelativeY }
                        })

                        // 2. Persist absolute
                        const task = taskStore.getTask(node.id)
                        if (task) {
                            // Ensure lock is updated to prevent sync overrides
                            const taskAbsX = newX + childRelativeX
                            const taskAbsY = newY + childRelativeY
                            lockTaskPosition(node.id, { x: taskAbsX, y: taskAbsY })

                            taskStore.updateTask(node.id, {
                                canvasPosition: {
                                    x: taskAbsX,
                                    y: taskAbsY
                                }
                            })
                        }
                    })

                    // FIX: Also handle child SECTION nodes (nested groups)
                    const childSectionNodes = nodes.value.filter(node =>
                        node.type === 'sectionNode' && node.parentNode === vueFlowParentId
                    )

                    console.log('📋 [RESIZE-FIX] Child section nodes to offset:', childSectionNodes.length)

                    childSectionNodes.forEach(node => {
                        const currentPos = node.position || { x: 0, y: 0 }
                        const childRelativeX = currentPos.x - deltaX
                        const childRelativeY = currentPos.y - deltaY

                        // 1. Visual update (Relative)
                        updateNode(node.id, {
                            position: { x: childRelativeX, y: childRelativeY }
                        })

                        // 2. Persist absolute and lock
                        const childSectionId = node.id.replace('section-', '')
                        const childSection = canvasStore.groups.find(s => s.id === childSectionId)
                        if (childSection) {
                            const childAbsX = newX + childRelativeX
                            const childAbsY = newY + childRelativeY

                            // Lock to prevent sync overrides
                            lockGroupPosition(childSectionId, {
                                x: childAbsX,
                                y: childAbsY,
                                width: childSection.position.width,
                                height: childSection.position.height
                            }, 'resize')

                            // Update store
                            canvasStore.updateSection(childSectionId, {
                                position: {
                                    x: childAbsX,
                                    y: childAbsY,
                                    width: childSection.position.width,
                                    height: childSection.position.height
                                }
                            })

                            console.log(`📦 [RESIZE-FIX] Updated nested group "${childSection.name}" position`)
                        }
                    })
                }

                // TASK-089: Lock group position at end of resize
                lockGroupPosition(sectionId, {
                    x: newX,
                    y: newY,
                    width: validatedWidth,
                    height: validatedHeight
                })

                // TASK-149: Longer settling period (1000ms instead of 500ms) to ensure all sync cycles complete
                setTimeout(() => {
                    isResizeSettling.value = false
                    console.log('%c[TASK-149] Resize settling complete - syncNodes unblocked', 'color: #4CAF50')
                }, 1000)
            }
        }
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
