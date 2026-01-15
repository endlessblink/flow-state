/**
 * Core types for the centralized Canvas Position System.
 */

export interface Position2D {
    x: number
    y: number
}

export interface NodePosition {
    id: string
    position: Position2D
    // If undefined, node is at root level. IF defined, node is child of this parent.
    // This is CRITICAL for managing the "Parent" vs "Absolute" coordinate systems.
    parentId: string | null
}

export interface LockRequest {
    nodeId: string
    source: LockSource
    timeout?: number
}

export type LockSource =
    | 'user-drag'       // User is actively dragging
    | 'user-resize'     // User is resizing a group
    | 'auto-layout'     // System is running auto-layout
    | 'remote-sync'     // Updates coming from database/realtime
    | 'cleanup'         // Cleanup operations

// Event types for the PositionManager event bus
export type PositionEventType =
    | 'position-changed'
    | 'lock-acquired'
    | 'lock-released'

export interface PositionEvent {
    type: PositionEventType
    nodeId: string
    payload?: any
}
