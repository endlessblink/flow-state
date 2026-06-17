import { describe, it, expect } from 'vitest'
import { deterministicGroupId, isUuidGroupId, isMigratableDayGroup } from '@/utils/canvas/legacyGroupId'

describe('legacyGroupId (TASK-1871)', () => {
  const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  it('detects real UUIDs vs legacy ids', () => {
    expect(isUuidGroupId('cccccccc-cccc-4ccc-8ccc-cccccccccc01')).toBe(true)
    expect(isUuidGroupId('group-1700000000000')).toBe(false)
    expect(isUuidGroupId('Monday')).toBe(false)
    expect(isUuidGroupId(null)).toBe(false)
  })

  it('produces a valid UUID', () => {
    const id = deterministicGroupId(USER, { id: 'legacy-monday', name: 'Monday' })
    expect(isUuidGroupId(id)).toBe(true)
  })

  it('CONVERGES: two devices\' "Monday" (different legacy ids) map to the SAME uuid', () => {
    const a = deterministicGroupId(USER, { id: 'group-111', name: 'Monday' })
    const b = deterministicGroupId(USER, { id: 'group-999', name: 'Monday' })
    expect(a).toBe(b)
  })

  it('CONVERGES across case differences (detection lower-cases the name)', () => {
    const a = deterministicGroupId(USER, { id: 'group-111', name: 'Monday' })
    const b = deterministicGroupId(USER, { id: 'group-222', name: 'monday' })
    expect(b).toBe(a)
  })

  it('different day columns get different ids', () => {
    const mon = deterministicGroupId(USER, { id: 'a', name: 'Monday' })
    const tue = deterministicGroupId(USER, { id: 'b', name: 'Tuesday' })
    const tom = deterministicGroupId(USER, { id: 'c', name: 'Tomorrow' })
    expect(new Set([mon, tue, tom]).size).toBe(3)
  })

  it('different users do NOT collide', () => {
    const u1 = deterministicGroupId('user-1', { id: 'x', name: 'Monday' })
    const u2 = deterministicGroupId('user-2', { id: 'x', name: 'Monday' })
    expect(u1).not.toBe(u2)
  })

  it('only day-columns are migratable (not junk like Done/1/custom)', () => {
    expect(isMigratableDayGroup('Monday')).toBe(true)
    expect(isMigratableDayGroup('Today')).toBe(true)
    expect(isMigratableDayGroup('Tomorrow')).toBe(true)
    expect(isMigratableDayGroup('Done')).toBe(false)
    expect(isMigratableDayGroup('1')).toBe(false)
    expect(isMigratableDayGroup('My Custom Group')).toBe(false)
    expect(isMigratableDayGroup('')).toBe(false)
  })

  it('non-keyword legacy groups fall back to their legacy id (stable per device)', () => {
    const a = deterministicGroupId(USER, { id: 'group-custom-xyz', name: 'My Custom Stuff' })
    const again = deterministicGroupId(USER, { id: 'group-custom-xyz', name: 'My Custom Stuff' })
    expect(a).toBe(again)
    expect(isUuidGroupId(a)).toBe(true)
  })
})
