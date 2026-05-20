import { randomBytes } from 'crypto'

export interface AgentBridgeStatus {
  enabled: boolean
  transport: 'stdio'
  bridgeReady: boolean
  tokenIssued: boolean
  bridgeUrl: string | null
  enabledAt: string | null
}

export class AgentBridgeState {
  private enabled = false
  private sessionToken: string | null = null
  private bridgeUrl: string | null = null
  private enabledAt: string | null = null

  getStatus(): AgentBridgeStatus {
    return {
      enabled: this.enabled,
      transport: 'stdio',
      bridgeReady: this.enabled,
      tokenIssued: this.sessionToken !== null,
      bridgeUrl: this.bridgeUrl,
      enabledAt: this.enabledAt,
    }
  }

  enable(bridgeUrl: string | null = null): AgentBridgeStatus {
    if (!this.enabled) {
      this.enabled = true
      this.sessionToken = randomBytes(32).toString('base64url')
      this.enabledAt = new Date().toISOString()
    }

    this.bridgeUrl = bridgeUrl

    return this.getStatus()
  }

  disable(): AgentBridgeStatus {
    this.enabled = false
    this.sessionToken = null
    this.bridgeUrl = null
    this.enabledAt = null
    return this.getStatus()
  }

  getSessionTokenForLaunch(): string | null {
    return this.enabled ? this.sessionToken : null
  }

  getConnectionForLaunch(): { bridgeUrl: string; token: string } | null {
    if (!this.enabled || !this.bridgeUrl || !this.sessionToken) return null
    return { bridgeUrl: this.bridgeUrl, token: this.sessionToken }
  }
}

export const agentBridgeState = new AgentBridgeState()
