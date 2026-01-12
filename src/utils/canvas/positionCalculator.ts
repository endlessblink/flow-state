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
 * Calculates the inner rect of a group by accounting for the border.
 */
export const getInnerRect = (rect: Rect): Rect => {
    return {
        x: rect.x + CANVAS.GROUP_BORDER_WIDTH,
        y: rect.y + CANVAS.GROUP_BORDER_WIDTH,
        width: Math.max(0, rect.width - (CANVAS.GROUP_BORDER_WIDTH * 2)),
        height: Math.max(0, rect.height - (CANVAS.GROUP_BORDER_WIDTH * 2))
    }
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
export const isPointInRect = (x: number, y: number, rect: Rect, useInnerRect: boolean = false): boolean => {
    const targetRect = useInnerRect ? getInnerRect(rect) : rect
    return x >= targetRect.x && x <= targetRect.x + targetRect.width &&
        y >= targetRect.y && y <= targetRect.y + targetRect.height
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
export const isRectMoreThanHalfInside = (inner: Rect, outer: Rect, useInnerRect: boolean = true): boolean => {
    const targetOuter = useInnerRect ? getInnerRect(outer) : outer

    const intersectionX = Math.max(inner.x, targetOuter.x)
    const intersectionY = Math.max(inner.y, targetOuter.y)
    const intersectionW = Math.min(inner.x + inner.width, targetOuter.x + targetOuter.width) - intersectionX
    const intersectionH = Math.min(inner.y + inner.height, targetOuter.y + targetOuter.height) - intersectionY

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

