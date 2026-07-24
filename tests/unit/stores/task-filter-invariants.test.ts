import { describe, expect, it } from 'vitest'
import {
  areExclusiveTaskFiltersEqual,
  normalizeExclusiveTaskFilters,
  shouldHideDoneTasksForStatus,
} from '@/stores/tasks/filterInvariants'

describe('task filter invariants', () => {
  it('prefers an explicit status when persisted filters contradict each other', () => {
    expect(normalizeExclusiveTaskFilters({
      activeSmartView: 'all_active',
      activeStatusFilter: 'done',
      activeDurationFilter: 'quick',
    })).toEqual({
      activeSmartView: null,
      activeStatusFilter: 'done',
      activeDurationFilter: null,
    })
  })

  it('keeps duration exclusive when no explicit status is present', () => {
    expect(normalizeExclusiveTaskFilters({
      activeSmartView: 'today',
      activeStatusFilter: null,
      activeDurationFilter: 'short',
    })).toEqual({
      activeSmartView: null,
      activeStatusFilter: null,
      activeDurationFilter: 'short',
    })
  })

  it('normalizes the legacy all status without discarding a smart view', () => {
    expect(normalizeExclusiveTaskFilters({
      activeSmartView: 'all_active',
      activeStatusFilter: 'all',
      activeDurationFilter: null,
    })).toEqual({
      activeSmartView: 'all_active',
      activeStatusFilter: null,
      activeDurationFilter: null,
    })
  })

  it('lets an explicit Done filter override the general hide-done preference', () => {
    expect(shouldHideDoneTasksForStatus(true, 'done')).toBe(false)
    expect(shouldHideDoneTasksForStatus(true, 'todo')).toBe(true)
    expect(shouldHideDoneTasksForStatus(true, null)).toBe(true)
  })

  it('treats a legacy contradictory saved view as active after normalization', () => {
    expect(areExclusiveTaskFiltersEqual(
      {
        activeSmartView: null,
        activeStatusFilter: 'done',
        activeDurationFilter: null,
      },
      {
        activeSmartView: 'all_active',
        activeStatusFilter: 'done',
        activeDurationFilter: 'quick',
      }
    )).toBe(true)
  })
})
