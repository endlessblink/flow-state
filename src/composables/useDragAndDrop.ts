import { ref, computed } from 'vue'

export interface DragData {
  type: 'task' | 'project'
  taskId?: string
  projectId?: string
  title: string
  source: 'kanban' | 'calendar' | 'canvas' | 'sidebar'
  payload?: unknown
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

// Shared CSS for the unified ghost pill
const GHOST_CSS = `position:fixed;padding:8px 16px;max-width:220px;background:#1e1e23;color:#e0e0e0;border:1px solid rgba(78,205,196,0.4);border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:99999;`

function createGhostPill(title: string): HTMLElement {
  const el = document.createElement('div')
  const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title
  el.textContent = truncated
  return el
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
   */
  const startDrag = (data: DragData, event?: DragEvent) => {
    dragState.value = {
      isDragging: true,
      dragData: data,
      dropTarget: null
    }

    // Add visual feedback to body
    document.body.classList.add('dragging-active')

    const title = data.title || 'Task'

    // ALWAYS create persistent ghost — positioned via mousemove or dragover
    ghostEl = createGhostPill(title)
    ghostEl.style.cssText = GHOST_CSS + 'left:-9999px;top:-9999px;'
    document.body.appendChild(ghostEl)

    if (event?.dataTransfer) {
      // HTML5 native drag — suppress browser's default drag image with transparent 1x1
      const transparent = document.createElement('canvas')
      transparent.width = 1
      transparent.height = 1
      event.dataTransfer.setDragImage(transparent, 0, 0)
    }

    // Shared logic: position ghost + detect drop targets
    const positionGhostAndDetectTarget = (x: number, y: number) => {
      if (ghostEl) {
        ghostEl.style.left = `${x + 12}px`
        ghostEl.style.top = `${y - 14}px`
      }

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
    }

    // SortableJS fires mousemove during drag
    mouseMoveHandler = (e: MouseEvent) => positionGhostAndDetectTarget(e.clientX, e.clientY)
    document.addEventListener('mousemove', mouseMoveHandler)

    // HTML5 native drag fires dragover (mousemove is suppressed during native drag)
    dragOverHandler = (e: DragEvent) => positionGhostAndDetectTarget(e.clientX, e.clientY)
    document.addEventListener('dragover', dragOverHandler)
  }

  const endDrag = () => {
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
