/**
 * TASK-1214: Parent Chain Property Inheritance Tests
 *
 * Tests for nested group property inheritance in the canvas:
 *   - getParentChain() in src/utils/canvas/storeHelpers.ts
 *   - getSectionProperties() in src/composables/canvas/useCanvasSectionProperties.ts
 *
 * When a task is dropped into a child group inside a parent group, the task
 * should inherit properties from ALL ancestors.  Child properties override
 * parent properties when there is a conflict.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'

// ─── Mocks (must come before composable imports) ────────────────────────────

// Silence getCSSColor calls that hit document.documentElement in jsdom
vi.stubGlobal('document', {
  documentElement: {
    style: {},
  },
  getElementById: vi.fn(),
  createElement: vi.fn(() => ({ style: {} })),
})

// getComputedStyle is called by getCSSColor inside storeHelpers
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }))

// import.meta.env.DEV used by logGroupIdHistogram
vi.stubGlobal('import.meta', { env: { DEV: false } })

// ─── Imports ────────────────────────────────────────────────────────────────

import { getParentChain } from '@/utils/canvas/storeHelpers'
import { useCanvasSectionProperties } from '@/composables/canvas/useCanvasSectionProperties'
import type { CanvasSection } from '@/stores/canvas'

// ─── Test helpers ───────────────────────────────────────────────────────────

/** Minimal valid CanvasGroup — only supply what you care about. */
function makeGroup(overrides: Partial<CanvasGroup> & { id: string; name: string }): CanvasGroup {
  return {
    type: 'custom',
    position: { x: 0, y: 0, width: 300, height: 400 },
    color: '#6366f1',
    layout: 'freeform',
    isVisible: true,
    isCollapsed: false,
    parentGroupId: null,
    ...overrides,
  } as CanvasGroup
}

/** Build a minimal SectionPropertiesDeps mock (taskStore + getAllContainingSections). */
function makeDeps() {
  return {
    taskStore: {
      updateTaskWithUndo: vi.fn(),
    } as any,
    getAllContainingSections: vi.fn().mockReturnValue([]),
  }
}

// Fixed "today" for deterministic date assertions
const FIXED_DATE = new Date('2026-04-02T12:00:00.000Z')
const TODAY_KEY = '2026-04-02'
const TOMORROW_KEY = '2026-04-03'

// ────────────────────────────────────────────────────────────────────────────
// getParentChain tests
// ────────────────────────────────────────────────────────────────────────────

