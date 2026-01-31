/**
 * Tests for Claude/Anthropic AI Provider
 *
 * @see ROAD-011 in MASTER_PLAN.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeProvider, createClaudeProvider } from '../claude'
import { AIProvider, type AIProviderConfig } from '@/types/ai'

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider

  beforeEach(() => {
    provider = new ClaudeProvider()
  })

  describe('initialization', () => {
    it('should create provider with correct type', () => {
      expect(provider.provider).toBe(AIProvider.ANTHROPIC)
    })

    it('should initialize with config', async () => {
      const config: AIProviderConfig = {
        provider: AIProvider.ANTHROPIC,
        enabled: true,
        endpoint: 'https://api.anthropic.com',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000
      }

      await provider.initialize(config)

      expect(provider.isInitialized).toBe(true)
      expect(provider.config.model).toBe('claude-sonnet-4-20250514')
    })
  })

  describe('factory function', () => {
    it('should create provider with createClaudeProvider', () => {
      const claudeProvider = createClaudeProvider()
      expect(claudeProvider).toBeInstanceOf(ClaudeProvider)
      expect(claudeProvider.provider).toBe(AIProvider.ANTHROPIC)
    })

    it('should accept partial config', () => {
      const claudeProvider = createClaudeProvider({
        model: 'claude-3-opus-20240229',
        temperature: 0.5
      })
      expect(claudeProvider).toBeInstanceOf(ClaudeProvider)
    })
  })

  describe('fetchModels', () => {
    it('should return list of Claude models', async () => {
      const config: AIProviderConfig = {
        provider: AIProvider.ANTHROPIC,
        enabled: true,
        endpoint: 'https://api.anthropic.com',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000
      }

      await provider.initialize(config)
      const models = await provider.getModels()

      expect(models.length).toBeGreaterThan(0)
      expect(models[0].provider).toBe(AIProvider.ANTHROPIC)
      expect(models.some(m => m.id === 'claude-sonnet-4-20250514')).toBe(true)
    })

    it('should include model capabilities', async () => {
      const config: AIProviderConfig = {
        provider: AIProvider.ANTHROPIC,
        enabled: true,
        endpoint: 'https://api.anthropic.com',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000
      }

      await provider.initialize(config)
      const models = await provider.getModels()
      const sonnet4 = models.find(m => m.id === 'claude-sonnet-4-20250514')

      expect(sonnet4).toBeDefined()
      expect(sonnet4?.supportsStreaming).toBe(true)
      expect(sonnet4?.capabilities).toContain('chat')
    })
  })

  describe('healthCheck', () => {
    it('should fail health check without API key', async () => {
      const config: AIProviderConfig = {
        provider: AIProvider.ANTHROPIC,
        enabled: true,
        endpoint: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000
      }

      await provider.initialize(config)
      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.error).toBeDefined()
    })
  })

  describe('dispose', () => {
    it('should clean up resources on dispose', async () => {
      const config: AIProviderConfig = {
        provider: AIProvider.ANTHROPIC,
        enabled: true,
        endpoint: 'https://api.anthropic.com',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 60000
      }

      await provider.initialize(config)
      expect(provider.isInitialized).toBe(true)

      provider.dispose()

      expect(provider.isInitialized).toBe(false)
    })
  })
})
