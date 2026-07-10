import { describe, expect, it } from 'vitest'
import {
  getActiveQuickSortDuePreset,
  resolveQuickSortDueDate
} from '@/utils/quickSortDuePresets'

const FRIDAY = new Date(2026, 6, 10, 12)

describe('Quick Sort due-date presets', () => {
  it('maps semantic postpone choices to stable local dates', () => {
    expect(resolveQuickSortDueDate('today', FRIDAY)).toBe('2026-07-10')
    expect(resolveQuickSortDueDate('tomorrow', FRIDAY)).toBe('2026-07-11')
    expect(resolveQuickSortDueDate('in3days', FRIDAY)).toBe('2026-07-13')
    expect(resolveQuickSortDueDate('weekend', FRIDAY)).toBe('2026-07-11')
    expect(resolveQuickSortDueDate('nextweek', FRIDAY)).toBe('2026-07-17')
    expect(resolveQuickSortDueDate('in2weeks', FRIDAY)).toBe('2026-07-24')
    expect(resolveQuickSortDueDate('in1month', FRIDAY)).toBe('2026-08-10')
    expect(resolveQuickSortDueDate('clear', FRIDAY)).toBe('')
  })

  it('treats weekend as the following Saturday when today is Saturday', () => {
    expect(resolveQuickSortDueDate('weekend', new Date(2026, 6, 11, 12))).toBe('2026-07-18')
  })

  it('identifies every preset so the chosen shortcut can render selected', () => {
    expect(getActiveQuickSortDuePreset('2026-07-13', FRIDAY)).toBe('in3days')
    expect(getActiveQuickSortDuePreset('2026-07-24', FRIDAY)).toBe('in2weeks')
    expect(getActiveQuickSortDuePreset('2026-08-10', FRIDAY)).toBe('in1month')
    expect(getActiveQuickSortDuePreset('2026-07-20', FRIDAY)).toBeNull()
    expect(getActiveQuickSortDuePreset('', FRIDAY)).toBe('clear')
  })

  it('clamps one calendar month to the destination month end', () => {
    expect(resolveQuickSortDueDate('in1month', new Date(2026, 0, 31, 12))).toBe('2026-02-28')
    expect(resolveQuickSortDueDate('in1month', new Date(2024, 0, 31, 12))).toBe('2024-02-29')
    expect(resolveQuickSortDueDate('in1month', new Date(2026, 2, 31, 12))).toBe('2026-04-30')
  })
})
