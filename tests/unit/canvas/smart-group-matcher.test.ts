import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculatePositionInGroup, findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
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

/**
 * TASK-1756 v7: findMatchingGroupForDueDate must match day-of-week groups
 * on EXACT target date (via getDayGroupDate), not just weekday. Otherwise a
 * task due three weeks out on a Tuesday sticks inside the "Tuesday" group
 * whose header says this-week Tuesday.
 */
describe('findMatchingGroupForDueDate — day-of-week exact date matching', () => {
    // Sunday 2026-04-19. Weekday indices: Sun=0, Mon=1, Tue=2, …
    const SUNDAY_2026_04_19 = new Date(2026, 3, 19, 10, 0, 0, 0)

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(SUNDAY_2026_04_19)
    })
    afterEach(() => vi.useRealTimers())

    function dayGroup(id: string, name: string): CanvasGroup {
        return { id, name, isVisible: true, position: { x: 0, y: 0, width: 350, height: 600 } } as unknown as CanvasGroup
    }

    it('matches when the task due date equals the Tuesday group target (with no Today/Tomorrow)', () => {
        const tuesday = dayGroup('g-tue', 'Tuesday')
        // With no Today/Tomorrow groups, Tuesday from Sunday = +2 days = 2026-04-21
        const match = findMatchingGroupForDueDate('2026-04-21', [tuesday])
        expect(match?.id).toBe('g-tue')
    })

    it('does NOT match a Tuesday-weekday date that is one week out (user rescheduled +1 week)', () => {
        const tuesday = dayGroup('g-tue', 'Tuesday')
        // 2026-04-28 is a Tuesday, but the Tuesday group currently targets 2026-04-21.
        // Strict date match must return null → BUG-1757 drops the task to inbox.
        const match = findMatchingGroupForDueDate('2026-04-28', [tuesday])
        expect(match).toBeNull()
    })

    it('does NOT match a Tuesday-weekday date one MONTH out (the original user repro)', () => {
        const tuesday = dayGroup('g-tue', 'Tuesday')
        // 2026-05-19 is a Tuesday but a month later — must not sit inside "Tuesday" group.
        const match = findMatchingGroupForDueDate('2026-05-19', [tuesday])
        expect(match).toBeNull()
    })

    it('Today + Tomorrow smart groups do not shift a future day-of-week target', () => {
        // Tuesday from Sunday stays 2026-04-21 even when Today/Tomorrow exist.
        // Overlap cases are handled by smart-group sort priority, not by
        // changing the weekday target date.
        const today = dayGroup('g-today', 'Today')
        const tomorrow = dayGroup('g-tomorrow', 'Tomorrow')
        const tuesday = dayGroup('g-tue', 'Tuesday')
        // Tuesday = +2 days (Sunday + 2 = Tuesday 21.4). Match at 21.4.
        expect(findMatchingGroupForDueDate('2026-04-21', [today, tomorrow, tuesday])?.id).toBe('g-tue')
        // 28.4 still doesn't match
        expect(findMatchingGroupForDueDate('2026-04-28', [today, tomorrow, tuesday])).toBeNull()
    })

    it('with Today+Tomorrow, today still routes to Today before the same-day weekday group', () => {
        // Day-of-week groups no longer skip Today/Tomorrow by adding a week.
        // Overlaps are resolved by specificity: Today/Tomorrow sort before
        // weekday groups, so today's due date still lands in Today.
        const today = dayGroup('g-today', 'Today')
        const tomorrow = dayGroup('g-tomorrow', 'Tomorrow')
        const sunday = dayGroup('g-sun', 'Sunday')
        expect(findMatchingGroupForDueDate('2026-04-19', [today, tomorrow, sunday])?.id).toBe('g-today')
        expect(findMatchingGroupForDueDate('2026-04-26', [today, tomorrow, sunday])).toBeNull()
    })
})
