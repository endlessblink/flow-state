import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { HERMES_ROUTE_CAPABILITIES, SCHEMA_VERSION } = require(
  '../../../server/local-api/hermes-route-capabilities.cjs',
) as {
  HERMES_ROUTE_CAPABILITIES: Array<{
    method: string
    path: string
    contractVersion: string
    available: boolean
  }>
  SCHEMA_VERSION: string
}

describe('Hermes route capability manifest', () => {
  it('enumerates every Hermes route family with a versioned semantic contract', () => {
    expect(SCHEMA_VERSION).toBe('flowstate-hermes-capabilities-v1')
    expect(HERMES_ROUTE_CAPABILITIES).toHaveLength(17)
    expect(new Set(HERMES_ROUTE_CAPABILITIES.map(({ method, path }) => `${method} ${path}`)).size).toBe(17)
    for (const route of HERMES_ROUTE_CAPABILITIES) {
      expect(route).toEqual({
        method: expect.stringMatching(/^(GET|POST|PATCH)$/),
        path: expect.stringMatching(/^\/api\//),
        contractVersion: expect.stringMatching(/-v\d+$/),
        available: expect.any(Boolean),
      })
    }
  })

  it('advertises only contracts that Hermes can invoke end to end', () => {
    expect(HERMES_ROUTE_CAPABILITIES).toContainEqual({
      method: 'POST',
      path: '/api/timer/lifecycle',
      contractVersion: 'timer-lifecycle-v1',
      available: true,
    })
    expect(HERMES_ROUTE_CAPABILITIES).toContainEqual({
      method: 'POST',
      path: '/api/tasks/:id/work-blocks',
      contractVersion: 'work-block-v1',
      available: true,
    })
    expect(HERMES_ROUTE_CAPABILITIES).toContainEqual({
      method: 'POST',
      path: '/api/tasks/:id/subtasks/batch',
      contractVersion: 'task-v1',
      available: true,
    })
  })

  it.each([
    ['PATCH', '/api/tasks/:id'],
    ['POST', '/api/tasks/:id/done-for-now'],
    ['POST', '/api/tasks/:id/merge'],
  ])('names the real task-v1 receipt contract for %s %s', (method, path) => {
    expect(HERMES_ROUTE_CAPABILITIES).toContainEqual({
      method,
      path,
      contractVersion: 'task-v1',
      available: true,
    })
  })
})
