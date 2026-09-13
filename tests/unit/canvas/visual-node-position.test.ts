import { describe, expect, it, vi } from 'vitest'
import { getRenderedFlowPosition, resolveVisualNodePosition } from '@/utils/canvas/visualNodePosition'

describe('getRenderedFlowPosition', () => {
  it('recovers flow coordinates from a rendered task missing Vue Flow position state', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    const element = {
      getBoundingClientRect: () => ({ left: 410, top: 260 }),
    }
    const root = {
      querySelector: vi.fn((selector: string) => selector.startsWith('[data-task-id=') ? element : null),
    }
    const screenToFlowCoordinate = vi.fn(({ x, y }) => ({ x: x - 110, y: y - 60 }))

    expect(getRenderedFlowPosition('loose-today-task', screenToFlowCoordinate, root)).toEqual({
      x: 300,
      y: 200,
    })
    expect(screenToFlowCoordinate).toHaveBeenCalledWith({ x: 410, y: 260 })
  })

  it('returns undefined when the renderer has no matching node', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    const root = { querySelector: vi.fn(() => null) }
    expect(getRenderedFlowPosition('missing', vi.fn(), root)).toBeUndefined()
  })

  it('prefers the rendered card over stale Vue Flow geometry', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    const root = {
      querySelector: vi.fn(() => ({
        getBoundingClientRect: () => ({ left: 410, top: 260 }),
      })),
    }
    const findNode = vi.fn(() => ({ position: { x: 999, y: 999 } }))

    expect(resolveVisualNodePosition(
      'stale-today-task',
      findNode,
      ({ x, y }) => ({ x: x - 110, y: y - 60 }),
      root,
    )).toEqual({ x: 300, y: 200 })
    expect(findNode).not.toHaveBeenCalled()
  })
})
