# DeepSeek AI Provider

Complete implementation of DeepSeek AI provider for FlowState, supporting both V3.2 and R1 models.

## Overview

The DeepSeek provider implements the `BaseAIProvider` abstract class, providing:

- **OpenAI-compatible API** - Uses DeepSeek's OpenAI-compatible format
- **Full streaming support** - Server-Sent Events (SSE) for real-time responses
- **Automatic retry** - Exponential backoff with jitter
- **Rate limiting** - Token bucket algorithm for request management
- **Error handling** - Structured error types with retry logic
- **Health monitoring** - Connectivity and availability checks
- **Event emission** - Observable request lifecycle events

## Quick Start

### Environment Setup

Add your DeepSeek API key to `.env.local`:

```bash
VITE_DEEPSEEK_API_KEY=your_api_key_here
```

### Basic Usage

```typescript
import { autoDetectDeepSeek } from '@/services/ai/providers/deepseek'

// Auto-detect and initialize from environment
const provider = await autoDetectDeepSeek()

if (provider) {
  const response = await provider.complete([
    { role: 'user', content: 'What is FlowState?' }
  ])

  console.log(response.content)
  console.log('Tokens:', response.usage?.totalTokens)

  provider.dispose()
}
```

## API Reference

### Factory Functions

#### `createDeepSeekProvider(apiKey, config?)`

Create a new DeepSeek provider instance.

```typescript
import { createDeepSeekProvider } from '@/services/ai/providers/deepseek'

const provider = createDeepSeekProvider('your-api-key', {
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2048
})

await provider.initialize({
  provider: AIProvider.OPENAI,
  enabled: true,
  endpoint: 'https://api.deepseek.com/v1',
  apiKey: 'your-api-key',
  model: 'deepseek-chat',
  maxTokens: 2048,
  temperature: 0.7,
  timeout: 60000
})
```

**Parameters:**
- `apiKey` (string) - DeepSeek API key
- `config` (Partial<AIProviderConfig>) - Optional configuration overrides

**Returns:** `DeepSeekProvider` instance

#### `autoDetectDeepSeek(config?)`

Auto-detect and initialize from `VITE_DEEPSEEK_API_KEY` environment variable.

```typescript
const provider = await autoDetectDeepSeek({
  model: 'deepseek-reasoner',
  temperature: 0.5
})

if (!provider) {
  console.error('API key not found')
}
```

**Parameters:**
- `config` (Partial<AIProviderConfig>) - Optional configuration overrides

**Returns:** `Promise<DeepSeekProvider | null>`

### Provider Methods

#### `initialize(config)`

Initialize the provider with configuration.

```typescript
await provider.initialize({
  provider: AIProvider.OPENAI,
  enabled: true,
  endpoint: 'https://api.deepseek.com/v1',
  apiKey: 'your-api-key',
  model: 'deepseek-chat',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000
})
```

#### `complete(messages, options?)`

Generate a non-streaming completion.

```typescript
const response = await provider.complete(
  [
    { role: 'user', content: 'Explain task management briefly.' }
  ],
  {
    temperature: 0.5,
    maxTokens: 500,
    systemPrompt: 'You are a productivity expert.'
  }
)

console.log(response.content)
console.log(response.usage) // Token usage stats
```

**Returns:** `Promise<AIResponse>`

#### `stream(messages, options?)`

Generate a streaming completion.

```typescript
for await (const chunk of provider.stream([
  { role: 'user', content: 'Tell me about Pomodoro timers.' }
])) {
  process.stdout.write(chunk.content)

  if (chunk.done) {
    console.log('\nToken usage:', chunk.usage)
  }
}
```

**Returns:** `AsyncGenerator<AIStreamChunk>`

#### `getModels()`

Fetch available models from DeepSeek API.

```typescript
const models = await provider.getModels()

for (const model of models) {
  console.log(model.id)
  console.log(model.description)
  console.log(model.contextWindow)
}
```

**Returns:** `Promise<AIModelInfo[]>`

#### `healthCheck()`

Perform a health check.

```typescript
const health = await provider.healthCheck()

if (health.healthy) {
  console.log('Latency:', health.latencyMs, 'ms')
  console.log('Models:', health.availableModels)
} else {
  console.error('Error:', health.error)
}
```

**Returns:** `Promise<AIHealthCheckResult>`

#### `abort()`

Abort all in-flight requests.

```typescript
const completionPromise = provider.complete([...])

// Abort after 2 seconds
setTimeout(() => provider.abort(), 2000)

try {
  await completionPromise
} catch (error) {
  console.log('Request aborted')
}
```

#### `dispose()`

Clean up provider resources.

```typescript
provider.dispose()
```

## Supported Models

### deepseek-chat (V3.2)

General purpose chat model with 64K context window.

```typescript
const provider = await autoDetectDeepSeek({
  model: 'deepseek-chat',
  temperature: 0.7
})
```

**Best for:**
- General conversation
- Task analysis
- Text generation
- Q&A

### deepseek-reasoner (R1)

Advanced reasoning model with 64K context window.

```typescript
const provider = await autoDetectDeepSeek({
  model: 'deepseek-reasoner',
  temperature: 0.3
})
```

**Best for:**
- Complex problem solving
- Multi-step reasoning
- Planning and strategy
- Logical analysis

## Configuration

### Default Configuration

```typescript
{
  provider: AIProvider.OPENAI,
  enabled: false,
  endpoint: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000
}
```

### Completion Options

