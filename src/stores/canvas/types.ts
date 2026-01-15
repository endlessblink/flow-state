import type { CanvasGroup } from '@/types/canvas'

export type { CanvasGroup }
export type CanvasSection = CanvasGroup

export interface AssignOnDropSettings {
    priority?: 'high' | 'medium' | 'low'
    status?: string
    dueDate?: string | null
    projectId?: string | null
    estimatedDuration?: number | null
}

export interface CollectFilterSettings {
    hideDone?: boolean
    types?: string[]
    matchDueDate?: string | null
    matchPriority?: 'high' | 'medium' | 'low'
    matchStatus?: string
    matchDuration?: string
}

export interface CanvasViewport {
    x: number
    y: number
    zoom: number
}
