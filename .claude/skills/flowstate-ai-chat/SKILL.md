---
name: flowstate-ai-chat
description: >-
  Work on FlowState's AI chat / assistant — the subscription bridge (Claude/Codex CLIs),
  answer quality, prompts, tool-calling, prioritization, or the chat UI. Use when touching
  src/composables/useAIChat.ts, src/services/ai/* (router, bridge, tools, pipeline),
  src/components/ai/* , infra/ai-bridge/*, or when an AI answer is "dry/generic/wrong",
  the brain is slow, or a tool call doesn't execute. Encodes the hard-won fixes so they
  aren't re-derived.
---

# FlowState AI Chat / Bridge

The chat runs on a **subscription bridge**: a VPS Node server (`infra/ai-bridge/server.mjs`) wraps the local `claude` / `codex` CLIs (no API billing). It's a router provider (`'bridge'`), auto-selected when `aiUseSubscription` is on, with Groq-free fallback. Claude + Codex are equal, switchable per chat.

## The #1 rule: feed strong brains RICH data — never pre-digest

**The trap that wastes the most time:** the chat pipeline historically pre-computed analysis in code (`preDigestedReasoning.ts` `digestToolResults`, and `reasoningDirective.ts` `buildReasoningDirective` which injects per-task FACTS like "4 days overdue, high priority" + a rigid `formatInstruction`). That reduces the LLM to a **formatter**, so a strong model (Claude) produces the SAME dry output a 3B model would. If answers are "dry/generic and don't relate tasks or trends," this is almost always why.

**The fix (in `useAIChat.ts` `sendMessageDeterministic`, gated on `isBridgeActive()`):**
1. **`buildRichTaskData(r, lang)`** — feed the FULL task content (notes/description, tags, subtask progress, project, estimate, real dates), looked up from the store. Weak providers keep the digest.
2. **SKIP `buildReasoningDirective` entirely** for the bridge (`reasoningDirective = isBridgeActive() ? '' : ...`). This was the real culprit — it dictated the dry format and overrode everything else.
3. **Prompt for HOLISTIC insight**: forbid lateness/priority *as* the reason (metadata the card already shows), infer real stakes from task wording/notes, **GROUP related tasks + flag dependencies + name the cross-task TREND**, and be honest ("not clear why this matters") on sparse data. Work patterns/capacity are auto-injected by the context-aware router — tell the model to use them.

Verdict: same model, ~6s, but the eval jumps **1.3/5 → 4.9/5**. The CLI brain is only smart when it gets raw data and reasons itself.

## Measure, don't assert

Before claiming a prompt/data change improved quality, RUN the eval:
`node tests/manual/ai-prioritization-eval.mjs [--baseline]` — LLM-as-judge rubric (relevance, actionability, non-genericness, holistic, honesty); `--baseline` reproduces the old metadata-only format for a true gap. Add a case when you find a weak answer.

## CLI invocation contracts (the bridge runs these)

- **Claude (fast+stream):** `claude -p <prompt> --output-format stream-json --verbose --include-partial-messages --strict-mcp-config --mcp-config '{"mcpServers":{}}'` (+ `--append-system-prompt`). MCP boot is the cost (38s→~4s). `--mcp-config '{}'` is INVALID — needs `{"mcpServers":{}}`. Token from `claude setup-token` → env `CLAUDE_CODE_OAUTH_TOKEN` (stored `/root/.flowstate-ai-bridge.env`).
- **Codex:** `codex exec --skip-git-repo-check --ignore-user-config --json <prompt>` with **stdin CLOSED** (the 120s hang was stdin). Assistant text whole at `{"type":"item.completed","item":{"type":"agent_message","text":...}}`.
- Bridge: `spawn` (stdio ignore stdin) + line-buffered JSONL → SSE. Caddy `/ai-bridge` needs `flush_interval -1` (site `encode gzip` buffers SSE).

## Tool-calling for CLI brains (no native function-calling)

CLI brains can't do OpenAI function-calling. They emit **text** tool-calls (`tool_name({...})`) parsed by `parseTextToolCalls` (exported from `tools.ts`). The ReAct loop already executes + renders cards from these. The framing that makes Claude actually emit them (not narrate "the tools are MCP tools…"): `buildTextToolsBehaviorPrompt` — "you ARE wired into the app, your calls ARE executed, you HAVE access, never claim otherwise." Applied via `isBridgeActive()` in `buildSystemPrompt`.

## Structured output for rich UI (inline cards)

Pattern for grouped cards / any rich render: stream the prose, then have the model append a fenced ```` ```cards ```` JSON block referencing tasks by **[N] index** (robust vs title-matching, esp. Hebrew). Parse it (`parseCardGroups`), map index→task, strip the block + leaked `[N]` markers, attach to `message.metadata`, render in `ChatMessage`. Don't force JSON-mode on the reasoning pass — reason free, emit structured after.

## Gotchas

- Architecture guard tests grep composables for `getAIUserContext` — don't even mention it in a comment in a composable.
- The `AIChatPanel` is always mounted in `MainLayout`, so every message renders twice in the DOM (panel + view) — scope e2e to `.chat-messages` and use `.last()`.
- Tests share the reused e2e user's persisted chat history — click **New Chat** at the start of each test.
- Multi-agent: the shared dirty tree can be cleared by a concurrent agent — commit often; verify a regression against `origin/master` before blaming your own change.

## Verify a change

`npx vue-tsc --noEmit` → `npx vitest run` (2380+) → `npm run test:e2e -- tests/e2e/ai-bridge-chat.spec.ts tests/e2e/ai-usage-comprehensive.spec.ts` → `node tests/manual/ai-prioritization-eval.mjs` for answer quality.
