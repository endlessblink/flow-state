import { describe, it, expect, beforeEach, vi } from 'vitest'
import { positionManager } from '../PositionManager'
import { lockManager } from '../LockManager'

describe('PositionManager Phase 4 (Coordinate System)', () => {
    // Use singleton instance
    const pm = positionManager

    beforeEach(() => {
        pm.clear()
    })

    describe('getRelativePosition', () => {
        it('returns absolute position for root nodes', () => {
            const nodeId = 'root-1'
            const position = { x: 100, y: 100 }

            pm.updatePosition(nodeId, position, 'user-drag')

            const relative = pm.getRelativePosition(nodeId)
            expect(relative).toEqual(position)
        })

        it('returns relative position for child nodes', () => {
            const parentId = 'group-1'
            const childId = 'task-1'

            // Parent at 100, 100
            pm.updatePosition(parentId, { x: 100, y: 100 }, 'user-drag')

            // Child at Absolute 150, 150
            // Relative should be 50, 50
            pm.updatePosition(childId, { x: 150, y: 150 }, 'user-drag', parentId)

            const relative = pm.getRelativePosition(childId)
            expect(relative).toEqual({ x: 50, y: 50 })
        })

        it('returns undefined if node does not exist', () => {
            expect(pm.getRelativePosition('missing')).toBeUndefined()
        })

        it('handles missing parent gracefully (returns absolute)', () => {
            const childId = 'orphan'
            const parentId = 'ghost'

            // Child claims parent 'ghost', but 'ghost' not in PM
            pm.updatePosition(childId, { x: 200, y: 200 }, 'user-drag', parentId)

            const relative = pm.getRelativePosition(childId)

            expect(relative).toEqual({ x: 200, y: 200 })
        })
    })

    describe('updateFromRelative', () => {
        it('updates absolute position correctly for root nodes', () => {
            const nodeId = 'root-2'
            const relative = { x: 300, y: 300 }

            const success = pm.updateFromRelative(nodeId, relative, 'user-drag')

            expect(success).toBe(true)
            const stored = pm.getPosition(nodeId)
            expect(stored?.position).toEqual(relative)
        })

        it('converts to absolute position for child nodes', () => {
            const parentId = 'group-2'
            const childId = 'task-2'

            // Parent at 50, 50
            pm.updatePosition(parentId, { x: 50, y: 50 }, 'user-drag')

            // Update child with relative {x: 10, y: 10}
            // Should store Absolute {x: 60, y: 60}
            const relative = { x: 10, y: 10 }

            pm.updateFromRelative(childId, relative, 'user-drag', parentId)

            const stored = pm.getPosition(childId)
            expect(stored?.position).toEqual({ x: 60, y: 60 })
            expect(stored?.parentId).toBe(parentId)
        })

        it('respects locks', () => {
            const nodeId = 'locked-node'
            pm.updatePosition(nodeId, { x: 0, y: 0 }, 'user-drag')

            // Simulate lock
            vi.spyOn(lockManager, 'isLocked').mockReturnValue(true)

            const success = pm.updateFromRelative(nodeId, { x: 100, y: 100 }, 'auto-layout')

            expect(success).toBe(false)
            // Position should NOT change
            expect(pm.getPosition(nodeId)?.position).toEqual({ x: 0, y: 0 })
        })
    })
})
