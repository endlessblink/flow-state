/**
 * AI Bridge Provider (TASK-1814)
 *
 * Exposes the user's subscription brains (Claude Code / Codex CLIs, via the VPS
 * bridge) as a standard AIProvider. Claude and Codex are equal peers — the
 * active brain is chosen by the user in settings and passed at construction.
 *
 * On any bridge/brain failure this surfaces an error so the AIRouter falls back
 * to the next provider (Groq-free), keeping AI alive even if the token expires.
 */

import type {
  AIProvider,
  AIProviderType,
  AIModel,
  ChatMessage,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  ProviderHealthStatus,
} from '../types'
import { bridgeChat, bridgeChatStream, isBridgeAvailable, BridgeUnavailableError, type BridgeBrain } from '../proxy/bridgeClient'

export class BridgeProvider implements AIProvider {
  readonly type: AIProviderType = 'bridge'
  readonly name = 'Subscription (Claude/Codex)'
  readonly requiresApiKey = false // uses the user's Supabase session + server-side CLI auth

  private brain: BridgeBrain
  private timeout: number
  private lastHealth: ProviderHealthStatus | null = null

  constructor(config: { brain?: BridgeBrain; timeout?: number } = {}) {
    this.brain = config.brain ?? 'claude'
    this.timeout = config.timeout ?? 130_000
  }

  async initialize(): Promise<boolean> {
    return isBridgeAvailable()
  }

  async isAvailable(): Promise<boolean> {
    return isBridgeAvailable()
  }

  async getHealth(): Promise<ProviderHealthStatus> {
    const start = Date.now()
    const ok = await isBridgeAvailable()
    this.lastHealth = {
      isHealthy: ok,
      status: ok ? 'connected' : 'error',
      lastConnected: ok ? new Date() : undefined,
      lastError: ok ? undefined : 'Bridge unreachable',
      latencyMs: Date.now() - start,
    }
    return this.lastHealth
  }

  async listModels(): Promise<AIModel[]> {
    const mk = (id: string, name: string): AIModel => ({
      id,
      name,
      supportsStreaming: false,
      capabilities: ['chat', 'completion'],
    })
    return [mk('claude', 'Claude (subscription)'), mk('codex', 'Codex / GPT (subscription)')]
  }

  async generate(messages: ChatMessage[], options: GenerateOptions): Promise<GenerateResponse> {
    const start = Date.now()
    let lastErr: unknown
    // TASK-1822: try the preferred brain, then fail over to the other (Claude↔Codex)
    // on any bridge/brain failure (error or no credits). Only the two CLI brains.
    for (const brain of this.brainFailoverOrder(options.model)) {
      try {
        const out = await bridgeChat(messages, brain, { timeoutMs: options.timeout ?? this.timeout })
        return {
          content: out.content,
          model: out.model,
          generationTimeMs: Date.now() - start,
          stopReason: 'stop',
        }
      } catch (error) {
        lastErr = error
        // Only fail over on bridge/brain failures; a real code error should surface.
        if (!(error instanceof BridgeUnavailableError)) throw error
      }
    }
    throw lastErr
  }

  /**
   * Real token streaming via the bridge's SSE endpoint. Yields deltas as they
   * arrive (Claude streams tokens; Codex arrives as one chunk on completion).
   *
   * TASK-1822: Claude↔Codex failover. If the preferred brain throws BEFORE any
   * token is yielded (auth / 429 / 502 / no credits — all surfaced pre-stream by
   * bridgeChatStream), retry the other brain. We never switch mid-stream.
   */
  async *generateStream(messages: ChatMessage[], options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const order = this.brainFailoverOrder(options.model)
    let lastErr: unknown
    for (let i = 0; i < order.length; i++) {
      const brain = order[i]
      let yielded = false
      try {
        for await (const delta of bridgeChatStream(messages, brain, { timeoutMs: options.timeout ?? this.timeout })) {
          yielded = true
          yield { content: delta, done: false }
        }
        yield { content: '', done: true }
        return
      } catch (error) {
        lastErr = error
        // Already streamed partial output — can't un-yield, so don't switch brains.
        if (yielded) {
          if (error instanceof BridgeUnavailableError) {
            yield { content: '', done: true, error: error.message }
            return
          }
          throw error
        }
        // Nothing yielded yet. Non-bridge errors surface; bridge errors fail over
        // to the next brain (loop continues). If this was the last brain, rethrow.
        if (!(error instanceof BridgeUnavailableError)) throw error
      }
    }
    throw lastErr
  }

  /** model field may carry an explicit brain override ('claude'|'codex'); else use configured. */
  private resolveBrain(model?: string): BridgeBrain {
    if (model === 'claude' || model === 'codex') return model
    return this.brain
  }

  /** TASK-1822: [preferred brain, the other brain] for automatic failover. */
  private brainFailoverOrder(model?: string): BridgeBrain[] {
    const first = this.resolveBrain(model)
    const other: BridgeBrain = first === 'claude' ? 'codex' : 'claude'
    return [first, other]
  }

  dispose(): void {
    this.lastHealth = null
  }
}

export function createBridgeProvider(config: { brain?: BridgeBrain; timeout?: number } = {}): BridgeProvider {
  return new BridgeProvider(config)
}
