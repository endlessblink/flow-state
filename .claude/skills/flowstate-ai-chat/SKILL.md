---
name: flowstate-ai-chat
description: >-
  Work on FlowState's AI chat / assistant — the subscription bridge (Claude/Codex CLIs),
  answer quality, prompts, tool-calling, prioritization, or the chat UI. Use when touching
  src/composables/useAIChat.ts, src/services/ai/* (router, bridge, tools, pipeline),
  src/components/ai/*, infra/ai-bridge/*, or when an AI answer is "dry/generic/wrong", the
  brain is slow, or a tool call doesn't execute. For the model-agnostic PRINCIPLES behind
  all of this, read the cross-project `llm-feature-quality` skill — this skill is just the
  FlowState wiring.
---

# FlowState AI Chat / Bridge (project wiring)

> The general principles — feed strong models raw data not pre-digested, holistic prompting,
> structured-output-for-UI, eval-as-judge, CLI-brain integration — live in **`llm-feature-quality`**.
> Read that first. Below is only how those map onto FlowState's code.

The chat runs on a **subscription bridge**: a VPS Node server (`infra/ai-bridge/server.mjs`) wraps the local `claude`/`codex` CLIs (no API billing). It's a router provider (`'bridge'`), auto-selected when `aiUseSubscription` is on, Groq fallback. Claude + Codex equal, switchable per chat.

## Where each principle lives in the code

- **Rich data, not pre-digest** (the #1 rule): `useAIChat.ts` `sendMessageDeterministic`, gated on `isBridgeActive()`. `buildRichTaskData(r, lang)` feeds full task content from the store; weak providers keep `digestToolResults` (`preDigestedReasoning.ts`). **The real culprit was `buildReasoningDirective` (`reasoningDirective.ts`)** — it force-fed per-task FACTS and locked the format; it's now SKIPPED for the bridge (`reasoningDirective = isBridgeActive() ? '' : ...`).
- **Holistic prompt**: the formatter system prompt in `sendMessageDeterministic` (group/dependencies/trend/honest-on-sparse rules).
- **Structured cards**: `cardsInstruction` → model appends a ```` ```cards ```` block referencing tasks by `[N]`. `parseCardGroups` maps index→task, strips the block + leaked markers, sets `message.metadata.cardGroups`; `ChatMessage.vue` renders grouped interactive cards (reason each, done/timer) and suppresses the flat dump.
- **Text tool-calling**: `parseTextToolCalls` (exported from `tools.ts`); the "wired-in" framing is `buildTextToolsBehaviorPrompt`, applied via `isBridgeActive()` in `buildSystemPrompt`. The ReAct loop already executes + renders cards.
- **Eval**: `node tests/manual/ai-prioritization-eval.mjs [--baseline]` (current 4.9 vs old 1.3 / 5).

## FlowState-specific CLI / infra facts

- Claude token from `claude setup-token` → env `CLAUDE_CODE_OAUTH_TOKEN`, stored `/root/.flowstate-ai-bridge.env` on the VPS. Caddy `/ai-bridge` route needs `flush_interval -1` (site `encode gzip` buffers SSE).
- Codex event text at `{"type":"item.completed","item":{"type":"agent_message","text":...}}`; Claude stream-json deltas at `content_block_delta`.
- See memory `project-ai-bridge-subscription-brain` for the full deployment/latency/token history.

## Gotchas (FlowState)

- Architecture guard tests grep composables for `getAIUserContext` — don't mention it even in a comment in a composable.
- `AIChatPanel` is always mounted in `MainLayout`, so every message renders twice in the DOM — scope e2e to `.chat-messages` and `.last()`.
- The reused e2e test user keeps its chat history — click **New Chat** at the start of each test.
- Multi-agent: a concurrent agent can clear the shared dirty tree — commit often; verify a regression against `origin/master` before blaming your own change.

## Verify a change

`npx vue-tsc --noEmit` → `npx vitest run` (2380+) → `npm run test:e2e -- tests/e2e/ai-bridge-chat.spec.ts tests/e2e/ai-usage-comprehensive.spec.ts` → `node tests/manual/ai-prioritization-eval.mjs` for answer quality.
