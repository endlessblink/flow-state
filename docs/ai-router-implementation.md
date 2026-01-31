# AI Router Implementation

**Created**: 2026-01-31
**Location**: `src/services/ai/router.ts`

## Overview

The AI Router provides intelligent routing between multiple AI providers with automatic fallback, health-based selection, and task-type routing.

## Architecture

### Provider Priority
1. **Ollama** (local) - Privacy-focused, free, fast for simple tasks
2. **DeepSeek** (cloud) - Cost-effective, good for moderate tasks
3. **Claude** (Anthropic cloud) - Premium, best for complex reasoning

### Task Types

```typescript
export type TaskType =
  | 'chat'              // General chat - prefers local
  | 'task_parsing'      // Fast parsing - prefers local
  | 'task_breakdown'    // Complex reasoning - prefers cloud
  | 'canvas_analysis'   // Moderate - prefers local
  | 'planning'          // Complex - prefers cloud
  | 'suggestion'        // Simple - prefers local
  | 'general'           // No preference
```

## Key Features

### 1. Smart Routing
- Task-type based provider selection
- Health checks before routing
- Configurable provider priority

### 2. Automatic Fallback
- Falls back to next healthy provider on failure
- Configurable retry logic
- Preserves conversation context

### 3. Health Management
- Periodic health checks (default: 60s interval)
- Health result caching (default: 30s)
- Automatic provider recovery

### 4. Cost Tracking
- Per-provider token usage
- Estimated costs in USD
- Based on actual provider pricing:
  - Ollama: Free
  - DeepSeek: $0.14/$0.28 per 1M tokens (input/output)
  - Claude: $3.00/$15.00 per 1M tokens

### 5. Streaming Support
- Both streaming and non-streaming requests
- Proper async generator handling
- Error handling for streams

## Usage Examples

### Basic Usage

```typescript
import { createAIRouter } from '@/services/ai/router'

// Create and initialize
const router = createAIRouter({
  preferLocal: true,
  fallbackEnabled: true,
  debug: false
})
await router.initialize()

// Simple chat
const response = await router.chat([
  { role: 'user', content: 'Hello, how are you?' }
])
console.log(response.content)
```

### With Task Type Hint

```typescript
// Complex reasoning task (prefers cloud)
const response = await router.chat(messages, {
  taskType: 'task_breakdown'
})

// Simple parsing (prefers local)
const response = await router.chat(messages, {
  taskType: 'task_parsing'
})
```

### Force Specific Provider

```typescript
const response = await router.chat(messages, {
  forceProvider: 'claude'
})
```

### Streaming

```typescript
for await (const chunk of router.chatStream(messages)) {
  process.stdout.write(chunk.content)
  if (chunk.done) {
    console.log('\nDone!')
  }
}
```

### Cost Tracking

```typescript
// Get cost for specific provider
const ollamaCost = router.getCostTracking('ollama')
console.log(`Ollama: $${ollamaCost.estimatedCostUSD}`)

// Get total cost
const totalCost = router.getTotalCost()
console.log(`Total: $${totalCost}`)

// Reset tracking
router.resetCostTracking()
```

### Health Checks

```typescript
// Check specific provider
const isOllamaHealthy = await router.isProviderAvailable('ollama')

// Get detailed health status
const health = await router.getProviderHealth('ollama')
console.log(health)
// {
//   isHealthy: true,
//   status: 'connected',
//   latencyMs: 45,
//   lastConnected: Date(...)
// }

// Get active provider
const activeProvider = await router.getActiveProvider()
console.log(`Using: ${activeProvider}`) // 'ollama' | 'deepseek' | 'claude'
```

## Configuration

### RouterConfig

```typescript
interface RouterConfig {
  providers: RouterProviderType[]        // Priority order
  fallbackEnabled: boolean               // Enable fallback
  preferLocal: boolean                   // Prefer Ollama
  maxRetries: number                     // Max retries
  healthCheckIntervalMs: number          // Health check interval
  healthCacheDurationMs: number          // Cache duration
  debug: boolean                         // Debug logging
}
```

### Default Configuration

```typescript
const DEFAULT_ROUTER_CONFIG = {
  providers: ['ollama', 'deepseek', 'claude'],
  fallbackEnabled: true,
  preferLocal: true,
  maxRetries: 2,
  healthCheckIntervalMs: 60000,    // 1 minute
  healthCacheDurationMs: 30000,    // 30 seconds
  debug: false
}
```

### Environment Variables

```bash
# Ollama
VITE_OLLAMA_HOST=localhost      # Default: localhost
VITE_OLLAMA_PORT=11434          # Default: 11434

# DeepSeek (not yet implemented)
VITE_DEEPSEEK_API_KEY=sk-...

# Claude/Anthropic (not yet implemented)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

## Router Options

```typescript
interface RouterOptions extends Partial<GenerateOptions> {
  taskType?: TaskType              // Override task type
  forceProvider?: RouterProviderType  // Force provider
  disableFallback?: boolean        // Disable fallback

