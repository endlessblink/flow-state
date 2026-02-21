import { ref, computed } from 'vue'
import { isTauri } from '@/utils/platform'

export interface DragData {
  type: 'task' | 'project'
  taskId?: string
  projectId?: string
  title: string
  source: 'kanban' | 'calendar' | 'canvas' | 'sidebar'
  payload?: unknown
  /** BUG-1361: Controls when the ghost pill is visible.
   *  'always' — pill follows cursor at all times (canvas, board)
   *  'sidebar-only' — pill only appears when hovering over sidebar project drop targets (calendar)
   */
  ghostMode?: 'always' | 'sidebar-only'
}

export interface DragState {
  isDragging: boolean
  dragData: DragData | null
  dropTarget: string | null
}

const dragState = ref<DragState>({
  isDragging: false,
  dragData: null,
  dropTarget: null
})

// Document-level handlers for tracking cursor + positioning ghost during drag.
// mousemove fires during SortableJS drags; dragover fires during HTML5 native drags.
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let dragOverHandler: ((e: DragEvent) => void) | null = null

// Persistent ghost element that follows cursor for ALL drag types.
// SortableJS: positioned via mousemove. HTML5: positioned via dragover.
let ghostEl: HTMLElement | null = null

// BUG-1361: Self-cleaning safety net handlers.
// When a drag source element is removed from the DOM by Vue reactivity (e.g., inbox task
// card removed when isInInbox changes to false), the @dragend event never fires on it.
// These document-level listeners catch the drag end regardless.
let safetyDropHandler: ((e: Event) => void) | null = null
let safetyDragEndHandler: (() => void) | null = null
let safetyTimeout: ReturnType<typeof setTimeout> | null = null

// Shared CSS for the unified ghost pill
const GHOST_CSS = `position:fixed;padding:8px 16px;max-width:220px;background:#1e1e23;color:#e0e0e0;border:1px solid rgba(78,205,196,0.4);border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:99999;`

function createGhostPill(title: string): HTMLElement {
  const el = document.createElement('div')
  const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title
  el.textContent = truncated
  return el
}

// BUG-1361: Forward declaration — endDrag is referenced by safety net before it's defined.
// The actual implementation is inside useDragAndDrop(). This variable holds the reference.
let endDragFn: (() => void) | null = null

/**
 * BUG-1361: Install document-level safety net that catches drag-end regardless of
 * whether the source element survives in the DOM.
 *
 * Two layers:
 * 1. `document 'drop'` (capture phase) — fires on the drop TARGET (still in DOM).
 *    Uses requestAnimationFrame delay so view-specific handlers run first.
 * 2. `document 'dragend'` (capture phase) — fires when source element is still in DOM.
 *    Covers normal drags and Escape/cancel.
 * 3. 10-second timeout — absolute last resort for broken browser states.
 */
function installSafetyNet() {
  removeSafetyNet()

  const scheduleCleanup = () => {
    requestAnimationFrame(() => {
      if (dragState.value.isDragging && endDragFn) {
        endDragFn()
      }
    })
  }

  safetyDropHandler = scheduleCleanup
  document.addEventListener('drop', safetyDropHandler, true)

  safetyDragEndHandler = scheduleCleanup
  document.addEventListener('dragend', safetyDragEndHandler, true)

  safetyTimeout = setTimeout(() => {
    if (dragState.value.isDragging && endDragFn) {
      console.warn('[BUG-1361] Drag safety timeout (10s) — forcing cleanup')
      endDragFn()
    }
  }, 10000)
}

function removeSafetyNet() {
  if (safetyDropHandler) {
    document.removeEventListener('drop', safetyDropHandler, true)
    safetyDropHandler = null
  }
  if (safetyDragEndHandler) {
    document.removeEventListener('dragend', safetyDragEndHandler, true)
    safetyDragEndHandler = null
  }
  if (safetyTimeout) {
    clearTimeout(safetyTimeout)
    safetyTimeout = null
  }
}

