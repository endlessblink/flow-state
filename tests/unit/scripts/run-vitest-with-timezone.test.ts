import { describe, expect, it } from 'vitest'
import { createVitestEnvironment } from '../../../scripts/run-vitest-with-timezone.cjs'

describe('run-vitest-with-timezone', () => {
  it('starts Vitest with the configured local timezone', () => {
    expect(createVitestEnvironment({ TZ: 'UTC', PATH: '/usr/bin' })).toMatchObject({
      TZ: 'Asia/Jerusalem',
      PATH: '/usr/bin'
    })
  })
})
