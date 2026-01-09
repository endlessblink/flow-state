/**
 * Geometry Utilities
 *
 * TASK-144: Extracted from useCanvasGroupMembership.ts and useCanvasDragDrop.ts
 * to eliminate duplicate containment detection logic.
 *
 * Single source of truth for:
 * - Point-in-rectangle checks
 * - Finding containing rectangles
 * - Task center calculations
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Check if a point (x, y) is inside a rectangle
 */
export function isPointInRect(
  x: number,
  y: number,
  rect: Rect
): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

/**
 * Find the smallest rectangle that contains a point.
 * Returns null if point is not in any rectangle.
 *
 * @param x - X coordinate of point
 * @param y - Y coordinate of point
 * @param rects - Array of rectangles to check
 * @returns The smallest containing rectangle, or null
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
 * Useful for nested group inheritance where parent properties apply first,
 * then children override.
 *
 * @param x - X coordinate of point
 * @param y - Y coordinate of point
 * @param rects - Array of rectangles to check
 * @returns Array of containing rectangles, sorted largest to smallest
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
      return areaB - areaA // Largest first
    })
}

/**
 * Calculate the center point of a task given its position and dimensions.
 * Default dimensions match TaskNode component defaults.
 *
 * @param x - Task X position (top-left)
 * @param y - Task Y position (top-left)
 * @param width - Task width (default: 220)
 * @param height - Task height (default: 100)
 * @returns Center coordinates { x, y }
 */
export function getTaskCenter(
  x: number,
  y: number,
  width: number = 220,
  height: number = 100
): { x: number; y: number } {
  return {
    x: x + width / 2,
    y: y + height / 2
  }
}

/**
 * Check if a task's center is inside a rectangle.
 * Combines getTaskCenter and isPointInRect for convenience.
 *
 * @param taskX - Task X position (top-left)
 * @param taskY - Task Y position (top-left)
 * @param rect - Rectangle to check containment
 * @param taskWidth - Task width (default: 220)
 * @param taskHeight - Task height (default: 100)
 */
export function isTaskCenterInRect(
  taskX: number,
  taskY: number,
  rect: Rect,
  taskWidth: number = 220,
  taskHeight: number = 100
): boolean {
  const center = getTaskCenter(taskX, taskY, taskWidth, taskHeight)
  return isPointInRect(center.x, center.y, rect)
}

/**
 * Robust containment check: Requires node to be significantly overlapping the container.
 * This prevents "false positives" where a node just barely touches a group.
 * 
 *
 * Strategy: Check overlap area.
 * Returns true if more than `threshold` (default 0.5) of the node's area is inside the container RECT.
 */
export function isNodeMoreThanHalfInside(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  containerRect: Rect,
  threshold: number = 0.5
): boolean {
  // 1. Calculate intersection rectangle
  const validX = Math.max(nodeX, containerRect.x)
  const validY = Math.max(nodeY, containerRect.y)
  const validRight = Math.min(nodeX + nodeWidth, containerRect.x + containerRect.width)
  const validBottom = Math.min(nodeY + nodeHeight, containerRect.y + containerRect.height)

  // Check if they simply don't overlap
  if (validX >= validRight || validY >= validBottom) {
    return false
  }

  // 2. Calculate overlap area
  const intersectionWidth = validRight - validX
  const intersectionHeight = validBottom - validY
  const intersectionArea = intersectionWidth * intersectionHeight

  // 3. Calculate node area
  const nodeArea = nodeWidth * nodeHeight

  // 4. Threshold check
  return (intersectionArea / nodeArea) > threshold
}
