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

// Document-level mousemove handler for tracking drop targets during drag.
// This works for ALL drag sources including SortableJS forceFallback which
// doesn't fire native drag events (dragenter/dragover) on external elements.
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

// Ghost element that follows cursor during non-native (SortableJS) drags.
// Native HTML5 drag doesn't fire mousemove, so the ghost stays off-screen
// and setDragImage() handles it instead — no duplication.
let ghostEl: HTMLElement | null = null

export function useDragAndDrop() {
  const isDragging = computed(() => dragState.value.isDragging)
  const dragData = computed(() => dragState.value.dragData)
  const dropTarget = computed(() => dragState.value.dropTarget)

  const startDrag = (data: DragData) => {
    dragState.value = {
      isDragging: true,
      dragData: data,
      dropTarget: null
    }

    // Add visual feedback to body
    document.body.classList.add('dragging-active')

    // Create ghost pill that follows cursor during non-native drags.
    // Starts off-screen; only moves on-screen via mousemove (which only
    // fires for SortableJS drags, not HTML5 native drag).
    ghostEl = document.createElement('div')
    const title = data.title || 'Task'
    const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title
    ghostEl.textContent = truncated
    Object.assign(ghostEl.style, {
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      padding: '8px 16px',
      maxWidth: '220px',
      background: 'rgba(30, 30, 35, 0.92)',
      color: '#e0e0e0',
      border: '1px solid rgba(78, 205, 196, 0.4)',
      borderRadius: '8px',
      fontSize: '13px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
      zIndex: '99999'
    })
    document.body.appendChild(ghostEl)

    // Track drop target via mousemove + elementsFromPoint.
    // Native HTML5 drag doesn't fire mousemove (uses drag events instead),
    // so this only activates for non-native sources like SortableJS.
    mouseMoveHandler = (e: MouseEvent) => {
      // Position ghost near cursor
      if (ghostEl) {
        ghostEl.style.left = `${e.clientX + 12}px`
        ghostEl.style.top = `${e.clientY - 14}px`
      }

      const elements = document.elementsFromPoint(e.clientX, e.clientY)
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
    document.addEventListener('mousemove', mouseMoveHandler)
  }

  const endDrag = () => {
    // Clean up mousemove handler
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler)
      mouseMoveHandler = null
    }

    // Clean up ghost element
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