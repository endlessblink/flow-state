/**
 * Ollama Local AI Provider
 *
 * Implements the AIProvider interface for local Ollama instances.
 * Features:
 * - Auto-detection of local Ollama on startup (localhost:11434)
 * - Model listing via /api/tags
 * - Streaming responses via /api/chat
 * - Connection health monitoring with automatic reconnection
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import type {
  AIProvider,
  AIModel,
  ChatMessage,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  ProviderHealthStatus,
  ProviderConnectionStatus,
  OllamaConfig,
  AIProviderEvent,
  AIProviderEventListener,
  ModelCapability,
} from '../types'
import { DEFAULT_OLLAMA_CONFIG } from '../types'

// ============================================================================
// Ollama API Types
// ============================================================================

/**
 * Ollama /api/tags response model format.
 */
interface OllamaModelInfo {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model?: string
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
  }
}

/**
 * Ollama /api/tags response.
 */
interface OllamaTagsResponse {
  models: OllamaModelInfo[]
}

/**
 * Ollama /api/version response.
 */
interface OllamaVersionResponse {
  version: string
}

/**
 * Ollama /api/chat request.
 */
interface OllamaChatRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
  options?: {
    temperature?: number
    num_predict?: number
    stop?: string[]
  }
}

/**
 * Ollama /api/chat response (non-streaming).
 */
interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

/**
 * Ollama /api/chat streaming chunk.
 */
interface OllamaStreamChunk {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  eval_count?: number
}

// ============================================================================
// Ollama Provider Implementation
// ============================================================================

/**
 * Ollama local AI provider implementation.
 */
export class OllamaProvider implements AIProvider {
  readonly type = 'ollama' as const
  readonly name = 'Ollama (Local)'
  readonly requiresApiKey = false

