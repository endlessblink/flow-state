# SOP-046: Weekly Plan AI Pipeline

**Last Updated**: February 21, 2026

## Purpose

Document the Weekly Plan AI pipeline: a 2-call hybrid system that intelligently distributes a user's tasks across a work week using an LLM, with deterministic enrichment and safety mechanisms.

## Overview

Weekly Plan AI takes eligible tasks and generates a week-long schedule optimized for the user's capacity, preferences, and work patterns. It combines:

1. **Deterministic enrichment** (instant, no LLM) — computes urgency, complexity, language
2. **LLM distribution call** — requests task-to-day mapping with reasoning
3. **Deterministic rebalancer** (instant) — ensures even distribution if LLM overstacks days
4. **Deterministic reason assembly** (instant) — merges LLM insights with factual context
5. **Optional LLM week theme** (silent fail) — generates a motivating 5-10 word week summary

**Key files:**
- `src/composables/useWeeklyPlanAI.ts` — Pipeline orchestration, prompts, parsing
- `src/composables/useWeeklyPlan.ts` — State management, eligible tasks, behavioral context
- `src/views/WeeklyPlanView.vue` — User interface and interview flow
- `src/config/aiModels.ts` — Model registry and provider configuration
- `src/composables/useWorkProfile.ts` — Work profile loading and preference persistence

---

## Pipeline Architecture

### Step 0: Deterministic Enrichment (Instant, No LLM)

**Function**: `enrichTasksForPlanning(tasks: TaskSummary[], weekEnd: Date)`

Computes per-task metadata that informs the LLM's distribution decision:

| Field | Computation | Purpose |
|-------|-----------|---------|
| `overdueDays` | Days between task due date and today | Identifies urgency |
| `urgencyCategory` | OVERDUE \| IN_PROGRESS \| DUE_THIS_WEEK \| normal | Categorizes priority |
| `language` | Detects Hebrew ([\u0590-\u05FF]) vs English | Generates reasons in task's language |
| `complexityScore` | 0-10: subtasks (up to 5 pts), duration (up to 3 pts), description length (1 pt) | Helps schedule complex work on peak days |
| `deterministicReasons` | 2-3 factual bullets (overdue days, status, subtask progress, priority, due date, duration, project) | Human-readable context |

**Example output:**
```json
{
  "id": "task-123",
  "title": "Ship auth overhaul",
  "language": "en",
  "overdueDays": 2,
  "urgencyCategory": "OVERDUE",
  "complexityScore": 7,
  "deterministicReasons": [
    "2 days overdue",
    "5/12 subtasks completed",
    "High priority"
  ]
}
```

### Step 1: LLM Distribution Call (~2400 tokens)

**Function**: `router.chat(messages, routerOptions)`

Requests the LLM to distribute enriched tasks across Monday–Sunday + unscheduled.

#### System Prompt (`buildDistributionSystemPrompt()`)

Instructs the LLM with:
- Distribution targets (e.g., 4 tasks/day, max 6 per day)
- Critical rules (spread overdue early, respect due dates, group projects, keep weekends as overflow)
- User preferences from interview (if provided):
  - Top priority (earliest scheduling)
  - Days off (zero tasks)
  - Heavy meeting days (max 2 tasks)
  - Max tasks per day (hard limit)
  - Work style (frontload/balanced/backload)
- Work profile insights (if available, gated on `aiLearningEnabled`):
  - Historical capacity (avg tasks completed per day)
  - Peak productivity days (schedule complex work here)
  - Past plan accuracy (if <60%, schedule conservatively)

#### User Prompt (`buildDistributionUserPrompt()`)

Contains:
- Week dates and task count breakdown (overdue, in-progress, due this week)
- Compact task list: id, title, project, priority, due date, urgency category, complexity score, estimated minutes
- Behavioral context (if available):
  - Active projects (recently completed or in-progress)
  - Peak productivity days
  - Historical capacity
  - Active project names

#### Expected Response

JSON with:
```json
{
  "monday": ["task-1", "task-2", "task-3"],
  "tuesday": ["task-4"],
  "wednesday": [],
  "thursday": ["task-5", "task-6"],
  "friday": ["task-7"],
  "saturday": [],
  "sunday": [],
  "unscheduled": ["task-8", "task-9"],
  "reasoning": "2-3 sentences explaining distribution logic",
  "taskReasons": {
    "task-1": "Overdue, prioritize early in week",
    "task-5": "Peak day for complex work"
  }
}
```

