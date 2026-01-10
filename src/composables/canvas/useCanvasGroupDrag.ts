import { type Ref } from 'vue'
import { type Node } from '@vue-flow/core'
import { type CanvasSection, useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasParentChild } from './useCanvasParentChild'
import { isNodeMoreThanHalfInside } from '@/utils/geometry'
import { lockGroupPosition, lockTaskPosition } from '@/utils/canvasStateLock'

interface GroupDragDeps {
    nodes: Ref<Node[]>
    dragStartPositions: Map<string, { x: number; y: number }>
}

export function useCanvasGroupDrag(deps: GroupDragDeps) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()

    // De-couple from the main composable by importing dependencies directly or passing them in
    // For now, we reuse the shared logic
    const { getSectionAbsolutePosition } = useCanvasParentChild(deps.nodes, canvasStore.groups)

    const handleGroupDragStop = async (node: Node, draggedNodes: Node[]) => {
        const sectionId = node.id.replace('section-', '')
        const section = canvasStore.groups.find(s => s.id === sectionId)

        if (!section) return

        // Cleanup start position
        deps.dragStartPositions.delete(node.id)

        // Get absolute visual position using Vue Flow's computed position for accuracy
        // For root nodes, position IS absolute. For child nodes, computedPosition IS absolute.
        const computedPos = (node as any).computedPosition
        const nodePos = node.position

        let absoluteX: number
        let absoluteY: number

        if (!node.parentNode) {
            absoluteX = Number.isFinite(nodePos.x) ? nodePos.x : section.position.x
            absoluteY = Number.isFinite(nodePos.y) ? nodePos.y : section.position.y
        } else {
            absoluteX = computedPos && Number.isFinite(computedPos.x) ? computedPos.x : section.position.x
            absoluteY = computedPos && Number.isFinite(computedPos.y) ? computedPos.y : section.position.y
        }



        const oldBounds = {
            width: section.position.width,
            height: section.position.height
        }

        // Handle resizing that might have happened via style updates during drag?
        // Usually drag doesn't resize, but we check style just in case
        const newWidth = node.style && typeof node.style === 'object' && 'width' in node.style
            ? parseInt(String(node.style.width))
            : oldBounds.width
        const newHeight = node.style && typeof node.style === 'object' && 'height' in node.style
            ? parseInt(String(node.style.height))
            : oldBounds.height

        // 1. Determine Intended Parent (Containment)
        let newParentGroupId: string | null = section.parentGroupId || null

        // Check if moved OUT of current parent
        if (section.parentGroupId) {
            const currentParent = canvasStore.groups.find(s => s.id === section.parentGroupId)
            if (currentParent) {
                const stillInside = (
                    absoluteX >= currentParent.position.x &&
                    absoluteY >= currentParent.position.y &&
                    absoluteX + oldBounds.width <= currentParent.position.x + currentParent.position.width &&
                    absoluteY + oldBounds.height <= currentParent.position.y + currentParent.position.height
                )
                if (!stillInside) {
                    newParentGroupId = null
                }
            } else {
                newParentGroupId = null
            }
        }

        // Check if moved INTO a new parent (if currently root or moved out)
        if (!newParentGroupId) {
            const sectionArea = oldBounds.width * newHeight
            let containingParent: CanvasSection | null = null
            const sections = canvasStore.groups || []

            sections.forEach(potentialParent => {
                if (potentialParent.id === sectionId) return
                if (potentialParent.parentGroupId === sectionId) return // Prevent circular parenting

                // Get parent's absolute position for accurate comparison (Using Section Object)
                const parentAbsPos = getSectionAbsolutePosition(potentialParent)
                const parentAbsX = parentAbsPos.x
                const parentAbsY = parentAbsPos.y
                const parentWidth = potentialParent.position.width
                const parentHeight = potentialParent.position.height

                const parentArea = parentWidth * parentHeight

                // Relaxed strictness: Parent must be at least 5% larger (BUG-025)
                if (parentArea <= sectionArea * 1.05) return

                // STRICT CONTAINMENT: Must be FULLY inside to trigger parenting
                // Prevents "sticky" behavior where groups grab nearby passersby
                const isFullyInside = (
                    absoluteX >= parentAbsX &&
                    absoluteY >= parentAbsY &&
                    absoluteX + newWidth <= parentAbsX + parentWidth &&
                    absoluteY + newHeight <= parentAbsY + parentHeight
                )

                if (isFullyInside) {
                    // Find the SMALLEST containing parent (best fit)
                    if (!containingParent || parentArea < (containingParent.position.width * containingParent.position.height)) {
                        containingParent = potentialParent
                    }
                }
            })

            if (containingParent) {
                newParentGroupId = (containingParent as CanvasSection).id
            }
        }

        // 2. Calculate Final Store Position (Relative vs Absolute)
        let finalStoreX = absoluteX
        let finalStoreY = absoluteY

        if (newParentGroupId) {
            // RELATIVE Calculation
            // We need parent's absolute position to subtract it
            const parentSection = canvasStore.groups.find(s => s.id === newParentGroupId)

            if (parentSection) {
                const parentAbsPos = getSectionAbsolutePosition(parentSection)
                finalStoreX = absoluteX - parentAbsPos.x
                finalStoreY = absoluteY - parentAbsPos.y
            }
        }

        // 3. Lock UI (Target Absolute Position)
        // We always lock the visual absolute position to prevent jitter during sync
        lockGroupPosition(sectionId, {
            x: absoluteX,
            y: absoluteY,
            width: newWidth,
            height: newHeight
        }, 'drag')

        // 4. Update Store
        await canvasStore.updateSectionWithUndo(sectionId, {
            position: {
                x: finalStoreX,
                y: finalStoreY, // Store relative if parented, absolute if root
                width: newWidth,
                height: newHeight
            },
            parentGroupId: newParentGroupId
        })

        // 5. Immediate Visual Update (Vue Flow Node)
        // Update the node's position and parent immediately to prevent flickering while waiting for sync
        const nodeIndex = deps.nodes.value.findIndex(n => n.id === node.id)
        if (nodeIndex !== -1) {
            const newParentNodeId = newParentGroupId ? `section-${newParentGroupId}` : undefined

            // Determine z-index based on parent
            let childZIndex = 0
            if (newParentNodeId) {
                const parentNode = deps.nodes.value.find(n => n.id === newParentNodeId)
                const parentZInt = (parentNode?.style as any)?.zIndex
                    ? parseInt(String((parentNode?.style as any).zIndex))
                    : 0
                childZIndex = parentZInt + 1
            }

            deps.nodes.value[nodeIndex] = {
                ...deps.nodes.value[nodeIndex],
                parentNode: newParentNodeId,
                position: { x: finalStoreX, y: finalStoreY }, // Relative to new parent
                style: {
                    ...deps.nodes.value[nodeIndex].style as any,
                    zIndex: childZIndex
                }
            }
        }

        // BUG-184 FIX: Update child task positions in the store
        // While Vue Flow handles visual positioning automatically (children move with parent),
        // the task store's canvasPosition (ABSOLUTE) needs to be updated for:
        // 1. Position persistence on refresh
        // 2. Accurate task counting (isPointInRect checks)
        // 3. Nested group cascading

        // Calculate how much this group moved using proper absolute position (handles deep nesting)
        const oldGroupAbsPos = getSectionAbsolutePosition(section)
        const deltaX = absoluteX - oldGroupAbsPos.x
        const deltaY = absoluteY - oldGroupAbsPos.y

        if (deltaX !== 0 || deltaY !== 0) {

            // Recursively get all groups that are descendants of this group
            const getDescendantGroupIds = (parentId: string, visited = new Set<string>()): string[] => {
                if (visited.has(parentId)) return []
                visited.add(parentId)
                const result: string[] = []
                canvasStore.groups.forEach(g => {
                    if (g.parentGroupId === parentId) {
                        result.push(g.id)
                        result.push(...getDescendantGroupIds(g.id, visited))
                    }
                })
                return result
            }

            // Get all groups to check (this group + all descendants)
            const groupsToCheck = [sectionId, ...getDescendantGroupIds(sectionId)]

            // Find all child task nodes that belong to this group or its descendants
            const childTaskNodes = deps.nodes.value.filter(n => {
                if (n.id.startsWith('section-')) return false // Skip group nodes
                const parentNodeId = n.parentNode?.replace('section-', '')
                return parentNodeId && groupsToCheck.includes(parentNodeId)
            })

            // Update each child task's canvasPosition in the store
            for (const taskNode of childTaskNodes) {
                const task = taskStore.tasks.find(t => t.id === taskNode.id)
                if (task && task.canvasPosition) {
                    const newAbsX = task.canvasPosition.x + deltaX
                    const newAbsY = task.canvasPosition.y + deltaY


                    // Lock to prevent sync overwrite
                    lockTaskPosition(taskNode.id, { x: newAbsX, y: newAbsY })

                    // Update store (don't await to allow parallel updates)
                    taskStore.updateTask(taskNode.id, {
                        canvasPosition: { x: newAbsX, y: newAbsY }
                    }).catch(err => {
                        // Silent fail for background background update
                    })
                }
            }
        }
    }

    return {
        handleGroupDragStop
    }
}
