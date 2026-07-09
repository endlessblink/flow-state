# Visual Personal Assistant Infrastructure Implementation Plan

> **For Hermes/Codex:** Build the durable FlowState side of the assistant. The goal is not another chat summary. The goal is a long-lived visual control surface that FlowState renders, while Hermes supplies structured recommendations and never directly mutates tasks without preview and approval.

**Goal:** Add infrastructure for Hermes to send structured planning/triage proposals into FlowState, where FlowState renders them as compact visual cards and schedule previews with explicit apply controls.

**Architecture:** Hermes remains the reasoning layer. FlowState remains the renderer and source of truth. The Local Task API receives a bearer-protected structured assistant session, stores it ephemerally, notifies the Electron renderer, and FlowState displays a dedicated assistant panel/route. All mutations go through preview/apply paths and are verified by FlowState state.

**Tech Stack:** Vue 3, TypeScript, Pinia, Electron preload/main IPC, FlowState Local Task API sidecar, existing task store, existing task-instance scheduling endpoints, Vitest, Playwright or component tests where practical.

---

## Product principle

The user's problem is overload. Plain text backlog summaries make the overload worse. The FlowState assistant must therefore render a small visual decision surface:

- 3 to 5 category cards, not a backlog dump.
- 1 recommended next block, not a full day plan by default.
- 1 to 3 task cards visible at a time.
- Explicit controls: choose category, accept next block, defer, change priority/date, mark done only when clearly labeled done.
- Preview before any task or calendar mutation.
- Undo/audit hooks when available.

## Core data model

Create a shared schema under `src/types/assistantVisual.ts` and reuse it in the Local API tests. Keep it intentionally small.

```ts
export type AssistantSessionKind = 'day-start' | 'overload-relief' | 'end-of-day' | 'quick-triage'

export type AssistantTaskRecommendation = {
  taskId: string
  title: string
  currentDueDate: string | null
  currentPriority: 'low' | 'medium' | 'high' | null
  recommendedDueDate?: string | null
  recommendedPriority?: 'low' | 'medium' | 'high' | null
  relevance: 'today' | 'not-today' | 'unclear'
  rationale: string
}

export type AssistantCategoryCard = {
  id: string
  label: string
  tone: 'calm' | 'risk' | 'energy' | 'work' | 'life'
  count: number
  recommendation: string
  examples: AssistantTaskRecommendation[]
}

export type AssistantNextBlock = {
  id: string
  title: string
  durationMinutes: number
  taskIds: string[]
  doneEnough: string
  rationale: string
  proposedStartTime?: string
}

export type AssistantVisualSession = {
  id: string
  kind: AssistantSessionKind
  createdAt: string
  expiresAt?: string
  title: string
  summary: string
  categories: AssistantCategoryCard[]
  nextBlock?: AssistantNextBlock
  proposedUpdates: AssistantTaskRecommendation[]
  source: 'hermes' | 'flowstate'
  status: 'draft' | 'previewed' | 'applied' | 'dismissed'
}
```

Validation rule: never accept raw tokens, full conversations, or hidden chain-of-thought in this schema. Store only visible rationale.

## Task 1: Add schema and validation

**Objective:** Define a durable contract that both Hermes and FlowState can rely on.

**Files:**
- Create: `src/types/assistantVisual.ts`
- Create or modify: `server/local-api/assistantVisualSchema.cjs`
- Test: `tests/unit/local-api/assistant-visual-contract.test.ts`

**Steps:**
1. Add the TypeScript types above.
2. Add a small CommonJS validator for the Local API sidecar. Do not pull in a heavy runtime schema library unless already present.
3. Reject sessions with more than 5 categories or more than 3 visible examples per category.
4. Reject unknown mutation fields. This prevents Hermes from smuggling writes through the visual session payload.
5. Add tests for valid payload, too many cards, unknown fields, and secret-like strings in obvious sensitive keys.

**Verification:**

```bash
npm test -- tests/unit/local-api/assistant-visual-contract.test.ts
npm run type-check
```

## Task 2: Add Local API visual session endpoints

**Objective:** Let Hermes create a visual assistant session that FlowState can render.

**Files:**
- Modify: `server/local-api/server.cjs`
- Modify: `server/local-api/README.md`
- Test: `tests/unit/local-api/server-contract.test.ts`
- Test: `tests/unit/local-api/assistant-visual-contract.test.ts`

