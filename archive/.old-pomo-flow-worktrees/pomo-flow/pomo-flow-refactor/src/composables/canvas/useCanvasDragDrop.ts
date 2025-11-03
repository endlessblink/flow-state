import { type Ref } from 'vue'
import { type Node } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Drag and Drop Composable
 * Handles all drag-and-drop interactions for tasks and sections
 */
export function useCanvasDragDrop(
  nodes: Ref<Node[]>,
  resizeState: Ref<any>,
  syncEdges: () => void,
  project: (position: { x: number; y: number }) => { x: number; y: number }
) {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Check if task is inside a section (based on center point)
   */
  const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
    return canvasStore.sections.find(section => {
      const { x, y, width, height } = section.position
      const taskCenterX = taskX + taskWidth / 2
      const taskCenterY = taskY + taskHeight / 2

      // For collapsed sections, use the full/original height for containment detection
      const detectionHeight = section.isCollapsed ? height : height

      console.log('[getContainingSection] Checking section:', {
        name: section.name,
        isCollapsed: section.isCollapsed,
        visualHeight: section.isCollapsed ? 80 : height,
        detectionHeight,
        bounds: { x, y, width, height: detectionHeight },
        taskCenter: { x: taskCenterX, y: taskCenterY }
      })

      const isInside = (
        taskCenterX >= x &&
        taskCenterX <= x + width &&
        taskCenterY >= y &&
        taskCenterY <= y + detectionHeight
      )

      if (isInside) {
        console.log('[getContainingSection] ✓ Task is inside section:', section.name)
      }

      return isInside
    })
  }

  /**
   * Check if coordinates are within section bounds
   */
  const isTaskInSectionBounds = (x: number, y: number, section: any, taskWidth: number = 220, taskHeight: number = 100) => {
    const { x: sx, y: sy, width, height } = section.position
    const taskCenterX = x + taskWidth / 2
    const taskCenterY = y + taskHeight / 2

    return (
      taskCenterX >= sx &&
      taskCenterX <= sx + width &&
      taskCenterY >= sy &&
      taskCenterY <= sy + height
    )
  }

  /**
   * Apply section properties to task when dropped into a section
   */
  const applySectionPropertiesToTask = (taskId: string, section: any) => {
    console.log('[applySectionPropertiesToTask] Called with:', {
      taskId,
      sectionName: section.name,
      sectionType: section.type,
      propertyValue: section.propertyValue
    })

    const updates: any = {}

    switch (section.type) {
      case 'priority':
        if (!section.propertyValue) return
        updates.priority = section.propertyValue
        break
      case 'status':
        if (!section.propertyValue) return
        updates.status = section.propertyValue
        break
      case 'project':
        if (!section.propertyValue) return
        updates.projectId = section.propertyValue
        break
      case 'custom':  // Allow custom sections with timeline names
      case 'timeline':
        // When dropped into timeline sections (Today, This Weekend, etc.)
        if (section.propertyValue === 'today' || section.name.toLowerCase().includes('today')) {
          console.log('[applySectionPropertiesToTask] Detected Today section, setting dueDate only')
          const today = new Date()
          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          console.log('[applySectionPropertiesToTask] Today key:', todayKey)

          // Only set dueDate - do NOT create instances
          // This keeps tasks in the calendar inbox (unscheduled) rather than scheduling them on the grid
          updates.dueDate = todayKey
          console.log('[applySectionPropertiesToTask] Set dueDate to today (no instance created)')
        }
        break
    }

    if (Object.keys(updates).length > 0) {
      console.log('[applySectionPropertiesToTask] Applying updates:', updates)
      taskStore.updateTaskWithUndo(taskId, updates)
    } else {
      console.log('[applySectionPropertiesToTask] No updates to apply')
    }
  }

  // ============================================
  // DRAG HANDLERS
  // ============================================

  /**
   * Handle node drag start - track section dragging
   */
  const handleNodeDragStart = (event: any) => {
    const { node } = event

    if (node.id.startsWith('section-')) {
      const sectionId = node.id.replace('section-', '')
      const section = canvasStore.sections.find(s => s.id === sectionId)

      if (section) {
        console.log(`Started dragging section: ${section.name}`)
      }
    }
  }

  /**
   * Handle node drag stop - save position and apply section properties
   */
  const handleNodeDragStop = (event: any) => {
    const { node } = event

    // Preserve selection state during drag operations
    const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]

    // Check if it's a section node or task node
    if (node.id.startsWith('section-')) {
      const sectionId = node.id.replace('section-', '')
      const section = canvasStore.sections.find(s => s.id === sectionId)

      if (section) {
        // Calculate position delta and update all child tasks
        const deltaX = node.position.x - section.position.x
        const deltaY = node.position.y - section.position.y

        // Update section position in store
        canvasStore.updateSectionWithUndo(sectionId, {
          position: {
            x: node.position.x,
            y: node.position.y,
            width: node.style?.width ? parseInt(node.style.width) : 300,
            height: node.style?.height ? parseInt(node.style.height) : 200
          }
        })

        // Update all child task positions to maintain relative positioning
        taskStore.filteredTasks
          .filter(task => {
            if (!task.canvasPosition) return false
            const taskSection = canvasStore.sections.find(s => {
              const { x, y, width, height } = s.position
              return task.canvasPosition!.x >= x &&
                     task.canvasPosition!.x <= x + width &&
                     task.canvasPosition!.y >= y &&
                     task.canvasPosition!.y <= y + height
            })
            return taskSection?.id === sectionId
          })
          .forEach(task => {
            taskStore.updateTaskWithUndo(task.id, {
              canvasPosition: {
                x: task.canvasPosition!.x + deltaX,
                y: task.canvasPosition!.y + deltaY
              }
            })
          })

        console.log(`Section dragged to: (${node.position.x}, ${node.position.y})`)
      }
    } else {
      // For task nodes, update position with improved section handling
      if (node.parentNode) {
        // Task was in a section - convert relative to absolute position
        const sectionId = node.parentNode.replace('section-', '')
        const section = canvasStore.sections.find(s => s.id === sectionId)

        if (section) {
          const absoluteX = section.position.x + node.position.x
          const absoluteY = section.position.y + node.position.y

          taskStore.updateTaskWithUndo(node.id, {
            canvasPosition: { x: absoluteX, y: absoluteY }
          })

          // Check if task moved outside the original section
          const movedOutside = !isTaskInSectionBounds(absoluteX, absoluteY, section)
          if (movedOutside) {
            console.log(`Task ${node.id} moved outside section ${sectionId}`)
          }
        }
      } else {
        // Task was not in a section - update absolute position directly
        taskStore.updateTaskWithUndo(node.id, {
          canvasPosition: { x: node.position.x, y: node.position.y }
        })
      }

      // Check if task is inside a smart section and apply properties
      let checkX, checkY

      if (node.parentNode) {
        // Task was in a section - need to use absolute coordinates
        const sectionId = node.parentNode.replace('section-', '')
        const section = canvasStore.sections.find(s => s.id === sectionId)
        if (section) {
          checkX = section.position.x + node.position.x
          checkY = section.position.y + node.position.y
        } else {
          checkX = node.position.x
          checkY = node.position.y
        }
      } else {
        // Task has no parent - position is already absolute
        checkX = node.position.x
        checkY = node.position.y
      }

      console.log('[handleNodeDragStop] Checking containment with coordinates:', { checkX, checkY, hasParent: !!node.parentNode })
      const containingSection = getContainingSection(checkX, checkY)
      console.log('[handleNodeDragStop] Found section:', containingSection ? { name: containingSection.name, type: containingSection.type, propertyValue: containingSection.propertyValue } : 'null')

      if (containingSection) {
        // Check if this is a timeline section
        const isTimelineSection = containingSection.name.toLowerCase().includes('today') ||
                                  containingSection.name.toLowerCase().includes('weekend')

        // Apply properties for non-custom sections OR custom sections with timeline names
        if (containingSection.type !== 'custom' || isTimelineSection) {
          console.log('[handleNodeDragStop] Applying properties for section:', containingSection.name)
          applySectionPropertiesToTask(node.id, containingSection)
        } else {
          console.log('[handleNodeDragStop] ⚠️ Skipping property application for custom section:', containingSection.name)
        }
      }

      // Restore selection state after drag operation
      if (selectedIdsBeforeDrag.length > 0) {
        canvasStore.setSelectedNodes(selectedIdsBeforeDrag)

        // Ensure Vue Flow nodes reflect the restored selection
        nodes.value.forEach(node => {
          node.selected = selectedIdsBeforeDrag.includes(node.id)
        })
      }
    }
  }

  /**
   * Handle node drag - Vue Flow handles parent-child automatically
   */
  const handleNodeDrag = (event: any) => {
    // Vue Flow handles all parent-child dragging automatically
    // No manual logic needed
  }

  /**
   * Handle nodes change - track selection and dimensions
   */
  const handleNodesChange = (changes: any) => {
    changes.forEach((change: any) => {
      // Track selection changes
      if (change.type === 'select') {
        const currentSelected = nodes.value.filter(n => n.selected).map(n => n.id)

        // Only update if selection actually changed
        const selectedChanged = JSON.stringify(currentSelected) !== JSON.stringify(canvasStore.selectedNodeIds)
        if (selectedChanged) {
          canvasStore.setSelectedNodes(currentSelected)
        }
      }

      // Handle section resize - ONLY update dimensions, not position
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

      // Prevent position updates for sections during resize
      if (change.type === 'position' && change.id.startsWith('section-')) {
        const sectionId = change.id.replace('section-', '')
        if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
          return
        }
      }
    })
  }

  /**
   * Handle drop from inbox or board - supports batch operations
   */
  const handleDrop = (event: DragEvent) => {
    console.log('[useCanvasDragDrop] 🎯 handleDrop CALLED', {
      clientX: event.clientX,
      clientY: event.clientY,
      dataTransfer: event.dataTransfer
    })

    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    console.log('[useCanvasDragDrop] Data from dataTransfer:', data)

    if (!data) {
      console.log('[useCanvasDragDrop] ❌ No data in dataTransfer, exiting')
      return
    }

    const parsedData = JSON.parse(data)
    console.log('[useCanvasDragDrop] Parsed data:', parsedData)

    const { taskId, taskIds, fromInbox, source } = parsedData

    if (fromInbox || source === 'board' || source === 'sidebar') {
      console.log('[useCanvasDragDrop] ✓ Valid source, projecting coordinates...')

      // Use VueFlow's built-in coordinate transformation
      const canvasPosition = project({
        x: event.clientX,
        y: event.clientY
      })

      console.log('[useCanvasDragDrop] Canvas position after projection:', canvasPosition)

      // Handle batch drop (multiple tasks)
      if (taskIds && Array.isArray(taskIds)) {
        console.log('[useCanvasDragDrop] 📦 Batch drop detected, count:', taskIds.length)

        taskIds.forEach((id, index) => {
          // Offset each task slightly to create a staggered layout
          const offsetX = (index % 3) * 250 // 3 columns
          const offsetY = Math.floor(index / 3) * 150 // Row height

          console.log(`[useCanvasDragDrop] Updating task ${id} at (${canvasPosition.x + offsetX}, ${canvasPosition.y + offsetY})`)

          taskStore.updateTaskWithUndo(id, {
            canvasPosition: { x: canvasPosition.x + offsetX, y: canvasPosition.y + offsetY },
            isInInbox: false
          })
        })

        console.log('[useCanvasDragDrop] ✅ Batch drop complete')
      }
      // Handle single task drop
      else if (taskId) {
        console.log(`[useCanvasDragDrop] 📦 Single task drop: ${taskId}`)

        taskStore.updateTaskWithUndo(taskId, {
          canvasPosition: { x: canvasPosition.x, y: canvasPosition.y },
          isInInbox: false
        })

        console.log('[useCanvasDragDrop] ✅ Single task drop complete')
      } else {
        console.log('[useCanvasDragDrop] ⚠️ No taskId or taskIds found')
      }
    } else {
      console.log('[useCanvasDragDrop] ⚠️ Invalid source:', { fromInbox, source })
    }
  }

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  return {
    // Drag handlers
    handleNodeDragStart,
    handleNodeDragStop,
    handleNodeDrag,
    handleNodesChange,
    handleDrop,

    // Helper functions (exposed for testing or other composables)
    getContainingSection,
    isTaskInSectionBounds,
    applySectionPropertiesToTask
  }
}