#### Failure Handling

- **First attempt**: temperature 0.3 (deterministic)
- **Retry (if first fails)**: temperature 0.1 (ultra-deterministic)
- **Fallback (if both fail)**: `generateFallbackPlan()` — round-robin by priority across Mon–Fri with max 8/day

### Step 1.5: Deterministic Rebalancer (Instant)

**Function**: `rebalancePlan(plan: WeeklyPlan, enrichedTasks: EnrichedTask[], interview?: InterviewAnswers)`

Safety mechanism that redistributes tasks if any day exceeds 120% of the target per-day load.

**Logic:**
1. Calculate available days (exclude days off from interview)
2. Calculate target per day: `ceil(totalScheduled / availableDays.length)`
3. Check if rebalancing needed: any day > `ceil(targetPerDay * 1.2)` OR empty days while others have > target
4. If yes:
   - Collect all scheduled tasks sorted by urgency (OVERDUE → IN_PROGRESS → DUE_THIS_WEEK → normal) then by priority
   - Round-robin assign across available days, respecting `maxPerDay` (default 6, or from interview)
   - Overflow goes to `unscheduled`

**Trigger**: Logs `[WeeklyPlanAI] Rebalancer triggered` with distribution stats.

### Step 2: Deterministic Reason Assembly (Instant)

**Function**: `assembleTaskReasons(enrichedTasks: EnrichedTask[], plan: WeeklyPlan, llmTaskReasons?: Record<string, string>)`

Constructs per-task explanation by merging:
1. **Prepended**: LLM "why this day" reason (if provided in `taskReasons`)
2. **Deterministic facts**: Task's `deterministicReasons` (from Step 0)
3. **Batching note** (optional): If 2+ tasks from same project on same day: "Grouped with X project-name tasks"
4. **Cap at 3 bullets**, joined with newlines

**Example:**
```
Why this day: Peak day for complex work
2 days overdue
5/12 subtasks completed
```

### Step 3: LLM Week Theme (Optional, ~170 tokens, Silent Fail)

**Function**: `generateWeekTheme(router: AIRouter, tasks: EnrichedTask[], routerOptions)`

Generates a motivational 5-10 word week summary (e.g., "Ship, Learn, Ship, Rest").

**Request:**
- System: "Return a 5-10 word motivating week theme in [Hebrew/English]. Just the theme text, nothing else."
- User: Task titles (first 15) + active projects

**Temperature**: 0.7 (creative)
**Timeout**: 10 seconds
**Max tokens**: 50

**Failure**: Returns `null` silently — theme is cosmetic and optional.

---

## Model Configuration

### Single Source of Truth: `src/config/aiModels.ts`

**Key sections:**

```typescript
// Smart defaults for Weekly Plan AI (cost-optimized)
export const WEEKLY_PLAN_DEFAULTS = {
  groq: 'llama-3.3-70b-versatile',               // Best quality on Groq
  openrouter: 'deepseek/deepseek-r1-0528:free',  // Best free reasoning (O1-comparable)
} as const

export function getModelsForProvider(provider: AIProviderKey): ModelEntry[] {
  switch (provider) {
    case 'groq': return GROQ_MODELS
    case 'openrouter': return OPENROUTER_MODELS
    case 'ollama': return OLLAMA_MODELS
    case 'auto': return GROQ_MODELS
    default: return []
  }
}
```

### Provider + Model Selector

**In WeeklyPlanView.vue:**
- Idle, interview, and review states all display provider + model dropdowns
- Selection stored in `settingsStore`:
  - `weeklyPlanProvider`: 'auto' | 'groq' | 'ollama' | 'openrouter'
  - `weeklyPlanModel`: Model ID string

**Auto-selection logic:**
```typescript
watch(selectedProvider, (newProvider) => {
  const defaultId = WEEKLY_PLAN_DEFAULTS[newProvider]
  if (defaultId && getModelsForProvider(newProvider).find(m => m.id === defaultId)) {
    settingsStore.weeklyPlanModel = defaultId
  }
})
```

When provider changes, auto-selects that provider's WEEKLY_PLAN_DEFAULTS model if available.

### Router Options Helper

**Function**: `getRouterOptions()` in useWeeklyPlanAI.ts

Reads settings and constructs options object:
```typescript
const opts = {
  taskType: 'planning',
  temperature: 0.3,
  timeout: 30000,
  contextFeature: 'weeklyplan', // Enable user context injection
  forceProvider: settings.weeklyPlanProvider, // (if not 'auto')
  model: settings.weeklyPlanModel, // (if set)
}
```

