import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasOperationState } from '../useCanvasOperationState'

describe('useCanvasOperationState', () => {
    let operationState: ReturnType<typeof useCanvasOperationState>

    beforeEach(() => {
        vi.useFakeTimers()
        operationState = useCanvasOperationState()
        operationState.resetToIdle({ flushPending: false })
    })

    afterEach(() => {
        operationState.resetToIdle({ flushPending: false })
        vi.clearAllTimers()
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

            // TASK-1289: settling timeout increased from 800ms to DRAG_SETTLE_TIMEOUT_MS (3000ms)
            vi.advanceTimersByTime(3000)
            expect(operationState.isIdle.value).toBe(true)
        })

        it('replays the latest keyed update after drag settling completes', () => {
            const staleProjection = vi.fn()
            const latestProjection = vi.fn()

            operationState.startDrag(['1'])
            operationState.queueUpdate(staleProjection, { key: 'canvas-projection' })
            operationState.queueUpdate(latestProjection, { key: 'canvas-projection' })
            operationState.endDrag(['1'])

            vi.advanceTimersByTime(2999)
            expect(latestProjection).not.toHaveBeenCalled()

            vi.advanceTimersByTime(1)
            expect(operationState.isIdle.value).toBe(true)
            expect(staleProjection).not.toHaveBeenCalled()
            expect(latestProjection).toHaveBeenCalledTimes(1)
        })

        it('retains a deferred remote projection across consecutive local drags', () => {
            const latestProjection = vi.fn()

            operationState.startDrag(['1'])
            operationState.queueUpdate(latestProjection, {
                key: 'canvas-projection',
                retainOnInteractionRestart: true,
            })
            operationState.endDrag(['1'])

            operationState.startDrag(['2'])
            operationState.endDrag(['2'])
            vi.advanceTimersByTime(3000)

            expect(latestProjection).toHaveBeenCalledTimes(1)
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

        it('coalesces a blocked projection update and flushes the latest work on reset to idle', () => {
            const staleProjection = vi.fn()
            const latestProjection = vi.fn()

            operationState.startDrag(['1'])
            operationState.queueUpdate(staleProjection, { key: 'canvas-projection' })
            operationState.queueUpdate(latestProjection, { key: 'canvas-projection' })

            expect(operationState.getDebugInfo().pendingUpdatesCount).toBe(1)
            expect(staleProjection).not.toHaveBeenCalled()
            expect(latestProjection).not.toHaveBeenCalled()

            operationState.resetToIdle()

            expect(staleProjection).not.toHaveBeenCalled()
            expect(latestProjection).toHaveBeenCalledTimes(1)
            expect(operationState.getDebugInfo().pendingUpdatesCount).toBe(0)
        })

        it('cancels only updates owned by an unmounted projection instance', () => {
            const staleOwner = Symbol('stale-canvas')
            const liveOwner = Symbol('live-canvas')
            const staleProjection = vi.fn()
            const liveProjection = vi.fn()

            operationState.startDrag(['1'])
            operationState.queueUpdate(staleProjection, {
                key: 'canvas-projection',
                owner: staleOwner,
                retainOnInteractionRestart: true,
            })
            operationState.queueUpdate(liveProjection, {
                key: 'canvas-projection',
                owner: liveOwner,
                retainOnInteractionRestart: true,
            })

            operationState.cancelQueuedUpdates(staleOwner)
            operationState.resetToIdle()

            expect(staleProjection).not.toHaveBeenCalled()
            expect(liveProjection).toHaveBeenCalledTimes(1)
        })
    })
})
