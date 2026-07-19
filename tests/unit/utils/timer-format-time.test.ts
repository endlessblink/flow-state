import { describe, expect, it } from 'vitest'
import { formatTime } from '@/utils/timer/formatTime'

describe('timer display boundary', () => {
  it('never renders negative or non-finite remaining time', () => {
    expect(formatTime(-1)).toBe('00:00')
    expect(formatTime(-63)).toBe('00:00')
    expect(formatTime(Number.NaN)).toBe('00:00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('00:00')
  })

  it('floors fractional seconds without changing normal MM:SS output', () => {
    expect(formatTime(63.9)).toBe('01:03')
    expect(formatTime(1500)).toBe('25:00')
  })
})