export function useDragAndDrop() {
  const isDragging = computed(() => dragState.value.isDragging)
  const dragData = computed(() => dragState.value.dragData)
  const dropTarget = computed(() => dragState.value.dropTarget)

  /**
   * Start a drag operation with unified ghost pill.
   * Pass the DragEvent for HTML5 native drags (Table, Calendar, List, Inbox)
   * to suppress the browser's default drag image.
   * For SortableJS drags (Kanban) omit the event.
   *
   * ALL drag types use a persistent ghost element positioned on-screen:
   * - SortableJS: positioned via mousemove
   * - HTML5 native: positioned via document dragover
   * This avoids setDragImage rendering issues (gray bg) in Tauri/Chromium.
   *
   * BUG-1361: ghostMode controls pill visibility:
   * - 'always' (default): pill follows cursor everywhere
   * - 'sidebar-only': pill only visible when hovering over sidebar project drop targets
   */
  const startDrag = (data: DragData, event?: DragEvent) => {
    // BUG-1361: Clean up any stale ghost from a previous drag that wasn't properly ended.
    // This prevents ghost pill accumulation when dragend doesn't fire (e.g., source element
    // removed from DOM by reactive filtering before dragend event).
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler)
      mouseMoveHandler = null
    }
    if (dragOverHandler) {
      document.removeEventListener('dragover', dragOverHandler)
      dragOverHandler = null
    }

    dragState.value = {
      isDragging: true,
      dragData: data,
      dropTarget: null
    }

    // Add visual feedback to body
    document.body.classList.add('dragging-active')

    const title = data.title || 'Task'
    const ghostMode = data.ghostMode || 'sidebar-only'

    // BUG-1370: In Tauri/WebKitGTK, DOM mutations during dragstart cancel the drag.
    // Defer ghost pill creation to after the dragstart event completes.
    const inTauri = isTauri()
    if (inTauri) {
      // Defer ghost creation — WebKitGTK cancels drag if DOM is mutated during dragstart
      requestAnimationFrame(() => {
        ghostEl = createGhostPill(title)
        ghostEl.style.cssText = GHOST_CSS + 'left:-9999px;top:-9999px;'
        document.body.appendChild(ghostEl)
      })
    } else {
      // Browser mode: create ghost immediately (safe in Chrome/Firefox)
      ghostEl = createGhostPill(title)
      ghostEl.style.cssText = GHOST_CSS + 'left:-9999px;top:-9999px;'
      document.body.appendChild(ghostEl)
    }

    if (event?.dataTransfer && !inTauri) {
      // HTML5 native drag — suppress browser's default drag image with transparent 1x1
      // BUG-1370: Skip in Tauri/WebKitGTK — setDragImage with detached element cancels drag
      const transparent = document.createElement('canvas')
      transparent.width = 1
      transparent.height = 1
      event.dataTransfer.setDragImage(transparent, 0, 0)
    }

    // Shared logic: position ghost + detect drop targets
    const positionGhostAndDetectTarget = (x: number, y: number) => {
      const elements = document.elementsFromPoint(x, y)
      let found: string | null = null
      for (const el of elements) {
        const navItem = (el as HTMLElement).closest?.('[data-drop-project-id]') as HTMLElement | null
        if (navItem?.dataset.dropProjectId) {
          found = navItem.dataset.dropProjectId
          break
        }
      }
      if (dragState.value.dropTarget !== found) {
        dragState.value.dropTarget = found
      }

      // BUG-1361: Ghost pill visibility based on ghostMode
      if (ghostEl) {
        if (ghostMode === 'sidebar-only' && !found) {
          // Hide ghost when not over a sidebar project drop target
          ghostEl.style.left = '-9999px'
          ghostEl.style.top = '-9999px'
        } else {
          // Show ghost at cursor position
          ghostEl.style.left = `${x + 12}px`
          ghostEl.style.top = `${y - 14}px`
        }
      }
    }

    // SortableJS fires mousemove during drag
    mouseMoveHandler = (e: MouseEvent) => positionGhostAndDetectTarget(e.clientX, e.clientY)
    document.addEventListener('mousemove', mouseMoveHandler)

    // HTML5 native drag fires dragover (mousemove is suppressed during native drag)
    dragOverHandler = (e: DragEvent) => positionGhostAndDetectTarget(e.clientX, e.clientY)
    document.addEventListener('dragover', dragOverHandler)

    // BUG-1361: Install self-cleaning safety net so endDrag is called even when
    // the source element is removed from DOM before dragend fires.
    installSafetyNet()
  }

  const endDrag = () => {
    // BUG-1361: Remove safety net first to prevent re-entrant calls
    removeSafetyNet()

    // Clean up event handlers
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler)
      mouseMoveHandler = null
    }
    if (dragOverHandler) {
      document.removeEventListener('dragover', dragOverHandler)
      dragOverHandler = null
    }

    // Clean up persistent ghost element
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }

    dragState.value = {
      isDragging: false,
      dragData: null,
      dropTarget: null
    }

    // Remove visual feedback from body
    document.body.classList.remove('dragging-active')
  }

  // BUG-1361: Store reference for safety net (defined outside composable scope)
  endDragFn = endDrag

  const setDropTarget = (target: string | null) => {
    dragState.value.dropTarget = target
  }

  const createDragData = (
    type: 'task' | 'project',
    title: string,
    source: 'kanban' | 'calendar' | 'canvas' | 'sidebar',
    taskId?: string,
    projectId?: string,
    payload?: unknown
  ): DragData => ({
    type,
    taskId,
    projectId,
    title,
    source,
    payload
  })

  const isValidDrop = (dragData: DragData | null, targetType: 'project' | 'task' | 'date-target'): boolean => {
    if (!dragData) return false

    // Can drag tasks to projects
    if (dragData.type === 'task' && targetType === 'project') return true

    // Can drag projects to projects (for nesting)
    if (dragData.type === 'project' && targetType === 'project') return true

    // Can drag tasks to date targets (Today, Weekend, etc.)
    if (dragData.type === 'task' && targetType === 'date-target') return true

    return false
  }

  return {
    isDragging,
    dragData,
    dropTarget,
    startDrag,
    endDrag,
    setDropTarget,
    createDragData,
    isValidDrop
  }
}
