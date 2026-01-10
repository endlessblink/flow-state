import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { type Task } from '@/stores/tasks'
import { useCanvasParentChild } from './useCanvasParentChild'
import { useNodeAttachment } from './useNodeAttachment'
import { isGroupDeleted } from '@/utils/deletedGroupsTracker'
import { getLockedTaskPosition, isGroupPositionLocked } from '@/utils/canvasStateLock'

// Minimal interface for dependencies needed by node sync
interface NodeSyncDeps {
    nodes: Ref<Node[]>
    filteredTasks: Ref<Task[]> // Can be empty array fallback
    recentlyDeletedGroups: Ref<Set<string>>
    isNodeDragging: Ref<boolean>
    isDragSettlingRef: Ref<boolean>
    isSyncing: Ref<boolean>
}

export function useCanvasNodeSync(deps: NodeSyncDeps) {
    const canvasStore = useCanvasStore()

    // Helper for graceful store access
    const safeStoreOperation = <T>(
        operation: () => T,
        fallback: T,
        operationName: string
    ): T => {
        try {
            return operation()
        } catch (error) {
            console.error(`❌ ${operationName} failed:`, error)
            return fallback
        }
    }

    const cleanupStaleNodes = () => {
        // No-op for now as Vue Flow manages DOM, but kept for interface consistency if needed
    }

    const syncNodes = () => {
        deps.isSyncing.value = true

        try {
            const sections = safeStoreOperation(
                () => canvasStore.groups || [],
                [] as CanvasSection[],
                'canvas sections access'
            )

            const tasks = deps.filteredTasks.value || []
            const desiredNodeMap = new Map<string, Node>()

            const {
                getSectionAbsolutePosition,
                isActuallyInsideParent,
                calculateZIndex,
                findSectionForTask
            } = useCanvasParentChild(deps.nodes, canvasStore.groups)

            // --- Process Sections ---
            const existingSectionPositions = new Map<string, { x: number; y: number }>()
            deps.nodes.value.forEach(n => {
                if (n.type === 'sectionNode') {
                    existingSectionPositions.set(n.id, { x: n.position.x, y: n.position.y })
                }
            })

            sections.forEach(section => {
                const isInMemoryDeleted = deps.recentlyDeletedGroups?.value?.has(section.id)
                const isPersistentDeleted = isGroupDeleted(section.id)
                if (isInMemoryDeleted || isPersistentDeleted) {
                    return
                }

                const taskCount = canvasStore.getTaskCountInGroupRecursive(section.id, Array.isArray(tasks) ? tasks : [])

                let parentNode: string | undefined = undefined
                let position = { x: section.position?.x ?? 0, y: section.position?.y ?? 0 }
                const nodeId = `section-${section.id}`
                const existingPos = existingSectionPositions.get(nodeId)
                const isLocked = isGroupPositionLocked(section.id)

                if (isLocked && existingPos) {
                    position = { x: existingPos.x, y: existingPos.y }
                    if (section.parentGroupId) {
                        const parentGroup = sections.find(s => s.id === section.parentGroupId)
                        if (parentGroup && isActuallyInsideParent(section, parentGroup)) {
                            parentNode = `section-${parentGroup.id}`
                        } else if (parentGroup) {
                            console.warn(`⚠️ [NodeSync] Section "${section.name}" has stale parentGroupId`)
                        }
                    }
                } else if (section.parentGroupId && section.parentGroupId !== 'NONE') {
                    const parentGroup = sections.find(s => s.id === section.parentGroupId)
                    if (parentGroup) {
                        parentNode = `section-${parentGroup.id}`
                        if (existingPos) {
                            position = { x: existingPos.x, y: existingPos.y }
                        } else {
                            position = { x: section.position?.x ?? 0, y: section.position?.y ?? 0 }
                        }
                    }
                }

                const zIndex = calculateZIndex(section, false)

                if (existingPos && (deps.isNodeDragging.value || deps.isDragSettlingRef.value)) {
                    position = { x: existingPos.x, y: existingPos.y }
                }

                desiredNodeMap.set(nodeId, {
                    id: nodeId,
                    type: 'sectionNode',
                    position,
                    parentNode,
                    data: {
                        id: section.id,
                        name: section.name,
                        label: section.name,
                        section,
                        width: section.position?.width ?? 300,
                        height: section.position?.height ?? 200,
                        isCollapsed: section.isCollapsed || false,
                        theme: (section as unknown as { theme?: string }).theme || 'default',
                        taskCount,
                        type: section.type,
                        color: section.color
                    },
                    style: {
                        width: `${Number.isFinite(section.position?.width) ? section.position?.width : 300}px`,
                        height: `${Number.isFinite(section.position?.height) ? section.position?.height : 200}px`,
                        zIndex
                    },
                    draggable: true,
                    selectable: true,
                    connectable: false,
                    expandParent: false
                })
            })

            // --- Process Tasks ---
            const existingNodeParents = new Map<string, string | undefined>()
            const existingNodePositions = new Map<string, { x: number; y: number }>()
            deps.nodes.value.forEach(n => {
                if (n.type === 'taskNode') {
                    existingNodeParents.set(n.id, n.parentNode)
                    existingNodePositions.set(n.id, { x: n.position.x, y: n.position.y })
                }
            })

            tasks.forEach(task => {
                if (task.canvasPosition) {
                    let parentNode = undefined
                    const lockedPosition = getLockedTaskPosition(task.id)
                    const existingPos = existingNodePositions.get(task.id)
                    const existingParent = existingNodeParents.get(task.id)
                    const taskExistsInNodes = existingNodeParents.has(task.id)

                    // LOCKED TASK LOGIC (Short-circuit)
                    if (lockedPosition && taskExistsInNodes && existingPos) {
                        let finalParent = existingParent
                        let finalPos = { x: existingPos.x, y: existingPos.y }

                        if (existingParent && lockedPosition) {
                            const parentSectionId = existingParent.replace('section-', '')
                            const parentSection = sections.find(s => s.id === parentSectionId)

                            if (parentSection) {
                                const taskCenter = { x: lockedPosition.x + 110, y: lockedPosition.y + 50 }
                                const parentAbsPos = getSectionAbsolutePosition(parentSection)
                                const parentRect = {
                                    x: parentAbsPos.x,
                                    y: parentAbsPos.y,
                                    width: parentSection.position.width,
                                    height: parentSection.position.height
                                }

                                const isInside = (
                                    taskCenter.x >= parentRect.x &&
                                    taskCenter.x <= parentRect.x + parentRect.width &&
                                    taskCenter.y >= parentRect.y &&
                                    taskCenter.y <= parentRect.y + parentRect.height
                                )

                                if (!isInside) {
                                    console.log(`🧟 [NodeSync] Curing Zombie Task ${task.id}`)
                                    finalParent = undefined
                                    finalPos = { x: lockedPosition.x, y: lockedPosition.y }
                                }
                            } else {
                                finalParent = undefined
                                finalPos = { x: lockedPosition.x, y: lockedPosition.y }
                            }
                        }

                        desiredNodeMap.set(task.id, {
                            id: task.id,
                            type: 'taskNode',
                            position: finalPos,
                            data: { task: { ...task } },
                            parentNode: finalParent,
                            expandParent: false,
                            zIndex: 1000,
                            draggable: true,
                            connectable: true,
                            selectable: true
                        })
                        return
                    }

                    // STANDARD TASK LOGIC
                    let position = lockedPosition
                        ? { x: lockedPosition.x, y: lockedPosition.y }
                        : { ...task.canvasPosition }

                    let skipContainmentCalc = false

                    if (taskExistsInNodes) {
                        if (existingParent && existingParent !== 'undefined') {
                            const sectionId = existingParent.replace('section-', '')
                            const section = sections.find(s => s.id === sectionId)

                            let targetAbsoluteX = position.x
                            let targetAbsoluteY = position.y

                            if (section) {
                                const parentAbsPos = getSectionAbsolutePosition(section)

                                if (existingPos && !lockedPosition) {
                                    const { calculateAbsolutePosition } = useNodeAttachment()
                                    const metrics = { borderLeft: 2, borderTop: 2, paddingLeft: 0, paddingTop: 0 }
                                    const absPos = calculateAbsolutePosition(existingPos, parentAbsPos, metrics)
                                    targetAbsoluteX = absPos.x
                                    targetAbsoluteY = absPos.y
                                }

                                const taskCenter = { x: targetAbsoluteX + 110, y: targetAbsoluteY + 50 }
                                const parentRect = {
                                    x: parentAbsPos.x,
                                    y: parentAbsPos.y,
                                    width: section.position.width,
                                    height: section.position.height
                                }

                                const isInside = (
                                    taskCenter.x >= parentRect.x &&
                                    taskCenter.x <= parentRect.x + parentRect.width &&
                                    taskCenter.y >= parentRect.y &&
                                    taskCenter.y <= parentRect.y + parentRect.height
                                )

                                if (isInside) {
                                    parentNode = existingParent
                                    if (existingPos && !lockedPosition) {
                                        position = { x: existingPos.x, y: existingPos.y }
                                    } else {
                                        const { calculateRelativePosition, getParentMetrics } = useNodeAttachment()
                                        const metrics = getParentMetrics(`section-${section.id}`) || { borderLeft: 0, borderTop: 0, paddingLeft: 0, paddingTop: 0 }
                                        const relPos = calculateRelativePosition(
                                            { x: targetAbsoluteX, y: targetAbsoluteY },
                                            parentAbsPos,
                                            metrics
                                        )
                                        if (Number.isFinite(relPos.x) && Number.isFinite(relPos.y)) {
                                            position = relPos
                                        }
                                    }
                                    skipContainmentCalc = true
                                } else {
                                    parentNode = undefined
                                    skipContainmentCalc = false
                                }
                            } else {
                                parentNode = undefined
                                skipContainmentCalc = false
                            }
                        } else {
                            // ROOT LEVEL check
                            const canvasPos = task.canvasPosition || { x: 0, y: 0 }
                            const positionChanged = existingPos && (
                                Math.abs(existingPos.x - canvasPos.x) > 5 ||
                                Math.abs(existingPos.y - canvasPos.y) > 5
                            )

                            if (positionChanged) {
                                position = { x: canvasPos.x, y: canvasPos.y }
                            } else if (existingPos) {
                                position = { x: existingPos.x, y: existingPos.y }
                                skipContainmentCalc = true
                            }
                        }
                    }

                    if (!skipContainmentCalc) {
                        const TASK_WIDTH = 220
                        const TASK_HEIGHT = 100
                        const center = {
                            x: position.x + TASK_WIDTH / 2,
                            y: position.y + TASK_HEIGHT / 2
                        }

                        const section = findSectionForTask(center)

                        if (section) {
                            const sectionAbsPos = getSectionAbsolutePosition(section)
                            const relX = position.x - sectionAbsPos.x
                            const relY = position.y - sectionAbsPos.y

                            if (Number.isFinite(relX) && Number.isFinite(relY)) {
                                parentNode = `section-${section.id}`
                                position = { x: relX, y: relY }
                            }
                        }
                    }

                    desiredNodeMap.set(task.id, {
                        id: task.id,
                        type: 'taskNode',
                        position,
                        data: { task: { ...task } },
                        parentNode,
                        expandParent: false,
                        zIndex: 1000,
                        draggable: true,
                        connectable: true,
                        selectable: true
                    })
                }
            })

            // 2. Diff & Patch Logic
            const currentNodes = [...deps.nodes.value]
            const nodesToRemove = new Set<string>()
            const nodesToAdd: Node[] = []
            const nodesToUpdate: { index: number; node: Node }[] = []

            currentNodes.forEach((node, index) => {
                const desired = desiredNodeMap.get(node.id)
                if (!desired) {
                    nodesToRemove.add(node.id)
                } else {
                    nodesToUpdate.push({ index, node: desired })
                    desiredNodeMap.delete(node.id)
                }
            })

            for (const newNode of desiredNodeMap.values()) {
                nodesToAdd.push(newNode)
            }

            // 3. Apply Updates safely
            if (nodesToRemove.size > 0) {
                deps.nodes.value = deps.nodes.value.filter(n => !nodesToRemove.has(n.id))
            }

            nodesToUpdate.forEach(({ node }) => {
                const target = deps.nodes.value.find(n => n.id === node.id)
                if (target) {
                    let changed = false

                    if (Math.abs(target.position.x - node.position.x) > 0.01 ||
                        Math.abs(target.position.y - node.position.y) > 0.01) {
                        target.position = node.position
                        changed = true
                    }

                    if (node.type === 'taskNode') {
                        const oldTask = target.data.task as Task
                        const newTask = node.data.task as Task

                        if (oldTask.id !== newTask.id ||
                            oldTask.status !== newTask.status ||
                            oldTask.priority !== newTask.priority ||
                            oldTask.title !== newTask.title ||
                            oldTask.updatedAt !== newTask.updatedAt) {
                            target.data = node.data
                            changed = true
                        }
                    } else {
                        // Section updates
                        const propsToCheck = ['label', 'width', 'height', 'isCollapsed', 'taskCount', 'name', 'color']
                        propsToCheck.forEach(prop => {
                            if (target.data[prop] !== node.data[prop]) {
                                target.data[prop] = node.data[prop]
                                changed = true
                            }
                        })
                    }

                    if (target.parentNode !== node.parentNode) {
                        target.parentNode = node.parentNode
                        changed = true
                    }
                    if (target.zIndex !== node.zIndex) {
                        target.zIndex = node.zIndex
                        changed = true
                    }
                }
            })

            if (nodesToAdd.length > 0) {
                deps.nodes.value = [...deps.nodes.value, ...nodesToAdd]
            }

            nextTick(() => cleanupStaleNodes())

        } catch (error) {
            console.error('❌ Critical error in syncNodes():', error)
        } finally {
            deps.isSyncing.value = false
        }
    }

    return {
        syncNodes,
        cleanupStaleNodes
    }
}
