import type { CanvasGroup, AssignOnDropSettings, CollectFilterSettings } from '@/types/canvas'

export type { CanvasGroup, AssignOnDropSettings, CollectFilterSettings }
export type CanvasSection = CanvasGroup

export interface CanvasViewport {
    x: number
    y: number
    zoom: number
}