**Critical**: `getSharedRouter()` is **ASYNC** — MUST be awaited (BUG fix Feb 2026).

---

## Work Profile Integration

### Gated on Setting

Only loads and uses work profile if `settingsStore.aiLearningEnabled === true`.

### Profile Data Sources

**From Supabase** (via `useWorkProfile` composable):
- `avgTasksCompletedPerDay` — capacity metric
- `peakProductivityDays` — ["monday", "wednesday"] — schedule complex (score ≥6) work here
- `avgPlanAccuracy` — past plan completion rate; if <60%, LLM schedules conservatively
- `memoryGraph` — structured observations (frequently_missed projects, high_wip patterns, etc.)

### Behavioral Context

**Computed in-memory** from app data via `computeBehavioralContext()`:

| Field | Source | Usage |
|-------|--------|-------|
| `recentlyCompletedTitles` | Last 2 weeks' done tasks | Optional context hint |
| `activeProjectNames` | Recently completed + in-progress tasks | Helps LLM batch same project |
| `avgTasksCompletedPerDay` | From profile | Capacity hint |
| `peakProductivityDays` | From profile | Complex work scheduling |
| `frequentlyMissedProjects` | Memory graph `frequently_missed` relation | Hint which projects need attention |
| `workInsights` | Memory graph observations (overdue patterns, WIP, capacity gaps, completion speed) | Contextual planning advice |

### Interview Flow

**Quick Plan (skip interview):**
```typescript
generatePlan() // No interview answers, uses defaults
```

**Thorough Plan (5 questions):**

1. **Top priority** — Free-text (e.g., "Ship auth overhaul")
2. **Days off** — Multi-select buttons (excluded from scheduling)
3. **Heavy meeting days** — Multi-select buttons (max 2 tasks each)
4. **Max tasks per day** — Chip selector (3, 5, 8, 10)
5. **Work style** — Radio buttons (frontload/balanced/backload)

**Pre-population** (onMounted):
```typescript
const savedProfile = await loadProfile()
if (savedProfile) {
  interviewForm.topPriority = savedProfile.topPriorityNote
  interviewForm.daysOff = savedProfile.daysOff
  // ... etc
}
```

**Persistence** (onSubmitInterview):
```typescript
savePreferences({
  topPriorityNote,
  daysOff,
  heavyMeetingDays,
  maxTasksPerDay,
  preferredWorkStyle,
})
```

---

## Eligible Task Selection

**Function**: `getEligibleTasks()` in useWeeklyPlan.ts

### Hard Filter (Deterministic Rules)

Tasks are **excluded** if:
- `_soft_deleted === true`
- `status === 'done'`
- `status === 'on_hold'` (user explicitly paused)
- `dueDate > weekEnd && status !== 'in_progress'` (future tasks, unless already started)

### Scoring & Top-N Selection

Remaining tasks are scored by relevance:

| Signal | Points |
|--------|--------|
| Overdue (dueDate < today) | +100 |
| Due this week | +80 |
| In-progress | +60 |
| Planned status | +30 |
| High priority | +30 |
| Medium priority | +20 |
| Low priority | +10 |
| Has estimated duration | +5 |

**Top 25** by score sent to LLM (tighter filtering than before).

**Console output:**
```
[WeeklyPlan] Eligible: 47 tasks after hard filter (152 total), sending top 25 to AI
```

---

## State Management

### Singleton Persistence (Survives Page Refresh)

**Storage key**: `'flowstate-weekly-plan'`
**Persisted states**: `'review'` and `'applied'` only
**Expiry**: 1 day

**Lifecycle:**
```typescript
// On mount
_state = loadPlanFromStorage() || createNewState()

// On generate/apply
savePlanToStorage(state.value)

// On reset or expiry
clearPlanStorage()
_state = null
```

### State Shape

```typescript
export interface WeeklyPlanState {
  status: 'idle' | 'interview' | 'loading' | 'review' | 'applying' | 'applied' | 'error'
  plan: WeeklyPlan | null  // { monday: string[], tuesday: [], ..., unscheduled: [] }
  reasoning: string | null // LLM's 2-3 sentence explanation
  taskReasons: Record<string, string> // Per-task "why this day" bullets
  weekTheme: string | null // Optional motivational theme
  error: string | null
  weekStart: Date
  weekEnd: Date
  interviewAnswers: InterviewAnswers | null
  skipFeedback: boolean // FEATURE-1317: Skip recording this week for learning
}
```

