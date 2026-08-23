import { describe, expect, it } from 'vitest'
import router from '@/router'

describe('router fallback', () => {
  it('resolves unknown paths to a visible not-found route', () => {
    const resolved = router.resolve('/route-that-does-not-exist')

    expect(resolved.name).toBe('not-found')
  })
})
