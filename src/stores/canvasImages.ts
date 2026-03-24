import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasImage } from './canvas/types'
import { deleteCanvasImage } from '@/services/canvasImageUpload'

const STORAGE_KEY = 'flowstate:canvas-images'

function loadFromLocalStorage(): CanvasImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CanvasImage[]
  } catch {
    return []
  }
}

function saveToLocalStorage(images: CanvasImage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images))
  } catch (e) {
    console.warn('[CANVAS_IMAGES] Failed to persist to localStorage:', e)
  }
}

export const useCanvasImagesStore = defineStore('canvasImages', () => {
  const images = ref<CanvasImage[]>(loadFromLocalStorage())

  const addCanvasImage = (image: CanvasImage) => {
    images.value.push(image)
    saveToLocalStorage(images.value)
  }

  // TASK-1690: Undo stack for image deletions (Ctrl+Z support)
  const undoStack = ref<CanvasImage[]>([])

  const removeCanvasImage = async (id: string) => {
    const img = images.value.find(i => i.id === id)
    if (img) {
      // Save snapshot for undo before deleting
      undoStack.value.push({ ...img, position: { ...img.position } })
      if (undoStack.value.length > 20) undoStack.value.shift()

      try {
        await deleteCanvasImage(img.imageUrl)
      } catch (e) {
        console.warn('[CANVAS_IMAGES] Failed to delete from storage:', e)
      }
    }
    images.value = images.value.filter(i => i.id !== id)
    saveToLocalStorage(images.value)
  }

  const undoRemoveCanvasImage = () => {
    const img = undoStack.value.pop()
    if (!img) return false
    images.value.push(img)
    saveToLocalStorage(images.value)
    return true
  }

  const updateCanvasImagePosition = (id: string, position: { x: number; y: number }) => {
    const img = images.value.find(i => i.id === id)
    if (img) {
      img.position = position
      saveToLocalStorage(images.value)
    }
  }

  return {
    images,
    addCanvasImage,
    removeCanvasImage,
    undoRemoveCanvasImage,
    updateCanvasImagePosition,
  }
})
