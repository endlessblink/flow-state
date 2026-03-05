/**
 * TASK-1445: Safe polygon hover intent for submenu navigation.
 *
 * When the cursor leaves a submenu trigger, instead of blindly closing after
 * a timeout, we track cursor movement on document.mousemove and test whether
 * the cursor is inside a polygon drawn from the exit point toward the submenu
 * panel. This is the same technique used by Amazon, Floating UI (safePolygon),
 * and Radix UI.
 *
 * Why this works when CSS bridges don't:
 * - Uses getBoundingClientRect() (viewport coords) — immune to overflow: auto
 * - Listens on document — not affected by DOM nesting or Teleport
 * - Ray-casting point-in-polygon is frame-accurate
 */

type Point = [number, number]

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi >= y !== yj >= y && x <= ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

interface SubmenuRect {
  x: number
  y: number
  width: number
  height: number
}

interface SafePolygonInstance {
  /**
   * Start tracking after cursor leaves a trigger element.
   * Builds a triangle from the exit point toward the submenu rect.
   * Calls onClose if cursor leaves the safe zone.
   */
  startTracking(exitEvent: MouseEvent, submenuRect: SubmenuRect, onClose: () => void): void
  /** Stop tracking and clean up listeners */
  stopTracking(): void
}

export function useSubmenuSafePolygon(): SafePolygonInstance {
  let removeListener: (() => void) | null = null
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null

  function startTracking(
    exitEvent: MouseEvent,
    submenuRect: SubmenuRect,
    onClose: () => void
  ) {
    // Clean up any previous tracking
    stopTracking()

    const exitX = exitEvent.clientX
    const exitY = exitEvent.clientY
    const { x: sx, y: sy, width: sw, height: sh } = submenuRect

    // Determine if submenu is to the right or left of the cursor
    const isRight = sx > exitX

    // Build a safe polygon: a quadrilateral from the cursor exit area
    // toward the near edge of the submenu panel.
    // The "buffer" widens the exit point so slight diagonal movement is tolerated.
    const buffer = 30
    let polygon: Point[]

    if (isRight) {
      // Submenu is to the RIGHT
      polygon = [
        [exitX - 5, exitY - buffer],   // Above cursor exit
        [exitX - 5, exitY + buffer],   // Below cursor exit
        [sx + 1, sy + sh + 10],        // Bottom-left of submenu (padded)
        [sx + 1, sy - 10],             // Top-left of submenu (padded)
      ]
    } else {
      // Submenu is to the LEFT
      polygon = [
        [exitX + 5, exitY - buffer],   // Above cursor exit
        [exitX + 5, exitY + buffer],   // Below cursor exit
        [sx + sw - 1, sy - 10],        // Top-right of submenu (padded)
        [sx + sw - 1, sy + sh + 10],   // Bottom-right of submenu (padded)
      ]
    }

    // Also build a rectangular bridge covering the gap between trigger and submenu
    const bridgeLeft = Math.min(exitX, sx) - 5
    const bridgeRight = Math.max(exitX, sx + sw) + 5
    const bridgeTop = Math.min(exitY, sy) - 15
    const bridgeBottom = Math.max(exitY + 1, sy + sh) + 15
    const bridge: Point[] = [
      [bridgeLeft, bridgeTop],
      [bridgeRight, bridgeTop],
      [bridgeRight, bridgeBottom],
      [bridgeLeft, bridgeBottom],
    ]

    function onMouseMove(e: MouseEvent) {
      const cx = e.clientX
      const cy = e.clientY

      // Check if cursor entered the submenu panel
      if (cx >= sx - 2 && cx <= sx + sw + 2 && cy >= sy - 2 && cy <= sy + sh + 2) {
        stopTracking()
        return // Cursor landed on submenu — keep it open
      }

      // Check if cursor is in the safe triangle or bridge
      const inPoly = isPointInPolygon([cx, cy], polygon)
      const inBridge = isPointInPolygon([cx, cy], bridge)
      if (inPoly || inBridge) {
        return // Cursor is heading toward submenu — keep it open
      }

      // Cursor is outside the safe zone — close
      stopTracking()
      onClose()
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true })

    // Fallback: close after 800ms if cursor never reaches submenu
    fallbackTimer = setTimeout(() => {
      stopTracking()
      onClose()
    }, 800)

    removeListener = () => {
      document.removeEventListener('mousemove', onMouseMove)
    }
  }

  function stopTracking() {
    if (removeListener) {
      removeListener()
      removeListener = null
    }
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
  }

  return { startTracking, stopTracking }
}
