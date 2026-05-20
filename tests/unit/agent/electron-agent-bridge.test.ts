import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AgentBridgeState } from '../../../electron/agentBridgeState'

const root = process.cwd()

describe('Electron local agent bridge state', () => {
  it('starts disabled with no issued session token', () => {
    const bridge = new AgentBridgeState()

    expect(bridge.getStatus()).toEqual({
      enabled: false,
      transport: 'stdio',
      bridgeReady: false,
      tokenIssued: false,
      bridgeUrl: null,
      enabledAt: null,
    })
    expect(bridge.getSessionTokenForLaunch()).toBeNull()
  })

  it('enables with an internal token but never exposes token in status', () => {
    const bridge = new AgentBridgeState()
    const status = bridge.enable('http://127.0.0.1:4567')

    expect(status.enabled).toBe(true)
    expect(status.transport).toBe('stdio')
    expect(status.bridgeReady).toBe(true)
    expect(status.tokenIssued).toBe(true)
    expect(status.bridgeUrl).toBe('http://127.0.0.1:4567')
    expect(status).not.toHaveProperty('sessionToken')
    expect(status).not.toHaveProperty('token')
    expect(bridge.getSessionTokenForLaunch()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rotates token after disable and re-enable', () => {
    const bridge = new AgentBridgeState()

    bridge.enable()
    const firstToken = bridge.getSessionTokenForLaunch()
    bridge.disable()
    bridge.enable()
    const secondToken = bridge.getSessionTokenForLaunch()

    expect(firstToken).toBeTruthy()
    expect(secondToken).toBeTruthy()
    expect(secondToken).not.toBe(firstToken)
  })

  it('does not expose a token-returning renderer preload API', () => {
    const preload = readFileSync(join(root, 'electron/preload.ts'), 'utf-8')

    expect(preload).toContain('agentGetStatus')
    expect(preload).toContain('agentEnable')
    expect(preload).toContain('agentDisable')
    expect(preload).not.toContain('agentGetToken')
    expect(preload).not.toContain('agentToken')
  })
})