  // From GenerateOptions:
  model?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  systemPrompt?: string
  timeout?: number
}
```

## Provider Implementation Status

| Provider | Status | Notes |
|----------|--------|-------|
| Ollama | ✅ Implemented | Fully functional, auto-detects local instance |
| DeepSeek | ⏳ Stub only | Returns `null`, awaiting implementation |
| Claude | ⏳ Stub only | Returns `null`, awaiting implementation |

## Routing Logic

### Local-Preferred Tasks
When `preferLocal: true` and task type is:
- `chat`
- `task_parsing`
- `canvas_analysis`
- `suggestion`

**Order**: Ollama → DeepSeek → Claude

### Cloud-Preferred Tasks
When task type is:
- `task_breakdown`
- `planning`

**Order**: DeepSeek → Claude → Ollama

### General Tasks
Default provider order from config.

## Error Handling

### No Providers Available
```typescript
try {
  const response = await router.chat(messages)
} catch (error) {
  if (error.message === 'No healthy AI providers available') {
    // Handle no providers
  }
}
```

### Forced Provider Not Available
```typescript
try {
  const response = await router.chat(messages, {
    forceProvider: 'claude'
  })
} catch (error) {
  if (error.message.includes('not available')) {
    // Handle provider unavailable
  }
}
```

### All Providers Failed
```typescript
try {
  const response = await router.chat(messages)
} catch (error) {
  if (error.message === 'All providers failed') {
    // All fallback attempts exhausted
  }
}
```

## Cleanup

```typescript
// Always dispose when done
router.dispose()

// Stops:
// - Health check intervals
// - All provider instances
// - Clears caches
```

## Integration Points

### With Vue Composable

```typescript
// composables/useAI.ts
import { createAIRouter } from '@/services/ai/router'

let router: AIRouter | null = null

export function useAI() {
  if (!router) {
    router = createAIRouter()
    router.initialize()
  }

  return {
    chat: (messages, options) => router!.chat(messages, options),
    chatStream: (messages, options) => router!.chatStream(messages, options),
    getActiveProvider: () => router!.getActiveProvider(),
    getCost: () => router!.getTotalCost()
  }
}
```

### With Pinia Store

```typescript
// stores/ai.ts
import { defineStore } from 'pinia'
import { createAIRouter, type AIRouter } from '@/services/ai/router'

export const useAIStore = defineStore('ai', () => {
  const router = ref<AIRouter | null>(null)

  async function initialize() {
    router.value = createAIRouter({ debug: true })
    await router.value.initialize()
  }

  async function chat(messages, options) {
    if (!router.value) await initialize()
    return router.value!.chat(messages, options)
  }

  return { initialize, chat }
})
```

## Performance Considerations

### Health Check Caching
- Health checks cached for 30s by default
- Reduces unnecessary network requests
- Configurable via `healthCacheDurationMs`

### Parallel Initialization
- Providers initialized in parallel
- Uses `Promise.allSettled()` to continue even if some fail

### Cost Tracking
- Minimal overhead (Map lookups)
- Updated only after successful requests

## Future Enhancements

### Provider Implementations
- [ ] Implement DeepSeekProvider
- [ ] Implement ClaudeProvider (Anthropic)
- [ ] Add OpenAI provider support

### Advanced Routing
- [ ] Load balancing across multiple instances
- [ ] Rate limit awareness and queuing
- [ ] Token count prediction before routing
- [ ] Provider-specific model selection

### Monitoring
- [ ] Metrics dashboard integration
- [ ] Request/response logging
- [ ] Performance tracking per provider
- [ ] Cost alerts and budgets

### Streaming Improvements
- [ ] Fallback support for streams
- [ ] Stream multiplexing (parallel providers)
- [ ] Partial result caching

## Related Files

```
src/services/ai/
├── router.ts                    # Main router implementation
├── types.ts                     # Shared AI types
└── providers/
    ├── ollama.ts               # Ollama provider
    ├── types.ts                # Provider interface
    ├── BaseAIProvider.ts       # Abstract base class
    └── index.ts                # Provider exports
```

## Testing

```typescript
// Example test
import { createAIRouter } from '@/services/ai/router'

describe('AIRouter', () => {
  it('should route to Ollama for chat tasks', async () => {
    const router = createAIRouter({ debug: true })
    await router.initialize()

    const response = await router.chat([
      { role: 'user', content: 'Hello!' }
    ], { taskType: 'chat' })

    expect(response).toBeDefined()
    expect(response.content).toBeTruthy()

    router.dispose()
  })
})
```

## See Also

- `src/types/ai.ts` - AI type definitions (newer system)
- `src/services/ai/types.ts` - Provider type definitions (current system)
- `docs/MASTER_PLAN.md` - ROAD-011 (AI-Powered Features Roadmap)
