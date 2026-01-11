import { type Node } from '@vue-flow/core'
import type { CanvasGroup, TaskPosition } from '@/stores/canvas/types'
import { CANVAS } from '@/constants/canvas'

// --- Interfaces ---

export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export interface Position {
    x: number
    y: number
}

/**
 * Calculates the center point of a task node.
 */
export const getTaskCenter = (x: number, y: number, width: number = 220, height: number = 100): Position => {
    return {
        x: x + (width / 2),
        y: y + (height / 2)
    }
}

// --- Containment Logic ---

/**
 * Checks if a point (x, y) is inside a rectangle.
 */
export const isPointInRect = (x: number, y: number, rect: Rect): boolean => {
    return x >= rect.x && x <= rect.x + rect.width &&
        y >= rect.y && y <= rect.y + rect.height
}

/**
 * Checks if a node is "mostly" inside a parent rect (simple center check).
 * Used for task-in-group containment.
 */
export const isTaskInsideGroup = (taskPos: Position, taskSize: { width: number, height: number }, groupRect: Rect): boolean => {
    // Logic: Center Point Containment
    const centerX = taskPos.x + (taskSize.width / 2)
    const centerY = taskPos.y + (taskSize.height / 2)
    return isPointInRect(centerX, centerY, groupRect)
}

/**
 * Checks if a Rect is more than 50% overlapping another Rect.
 * Used for group-in-group (nested groups) logic.
 */
export const isRectMoreThanHalfInside = (inner: Rect, outer: Rect): boolean => {
    const intersectionX = Math.max(inner.x, outer.x)
    const intersectionY = Math.max(inner.y, outer.y)
    const intersectionW = Math.min(inner.x + inner.width, outer.x + outer.width) - intersectionX
    const intersectionH = Math.min(inner.y + inner.height, outer.y + outer.height) - intersectionY

    if (intersectionW <= 0 || intersectionH <= 0) return false

    const intersectionArea = intersectionW * intersectionH
    const innerArea = inner.width * inner.height

    return intersectionArea > (innerArea * 0.5)
}

/**
 * Find the smallest rectangle that contains a point.
 * Returns null if point is not in any rectangle.
 */
export function findSmallestContainingRect<T extends Rect>(
    x: number,
    y: number,
    rects: T[]
): T | null {
    const containing = rects.filter(rect => isPointInRect(x, y, rect))
    if (containing.length === 0) return null

    return containing.reduce((smallest, current) => {
        const smallestArea = smallest.width * smallest.height
        const currentArea = current.width * current.height
        return currentArea < smallestArea ? current : smallest
    })
}

/**
 * Find all rectangles that contain a point, sorted by area (largest first).
 */
export function findAllContainingRects<T extends Rect>(
    x: number,
    y: number,
    rects: T[]
): T[] {
    return rects
        .filter(rect => isPointInRect(x, y, rect))
        .sort((a, b) => {
            const areaA = a.width * a.height
            const areaB = b.width * b.height
            return areaB - areaA
        })
}

// --- Position Calculation (Store Based) ---

/**
 * Recursively calculates absolute position of a group from store data.
 * @param groupId 
 * @param groups Map or Array of groups to traverse
 */
export const getGroupAbsolutePosition = (groupId: string, groups: CanvasGroup[]): Position => {
    const group = groups.find(g => g.id === groupId)
    if (!group || !group.position) return { x: 0, y: 0 }

    let x = group.position.x
    let y = group.position.y
    let parentId = group.parentGroupId
    let depth = 0
    const MAX_DEPTH = 20

    while (parentId && parentId !== 'NONE' && depth < MAX_DEPTH) {
        const parent = groups.find(g => g.id === parentId)
        if (parent && parent.position) {
            x += parent.position.x
            y += parent.position.y

            // FIX: Account for the border of each parent group
            // This is critical for 0% position drift in nested groups.
            x += CANVAS.GROUP_BORDER_WIDTH
            y += CANVAS.GROUP_BORDER_WIDTH

            parentId = parent.parentGroupId
        } else {
            break
        }
        depth++
    }
    return { x, y }
}

// --- Position Calculation (Vue Flow Based) ---

/**
 * Recursively calculates absolute position of a node from Vue Flow graph.
 * @param nodeId 
 * @param nodes 
 */
export const getAbsoluteNodePosition = (nodeId: string, nodes: Node[]): Position => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return { x: 0, y: 0 }

    const nodeX = Number.isNaN(node.position.x) ? 0 : node.position.x
    const nodeY = Number.isNaN(node.position.y) ? 0 : node.position.y

    if (!node.parentNode) {
        return { x: nodeX, y: nodeY }
    }

    const parentPos = getAbsoluteNodePosition(node.parentNode as string, nodes)
    return {
        // FIX: Account for the parent border
        x: parentPos.x + nodeX + CANVAS.GROUP_BORDER_WIDTH,
        y: parentPos.y + nodeY + CANVAS.GROUP_BORDER_WIDTH
    }
}
