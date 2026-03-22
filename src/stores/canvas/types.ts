import type { CanvasGroup, AssignOnDropSettings, CollectFilterSettings } from '@/types/canvas'

export type { CanvasGroup, AssignOnDropSettings, CollectFilterSettings }
export type CanvasSection = CanvasGroup

export interface CanvasViewport {
    x: number
    y: number
    zoom: number
}

export interface CanvasImage {
    id: string
    imageUrl: string
    position: { x: number; y: number }
    width?: number
    height?: number
    createdAt: string
}