### State Transitions

```
idle
  ↓ (onQuickPlan)
loading → parse response → apply rebalancer + reasons
  ↓
review (user edits plan manually via drag-drop, regenerate-day, etc.)
  ↓ (onApply)
applying
  ↓ (assign tasks to canvas + record outcome if enabled)
applied
  ↓ (onRegenerate)
idle
```

Interview path:
```
idle → (onThoroughPlan) → interview → (submitInterview) → loading → ...
```

---

## Apply Plan: Task Assignment

**Function**: `applyPlan()` in useWeeklyPlan.ts

### Canvas Integration

For each day in the plan:
1. Find (or create) a day-of-week group on canvas (detected via power keyword: `day_of_week:1` for Monday, etc.)
2. Update each task:
   - `parentId`: Assign to day group
   - `dueDate`: Set to target date for that day

**CRITICAL**: Never set `canvasPosition` (geometry invariant violation).

### Work Profile Feedback (FEATURE-1317)

If `aiLearningEnabled && !skipFeedback`:
- Fire-and-forget: call `recordWeeklyOutcome(allPlannedIds, completedIds)`
- Then: call `generateObservationsFromWeeklyOutcome()` to extract learning patterns

Records historical accuracy for next week's planning.

---

## UI States & Flows

### Idle
- Display: "Plan Your Week" hero, task count, Quick/Thorough buttons, model selector
- Purpose: Initial entry point

### Interview
- Display: 5 question cards, pre-populated from saved profile, model selector
- Actions: Generate Plan (submit), Cancel
- Keyboard: Escape to cancel

### Loading
- Display: Spinner, "AI is analyzing...", skeleton columns
- Non-interactive during LLM calls

### Review
- Display: Week theme badge, collapsible reasoning, day columns with task cards
- Features:
  - Drag-drop tasks between days
  - Per-task action menu (remove, snooze, cycle priority, resuggest this day)
  - Workload warning if any day > capacity (TASK-1326)
  - Model selector (compact, in action bar)
- Actions: Apply, Regenerate, Cancel
- Keyboard: Enter to apply, Escape to cancel

### Applying
- Display: Spinner, "Applying plan..."
- Non-interactive, brief transient state

### Applied
- Display: Success icon, task/day counts, plan adherence stats (if available), feedback toggle
- Stats: Last week's accuracy, 8-week average (from work profile)
- Actions: Go to Canvas, Plan Again
- Feedback: "Record this week for learning" checkbox

### Error
- Display: Error icon, error message
- Actions: Try Again, Go Back

---

## Troubleshooting

### "AI was unavailable" Error

**Checklist:**

1. **Await on `getSharedRouter()`** — Pipeline MUST await the router promise:
   ```typescript
   const router = await getSharedRouter()  // CRITICAL: await keyword
   ```

2. **Provider API key configured** — Check:
   - Groq: `VITE_GROQ_API_KEY` in `.env.local`
   - OpenRouter: `VITE_OPENROUTER_API_KEY`
   - Ollama: Running at localhost:11434

3. **Edge Function reachable** — If using cloud proxy:
   ```bash
   curl https://your-supabase-instance.functions.supabase.co/ai-chat
   ```

4. **Model ID exists in registry** — Verify selected model is in `getModelsForProvider(selectedProvider)`

5. **Network/timeout** — Check browser DevTools Network tab for failed requests, adjust `timeout: 30000` if needed

### Tasks Pile on One Day

**Likely cause**: Interview's `maxTasksPerDay` too high, or rebalancer threshold (120%) not triggered.

**Debug:**
- Check console: `[WeeklyPlanAI] Rebalancer triggered` — if present, rebalancer did run
- Verify interview answer: `maxTasksPerDay` is reasonable
- Manually move tasks in review state, or regenerate that day

### No Per-Task Reasons ("Grouped with..." missing)

**Cause**: LLM response missing `taskReasons` field.

**Check:**
- Console: Look for parse error logs
- Response format: Ensure LLM returns JSON with `taskReasons` object
- Fallback: If LLM fails, only deterministic reasons (from Step 0) appear

### "Plan Already Applied, But No Regenerate Option"

**Expected**: "Plan Again" button appears in `applied` state.

**If missing**: State was cleared (page refresh, manual reset). Click "Plan Again" from applied state.

