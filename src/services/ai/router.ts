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
 * 2. Groq (proxy) - Fast cloud inference via Supabase Edge Function
 * 3. OpenRouter (proxy) - Access to premium models (Claude, GPT-4) via proxy
 *
 * BUG-1131: All cloud API keys are kept server-side via Supabase Edge Functions.
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 * @see BUG-1131 in MASTER_PLAN.md - Move All Exposed API Keys to Backend Proxy
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
import { recordAIUsage } from './usageTracker'
import { getDefaultModelForProvider as getDefaultModel, getDefaultPricing } from '@/config/aiModels'
// BUG-1131: Proxy providers for secure API key handling (keys stay server-side)
import { createGroqProxyProvider } from './providers/groqProxy'
import { createOpenRouterProxyProvider } from './providers/openrouterProxy'

// ============================================================================
// Task Types - Determine routing strategy
// ============================================================================

/**
 * Task type determines which provider is preferred.
 * Local tasks (chat, parsing) prefer Ollama.
 * Cloud tasks (complex reasoning) prefer Groq/OpenRouter.
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
 * Router-specific provider type.
 * - ollama: Local inference (free, private)
 * - groq: Fast cloud inference via proxy (Llama, Mixtral)
 * - openrouter: Premium models via proxy (Claude, GPT-4, etc.)
 */
export type RouterProviderType = 'ollama' | 'groq' | 'openrouter'

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
 * Priority: Ollama (local) → Groq (fast cloud) → OpenRouter (premium fallback)
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  providers: ['ollama', 'groq', 'openrouter'],
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
 * OpenRouter pricing varies by model - using Claude 3.5 Sonnet as reference.
 */
