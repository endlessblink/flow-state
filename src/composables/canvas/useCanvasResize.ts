import { ref, type Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '../../stores/canvas'
import { useTaskStore } from '../../stores/tasks'
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'

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

        }
    }

    const handleSectionResize = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
        const typedEvent = event as {
            params?: { width?: number; height?: number; x?: number; y?: number };
            width?: number;
            height?: number;
            x?: number;  // Add top-level x
            y?: number;  // Add top-level y
        }
        const width = typedEvent?.params?.width || typedEvent?.width
        const height = typedEvent?.params?.height || typedEvent?.height

        if (width && height) {
            resizeState.value.currentWidth = width
            resizeState.value.currentHeight = height

            // FIX: Prefer event params for immediate responsiveness (preventing lag), fallback to node
            const xParam = typedEvent?.params?.x ?? typedEvent?.x
            const yParam = typedEvent?.params?.y ?? typedEvent?.y

            if (typeof xParam === 'number') {
                resizeState.value.currentX = xParam
            } else {
                const vueFlowNode = findNode(`section-${sectionId}`)
                if (vueFlowNode) resizeState.value.currentX = vueFlowNode.position.x
            }

            if (typeof yParam === 'number') {
                resizeState.value.currentY = yParam
            } else {
                const vueFlowNode = findNode(`section-${sectionId}`)
                if (vueFlowNode) resizeState.value.currentY = vueFlowNode.position.y
            }

            // Continuous inverse delta compensation 
            const deltaX = resizeState.value.currentX - resizeState.value.startX
            const deltaY = resizeState.value.currentY - resizeState.value.startY

            // Inverse delta compensation ENABLED (Standard behavior: Children stay put in world space)
            if (!Number.isNaN(deltaX) && !Number.isNaN(deltaY) && (deltaX !== 0 || deltaY !== 0)) {
                const childIds = Object.keys(resizeState.value.childStartPositions)
                if (childIds.length > 0) {
                    childIds.forEach(childId => {
                        const startPos = resizeState.value.childStartPositions[childId]
                        if (startPos) {
                            const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)

                            if (!Number.isNaN(newRelPos.x) && !Number.isNaN(newRelPos.y)) {
                                // Use updateNode for reliable reactivity during continuous resize
                                updateNode(childId, {
                                    position: newRelPos
                                })
                            }
                        }
                    })
                }
            }
        }
    }

    const handleSectionResizeEnd = ({ sectionId, event }: { sectionId: string; event: unknown }) => {

        const vueFlowNode = findNode(`section-${sectionId}`)
        if (!vueFlowNode) {
            console.error('❌ [CanvasView] Vue Flow node not found:', sectionId)
            return
        }

        const typedEvent = event as { params?: { width?: number; height?: number }; width?: number; height?: number }
        const width = typedEvent?.params?.width || typedEvent?.width
        const height = typedEvent?.params?.height || typedEvent?.height

        // Calculate final positions (Local/Relative)
        // We use Local coordinates for Store updates to prevent double-offsetting nested groups.
        let newX = vueFlowNode.position.x
        let newY = vueFlowNode.position.y

        // REMOVED: Absolute conversion block. 
        // Logic was incorrectly adding parent position, causing corrupt store data for nested groups.

        if (width && height) {
            const section = canvasStore.groups.find(s => s.id === sectionId)
            if (section) {
                isResizeSettling.value = true
                resizeState.value.isResizing = false

                const deltaX = newX - resizeState.value.startX
                const deltaY = newY - resizeState.value.startY
                const { width: validatedWidth, height: validatedHeight } = validateDimensions(width, height)

                // Optimistic Sync: Track Change
                const { trackLocalChange, markSynced } = useCanvasOptimisticSync()
                trackLocalChange(sectionId, 'group', { x: newX, y: newY })

                // Update Store
                canvasStore.updateSection(sectionId, {
                    position: {
                        x: newX,
                        y: newY,
                        width: validatedWidth,
                        height: validatedHeight
                    }
                })

                // Mark as synced immediately since we just updated the store
                markSynced(sectionId)

                // Update children's RELATIVE positions in Store (Persistence)
                // Since we used Inverse Delta, children stayed put in World Space.
                // This means their Relative Position inside this group CHANGED.
                // We must update Nested Groups. Tasks (Absolute) don't need update.
                if (deltaX !== 0 || deltaY !== 0) {
                    const childIds = Object.keys(resizeState.value.childStartPositions)

                    childIds.forEach(childId => {
                        const startPos = resizeState.value.childStartPositions[childId]
                        if (startPos) {
                            const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)

                            // 1. Nested Groups (Store Relative)
                            if (childId.startsWith('section-')) {
                                const realGroupId = childId.replace('section-', '')
                                const childGroup = canvasStore.groups.find(g => g.id === realGroupId)

                                if (childGroup) {
                                    // FIX: Must include width/height to prevent data corruption/crashes
                                    canvasStore.updateSection(realGroupId, {
                                        position: {
                                            x: newRelPos.x,
                                            y: newRelPos.y,
                                            width: childGroup.position.width,
                                            height: childGroup.position.height
                                        }
                                    })
                                }
                            }

                            // 2. Tasks (Store Absolute)
                            // Since World Position is constant, and Store uses Absolute,
                            // we do NOT need to update tasks. 
                            // syncNodes will re-calculate correct Relative from (TaskAbs - GroupAbs).
                        }
                    })
                }

                // Settling timeout
                setTimeout(() => {
                    isResizeSettling.value = false
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
