import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasOperationState } from '../useCanvasOperationState'

describe('useCanvasOperationState', () => {
    let operationState: ReturnType<typeof useCanvasOperationState>

    beforeEach(() => {
        operationState = useCanvasOperationState()
        operationState.resetToIdle()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should initialize as idle', () => {
        expect(operationState.isIdle.value).toBe(true)
        expect(operationState.currentType.value).toBe('idle')
    })

    describe('Drag Transitions', () => {
        it('should start dragging from idle', () => {
            const result = operationState.startDrag(['1'])

            expect(result).toBe(true)
            expect(operationState.isDragging.value).toBe(true)
            expect(operationState.state.value.type).toBe('dragging')
        })

        it('should fail to start dragging if not idle', () => {
            operationState.setEditing('1')
            const result = operationState.startDrag(['1'])
            expect(result).toBe(false)
            expect(operationState.isDragging.value).toBe(false)
        })

        it('should transition to drag-settling after drag ends', () => {
            operationState.startDrag(['1'])
            operationState.endDrag(['1'])

            expect(operationState.currentType.value).toBe('drag-settling')
            expect(operationState.isLocked.value).toBe(true)
        })

        it('should return to idle after settling timeout', () => {
            operationState.startDrag(['1'])
            operationState.endDrag(['1'])

            vi.advanceTimersByTime(800)
            expect(operationState.isIdle.value).toBe(true)
        })
    })

    describe('Resize Transitions', () => {
        it('should start resizing from idle', () => {
            const result = operationState.startResize('group-1', 'bottom-right')
            expect(result).toBe(true)
            expect(operationState.isResizing.value).toBe(true)
        })

        it('should transition to resize-settling after resize ends', () => {
            operationState.startResize('group-1', 'br')
            operationState.endResize('group-1')
            expect(operationState.currentType.value).toBe('resize-settling')
        })
    })

    describe('Guards', () => {
        it('should block remote updates when not idle or syncing', () => {
            operationState.startDrag(['1'])
            expect(operationState.canAcceptRemoteUpdate.value).toBe(false)
            expect(operationState.isLocked.value).toBe(true)
        })

        it('should allow remote updates when idle', () => {
            expect(operationState.canAcceptRemoteUpdate.value).toBe(true)
            expect(operationState.isLocked.value).toBe(false)
        })

        it('should allow remote updates when syncing', () => {
            operationState.setSyncing('remote')
            expect(operationState.canAcceptRemoteUpdate.value).toBe(true)
        })
    })
})
