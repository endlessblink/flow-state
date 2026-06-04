import { describe, expect, it } from 'vitest'
import { snapPositionToGrid } from '../coordinates'

describe('canvas coordinate helpers', () => {
  it('snaps positions to the canvas grid', () => {
    expect(snapPositionToGrid({ x: 101, y: 107 })).toEqual({ x: 96, y: 112 })
    expect(snapPositionToGrid({ x: -7, y: -9 })).toEqual({ x: 0, y: -16 })
  })

  it('supports a custom grid size', () => {
    expect(snapPositionToGrid({ x: 13, y: 27 }, 10)).toEqual({ x: 10, y: 30 })
  })
})