const PROVIDER_PRICING: Record<RouterProviderType, { input: number; output: number }> = {
  ollama: getDefaultPricing('ollama'),
  groq: getDefaultPricing('groq'),
  openrouter: getDefaultPricing('openrouter'),
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

  /** The provider that actually handled the last request (not just "first healthy") */
  private _lastUsedProvider: RouterProviderType | null = null

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

      case 'groq':
        return await this.createGroqProvider()

      case 'openrouter':
        return await this.createOpenRouterProvider()

      default:
        this.log(`Unknown provider type: ${providerType}`)
        return null
    }
  }

  /**
   * Create Ollama provider instance.
   * Always attempts detection - if Ollama isn't running or CORS blocks it,
   * it fails gracefully and the router falls back to cloud providers.
   *
   * For production web (e.g. in-theflow.com), users need:
   *   OLLAMA_ORIGINS=https://in-theflow.com (or *)
   * to allow cross-origin requests from the browser to local Ollama.
   */
  private async createOllamaProvider(): Promise<OllamaProvider | null> {
    try {
      const isTauri = typeof window !== 'undefined' &&
        ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

      const isProduction = typeof window !== 'undefined' &&
        !isTauri &&
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1')

      if (isProduction) {
        this.log('Production domain detected - attempting Ollama detection (requires OLLAMA_ORIGINS)')
      }

      if (isTauri) {
        this.log('Tauri environment detected - attempting Ollama detection (TASK-1186)')
      }

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
   * Create Groq provider instance.
   * BUG-1131: Uses proxy to keep API key server-side.
   */
  private async createGroqProvider(): Promise<AIProvider | null> {
    try {
      this.log('Creating Groq proxy provider')
      const proxyProvider = createGroqProxyProvider()
      const proxySuccess = await proxyProvider.initialize()

      if (proxySuccess) {
        this.log('Groq proxy provider initialized successfully')
        return proxyProvider
      }

      this.log('Groq proxy initialization failed - Edge Function may not be deployed or API key not configured')
      return null
    } catch (error) {
      this.log('Failed to create Groq proxy provider', error)
      return null
    }
  }

  /**
   * Create OpenRouter provider instance.
   * BUG-1131: Uses proxy to keep API key server-side.
   * OpenRouter provides access to premium models (Claude, GPT-4, etc.)
   */
  private async createOpenRouterProvider(): Promise<AIProvider | null> {
    try {
      this.log('Creating OpenRouter proxy provider')
      const proxyProvider = createOpenRouterProxyProvider()
      const proxySuccess = await proxyProvider.initialize()

      if (proxySuccess) {
        this.log('OpenRouter proxy provider initialized successfully')
        return proxyProvider
      }

      this.log('OpenRouter proxy initialization failed - Edge Function may not be deployed or API key not configured')
      return null
    } catch (error) {
      this.log('Failed to create OpenRouter proxy provider', error)
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
      model: options.model ?? this.getDefaultModelForProvider(this.getProviderType(provider)),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stopSequences: options.stopSequences,
      systemPrompt: options.systemPrompt,
      timeout: options.timeout,
      tools: options.tools,
      toolChoice: options.toolChoice,
    }

    try {
      const response = await provider.generate(messages, generateOptions)

      // Record the actual provider used
      const providerType = this.getProviderType(provider)
      this._lastUsedProvider = providerType

      // Track costs
      this.trackCost(
        providerType,
        response.totalTokens ?? 0,
        response.promptTokens ?? 0,
        response.completionTokens ?? 0
      )

      // TASK-1316: Record usage for the settings dashboard
      recordAIUsage({
        provider: providerType,
        model: generateOptions.model || this.getDefaultModelForProvider(providerType),
        inputTokens: response.promptTokens ?? 0,
        outputTokens: response.completionTokens ?? 0
      })

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

    // Get ordered list of providers to try
    const providerOrder = options.forceProvider
      ? [options.forceProvider]
      : this.getProviderOrder(taskType)

    let lastError: Error | null = null

    // Try each provider in order until one succeeds
    for (const providerType of providerOrder) {
      const provider = this.providers.get(providerType)
      if (!provider) continue

      // Check health before trying
      const health = await this.getProviderHealth(providerType)
      if (!health.isHealthy) {
        this.log(`Skipping unhealthy provider: ${providerType}`)
        continue
      }

      // Merge options with defaults
      const generateOptions: GenerateOptions = {
        model: options.model ?? this.getDefaultModelForProvider(providerType),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stopSequences: options.stopSequences,
        systemPrompt: options.systemPrompt,
        stream: true,
        timeout: options.timeout,
        tools: options.tools,
        toolChoice: options.toolChoice,
      }

      try {
        this.log(`Trying streaming with provider: ${providerType}`)

        // Track that we started a request
        const tracking = this.costTracking.get(providerType)
        if (tracking) {
          tracking.totalRequests++
        }

        // TASK-1316: Track content length for usage estimation
        let streamedContentLength = 0
        for await (const chunk of provider.generateStream(messages, generateOptions)) {
          if (chunk.content) streamedContentLength += chunk.content.length
          yield chunk
        }

        // If we got here, streaming succeeded — record the actual provider used
        this._lastUsedProvider = providerType

        // TASK-1316: Record usage for the settings dashboard
        const inputContentLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
        recordAIUsage({
          provider: providerType,
          model: generateOptions.model || this.getDefaultModelForProvider(providerType),
          inputTokens: Math.ceil(inputContentLength / 4),
          outputTokens: Math.ceil(streamedContentLength / 4)
        })

        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.log(`Streaming failed for ${providerType}: ${lastError.message}`)

        // If fallback is disabled, throw immediately
        if (options.disableFallback) {
          throw lastError
        }

        // Otherwise continue to next provider
        continue
      }
    }

    // All providers failed
    throw lastError ?? new Error('All providers failed')
  }

  /**
   * Get default model for a provider type.
   */
  private getDefaultModelForProvider(providerType: RouterProviderType): string {
    // Use centralized registry for defaults
    if (providerType === 'ollama' || providerType === 'groq' || providerType === 'openrouter') {
      return getDefaultModel(providerType)
    }
    // Fallback for unknown provider types
    return 'llama3.2'
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

        // TASK-1316: Record fallback usage
        recordAIUsage({
          provider: providerType,
          model: options.model || this.getDefaultModelForProvider(providerType),
          inputTokens: response.promptTokens ?? 0,
          outputTokens: response.completionTokens ?? 0
        })

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
   * Get the provider that actually handled the last request.
   * Unlike getActiveProvider() which returns the first healthy provider,
   * this returns the provider that successfully completed the last chat/stream.
   */
  getLastUsedProvider(): RouterProviderType | null {
    return this._lastUsedProvider
  }

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
   * Get cached health status for all providers.
   * Returns the last known health status without triggering new checks.
   */
  getProviderHealthStatus(): Record<string, 'healthy' | 'degraded' | 'unavailable' | 'unknown'> {
    const status: Record<string, 'healthy' | 'degraded' | 'unavailable' | 'unknown'> = {}

    for (const providerType of this.config.providers) {
      const cached = this.healthCache.get(providerType)
      const provider = this.providers.get(providerType)

      if (!provider) {
        status[providerType] = 'unavailable'
      } else if (!cached) {
        // No health check performed yet - unknown until checked
        status[providerType] = 'unknown'
      } else if (cached.result.isHealthy) {
        status[providerType] = 'healthy'
      } else if (cached.result.status === 'error') {
        status[providerType] = 'unavailable'
      } else {
        status[providerType] = 'degraded'
      }
    }

    return status
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
