import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'server/local-api/server.cjs'), 'utf8')

describe('TASK-1965 protected command routes', () => {
  it('wires recurrence reads and lifecycle preview/apply behind bearer auth', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const readRoute = source.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/recurrence$/)")

    expect(source).toContain("require('./recurrence-lifecycle.cjs')")
    expect(readRoute).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('readRecurrenceChain(ctx, taskId)')
    expect(source).toContain('executeRecurrenceLifecycle(ctx, body, notifyTaskMutation)')
  })

  it('wires exact timer reads and explicit commands behind bearer auth', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const commandRoute = source.indexOf("path === '/api/timer/command'")
    const sessionRoute = source.indexOf("path.match(/^\\/api\\/timer\\/sessions\\/([^/]+)$/)")

    expect(source).toContain("require('./timer-command.cjs')")
    expect(commandRoute).toBeGreaterThan(tokenBoundary)
    expect(sessionRoute).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('executeTimerCommand(ctx, body, notifyTimerMutation)')
    expect(source).toContain('readTimerSession(ctx, sessionId)')
  })

  it('wires exact organization inventory and task assignment behind bearer auth', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const inventoryRoute = source.indexOf("path === '/api/organization'")
    const commandRoute = source.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/organization\\/(assign-project|set-canvas-group)$/)")

    expect(source).toContain("require('./organization.cjs')")
    expect(inventoryRoute).toBeGreaterThan(tokenBoundary)
    expect(commandRoute).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('readOrganizationInventory(ctx)')
    expect(source).toContain('executeOrganizationCommand(ctx, action, taskId, body, notifyTaskMutation)')
  })

  it('serves the versioned capability manifest only after bearer auth', () => {
    const tokenBoundary = source.indexOf('if (TOKEN)')
    const route = source.indexOf("path === '/api/capabilities'")

    expect(source).toContain("require('./capabilities.cjs')")
    expect(route).toBeGreaterThan(tokenBoundary)
    expect(source).toContain('getCapabilityManifest()')
  })
})