describe('getParentChain()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1: single group with no parent returns [group]', () => {
    const group = makeGroup({ id: 'g1', name: 'Solo', parentGroupId: null })
    const chain = getParentChain('g1', [group])
    expect(chain).toHaveLength(1)
    expect(chain[0].id).toBe('g1')
  })

  it('2: two-level nesting returns [child, parent]', () => {
    const parent = makeGroup({ id: 'parent', name: 'Parent', parentGroupId: null })
    const child = makeGroup({ id: 'child', name: 'Child', parentGroupId: 'parent' })
    const chain = getParentChain('child', [parent, child])
    expect(chain).toHaveLength(2)
    expect(chain[0].id).toBe('child')
    expect(chain[1].id).toBe('parent')
  })

  it('3: three-level nesting returns [child, parent, grandparent]', () => {
    const grandparent = makeGroup({ id: 'gp', name: 'Grandparent', parentGroupId: null })
    const parent = makeGroup({ id: 'p', name: 'Parent', parentGroupId: 'gp' })
    const child = makeGroup({ id: 'c', name: 'Child', parentGroupId: 'p' })
    const chain = getParentChain('c', [grandparent, parent, child])
    expect(chain).toHaveLength(3)
    expect(chain.map(g => g.id)).toEqual(['c', 'p', 'gp'])
  })

  it('4: cycle detection — A→B→A stops without infinite loop', () => {
    // Manually construct cyclic refs (breakGroupCycles would normally clean these)
    const a = makeGroup({ id: 'A', name: 'A', parentGroupId: 'B' })
    const b = makeGroup({ id: 'B', name: 'B', parentGroupId: 'A' })
    // Should return without throwing, and have at most 2 entries
    const chain = getParentChain('A', [a, b])
    expect(chain.length).toBeGreaterThanOrEqual(1)
    expect(chain.length).toBeLessThanOrEqual(2)
    // Verify no infinite loop by reaching here
  })

  it('5: missing parent — parentGroupId points to nonexistent group → stops at current', () => {
    const group = makeGroup({ id: 'g1', name: 'Orphan', parentGroupId: 'ghost-id' })
    const chain = getParentChain('g1', [group])
    // The walk stops because byId lookup returns undefined
    expect(chain).toHaveLength(1)
    expect(chain[0].id).toBe('g1')
  })

  it('6: empty groups array returns []', () => {
    const chain = getParentChain('g1', [])
    expect(chain).toEqual([])
  })

  it('7: respects maxDepth parameter', () => {
    // Build a 5-deep chain
    const groups: CanvasGroup[] = []
    for (let i = 0; i < 5; i++) {
      groups.push(makeGroup({
        id: `g${i}`,
        name: `Group ${i}`,
        parentGroupId: i > 0 ? `g${i - 1}` : null,
      }))
    }
    // g4 → g3 → g2 → g1 → g0, maxDepth=2 should return only [g4, g3]
    const chain = getParentChain('g4', groups, 2)
    expect(chain).toHaveLength(2)
    expect(chain[0].id).toBe('g4')
    expect(chain[1].id).toBe('g3')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// getSectionProperties tests (with parent chain inheritance)
// ────────────────────────────────────────────────────────────────────────────

describe('getSectionProperties() — parent chain inheritance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('8: single "Today" group returns { dueDate: todayFormatted }', () => {
    const today = makeGroup({ id: 'today', name: 'Today', parentGroupId: null })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(today as CanvasSection, [today])

    expect(props.dueDate).toBe(TODAY_KEY)
    expect(props.priority).toBeUndefined()
  })

  it('9: parent="Today", child="High Priority" → inherits dueDate AND priority', () => {
    const parent = makeGroup({ id: 'today-grp', name: 'Today', parentGroupId: null })
    const child = makeGroup({ id: 'high-grp', name: 'High Priority', parentGroupId: 'today-grp' })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(child as CanvasSection, [parent, child])

    // Child sets priority, parent contributes dueDate
    expect(props.dueDate).toBe(TODAY_KEY)
    expect(props.priority).toBe('high')
  })

  it('10: parent="High Priority", child="Today" → child dueDate wins, parent priority inherited', () => {
    const parent = makeGroup({ id: 'high-grp', name: 'High Priority', parentGroupId: null })
    const child = makeGroup({ id: 'today-grp', name: 'Today', parentGroupId: 'high-grp' })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(child as CanvasSection, [parent, child])

    expect(props.dueDate).toBe(TODAY_KEY)
    expect(props.priority).toBe('high')
  })

  it('11: no allGroups provided → falls back to single-section behavior', () => {
    const today = makeGroup({ id: 'today', name: 'Today', parentGroupId: null })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    // No allGroups arg → backward-compatible single-section path
    const props = getSectionProperties(today as CanvasSection)

    expect(props.dueDate).toBe(TODAY_KEY)
  })

  it('11b: empty allGroups array → falls back to single-section behavior', () => {
    const today = makeGroup({ id: 'today', name: 'Today', parentGroupId: null })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(today as CanvasSection, [])

    expect(props.dueDate).toBe(TODAY_KEY)
  })

  it('12: child assignOnDrop overrides parent keyword', () => {
    const parent = makeGroup({ id: 'today-grp', name: 'Today', parentGroupId: null })
    const child = makeGroup({
      id: 'custom-grp',
      name: 'Custom',
      parentGroupId: 'today-grp',
      assignOnDrop: {
        // Explicit "later" clears the dueDate inherited from "Today" parent
        dueDate: 'later',
        priority: 'low',
      },
    })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(child as CanvasSection, [parent, child])

    // Child's assignOnDrop.dueDate='later' overrides parent's "Today" dueDate
    // (resolveDueDate('later') returns '' per useGroupSettings)
    expect(props.dueDate).toBe('')
    expect(props.priority).toBe('low')
  })

  it('child "Tomorrow" overrides parent "Today" dueDate', () => {
    const parent = makeGroup({ id: 'today-grp', name: 'Today', parentGroupId: null })
    const child = makeGroup({ id: 'tomorrow-grp', name: 'Tomorrow', parentGroupId: 'today-grp' })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(child as CanvasSection, [parent, child])

    // Child is closer to root in merge order (last wins), so Tomorrow overrides Today
    expect(props.dueDate).toBe(TOMORROW_KEY)
  })

  it('day-of-week group dueDate matches the visible group suffix target for today', () => {
    vi.setSystemTime(new Date(2026, 5, 9, 12, 0, 0, 0))
    const tuesday = makeGroup({ id: 'tuesday-grp', name: 'Tuesday', parentGroupId: null })
    const today = makeGroup({ id: 'today-grp', name: 'Today', parentGroupId: null })
    const tomorrow = makeGroup({ id: 'tomorrow-grp', name: 'Tomorrow', parentGroupId: null })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(tuesday as CanvasSection, [today, tomorrow, tuesday])

    expect(props.dueDate).toBe('2026-06-09')
  })

  it('three levels: grandparent="Today", parent="High Priority", child="Done" → all three inherited', () => {
    // "Done" is a canonical status keyword that maps to status='done'
    // ("In Progress" maps to 'todo' in the power keyword table, so use "Done" for clarity)
    const gp = makeGroup({ id: 'gp', name: 'Today', parentGroupId: null })
    const p = makeGroup({ id: 'p', name: 'High Priority', parentGroupId: 'gp' })
    const child = makeGroup({ id: 'c', name: 'Done', parentGroupId: 'p' })
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())

    const props = getSectionProperties(child as CanvasSection, [gp, p, child])

    expect(props.dueDate).toBe(TODAY_KEY)
    expect(props.priority).toBe('high')
    expect(props.status).toBe('done')
  })

  it('getSectionProperties returns {} when section has no id', () => {
    const noId = { name: 'Ghost' } as unknown as CanvasSection
    const { getSectionProperties } = useCanvasSectionProperties(makeDeps())
    expect(getSectionProperties(noId, [])).toEqual({})
  })
})