**Endpoints:**

```text
POST /api/assistant/visual-sessions
GET /api/assistant/visual-sessions/current
POST /api/assistant/visual-sessions/:id/dismiss
```

**Behavior:**
- All endpoints require the existing bearer token.
- `POST` validates and stores one current session in sidecar memory, keyed by user/session context.
- `GET current` returns only the current safe session.
- `dismiss` marks it dismissed and removes it from active display.
- No endpoint mutates FlowState tasks directly.
- If sidecar runs in token mode, notify Electron main via `parentPort.postMessage({ type: 'assistantVisualSession', sessionId })` after a valid `POST`.

**Verification:**

```bash
npm test -- tests/unit/local-api/server-contract.test.ts tests/unit/local-api/assistant-visual-contract.test.ts
node --check server/local-api/server.cjs
```

## Task 3: Bridge sidecar event to renderer

**Objective:** When Hermes posts a session, the running FlowState app should open or highlight the assistant surface without requiring the user to hunt for it.

**Files:**
- Modify: `electron/ipc/localApi.ts`
- Modify: `electron/preload.ts`
- Test: `tests/unit/electron/local-api-lifecycle.test.ts`

**Behavior:**
- Electron main receives `assistantVisualSession` from the sidecar child message handler.
- Main forwards a renderer-safe event, for example `localApi:assistantVisualSession`.
- Preload exposes `onAssistantVisualSession(handler)` and returns an unsubscribe function.
- Do not forward tokens, sessions, auth headers, or full task bodies.

**Verification:**

```bash
npm test -- tests/unit/electron/local-api-lifecycle.test.ts
npm run electron:build-main
```

## Task 4: Add Pinia store for assistant visual sessions

**Objective:** Give the Vue UI a stable state owner for visual assistant sessions.

**Files:**
- Create: `src/stores/assistantVisual.ts`
- Test: `tests/unit/stores/assistant-visual-store.test.ts`

**Behavior:**
- Store current session.
- Load from `GET /api/assistant/visual-sessions/current` using the existing Electron local API token boundary.
- Subscribe to preload event and refresh/open when a new session arrives.
- Track local UI choices separately from server payload, for example selected category, selected task recommendations, and accepted next block.
- Dismiss session via Local API.

**Verification:**

```bash
npm test -- tests/unit/stores/assistant-visual-store.test.ts
npm run type-check
```

## Task 5: Build the visual assistant panel

**Objective:** Render overload-reducing cards instead of text.

**Files:**
- Create: `src/views/AssistantPlanView.vue`
- Create: `src/components/assistant/AssistantSessionPanel.vue`
- Create: `src/components/assistant/AssistantCategoryCard.vue`
- Create: `src/components/assistant/AssistantNextBlockCard.vue`
- Create: `src/components/assistant/AssistantTaskRecommendationCard.vue`
- Modify: `src/router/index.ts`
- Modify: `src/layouts/AppSidebar.vue` or the appropriate nav surface

**Route:**

```text
/assistant-plan
```

**UX requirements:**
- Top-level dashboard: category cards first.
- One next-block card with duration, “done enough”, and visible rationale.
- Only 1 to 3 task recommendation cards visible until the user expands.
- Controls: choose category, accept next block, change due date, change priority, dismiss.
- Done checkbox must be clearly labeled as completion and must not be mixed with planning relevance.
- RTL-safe layout and Hebrew text support.
- Use existing glass morphism design tokens from `docs/claude-md-extension/design-system.md` and the morning dashboard visual language.

**Verification:**

```bash
npm test -- tests/unit/stores/assistant-visual-store.test.ts
npm run type-check
npm run electron:build-main
```

If there is component testing infrastructure, add tests that mount the panel with a sample session and assert:
- category cards render;
- backlog examples are capped;
- next block renders;
- no apply happens until explicit preview/apply.

## Task 6: Add preview/apply flow for due date and priority recommendations

**Objective:** Make visible recommendations actionable without hidden mutation.

**Files:**
- Modify: `src/stores/assistantVisual.ts`
- Modify: `src/components/assistant/AssistantSessionPanel.vue`
- Modify: existing task store functions only if necessary
- Test: `tests/unit/stores/assistant-visual-store.test.ts`

