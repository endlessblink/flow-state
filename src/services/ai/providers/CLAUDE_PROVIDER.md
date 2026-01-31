# Claude/Anthropic AI Provider

Complete implementation of the Claude AI provider for FlowState.

## Files Created

| File | Purpose |
|------|---------|
| `src/services/ai/providers/claude.ts` | Main Claude provider implementation |
| `src/services/ai/providers/__tests__/claude.test.ts` | Unit tests (8 tests, all passing) |
| `src/services/ai/providers/claude.example.ts` | Usage examples and patterns |
| `src/services/ai/providers/CLAUDE_PROVIDER.md` | This documentation |

## Implementation Details

### Architecture

The `ClaudeProvider` extends `BaseAIProvider` to inherit:
- ✅ Retry logic with exponential backoff
- ✅ Rate limiting with token bucket algorithm
- ✅ Request context and metrics tracking
- ✅ Event emission for monitoring
- ✅ Error handling with structured error types

### Features

| Feature | Status | Details |
|---------|--------|---------|
| **Non-streaming completions** | ✅ Implemented | Via `/v1/messages` endpoint |
| **Streaming responses** | ✅ Implemented | Server-Sent Events (SSE) parsing |
| **Model listing** | ✅ Implemented | Hardcoded list (no API endpoint) |
| **Health checks** | ✅ Implemented | Minimal API request with 5s timeout |
| **Error normalization** | ✅ Implemented | Maps Anthropic errors to AIErrorCode |
| **Request cancellation** | ✅ Implemented | Via AbortController |
| **System prompts** | ✅ Supported | Separate system parameter |
| **Multi-turn conversations** | ✅ Supported | Message array with roles |

### API Key Configuration

The provider reads the API key from:
1. Environment variable: `VITE_ANTHROPIC_API_KEY` (primary)
2. Provider config: `config.apiKey` (fallback)

**Setup:**
```bash
# .env or .env.local
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### Supported Models

| Model ID | Name | Context | Max Output | Streaming |
|----------|------|---------|------------|-----------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | 200k | 8192 | ✅ |
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | 200k | 8192 | ✅ |
| `claude-3-opus-20240229` | Claude 3 Opus | 200k | 4096 | ✅ |
| `claude-3-haiku-20240307` | Claude 3 Haiku | 200k | 4096 | ✅ |

### Streaming Implementation

The provider implements Anthropic's Server-Sent Events (SSE) format:

```
event: message_start
data: {"type":"message_start",...}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

**Parsed events:**
- `content_block_delta` → Yields text chunks
- `message_delta` → Captures usage stats
- `message_stop` → Emits final chunk with `done: true`
- `error` → Throws AIProviderError
- `ping` → Ignored (keep-alive)

### Error Handling

Anthropic API errors are mapped to `AIErrorCode`:

| Anthropic Error | AIErrorCode | Retryable |
|-----------------|-------------|-----------|
| `authentication_error` | `AUTH_ERROR` | ❌ |
| `permission_error` | `AUTH_ERROR` | ❌ |
| `rate_limit_error` | `RATE_LIMIT` | ✅ |
| `invalid_request_error` | `INVALID_REQUEST` | ❌ |
| HTTP 500-503 | `SERVICE_ERROR` | ✅ |
| HTTP 408, 504 | `TIMEOUT` | ✅ |

### Usage Examples

#### Basic Completion

```typescript
import { createClaudeProvider } from '@/services/ai/providers'

const claude = createClaudeProvider()
await claude.initialize({
  provider: AIProvider.ANTHROPIC,
  enabled: true,
  endpoint: 'https://api.anthropic.com',
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000
})

const response = await claude.complete([
  { role: 'user', content: 'Hello!' }
])

console.log(response.content)
```

#### Streaming

```typescript
for await (const chunk of claude.stream([
  { role: 'user', content: 'Write a poem.' }
])) {
  process.stdout.write(chunk.content)

  if (chunk.done) {
    console.log('\nTokens used:', chunk.usage?.totalTokens)
  }
}
```

#### With System Prompt

```typescript
const response = await claude.complete([
  { role: 'user', content: 'Suggest a task name.' }
], {
  systemPrompt: 'You are a productivity assistant.'
})
```

## Testing

### Run Tests

```bash
npm run test -- src/services/ai/providers/__tests__/claude.test.ts
```

### Test Coverage

- ✅ Provider initialization
- ✅ Factory function
- ✅ Model listing
- ✅ Health checks (with/without API key)
- ✅ Resource disposal

### Integration Test (Manual)

To test with a real API key:

```typescript
// Set VITE_ANTHROPIC_API_KEY in .env.local
import { simpleCompletion } from './claude.example'

await simpleCompletion()
// Should print: "Response: Paris"
```

## Default Configuration

