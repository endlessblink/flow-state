/**
 * BUG-153: Unit test for group containment detection
 *
 * Tests the isNodeMoreThanHalfInside function to ensure containment
 * detection works correctly for nested groups.
 */

import { describe, it, expect } from 'vitest'
import { isNodeMoreThanHalfInside } from '../../src/utils/geometry'

describe('BUG-153: Group containment detection', () => {
  describe('isNodeMoreThanHalfInside', () => {
    it('returns true when node is completely inside container', () => {
      // Container: 100x100 at (0,0) to (100, 100)
      // Node: 50x50 at (25, 25) - completely inside
      const result = isNodeMoreThanHalfInside(
        25, 25, 50, 50,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(true)
    })

    it('returns true when node is >50% inside container', () => {
      // Container: 100x100 at (0,0) to (100, 100)
      // Node: 50x50 at (45, 45) - 55x55 area inside (30.25/25 = 121% overlap)
      const result = isNodeMoreThanHalfInside(
        45, 45, 50, 50,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(true)
    })

    it('returns false when node is <50% inside container', () => {
      // Container: 100x100 at (0,0) to (100, 100)
      // Node: 50x50 at (80, 80) - only 20x20 = 400 area inside (16% overlap)
      const result = isNodeMoreThanHalfInside(
        80, 80, 50, 50,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(false)
    })

    it('returns false when node is completely outside container', () => {
      // Container: 100x100 at (0,0) to (100, 100)
      // Node: 50x50 at (200, 200) - no overlap
      const result = isNodeMoreThanHalfInside(
        200, 200, 50, 50,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(false)
    })

    it('returns false when node and container are side by side', () => {
      // Container: 348x312 at (720, 160)
      // Node: 300x200 at (1168, 160) - right edge of container is 1068, node starts at 1168
      const result = isNodeMoreThanHalfInside(
        1168, 160, 300, 200,
        { x: 720, y: 160, width: 348, height: 312 }
      )
      expect(result).toBe(false)
    })

    it('returns true when smaller group dragged into larger group center', () => {
      // Larger group "Today": 500x400 at (100, 100)
      // Smaller group "Group 2": 200x150 at (200, 200) - well inside Today
      const result = isNodeMoreThanHalfInside(
        200, 200, 200, 150,
        { x: 100, y: 100, width: 500, height: 400 }
      )
      expect(result).toBe(true)
    })

    it('returns true with exactly 50.1% overlap', () => {
      // Container: 100x100 at (0,0)
      // Node: 100x100 at (49, 0) - 51x100 = 5100 inside, 10000 total = 51%
      const result = isNodeMoreThanHalfInside(
        49, 0, 100, 100,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(true)
    })

    it('returns false with exactly 49.9% overlap', () => {
      // Container: 100x100 at (0,0)
      // Node: 100x100 at (51, 0) - 49x100 = 4900 inside, 10000 total = 49%
      const result = isNodeMoreThanHalfInside(
        51, 0, 100, 100,
        { x: 0, y: 0, width: 100, height: 100 }
      )
      expect(result).toBe(false)
    })
  })
})
