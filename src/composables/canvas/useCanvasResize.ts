import { ref, type Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '../../stores/canvas'
import { useTaskStore } from '../../stores/tasks'
import { lockTaskPosition, lockGroupPosition } from '../../utils/canvasStateLock'

// Imported Composables
import { useCanvasResizeState } from './useCanvasResizeState'
import { useCanvasResizeCalculation } from './useCanvasResizeCalculation'

export function useCanvasResize(deps?: {
    findNode: (id: string) => any
    updateNode: (id: string, node: any) => void
    nodes: Ref<any[]>
}) {
    // Fallback to internal Vue Flow instance if deps not provided
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

    // --- Instantiate Sub-Composables ---
    const { resizeState, isResizeSettling, resizeLineStyle, edgeHandleStyle } = useCanvasResizeState()
    const { validateDimensions, calculateChildInverseDelta, calculateChildAbsolutePosition } = useCanvasResizeCalculation()

    // --- Handlers ---

    const handleSectionResizeStart = ({ sectionId, event: _event }: { sectionId: string; event: unknown }) => {
        const section = canvasStore.groups.find(s => s.id === sectionId)
        if (section) {
            // Get authoritative start position from Vue Flow node if available
            let startX = section.position.x
            let startY = section.position.y
            const vueFlowNode = findNode(`section-${sectionId}`)
            if (vueFlowNode) {
                startX = vueFlowNode.position.x
                startY = vueFlowNode.position.y
            }

            resizeState.value = {
                isResizing: true,
                sectionId: sectionId,
                startX,
                startY,
                startWidth: section.position.width,
                startHeight: section.position.height,
                currentX: startX,
                currentY: startY,
                currentWidth: section.position.width,
                currentHeight: section.position.height,
                handlePosition: null,
                isDragging: false,
                resizeStartTime: Date.now(),
                childStartPositions: {}
            }

            // Capture initial positions of children for continuous auto-correction
            const vueFlowParentId = `section-${sectionId}`
            if (nodes.value) {
                nodes.value.forEach(node => {
                    // FIX: node.type in Pomo Flow is 'taskNode'
                    if (node.type === 'taskNode' && node.parentNode === vueFlowParentId) {
                        resizeState.value.childStartPositions[node.id] = { ...node.position }
                    }
                    // FIX: Also track nested groups (child sections)
                    if (node.type === 'sectionNode' && node.parentNode === vueFlowParentId) {
                        resizeState.value.childStartPositions[node.id] = { ...node.position }
                    }
                })
            }

            console.log('🎬 [Resize] Started:', { sectionId, startX, startY, childCount: Object.keys(resizeState.value.childStartPositions).length })
        }
    }

    const handleSectionResize = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
        const typedEvent = event as { params?: { width?: number; height?: number; x?: number; y?: number }; width?: number; height?: number }
        const width = typedEvent?.params?.width || typedEvent?.width
        const height = typedEvent?.params?.height || typedEvent?.height

        if (width && height) {
            resizeState.value.currentWidth = width
            resizeState.value.currentHeight = height

            // Always read position from Vue Flow node (source of truth)
            const vueFlowNode = findNode(`section-${sectionId}`)
            if (vueFlowNode) {
                resizeState.value.currentX = vueFlowNode.position.x
                resizeState.value.currentY = vueFlowNode.position.y
            } else if (typeof typedEvent?.params?.x === 'number') {
                resizeState.value.currentX = typedEvent.params.x
                if (typeof typedEvent?.params?.y === 'number') {
                    resizeState.value.currentY = typedEvent.params.y
                }
            }

            // Continuous inverse delta compensation 
            const deltaX = resizeState.value.currentX - resizeState.value.startX
            const deltaY = resizeState.value.currentY - resizeState.value.startY

            if (deltaX !== 0 || deltaY !== 0) {
                const childIds = Object.keys(resizeState.value.childStartPositions)
                if (childIds.length > 0) {
                    childIds.forEach(childId => {
                        const startPos = resizeState.value.childStartPositions[childId]
                        if (startPos) {
                            const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)
                            // Use updateNode for reliable reactivity during continuous resize
                            updateNode(childId, {
                                position: newRelPos
                            })
                        }
                    })
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

        // Check nested group status (convert relative to absolute if needed)
        const sectionForParentCheck = canvasStore.groups.find(s => s.id === sectionId)
        if (sectionForParentCheck?.parentGroupId) {
            const parentGroup = canvasStore.groups.find(s => s.id === sectionForParentCheck.parentGroupId)
            if (parentGroup) {
                newX = vueFlowNode.position.x + parentGroup.position.x
                newY = vueFlowNode.position.y + parentGroup.position.y
            }
        }

        if (width && height) {
            const section = canvasStore.groups.find(s => s.id === sectionId)
            if (section) {
                isResizeSettling.value = true
                resizeState.value.isResizing = false

                const deltaX = newX - resizeState.value.startX
                const deltaY = newY - resizeState.value.startY
                const { width: validatedWidth, height: validatedHeight } = validateDimensions(width, height)

                // Lock Group
                lockGroupPosition(sectionId, {
                    x: newX,
                    y: newY,
                    width: validatedWidth,
                    height: validatedHeight
                }, 'resize')

                // Update Store
                canvasStore.updateSection(sectionId, {
                    position: {
                        x: newX,
                        y: newY,
                        width: validatedWidth,
                        height: validatedHeight
                    }
                })

                // Inverse delta compensation for children (Persist Final State)
                if (deltaX !== 0 || deltaY !== 0) {
                    const childIds = Object.keys(resizeState.value.childStartPositions)

                    childIds.forEach(childId => {
                        const startPos = resizeState.value.childStartPositions[childId]
                        if (startPos) {
                            const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)

                            // 1. Visual update (Relative)
                            updateNode(childId, {
                                position: newRelPos
                            })

                            // 2. Persist absolute
                            // Check if it is a task or a group
                            const task = taskStore.getTask(childId)
                            if (task) {
                                const newAbsPos = calculateChildAbsolutePosition({ x: newX, y: newY }, newRelPos)
                                lockTaskPosition(childId, newAbsPos)
                                taskStore.updateTask(childId, {
                                    canvasPosition: newAbsPos
                                })
                            } else {
                                // Must be a nested section
                                // Note: ID in childStartPositions is just UUID, but node ID usually is task UUID or string ID
                                // Groups in childStartPositions were stored by their node ID? 
                                // In handleSectionResizeStart we stored by `node.id`. 
                                // For sections node.id is `section-${id}`? 
                                // No, inside Vue Flow node.id is `section-uuid`. 
                                // But `resizeState.value.childStartPositions` keys are `node.id`.
                                // So we need to strip `section-` prefix if checking store.
                                const cleanId = childId.startsWith('section-') ? childId.replace('section-', '') : childId
                                const childSection = canvasStore.groups.find(s => s.id === cleanId)

                                if (childSection) {
                                    const newAbsPos = calculateChildAbsolutePosition({ x: newX, y: newY }, newRelPos)
                                    lockGroupPosition(cleanId, {
                                        x: newAbsPos.x,
                                        y: newAbsPos.y,
                                        width: childSection.position.width,
                                        height: childSection.position.height
                                    }, 'resize')

                                    canvasStore.updateSection(cleanId, {
                                        position: {
                                            x: newAbsPos.x,
                                            y: newAbsPos.y,
                                            width: childSection.position.width,
                                            height: childSection.position.height
                                        }
                                    })
                                }
                            }
                        }
                    })
                }

                // Settling timeout
                setTimeout(() => {
                    isResizeSettling.value = false
                    console.log('%c[Resize] Settling complete', 'color: #4CAF50')
                }, 1000)
            }
        }
    }

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
