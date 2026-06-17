/**
 * TASK-1871: write-storm tripwire. The same row written many times/sec is a
 * feedback loop (the tidy/rotation storm that flooded the API). This guard
 * throws in dev so it surfaces immediately; distinct rows never trip it.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { recordWrite, resetWriteRate } from '@/utils/sync/writeRateGuard'

describe('writeRateGuard (TASK-1871)', () => {
  beforeEach(() => resetWriteRate())

  it('does NOT trip on bulk writes to DISTINCT rows (load/import)', () => {
    expect(() => {
      for (let i = 0; i < 200; i++) recordWrite('task', `task-${i}`)
    }).not.toThrow()
  })

  it('THROWS in dev when the SAME row is hammered (storm signature)', () => {
    expect(() => {
      for (let i = 0; i < 50; i++) recordWrite('group', 'same-group-id')
    }).toThrow(/WRITE-STORM/)
  })

  it('counts per (channel, entity) independently', () => {
    // 10 writes to one task is fine (under threshold)
    expect(() => {
      for (let i = 0; i < 10; i++) recordWrite('task', 'a')
    }).not.toThrow()
  })
})
