/**
 * Position Utilities for Canvas
 *
 * Consolidated position validation and manipulation functions.
 * Single source of truth for position handling across the canvas system.
 *
 * @see TASK-131: Canvas View Stabilization
 */

export interface Position {
  x: number
  y: number
}

export interface NodeWithPosition {
  id: string
  position: Position
  parentNode?: string
}

/**
 * Type guard that narrows unknown to Position.
 * Use this at API boundaries and when receiving data from external sources.
 */
export function isValidPosition(value: unknown): value is Position {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const pos = value as Record<string, unknown>
  return (
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    Number.isFinite(pos.x) &&
    Number.isFinite(pos.y)
  )
}

/**
 * Sanitize a position value, returning fallback if invalid.
 * Logs a warning when invalid positions are encountered.
 */
export function sanitizePosition(
  value: unknown,
  fallback: Position = { x: 0, y: 0 }
): Position {
  if (isValidPosition(value)) {
    return { x: value.x, y: value.y }
  }
  if (import.meta.env.DEV) {
    console.warn('[POSITION] Invalid position, using fallback:', value, '->', fallback)
  }
  return { ...fallback }
}

/**
 * Check if two positions are approximately equal within a tolerance.
 * Useful for detecting meaningful position changes vs. floating point noise.
 */
export function positionsEqual(
  a: Position | null | undefined,
  b: Position | null | undefined,
  tolerance: number = 0.5
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance
  )
}

/**
 * Calculate absolute position by traversing the parent node chain.
 * Consolidates duplicate implementations from useCanvasDragDrop.ts and useCanvasSelection.ts.
 *
 * @param node - Node with relative position and optional parentNode ID
 * @param allNodes - Array of all nodes to search for parents
 * @returns Absolute position in canvas coordinates
 */
export function getAbsolutePosition(
  node: NodeWithPosition,
  allNodes: NodeWithPosition[]
): Position {
  let x = node.position.x
  let y = node.position.y
  let currentParentId = node.parentNode

  // Traverse parent chain to accumulate offsets
  while (currentParentId) {
    const parent = allNodes.find(n => n.id === currentParentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    currentParentId = parent.parentNode
  }

  return { x, y }
}

/**
 * Calculate relative position from absolute position given a parent.
 * Inverse of getAbsolutePosition for a single parent.
 */
export function getRelativePosition(
  absolutePos: Position,
  parentNode: NodeWithPosition | null
): Position {
  if (!parentNode) {
    return { ...absolutePos }
  }
  return {
    x: absolutePos.x - parentNode.position.x,
    y: absolutePos.y - parentNode.position.y
  }
}

/**
 * Clamp a position within canvas bounds.
 * Useful for preventing nodes from being dragged off-canvas.
 */
export function clampPosition(
  position: Position,
  minX: number = -10000,
  maxX: number = 10000,
  minY: number = -10000,
  maxY: number = 10000
): Position {
  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y))
  }
}

/**
 * Round position coordinates for cleaner storage.
 * Prevents floating point accumulation in persisted data.
 */
export function roundPosition(position: Position, decimals: number = 0): Position {
  const multiplier = Math.pow(10, decimals)
  return {
    x: Math.round(position.x * multiplier) / multiplier,
    y: Math.round(position.y * multiplier) / multiplier
  }
}

/**
 * Create a hash string from a position for change detection.
 * Faster than deep comparison for watcher optimization.
 */
export function positionHash(position: Position | null | undefined): string {
  if (!position) return 'null'
  return `${Math.round(position.x)}:${Math.round(position.y)}`
}
