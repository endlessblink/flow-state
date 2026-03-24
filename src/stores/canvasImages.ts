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

  // TASK-1690: Remove image and return it (caller pushes to global undo stack)
  const removeCanvasImage = async (id: string): Promise<CanvasImage | undefined> => {
    const img = images.value.find(i => i.id === id)
    const snapshot = img ? { ...img, position: { ...img.position } } : undefined

    if (img) {
      try {
        await deleteCanvasImage(img.imageUrl)
      } catch (e) {
        console.warn('[CANVAS_IMAGES] Failed to delete from storage:', e)
      }
    }
    images.value = images.value.filter(i => i.id !== id)
    saveToLocalStorage(images.value)
    return snapshot
  }

  // TASK-1690: Restore a previously deleted image (called by global undo system)
  const restoreCanvasImage = (image: CanvasImage) => {
    images.value.push(image)
    saveToLocalStorage(images.value)
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
    restoreCanvasImage,
    updateCanvasImagePosition,
  }
})