```typescript
interface AICompletionOptions {
  model?: string              // Override default model
  maxTokens?: number          // Maximum tokens to generate
  temperature?: number        // 0-1, lower = more deterministic
  topP?: number               // Top-p sampling
  stopSequences?: string[]    // Stop generation at these sequences
  systemPrompt?: string       // System prompt to prepend
  timeout?: number            // Request timeout in ms
  headers?: Record<string, string>  // Custom headers
  signal?: AbortSignal        // External abort signal
}
```

### Retry Configuration

The provider automatically retries failed requests with exponential backoff:

```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
}
```

### Rate Limiting

Default rate limits:

```typescript
{
  requestsPerMinute: 60,
  tokensPerMinute: 100000,
  maxConcurrent: 5
}
```

## Error Handling

### Error Codes

```typescript
enum AIErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  TIMEOUT = 'TIMEOUT',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  SERVICE_ERROR = 'SERVICE_ERROR',
  UNKNOWN = 'UNKNOWN'
}
```

### Error Handling Example

```typescript
try {
  const response = await provider.complete([...])
} catch (error: any) {
  console.error('Code:', error.code)
  console.error('Message:', error.message)
  console.error('Retryable:', error.retryable)

  if (error.code === 'AUTH_ERROR') {
    console.log('Invalid API key')
  } else if (error.code === 'RATE_LIMIT') {
    console.log('Rate limit hit, retry after:', error.retryAfterMs)
  }
}
```

## Event Monitoring

### Available Events

- `request:start` - Request started
- `request:complete` - Request completed successfully
- `request:error` - Request failed
- `request:retry` - Request is being retried
- `stream:start` - Stream started
- `stream:chunk` - Stream chunk received
- `stream:end` - Stream ended
- `rate_limit:hit` - Rate limit threshold reached
- `health:change` - Health status changed

### Event Listener Example

```typescript
provider.on('request:start', (event) => {
  console.log('Request started:', event.data)
})

provider.on('request:complete', (event) => {
  console.log('Request completed:', event.data)
})

provider.on('stream:chunk', (event) => {
  console.log('Chunk received')
})

provider.on('rate_limit:hit', (event) => {
  console.warn('Rate limit hit:', event.data)
})
```

## Advanced Usage

### Multi-Turn Conversation

```typescript
const messages: AIMessage[] = []

// Turn 1
messages.push({ role: 'user', content: 'What is a Pomodoro timer?' })
const response1 = await provider.complete(messages)
messages.push({ role: 'assistant', content: response1.content })

// Turn 2
messages.push({ role: 'user', content: 'How long is one Pomodoro?' })
const response2 = await provider.complete(messages)
messages.push({ role: 'assistant', content: response2.content })
```

### Streaming with Progress

```typescript
let accumulated = ''

for await (const chunk of provider.stream([...], { maxTokens: 1000 })) {
  accumulated += chunk.content

  // Update UI with accumulated content
  updateUI(accumulated)

  if (chunk.done) {
    console.log('Final tokens:', chunk.usage?.totalTokens)
  }
}
```

### Cancellation with AbortController

```typescript
const controller = new AbortController()

const completionPromise = provider.complete(
  [...],
  { signal: controller.signal }
)

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  await completionPromise
} catch (error) {
  console.log('Cancelled by user')
}
```

### Task Analysis Integration

```typescript
async function analyzeTask(task: Task) {
  const provider = await autoDetectDeepSeek()
  if (!provider) return null

  const response = await provider.complete(
    [
      {
        role: 'user',
        content: `Analyze this task and suggest subtasks:\n\n${JSON.stringify(task)}`
      }
    ],
    {
      systemPrompt: 'You are a task breakdown assistant. Provide actionable subtasks.',
      temperature: 0.5,
      maxTokens: 500
    }
  )

  provider.dispose()
  return response.content
}
```

## Testing

Run the test suite:

```bash
npm run test -- src/services/ai/providers/__tests__/deepseek.test.ts
```

Test coverage includes:
- Initialization
- Non-streaming completions
- Streaming responses
- System prompts
- Error handling
- Model listing
- Health checks
- Request abortion
- Resource cleanup

## Troubleshooting

### "Invalid API key" error

Ensure `VITE_DEEPSEEK_API_KEY` is set in `.env.local`:

```bash
VITE_DEEPSEEK_API_KEY=sk-...
```

### "Rate limit exceeded" error

The provider automatically handles rate limits with retry logic. If you hit persistent rate limits:

1. Reduce request frequency
2. Increase `requestsPerMinute` in rate limit config
3. Use lower token counts

### "Network error"

Check that:
1. You have internet connectivity
2. DeepSeek API is not experiencing downtime
3. No firewall is blocking `api.deepseek.com`

### Stream not working

Ensure you're using `for await` syntax:

```typescript
// ✅ Correct
for await (const chunk of provider.stream([...])) {
  console.log(chunk.content)
}

// ❌ Wrong
const generator = provider.stream([...])
console.log(generator) // Won't work
```

## Performance Tips

1. **Reuse provider instances** - Don't create a new provider for each request
2. **Use streaming for long responses** - Better UX and lower memory usage
3. **Set appropriate timeouts** - Default 60s, increase for long responses
4. **Monitor token usage** - Check `response.usage` to optimize costs
5. **Use system prompts** - More efficient than prepending to each message

## API Documentation

Full DeepSeek API docs: https://api-docs.deepseek.com/

## Related Files

- `src/services/ai/providers/deepseek.ts` - Provider implementation
- `src/services/ai/providers/BaseAIProvider.ts` - Base class
- `src/types/ai.ts` - Type definitions
- `src/services/ai/providers/__tests__/deepseek.test.ts` - Tests
- `src/services/ai/providers/examples/deepseek-usage.example.ts` - Usage examples

## License

MIT
