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
    const brain = this.resolveBrain(options.model)
    const out = await bridgeChat(messages, brain, { timeoutMs: options.timeout ?? this.timeout })
    return {
      content: out.content,
      model: out.model,
      generationTimeMs: Date.now() - start,
      stopReason: 'stop',
    }
  }

  /**
   * Real token streaming via the bridge's SSE endpoint. Yields deltas as they
   * arrive (Claude streams tokens; Codex arrives as one chunk on completion).
   */
  async *generateStream(messages: ChatMessage[], options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const brain = this.resolveBrain(options.model)
    let yielded = false
    try {
      for await (const delta of bridgeChatStream(messages, brain, { timeoutMs: options.timeout ?? this.timeout })) {
        yielded = true
        yield { content: delta, done: false }
      }
      yield { content: '', done: true }
    } catch (error) {
      // If nothing streamed yet (e.g. auth/connect failure), THROW so the router
      // falls back to the next provider. If we already streamed tokens, end the
      // chunk with an error marker instead (can't un-yield partial output).
      if (!yielded && error instanceof BridgeUnavailableError) throw error
      if (error instanceof BridgeUnavailableError) {
        yield { content: '', done: true, error: error.message }
        return
      }
      throw error
    }
  }

  /** model field may carry an explicit brain override ('claude'|'codex'); else use configured. */
  private resolveBrain(model?: string): BridgeBrain {
    if (model === 'claude' || model === 'codex') return model
    return this.brain
  }

  dispose(): void {
    this.lastHealth = null
  }
}

export function createBridgeProvider(config: { brain?: BridgeBrain; timeout?: number } = {}): BridgeProvider {
  return new BridgeProvider(config)
}
