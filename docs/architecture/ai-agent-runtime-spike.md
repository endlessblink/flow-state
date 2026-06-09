# AI Agent Runtime Spike

Date: 2026-06-09

## Problem

The current chat implementation can loop because the runtime contract is split across unrelated surfaces:

- generation decides whether to ask
- Vue message rendering reads persisted metadata
- local/server memory writes happen separately
- continuation messages route back through the broad chat pipeline
- stale browser/local/server state can disagree

The product need is not "better weekly planning prose." It is a general runtime contract for every chat request:

`request -> context -> ASK | INFER | PROCEED -> learn -> answer -> no repeat`

## Contract Under Test

Added a framework-neutral runtime contract in:

- `src/services/ai/runtime/chatDecisionRuntime.ts`
- `tests/unit/chat-decision-runtime.test.ts`

It proves:

- high-value durable questions can be asked
- action-only or low-value questions proceed instead of interrupting
- same-session answered questions are blocked immediately
- persisted answered/dismissed questions are blocked
- high-confidence defaults infer instead of asking

Verification:

```bash
npm run test:unit -- tests/unit/chat-decision-runtime.test.ts
npm run type-check
```

Both passed on 2026-06-09.

## Framework Package Findings

Checked current package metadata with `npm view`:

| Candidate | Current Package | Node Requirement | Immediate Fit |
| --- | --- | --- | --- |
| Mastra | `@mastra/core@1.41.0` | `>=22.13.0` | Strong features, but requires Node/Electron build runtime upgrade planning |
| LangGraph JS | `@langchain/langgraph@1.3.7` | `>=18` | Strong state graph fit, compatible with current Node |
| Vercel AI SDK | `ai@6.0.198` | `>=18` | Strong model/tool/streaming layer, less complete as the core app runtime |

Mastra package exports confirm relevant surfaces exist:

- `./workflows`
- `./agent/durable`
- `./memory`
- `./storage`
- `./observability`
- `./evals`
- `./test-utils/llm-mock`

But the Node 22.13+ engine requirement means it is not a no-cost migration for the current FlowState runtime.

Node 22 validation status:

- `.nvmrc` now points to Node 22.
- `package.json` now requires `node >=22.13.0`.
- GitHub CI/deploy/release/android workflows now use Node 22.
- Electron local API bundling now targets Node 22.
- Local validation can use `npx -p node@22 -c "<command>"` until the developer shell is upgraded.

## Decision Matrix

| Requirement | Mastra | LangGraph JS | Vercel AI SDK |
| --- | --- | --- | --- |
| Explicit state machine | Strong | Strongest/lowest-level | Partial |
| HITL suspend/resume | Strong | Strong | Partial/depends on workflow layer |
| Durable workflow state | Strong, but runtime upgrade needed | Strong via checkpointers | Partial unless paired with workflow infrastructure |
| Supabase/Postgres fit | Likely good via custom storage | Good via custom/Postgres checkpointer | Custom app responsibility |
| Local Electron fit | Blocked until Node 22 plan | Compatible | Compatible |
| UI streaming | Good | App-owned | Strong |
| Evals/tracing | Strong built-in surfaces | Strong with LangSmith/custom | Good SDK-level, app-owned policy |
| Migration complexity | Medium-high because runtime upgrade | Medium | Low-medium but does not solve whole orchestration problem |

## Recommendation

Mastra is the selected spike path.

Reason:

- It is TypeScript-first.
- It has first-class workflow steps for a runtime contract instead of scattering state between generation, rendering, and persistence.
- It supports human-in-the-loop suspend/resume, which maps directly to clarification cards.
- It has snapshot/state concepts for durable resume instead of relying on historical chat message metadata as active state.
- It keeps memory, observability, and eval hooks close to the orchestration runtime.

LangGraph JS remains the fallback if the Node 22/Electron validation fails or if Mastra’s APIs leave too much of the no-repeat/HITL contract in app code.

Vercel AI SDK remains a possible streaming/model layer, not the primary durable orchestration runtime for this app.

## One-Week Spike Gate

Each candidate must pass the same minimal flow:

1. User asks broad task-planning request.
2. Runtime loads context.
3. Runtime evaluates candidate questions and logs all decisions.
4. Runtime asks only one high-value durable question, or infers/proceeds.
5. User answers.
6. Answer persists to session and memory.
7. Runtime resumes to compact answer.
8. Reload.
9. Same question is not asked again.

Reject a candidate if:

- UI still has to render raw old message metadata as active state.
- no-repeat suppression lives outside the runtime.
- memory write failure can cause immediate re-ask.
- headed browser proof cannot show answer -> compact result -> reload -> no repeat.

## Next Implementation Step

Mastra has been installed and wrapped around the framework-neutral runtime contract in:

- `src/services/ai/runtime/mastraChatDecisionWorkflow.ts`
- `src/services/ai/runtime/mastraClarificationRuntime.ts`
- `server/local-api/ai-runtime.cjs`
- `server/local-api/server.cjs`
- `tests/unit/mastra-chat-decision-runtime.test.ts`
- `tests/unit/local-api/ai-runtime.test.ts`

Current validation gates:

```bash
npx -p node@22 -c "node --version && npm run test:unit -- tests/unit/mastra-chat-decision-runtime.test.ts tests/unit/chat-decision-runtime.test.ts"
npx -p node@22 -c "node --version && npm run type-check"
npx -p node@22 -c "node --version && npm run build"
npx -p node@22 -c "node --version && npm run electron:build-main"
```

Validation on 2026-06-09:

- Node 22 targeted Mastra/runtime tests: passed (`6 passed`, `1 skipped`).
- Node 22 type-check: passed.
- Node 22 production web build: passed.
- Node 22 Electron main build: passed.
- Current local Node 20 targeted runtime tests: passed with Mastra workflow execution intentionally skipped.
- Storage seam found and fixed in the test contract: bare workflows cannot resume suspended runs because no snapshot is available.
- In-memory storage proves same-process API behavior only.
- Local LibSQL storage now proves start -> suspend -> fresh runtime instance -> resume from the same DB file.
- The Electron local API sidecar now exposes authenticated clarification start/resume endpoints:
  - `POST /api/ai/clarifications/start`
  - `POST /api/ai/clarifications/:runId/resume`
- Electron passes `FLOW_STATE_API_DATA_DIR=app.getPath('userData')` to the sidecar so local workflow snapshots live in stable app data.
- Bundled sidecar smoke: Node 22 `dist-electron/local-api-server.cjs` started on loopback and `/api/health` returned `{"ok":true}`.

After these pass, the next product step is to move clarification state into a Mastra workflow run:

1. Load task/chat context.
2. Score candidate questions.
3. `ASK` by suspending with a typed clarification payload.
4. Resume from the user answer.
5. Persist learned state and question history.
6. Produce a compact answer.
7. Reload and prove the same question is not asked again.

Do not treat the migration as successful until a headed browser/Electron flow proves:

- broad Hebrew prompt works
- one useful question appears only when it has durable planning value
- answering visibly advances the plan
- reload/restart does not re-open the same question
- logs show every asked/skipped/suppressed question decision
