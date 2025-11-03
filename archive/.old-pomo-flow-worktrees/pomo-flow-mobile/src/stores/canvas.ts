import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import type { Task } from './tasks'

export interface SectionFilter {
  priorities?: ('low' | 'medium' | 'high')[]
  statuses?: Task['status'][]
  projects?: string[]
  tags?: string[]
  dateRange?: { start: Date; end: Date }
}

export interface CanvasSection {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: { x: number; y: number; width: number; height: number }
  color: string
  filters?: SectionFilter
  layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean
  isCollapsed: boolean
  propertyValue?: string | 'high' | 'medium' | 'low' | 'planned' | 'in_progress' | 'done' | 'backlog'
}

export interface CanvasState {
  viewport: {
    x: number
    y: number
    zoom: number
  }
  selectedNodeIds: string[]
  connectMode: boolean
  connectingFrom: string | null
  sections: CanvasSection[]
  activeSectionId: string | null
  showSectionGuides: boolean
  snapToSections: boolean
  multiSelectMode: boolean
  selectionRect: { x: number; y: number; width: number; height: number } | null
  selectionMode: 'rectangle' | 'lasso' | 'click'
  isSelecting: boolean
}

export const useCanvasStore = defineStore('canvas', () => {
  const db = useDatabase()

  // Viewport state
  const viewport = ref({
    x: 0,
    y: 0,
    zoom: 1
  })

  // Selection state
  const selectedNodeIds = ref<string[]>([])

  // Connection mode state
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // Sections state
  const sections = ref<CanvasSection[]>([])
  const activeSectionId = ref<string | null>(null)
  const showSectionGuides = ref(true)
  const snapToSections = ref(true)
  
  // Multi-selection state
  const multiSelectMode = ref(false)
  const selectionRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectionMode = ref<'rectangle' | 'lasso' | 'click'>('rectangle')
  const isSelecting = ref(false)

  // Node display preferences
  const showPriorityIndicator = ref(true)
  const showStatusBadge = ref(true)
  const showDurationBadge = ref(true)
  const showScheduleBadge = ref(true)

  // Actions
  const setViewport = (x: number, y: number, zoom: number) => {
    viewport.value = { x, y, zoom }
  }

  const setSelectedNodes = (nodeIds: string[]) => {
    selectedNodeIds.value = nodeIds
  }

  const toggleConnectMode = () => {
    connectMode.value = !connectMode.value
    if (!connectMode.value) {
      connectingFrom.value = null
    }
  }

  const startConnection = (nodeId: string) => {
    connectingFrom.value = nodeId
    connectMode.value = true
  }

  const clearConnection = () => {
    connectingFrom.value = null
    connectMode.value = false
  }

  // Section management actions
  const createSection = (section: Omit<CanvasSection, 'id'>) => {
    const newSection: CanvasSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    sections.value.push(newSection)
    return newSection
  }

  const updateSection = (id: string, updates: Partial<CanvasSection>) => {
    const section = sections.value.find(s => s.id === id)
    if (section) {
      Object.assign(section, updates)
    }
  }

  const deleteSection = (id: string) => {
    if (import.meta.env.DEV) {
      ;(window as any).__lastDeletedSection = { id, before: sections.value.map(s => s.id) }
    }
    const index = sections.value.findIndex(s => s.id === id)
    if (index > -1) {
      sections.value.splice(index, 1)
      if (import.meta.env.DEV) {
        ;(window as any).__lastDeletedSection.after = sections.value.map(s => s.id)
      }
      if (activeSectionId.value === id) {
        activeSectionId.value = null
      }
    } else if (import.meta.env.DEV) {
      ;(window as any).__lastDeletedSection.missed = true
    }
  }

  const toggleSectionVisibility = (id: string) => {
    const section = sections.value.find(s => s.id === id)
    if (section) {
      section.isVisible = !section.isVisible
    }
  }

  const toggleSectionCollapse = (id: string) => {
    const section = sections.value.find(s => s.id === id)
    if (section) {
      section.isCollapsed = !section.isCollapsed
    }
  }

  const setActiveSection = (id: string | null) => {
    activeSectionId.value = id
  }

  // Multi-selection actions
  const toggleMultiSelectMode = () => {
    multiSelectMode.value = !multiSelectMode.value
    if (!multiSelectMode.value) {
      clearSelection()
    }
  }

  const setSelectionMode = (mode: 'rectangle' | 'lasso' | 'click') => {
    selectionMode.value = mode
  }

  const startSelection = (x: number, y: number) => {
    isSelecting.value = true
    selectionRect.value = { x, y, width: 0, height: 0 }
  }

  const updateSelection = (currentX: number, currentY: number) => {
    if (!isSelecting.value || !selectionRect.value) return
    
    const startX = selectionRect.value.x
    const startY = selectionRect.value.y
    
    selectionRect.value = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY)
    }
  }

  const endSelection = () => {
    isSelecting.value = false
  }

  const clearSelection = () => {
    selectedNodeIds.value = []
    selectionRect.value = null
    isSelecting.value = false
  }

  const selectNodesInRect = (rect: { x: number; y: number; width: number; height: number }, nodes: any[]) => {
    const selectedIds: string[] = []
    
    nodes.forEach(node => {
      const nodeX = node.position.x
      const nodeY = node.position.y
      const nodeWidth = 200 // Approximate node width
      const nodeHeight = 80 // Approximate node height
      
      if (
        nodeX < rect.x + rect.width &&
        nodeX + nodeWidth > rect.x &&
        nodeY < rect.y + rect.height &&
        nodeY + nodeHeight > rect.y
      ) {
        selectedIds.push(node.id)
      }
    })
    
    selectedNodeIds.value = selectedIds
  }

  const toggleNodeSelection = (nodeId: string) => {
    const index = selectedNodeIds.value.indexOf(nodeId)
    if (index > -1) {
      selectedNodeIds.value.splice(index, 1)
    } else {
      selectedNodeIds.value.push(nodeId)
    }
  }

  const selectAll = () => {
    // This would need to be called with all node IDs
    // Implementation depends on how we access all nodes
  }

  // Bulk operations
  const bulkDelete = (nodeIds: string[]) => {
    // This would need to be implemented with task store integration
    console.log('Bulk delete:', nodeIds)
  }

  const bulkUpdateStatus = (nodeIds: string[], status: Task['status']) => {
    // This would need to be implemented with task store integration
    console.log('Bulk update status:', nodeIds, status)
  }

  const bulkUpdatePriority = (nodeIds: string[], priority: Task['priority']) => {
    // This would need to be implemented with task store integration
    console.log('Bulk update priority:', nodeIds, priority)
  }

  const getTasksInSection = (section: CanvasSection, allTasks: Task[]) => {
    if (!section.filters) return allTasks
    
    return allTasks.filter(task => {
      // Priority filter
      if (section.filters!.priorities && !section.filters!.priorities.includes(task.priority)) {
        return false
      }
      
      // Status filter
      if (section.filters!.statuses && !section.filters!.statuses.includes(task.status)) {
        return false
      }
      
      // Project filter
      if (section.filters!.projects && !section.filters!.projects.includes(task.projectId)) {
        return false
      }
      
      // Date range filter
      if (section.filters!.dateRange) {
        const taskDate = new Date(task.createdAt)
        if (section.filters!.dateRange.start && taskDate < section.filters!.dateRange.start) {
          return false
        }
        if (section.filters!.dateRange.end && taskDate > section.filters!.dateRange.end) {
          return false
        }
      }
      
      return true
    })
  }

  // Auto-save sections to IndexedDB (debounced)
  let sectionsSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(sections, (newSections) => {
    if (sectionsSaveTimer) clearTimeout(sectionsSaveTimer)
    sectionsSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.CANVAS, newSections)
    }, 1000)
  }, { deep: true, flush: 'post' })

  // Initialize sections (empty by default - user creates them)
  const initializeDefaultSections = () => {
    // Start with empty sections - users create their own
    if (sections.value.length === 0) {
      sections.value = []
    }
  }

  // Preset smart section creators
  const createPrioritySection = (priority: 'high' | 'medium' | 'low', position: { x: number; y: number }) => {
    const colors = { high: '#ef4444', medium: '#f59e0b', low: '#6366f1' }
    const names = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' }

    return createSection({
      name: names[priority],
      type: 'priority',
      propertyValue: priority,
      position: { ...position, width: 300, height: 250 },
      color: colors[priority],
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  const createStatusSection = (status: 'planned' | 'in_progress' | 'done' | 'backlog', position: { x: number; y: number }) => {
    const colors = { planned: '#6366f1', in_progress: '#f59e0b', done: '#10b981', backlog: '#64748b' }
    const names = { planned: 'Planned', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog' }

    return createSection({
      name: names[status],
      type: 'status',
      propertyValue: status,
      position: { ...position, width: 300, height: 250 },
      color: colors[status],
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  const createProjectSection = (projectId: string, projectName: string, color: string, position: { x: number; y: number }) => {
    return createSection({
      name: projectName,
      type: 'project',
      propertyValue: projectId,
      position: { ...position, width: 300, height: 250 },
      color: color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  // Display preference toggles
  const togglePriorityIndicator = () => {
    showPriorityIndicator.value = !showPriorityIndicator.value
  }

  const toggleStatusBadge = () => {
    showStatusBadge.value = !showStatusBadge.value
  }

  const toggleDurationBadge = () => {
    showDurationBadge.value = !showDurationBadge.value
  }

  const toggleScheduleBadge = () => {
    showScheduleBadge.value = !showScheduleBadge.value
  }

  // Load canvas state from IndexedDB
  const loadFromDatabase = async () => {
    const savedSections = await db.load<CanvasSection[]>(DB_KEYS.CANVAS)
    if (savedSections && savedSections.length > 0) {
      sections.value = savedSections
      console.log(`📂 Loaded ${sections.value.length} canvas sections from IndexedDB`)
    }
  }

  // Auto-save canvas state when sections change (debounced)
  let canvasSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(sections, (newSections) => {
    if (canvasSaveTimer) clearTimeout(canvasSaveTimer)
    canvasSaveTimer = setTimeout(() => {
      db.save(DB_KEYS.CANVAS, newSections)
    }, 1000)
  }, { deep: true, flush: 'post' })

  return {
    viewport,
    selectedNodeIds,
    connectMode,
    connectingFrom,
    sections,
    activeSectionId,
    showSectionGuides,
    snapToSections,
    multiSelectMode,
    selectionRect,
    selectionMode,
    isSelecting,
    showPriorityIndicator,
    showStatusBadge,
    showDurationBadge,
    showScheduleBadge,
    setViewport,
    setSelectedNodes,
    toggleConnectMode,
    startConnection,
    clearConnection,
    createSection,
    updateSection,
    deleteSection,
    toggleSectionVisibility,
    toggleSectionCollapse,
    setActiveSection,
    getTasksInSection,
    initializeDefaultSections,
    createPrioritySection,
    createStatusSection,
    createProjectSection,
    toggleMultiSelectMode,
    setSelectionMode,
    startSelection,
    updateSelection,
    endSelection,
    togglePriorityIndicator,
    toggleStatusBadge,
    toggleDurationBadge,
    toggleScheduleBadge,
    clearSelection,
    selectNodesInRect,
    toggleNodeSelection,
    selectAll,
    bulkDelete,
    bulkUpdateStatus,
    bulkUpdatePriority,
    loadFromDatabase
  }
})
