import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockDeleteCanvasImage } = vi.hoisted(() => ({
  mockDeleteCanvasImage: vi.fn()
}))

vi.mock('@/services/canvasImageUpload', () => ({
  deleteCanvasImage: mockDeleteCanvasImage
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    groups: [],
    sections: [],
    selectedNodeIds: [],
    setSelectedNodes: vi.fn(),
    setGroups: vi.fn()
  })
}))

vi.mock('@/stores/canvas/canvasUi', () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({ showUndoRedoToasts: false })
}))

import { useCanvasImagesStore } from '@/stores/canvasImages'
import { getUndoSystem, pushImageDeleteUndo, resetUndoSystem } from '@/composables/undoSingleton'
import type { CanvasImage } from '@/stores/canvas/types'

describe('canvas image delete undo/redo three-cycle invariants', () => {
  beforeEach(() => {
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    resetUndoSystem()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('undoes and redoes image deletion three consecutive times without duplicate restores', async () => {
    const imageStore = useCanvasImagesStore()
    const undoSystem = getUndoSystem()
    const image: CanvasImage = {
      id: 'image-delete-cycle',
      imageUrl: 'https://example.test/image.png',
      position: { x: 160, y: 220 },
      createdAt: '2026-05-26T16:30:00.000Z'
    }

    imageStore.addCanvasImage(image)

    const snapshot = await imageStore.removeCanvasImage(image.id)
    expect(snapshot).toEqual(image)
    expect(imageStore.images).toHaveLength(0)

    pushImageDeleteUndo(snapshot!)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(imageStore.images).toHaveLength(1)
      expect(imageStore.images[0]).toEqual(image)

      await undoSystem.redo()

      expect(imageStore.images).toHaveLength(0)
    }
  })

  it('removes only local metadata so undo never restores a URL whose blob was deleted', async () => {
    const imageStore = useCanvasImagesStore()
    const image: CanvasImage = {
      id: 'image-local-first-delete',
      imageUrl: 'https://example.test/slow-delete.png',
      position: { x: 40, y: 80 },
      createdAt: '2026-07-14T08:00:00.000Z'
    }
    imageStore.addCanvasImage(image)

    const snapshot = imageStore.removeCanvasImage(image.id)

    expect(snapshot).toEqual(image)
    expect(imageStore.images).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('flowstate:canvas-images') || '[]')).toEqual([])

    expect(mockDeleteCanvasImage).not.toHaveBeenCalled()
  })
})