**Behavior:**
- User selects one or more recommendations.
- FlowState shows a preview list:
  - title;
  - ID;
  - due date old to new;
  - priority old to new;
  - unchanged fields explicitly stated.
- Apply uses existing task update path, not raw DB writes.
- Verify by reading back task state from the store/local API after apply.
- Do not change status unless the user clicked a completion control.

**Verification:**

```bash
npm test -- tests/unit/stores/assistant-visual-store.test.ts
npm run type-check
```

## Task 7: Connect next block to task-instance scheduling

**Objective:** Let the visual next block become a real FlowState calendar/focus block after approval.

**Files:**
- Modify: `src/stores/assistantVisual.ts`
- Modify: `src/components/assistant/AssistantNextBlockCard.vue`
- Use existing Local API endpoints:
  - `GET /api/tasks/:id/instances`
  - `POST /api/tasks/:id/instances`

**Behavior:**
- The next block card defaults to preview mode.
- Applying a block requires explicit user click.
- It creates a calendar instance only via the existing task-instance API or existing task store API.
- If no start time is provided, FlowState asks the user to pick a slot visually.

**Verification:**

```bash
npm test -- tests/unit/local-api/server-contract.test.ts
npm test -- src/stores/__tests__/tasks.test.ts
npm run type-check
```

## Task 8: Add a Hermes/Codex smoke script

**Objective:** Prove the long-term integration without relying on chat text.

**Files:**
- Create: `scripts/smoke-assistant-visual-session.cjs`

**Behavior:**
- Reads `/home/endlessblink/.config/flow-state/local-api.json` internally.
- Prints only redacted status: config exists, enabled, port, token present length.
- Posts a small safe sample assistant visual session to Local API.
- Verifies `GET /api/assistant/visual-sessions/current` returns the same session ID.
- Does not mutate tasks.

**Verification:**

```bash
node scripts/smoke-assistant-visual-session.cjs
```

Expected after FlowState is running and signed in:

```text
config: enabled=true port=5577 tokenPresent=true
post visual session: 200
current visual session: 200
session id matches: true
```

## Task 9: Update MASTER_PLAN without breaking parser format

**Objective:** Track the infrastructure as a real FlowState roadmap task.

**Files:**
- Modify: `docs/MASTER_PLAN.md`

**Add:**

```md
### TASK-1932: Visual Hermes personal-assistant planning surface

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-07-08) | **Depends on**: TASK-1928, TASK-1929, TASK-1930, TASK-1931, TASK-1856, TASK-1858, TASK-1859

**Why**: Plain text task summaries increase overload. Hermes needs a durable way to send structured recommendations into FlowState so FlowState renders compact visual decision cards, next-block previews, and explicit apply controls.

**Acceptance**:
- Hermes can create a bearer-protected assistant visual session through the Local Task API without exposing tokens or mutating tasks.
- FlowState renders category cards, a next-block card, and at most 1 to 3 visible task recommendations by default.
- User decisions happen in FlowState UI, not through text-only backlog dumps.
- Due date, priority, completion, and time-block writes require preview and explicit apply.
- Verification includes unit tests, type-check, Electron build, and a live smoke test proving a session appears in the running app.
```

Keep existing parser tables and `### TASK-####` headers intact.

## Final verification checklist

Run:

```bash
npm test -- tests/unit/local-api/server-contract.test.ts tests/unit/local-api/assistant-visual-contract.test.ts tests/unit/electron/local-api-lifecycle.test.ts tests/unit/stores/assistant-visual-store.test.ts
node --check server/local-api/server.cjs
npm run type-check
npm run electron:build-main
node scripts/validate-electron-package.cjs
```

Then live proof:

```bash
node scripts/smoke-assistant-visual-session.cjs
```

And manually confirm in the running FlowState app:

- a visual assistant panel opens or is highlighted;
- it shows cards, not a chat text summary;
- apply buttons show preview first;
- no task status/due date/priority changes happen until explicit approval.

## Non-goals for this slice

- No autonomous rescheduling without approval.
- No MCP requirement.
- No raw database writes.
- No public updater deployment unless explicitly requested.
- No attempt to solve every planning mode at once. Start with overload relief and next-block planning.