---

## Key Architecture Decisions

### Why 2 LLM Calls + 3 Deterministic Passes?

1. **Separation of concerns**: LLM does distribution, determinism handles safety & context
2. **Cost optimization**: First call is focused (~2400 tokens), second is tiny (~170 tokens, optional)
3. **Deterministic guarantees**: Rebalancer prevents edge cases, reasons are always generated even if LLM response is incomplete
4. **Reliability**: Fallback plan ensures no complete failure

### Why Top-25 Task Limit?

- Reduces token count for LLM prompt
- Focus on high-relevance tasks only
- Avoids overwhelming the LLM with low-priority noise

### Why forceProvider Gracefully Falls Back?

If user selects "Groq" but Groq API is unavailable, `getSharedRouter()` auto-routes to fallback (auto → Ollama). Plan still succeeds.

### Why Skip Interview by Default?

"Quick Plan" reduces friction — most users don't need to answer questions every time. "Thorough Plan" available for refined control.

### Why 120% Rebalancer Threshold?

- Strict 100% threshold would rebalance too aggressively (normal LLM variance)
- 120% allows 20% variance, triggers only on genuine imbalance
- Example: target 4/day, triggers if any day > 4.8 tasks

---

## Integration Points

### Timer Store (Cross-Device Sync)

Weekly Plan assigns `dueDate` to tasks. Timer then uses this to calculate session dates.

### Canvas Store (Geometry)

Plan assigns `parentId` to tasks (day group). Respects canvas position locking invariants.

### Task Store

Plan calls `updateTask(id, { dueDate, parentId })` for each task. No direct database writes.

### Settings Store

Reads:
- `weeklyPlanProvider`, `weeklyPlanModel` (model selection)
- `aiLearningEnabled` (work profile gating)
- `weekStartsOn` (0=Sunday, 1=Monday)

### Work Profile (Memory Graph)

Reads structured observations for planning insights. Writes weekly outcomes for feedback loop.

---

## Performance & Limits

| Metric | Value | Notes |
|--------|-------|-------|
| Max eligible tasks screened | ~150 | Hard filter + scoring |
| Max tasks sent to LLM | 25 | Top-N after scoring |
| LLM call 1 tokens (est.) | ~2400 | System prompt (~800) + user prompt (~1600) |
| LLM call 2 tokens (est.) | ~170 | Week theme (tiny) |
| Total time (both calls) | ~10–30 sec | Depends on provider (Groq: fast, DeepSeek: slow) |
| State persistence | 1 day | Auto-expires after 24 hours |
| Concurrent plans | 1 | Only one plan in memory at a time (singleton) |

---

## Validation Checklist

Before deploying changes to weekly plan:

- [ ] All task IDs in response are valid (filtered by eligible set)
- [ ] No task appears in multiple days (deduplication enforced)
- [ ] Days off excluded from schedule (verify `daysOff` filter)
- [ ] Unscheduled count makes sense (not just an LLM bug)
- [ ] Rebalancer logs appear when days are imbalanced
- [ ] Reasons are generated for all assigned tasks
- [ ] Week theme is optional (silent fail doesn't break plan)
- [ ] Model selector updates both provider and model
- [ ] Interview responses persist to work profile
- [ ] Apply plan assigns tasks to canvas without geometry errors
- [ ] Fallback plan generated if both LLM attempts fail
- [ ] Error states render gracefully (no blank screens)

---

## Related SOPs & Documentation

- **[SOP-032](SOP-032-store-auth-initialization.md)** — Auth-aware store initialization (work profile loads with auth)
- **[SOP-036](SOP-036-supabase-jwt-key-regeneration.md)** — JWT key management (if profile load fails)
- **[CANVAS-POSITION-SYSTEM.md](canvas/CANVAS-POSITION-SYSTEM.md)** — Geometry invariants (plan respects position locks)
- **[design-system.md](../../claude-md-extension/design-system.md)** — Design token usage (all colors/spacing via tokens)
- **[architecture.md](../../claude-md-extension/architecture.md)** — Full system architecture, composables index

---

## Version History

| Date | Changes |
|------|---------|
| Feb 21, 2026 | Initial documentation of TASK-1327 hybrid pipeline with rebalancer, reasons, and week theme |
| | Added work profile integration (FEATURE-1317), model selector (TASK-1399), interview flow details |
| | Documented state persistence, apply plan integration, troubleshooting guide |
