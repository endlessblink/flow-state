/**
 * AI Router - Smart routing between multiple AI providers
 *
 * Provides intelligent routing with:
 * - Automatic fallback on failure
 * - Health-based provider selection
 * - Task-type based routing (local vs cloud preference)
 * - Cost tracking per provider
 * - Support for streaming and non-streaming requests
 *
 * Routing Priority:
 * 1. Ollama (local) - Privacy-focused, free, fast for simple tasks
 * 2. DeepSeek - Cost-effective cloud, good for moderate tasks
 * 3. Claude (Anthropic) - Premium cloud, best for complex reasoning
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import type {
  ChatMessage,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  ProviderHealthStatus,
  OllamaConfig,
  AIProvider,
} from './types'

import {
  DEFAULT_OLLAMA_CONFIG,
} from './types'

import {
  OllamaProvider,
} from './providers/ollama'
import { DeepSeekProvider } from './providers/deepseek'
import { ClaudeProvider } from './providers/claude'

// ============================================================================
// Task Types - Determine routing strategy
// ============================================================================

/**
 * Task type determines which provider is preferred.
 * Local tasks (chat, parsing) prefer Ollama.
 * Cloud tasks (complex reasoning) prefer Claude/DeepSeek.
 */
export type TaskType =
  | 'chat'              // General chat - prefers local
  | 'task_parsing'      // Fast parsing - prefers local
  | 'task_breakdown'    // Complex reasoning - prefers cloud
  | 'canvas_analysis'   // Moderate - prefers local
  | 'planning'          // Complex - prefers cloud
  | 'suggestion'        // Simple - prefers local
  | 'general'           // No preference

/**
 * Router-specific provider type (extends AIProviderType).
 */
export type RouterProviderType = 'ollama' | 'deepseek' | 'claude'

// ============================================================================
// Router Configuration
// ============================================================================

/**
 * Configuration for the AI Router.
 */
export interface RouterConfig {
  /** Provider priority order (first = highest priority) */
  providers: RouterProviderType[]

  /** Enable automatic fallback on failure */
  fallbackEnabled: boolean

  /** Prefer local providers (Ollama) when available */
  preferLocal: boolean

  /** Maximum retry attempts across providers */
  maxRetries: number

  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number

  /** Cache health check results for this duration (ms) */
  healthCacheDurationMs: number

  /** Enable debug logging */
  debug: boolean
}

/**
 * Default router configuration.
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  providers: ['ollama', 'deepseek', 'claude'],
  fallbackEnabled: true,
  preferLocal: true,
  maxRetries: 2,
  healthCheckIntervalMs: 60000,    // 1 minute
  healthCacheDurationMs: 30000,    // 30 seconds
  debug: false
}

/**
 * Options for router operations.
 */
export interface RouterOptions extends Partial<GenerateOptions> {
  /** Override task type for this request */
  taskType?: TaskType

  /** Force a specific provider (skip routing logic) */
  forceProvider?: RouterProviderType

  /** Disable fallback for this request */
  disableFallback?: boolean
}

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * Cost tracking per provider.
 */
export interface ProviderCostTracking {
  /** Total requests made */
  totalRequests: number

  /** Total tokens used (prompt + completion) */
  totalTokens: number

  /** Estimated cost in USD (based on provider pricing) */
  estimatedCostUSD: number

  /** Last updated timestamp */
  lastUpdated: Date
}

/**
 * Pricing per provider (per 1M tokens).
 */
const PROVIDER_PRICING: Record<RouterProviderType, { input: number; output: number }> = {
  ollama: { input: 0, output: 0 },        // Free (local)
  deepseek: { input: 0.14, output: 0.28 }, // $0.14/$0.28 per 1M tokens
  claude: { input: 3.00, output: 15.00 }   // Claude 3 Sonnet pricing
}

// ============================================================================
// AI Router Implementation
// ============================================================================

/**
 * AI Router - Intelligent routing between multiple AI providers.
 *
 * Usage:
 * ```typescript
 * const router = createAIRouter()
 * await router.initialize()
 *
 * // Simple request (auto-routes)
 * const response = await router.chat([
 *   { role: 'user', content: 'Hello!' }
 * ])
 *
 * // With task type hint
 * const response = await router.chat(messages, {
 *   taskType: 'task_breakdown'
 * })
 *
 * // Force specific provider
 * const response = await router.chat(messages, {
 *   forceProvider: 'claude'
 * })
 * ```
 */
export class AIRouter {
  // ============================================================================
  // Properties
  // ============================================================================

