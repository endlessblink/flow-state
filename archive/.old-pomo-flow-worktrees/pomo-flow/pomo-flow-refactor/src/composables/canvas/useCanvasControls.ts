import { ref, type Ref } from 'vue'
import { useVueFlow, type Viewport } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Controls Composable
 * Handles zoom controls, display toggles, section management, and auto-arrange
 */
export function useCanvasControls() {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const {
    fitView: vueFlowFitView,
    zoomIn: vueFlowZoomIn,
    zoomOut: vueFlowZoomOut,
    zoomTo: vueFlowZoomTo,
    viewport,
    setMinZoom,
    setMaxZoom
  } = useVueFlow()

  // ============================================
  // ZOOM CONTROLS STATE
  // ============================================

  const showZoomDropdown = ref(false)
  const zoomPresets = [
    { label: '5%', value: 0.05 },
    { label: '10%', value: 0.10 },
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.50 },
    { label: '100%', value: 1.0 },
    { label: '200%', value: 2.0 },
    { label: '400%', value: 4.0 }
  ]

  // ============================================
  // ZOOM PERFORMANCE MANAGER
  // ============================================

  const zoomPerformanceManager = {
    animationFrameId: null as number | null,
    pendingOperations: [] as Array<() => void>,
    lastZoomTime: 0,
    zoomThrottleMs: 16, // ~60fps

    shouldThrottleZoom(): boolean {
      const now = performance.now()
      if (now - this.lastZoomTime < this.zoomThrottleMs) {
        return true
      }
      this.lastZoomTime = now
      return false
    },

    scheduleOperation(operation: () => void) {
      this.pendingOperations.push(operation)

      if (!this.animationFrameId) {
        this.animationFrameId = requestAnimationFrame(() => {
          this.flushOperations()
        })
      }
    },

    flushOperations() {
      this.pendingOperations.forEach(operation => operation())
      this.pendingOperations.length = 0
      this.animationFrameId = null
    },

    cleanup() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
      }
      this.pendingOperations.length = 0
    }
  }

  // ============================================
  // ZOOM FUNCTIONS
  // ============================================

  const fitView = () => {
    vueFlowFitView({ padding: 0.2, duration: 300 })
  }

  const zoomIn = () => {
    if (zoomPerformanceManager.shouldThrottleZoom()) return

    zoomPerformanceManager.scheduleOperation(() => {
      vueFlowZoomIn({ duration: 200 })
    })
  }

  const zoomOut = () => {
    if (zoomPerformanceManager.shouldThrottleZoom()) return

    zoomPerformanceManager.scheduleOperation(() => {
      const currentZoom = viewport.value.zoom
      let newZoom = Math.max(canvasStore.zoomConfig.minZoom, currentZoom - 0.1)

      console.log(`[Zoom Debug] Zoom out: ${currentZoom} -> ${newZoom}`)
      console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

      // Force Vue Flow to respect our zoom limits
      if (setMinZoom) {
        setMinZoom(canvasStore.zoomConfig.minZoom)
        console.log(`[Zoom Debug] Forcefully set minZoom to ${canvasStore.zoomConfig.minZoom}`)
      }

      vueFlowZoomTo(newZoom, { duration: 200 })

      // Double-check zoom was applied
      setTimeout(() => {
        const actualZoom = viewport.value.zoom
        if (actualZoom > newZoom && Math.abs(actualZoom - newZoom) > 0.01) {
          console.log(`[Zoom Debug] Vue Flow ignored zoom request, forcing again: ${actualZoom} -> ${newZoom}`)
          vueFlowZoomTo(newZoom, { duration: 0 })
        }
      }, 250)
    })
  }

  const toggleZoomDropdown = () => {
    showZoomDropdown.value = !showZoomDropdown.value
  }

  const applyZoomPreset = (zoomLevel: number) => {
    const validatedZoom = Math.max(
      canvasStore.zoomConfig.minZoom,
      Math.min(canvasStore.zoomConfig.maxZoom, zoomLevel)
    )

    console.log(`[Zoom Debug] Applying preset: ${zoomLevel} (validated: ${validatedZoom})`)
    console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

    zoomPerformanceManager.scheduleOperation(() => {
      // Force Vue Flow to respect zoom limits
      if (setMinZoom && setMaxZoom) {
        setMinZoom(canvasStore.zoomConfig.minZoom)
        setMaxZoom(canvasStore.zoomConfig.maxZoom)
        console.log(`[Zoom Debug] Forcefully set zoom limits: ${canvasStore.zoomConfig.minZoom} - ${canvasStore.zoomConfig.maxZoom}`)
      }

      vueFlowZoomTo(validatedZoom, { duration: 300 })
      canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, validatedZoom)

      // Double-check for critical presets
      if (validatedZoom <= 0.1) {
        setTimeout(() => {
          const actualZoom = viewport.value.zoom
          if (actualZoom > validatedZoom && Math.abs(actualZoom - validatedZoom) > 0.01) {
            console.log(`[Zoom Debug] Vue Flow ignored preset zoom, forcing again: ${actualZoom} -> ${validatedZoom}`)
            vueFlowZoomTo(validatedZoom, { duration: 0 })
          }
        }, 350)
      }
    })
    showZoomDropdown.value = false
  }

  const resetZoom = () => {
    vueFlowZoomTo(1.0, { duration: 300 })
    canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, 1.0)
    showZoomDropdown.value = false
  }

  const fitToContent = () => {
    const tasks = taskStore.tasksWithCanvasPosition
    if (!tasks || !tasks.length) {
      resetZoom()
      return
    }

    const contentBounds = canvasStore.calculateContentBounds(tasks)
    const centerX = (contentBounds.minX + contentBounds.maxX) / 2
    const centerY = (contentBounds.minY + contentBounds.maxY) / 2

    const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
    if (vueFlowElement) {
      const rect = vueFlowElement.getBoundingClientRect()
      const contentWidth = contentBounds.maxX - contentBounds.minX
      const contentHeight = contentBounds.maxY - contentBounds.minY

      const zoomX = (rect.width * 0.8) / contentWidth
      const zoomY = (rect.height * 0.8) / contentHeight
      const targetZoom = Math.min(zoomX, zoomY, canvasStore.zoomConfig.maxZoom)

      vueFlowZoomTo(targetZoom, { duration: 400 })
      setTimeout(() => {
        const panX = rect.width / 2 - centerX * targetZoom
        const panY = rect.height / 2 - centerY * targetZoom
        canvasStore.setViewportWithHistory(panX, panY, targetZoom)
      }, 200)
    }

    showZoomDropdown.value = false
  }

  // ============================================
  // DISPLAY TOGGLES
  // ============================================

  const handleToggleDoneTasks = (event: MouseEvent) => {
    event.stopPropagation()
    console.log('🔧 CanvasView: Toggle button clicked!')
    console.log('🔧 CanvasView: Current hideDoneTasks value:', taskStore.hideDoneTasks)

    try {
      taskStore.toggleHideDoneTasks()
      console.log('🔧 CanvasView: After toggle - hideDoneTasks value:', taskStore.hideDoneTasks)
      console.log('🔧 CanvasView: Method call successful')
    } catch (error) {
      console.error('🔧 CanvasView: Error calling toggleHideDoneTasks:', error)
    }
  }

  const toggleMultiSelect = () => {
    canvasStore.toggleMultiSelectMode()
  }

  // ============================================
  // SECTION CONTROLS
  // ============================================

  const showSections = ref(true)
  const showSectionTypeDropdown = ref(false)

  const toggleSections = () => {
    showSections.value = !showSections.value
  }

  const toggleSectionTypeDropdown = () => {
    showSectionTypeDropdown.value = !showSectionTypeDropdown.value
  }

  const createSmartSection = (
    type: 'priority-high' | 'priority-medium' | 'priority-low' | 'status-planned' | 'status-in_progress' | 'status-done'
  ) => {
    const existingCount = canvasStore.sections.length
    const position = {
      x: 50 + (existingCount * 50),
      y: 50 + (existingCount * 50)
    }

    if (type === 'priority-high') {
      canvasStore.createPrioritySectionWithUndo('high', position)
    } else if (type === 'priority-medium') {
      canvasStore.createPrioritySectionWithUndo('medium', position)
    } else if (type === 'priority-low') {
      canvasStore.createPrioritySectionWithUndo('low', position)
    } else if (type === 'status-planned') {
      canvasStore.createStatusSectionWithUndo('planned', position)
    } else if (type === 'status-in_progress') {
      canvasStore.createStatusSectionWithUndo('in_progress', position)
    } else if (type === 'status-done') {
      canvasStore.createStatusSectionWithUndo('done', position)
    }
  }

  const addSection = () => {
    toggleSectionTypeDropdown()
  }

  const addHighPrioritySection = () => {
    canvasStore.createPrioritySectionWithUndo('high', { x: 50, y: 50 })
  }

  const addInProgressSection = () => {
    canvasStore.createStatusSectionWithUndo('in_progress', { x: 400, y: 50 })
  }

  const addPlannedSection = () => {
    canvasStore.createStatusSectionWithUndo('planned', { x: 750, y: 50 })
  }

  // ============================================
  // AUTO-ARRANGE
  // ============================================

  const autoArrange = (getTasksForSection: (section: any) => any[]) => {
    // Add visual feedback
    const button = document.querySelector('[title="Auto Arrange"]') as HTMLButtonElement
    if (button) {
      button.style.background = 'var(--state-active-bg)'
      button.style.borderColor = 'var(--state-active-border)'

      // Create SVG element
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '16')
      svg.setAttribute('height', '16')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('width', '18')
      rect.setAttribute('height', '18')
      rect.setAttribute('x', '3')
      rect.setAttribute('y', '3')
      rect.setAttribute('rx', '2')
      rect.setAttribute('ry', '2')

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line1.setAttribute('x1', '3')
      line1.setAttribute('y1', '9')
      line1.setAttribute('x2', '21')
      line1.setAttribute('y2', '9')

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line2.setAttribute('x1', '9')
      line2.setAttribute('y1', '21')
      line2.setAttribute('x2', '9')
      line2.setAttribute('y2', '9')

      svg.appendChild(rect)
      svg.appendChild(line1)
      svg.appendChild(line2)

      button.innerHTML = ''
      button.appendChild(svg)
      button.appendChild(document.createTextNode(' Arranging...'))
    }

    // Auto-arrange ALL tasks
    const allTasks = taskStore.filteredTasks.filter(task => task.canvasPosition)
    const unsectionedTasks = allTasks.filter(task => {
      return !canvasStore.sections.some(section => {
        const { x, y, width, height } = section.position
        return task.canvasPosition &&
          task.canvasPosition.x >= x &&
          task.canvasPosition.x <= x + width &&
          task.canvasPosition.y >= y &&
          task.canvasPosition.y <= y + height
      })
    })

    // Arrange tasks within sections
    canvasStore.sections.forEach(section => {
      const sectionTasks = getTasksForSection(section)
      if (sectionTasks.length === 0) return

      const { layout, position } = section
      const spacing = { x: 200, y: 80 }

      sectionTasks.forEach((task, index) => {
        let x = position.x + 20
        let y = position.y + 60 + index * spacing.y

        if (layout === 'horizontal') {
          x = position.x + 20 + index * spacing.x
          y = position.y + 60
        } else if (layout === 'grid') {
          const cols = Math.floor(position.width / spacing.x)
          x = position.x + 20 + (index % cols) * spacing.x
          y = position.y + 60 + Math.floor(index / cols) * spacing.y
        }

        taskStore.updateTaskWithUndo(task.id, {
          canvasPosition: { x, y },
          isInInbox: false
        })
      })
    })

    // Arrange unsectioned tasks in a grid
    unsectionedTasks.forEach((task, index) => {
      const cols = 4
      const x = 50 + (index % cols) * 250
      const y = 50 + Math.floor(index / cols) * 150

      taskStore.updateTaskWithUndo(task.id, {
        canvasPosition: { x, y },
        isInInbox: false
      })
    })

    // Reset button after delay
    setTimeout(() => {
      if (button) {
        button.style.background = ''
        button.style.borderColor = ''

        const svgReset = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svgReset.setAttribute('width', '16')
        svgReset.setAttribute('height', '16')
        svgReset.setAttribute('viewBox', '0 0 24 24')
        svgReset.setAttribute('fill', 'none')
        svgReset.setAttribute('stroke', 'currentColor')
        svgReset.setAttribute('stroke-width', '2')
        svgReset.setAttribute('stroke-linecap', 'round')
        svgReset.setAttribute('stroke-linejoin', 'round')

        const rectReset = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rectReset.setAttribute('width', '18')
        rectReset.setAttribute('height', '18')
        rectReset.setAttribute('x', '3')
        rectReset.setAttribute('y', '3')
        rectReset.setAttribute('rx', '2')
        rectReset.setAttribute('ry', '2')

        const lineReset1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        lineReset1.setAttribute('x1', '3')
        lineReset1.setAttribute('y1', '9')
        lineReset1.setAttribute('x2', '21')
        lineReset1.setAttribute('y2', '9')

        const lineReset2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        lineReset2.setAttribute('x1', '9')
        lineReset2.setAttribute('y1', '21')
        lineReset2.setAttribute('x2', '9')
        lineReset2.setAttribute('y2', '9')

        svgReset.appendChild(rectReset)
        svgReset.appendChild(lineReset1)
        svgReset.appendChild(lineReset2)

        button.innerHTML = ''
        button.appendChild(svgReset)
      }
    }, 1500)
  }

  // ============================================
  // CLEANUP
  // ============================================

  const cleanup = () => {
    zoomPerformanceManager.cleanup()
  }

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  return {
    // Zoom controls
    showZoomDropdown,
    zoomPresets,
    fitView,
    zoomIn,
    zoomOut,
    toggleZoomDropdown,
    applyZoomPreset,
    resetZoom,
    fitToContent,

    // Display toggles
    handleToggleDoneTasks,
    toggleMultiSelect,

    // Section controls
    showSections,
    showSectionTypeDropdown,
    toggleSections,
    toggleSectionTypeDropdown,
    createSmartSection,
    addSection,
    addHighPrioritySection,
    addInProgressSection,
    addPlannedSection,

    // Auto-arrange
    autoArrange,

    // Cleanup
    cleanup
  }
}
