import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import router from '@/router/index'

describe('Router', () => {
  let originalOpen: typeof window.open

  beforeEach(() => {
    originalOpen = window.open
    window.open = vi.fn()
  })

  afterEach(() => {
    window.open = originalOpen
  })

  it('opens design system in new tab with noopener,noreferrer', () => {
    const designSystemRoute = router.getRoutes().find(r => r.name === 'design-system')
    expect(designSystemRoute).toBeDefined()

    if (designSystemRoute && designSystemRoute.beforeEnter) {
        // @ts-ignore
      const result = designSystemRoute.beforeEnter({}, {}, () => {})

      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:6006',
        '_blank',
        'noopener,noreferrer'
      )
      expect(result).toBe(false)
    } else {
        throw new Error('design-system route or beforeEnter guard not found')
    }
  })
})