```typescript
{
  provider: AIProvider.ANTHROPIC,
  enabled: false,  // Must be enabled manually
  endpoint: 'https://api.anthropic.com',
  model: 'claude-3-sonnet-20240229',  // DEFAULT_PROVIDER_CONFIGS
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000  // 60 seconds
}
```

**Note:** Default model in `types/ai.ts` is Claude 3 Sonnet. For Claude Sonnet 4, override:

```typescript
await claude.initialize({
  ...DEFAULT_PROVIDER_CONFIGS[AIProvider.ANTHROPIC],
  model: 'claude-sonnet-4-20250514',
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY
})
```

## API Reference

### ClaudeProvider

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize()` | `(config: AIProviderConfig) => Promise<void>` | Initialize provider |
| `complete()` | `(messages: AIMessage[], options?: AICompletionOptions) => Promise<AIResponse>` | Non-streaming completion |
| `stream()` | `(messages: AIMessage[], options?: AICompletionOptions) => AsyncGenerator<AIStreamChunk>` | Streaming completion |
| `getModels()` | `() => Promise<AIModelInfo[]>` | List available models |
| `healthCheck()` | `() => Promise<AIHealthCheckResult>` | Check API connectivity |
| `abort()` | `() => void` | Abort all in-flight requests |
| `dispose()` | `() => void` | Clean up resources |

### Factory Function

```typescript
function createClaudeProvider(
  config?: Partial<AIProviderConfig>
): ClaudeProvider
```

Creates a new Claude provider instance. Config is optional; must call `initialize()` separately.

## Metrics and Events

The provider emits events for monitoring:

| Event | When | Data |
|-------|------|------|
| `request:start` | Request begins | `{ requestId, attempt }` |
| `request:complete` | Request succeeds | `{ requestId }` |
| `request:error` | Request fails | `{ requestId, error, attempt }` |
| `request:retry` | Retry triggered | `{ requestId, attempt, delay }` |
| `stream:start` | Stream begins | `{ requestId }` |
| `stream:chunk` | Chunk received | `{ requestId, chunk }` |
| `stream:end` | Stream ends | `{ requestId, usage }` |
| `rate_limit:hit` | Rate limit reached | `{ requestCount, concurrentRequests }` |
| `health:change` | Health status changes | `{ healthy, error? }` |

**Subscribe to events:**

```typescript
claude.on('request:complete', (event) => {
  console.log('Request completed:', event.data)
})
```

## Production Readiness

| Aspect | Status | Notes |
|--------|--------|-------|
| **Type safety** | ✅ | Full TypeScript coverage |
| **Error handling** | ✅ | Normalized errors, retries |
| **Rate limiting** | ✅ | Inherited from BaseAIProvider |
| **Request cancellation** | ✅ | AbortController support |
| **Streaming** | ✅ | SSE parsing with error recovery |
| **Unit tests** | ✅ | 8 tests, all passing |
| **Integration tests** | ⚠️ | Manual testing only (requires API key) |
| **Documentation** | ✅ | Examples, API reference, this doc |

## Known Limitations

1. **No embeddings API** - Anthropic doesn't expose embeddings endpoint
2. **Hardcoded model list** - No `/models` endpoint (static list in code)
3. **System prompts** - Only single system message (Anthropic API limitation)
4. **Token counting** - No tokenizer endpoint (client-side estimation needed)

## Future Enhancements

- [ ] Add client-side token counting (tiktoken-like)
- [ ] Support for function calling (when Anthropic releases)
- [ ] Prompt caching (Anthropic feature)
- [ ] Vision support (image input)
- [ ] Extended context (when Anthropic expands limits)

## Troubleshooting

### "API key not configured"

**Cause:** `VITE_ANTHROPIC_API_KEY` not set in environment.

**Fix:**
```bash
# .env.local
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

Restart dev server: `npm run dev`

### "Invalid API key" (401/403)

**Cause:** API key is invalid or expired.

**Fix:** Check Anthropic Console for valid key.

### Rate limit errors (429)

**Cause:** Exceeded Anthropic API rate limits.

**Fix:** Provider automatically retries with exponential backoff. Check rate limit config:

```typescript
const claude = new ClaudeProvider({
  rateLimitConfig: {
    requestsPerMinute: 60,  // Adjust based on your tier
    maxConcurrent: 5
  }
})
```

### Streaming timeout

**Cause:** Long responses exceed timeout.

**Fix:** Increase timeout:

```typescript
await claude.complete(messages, {
  timeout: 120000  // 2 minutes
})
```

## Related Files

- `src/services/ai/providers/BaseAIProvider.ts` - Abstract base class
- `src/services/ai/providers/types.ts` - Provider interface types
- `src/types/ai.ts` - AI system types
- `docs/MASTER_PLAN.md` - ROAD-011: AI-Powered Features Roadmap

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-31 | Initial implementation |

---

**Status:** ✅ Production-ready
**Last Updated:** 2026-01-31
**Maintainer:** FlowState AI Team
