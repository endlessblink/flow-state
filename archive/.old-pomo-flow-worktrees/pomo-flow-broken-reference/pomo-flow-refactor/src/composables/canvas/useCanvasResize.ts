import { ref, computed, type Ref } from 'vue'
import { useVueFlow, type Node, type Viewport } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Resize Composable
 * Handles section resize operations with state tracking and visual feedback
 */
export function useCanvasResize(
  nodes: Ref<Node[]>,
  viewport: Ref<Viewport>
) {
  const canvasStore = useCanvasStore()

  // ============================================
  // RESIZE STATE
  // ============================================

  const resizeState = ref({
    isResizing: false,
    sectionId: null as string | null,
    startWidth: 0,
    startHeight: 0,
    currentWidth: 0,
    currentHeight: 0,
    handlePosition: null as string | null,
    isDragging: false,
    resizeStartTime: 0
  })

  // ============================================
  // STYLE HELPERS
  // ============================================

  /**
   * Glass morphism corner handles - Modern minimal style
   */
  const resizeHandleStyle = computed(() => ({
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.3)',
    border: '1.5px solid rgba(99, 102, 241, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  }))

  const resizeLineStyle = computed(() => ({
    backgroundColor: 'var(--brand-primary)',
    opacity: 0.2,
    transition: 'background-color 0.2s ease'
  }))

  /**
   * Get section resize style for individual sections
   */
  const getSectionResizeStyle = (section: any) => {
    if (!resizeState.value.isResizing || resizeState.value.sectionId !== section.id) {
      return {}
    }

    return {
      position: 'fixed',
      left: `${section.position.x * viewport.value.zoom + viewport.value.x}px`,
      top: `${section.position.y * viewport.value.zoom + viewport.value.y}px`,
      width: `${resizeState.value.currentWidth * viewport.value.zoom}px`,
      height: `${resizeState.value.currentHeight * viewport.value.zoom}px`,
      pointerEvents: 'none',
      zIndex: 999
    }
  }

  // ============================================
  // RESIZE HANDLERS
  // ============================================

  /**
   * Handle resize start with enhanced state tracking
   */
  const handleResizeStart = (event: any) => {
    console.log('🔧 Resize start:', event)
    const node = event.node || event

    if (node && node.id && node.id.startsWith('section-')) {
      const sectionId = node.id.replace('section-', '')
      const section = canvasStore.sections.find(s => s.id === sectionId)

      if (section) {
        // Initialize resize state with proper bounds checking
        resizeState.value = {
          isResizing: true,
          sectionId,
          startWidth: Math.max(200, Math.min(1200, section.position.width)),
          startHeight: Math.max(150, Math.min(800, section.position.height)),
          currentWidth: Math.max(200, Math.min(1200, section.position.width)),
          currentHeight: Math.max(150, Math.min(800, section.position.height)),
          handlePosition: event.direction || 'se',
          isDragging: false,
          resizeStartTime: Date.now()
        }

        // Add visual feedback classes
        const allSectionNodes = document.querySelectorAll('.vue-flow__node-sectionNode')
        let nodeElement: Element | null = null

        allSectionNodes.forEach(node => {
          const nodeId = node.getAttribute('data-id')
          if (nodeId === `section-${sectionId}`) {
            nodeElement = node
          }
        })

        if (nodeElement) {
          nodeElement.classList.add('resizing')
        }

        // Clear any existing resize preview overlays
        const existingOverlays = document.querySelectorAll('.resize-preview-overlay-fixed')
        existingOverlays.forEach(overlay => overlay.remove())
      }
    }
  }

  /**
   * Handle resize with real-time preview
   */
  const handleResize = (event: any) => {
    if (!resizeState.value.isResizing || !resizeState.value.sectionId) return

    const node = event.node || event
    if (node && node.style) {
      // Calculate dimensions reliably
      let newWidth = parseInt(node.style.width) || resizeState.value.startWidth
      let newHeight = parseInt(node.style.height) || resizeState.value.startHeight

      // Apply bounds constraints
      newWidth = Math.max(200, Math.min(1200, newWidth))
      newHeight = Math.max(150, Math.min(800, newHeight))

      // Update current dimensions for preview
      resizeState.value.currentWidth = newWidth
      resizeState.value.currentHeight = newHeight
    }
  }

  /**
   * Handle resize end with cleanup and validation
   */
  const handleResizeEnd = (event: any) => {
    console.log('🔧 Resize end:', event)
    const node = event.node || event

    if (node && node.id && node.id.startsWith('section-')) {
      const sectionId = node.id.replace('section-', '')

      // Find node element and remove visual feedback
      const allSectionNodes = document.querySelectorAll('.vue-flow__node-sectionNode')
      let nodeElement: Element | null = null

      allSectionNodes.forEach(node => {
        const nodeId = node.getAttribute('data-id')
        if (nodeId === `section-${sectionId}`) {
          nodeElement = node
        }
      })

      if (nodeElement) {
        nodeElement.classList.remove('resizing')
      }

      // Update section dimensions in store - preserve position
      if (resizeState.value.sectionId === sectionId) {
        const currentSection = canvasStore.sections.find(s => s.id === sectionId)
        if (currentSection) {
          // Use current dimensions from resize state
          const validatedWidth = Math.max(200, Math.min(1200, resizeState.value.currentWidth))
          const validatedHeight = Math.max(150, Math.min(800, resizeState.value.currentHeight))

          // Preserve original position, only update dimensions
          canvasStore.updateSectionWithUndo(sectionId, {
            position: {
              x: currentSection.position.x,
              y: currentSection.position.y,
              width: validatedWidth,
              height: validatedHeight
            }
          })
        }
      }

      // Reset resize state
      resizeState.value = {
        isResizing: false,
        sectionId: null,
        startWidth: 0,
        startHeight: 0,
        currentWidth: 0,
        currentHeight: 0,
        handlePosition: null,
        isDragging: false,
        resizeStartTime: 0
      }
    }
  }

  // ============================================
  // SECTION RESIZE HANDLERS (NodeResizer)
  // ============================================

  /**
   * Handle section resize start from NodeResizer component
   */
  const handleSectionResizeStart = ({ sectionId, event }: any) => {
    console.log('🎯 [CanvasView] Section resize START:', {
      sectionId,
      event,
      eventType: typeof event,
      eventKeys: event ? Object.keys(event) : []
    })
  }

  /**
   * Handle section resize from NodeResizer component
   */
  const handleSectionResize = ({ sectionId, event }: any) => {
    console.log('🎯 [CanvasView] Section resizing:', {
      sectionId,
      rawEvent: event,
      extractedDimensions: {
        width: event?.width || event?.params?.x || event?.dimensions?.width || event?.x,
        height: event?.height || event?.params?.y || event?.dimensions?.height || event?.y
      }
    })

    // Try to extract dimensions from the event
    if (event?.width && event?.height) {
      console.log('📊 [CanvasView] Valid dimensions found:', {
        width: event.width,
        height: event.height
      })
    } else {
      console.warn('⚠️ [CanvasView] Could not extract dimensions from event:', event)
    }
  }

  /**
   * Handle section resize end from NodeResizer component
   */
  const handleSectionResizeEnd = ({ sectionId, event }: any) => {
    console.log('🎯 [CanvasView] Section resize END:', {
      sectionId,
      event,
      allEventProperties: event ? Object.entries(event) : []
    })

    // Extract dimensions from event
    let newWidth: number | null = null
    let newHeight: number | null = null

    // Try different event formats
    if (event?.width && event?.height) {
      newWidth = event.width
      newHeight = event.height
    } else if (event?.params?.x && event?.params?.y) {
      newWidth = event.params.x
      newHeight = event.params.y
    } else if (event?.dimensions?.width && event?.dimensions?.height) {
      newWidth = event.dimensions.width
      newHeight = event.dimensions.height
    }

    if (newWidth && newHeight) {
      console.log(`✅ [CanvasView] Extracted dimensions: ${newWidth} x ${newHeight}`)

      const section = canvasStore.sections.find(s => s.id === sectionId)
      if (section) {
        canvasStore.updateSectionWithUndo(sectionId, {
          position: {
            ...section.position,
            width: newWidth,
            height: newHeight
          }
        })
        console.log('✅ [CanvasView] Section dimensions persisted to store')
      } else {
        console.error(`❌ [CanvasView] Section ${sectionId} not found in store`)
      }
    } else {
      console.error('❌ [CanvasView] Failed to extract dimensions from resize event - dimensions not persisted')
      console.log('📊 [CanvasView] Full event structure for debugging:', JSON.stringify(event, null, 2))
    }
  }

  // ============================================
  // DIMENSION CHANGE HANDLER
  // ============================================

  /**
   * Handle dimension changes from Vue Flow
   * Updates section dimensions in store while preserving position
   */
  const handleDimensionChange = (change: any) => {
    if (change.type === 'dimensions' && change.id.startsWith('section-')) {
      const sectionId = change.id.replace('section-', '')

      // Skip dimension updates during active resize
      if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
        return
      }

      const node = nodes.value.find(n => n.id === change.id)
      if (node && change.dimensions) {
        // Update ONLY width and height, preserve position
        const currentSection = canvasStore.sections.find(s => s.id === sectionId)
        if (currentSection) {
          canvasStore.updateSectionWithUndo(sectionId, {
            position: {
              x: currentSection.position.x,
              y: currentSection.position.y,
              width: change.dimensions.width,
              height: change.dimensions.height
            }
          })
        }
      }
    }
  }

  /**
   * Check if position updates should be prevented during resize
   */
  const shouldPreventPositionUpdate = (change: any): boolean => {
    if (change.type === 'position' && change.id.startsWith('section-')) {
      const sectionId = change.id.replace('section-', '')
      return resizeState.value.isResizing && resizeState.value.sectionId === sectionId
    }
    return false
  }

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  return {
    // State
    resizeState,

    // Style helpers
    resizeHandleStyle,
    resizeLineStyle,
    getSectionResizeStyle,

    // Resize handlers
    handleResizeStart,
    handleResize,
    handleResizeEnd,

    // Section resize handlers (NodeResizer)
    handleSectionResizeStart,
    handleSectionResize,
    handleSectionResizeEnd,

    // Change handlers
    handleDimensionChange,
    shouldPreventPositionUpdate
  }
}