  private config: OllamaConfig
  private healthStatus: ProviderHealthStatus
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private eventListeners: Set<AIProviderEventListener> = new Set()
  private abortControllers: Set<AbortController> = new Set()
  private initialized = false

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config }
    this.healthStatus = {
      isHealthy: false,
      status: 'disconnected',
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Initialize the provider and optionally auto-detect Ollama.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return this.healthStatus.isHealthy
    }

    console.log('[Ollama] Initializing provider...')

    if (this.config.autoDetect) {
      const detected = await this.detectOllama()
      if (detected) {
        console.log('[Ollama] Auto-detected Ollama instance')
        this.startHealthMonitoring()
      } else {
        console.log('[Ollama] No Ollama instance detected')
      }
    }

    this.initialized = true
    return this.healthStatus.isHealthy
  }

  /**
   * Check if Ollama is currently available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get current health status.
   */
  async getHealth(): Promise<ProviderHealthStatus> {
    await this.checkHealth()
    return { ...this.healthStatus }
  }

  /**
   * List available models from Ollama.
   */
  async listModels(): Promise<AIModel[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`)
      }

      const data: OllamaTagsResponse = await response.json()
      return data.models.map(model => this.mapOllamaModelToAIModel(model))
    } catch (error) {
      console.error('[Ollama] Failed to list models:', error)
      throw error
    }
  }

  /**
   * Generate a response (non-streaming).
   */
  async generate(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<GenerateResponse> {
    const startTime = Date.now()

    const request: OllamaChatRequest = {
      model: options.model,
      messages: this.prepareMessages(messages, options.systemPrompt),
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
        stop: options.stopSequences,
      },
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
        options.timeout || this.config.timeout
      )

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`)
      }

      const data: OllamaChatResponse = await response.json()
      const generationTimeMs = Date.now() - startTime

      return {
        content: data.message.content,
        model: data.model,
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        generationTimeMs,
        truncated: false,
        stopReason: 'stop',
      }
    } catch (error) {
      console.error('[Ollama] Generation failed:', error)
      throw error
    }
  }

  /**
   * Generate a streaming response.
   */
  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    const abortController = new AbortController()
    this.abortControllers.add(abortController)

    const request: OllamaChatRequest = {
      model: options.model,
      messages: this.prepareMessages(messages, options.systemPrompt),
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
        stop: options.stopSequences,
      },
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: abortController.signal,
        },
        options.timeout || this.config.timeout
      )

      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // Process complete JSON lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const chunk: OllamaStreamChunk = JSON.parse(line)
              yield {
                content: chunk.message.content,
                done: chunk.done,
              }

              if (chunk.done) {
                return
              }
            } catch (parseError) {
              console.warn('[Ollama] Failed to parse chunk:', line)
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const chunk: OllamaStreamChunk = JSON.parse(buffer)
            yield {
              content: chunk.message.content,
              done: chunk.done,
            }
          } catch {
            // Ignore incomplete final chunk
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        yield { content: '', done: true, error: 'Request aborted' }
      } else {
        console.error('[Ollama] Streaming failed:', error)
        yield {
          content: '',
          done: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    } finally {
      this.abortControllers.delete(abortController)
    }
  }

  /**
   * Dispose of provider resources.
   */
  dispose(): void {
    console.log('[Ollama] Disposing provider...')

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // Abort any pending requests
    for (const controller of this.abortControllers) {
      controller.abort()
    }
    this.abortControllers.clear()

    // Clear event listeners
    this.eventListeners.clear()

    this.initialized = false
    this.healthStatus = {
      isHealthy: false,
      status: 'disconnected',
    }
  }

  // --------------------------------------------------------------------------
  // Event System
  // --------------------------------------------------------------------------

  /**
   * Subscribe to provider events.
   */
  addEventListener(listener: AIProviderEventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  /**
   * Emit an event to all listeners.
   */
  private emitEvent(event: AIProviderEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[Ollama] Event listener error:', error)
      }
    }
  }

  // --------------------------------------------------------------------------
  // Health Monitoring
  // --------------------------------------------------------------------------

  /**
   * Auto-detect Ollama instance on localhost.
   */
  private async detectOllama(): Promise<boolean> {
    this.updateHealthStatus('checking')

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now()
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/api/tags`,
          { method: 'GET' },
          5000 // 5 second timeout for detection
        )

        if (response.ok) {
          const latencyMs = Date.now() - startTime

          // Try to get version
          let version: string | undefined
          try {
            const versionResponse = await this.fetchWithTimeout(
              `${this.baseUrl}/api/version`,
              { method: 'GET' },
              2000
            )
            if (versionResponse.ok) {
              const versionData: OllamaVersionResponse =
                await versionResponse.json()
              version = versionData.version
            }
          } catch {
            // Version endpoint may not exist in older Ollama versions
          }

          this.healthStatus = {
            isHealthy: true,
            status: 'connected',
            lastConnected: new Date(),
            latencyMs,
            version,
          }

          this.emitEvent({ type: 'connected', provider: 'ollama' })
          return true
        }
      } catch (error) {
        console.log(
          `[Ollama] Detection attempt ${attempt + 1}/${this.config.maxRetries} failed`
        )
      }

      // Wait before retry
      if (attempt < this.config.maxRetries - 1) {
        await this.sleep(this.config.retryDelay)
      }
    }

    this.updateHealthStatus('disconnected')
    return false
  }

  /**
   * Check health of the Ollama connection.
   */
  private async checkHealth(): Promise<void> {
    const previousStatus = this.healthStatus.status

    try {
      const startTime = Date.now()
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        5000
      )

      if (response.ok) {
        const latencyMs = Date.now() - startTime

        this.healthStatus = {
          ...this.healthStatus,
          isHealthy: true,
          status: 'connected',
          lastConnected: new Date(),
          latencyMs,
          lastError: undefined,
        }

        // Emit connected event if status changed
        if (previousStatus !== 'connected') {
          this.emitEvent({ type: 'connected', provider: 'ollama' })
        }
      } else {
        throw new Error(`Health check failed: ${response.statusText}`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      this.healthStatus = {
        ...this.healthStatus,
        isHealthy: false,
        status: 'error',
        lastError: errorMessage,
      }

      // Emit disconnected event if status changed
      if (previousStatus === 'connected') {
        this.emitEvent({
          type: 'disconnected',
          provider: 'ollama',
          reason: errorMessage,
        })
      }
    }

    this.emitEvent({
      type: 'health_check',
      provider: 'ollama',
      status: this.healthStatus,
    })
  }

  /**
   * Start periodic health monitoring.
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(
      () => this.checkHealth(),
      this.config.healthCheckInterval
    )
  }

  /**
   * Update health status and emit event.
   */
  private updateHealthStatus(status: ProviderConnectionStatus): void {
    this.healthStatus = {
      ...this.healthStatus,
      status,
      isHealthy: status === 'connected',
    }
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get the base URL for Ollama API.
   */
  private get baseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`
  }

  /**
   * Fetch with timeout support.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = this.config.timeout || 60000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Prepare messages with optional system prompt.
   */
  private prepareMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): { role: string; content: string }[] {
    const prepared: { role: string; content: string }[] = []

    if (systemPrompt) {
      prepared.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      prepared.push({ role: msg.role, content: msg.content })
    }

    return prepared
  }

  /**
   * Map Ollama model info to AIModel.
   */
  private mapOllamaModelToAIModel(model: OllamaModelInfo): AIModel {
    // Extract capabilities from model family/name
    const capabilities: ModelCapability[] = ['chat', 'completion']

    // Vision models
    if (
      model.name.includes('llava') ||
      model.name.includes('vision') ||
      model.name.includes('bakllava')
    ) {
      capabilities.push('vision')
    }

    // Embedding models
    if (model.name.includes('embed') || model.name.includes('nomic')) {
      capabilities.push('embedding')
    }

    // Parse parameter size
    const sizeMatch = model.details?.parameter_size?.match(
      /(\d+(?:\.\d+)?)\s*([BM])/i
    )
    let parameters: number | undefined
    if (sizeMatch) {
      const num = parseFloat(sizeMatch[1])
      const unit = sizeMatch[2].toUpperCase()
      parameters = unit === 'B' ? num * 1e9 : num * 1e6
    }

    return {
      id: model.name,
      name: model.name,
      description: `${model.details?.family || 'Unknown'} model${model.details?.quantization_level ? ` (${model.details.quantization_level})` : ''}`,
      size: model.details?.parameter_size,
      parameters,
      supportsStreaming: true,
      capabilities,
      metadata: {
        digest: model.digest,
        modifiedAt: model.modified_at,
        sizeBytes: model.size,
        family: model.details?.family,
        format: model.details?.format,
        quantization: model.details?.quantization_level,
      },
    }
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Update provider configuration.
   */
  updateConfig(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config }

    // Restart health monitoring if interval changed
    if (config.healthCheckInterval && this.healthCheckTimer) {
      this.startHealthMonitoring()
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): OllamaConfig {
    return { ...this.config }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Ollama provider instance.
 */
export function createOllamaProvider(
  config: Partial<OllamaConfig> = {}
): OllamaProvider {
  return new OllamaProvider(config)
}

/**
 * Auto-detect and create an Ollama provider if available.
 * Returns null if Ollama is not detected.
 */
export async function autoDetectOllama(
  config: Partial<OllamaConfig> = {}
): Promise<OllamaProvider | null> {
  const provider = new OllamaProvider({ ...config, autoDetect: true })
  const available = await provider.initialize()

  if (available) {
    return provider
  }

  provider.dispose()
  return null
}