  private config: RouterConfig
  private providers: Map<RouterProviderType, AIProvider | null> = new Map()
  private healthCache: Map<RouterProviderType, {
    result: ProviderHealthStatus
    timestamp: number
  }> = new Map()
  private costTracking: Map<RouterProviderType, ProviderCostTracking> = new Map()
  private initialized = false
  private healthCheckInterval?: ReturnType<typeof setInterval>

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config }

    // Initialize cost tracking
    for (const provider of this.config.providers) {
      this.costTracking.set(provider, {
        totalRequests: 0,
        totalTokens: 0,
        estimatedCostUSD: 0,
        lastUpdated: new Date()
      })
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the router and available providers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Router already initialized')
      return
    }

    this.log('Initializing AI Router...')

    // Initialize each provider based on availability
    await this.initializeProviders()

    // Start periodic health checks
    if (this.config.healthCheckIntervalMs > 0) {
      this.startHealthChecks()
    }

    this.initialized = true
    this.log('AI Router initialized', {
      availableProviders: Array.from(this.providers.entries())
        .filter(([, p]) => p !== null)
        .map(([type]) => type)
    })
  }

  /**
   * Initialize all configured providers.
   */
  private async initializeProviders(): Promise<void> {
    const initPromises = this.config.providers.map(async (providerType) => {
      try {
        const provider = await this.createProvider(providerType)
        if (provider) {
          this.providers.set(providerType, provider)
          this.log(`Provider ${providerType} initialized`)
        } else {
          this.providers.set(providerType, null)
          this.log(`Provider ${providerType} not available`)
        }
      } catch (error) {
        this.log(`Failed to initialize ${providerType}`, error)
        this.providers.set(providerType, null)
      }
    })

    await Promise.allSettled(initPromises)
  }

  /**
   * Create a provider instance based on type.
   */
  private async createProvider(
    providerType: RouterProviderType
  ): Promise<AIProvider | null> {
    switch (providerType) {
      case 'ollama':
        return await this.createOllamaProvider()

      case 'deepseek':
        return await this.createDeepSeekProvider()

      case 'claude':
        return await this.createClaudeProvider()

      default:
        this.log(`Unknown provider type: ${providerType}`)
        return null
    }
  }

  /**
   * Create Ollama provider instance.
   */
  private async createOllamaProvider(): Promise<OllamaProvider | null> {
    try {
      // Check environment variable for Ollama URL
      const host = import.meta.env.VITE_OLLAMA_HOST || DEFAULT_OLLAMA_CONFIG.host
      const port = import.meta.env.VITE_OLLAMA_PORT
        ? parseInt(import.meta.env.VITE_OLLAMA_PORT)
        : DEFAULT_OLLAMA_CONFIG.port

      const config: Partial<OllamaConfig> = {
        host,
        port,
        autoDetect: true
      }

      // Create and initialize provider
      const provider = new OllamaProvider(config)
      const success = await provider.initialize()

      if (!success) {
        this.log('Ollama initialization failed')
        return null
      }

      return provider
    } catch (error) {
      this.log('Failed to create Ollama provider', error)
      return null
    }
  }

  /**
   * Create DeepSeek provider instance.
   */
  private async createDeepSeekProvider(): Promise<AIProvider | null> {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY

    if (!apiKey) {
      this.log('DeepSeek API key not found (VITE_DEEPSEEK_API_KEY)')
      return null
    }

    try {
      const provider = new DeepSeekProvider({ apiKey })
      const success = await provider.initialize()

      if (!success) {
        this.log('DeepSeek initialization failed')
        return null
      }

      return provider
    } catch (error) {
      this.log('Failed to create DeepSeek provider', error)
      return null
    }
  }

  /**
   * Create Claude (Anthropic) provider instance.
   */
  private async createClaudeProvider(): Promise<AIProvider | null> {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

    if (!apiKey) {
      this.log('Anthropic API key not found (VITE_ANTHROPIC_API_KEY)')
      return null
    }

    try {
      const provider = new ClaudeProvider({ apiKey })
      const success = await provider.initialize()

      if (!success) {
        this.log('Claude initialization failed')
        return null
      }

      return provider
    } catch (error) {
      this.log('Failed to create Claude provider', error)
      return null
    }
  }

  // ============================================================================
  // Core Routing Methods
  // ============================================================================

  /**
   * Chat completion with automatic provider routing.
   */
  async chat(
    messages: ChatMessage[],
    options: RouterOptions = {}
  ): Promise<GenerateResponse> {
    this.ensureInitialized()

    const taskType = options.taskType ?? 'general'
    const provider = await this.selectProvider(taskType, options)

    if (!provider) {
      throw new Error('No healthy AI providers available')
    }

    // Merge options with defaults
    const generateOptions: GenerateOptions = {
      model: options.model ?? (provider.type === 'ollama' ? 'llama3.2' : 'gpt-4'),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stopSequences: options.stopSequences,
      systemPrompt: options.systemPrompt,
      timeout: options.timeout,
    }

    try {
      const response = await provider.generate(messages, generateOptions)

      // Track costs
      const providerType = this.getProviderType(provider)
      this.trackCost(
        providerType,
        response.totalTokens ?? 0,
        response.promptTokens ?? 0,
        response.completionTokens ?? 0
      )

      return response
    } catch (error) {
      // Try fallback if enabled
      if (this.config.fallbackEnabled && !options.disableFallback) {
        return await this.fallbackChat(messages, generateOptions, provider)
      }

      throw error
    }
  }

  /**
   * Streaming chat completion with automatic provider routing.
   */
  async *chatStream(
    messages: ChatMessage[],
    options: RouterOptions = {}
  ): AsyncGenerator<StreamChunk> {
    this.ensureInitialized()

    const taskType = options.taskType ?? 'general'
    const provider = await this.selectProvider(taskType, options)

    if (!provider) {
      throw new Error('No healthy AI providers available')
    }

    // Merge options with defaults
    const generateOptions: GenerateOptions = {
      model: options.model ?? (provider.type === 'ollama' ? 'llama3.2' : 'gpt-4'),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stopSequences: options.stopSequences,
      systemPrompt: options.systemPrompt,
      stream: true,
      timeout: options.timeout,
    }

    try {
      // Track that we started a request
      const providerType = this.getProviderType(provider)
      const tracking = this.costTracking.get(providerType)
      if (tracking) {
        tracking.totalRequests++
      }

      for await (const chunk of provider.generateStream(messages, generateOptions)) {
        yield chunk
      }
    } catch (error) {
      // Note: Fallback is more complex for streams - not implemented yet
      // Would need to restart the stream from the beginning
      throw error
    }
  }

  /**
   * Fallback to next available provider.
   */
  private async fallbackChat(
    messages: ChatMessage[],
    options: GenerateOptions,
    failedProvider: AIProvider
  ): Promise<GenerateResponse> {
    const failedType = this.getProviderType(failedProvider)
    this.log(`Falling back from ${failedType}`)

    // Get next provider in priority order
    const currentIndex = this.config.providers.indexOf(failedType)
    const remainingProviders = this.config.providers.slice(currentIndex + 1)

    for (const providerType of remainingProviders) {
      const provider = this.providers.get(providerType)
      if (!provider) continue

      try {
        const health = await this.getProviderHealth(providerType)
        if (!health.isHealthy) continue

        this.log(`Trying fallback provider: ${providerType}`)

        const response = await provider.generate(messages, options)

        this.trackCost(
          providerType,
          response.totalTokens ?? 0,
          response.promptTokens ?? 0,
          response.completionTokens ?? 0
        )

        return response
      } catch (error) {
        this.log(`Fallback to ${providerType} failed`, error)
        continue
      }
    }

    throw new Error('All providers failed')
  }

  // ============================================================================
  // Provider Selection
  // ============================================================================

  /**
   * Select the best provider for a task.
   */
  private async selectProvider(
    taskType: TaskType,
    options: RouterOptions
  ): Promise<AIProvider | null> {
    // Force specific provider if requested
    if (options.forceProvider) {
      const provider = this.providers.get(options.forceProvider)
      if (!provider) {
        throw new Error(`Forced provider ${options.forceProvider} not available`)
      }
      return provider
    }

    // Determine provider order based on task type and config
    const providerOrder = this.getProviderOrder(taskType)

    // Find first healthy provider
    for (const providerType of providerOrder) {
      const provider = this.providers.get(providerType)
      if (!provider) continue

      const health = await this.getProviderHealth(providerType)
      if (health.isHealthy) {
        this.log(`Selected provider: ${providerType} for task: ${taskType}`)
        return provider
      }
    }

    return null
  }

  /**
   * Get provider order based on task type.
   */
  private getProviderOrder(taskType: TaskType): RouterProviderType[] {
    const localPreferredTasks: TaskType[] = ['chat', 'task_parsing', 'canvas_analysis', 'suggestion']
    const cloudPreferredTasks: TaskType[] = ['task_breakdown', 'planning']

    // If prefer local and task is local-preferred, prioritize local
    if (this.config.preferLocal && localPreferredTasks.includes(taskType)) {
      return [...this.config.providers].sort((a, b) => {
        if (a === 'ollama') return -1
        if (b === 'ollama') return 1
        return 0
      })
    }

    // If task is cloud-preferred, prioritize cloud
    if (cloudPreferredTasks.includes(taskType)) {
      return [...this.config.providers].sort((a, b) => {
        if (a === 'ollama') return 1
        if (b === 'ollama') return -1
        return 0
      })
    }

    // Default order from config
    return this.config.providers
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Get provider health with caching.
   */
  async getProviderHealth(
    providerType: RouterProviderType
  ): Promise<ProviderHealthStatus> {
    // Check cache first
    const cached = this.healthCache.get(providerType)
    if (cached && Date.now() - cached.timestamp < this.config.healthCacheDurationMs) {
      return cached.result
    }

    // Perform fresh health check
    const provider = this.providers.get(providerType)
    if (!provider) {
      return {
        isHealthy: false,
        status: 'disconnected',
        lastError: 'Provider not initialized'
      }
    }

    try {
      const result = await provider.getHealth()

      // Cache result
      this.healthCache.set(providerType, {
        result,
        timestamp: Date.now()
      })

      return result
    } catch (error) {
      const result: ProviderHealthStatus = {
        isHealthy: false,
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error)
      }

      this.healthCache.set(providerType, {
        result,
        timestamp: Date.now()
      })

      return result
    }
  }

  /**
   * Check if a provider is available and healthy.
   */
  async isProviderAvailable(providerType: RouterProviderType): Promise<boolean> {
    const health = await this.getProviderHealth(providerType)
    return health.isHealthy
  }

  /**
   * Start periodic health checks.
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      void this.performHealthChecks()
    }, this.config.healthCheckIntervalMs)
  }

  /**
   * Perform health checks on all providers.
   */
  private async performHealthChecks(): Promise<void> {
    const checks = this.config.providers.map(async (providerType) => {
      try {
        await this.getProviderHealth(providerType)
      } catch (error) {
        this.log(`Health check failed for ${providerType}`, error)
      }
    })

    await Promise.allSettled(checks)
  }

  // ============================================================================
  // Cost Tracking
  // ============================================================================

  /**
   * Track cost for a request.
   */
  private trackCost(
    providerType: RouterProviderType,
    totalTokens: number,
    inputTokens: number = 0,
    outputTokens: number = 0
  ): void {
    const tracking = this.costTracking.get(providerType)
    if (!tracking) return

    const pricing = PROVIDER_PRICING[providerType]

    // Calculate cost (per million tokens)
    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    const cost = inputCost + outputCost

    // Update tracking
    tracking.totalRequests++
    tracking.totalTokens += totalTokens
    tracking.estimatedCostUSD += cost
    tracking.lastUpdated = new Date()
  }

  /**
   * Get cost tracking for a provider.
   */
  getCostTracking(providerType: RouterProviderType): ProviderCostTracking | null {
    return this.costTracking.get(providerType) ?? null
  }

  /**
   * Get total cost across all providers.
   */
  getTotalCost(): number {
    let total = 0
    for (const tracking of this.costTracking.values()) {
      total += tracking.estimatedCostUSD
    }
    return total
  }

  /**
   * Reset cost tracking.
   */
  resetCostTracking(): void {
    for (const tracking of this.costTracking.values()) {
      tracking.totalRequests = 0
      tracking.totalTokens = 0
      tracking.estimatedCostUSD = 0
      tracking.lastUpdated = new Date()
    }
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * Get the currently active provider (first healthy one).
   */
  async getActiveProvider(): Promise<RouterProviderType | null> {
    for (const providerType of this.config.providers) {
      const health = await this.getProviderHealth(providerType)
      if (health.isHealthy) {
        return providerType
      }
    }
    return null
  }

  /**
   * Get provider type from provider instance.
   */
  private getProviderType(provider: AIProvider): RouterProviderType {
    for (const [type, p] of this.providers.entries()) {
      if (p === provider) {
        return type
      }
    }
    return 'ollama' // Fallback
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up router resources.
   */
  dispose(): void {
    // Stop health checks
    if (this.healthCheckInterval !== undefined) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }

    // Dispose all providers
    for (const provider of this.providers.values()) {
      provider?.dispose()
    }

    this.providers.clear()
    this.healthCache.clear()
    this.initialized = false

    this.log('Router disposed')
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Ensure router is initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Router not initialized. Call initialize() first.')
    }
  }

  /**
   * Log a message (if debug enabled).
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[AIRouter] ${message}`, data ?? '')
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI Router instance.
 *
 * Usage:
 * ```typescript
 * const router = createAIRouter({
 *   preferLocal: true,
 *   fallbackEnabled: true
 * })
 * await router.initialize()
 * ```
 */
export function createAIRouter(config?: Partial<RouterConfig>): AIRouter {
  return new AIRouter(config)
}
