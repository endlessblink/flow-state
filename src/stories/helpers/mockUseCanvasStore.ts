/**
 * Mock useCanvasStore hook for Storybook
 *
 * This file provides a mock implementation of the useCanvasStore composable
 * that can be imported and used directly in Storybook stories to bypass
 * the real store dependencies.
 */

import { ref } from 'vue'
import type { CanvasSection } from '@/stores/canvas'

// Store mock state
const mockSections = ref<CanvasSection[]>([
  {
    id: 'section-mock-1',
    name: 'Sample Group 1',
    type: 'custom',
    position: { x: 100, y: 100, width: 300, height: 200 },
    color: '#3b82f6',
    layout: 'grid',
    isVisible: true,
    isCollapsed: false
  },
  {
    id: 'section-mock-2',
    name: 'Sample Group 2',
    type: 'custom',
    position: { x: 500, y: 200, width: 280, height: 180 },
    color: '#ef4444',
    layout: 'grid',
    isVisible: true,
    isCollapsed: false
  }
])

// Mock store implementation
export const mockUseCanvasStore = () => {
  const createSection = (section: Omit<CanvasSection, 'id'>): CanvasSection => {
    const newSection: CanvasSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    mockSections.value.push(newSection)

    // Log for debugging in Storybook
    console.log('🔧 Mock Canvas Store: Created section', newSection)

    return newSection
  }

  const updateSection = (id: string, updates: Partial<CanvasSection>): void => {
    const section = mockSections.value.find(s => s.id === id)
    if (section) {
      Object.assign(section, updates)
      console.log('🔧 Mock Canvas Store: Updated section', id, updates)
    } else {
      console.warn('🔧 Mock Canvas Store: Section not found for update', id)
    }
  }

  const deleteSection = (id: string): void => {
    const index = mockSections.value.findIndex(s => s.id === id)
    if (index !== -1) {
      const deleted = mockSections.value.splice(index, 1)[0]
      console.log('🔧 Mock Canvas Store: Deleted section', deleted)
    } else {
      console.warn('🔧 Mock Canvas Store: Section not found for deletion', id)
    }
  }

  // Return minimal store interface needed by GroupModal
  return {
    sections: mockSections.value,
    createSection,
    updateSection,
    deleteSection,
    // Additional store properties that might be accessed
    viewport: ref({ x: 0, y: 0, zoom: 1 }),
    selectedNodeIds: ref<string[]>([]),
    connectMode: ref(false),
    connectingFrom: ref<string | null>(null),
    activeSectionId: ref<string | null>(null),
    showSectionGuides: ref(true),
    snapToSections: ref(true),
    // Add any other properties that GroupModal might access
    nodes: ref<any[]>([]),
    edges: ref<any[]>([]),
    multiSelectMode: ref(false),
    selectionRect: ref<{ x: number; y: number; width: number; height: number } | null>(null),
    selectionMode: ref<'rectangle' | 'lasso' | 'click'>('rectangle'),
    isSelecting: ref(false),
    zoomHistory: ref<{ zoom: number; timestamp: number }[]>([]),
    multiSelectActive: ref(false),
    // Add common methods that might be called
    setViewport: () => {},
    setSelectedNodes: () => {},
    toggleNodeSelection: () => {},
    clearSelection: () => {},
    toggleConnectMode: () => {},
    startConnection: () => {},
    clearConnection: () => {}
  }
}

// Export for use in stories
export default mockUseCanvasStore