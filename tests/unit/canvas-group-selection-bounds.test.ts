import { describe, expect, it } from 'vitest'
import { calculateSelectionGroupPosition } from '@/composables/canvas/useCanvasActions'

describe('canvas group selection bounds', () => {
  it('covers the measured height of every selected task in a tall vertical stack', () => {
    const position = calculateSelectionGroupPosition([
      {
        position: { x: 320, y: 120 },
        dimensions: { width: 280, height: 80 },
      },
      {
        position: { x: 320, y: 220 },
        dimensions: { width: 280, height: 310 },
      },
      {
        position: { x: 320, y: 550 },
        dimensions: { width: 280, height: 180 },
      },
    ])

    expect(position).toEqual({
      x: 280,
      y: 80,
      width: 360,
      height: 690,
    })
    expect(position.y + position.height).toBeGreaterThanOrEqual(550 + 180)
  })

  it('uses absolute positions for tasks selected inside existing groups', () => {
    const position = calculateSelectionGroupPosition([
      {
        position: { x: 20, y: 30 },
        computedPosition: { x: 500, y: 600 },
        dimensions: { width: 280, height: 140 },
      },
      {
        position: { x: 20, y: 190 },
        computedPosition: { x: 500, y: 760 },
        dimensions: { width: 280, height: 200 },
      },
    ])

    expect(position).toEqual({
      x: 460,
      y: 560,
      width: 360,
      height: 440,
    })
  })
})
