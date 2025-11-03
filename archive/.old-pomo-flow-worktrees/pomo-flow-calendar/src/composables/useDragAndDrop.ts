import { ref, computed } from 'vue'

export interface DragData {
  type: 'task' | 'project'
  taskId?: string
  projectId?: string
  title: string
  source: 'kanban' | 'calendar' | 'canvas' | 'sidebar'
  payload?: any
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
  }

  const endDrag = () => {
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
    payload?: any
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