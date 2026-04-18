import { describe, it, expect } from 'vitest'
import { calculatePositionInGroup } from '@/composables/canvas/useSmartGroupMatcher'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { CANVAS } from '@/constants/canvas'

/**
 * BUG-1773: Canvas auto-placement must left-align tasks at the group's
 * padding edge and stack them vertically without overlap, including when
 * callers place several tasks in one synchronous batch.
 */

const PADDING = 20
const HEADER = 50
const GAP = 10

function makeGroup(): CanvasGroup {
    return {
        id: 'grp-today',
        name: 'Today',
        position: { x: 100, y: 200, width: 400, height: 600 },
        isVisible: true,
    } as unknown as CanvasGroup
}

function taskAt(id: string, parentId: string, x: number, y: number): Task {
    return { id, parentId, canvasPosition: { x, y } } as unknown as Task
}

describe('calculatePositionInGroup (BUG-1773)', () => {
    const group = makeGroup()
    const expectedLeft = group.position!.x + PADDING
    const expectedFirstTop = group.position!.y + HEADER + PADDING

    it('places the first task at the group padding edge (true left-align, no +20 indent)', () => {
        const pos = calculatePositionInGroup(group, [])
        expect(pos.x).toBe(expectedLeft)
        expect(pos.y).toBe(expectedFirstTop)
    })

    it('stacks the second task below the first with a 10px gap, same X', () => {
        const first = taskAt('t1', group.id, expectedLeft, expectedFirstTop)
        const second = calculatePositionInGroup(group, [first])
        expect(second.x).toBe(expectedLeft)
        expect(second.y).toBe(expectedFirstTop + CANVAS.DEFAULT_TASK_HEIGHT + GAP)
    })

    it('treats alreadyPlacedPositions as siblings for batch callers (reactivity-lag safe)', () => {
        // Simulate the store having no tasks yet but the current batch already
        // placed two. Third call must stack below both without consulting store.
        const batch = [
            { x: expectedLeft, y: expectedFirstTop },
            { x: expectedLeft, y: expectedFirstTop + CANVAS.DEFAULT_TASK_HEIGHT + GAP },
        ]
        const third = calculatePositionInGroup(group, [], batch)
        expect(third.x).toBe(expectedLeft)
        expect(third.y).toBe(expectedFirstTop + 2 * (CANVAS.DEFAULT_TASK_HEIGHT + GAP))
    })

    it('continues stacking below the visible area instead of centering when full', () => {
        // Fill vertical space with enough siblings that the next position
        // exceeds maxY. Behavior must remain left-aligned + stacked, NOT
        // jump to group center (which caused overlap complaints).
        const height = group.position!.height
        const rows = Math.floor(height / (CANVAS.DEFAULT_TASK_HEIGHT + GAP)) + 2
        const siblings: Task[] = []
        for (let i = 0; i < rows; i++) {
            siblings.push(
                taskAt(`t${i}`, group.id, expectedLeft, expectedFirstTop + i * (CANVAS.DEFAULT_TASK_HEIGHT + GAP))
            )
        }
        const pos = calculatePositionInGroup(group, siblings)
        const groupCenterX = group.position!.x + group.position!.width / 2 - CANVAS.DEFAULT_TASK_WIDTH / 2
        const groupCenterY = group.position!.y + group.position!.height / 2 - CANVAS.DEFAULT_TASK_HEIGHT / 2
        expect(pos.x).toBe(expectedLeft)
        expect(pos.x).not.toBe(groupCenterX)
        expect(pos.y).not.toBe(groupCenterY)
        // Must be below the last sibling, not overlapping
        const lastBottom = siblings[siblings.length - 1].canvasPosition!.y + CANVAS.DEFAULT_TASK_HEIGHT + GAP
        expect(pos.y).toBe(lastBottom)
    })

    it('ignores tasks belonging to other groups', () => {
        const otherGroupSibling = taskAt('ta', 'grp-other', expectedLeft, expectedFirstTop + 500)
        const pos = calculatePositionInGroup(group, [otherGroupSibling])
        expect(pos).toEqual({ x: expectedLeft, y: expectedFirstTop })
    })
})
