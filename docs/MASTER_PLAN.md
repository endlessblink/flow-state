# FlowState MASTER_PLAN.md

## 🔜 Next Up — AI Chat Quality System (start here after restart)

## AI Chat Quality System Full Delivery Lane — localhost first, Electron later

**Goal**: Make FlowState chat consistently useful across weekly planning, "what should I do", prioritization, task breakdown, smart lanes, follow-up tasks, and general agent help by combining server-backed memory, explicit uncertainty, low-overwhelm UX, feedback learning, and testable answer-quality gates.

**Current execution cursor**: **LANE-7/LANE-9 lifecycle diagnostics and answer-quality hardening**. The lane is now treated as one full delivery track, not scattered AI-chat patches. The current localhost proof covers the main broad task-answer entry points plus first feedback suppression, but do not ask the user to test broadly until lifecycle, stale-context refresh behavior, and quality gates prove the flow cannot regress into repeated questions, generic fallback prose, or low-context recommendation dumps.

**Why this lane exists**: This work has too many coupled failure modes to track as isolated fixes. Use this lane as the single source of truth so every change is tied to a phase, a proof gate, and a user-visible quality outcome. If a future session feels lost, resume from the current execution cursor and the first incomplete proof gate below.

**Hard lane rules**:
- Work stages in order. Do not jump to polish, Electron, or broad UI expansion while the current stage lacks localhost proof.
- Do not ask the user to test until the relevant stage passes automated checks plus a real localhost browser smoke.
- Default response contract: ask one high-value button-based clarification before broad recommendations when missing context would materially change the answer.
- Suppress broad plan/recommendation prose until the user answers, chooses "continue with uncertainty", or the system has enough grounded context.
- Every recommendation must cite task evidence plus memory/context evidence, or explicitly mark the missing evidence.
- User-authored facts and corrections outrank model inference. Project/task names alone never establish importance, stakes, domain, or success criteria.
- Electron packaging/update work is deferred until localhost behavior is reliable and the user re-enables Electron for this lane.

**Execution checklist**:
1. Finish the current stage only. Do not start later UI polish or Electron delivery while the stage proof gate is red.
2. After every code slice, update the relevant task progress note with what changed and what was proven.
3. Run focused tests for the slice, then the AI-focused suite, then localhost/browser smoke when user-visible behavior changed.
4. If localhost smoke fails, keep fixing. Do not ask the user to test a flow that is stuck, verbose, or missing persistence proof.
5. Commit and push only after the plan file, tests, and proof evidence match the actual current state.

**Operator board for the active lane**:
- **Current slice**: LANE-7/LANE-9 lifecycle diagnostics plus answer-quality hardening. Prove broad memory retrieval can detect stale, low-confidence, noisy, or old memory without dumping it into normal prose, then turn those signals into refresh prompts and eval failures for fake/generic answers.
- **Current proof**: MASTER_PLAN has a complete packet queue with one current cursor, plus a repeatable localhost browser proof that covers prompt -> one clarification -> answer/uncertainty -> feedback/debug -> no-repeat.
- **Next slice after current proof**: answer-quality eval hardening for broad post-clarification plans, plus the deeper entity freshness writeback that updates `ai_context_entities.last_answered_at`/`stale_after` after refresh confirmations.
- **Blocked until current proof is green**: background summarization jobs, pgvector/semantic recall, broader UI polish, Electron packaging, and user-facing test instructions.
- **User-test rule**: no user test request until Stage 8/LANE-10 proves the full localhost loop in browser: prompt -> one clarification -> answer/uncertainty -> no barrage -> no stuck activity -> feedback/debug visible.

**Authoritative task lane queue**:

| Lane | Status | Task refs | Product outcome | Files/surfaces | Proof gate |
| --- | --- | --- | --- | --- | --- |
| LANE-0: Regroup and cursor discipline | 🔄 CURRENT | This top lane + TASK-1842 | One source of truth that prevents scattered fixes and stale "current slice" drift | `docs/MASTER_PLAN.md` | Lane lists all packets, current cursor, blocked work, and user-test gate |
| LANE-1: VPS-safe memory substrate | 🔄 CURRENT | TASK-1830, TASK-1839 | Durable memory for real projects, synthetic buckets, preferences, corrections, and events; no UUID failures for `Work`, `My Projects`, or `uncategorized` | Supabase migrations, memory repositories, schema contract tests | Contract/retrieval tests pass; missing live schema degrades without chat failure |
| LANE-2: Hybrid retrieval and latency budget | 🔄 CURRENT | TASK-1838 | Fast exact-key retrieval first; bounded recent events/feedback/edges; optional pgvector later without blocking the hot path | `weeklyMemoryRetrieval`, `broadMemoryRetrieval`, memory diagnostics, timeout/cache helpers | Retrieval tests prove bounded diagnostics, synthetic-key safety, and timeout fallback |
| LANE-3: Coverage, uncertainty, and EVPI question choice | 🔄 In progress | TASK-1840, TASK-1831A, TASK-1831 | Ask the most valuable non-repeated question; do not treat one random button answer as enough context | uncertainty policy, EVPI scoring, parameter beliefs, clarification events | Tests prove high-value question selection, cooldown/dedupe, answer-to-belief update, and no immediate re-ask |
| LANE-4: Low-overwhelm answer contract | 🔄 In progress | TASK-1831, TASK-1832 | Broad requests start with one concise card or a visible uncertainty escape; no generic plan dump by default | chat pipeline, deterministic fallback, repair/audit helpers, clarification UI | Tests fail overlong first answers, name-only importance, unsupported ranking, and filler prose |
| LANE-5: Broad-flow coverage beyond weekly planning | ✅ First proof done | TASK-1835 | Same contract for "what should I do", day plan, smart lanes, prioritization, task breakdown, follow-up task suggestions, and general agent help | intent router, deterministic flows, formatter prompts, fallback cards | Non-weekly tests prove ask/proceed/neutral behavior and no hidden task-card barrage while asking |
| LANE-6: Feedback learning and suppression | ✅ First proof done | TASK-1833, TASK-1836 | Accept/postpone/dismiss/simplify actions immediately change current UI and later retrieval/ranking | inline recommendation cards, feedback store, memory retrieval, cooldown rules | UI/unit tests prove postponed/dismissed items suppress until revisit and accepted/timeblocked items become positive signals |
| LANE-7: Memory lifecycle and safety | 🔄 First refresh proof done | TASK-1837, TASK-1839 | Memory stays useful over time: stale refresh, confidence decay, summaries, retention, correction audit, prompt-injection-safe evidence | lifecycle policy, retrieval diagnostics, prompt evidence builders | Lifecycle/security tests prove stale facts are refreshed, old/noisy events are flagged, and free text is quoted evidence only |
| LANE-8: Observability and speed | 🔄 In progress | TASK-1834 | User can see concise phases and debug reasons without reading internal dumps; no duplicate thinking rows or stuck spinner after saving | activity timeline, clarification debug disclosure, phase timing metadata | Activity/UI tests and browser smoke show phase changes, slow-step attribution, and no stuck running row |
| LANE-9: Answer-quality evaluation rubric | 🔄 In progress | TASK-1841 | Bad/acceptable/excellent scoring becomes executable, not subjective vibe review | eval fixtures, citation audit, adversarial scenarios | Eval fails fake reasoning, repeated questions, excess length, missing evidence, and conflicting-correction misuse |
| LANE-10: Localhost E2E proof | ✅ Broad-flow proof done | TASK-1842 | Real browser proves the end-to-end loop before the user is asked to test | Playwright/localhost smoke, seeded tasks, bridge stubs, screenshots | Prompt -> one clarification -> answers/follow-ups -> concise plan/uncertainty -> feedback/debug -> no barrage -> no stuck activity -> too-much feedback changes next broad answer |
| LANE-11: Electron delivery gate | ⏸ Deferred | TASK-1843 | Desktop packaging/updater only after localhost proves behavior and user re-enables Electron | Electron build/update/deploy surfaces | Explicit user re-enable, then Electron build/update verification |

**Current lane cursor**: LANE-7/LANE-9 are the next incomplete product slices after the broad-flow and feedback-suppression proofs. The latest localhost smoke covers weekly planning, prioritization, next-task, overdue triage, day planning, smart lanes, task breakdown, compact post-clarification planning, debug disclosure, no stuck running row, no-repeat broad clarification, a simplify/too-much feedback loop that changes the next broad answer, and broad postpone feedback suppressing the same task in the next broad answer. Continue with lifecycle/stale-context rules and answer-quality eval hardening before asking for broad user testing.

**Resume rule for future agents**: Start from the operator board above, then the first non-green proof gate in the stage table. Do not reinterpret this lane as a weekly-plan copywriting task, a local-only memory hack, or an Electron updater task. The intended product behavior is a durable AI chat quality system that learns useful context, asks the right low-friction questions, avoids overwhelming answers, and proves that behavior locally before desktop delivery.

| Stage | Task(s) | Required outcome | Status | Proof gate before moving on |
| --- | --- | --- | --- | --- |
| 0 | This lane + TASK-1842 | Single execution lane, active cursor, localhost-only gate, no vague partial phases | ✅ Done | MASTER_PLAN lane lists all stages, dependencies, proof, and user-test gate |
| 1 | TASK-1830, TASK-1838, TASK-1839 | VPS-safe memory substrate: server entities/events/edges, synthetic keys, missing-schema fallback, SQL-first retrieval, RLS/prompt-injection safety | 🔄 In progress | Contract tests, retrieval tests, no UUID errors for `Work`/`My Projects`/`uncategorized`, bounded retrieval diagnostics |
| 2 | TASK-1840, TASK-1831A, TASK-1831 | Clarification decision engine: coverage/materiality policy, heuristic EVPI, one-question ladder, cooldown/dedupe, continue-with-uncertainty escapes | 🔄 In progress | Unit + mounted tests prove highest-value non-repeated question appears and answering it does not re-ask or dump content |
| 3 | TASK-1835 | Apply the same ask-before-answer contract to all broad chat flows, not only weekly planning | ✅ First proof done | Non-weekly tests for day plan, smart lanes, prioritization, "what should I do", and task breakdown prompts |
| 4 | TASK-1832, TASK-1841 | Answer-quality evaluator: groundedness, brevity, evidence, unsupported-ranking rejection, bad/acceptable/excellent rubric | 🔄 In progress | Eval/tests fail generic prose, name-only importance, repeated templates, missing evidence, and overlong answers |
| 5 | TASK-1833, TASK-1836 | User feedback loop: accept/postpone/dismiss/simplify controls, reason chips, cooldowns, revisit dates, implicit positives | ✅ First proof done | UI tests prove feedback persists, current suggestions suppress immediately, future ranking respects feedback |
| 6 | TASK-1834 | Observability and speed: concise phases, timings, path type, slow-step diagnostics, no duplicate thinking rows | 🔄 In progress | Activity-row tests plus localhost smoke show answer phase changes and no stuck spinner after saving clarification |
| 7 | TASK-1837 | Memory lifecycle: fact promotion, confidence decay, summaries/snapshots, stale confirmations, export/delete policy | 🔄 First refresh proof done | Lifecycle tests prove stale facts refresh, corrections stay auditable, retrieval stays bounded |
| 8 | TASK-1842 | Localhost end-to-end QA: real browser flow from prompt → clarification → answer/uncertainty → feedback/debug | ✅ First proof done | Playwright/browser evidence proves no content barrage before clarification and no stuck card after answer |
| 9 | TASK-1843 | Electron packaging/updater gate after localhost stabilization | ⏸ Deferred | Only run Electron build/update when user explicitly re-enables Electron for this lane |

**Research-backed requirements captured in the stages**:
- Hybrid memory: session, episodic events, semantic facts/summaries, procedural preferences.
- Server-backed persistence for VPS/localhost parity: `ai_context_entities`, `ai_clarification_events`, `ai_context_edges`, recommendation feedback, and later `ai_parameter_beliefs`.
- Hybrid retrieval: exact entity key lookup first, structured filters and recent events second, optional pgvector/semantic recall only when needed and timeout-safe.
- EVPI-inspired clarification selection: information value ~= uncertainty * impact * expected reduction - user cost.
- Low-overwhelm UX: one question per turn, 3-5 buttons, optional free text, visible escape hatches, concise output, progressive disclosure.
- Feedback learning: dismissed/postponed/ignored recommendations affect cooldowns and preference facts; accepted/time-blocked/completed/timer-started actions are positive signals.
- Lifecycle: confidence decay, stale refresh, summarization/snapshots, retention, export/delete, and correction auditability.
- Evaluation: groundedness, specificity, brevity, uncertainty handling, learning/adaptation, user control, realism, safety, citation audit, and adversarial free-text tests.
- Accepted architecture decision: defer a dedicated graph database. Use Postgres-native `ai_context_entities` + `ai_context_edges` + optional pgvector embeddings first; add recursive CTE/app-layer traversal only when concrete multi-hop queries demand it.
- Accepted fallback decision: after structured-output failure, retry once with validation feedback; on second failure, show a deterministic compact draft with visible coverage/uncertainty and feedback controls. Do not loop into another clarification unless EVPI is high and the question is not recently answered.
- Accepted quality decision: broad low-context outputs default to 1-3 recommendations with controls, not 5+ ranked items and prose. If coverage is low and materiality is high, ask one high-EVPI question; if proceeding, mark uncertainty visibly.

**User-test gate**: The user should only be asked to test after Stage 8 has a passing localhost browser smoke and the final response says exactly what changed, what to try, what should no longer happen, and what is still intentionally not built.

**Not ready for user testing until**:
- Stage 1 proves server-backed memory does not fail on synthetic buckets or missing schemas.
- Stage 2 proves answering a clarification saves/updates durable belief state and continues without a stuck activity row.
- Stage 7 proves stale context/lifecycle behavior and Stage 9 proves answer-quality evals beyond the current smoke matrix.
- Stage 8 proves the complete localhost flow in a real browser.

---

### TASK-1830: Server-backed AI context memory for all chat flows (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1828, TASK-1829

**Why**: AI chat quality cannot be fixed by prettier weekly-plan prose or local-only clarification state. The assistant needs a VPS-safe, cross-device system of record for what projects, task groups, recurring workflows, and user preferences mean, including synthetic entities like `Work`, `My Projects`, and `uncategorized`.

**Scope**:
- Add durable server-backed entities for project/task/week/preference/synthetic/workflow context.
- Store clarification history, answers, dismissals, corrections, and "generate with uncertainty" choices so the assistant does not repeatedly ask the same questions.
- Support non-UUID entity keys without writing them into UUID-only Supabase columns.
- Retrieve relevant memory before planning or ranking, then merge it with existing project/task context rows.
- Keep memory editable and auditable through event history instead of overwriting meaning silently.
- Research validation update: treat memory as tiered session/episodic/semantic/procedural state, not one generic blob.
- Research validation update: add lifecycle rules for confidence decay, stale confirmation, summarization, retention, and selective retrieval so memory does not become slow or noisy.
- Research validation update 2: add `memory_type`, `scope`, `reinforcement_count`, `last_reinforced`, `related_entities`, and optional vector embedding support when the schema graduates beyond the first clarification slice.
- Research validation update 2: user-authored facts and corrections outrank model inferences; model inferences stay low confidence until confirmed.
- Graph update: add a Postgres-native `ai_context_edges` relation table before considering a separate graph database. Treat projects/tasks/weeks/preferences/workflows as nodes and store edges such as `belongs_to`, `blocks`, `follow_up`, `part_of_week`, and `preference_affects`.
- Research decision update: do not introduce Neo4j/Memgraph/Graphiti as a separate runtime now. Postgres entities/edges plus pgvector keeps RLS, migrations, VPS ops, and localhost parity simpler; revisit only after concrete temporal multi-hop use cases exceed recursive CTE/app-layer traversal.

**Acceptance**:
- Synthetic buckets persist through `ai_context_entities`/`ai_clarification_events`, not localStorage.
- UUID-only project/task context calls filter non-UUID IDs and never throw `invalid input syntax for type uuid`.
- Weekly planning can recall saved answers for `Work`, `My Projects`, and `uncategorized` across sessions/devices.
- Memory retrieval is bounded/cached enough that the sidebar does not feel stuck.
- Free-text clarification answers are stored as user-authored evidence, not prompt instructions.
- Memory rows can be versioned or audited so correction history remains inspectable after summaries are compacted.
- Entity relationships can be queried server-side without introducing Neo4j/Memgraph deployment complexity.

**Progress**:
- 2026-06-08: Pending AI memory write tests now prove clarification events, recommendation feedback, and parameter beliefs all queue during schema-cache/migration misses and flush after the server schema becomes available. This protects saved clarification answers, postpone/dismiss/simplify learning signals, and EVPI belief updates during VPS rollout timing gaps.
- 2026-06-08: Broad non-weekly task answers now retrieve server-backed `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, and `ai_recommendation_feedback` by text entity key before formatting task-list responses. This closes the gap where weekly planning could recall synthetic bucket context but general "what should I do" answers still ignored durable `Work`/`My Projects`/`uncategorized` memory.
- 2026-06-08: Ordinary freeform/ReAct prompts and non-task deterministic formatter paths now receive a bounded global memory packet from server-backed workflow/preference entities, recent clarification events, and parameter beliefs. This makes the first Slice 1 requirement closer to true: assistant responses are no longer prompt-only when no task-list tool result is present.
- 2026-06-08: Postgres-native graph edges are now readable, not only write-only. `fetchAIContextEdges` retrieves bounded source/target relationships by text entity key, weekly/broad/global retrieval include edge counts or compact relationship evidence, and Settings > AI memory debug shows recent edge counts/labels. This keeps `Work`, `My Projects`, and `uncategorized` graph memory VPS-safe without a dedicated graph database.
- 2026-06-08: ReAct/freeform tool loops now append the same bounded broad task-memory packet after native or text-detected tool calls. Freeform answers that first ask tools for task lists can use saved entities, clarification events, parameter beliefs, recommendation feedback, and graph relationship evidence instead of reverting to prompt-only task formatting.
- 2026-06-08: Broad task-memory retrieval now has the same bounded timeout/fallback contract as weekly retrieval. It returns source/timing/entity-count diagnostics and an empty evidence packet on timeout, so broad prompts can continue without inventing memory or losing proof of whether memory came from `hybrid_sql` or fallback.
- 2026-06-08: Added a dedicated AI memory schema contract test that checks runtime table usage against the Supabase migrations for `ai_context_entities`, `ai_clarification_events`, `ai_parameter_beliefs`, `ai_recommendation_feedback`, and `ai_context_edges`. The test now guards text-key synthetic entities, RLS enablement, hot retrieval indexes, check-enum parity, and every runtime-read/write column before VPS rollout.
- 2026-06-08: Settings > AI memory debug now reports server schema status (`ready`, `partial`, `missing`, or `local_only`) plus missing table names and queued writes. This makes Supabase schema-cache/migration drift visible during localhost/VPS testing instead of showing an empty memory panel with no diagnosis.
- 2026-06-08: Broad task-list memory now also retrieves global workflow/preference keys such as `preference:brevity` and response-quality workflow memories. A saved simplify/too-much signal becomes a direct `compactPreference` flag, and deterministic broad fallbacks cap the next non-weekly draft to one recommendation instead of repeating a dense answer.

---

### TASK-1831: Global low-overwhelm clarify-before-answer contract (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: The chat should not dump long, generic recommendations when context is missing. This applies broadly to planning, prioritization, task breakdowns, "what should I do", and other agent answers, not only weekly planning.

**Scope**:
- Before producing a broad recommendation, detect missing context that would materially change the answer.
- Ask one concise button-based clarification with optional free text by default.
- Provide escape actions: generate with current info, show candidates only, pause/save.
- Keep default responses short, scannable, and grounded; avoid walls of text unless the user asks for detail.
- Use recent clarification history and cooldowns before asking.
- Research validation update: compute an explicit coverage/uncertainty score before asking or ranking.
- Research validation update: ask first when weak context would materially affect planning; otherwise proceed with visible uncertainty.
- Research validation update 2: use a concrete coverage policy: coverage > 0.8 proceeds, 0.5-0.8 proceeds with visible uncertainty when materiality is low/medium, and < 0.5 with high materiality asks one question first.
- Research validation update 2: choose the question with highest expected value: missing impact, stakes, energy fit, stakeholder/commitment, dependency, history, or preference dimension that most changes the current answer.
- Research decision update: one button answer is only enough when it resolves a low-EVPI slot or the user chooses to proceed with uncertainty. Complex/cold-start planning may use a short ladder, but still one question per turn with cooldown/dedupe.

**Acceptance**:
- Missing meaning/stakes/success criteria triggers one clarification card, not a full generic plan.
- The assistant can proceed only when the user explicitly chooses to generate with uncertainty.
- No answer ranks importance from project/task names alone.
- Recently answered, dismissed, or uncertainty-accepted questions are not asked again inside the cooldown window.
- Cold-start users get one lightweight question or neutral candidates, not a dense interview.
- Clarification events record `coverage_score_at_time`, `uncertainty_dimensions`, and answer path type when available.

**Progress**:
- 2026-06-08: Added server-backed `ai_parameter_beliefs` schema keyed by text `entity_key` rather than UUIDs, so synthetic buckets and workflow entities can store uncertainty slots such as impact, preferences, stakes, dependencies, and success criteria.
- 2026-06-08: Clarification cards now continue automatically after the first saved answer, so the user never gets stuck in a required follow-up ladder. Additional context questions must be asked later only when they are high-value and non-repeated.
- 2026-06-08: Added a focused AI memory schema contract test for server-backed entities, clarification events, recommendation feedback, Postgres-native graph edges, RLS, migration order, and missing-schema client fallback before any live Supabase migration step.
- 2026-06-08: Clarification continuation messages now include the actual selected button/free-text answer as compact quoted context, so localhost flows still proceed correctly before live Supabase memory migrations are applied.
- 2026-06-08: Clarification continuations now run as hidden control messages with a typed mode marker and bypass the ask gate once, so answering a card does not add noisy chat content or immediately re-ask the same question while persistence is delayed.
- 2026-06-08: Broad response-quality clarification now checks saved `ai_parameter_beliefs` for the workflow key before asking. A high-confidence saved `rankingFocus`/preference belief raises coverage to `proceed`, so the same broad-answer guidance question is not re-asked after it has already been answered and persisted.
- 2026-06-08: Weekly clarification no longer blocks the answer behind a multi-step ladder. Button-only answers are treated as enough to generate a compact, uncertainty-aware result; the next high-value question can appear later instead of delaying visible progress.
- 2026-06-08: Response-quality clarification now continues immediately after a button-only answer. This keeps the ask-before-answer gate lightweight while preserving the saved answer as evidence for the continuation.
- 2026-06-08: The "generate with current info" escape now explicitly continues the chat through the clarification-continuation path with instructions to mark missing context as unknown, rather than only showing local candidate cards.
- 2026-06-08: Localhost generate-current smoke now shows a limited uncertainty-marked draft instead of confident impact/risk fallback prose, with no long-plan dump and no stuck generation state.
- 2026-06-08: Clarification follow-up answers are now preserved as user-authored evidence in the deterministic formatter prompt, including free-text follow-up notes, so the answer after clarification can use what the user actually said instead of only bypassing the ask gate.
- 2026-06-08: Formatter timeout, missing-card fallback, and quality-repair paths now use the same clarification evidence as the main formatter, so post-clarification fallback prose and card reasons do not revert to generic ranking claims.
- 2026-06-08: Missing-card repair now replaces noisy model prose with the concise grounded fallback when the formatter output already fails quality checks or follows a clarification continuation, instead of appending fallback cards under a broad content dump.
- 2026-06-08: Added an in-memory pending AI memory write queue for missing-schema/schema-cache timing failures. Clarification events, recommendation feedback, parameter beliefs, and context edges now enqueue instead of being lost when migrations are not visible yet, and can flush after schema availability without blocking the chat UI.
- 2026-06-08: Broad ask-before-answer routing now distinguishes prioritization, next-task, overdue-triage, and task-breakdown response modes instead of collapsing them into generic task answers. This lets the clarification gate ask a relevant one-card question for "prioritize", "what should I do next", and overdue triage flows before broad recommendations.
- 2026-06-08: Guest/localhost clarification answers now persist in the AI memory database composable's local fallback, including derived `rankingFocus` parameter beliefs. This makes saved response-direction answers retrievable immediately without Supabase auth, so the same broad card is not re-asked in the next prompt while server sync is unavailable.
- 2026-06-08: Broad clarification continuations now use the recognized `general` mode instead of leaking entity IDs such as `day_plan` into the continuation marker. This keeps "what should I do next" and similar response-quality cards on the deterministic low-overwhelm path instead of falling into freeform/ReAct and surfacing bridge auth errors.
- 2026-06-08: Deterministic task answers now fall back to local formatter cards when the provider fails after task data has already been read. Guest/localhost users see a compact grounded task answer instead of `AI bridge unavailable: not_signed_in`.

---

### TASK-1831A: EVPI-style clarification scoring and parameter belief tracking (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: "Ask one question at a time" is not enough unless the system asks the right question. Clarification should be chosen because it has high expected value for the answer, not because it appears first in a hardcoded list.

**Scope**:
- Define structured planning parameters: project meaning, task context, impact/stakes, stakeholders, dependencies, energy fit, history, preferences, stale context, and later deadline/scope/success criteria.
- Add heuristic EVPI scoring: uncertainty × task-planning impact × expected reduction − user-cost.
- Use EVPI scoring to select the highest-value non-repeated clarification question.
- Store EVPI details in debug/context metadata: targeted parameters, heuristic EVPI, user cost, selected score, threshold, skipped/recently-resolved candidates.
- Add `ai_parameter_beliefs` or equivalent server-backed belief records after the heuristic is proven locally.
- Update belief confidence after user answers and use answer/feedback outcomes to learn impact weights over time.

**Acceptance**:
- When multiple clarification questions are possible, the selected card is the highest-value non-repeated question by EVPI score.
- The assistant does not ask a lower-value question just because it appears first in the question list.
- Clarification debug/event context includes targeted parameters and score metadata.
- Recent answered/dismissed/generated-with-uncertainty questions are skipped and appear as skipped candidates in debug metadata.
- The heuristic remains local/fast and does not add extra LLM calls to the hot path.

**Progress**:
- 2026-06-08: Added local heuristic EVPI scoring over existing coverage dimensions, including targeted parameters, user cost, selected score, skipped candidates, clarification debug display, and event context metadata. Mounted tests verify project-meaning questions outrank broad week questions when project meaning is the high-value missing context, and recently answered questions are skipped.
- 2026-06-08: Answered clarification events now derive/update server parameter beliefs with confidence, impact weight, selected label/free text, question evidence, and missing-dimension keys. This keeps EVPI inputs durable for VPS/local parity instead of recalculating only from transient chat state.
- 2026-06-08: Broad clarification coverage now consumes durable parameter beliefs, not only recent events. Unit tests prove a saved high-confidence `rankingFocus` belief suppresses the response-direction card and lets the assistant proceed without repeating the ladder question.
- 2026-06-08: Response-quality coverage now treats prioritization, next-task, overdue-triage, and task-breakdown modes as high-materiality even when only a few task candidates are visible. A saved high-confidence `rankingFocus` belief still suppresses re-asking for those modes.
- 2026-06-08: Prioritization routing now loads the active task list rather than the overdue-only tool. This prevents "prioritize my tasks" from skipping the clarification gate simply because there are no overdue tasks.
- 2026-06-08: Broad clarification now uses heuristic EVPI candidate scoring instead of a single hardcoded mode prompt. It scores targeted parameters, skips recently resolved prompt variants, records selected score/user cost/candidate metadata in debug, and can ask the next high-value missing dimension without repeating the same generic ranking-focus question.

---

### TASK-1832: High-quality planning rubric and anti-fake-reasoning evaluator (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: "High quality" must be testable. The current failures are not only bugs; they are answer-quality regressions: filler prose, unsupported importance, overwhelming length, repeated questions, and recommendations that ignore consequences, commitments, dependencies, emotional friction, and project momentum.

**Scope**:
- Add a strict task-ranking rubric with bounded weights: importance/impact, life consequences, commitments, dependencies, project momentum, avoided work, energy/fit, urgency, workload realism, and confidence.
- Add bad/acceptable/excellent answer criteria for weekly planning and broader chat recommendations.
- Add automated checks that penalize generic phrases, unsupported ranking, missing evidence, excess length, and repeated clarification questions.
- Require every recommendation to cite task evidence plus project/context evidence or mark "context unknown."
- Research validation update: normalize ranking inputs with explicit caps, decay functions, and user override signals so due dates, priority, or project names cannot dominate alone.
- Research validation update: add adversarial tests for ambiguous names, conflicting corrections, prompt-injection-like free text, stale context, and high-uncertainty task sets.
- Research validation update 2: use tunable ranking bands: impact/life consequences/commitments 25-30%, dependencies/project momentum/avoided work 20-25%, energy/workload/confidence 20%, urgency/effort 15-20%, and user overrides/recency about 10%.
- Research validation update 2: aggregate repeated postpone/dismiss reasons into preference facts, for example "deep work often postponed Friday" or "not important this month."

**Acceptance**:
- Regression tests fail if answers say a task is high stakes or meaningful from a name alone.
- Tests fail on generic phrases like "looks like meaningful work" without evidence.
- Tests cover postponed/dismissed suggestions, stale context, correction overrides, and uncertainty handling.
- Tests assert visible evidence, confidence, omissions, and user override controls so ranking does not become a black box.
- Tests include cold-start, conflicting corrections, high-uncertainty sets, adversarial free text, and citation audits for unsupported prioritization.

**Progress**:
- 2026-06-08: Added `auditWeeklyPlanQuality()` with bad/acceptable/excellent scoring and validation rejection for unsupported importance, generic substantial-work phrasing, weak consequence coverage, repeated templates, and overlong plans.
- 2026-06-08: Added shared `auditChatResponseQuality()` for broader deterministic task answers so non-weekly outputs can be repaired when they are verbose, generic, metadata-only, or missing task cards.
- 2026-06-08: Broad post-clarification answers now fail the chat-quality audit when they do not visibly honor the user's clarification evidence, forcing repair to the concise grounded fallback instead of accepting a plausible but context-ignoring answer.
- 2026-06-08: Research policy update accepted: structured-output failure must retry once and then degrade to a deterministic compact draft with visible uncertainty and feedback controls; repeated clarification after a saved answer is a quality failure; low-context fallback should cap visible recommendations around 1-3 by default.
- 2026-06-08: The chat-quality audit now treats `prioritization`, `next_task`, `overdue_triage`, and `task_breakdown` as broad task-answer modes. Mode-specific regressions prove these flows fail when they ignore saved clarification evidence, cite only shallow metadata, or claim high stakes without visible uncertainty.
- 2026-06-08: Broad card answers now feed parsed card reasons into the structured recommendation-evidence audit, and the audit rejects repeated reason/evidence templates across multiple cards. Post-clarification deterministic fallback reasons now combine the user's clarification with task-specific evidence, so the fallback cannot pass by repeating the same generic clarification sentence on every recommendation.

---

### TASK-1833: Planning UI controls for accept/postpone/dismiss/feedback (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (filed 2026-06-08) | **Depends on**: TASK-1831, TASK-1832

**Why**: A trustworthy AI planner needs user agency. Suggestions should be reviewable cards with controls, not prose the user has to mentally parse and correct.

**Scope**:
- Render concise recommendation cards with "why now", expected impact, tradeoff, confidence, and inline reasoning disclosure.
- Add controls for accept/time-block, postpone, dismiss with reason, explain more, and adjust preferences.
- Save feedback as memory events so dismissed or postponed suggestions do not keep reappearing unchanged.
- Add "Too much" / simplify controls that reduce plan size and defer nice-to-haves.
- Research validation update: persist recommendation feedback separately from clarification memory: accept/postpone/dismiss/simplify/explain actions, revisit dates, outcome signals, and reasons.
- Research validation update: treat postponement as lightweight deferral, not permanent rejection.
- Research validation update 2: recommendation feedback should link back to generated plan/recommendation IDs and aggregate into preferences when patterns repeat.
- Research validation update 2: add reason categories such as too_hard, low_energy, not_important, wrong_context, already_done, needs_more_info, and free-text evidence.

**Acceptance**:
- Dismissed suggestions are downranked or hidden until cooldown/re-engagement.
- Postponed suggestions respect the chosen revisit window.
- User feedback changes future recommendations and is visible in memory/event history.
- Accepted/time-blocked/completed/timer-started suggestions become implicit positive signals for future planning.
- Postponement uses exponential backoff plus revisit triggers such as deadline proximity, weekly review, or user re-engagement.

**Progress**:
- 2026-06-08: Weekly recommendation controls now collect explicit postpone/dismiss/simplify reasons with button choices, persist `reasonCategory` + `revisitAt`, and immediately hide the rejected recommendation visually so the chat does not keep showing work the user just pushed back on.
- 2026-06-08: Broad non-weekly inline recommendation cards now persist accept/timeblock/postpone/dismiss feedback directly to `ai_recommendation_feedback` even without a weekly-plan recommendation object, and the new Later control hides the card immediately with a revisit date.
- 2026-06-08: Guest/localhost inline recommendation feedback now persists to the AI-memory local fallback instead of throwing without auth, so postpone/dismiss reasons can influence later broad answers before Supabase auth or schema availability.
- 2026-06-08: Added a localhost E2E regression proving that saved "Too much" feedback changes the next broad fallback answer into an extra-compact one-card response, even when the bridge formatter returns unusable prose or is unavailable.

---

### TASK-1834: Chat observability for slow or low-quality answers (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: The sidebar currently appears to hang while the bridge thinks. The user needs to see what phase is slow and the app needs debug data to explain latency and quality failures.

**Scope**:
- Show concise live phases: reading tasks, retrieving memory, deciding whether to ask, generating answer, formatting.
- Add timing metadata for each phase and structured fallback reasons.
- Avoid duplicate "Thinking" rows when a more specific phase is running.
- Log enough local/server debug data to diagnose bridge timeout vs memory timeout vs formatting timeout.
- Research validation update: log retrieval source counts, cache hit/miss, and path type without exposing private details in normal prose.
- Research validation update: distinguish clarify-first, generated-with-uncertainty, structured-model, reliability-fallback, and feedback-updated answer paths.
- Research validation update 2: timeline phases should map to the agent loop: Retrieve, score uncertainty, clarify/generate, cite/format, record outcome.

**Acceptance**:
- The activity timeline shows the current phase within one second.
- Weekly planning has bounded timeouts and a safe reliability fallback instead of spinning.
- Debug metadata identifies whether the answer was clarification-first, generated with uncertainty, model-planned, or fallback.
- Slow answers can be attributed to task read, memory retrieval, bridge generation, formatting, or persistence.

**Progress**:
- 2026-06-08: Chat phase activity events now update in place, preserve elapsed timing metadata, and annotate key paths such as clarify-first, structured-model, reliability-fallback, and quality-repair.
- 2026-06-08: Sidebar activity rows show concise elapsed timing so slow phases are visible without dumping debug prose into the answer.
- 2026-06-08: Clarification continuations now add a visible "Answer queued" activity row when the user answers while generation is settling, then mark it as accepted when the queued continuation is sent. This prevents the UI from looking inert after saving a clarification answer.
- 2026-06-08: Clarification cards now expose pending AI-memory write status: normal saved copy says when memory updates are queued for sync, while "Why ask?" debug includes the pending write count. This makes schema-cache/migration fallback visible without adding broad answer prose.
- 2026-06-08: Settings > AI > Memory Health now includes an "AI memory debug" snapshot for the new server-backed memory layer. It shows bounded counts for context entities, parameter beliefs, clarification events, recommendation feedback, pending sync writes, and the latest compact entity/belief/event labels so saved context is inspectable without reading raw database rows.

---

### TASK-1835: Broaden memory-aware chat beyond weekly planning (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: The system should improve all FlowState chat answers over time, not only "plan my week." The assistant should remember user preferences, corrections, recurring project meanings, task-selection hints, and answer-quality feedback.

**Scope**:
- Introduce shared context retrieval for planning, prioritization, task breakdown, next-action, grouping, and reflective coaching intents.
- Add preference memory for concise/detailed mode, question frequency, planning style, and tolerated uncertainty.
- Promote user corrections into memory and suppress previously rejected framings.
- Refresh stale context with confirmation rather than silently reusing it.
- Research validation update: use hybrid retrieval: exact entity key lookup first, structured filters second, semantic/vector recall only when needed.
- Research validation update: add procedural memory for repeated workflows such as weekly planning style, preferred controls, and low-overwhelm defaults.
- Research validation update 2: keep retrieval staged: exact key lookup must be fast enough for clarify-first; semantic/vector recall can be skipped under timeout without creating fake certainty.
- Research validation update 2: add procedural preferences for concise/detailed mode, question tolerance, planning ritual style, and preferred amount of automation.

**Acceptance**:
- The same project/context answer improves later "what should I do", weekly plan, and task breakdown requests.
- User corrections stop repeated wrong framing.
- Stale context prompts are short, button-based, and respect cooldowns.
- Retrieval remains selective: only relevant facts enter the model prompt, never raw memory dumps.
- Cold-start behavior degrades gracefully to neutral candidates or one lightweight preference question.

**Progress**:
- 2026-06-08: Added a deterministic `response_quality` clarification card before high-materiality non-weekly task recommendations so day plans, smart lanes, and prioritization/overwhelm prompts can ask one button-based direction question instead of dumping broad prose.
- 2026-06-08: Response-quality clarification answers now route back into the matching deterministic flow (`day_plan`, `smart_lanes`, or general task recommendation) instead of falling through as vague freeform continuation text.
- 2026-06-08: Broader non-weekly task answers now use the shared uncertainty policy for ask/proceed/neutral decisions instead of a fixed hardcoded ask path. Focused tests cover high-materiality broad recommendations, tiny task sets that proceed with uncertainty, and cold-start neutral candidates.
- 2026-06-08: Clarification messages now suppress the generic tool-result task list while asking. Candidate tasks only appear through explicit "show candidates" style escapes, preventing the old barrage of task cards under a question.
- 2026-06-08: Broad non-weekly memory summaries now retrieve recent recommendation feedback by task/project entity keys, so later broad answers can see postponed/dismissed inline-card signals instead of only weekly plans learning from feedback.
- 2026-06-08: Broad fallback card selection now applies recent recommendation feedback: dismissed/postponed inline cards are filtered out during cooldown, while accepted/timeblocked cards get a small positive boost. Inline task feedback is matched by recommendation ID so one postponed task does not suppress the whole project.
- 2026-06-08: Broad response modes now pass their exact intent into the shared quality gate instead of collapsing to `general`, so prioritization, next-task, overdue-triage, and task-breakdown answers are held to the same groundedness and low-overwhelm contract as weekly/day planning.
- 2026-06-08: Broad task-list memory calls now pass the chat memory timeout into `retrieveBroadAIMemory`, and the retriever itself degrades to a bounded fallback with diagnostics. This keeps "what should I do" / prioritization answers responsive when server memory is slow.
- 2026-06-08: Extracted broad clarification policy into a tested pipeline module. Regression coverage now proves cold-start day/smart/general broad requests ask one concise direction question, recent answered/proceed-with-uncertainty events suppress repeats, stale decisions can refresh, and weekly planning stays on its separate interview path.
- 2026-06-08: Broad clarification cards are now mode-specific: prioritization asks what should decide the priority order, next-task asks what makes one task right now, and overdue triage asks how to treat overdue items. Tests prove these paths no longer ask the generic "what should guide this answer?" question.
- 2026-06-08: Localhost Playwright now proves broad-flow behavior for `prioritize my tasks`, `what should I do next?`, and `show me overdue tasks`: each prompt asks one mode-specific card before recommendations, hides task cards while asking, saves the button answer, leaves no stuck running activity, and does not re-ask the same question on the next prompt.
- 2026-06-08: Extracted broad fallback task ranking into a tested pipeline module so non-weekly fallback answers use the same feedback-aware suppression/boost rules as retrieved memory. The chat path now imports the tested ranker instead of hiding feedback logic inside the composable.
- 2026-06-08: Broad clarification coverage now includes energy fit, dependencies, history, and stakeholders for the modes where those dimensions materially affect output. This lets next-task prompts ask about energy when impact is already known and prioritization prompts move from impact to dependency/momentum questions after the first answer.
- 2026-06-08: Localhost Playwright broad-flow proof now also covers day planning (`I'm overwhelmed, reorder my day`), smart lanes (`Suggest smart lanes for my current tasks`), and broad task breakdown (`break down my tasks into next steps`). These flows ask one clarification card before recommendations, hide task cards while asking, save the answer, avoid re-asking on the next prompt, and leave no stuck running activity.
- 2026-06-08: Broad task breakdown routing is now read-first. Generic requests to break down current tasks load the active task list and use `task_breakdown` response mode instead of firing the `create_subtasks` write action before clarification/confirmation.

---

### TASK-1836: Recommendation feedback and postponement memory (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1833

**Why**: Research validation flagged that plans will keep feeling repetitive unless accept/postpone/dismiss actions become durable learning signals. Postponed work should not reappear every plan unchanged, and accepted work should become evidence of what the user actually follows through on.

**Scope**:
- Add a server-backed `recommendation_feedback` table or equivalent event type.
- Persist action, reason enum, optional free text, revisit date, recommendation/task IDs, and outcome signals.
- Downrank or hide postponed/dismissed suggestions until revisit/cooldown.
- Use accepted/time-blocked/completed/timer-started suggestions as positive follow-through signals.
- Link feedback to generated plan/recommendation IDs when available.
- Aggregate repeated explicit and implicit feedback into durable preference facts.
- Store `implicit_positive` signals from timer start/completion separately from explicit feedback.

**Acceptance**:
- A dismissed recommendation does not immediately reappear as a top suggestion.
- A postponed recommendation respects the revisit date.
- Feedback changes ranking evidence in later weekly/next-action responses.

**Progress**:
- 2026-06-08: Added mounted regression coverage that verifies a postponed weekly recommendation saves `generatedPlanId`, `recommendationId`, task/project entity key, reason category, revisit date, and becomes visually suppressed in the current plan.
- Feedback reason patterns become inspectable preference memory rather than hidden ranking magic.
- 2026-06-08: Broad non-weekly task-answer memory now retrieves recent `ai_recommendation_feedback` by UUID task IDs and text entity keys (`task:*`, `project:*`), so inline accept/postpone/dismiss signals can affect later broad answers even when task IDs are local or synthetic.
- 2026-06-08: Guest/localhost recommendation feedback now uses the same local AI-memory fallback as clarification answers. Local postpone/dismiss feedback is retrievable by task/entity key and derives parameter beliefs such as `energy_fit`, `ranking_focus`, and `task_recommendation_fit` for later suppression/reweighting.
- 2026-06-08: Broad fallback ranking now uses retrieved feedback directly: recent dismiss/postpone events suppress tasks until cooldown/revisit, simplify applies a smaller penalty, and accept/timeblock/implicit-positive events boost follow-through.
- 2026-06-08: Recommendation feedback now promotes conservative durable parameter beliefs after the raw feedback event is saved. Simplify/too-much updates `preference:brevity`, low-energy/too-hard updates `energy_fit`, not-important/wrong-context/needs-more-info updates `rankingFocus`, and accept/timeblock/implicit positives update `history`; rollout tests prove feedback still flushes even if the belief table is unavailable.
- 2026-06-08: Added direct broad fallback ranking regressions for local task IDs: dismissed cards are suppressed during cooldown, postponed cards stay hidden until revisit, inline project feedback does not suppress every task in the project, and accept/timeblock-style feedback boosts later follow-through ranking.
- 2026-06-08: Broad inline recommendation feedback now shows a visible saved/local status after postpone/dismiss-style actions, not only weekly-plan feedback. Localhost E2E proves postponing a broad inline card hides that exact card immediately and suppresses the same task from the next broad fallback answer without asking the same clarification again.
- 2026-06-08: Repeated recommendation feedback now aggregates into durable preference-level beliefs after three matching signals. Too-much feedback strengthens `preference:brevity`, low-energy/too-hard strengthens `preference:energy_fit`, weak-context/not-important feedback strengthens `preference:ranking_focus`, and repeated accept/timeblock signals strengthen `preference:follow_through`; broad and global memory retrieval now fetch those aggregate preference keys so saved learning can influence later chat answers instead of staying as isolated events.

---

### TASK-1837: Memory lifecycle, summarization, and retention policy (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: Research validation flagged memory bloat and stale facts as the biggest architectural gap. Append-only clarification events are useful for auditability, but without summarization and retention the system will get slower, noisier, and harder to trust.

**Scope**:
- Define fact promotion rules: what becomes durable memory vs. event-only evidence.
- Add confidence decay and stale confirmation rules.
- Summarize old events into compact semantic facts while preserving corrections.
- Archive or compact old low-value events after a retention window.
- Re-index summaries for semantic retrieval.
- Use reinforcement count and last reinforced date to slow decay for repeatedly confirmed facts.
- Summarize on schedule or size threshold; only promote high-confidence verified facts.
- Archive old low-value events after a defined window while keeping corrections and source links auditable.

**Acceptance**:
- Memory retrieval stays bounded as event count grows.
- Old facts become stale and ask for confirmation instead of being reused as fresh truth.
- Corrections remain auditable after summarization.
- Stale facts trigger confirmation when accessed for a materially important recommendation.

**Progress**:
- 2026-06-08: Added a central `memoryLifecycle` policy that computes effective confidence with decay/reinforcement, flags explicit stale dates and old confirmations for refresh, detects noisy event history for summarization, and counts year-old events for retention/archive follow-up.
- 2026-06-08: Weekly memory retrieval diagnostics now include lifecycle summary fields (`staleEntityKeys`, `refreshEntityKeys`, `summarizeEntityKeys`, `archiveEventCount`, `lowConfidenceEntityCount`) without injecting raw memory text into normal prompts.
- 2026-06-08: Verified the lifecycle slice with focused lifecycle/retrieval/sidebar tests, the AI regression bundle, `npm run type-check`, and localhost web `npm run build`; Electron packaging remains intentionally deferred for this lane.
- 2026-06-08: Clarification-card debug disclosure now surfaces memory lifecycle pressure (`need refresh`, `need summary`, old events, low confidence) behind "Why ask?" so diagnostics are inspectable without adding normal-response clutter.
- 2026-06-08: Localhost browser smoke on isolated `http://127.0.0.1:5562` loaded the app, dismissed onboarding, opened the AI sidebar, and captured `/tmp/flowstate-ai-debug-smoke-sidebar.png`; this proves the updated chat UI is not blank or blocked, but Stage 8 full prompt-to-answer smoke is still pending.
- 2026-06-08: Broad task-memory retrieval now computes the same lifecycle diagnostics as weekly retrieval. Stale synthetic/project facts, refresh-needed context, noisy summaries, old events, and low-confidence counts are exposed through retrieval diagnostics and a compact `memory lifecycle` evidence line, while the chat activity metadata carries those lifecycle counts for debug disclosure instead of adding normal answer prose.
- 2026-06-08: Broad ask-before-answer now turns refresh-needed lifecycle signals into a first-class stale-context card before broad ranking. The card asks whether the old context is still true, stores the answer against the stale entity key, and fetches recent events for that entity so the same refresh is not asked again immediately. Focused tests prove stale refresh outranks generic broad-ranking questions and recent refresh answers suppress repeats.
- 2026-06-08: Server-backed clarification answers now refresh `ai_context_entities` lifecycle fields directly: answered events update `last_answered_at`, `last_reinforced_at`, increment `reinforcement_count`, reset `decay_score`, and roll `stale_after` forward by 45 days. This makes stale-context confirmations actually fresh in server memory instead of only adding an audit event.

---

### TASK-1838: Hybrid retrieval and latency budget for AI memory (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1835

**Why**: Research validation flagged retrieval latency as a risk. Server memory improves answer quality but can make the sidebar feel slow unless retrieval is exact, selective, cached, and progressively enhanced.

**Scope**:
- Retrieval order: exact entity keys, structured filters, recent events, semantic/vector recall only when needed.
- Add cache keys and short TTLs for active conversation/project memory.
- Track retrieval timings and source counts in debug metadata.
- Limit prompt injection exposure by summarizing retrieved user text as evidence, not instructions.
- Add memory coverage score computation to retrieval output.
- Support optional pgvector/vector_embedding later, but keep exact key lookup as the primary source of truth.

**Acceptance**:
- Clarify-first path appears quickly even when semantic retrieval is skipped or slow.
- Memory retrieval has a clear timeout/fallback that does not produce fake certainty.
- Debug data identifies cache hit/miss and retrieval stage timings.
- Memory retrieval can return "insufficient coverage" as an intentional state instead of forcing generation.

**Progress**:
- 2026-06-08: Extracted weekly memory retrieval into a bounded SQL-first helper. The helper retrieves UUID-only legacy contexts, server context entities, clarification events, recommendation feedback, and graph edges separately so synthetic buckets never enter UUID-only calls. Semantic/vector recall remains pgvector-ready metadata only until the database function is available. Focused tests cover bounded diagnostics, feedback/event counts, synthetic bucket safety, and timeout fallback.
- 2026-06-08: Added `broadMemoryRetrieval` for non-weekly task-list answers. The helper keeps UUID-only legacy calls filtered to real UUIDs, sends synthetic/local entities through text keys (`project:uncategorized`, `task:local-task`), includes safe quoted evidence from parameter beliefs and recent clarification answers, and returns concise retrieval diagnostics for future debug display.
- 2026-06-08: Added `globalChatMemory` for non-task/freeform responses. It exact-fetches workflow/preference entities, recent clarification decisions, and selected parameter beliefs with a 1.5s timeout in the chat pipeline, producing a compact quoted-evidence packet instead of raw memory prose.

---

### TASK-1839: Privacy, RLS, and prompt-injection hardening for AI memory (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1830

**Why**: Research validation flagged privacy and prompt injection risk. User-authored memory can contain private data and arbitrary text, so it must remain tenant-scoped and must not become an instruction channel.

**Scope**:
- Verify RLS for context entities, clarification events, and recommendation feedback.
- Add cross-user access tests for memory tables.
- Sanitize/free-text handling: store raw user text as evidence but inject it into prompts only as quoted data.
- Add export/delete hooks or documented paths for future privacy controls.
- Add prompt-injection regression tests where free text tries to override the system or reveal unrelated memory.
- Keep raw user text out of system-role instructions; inject as quoted evidence with source labels only.

**Acceptance**:
- One user cannot read or write another user's AI memory rows.
- Free-text memory cannot override system rules in prompt construction.
- Memory rows are inspectable and deletable through supported code paths or documented migration follow-up.
- Prompt-injection-like memory text cannot change output policy or cross-entity retrieval boundaries.

**Progress**:
- 2026-06-08: Added quoted/sanitized prompt evidence handling for AI memory and an explicit policy that saved user free text is evidence only, not an instruction channel.
- 2026-06-08: Weekly planning now treats stale project/task context as an uncertainty dimension and asks a short refresh question instead of silently ranking from expired memory.

---

### TASK-1840: Explicit uncertainty scoring and cold-start policy (📋 PLANNED)

**Priority**: P0 | **Status**: 📋 PLANNED (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831

**Why**: Research validation flagged that "uncertainty score" was too vague to implement consistently. The assistant needs a deterministic policy for ask vs. proceed with uncertainty vs. neutral candidates.

**Scope**:
- Compute coverage across impact, energy fit, stakeholders/commitments, dependencies, history, and preferences.
- Compute materiality by intent: weekly planning and prioritization are high materiality; mechanical list/show actions are low materiality.
- Ask one question when coverage is below 0.5 and materiality is high.
- Proceed with visible uncertainty when coverage is 0.5-0.8 or materiality is medium/low.
- For cold-start, show one lightweight question or neutral candidates without ranking claims.

**Acceptance**:
- The same task set consistently chooses ask/proceed/neutral based on coverage and intent.
- Low-context weekly planning does not produce a ranked plan unless the user chooses uncertainty.
- Mechanical actions are not blocked by unnecessary clarification.

**Progress**:
- 2026-06-08: Extracted the ask/proceed/neutral decision rule into a shared uncertainty policy, including high-materiality ask thresholds, medium-coverage proceed-with-uncertainty behavior, and neutral cold-start handling. Focused tests cover high/medium/low materiality, forced missing project/stale context, sufficient context, and cold-start behavior.

---

### TASK-1841: Agent-memory evaluation rubric and citation audit (🔄 IN PROGRESS)

**Priority**: P0 | **Status**: 🔄 IN PROGRESS (filed 2026-06-08) | **Depends on**: TASK-1832

**Why**: Research validation recommended scoring answer quality across groundedness, brevity, uncertainty, learning, user control, realism, and safety. FlowState needs this as an evaluation suite, not subjective review.

**Scope**:
- Add a bad/acceptable/excellent rubric for groundedness, scannability, uncertainty handling, learning/adaptation, user control, realism, and safety.
- Add citation audits proving recommendations reference supplied task/memory evidence or explicitly mark unknown.
- Add LLM-as-judge or scripted checks for filler, unsupported prioritization, repeated questions, and prompt-injection vulnerability.
- Include human-review scenarios for cold-start and conflicting memory.

**Acceptance**:
- Eval fails on fake reasoning even when prose sounds polished.
- Eval fails on broad generic plans that exceed the low-overwhelm contract.
- Eval catches repeated clarification questions inside cooldown.
- Eval fails when structured output fails but the response does not use deterministic fallback.
- Eval fails when low coverage/high materiality produces broad ranking instead of a high-EVPI question or visible uncertainty escape.
- Eval fails when recommendation cards lack feedback controls or learning signals.

**Progress**:
- 2026-06-08: Extended `auditChatResponseQuality()` with executable checks for response path, coverage score, high materiality, structured-output failure, deterministic fallback, repeated post-clarification questions, visible uncertainty, feedback controls, escape hatches, debug disclosure, and learning signals.
- 2026-06-08: Added a structured recommendation citation audit. Recommendations now fail quality checks when they cite only task metadata or project names as context, pass when they explicitly mark project/context evidence unknown, and score excellent only when task evidence is paired with real success/stakes/why/dependency context.
- 2026-06-08: Wired the structured citation audit into weekly-plan validation and weekly quality scoring. A model weekly plan can no longer satisfy "project understanding" by citing a grounded project label; it must cite real project/task context or explicitly mark context unknown.
- 2026-06-08: Added a regression for the realistic cache-first weekly-planning case where task notes/subtasks exist but project meaning is still unknown. The clarification policy now treats project meaning and stale context as forced missing dimensions in EVPI scoring, so a project-understanding question beats a broader week-priority question when project meaning is the blocker.
- 2026-06-08: Added mode-specific chat-quality regressions for prioritization, next-task, and overdue-triage outputs. These tests prevent polished but fake broad answers from bypassing the audit just because they are not weekly/day-plan response modes.
- 2026-06-08: Broad post-clarification quality gates now check the actual selected/free-text clarification value, not just generic "your clarification" wording. Answers that claim to honor a clarification but omit the user's chosen value fail with `clarification_value_not_reflected`; paraphrased free-text answers pass when they preserve meaningful terms.

---

### TASK-1842: Localhost end-to-end QA lane for AI chat quality (📋 PLANNED)

**Priority**: P0 | **Status**: 📋 PLANNED (filed 2026-06-08) | **Depends on**: TASK-1830, TASK-1831, TASK-1832, TASK-1833, TASK-1838

**Why**: The user should not be asked to test half-built behavior. Localhost must prove the full chat loop before Electron or user validation: context retrieval, one-question clarification, saved answer continuation, concise output, feedback controls, and slow-phase debug.

**Scope**:
- Run the localhost app and test the chat in browser against the real UI, not only unit tests.
- Verify the weekly plan path asks before broad output when context is missing.
- Verify answering a clarification persists locally/server-side when schema exists or continues with quoted answer fallback when schema is missing.
- Verify the assistant does not dump long generic plan prose unless the user chooses "continue with uncertainty."
- Verify feedback controls suppress/postpone recommendations and show concise state changes.
- Capture debug evidence for retrieval, clarification, generation, and persistence phases.

**Acceptance**:
- Browser test evidence shows the user-visible behavior changed.
- No active test case leaves the sidebar stuck after a clarification answer.
- No generic plan dump appears before the clarification gate is satisfied or bypassed explicitly.
- Known missing pieces are listed as lane tasks, not handed to the user as "please test."

**Progress**:
- 2026-06-08: Localhost smoke against `http://127.0.0.1:5546` seeded ambiguous tasks, sent "what should I do next?", verified exactly one clarification card, no recommendation cards/long-plan markers before answering, a second follow-up after a button-only answer, enabled input, and no stuck running activity. Screenshot evidence: `/tmp/flowstate-ai-chat-quality-smoke-pass.png`.
- 2026-06-08: Added repeatable guest-mode Playwright smoke `tests/e2e/ai-chat-quality-local.spec.ts` plus dedicated localhost config `tests/e2e/playwright.ai-chat-quality-local.config.ts`. The smoke seeds the real `FlowStateReadCache` IndexedDB layer used by the current cache-first app boot, opens the real AI sidebar, sends "Help me plan this week from my tasks", verifies exactly one clarification before any weekly plan/inline cards/candidate-card barrage, answers one clarification, verifies no follow-up gate appears, verifies no running activity row remains, verifies the input is enabled, and captures `/tmp/flowstate-ai-chat-quality-stage8.png`.
- 2026-06-08: Extended the localhost smoke to cover the post-clarification plan and feedback loop. After the user answers the clarification ladder, structured-model failure now falls back to a compact deterministic quick draft instead of the empty "not reliable enough" plan, no second "quick question before ranking" appears, repeated unknown-stakes wording is suppressed, the "Why ask?" debug disclosure exposes coverage/retrieval/EVPI details, postponing a recommendation opens reason/revisit controls, saving feedback hides the recommendation immediately even in guest mode, and no running activity row remains.
- 2026-06-08: Re-ran the localhost smoke after fixing the project-meaning clarification gap. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` passed on localhost: the flow loaded seeded cache-first tasks, asked before broad weekly output, continued after saved answers, showed compact recommendation cards, saved postpone feedback, hid the postponed card, and left zero running activity rows.
- 2026-06-08: Extended and re-ran `tests/e2e/ai-chat-quality-local.spec.ts` for broad non-weekly prompts. The localhost browser proof now covers weekly planning plus prioritization, next-task, and overdue-triage one-card clarification loops with no pre-answer recommendation barrage and guest-mode no-repeat memory.
- 2026-06-08: Extended and re-ran the localhost browser proof for day-plan, smart-lane, and broad task-breakdown prompts. `npx playwright test --config tests/e2e/playwright.ai-chat-quality-local.config.ts` now covers 8 prompt paths and passes with no pre-answer recommendation barrage, no repeated clarification after the saved answer, and no stuck activity row.
- 2026-06-08: Extended and re-ran the localhost browser proof for broad feedback suppression. The suite now covers 9 prompt/feedback paths, including broad postpone feedback that visibly saves, hides the exact card immediately, and prevents the same task from reappearing in the next broad answer.

---

### TASK-1843: Electron packaging and updater gate after localhost stabilization (⏸ DEFERRED)

**Priority**: P1 | **Status**: ⏸ DEFERRED (filed 2026-06-08) | **Depends on**: TASK-1842

**Why**: The user explicitly paused Electron work for this flow. Electron packaging and updater verification should happen only after localhost proves the behavior is correct.

**Scope**:
- Re-enable Electron build only after localhost AI chat QA passes.
- Run desktop-specific UI checks for the sidebar and updater delivery.
- Build Electron, verify update artifacts, then deploy only when explicitly re-enabled.

**Acceptance**:
- `npm run electron:build` is not used as proof for this lane until localhost is stable.
- Electron updater work resumes only when the user asks to move from localhost to desktop delivery.

---

### TASK-1828: Apply AI context memory migration and validate live chat learning (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (filed 2026-06-07)

**Why**: The project/task understanding memory layer is implemented in code, but production still needs the Supabase migration applied and a live chat pass confirming that button answers persist, are recalled, and change future planning evidence.

**Scope**:
- Apply `supabase/migrations/20260607190000_ai_context_memory.sql` to the live Supabase project.
- In Electron, answer one project-understanding clarification card and verify `project_contexts` plus `memory_events` rows are created.
- Ask for a weekly plan again and verify recommendations cite `projectContext`/`taskContext` or explicitly mark `missingContext`.

---

### TASK-1829: Apply AI clarification memory migration after UI wiring (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED (filed 2026-06-08)

**Why**: `supabase/migrations/20260608090000_ai_clarification_memory.sql` adds a general clarification-memory schema, but the current app still uses the earlier project/task context tables. Keep the additive migration preserved in git, then apply it only when the UI/service path writes and reads these records.

**Scope**:
- Wire the clarification answer flow to `ai_context_entities` and `ai_clarification_events`, or remove the migration before release if the older `project_contexts`/`task_contexts` schema remains the chosen path.
- Apply the migration to production only after the code path is live-ready.
- Validate RLS with one user-owned answer and one rejected cross-user access attempt.

---

### ~~TASK-1815~~: Flagship flow — "Overwhelmed → AI reorders my day" (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.93 deployed) | **Depends on**: TASK-1814 (AI chat now intelligent)

**Why**: The original primary ask. When the user feels overwhelmed, the AI should propose a concrete reordered plan for the day — not just list tasks. TASK-1814 made the chat reason well + render grouped prioritization cards; this turns that reasoning into an *actionable reorder* (sequence + time-blocks the user can accept/apply).

**Scope**:
- An "I'm overwhelmed" entry point (button + natural-language trigger) that runs the prioritization brain and returns a sequenced day plan.
- Reuse the grouped-cards rendering (`cardGroups` metadata, `cardsBlock.ts`) — each group becomes a block of the day, ordered, with the stake reason.
- "Apply this order" action: write the proposed order back (respect canvas geometry invariants — only via the proper task-order write path, never sync).
- Honest fallback when capacity says "don't do all of it" (the model already surfaces this — make it actionable: defer/snooze the rest).

**Context**: Builds directly on `useAIChat.ts` deterministic + ReAct paths, `buildRichTaskData`, and the holistic prompt. Measure with `tests/manual/ai-prioritization-eval.mjs`. See skill `flowstate-ai-chat`.

**Shipped**: Explicit overwhelm/reorder prompts now route to a deterministic day-plan mode (`list_tasks` with rich task context), instruct the bridge brain to emit ordered focus blocks via `cards kind=day_plan`, and render an **Apply this order** action on grouped AI cards. Applying the plan uses the existing undo-aware bulk task update path to set selected tasks for today and stack them at the top of the Today canvas group, preserving existing Today tasks after the AI-ordered sequence. Regression coverage: `ai-day-plan.test.ts`, `ai-intent-day-plan.test.ts`, `ai-cards-block.test.ts`, plus an e2e spec for the stubbed bridge day-plan UI path. Local e2e run was blocked by invalid local Supabase service-role JWT; direct Vite/browser smoke mounted the AI route.

---

### ~~TASK-1816~~: Flagship flow — Smart task lanes (AI suggests lanes + breaks big tasks into them) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.94 deployed) | **Depends on**: TASK-1814, TASK-1812 (add-tasks-to-lane shipped)

**Why**: The second original ask. When creating a task lane, the AI should (a) suggest strong lanes for the user's work, and (b) break a large task down into actionable sub-tasks placed into that lane.

**Scope**:
- "Suggest lanes" — AI proposes lane names/themes from the user's actual tasks + work patterns (reuse rich-data context).
- "Break this down into the lane" — given a large task, emit a structured breakdown (reuse the `useAITaskAssist` `breakDownTask` JSON contract, already tested) and create the sub-tasks into the chosen lane via TASK-1812's add-to-lane path.
- Structured output + index-referenced items like the cards block, so results render as reviewable items before commit.

**Context**: Combine `useAITaskAssist` (breakdown JSON parsing, 7 unit tests) + TASK-1812 lane plumbing + the bridge. Reuse `cardsBlock.ts` structured-output pattern. Est. below.

**Shipped**: Explicit lane/smart-lane prompts now route to a deterministic `smart_lanes` mode (`list_tasks` with rich task context). The bridge formatter emits `cards kind=smart_lanes` with existing task refs plus optional `newTasks` for child-task breakdowns. AI chat renders reviewable lane cards with an **Apply lanes** action. Applying creates lanes via the existing lane store, assigns referenced existing tasks through undo-aware bulk updates, and creates suggested child tasks in the new lane through `createTaskWithUndo`. Regression coverage: `ai-intent-smart-lanes.test.ts`, `ai-cards-block.test.ts`, plus an e2e stub for the smart-lanes UI path. Local authenticated Playwright remains blocked by local Supabase service-role configuration; direct Vite/browser smoke mounted the AI route.

---

### ~~TASK-1822~~: Claude↔Codex failover brain for the AI chat (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, v1.4.106) | **Depends on**: TASK-1814

**Why**: The subscription brain ran a single fixed CLI (Claude OR Codex by setting) with no automatic failover — if it errored or ran out of credits, the chat hard-failed (or fell to weak Groq/Ollama). User wants the two CLI brains to be a failover chain, no Groq/Ollama.

**Shipped**: Internal failover in `bridgeProvider.ts` — `generate()`/`generateStream()` try the preferred brain (`aiBrain`), then fail over to the other on `BridgeUnavailableError` thrown before any token (auth/429/502/no-credits); never switches mid-stream. `routerFactory.ts`: when the subscription is on, the chain is the bridge only (Claude+Codex) — dropped Groq/Ollama (OpenRouter possible future tail). Low blast radius (no `RouterProviderType`/`isBridgeActive`/cards-gating changes). 6 failover unit tests (`tests/unit/bridge-failover.test.ts`, mocked brains).

---

### ~~TASK-1823~~: Project-local Superpowers skills trial (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: Trial the useful parts of `obra/superpowers` inside FlowState without letting its always-on workflow override this repo's existing MASTER_PLAN, OMX, autonomy, Electron release, and push rules.

**Scope**:
- Add only namespaced, project-local Superpowers support skills for debugging, TDD, verification, and code review.
- Do not install the intrusive always-on `using-superpowers` workflow or branch-completion/worktree flows in v1.
- Keep the install limited to `.claude/skills` plus the local skill registry; no app runtime files, Codex global install, Electron build, or deploy.

**Shipped**: Added namespaced project-local Superpowers support skills under `.claude/skills/superpowers-*` for systematic debugging, TDD, verification, requesting/receiving code review, and writing plans. Registered them in `.claude/config/skills.json` with explicit `superpowers-*` triggers and documented in `CLAUDE.md` that they are support-only and do not override FlowState/OMX/Master Plan/Electron rules. Intentionally omitted the always-on `using-superpowers`, worktree, and branch-finishing flows.

---

### ~~TASK-1824~~: Ground weekly planner recommendations and AI chat sync state (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, Electron v1.4.138 deployed) | **Depends on**: TASK-1814

**Why**: Weekly planning still treated small home errands and substantial work too similarly, could miss subtask evidence, and produced weak follow-up questions. AI chat sync also had a resurrection path where locally cached conversations could be uploaded again after remote deletion or when Supabase already had real history.

**Shipped**: Weekly planner snapshots now include subtasks, domain classification, substantial-work scoring, quick-errand scoring, weekend deferrals, and option-based follow-up questions. Quick drafts prefer meaningful work commitments over small errands, cite open subtasks as evidence, and propose next actions from the first open subtask when available. AI chat conversation merge now stores sync metadata, remembers remote-known/deleted conversation IDs, suppresses welcome-only local ghosts when real remote history exists, and avoids re-uploading conversations already known to be deleted remotely. Project labels now stay visible across task surfaces. Regression coverage: weekly planner/sidebar tests, AI chat sync resurrection tests, task project row tests, and undo entrypoint contract coverage.

---

### ~~TASK-1825~~: FlowState-safe Superpowers auto-router trial (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: Make the project-local Superpowers trial activate more naturally without installing the upstream always-on `using-superpowers` behavior that can conflict with FlowState autonomy, MASTER_PLAN tracking, OMX routing, and Electron shipping rules.

**Shipped**: Added `.claude/skills/superpowers-flowstate-auto-router/SKILL.md` as a FlowState-safe routing layer for bugs, behavior changes, reviews, planning, and completion checks. Registered broad-but-subordinate triggers in `.claude/config/skills.json` and documented the auto-routing trial in `CLAUDE.md`. The router explicitly preserves FlowState authority and routes to the existing namespaced `superpowers-*` support skills instead of upstream always-on Superpowers.

---

### ~~TASK-1826~~: Surface Superpowers auto-router to Codex instances (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-07)

**Why**: The FlowState-safe Superpowers router was documented in `CLAUDE.md`, but new Codex/AGENTS-driven instances primarily receive `AGENTS.md`, so they would not reliably know to use it.

**Shipped**: Added a project-local Superpowers auto-router section to `AGENTS.md` that points agents at `.claude/skills/superpowers-flowstate-auto-router/SKILL.md`, lists the task shapes where it should be used, and keeps FlowState rules authoritative over Superpowers.

---

### ~~TASK-1836~~: Add Codex-discoverable Superpowers wrappers (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-06-08)

**Why**: Other Codex instances still did not reliably use Superpowers because the canonical project skills lived only under `.claude/skills`, which is not a Codex skill-discovery surface.

**Shipped**: Added `.codex/skills/superpowers-*` wrapper skills that point to the canonical `.claude/skills/superpowers-*` project skills, and strengthened `AGENTS.md` so Codex/AGENTS-driven instances MUST use `superpowers-flowstate-auto-router` for bugs, fixes, behavior changes, reviews, planning, and completion checks unless the request is trivial or another higher-priority workflow clearly applies.

---

### ~~BUG-1821~~: "Plan my week" misrouted to the completed-tasks summary (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, v1.4.105) | **Depends on**: BUG-1820

**Why**: "תעזור לי לתכנן את השבוע" (plan ahead) returned a retrospective list of already-completed tasks. The greedy bare `'השבוע'` keyword (`toolHints.ts`) matched the planning phrase and routed it to `get_weekly_summary`. Also a "no focus time in the data" prose leak.

**Shipped**: Predicate/tense decides intent, not the time word. Added `isWeekPlanRequest` + `normalizeForRouting` (Hebrew niqqud/particle tolerant) in `dayPlan.ts`; removed the greedy bare `'this week'`/`'weekly'`/`'השבוע'` triggers; added a forward `week_plan` card mode (`intentRouter`/`cardsBlock`/`useAIChat`). Ambiguous phrasing now falls to the model (rides the TASK-1822 failover chain) instead of guessing. Fixed the `weekly_review` focus-time prose leak. Red→green routing matrix + `isWeekPlanRequest` truth table (`deterministic-pipeline.test.ts`, `week-plan-request.test.ts`).

---

### ~~BUG-1820~~: Weekly AI summary fabricated tasks instead of showing real cards (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07) | **Depends on**: TASK-1814

**Why**: The weekly summary ("סיכום שבועי") named tasks in prose but showed no clickable cards, and the count/task-names/categories/insights were all LLM-fabricated. Root cause: `get_weekly_summary` returned only 3 integers (a stats object), so the card pipeline's `hasTaskList` gate never fired and `parseCardGroups` had no task array to index; the model only saw a count + ≤10 generic titles, so it invented the rest. Tool descriptions over-promised "focus time/streak/XP" (priming hallucination) and downstream code read phantom `totalFocusMinutes`/`currentStreak` never populated.

**Fixed**: `get_weekly_summary` now returns the real array of completed-this-week tasks (`{id,title,priority,projectId,status,completedAt}`) + real focus minutes from non-break timer sessions (omitted, never faked, when none) — so `hasTaskList` engages and the tasks render as real clickable cards. Added `responseMode:'weekly_review'` (both router return points) + a weekly cards instruction in `useAIChat` that groups completed tasks by project and forbids inventing numbers/names/categories/insights (ungrounded trends/recommendations dropped per decision). `ChatMessage` renders `kind:'weekly_review'` cards read-only (done badge, no done/timer actions, still clickable). `cardsBlock` whitelists the new kind; `useAgentChains` end-of-day review + non-bridge `preDigestedReasoning` digest adapted to the array shape; over-promising tool descriptions trimmed. Coverage: weekly-review parse test + grounded weekly-digest test (ai-cards-block + ai-pipeline green; full vue-tsc clean on all touched files).

**Files**: `src/services/ai/tools.ts`, `src/services/ai/pipeline/intentRouter.ts`, `src/composables/useAIChat.ts`, `src/components/ai/ChatMessage.vue`, `src/composables/useAgentChains.ts`, `src/services/ai/pipeline/preDigestedReasoning.ts`, `src/services/ai/pipeline/cardsBlock.ts`, tests.

---

### ~~TASK-1817~~: Ship the AI chat improvements beyond localhost (web + Electron) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.92 deployed) | **Depends on**: TASK-1814

**Why**: All TASK-1814 work is committed + verified on localhost dev only. Per project rules 6/7, a production push must ship BOTH web (VITE_SITE_URL) and an Electron auto-updater build in the same release. Desktop users are otherwise left on the old dumb AI.

**Shipped**: Safely replayed the TASK-1814 AI stack onto fresh `origin/master` to avoid reverting already-live v1.4.89-v1.4.91 work, bumped to `1.4.92`, built Electron, deployed via `./scripts/deploy-electron-update.sh --notes "TASK-1814: intelligent AI chat + grouped cards"`, and verified `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.92`. Bridge server on the VPS is unchanged (client-only changes) — no bridge redeploy needed.

---

### ~~TASK-1818~~: AI cards polish — suppress mid-stream JSON flash + pin common phrasings to deterministic (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.95 deployed) | **Depends on**: TASK-1814

**Why**: Two known soft spots from TASK-1814 review. (1) During streaming, the `cards` JSON block briefly shows as raw text before it's stripped on completion (cosmetic). (2) Freeform phrasings (e.g. "מה המשימות הכי דחופות", "help me prioritize", "i'm overwhelmed") route to ReAct, where cards are reliable-but-not-100%; common prioritization phrasings should be pinned to the deterministic path (100% reliable) + added to the regression suite.

**Scope**: Strip `stripCardsBlock` from the streaming display path (not just finalize). Broaden `toolHints.ts` keyword coverage (Hebrew plural "דחופות", "המשימות הכי", "help me prioritize", "overwhelmed", "מה חשוב עכשיו") → `get_overdue_tasks`. Add an e2e asserting no JSON ever appears mid-stream.

**Shipped**: ReAct streaming now keeps raw model output for parsing but displays a `stripStreamingCardsBlock`-sanitized copy on every chunk, including split code-fence prefixes like ` ```ca`, so `cards` JSON cannot flash before final parsing attaches grouped cards. Common prioritization/overwhelm phrasings in English and Hebrew now pin to `get_overdue_tasks` through `toolHints.ts`. Regression coverage: `ai-cards-block.test.ts` for streaming partial fences, `ai-pipeline.test.ts` for deterministic hint routing, and an authenticated Playwright spec with a delayed bridge `ReadableStream` asserting no `cards` JSON appears while the answer is still streaming. Local Playwright remains blocked before test execution by missing `SUPABASE_SERVICE_ROLE_KEY`; unit/type/build gates pass.

---

### ~~TASK-1819~~: AI chat message language override (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.96 deployed) | **Depends on**: TASK-1814

**Why**: The AI chat header already lets the user control text direction, but mixed Hebrew/English work still tied assistant replies to detected input language. Users need a separate setting for the assistant's message language so replies can be forced to English or Hebrew without changing layout direction or app language.

**Scope**: Add a **Message Language** selector in the AI chat settings header with Auto, English, and Hebrew. Persist the choice in AI chat settings. Apply it only to assistant output language in deterministic and ReAct chat paths; keep intent detection based on the user's actual prompt.

**Shipped**: AI chat settings now include a persisted Message Language control. Auto keeps the previous detected-language behavior; English and Hebrew force assistant replies in that language across deterministic tool responses, bridge/ReAct prompts, confirmations, cancellations, and selected-task helpers. Regression coverage: pure language resolution/mismatch tests, AI chat store persistence tests, AIChatPanel selector interaction test, full unit suite, typecheck, import validation, CSS validation, and Electron build.

### ~~TASK-1821~~: Fix canvas group collapse silently no-opping on Electron (settling-guard race) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07) | **Depends on**: BUG-1813

**Why**: Canvas group collapse/expand was unreliable on the Electron desktop app while passing the existing local test. Child-task hiding only recomputes inside `syncStoreToCanvas`. The orchestrator collapse-signature watcher re-synced via `batchedSyncNodes()` **without `force`**, so `syncNodes()` dropped it whenever the canvas was inside the drag-settling / remote-update guard window (`canAcceptRemoteUpdate=false`), and it also early-returned on `persistence.isSyncing`. Because it's a signature watcher, a dropped fire never recovers — children stay visible until the next toggle. Electron realtime storms (BUG-1799) keep that guard closed far more often than a quiet browser, so the existing test (realtime off, guard always open) never reproduced it.

**Shipped**: Collapse watcher in `useCanvasOrchestrator.ts` now calls `batchedSyncNodes(undefined, { force: true })` (collapse is user-initiated, mirroring the other forced syncs) and no longer early-returns on `isSyncing`/`isSyncingFromWatcher` (read-only sync can't re-trigger the collapse signature, so there's no loop to guard). Added a DEV/test-only `window.__canvasOpState` seam in `useCanvasOperationState.ts` so e2e can drive the real state machine into drag-settling. New regression test `tests/e2e/canvas-collapse-local.spec.ts` → "group collapse hides children during the drag-settling guard window (TASK-1821)" collapses inside the guarded window; it fails without the fix and passes with it. Verified: collapse e2e (2 passed), 185 canvas/geometry unit tests pass. **Not yet deployed** — needs version bump + `deploy-electron-update.sh` per rules 6/7.

---

### ~~TASK-1820~~: Make desktop AI sidebar-first with visible live action feedback (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-07, Electron v1.4.103 deployed) | **Depends on**: TASK-1814

**Why**: Desktop AI had two competing surfaces: a standalone `/ai` section and the global right-side assistant panel. The assistant should feel like an always-available sidebar tool, and users need to see what it is doing when it reads tasks or performs actions.

**Shipped**: Removed the desktop `/ai` header tab, kept the sparkles button as the primary desktop entrypoint, preserved mobile `/mobile-ai-chat`, and changed `/ai` into a compatibility fallback that opens the sidebar then returns to the main workspace. Added a compact live Activity timeline in `AIChatPanel` backed by real AI tool execution state: thinking, read/write/destructive execution, confirmation waiting, success/failure, cancellation, and undo availability. Added an explicit `New Chat` control in the sidebar header so a fresh thread is discoverable without opening history or using the destructive clear-chat icon. Follow-up v1.4.98 adds canvas visual grounding: AI tool results now carry affected task IDs, timeline rows can reveal linked tasks, and canvas cards receive subtle read/pending/changed/removed spotlight states without transform-based motion. Follow-up v1.4.99 hides raw tool-result task cards while the assistant is still thinking, adds a deterministic formatter timeout/fallback so task answers do not spin indefinitely, and tightens card-answer prose to a clear "start with X, then Y" recommendation. Regression coverage: `tests/unit/ai-sidebar-first.test.ts` covers desktop nav removal, mobile route preservation, `/ai` fallback wiring, activity state semantics, rendered timeline rows, visible New Chat conversation creation, activity reveal events, transform-free canvas spotlight wiring, no pre-answer task-card flash, and formatter timeout fallback wiring. Verified: focused Vitest, `vue-tsc`, Playwright browser smoke, Electron build, live updater manifest/artifacts.

---

> **Last Updated**: 2026-06-06
> **Token Target**: <25,000 (condensed from ~50,000)
> **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md`

---

## Active Tasks

### ~~TASK-1814~~: Subscription-powered AI brain (Claude/Codex CLI bridge) + overwhelm-reorder & smart-lanes flows (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-06-06, Electron v1.4.95 deployed)

**Progress (2026-06-06):** Bridge live + both brains work. Fixed the core "strong model = weak answers" trap — the pipeline was pre-digesting tasks into "X days overdue" lines (LLM reduced to a formatter). Now feeds FULL task content + skips the pre-computed directive + prompts holistically (group/dependencies/trend). Eval harness shows **1.3→4.9/5**. Built grouped prioritization **cards** (model emits a `cards` JSON block → parsed → interactive cards with per-task reasons; raw-JSON-leak bug fixed + regression tests). Made the **ReAct/freeform path** intelligent too so no phrasing bypasses it. Prose tightened to 1-2 sentences. Added skills: cross-project `llm-feature-quality` + project `flowstate-ai-chat`. Deployed Electron v1.4.92 beyond localhost; TASK-1815 overwhelm-reorder shipped in Electron v1.4.93; TASK-1816 smart-lanes shipped in Electron v1.4.94; TASK-1818 streaming/card polish shipped in Electron v1.4.95. Full local Vitest gate: 2408 tests green.

**Why**: Current in-app AI is "not usable" — verified by running the exact app prompts (`useAITaskAssist`) on the default model (Ollama llama3.2 3B) against real tasks: English breakdown returned prose not JSON (→ "could not be parsed" error), Hebrew breakdown returned nonsense words in a medical-prep task, smart-suggest gave "15 min to plan a weekend trip, confidence 1.0". Three root causes: weak brain, shallow prompts (title-only, no workload context), and the requested "overwhelmed → reorder my day" flow does not exist at all.

**Approach**: Add a subscription-based brain via a tiny auth-gated **AI bridge** on the VPS that wraps the local `claude` / `codex` CLIs (no per-token API billing). Claude and Codex are equal, switchable per AI action. New router provider `'bridge'`, auto-selected when reachable, transparent **Groq-free fallback** when a brain's token is dead so AI never hard-fails. Then deepen prompts + build the two flagship flows.

**Architecture (decided + verified)**:
- VPS has `claude` 2.1.111 + `codex` 0.133 installed; 16GB RAM free.
- Claude re-authed via `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` stored root-only at `/root/.flowstate-ai-bridge.env` (verified: `claude -p` → OK).
- Codex existing `~/.codex/auth.json` still valid (verified: `codex exec` → OK, model gpt-5.5). No re-login needed.
- Bridge auth: Supabase HS256 JWT, CORS-locked to app origin, per-user rate limit, binds 127.0.0.1 behind Caddy `/ai-bridge`.

**Progress (2026-06-04) — Phase 1 COMPLETE (deployed, untested end-to-end)**:
- Bridge server `infra/ai-bridge/server.mjs` (zero-dep Node): HS256 *or* Supabase `/auth/v1/user` token validation, multi-origin CORS (prod same-origin + localhost dev + Electron `null`), per-user rate limit, Groq-fallback on dead brain. Local-tested with stub brain (no quota): health/routing/400/401/rate-limit all pass.
- **Deployed to VPS**: systemd `ai-bridge.service` active, env at `/root/.flowstate-ai-bridge.env`, Caddy route `in-theflow.com/ai-bridge/*` → `127.0.0.1:8788` (validated + reloaded). Public verified: `/ai-bridge/health` → both brains; unauth `/v1/chat` → 401; CORS echo for localhost + null confirmed.
- **App wired**: `bridgeClient.ts` + `bridgeProvider.ts`, `'bridge'` added to `AIProviderType`/`RouterProviderType`, router creates+prefers bridge (incl. complex-tier), settings `aiUseSubscription`/`aiBrain` + Settings UI brain-selector (Claude default, Codex switchable). vue-tsc clean on touched files; full unit suite **2348 pass**.
- **NOT yet verified**: a real authenticated `claude -p`/`codex exec --json` round-trip through the bridge (avoided burning subscription quota — validates on first in-app use; codex JSON parser is tolerant + has plain-text fallback).
- **Pending**: user end-to-end test → web+Electron deploy (version bump per rules 6/7) → Phase 2 overwhelm-reorder → Phase 3 smart-lanes. Work is uncommitted (current branch unrelated; needs its own branch off master).

**Files**: new `infra/ai-bridge/{server.mjs,ai-bridge.service,README.md}`, new `src/services/ai/proxy/bridgeClient.ts`, new `src/services/ai/providers/bridgeProvider.ts`, `src/services/ai/types.ts`, `src/services/ai/router.ts`, `src/services/ai/routerFactory.ts`, `src/stores/settings.ts`, `src/components/settings/tabs/AISettingsTab.vue`; VPS `/etc/caddy/Caddyfile` (ai-bridge route).

---

### ~~TASK-1809~~: Hold F2 + drag to reorder tasks within a canvas column (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-06-04, v1.4.89)

Hold **F2** while dragging a task inside a day/smart column → the column restacks (insert-and-shift): the dropped card takes the slot its drop-Y lands in, the rest shift down. Plain drops keep free placement. F2 chosen because Shift/Control/Meta disable node dragging and Alt is grabbed by KDE's window-move gesture.

Reuses `computeCanonicalLayout` scoped to one group (`useTidyLayout.reorderColumn`/`planReorderColumn`). **Instant paint (TASK-1809b):** `reorderColumn` is split into a synchronous plan+group-geometry+moves part and a deferred `commit()`; the `CanvasView` wrapper paints via `applyCanonicalMoves` in the drop frame, then `await`s the drag save and calls `commit()` so reorder writes win last-write-wins. Same-column path detected via `getDeepestContainingGroup`; cross-group falls back to await-then-reorder. Shipped on top of the 1.4.88 group-collapse line as 1.4.89 (web + electron). Tests: `tidy-layout.test.ts` (reorderColumn split) + `canonical-layout.test.ts` (insert-shift).

### ~~BUG-1813~~: Canvas group collapse (minimize) does nothing (✅ DONE)

**Priority**: P1 | **Status**: ✅ **DONE** (2026-06-04)

**Problem**: Clicking a canvas group's collapse chevron didn't minimize the group (reported on Electron). The store toggled `isCollapsed`, but the group never visually collapsed and contained tasks stayed visible.

**Root cause (two layers)**: (1) `GroupNodeSimple.vue` read `props.data.isCollapsed`, but `useCanvasSync` writes the node field as `collapsed` — so the read was always `false`. (2) Deeper: `updateGroup` never bumps `syncTrigger` and the orchestrator only re-syncs groups on `groups.length` change, so a collapse never refreshed node data at all — and nothing ever hid the child task/group nodes (only `done` tasks were hidden). Platform-agnostic; not Electron-specific.

**Fix**: (a) `GroupNodeSimple` now reads collapse state reactively from the store group (same approach as `groupColor`/BUG-225), so the header reacts immediately. (b) `useCanvasOrchestrator` watches a per-group collapse signature and re-syncs on change. (c) `useCanvasSync` hides task nodes and nested child-group nodes whose parent/ancestor group is collapsed (`isUnderCollapsedAncestor`).

**Verified visually**: `tests/e2e/canvas-collapse-local.spec.ts` drives the chevron and asserts collapse (header dashed + body hidden + child task hidden) and expand (restored), with before/after screenshots. Typecheck clean; 154 canvas unit tests pass.

**Files**: `src/components/canvas/GroupNodeSimple.vue`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasSync.ts`, `tests/e2e/canvas-collapse-local.spec.ts`, `tests/e2e/playwright.collapse-local.config.ts`.

---

### ~~TASK-1812~~: Lanes — sprint-style cross-project goals for tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-06-04) — shipped to production (prod Supabase migrated + verified; Electron v1.4.84 deployed, `latest-linux.yml` live)

**Goal**: Add a new first-class **Lane** entity — a sprint-like path toward a goal that pulls in tasks from *different* projects. A task belongs to at most one lane (nullable `laneId` FK, not a join table). v1 is a named bucket + view: `Lane = { id, name, color }` (no dates/progress/lifecycle yet). Lane is orthogonal to project (a task keeps its single `projectId`).

**Approach**: `Lane` mirrors `Project` through the whole stack (type → mapper → DB module → store → sync queue → realtime → UI). Lane is **pure metadata** — never touches canvas geometry (`canvasPosition`/`parentId`/`position_version`); rides the normal task-update sync path and plain `updated_at` LWW (not the position-version path). Highest risk: `lane_id` must round-trip in both `toSupabaseTask`/`fromSupabaseTask` or realtime echo nulls it every save (same class as the documented `parentId` bug, `supabaseMappers.ts:532-539`).

**Files**: `src/types/tasks.ts`, `src/types/sync.ts`, `src/utils/supabaseMappers.ts`, new `src/composables/supabase/useLanesDatabase.ts`, `src/composables/supabase/index.ts`, `src/composables/supabase/_tombstone.ts`, `src/composables/sync/useSyncOrchestrator.ts`, `src/composables/supabase/useRealtimeSubscription.ts`, `src/composables/app/useAppInitialization.ts`, new `src/stores/lanes.ts`, `src/views/AllTasksView.vue`, new `src/views/LaneView.vue`, new `src/components/sidebar/SidebarLanesSection.vue`, `src/layouts/AppSidebar.vue`, `src/router/index.ts`, `src/components/tasks/edit/TaskEditMetadata.vue`, new `supabase/migrations/20260603000000_lanes.sql`. Plan: `~/.claude/plans/check-work-lanes-in-wiggly-dragonfly.md`.

**Progress (2026-06-03)**: Implementation complete + verified locally. ✅ vue-tsc clean, ✅ full unit suite 2342 pass (incl. 6 new lane mapper round-trip tests proving the realtime-echo safety), ✅ contract tests updated (lanes table + lane_id column), ✅ `npm run build` succeeds, ✅ migration applied to LOCAL DB (table + RLS + `lane_id` FK `ON DELETE SET NULL` + realtime publication verified), ✅ E2E `tests/e2e/lanes.spec.ts` 4/4 pass (chromium+webkit): cross-project lane view, group-by-lane, sidebar create→route. **Pending (needs user approval — NOT done):** (1) apply migration to PRODUCTION Supabase, (2) deploy web + Electron build.

### TASK-1811: Group header button — apply group due date / properties to its tasks (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-06-01)

**Goal**: Add an icon button to canvas group headers that applies the group's resolved due date to every task inside the group. Two separate actions in a small popover: "Set due date on all tasks" (due date only) and "Apply all group properties" (due date + priority + status + project). Button shows **only** on groups with a resolvable due date (power-keyword `Today`/`Tomorrow`/weekday groups, or `assignOnDrop.dueDate`). Overwrites existing task dates.

**Approach**: Reuse `getSectionProperties(group, allGroups)` (`useCanvasSectionProperties.ts:147`) — the same resolver used on drop — as the single source of truth for the group's date. Metadata-only (`dueDate`/`priority`/`status`/`projectId`), never geometry, so it respects the Canvas Geometry Invariants. Apply via `taskStore.bulkUpdateTasksWithUndo` (one undo entry). Wiring mirrors the existing `@collect`/`collectTasksForSection` path: `GroupNodeSimple.vue` emit → `CanvasView.vue` → `useCanvasOrchestrator.ts` → new `applyGroupPropsToTasks(groupId, mode)` in `useCanvasTaskActions.ts`. Children enumerated from `taskStore._rawTasks` (the `.tasks` getter applies smart-view filters), skipping done/soft-deleted/completion-record/pinned.

**Files**: `src/components/canvas/GroupNodeSimple.vue`, `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, new unit test under `tests/unit/canvas/`.

---

### ~~BUG-1810~~: Inbox "3 Days" filter shows far-future recurring tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-06-01)

**Problem**: With the inbox time filter set to **3 Days**, a recurring task displaying a far-future date (e.g. "Jun 8", 7 days out) still appeared — making the filter look broken.

**Root cause**: Display/filter mismatch, not a filter bug. The filter (`isNext3DaysTask`, `src/composables/useSmartViews.ts`) treats calendar **instances** as authoritative (BUG-1188) and correctly matched the task via a near-term instance. But the task card (`UnifiedInboxTaskCard.vue`) used the master `dueDate` first and only fell back to instances when `dueDate` was absent — so it showed the far-future master date while the task surfaced via a near-term instance.

**Fix**: Card now honors the same instance-authoritative rule as the filter. Extracted badge logic to a pure, testable `dueStatus.ts`; the badge shows the **representative instance** (soonest upcoming ≥ today, else latest overdue) instead of the master `dueDate` when instances exist. Also fixed a latent gap: a past representative instance is now labeled "Overdue", not "future".

**Files**: `src/components/inbox/unified/dueStatus.ts` (new), `src/components/inbox/unified/UnifiedInboxTaskCard.vue`, `src/components/inbox/unified/__tests__/dueStatus.spec.ts` (new, 9 tests).

---

### TASK-1809: Shift-drag to reorder tasks within a canvas column (🔄 IN PROGRESS)

**Goal**: Let users reorder a task inside a day/smart canvas column by holding **Shift** while dragging. On a Shift-drop, the column restacks cleanly from the header down — the dragged card takes the slot its drop-Y lands in and the rest shift down (insert-and-shift). Non-Shift drops keep today's free placement, unchanged.

**Approach**: Reuse the tested `computeCanonicalLayout` primitive (`useCanonicalDayGroupLayout.ts`) scoped to a single group. Tasks already order by Y, so the dropped card's new Y decides its slot.
- `useTidyLayout.ts`: add pure `planReorderColumn(groupId)` + `reorderColumn(groupId)` (store writes + position locks + undo snapshot, mirrors `tidyDayGroups`).
- `CanvasView.vue`: window keydown/keyup/blur listeners track `reorderKeyHeld` (F2); wrap `@node-drag-stop` — if held, run `reorderColumn` on the dropped task's group via `applyCanonicalMoves` + `syncNodes({force})`.
- Stays inside the single sanctioned geometry writer (drag handler + Tidy primitive) → no sync-loop/invariant violation.

**Perf (TASK-1809b — instant paint)**: First version awaited the drag handler's Supabase write (~1–2s on VPS, BUG-1051) *before* painting the restack → 2–4s lag. Fixed by splitting `reorderColumn` into a synchronous part (plan + group geometry + moves) and a deferred `commit()` (task `updateTask` writes + PositionManager + undo). The wrapper now: starts the drag save without awaiting (its sync prefix passes the `canvasSyncInProgress` guard first), runs `reorderColumn` + `applyCanonicalMoves` **synchronously** (instant paint), then `await dragDone` → `commit()` so reorder's writes land last and win LWW (a refresh keeps the reordered slot). Same-column drops use this instant path (detected via `getDeepestContainingGroup`); rare cross-group drops fall back to await-then-reorder. Covered by `tidy-layout.test.ts` reorderColumn tests.

### BUG-1807: Canvas nudge — all nodes shift on inbox drop (Electron) (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-05-31)

**Problem**: On the Electron desktop build, dragging a task from the canvas inbox onto the canvas makes every rendered canvas node shift together for a frame, then settle — the "nudge". Earlier fixes (autoPanOnNodeDrag, setNodes refeed) addressed node-drag and viewport nudges but not the inbox-drop case.

**Root cause**: `useCanvasSync.syncStoreToCanvas` only had an in-place patch path for equal node counts. Adding a node (inbox→canvas drop) changed the count (N→N+1), forcing a full `setNodes()` that replaces the entire reactive node array. Vue Flow then re-parses every node (position/dimensions). Chromium's keyed reuse hides this, but Electron's GPU compositor re-rasterizes all node layers → visible collective shift.

**Fix**: Added an incremental add/remove path in `syncStoreToCanvas`. When the only structural change is added/removed nodes and surviving nodes keep their type/parent, it patches changed survivors with `updateNode`, removes deletions with `removeNodes`, and appends new nodes with `addNodes` (groups first for parent-before-child). Existing node instances are never re-mounted → no compositor reflow → no nudge. Falls back to full `setNodes()` when topology actually changes.

**Regression tests**: New `tests/e2e/canvas-inbox-nudge.spec.ts` fires a real HTML5 drop and samples every existing node's screen rect + the viewport transform across animation frames, asserting no drift and a stable viewport. (Note: headless Chromium cannot reproduce the Electron-only compositor shift, so this guards behavior/no-regression; the actual nudge is verified on the deployed Electron build.)

**v1.4.80 attempt (did NOT fix)**: Shipped incremental `addNodes` instead of full `setNodes` on count change. Kept (safe perf improvement) but not the culprit — paint profiling showed it identical to the old path (337 vs 341 paints).

**Root cause (FOUND, v1.4.81)**: The shift is invisible to layout APIs (`getBoundingClientRect` = 0px drift), so it's a **GPU-compositor repaint**. Using CDP `LayerTree.layerPainted` profiling, the inbox drop produced ~341 paints; disabling `.task-node.is-recently-created` dropped that to **32** — a 90% reduction. The culprit is the `animate-creation` keyframes in `TaskNode.vue`: a 2s `transform: scale(0.6→1.1→…→1)` bounce that fires when a node mounts with `createdAt < 5s` (exactly a just-created task dragged from the inbox). **Accurate mechanism** (corrected — the card is NOT glass; `.task-node` has `backdrop-filter` removed per BUG-1216): the transform pane uses `transform-style: preserve-3d` (text-crispness fix, BUG-041/1408); animating a child's `transform: scale()` inside that shared 3D context forces the browser to re-rasterize the **entire** context every frame (→ the observed full-viewport 1280×720 repaint), and on Electron's GPU compositor that full re-raster lands sub-pixel-shifted → the whole canvas appears to shift together. The scale also violated the BUG-1328 invariant ("no transform on the node root"). (An earlier note here said "backdrop-filter re-sample" — that was wrong; the fix is identical regardless.)

**Fix (v1.4.81 → hardened in v1.4.82)**: Rewrote `animate-creation`. v1.4.81 removed `scale()` (paints 341→146). v1.4.82 made it **opacity-only** (removed `filter: brightness` and the animated `box-shadow` too — `filter` on a glass card also re-composites the backdrop), 0.45s. Paints during drop: 341 → **36** (near the 32 "no animation" floor). Zero transform, zero filter, zero geometry change → nothing can re-sample the backdrop or shift.

**Regression tests**: `tests/unit/canvas/creation-animation-no-transform.test.ts` asserts the keyframes contain no `scale()`/`transform`. `tests/e2e/canvas-inbox-nudge.spec.ts` guards no node/viewport drift on real drop.

**Verified**: `vue-tsc` clean, 171/171 canvas unit tests, e2e passes, CDP paint count 341→146. Shipping to Electron updater as **v1.4.82**. **Awaiting user confirmation on desktop** that the canvas no longer shifts.

**Files**: `src/components/canvas/TaskNode.vue` (fix), `src/composables/canvas/useCanvasSync.ts` (v1.4.80 perf), `tests/unit/canvas/creation-animation-no-transform.test.ts`, `tests/e2e/canvas-inbox-nudge.spec.ts`.

**Related follow-up (not part of this bug)**: `task-flash-green/red/amber/blue` keyframes in `TaskNode.vue` also use `transform: scale(1.02)` on the glass card. They fire on the `task-action-flash` event (explicit date/status edits), NOT on inbox drop, so they don't affect BUG-1807. But they're the same latent class (scale on a backdrop-filter card → Electron compositor shift) and should likely be made transform-free too if a similar nudge is ever reported on date/status edits. `transition: all` on `GroupNodeSimple`/`CanvasGroup`/`ImageNode` roots is a related concern (animates transform on glass). → **Surfaced as BUG-1808.**

---

### BUG-1808: Canvas nudge on date edit (overdue → today / context-menu reschedule) (🔄 IN PROGRESS)

**Priority**: P1 | **Status**: 🔄 IN PROGRESS (2026-06-01)

**Problem**: On the Electron desktop build, rescheduling a task to a new date — e.g. picking **Today** from the canvas context menu / overdue reschedule — makes every canvas node nudge/shift together for a frame, exactly like BUG-1807 but triggered by a date edit instead of an inbox drop.

**Root cause**: The `task-action-flash-*` keyframes in `TaskNode.vue` (fired via the `task-action-flash` event by `useTaskContextMenuActions.setDueDate`) animated `transform: scale(1)→scale(1.02)→scale(1)` on the `.task-node` card. Same compositor-shift class BUG-1807 identified: a `transform` inside the shared `preserve-3d` context forces a full re-rasterization, which Electron's GPU compositor lands sub-pixel-shifted → the whole canvas appears to shift. This was the exact "related follow-up" BUG-1807 predicted.

**Fix**: Made all four `task-flash-{green,red,amber,blue}` keyframes transform-free — the brightness + box-shadow glow pulse carries the feedback, no `scale()`. The OverdueBadge reschedule path (`useTaskNodeActions.handleReschedule`) does not flash and only performs a legitimate single-node reparent into the matching smart group; the group root (`.section-node`) is already transform-free with backdrop-filter removed, so it is not a nudge source.

**Regression tests**: Extended `tests/unit/canvas/creation-animation-no-transform.test.ts` with a `BUG-1808` block asserting none of the four flash keyframes contain `scale()`/`transform`. 6/6 pass.

**Files**: `src/components/canvas/TaskNode.vue` (flash keyframes), `tests/unit/canvas/creation-animation-no-transform.test.ts`.

**Awaiting**: Electron build + deploy and user confirmation on desktop that the date-edit nudge is gone.

---

### ~~BUG-1806~~: Mark-done can still trigger phantom nudge state (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-28)

**Problem**: After the first KDE mark-done cleanup, the generic nudge timer could still interrupt later because its final gate only checked idle/session timing. It did not prove there was an actionable reminder task after the completed task was hidden/refreshed.

**Fix**: The KDE nudge path is now task-backed. The timer refreshes the unfiltered nanny task cache, rebuilds the reminder list, and only calls `sendNannyNotification()` when `hasActionableNannyTasks()` finds a non-hidden, non-done pinned task or a non-hidden, non-done task due today. `sendNannyNotification()` has the same guard defensively, and the nanny REST query is scoped by `user_id`.

**Regression tests**: KDE unit coverage now verifies the final actionable reminder task blocks future nudges, while another visible pinned task still allows reminders. Canvas mark-done E2E now waits for initial Vue Flow transform settling and verifies mark-done does not move sibling task geometry.

**Verified**: `npm test -- --run tests/unit/kde/nudge-popup.test.ts tests/unit/kde/nanny-gates.test.ts tests/unit/kde/task-list-building.test.ts` (59/59), `npm test -- --run tests/unit/kde` (151/151), focused Playwright mark-done canvas regression, `npm run type-check`, `npm run electron:build`, `./scripts/deploy-electron-update.sh`; public updater manifest shows `1.4.78`.

**Files**: `packages/kde-widget/contents/ui/main.qml`, `tests/unit/kde/nudge-popup.test.ts`, `tests/e2e/canvas-geometry-local.spec.ts`.

---

### ~~BUG-1805~~: KDE nanny nudge resurfaced after marking a task done (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-27)

**Problem**: In the KDE widget, marking a task done could immediately let the nanny/nudge reminder resurface or keep the completed task in reminder-backed caches. The mark-done path only refreshed the visible task list, leaving popup state, idle timing, pinned tasks, and the unfiltered nanny task cache stale.

**Fix**: `markTaskDone()` now treats completion as user activity: it dismisses nanny/nudge popups, resets the reminder timing gates, removes the task optimistically from visible/pinned/nanny caches, hides it from same-day reminder rebuilding, PATCHes `completed_at`/`updated_at`, and refreshes all reminder task caches after Supabase confirms. Failed PATCHes remove the hidden guard and refresh caches so the task is restored instead of silently disappearing. The nanny list builder also excludes stale done pinned entries defensively.

**Regression tests**: KDE unit coverage now verifies mark-done popup dismissal, nudge timing reset, immediate cache removal, failed-completion hidden-guard rollback, and stale done pinned task exclusion. Full KDE unit suite passes.

**Files**: `packages/kde-widget/contents/ui/main.qml`, `tests/unit/kde/nudge-popup.test.ts`, `tests/unit/kde/task-list-building.test.ts`.

---

### ~~BUG-1804~~: Canvas refresh/update reload could mix fresh group geometry with stale task geometry (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26)

**Problem**: After Electron updates, hard refreshes, or other cold reloads, the Canvas could appear rearranged even though the user did not ask for layout changes.

**Root cause**: Group reload already preferred newer IndexedDB/local geometry when the offline sync queue had not yet flushed to Supabase, but task reload always started from Supabase when the in-memory store was empty. A restart could therefore combine fresh local group positions with stale remote task positions. Startup also still ran an automatic containment reconciliation path that could rewrite `parentId` during reload based on partially mixed geometry.

**Fix**: Task load now mirrors group load: if IndexedDB has newer canvas geometry by `positionVersion`/`updatedAt`, it preserves local `canvasPosition`, `parentId`, `positionFormat`, and version, then queues a catch-up write so Supabase converges. Canvas startup no longer writes parent topology from spatial reconciliation; parent changes are limited to explicit drag/drop flows.

**Regression tests**: Added Smart Merge coverage for newer cached task geometry winning on cold reload and older cached geometry losing to remote. Existing Canvas E2E nudge coverage now verifies root task drag, group drag, grouped-task topology sync, and inbox drop do not move unrelated nodes or the viewport.

**Files**: `src/stores/tasks/taskPersistence.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `tests/unit/stores/smart-merge.test.ts`, `tests/e2e/canvas-geometry-local.spec.ts`.

### ~~BUG-1803~~: Complete undo/redo action audit across Canvas and task workflows (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26)

**Problem**: The current pass fixed task-to-group connection undo/redo and a field-clearing redo asymmetry, but the user goal is broader: every undo/redo flow for every action must work at least three consecutive times. That broader claim is not proven yet.

**Current verified pass**: Task-to-group Canvas links are now group-level only (`CanvasGroup.linkedParentTaskId`) and no longer rewrite child tasks' `parentTaskId` on link, unlink, drop, or drag-settle. `canvas-connection` undo/redo restores only group link state. Task-to-task Canvas connect/disconnect now has direct three-cycle undo/redo coverage, ignores duplicate connects without adding undo entries, and refuses stale-edge disconnects whose source is not the target task's current parent. Canvas task/group drag and group resize now commit a single `canvas-geometry` undo entry after the drag/resize operation settles; mixed task/group geometry restores across three undo/redo cycles. The Tidy layout toolbar command and physical day-group rotation now preserve their synchronous CanvasView contract while recording explicit before/after `canvas-geometry` snapshots after pending task writes finish; both snapshot-backed geometry entries restore across three undo/redo cycles. Keyboard undo/redo now routes app-level shortcuts through the singleton, defers while Quick Sort owns the active view, and preserves native input undo. Quick Sort keyboard redo now handles Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z, and composable redo re-applies `MARK_DONE` status plus `MARK_DONE_AND_DELETE` deletion for three consecutive cycles. Context-menu/modal entry points now use undo-aware APIs for pin, calendar lock, done fully, AI breakdown task creation, recurrence permanent delete, and recurring remove-from-canvas. `bulkMoveToInboxWithUndo` now restores and re-clears `canvasPosition` for three undo/redo cycles. Group create/delete/resize undo/redo now preserves group IDs across three consecutive cycles, preventing snapshot restores from recreating groups under new IDs. Task create/update/delete/permanent delete/bulk delete, public Kanban/status move, public project move wrappers, and Kanban multi-field drops now have direct three-cycle regression coverage. Kanban status/priority/date/category/sidebar-project drops route through undo-aware APIs instead of plain task mutations. Board list-mode updates, All Tasks create/update/move/complete flows, Batch Edit quick/bulk updates, direct edit-modal saves, quick task creation, command-palette creation, task-card status/duration edits, task assignment, Morning Dashboard quick creation, pinned quick-task changes, mini-canvas edits, calendar drag/resize/date moves, and grouped reorder persistence now route through undo-aware APIs with regression/source-contract coverage. Canvas image delete now has direct three-cycle regression coverage and verifies restored images do not duplicate. Quick Sort local undo/redo now has direct three-cycle coverage across categorize, mark done, mark done/delete, and save actions. Canvas drag/drop regression coverage now proves root task drag, group drag, grouped-task topology sync, and inbox-to-canvas drop do not nudge unrelated rendered nodes or viewport transform. Shipped to Electron updater as v1.4.77.

**Completion note**: Remaining layout/system-maintenance writes were reviewed as intentional non-user undo boundaries (initial auto-placement, migration/reconcile writes, metadata-only day-group date rotation). User-facing undoable mutations now have direct regression coverage or source-contract coverage.

**Files in current pass**: `src/components/canvas/TaskNode.vue`, `src/components/kanban/KanbanColumn.vue`, `src/components/kanban/card/TaskCardBadges.vue`, `src/components/layout/CommandPalette.vue`, `src/components/morning-dashboard/BigThreeCard.vue`, `src/components/morning-dashboard/MorningQuickCapture.vue`, `src/components/tasks/BatchEditModal.vue`, `src/components/tasks/QuickTaskCreate.vue`, `src/components/tasks/TaskContextMenu.vue`, `src/components/tasks/TaskList.vue`, `src/composables/calendar/useCalendarDayView.ts`, `src/composables/calendar/useCalendarMonthView.ts`, `src/composables/calendar/useCalendarWeekView.ts`, `src/composables/canvas/useCanvasConnections.ts`, `src/composables/canvas/useCanvasEvents.ts`, `src/composables/canvas/useCanvasInteractions.ts`, `src/composables/canvas/useDayGroupRotation.ts`, `src/composables/canvas/useTidyLayout.ts`, `src/composables/mini-canvas/useMiniCanvasActions.ts`, `src/composables/tasks/card/useTaskCardActions.ts`, `src/composables/tasks/useTaskContextMenuActions.ts`, `src/composables/tasks/useTaskEditActions.ts`, `src/composables/useCalendarCore.ts`, `src/composables/useQuickSort.ts`, `src/composables/useQuickTasks.ts`, `src/composables/useUnifiedUndoRedo.ts`, `src/composables/undoSingleton.ts`, `src/composables/workspace/useTaskAssignment.ts`, `src/layouts/ModalManager.vue`, `src/stores/canvas/canvasGroups.ts`, `src/stores/tasks/taskHistory.ts`, `src/utils/globalKeyboardHandlerSimple.ts`, `src/views/AllTasksView.vue`, `src/views/BoardView.vue`, `src/views/CalendarViewVueCal.vue`, `src/views/CanvasView.vue`, `src/views/QuickSortView.vue`, `tests/e2e/canvas-geometry-local.spec.ts`, `tests/unit/canvas-connection-undo.test.ts`, `tests/unit/canvas-geometry-undo.test.ts`, `tests/unit/global-keyboard-undo-redo.test.ts`, `tests/unit/use-quick-sort-undo-redo.test.ts`, `tests/unit/undo-entrypoint-contract.test.ts`, `tests/unit/undo-selective-restore.test.ts`, `tests/unit/undo-task-operations.test.ts`, `tests/unit/undo-image-delete.test.ts`.

---

### ~~BUG-1802~~: Supabase REST outage blanked localhost canvas and surfaced sync errors (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-26) — localhost fixed; shipping in v1.4.62.

**Problem**: Localhost started showing `Sync Error(fetchTasks): An unexpected error occurred` and `Sync Error(saveTasks): An unexpected error occurred`; Canvas could load blank because cached tasks referenced groups while the group fetch returned HTTP 500.

**Root cause**: VPS `supabase-rest` had exited, so Kong could not resolve its `rest` upstream and returned HTTP 500 for every `/rest/v1/*` route. On the client, `useCanvasSync` deferred all parented tasks when `groups.length === 0`, which is correct for a partial group load but blanked the canvas when the entire groups request failed.

**Fix**: Restarted `supabase-rest` on the VPS and verified `tasks`/`groups` REST queries returned 200 with no fresh Kong REST 500/DNS errors. Hardened Canvas so, when groups are entirely unavailable, parented tasks render as root fallback nodes using their absolute coordinates; a later successful group load re-parents them without writing the fallback to storage. Kept write failures visible while suppressing generic transient read-fetch noise.

**Regression tests**: Added local Canvas E2E coverage for cached parented tasks remaining visible when group loading fails, plus Supabase infrastructure unit coverage that suppresses generic read fetch failures but still surfaces mutation failures.

---

### ~~BUG-1801~~: Background timer fetch showed noisy generic sync error (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-26) — shipping in v1.4.62.

**Problem**: The app could show `Sync Error(fetchActiveTimerSession): An unexpected error occurred` from the background timer poll, even though this is a transient Supabase/PostgREST fetch-layer failure and the timer read path safely returns `null`.

**Root cause**: The shared Supabase retry/error helper recognized explicit network messages (`Failed to fetch`, `AbortError`, timeout, etc.) but not Supabase's generic collapsed message `An unexpected error occurred` with status `0`, so the 15s active-timer poll surfaced a visible sync warning.

**Fix**: Centralized transient sync classification in `_infrastructure.ts`, treats the generic collapsed message as transient for read fetches, retries it, and suppresses both visible notifications and user-facing last-sync state for those fetch-only failures.

**Regression tests**: `tests/unit/composables/supabase-infrastructure.test.ts` covers retry behavior, notification/state suppression for generic read fetch failures, and confirms mutation failures still surface.

---

### ~~BUG-1800~~: Canvas Tidy/Rotate left phantom vertical gaps and could stale-lock tasks (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-26)

**Problem**: Canvas **Tidy** and **Rotate day groups** moved groups but still left large unexplained blank gaps inside Today. Earlier Tidy attempts also made tasks feel locked after the programmatic layout ran.

**Root causes**: (1) Tidy/Rotate stacked from `rawTasks`, so done/filtered/hidden canvas tasks still consumed invisible rows. The visible cards looked uneven because the hidden cards were being laid out between them. (2) Rotate still used `taskPositioning: 'preserveRelative'`, carrying old Y gaps forward instead of compacting like Tidy. (3) Vue Flow controlled-mode updates were fed internal fields (`computedPosition`, stale dimensions) or stale in-place arrays, which could desync dragging after reparent/restack. (4) The forced post-layout sync rebuilt group nodes without top-level `width`/`height`/`dimensions`, so Vue Flow bounds could revert to stale sizes.

**Fix**: Tidy and explicit Rotate now share the same layout concept: operate on visible canvas tasks only, measure rendered card heights, stack from the group header with compact consistent visual gaps, keep single-column day groups, release layout locks after writes settle, and force a clean store→Vue Flow projection. Programmatic Vue Flow application strips internal fields, uses one atomic `setNodes(...)`, converts child positions to parent-relative values, leaves `extent` unset, and keeps tasks draggable/selectable.

**Regression tests**: Added/updated focused unit coverage for hidden done tasks not consuming blank rows in both Tidy and Rotate, measured-height compact gaps, group dimension preservation after forced sync, controlled-mode node publishing after `applyNodeChanges`, lock release after Tidy, and no manual `computedPosition` stamping in the apply path.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `src/composables/canvas/useDayGroupRotation.ts`, `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `src/views/CanvasView.vue`, `src/composables/canvas/useCanvasSync.ts`, `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasInteractions.ts`, `src/components/canvas/CanvasToolbar.vue`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/unit/canvas/day-group-position-rotation.test.ts`, `tests/unit/canvas/canonical-layout.test.ts`, `tests/unit/canvas/tidy-atomic-apply.test.ts`.

**Verified**: User confirmed the populated signed-in localhost canvas now visually works after Tidy. Focused regression suite passed: `npm test -- --run tests/unit/canvas/day-group-position-rotation.test.ts tests/unit/canvas/tidy-layout.test.ts tests/unit/canvas/canonical-layout.test.ts tests/unit/canvas/tidy-atomic-apply.test.ts` → 53/53. Targeted source ESLint has 0 errors; remaining output is existing `no-explicit-any` warnings in canvas sync/interaction files.

---

### ~~BUG-1799~~: Electron realtime storm + sync double-write + blank-title resurrection (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-25) — deployed v1.4.51 to VPS auto-updater; user confirmed the realtime/sync console issues are resolved on the updated Electron build.

**Problem** (from production Electron console): (1) endless `📡 [REALTIME] Connection dropped (CHANNEL_ERROR)`→`(CLOSED)` loop; (2) `⚠️ [SYNC] LWW: Server wins … DISCARDED (delta 2–7s)` spam for tasks AND groups + 1–1.5s update latency (`[BUG-291]`); (3) `🛠️ [TASK-TITLE-REPAIR] … (permanentlyDeleteTask)` blank titles; (4) downstream `[NODE-SYNC] Conflict detected` bursts.

**Root causes** (verified vs source + supabase-js + local DB): (1) **Realtime** — supabase-js dedupes channels by topic, so re-entrant `setupSubscription()` re-binds `postgres_changes` listeners (events handled N×) + competes with realtime-js's own rejoinTimer, and `retryCount` was reset to 0 on every Electron `visibilitychange`/`online` tick → no backoff → storm. (2) **Double-write** — `updateTask`/`updateGroup` enqueue a sync op AND then unconditionally direct-save; the direct save's fresh `updated_at` (now) out-timestamps the queued op → false `position_version` conflict → LWW "server wins" discards a duplicate. (3) **Resurrection** — LWW writeback `updateTaskFromSync(id, data, false)` ADDS a task when absent (`tasks.ts:248`), re-adding a locally-deleted task with a sanitized blank title.

**Fix**: (1) `useRealtimeSubscription.ts` — `isConnecting` single-flight guard + single cancellable `reconnectTimer` (collapses CHANNEL_ERROR+CLOSED double-schedule), tear down stale channel before re-create, stop resetting `retryCount` outside SUBSCRIBED, visibility/online only reconnect when dead & not already connecting/scheduled. (2) Sync queue becomes the single writer: completed the task queue payload with the 7 fields it was missing (`planning_notes, connection_types, depends_on, column_id, calendar_locked, notification_prefs, parent_task_id` + `total_pomodoros`) mirroring `toSupabaseTask`, then removed the unconditional direct save in `taskOperations.ts` (kept enqueue-failure fallback); made the group `saveGroupToStorage` a fallback-only in `canvasGroups.ts`. Queue keeps `position_version` optimistic lock + field-level merge. (3) `useSyncOrchestrator.ts` writeback honors `serverData.is_deleted` and skips re-adding tasks absent from `rawTasks`.

**Files**: `src/composables/supabase/useRealtimeSubscription.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/canvas/canvasGroups.ts`, `src/composables/sync/useSyncOrchestrator.ts`. Plan: `~/.claude/plans/stateful-scribbling-thompson.md`.

**Verified**: vue-tsc 0 new errors on the 4 files (166 pre-existing elsewhere, TASK-1789); lint clean; 82/82 unit+integration pass (`sync-retry-strategy`, `task-sync-flow`, `task-rollback`, `task-completeness`, `sync-readonly`, `realtime-drag-race`); production build green. Deployed v1.4.51 (`FlowState-1.4.51-x86_64.AppImage`) to VPS; `https://in-theflow.com/updates/electron/latest-linux.yml` → 1.4.51. User confirmed resolved on the updated Electron build (2026-05-25).

---

### ~~TASK-1798~~: Canvas Tidy pulls tasks into matching group + stacks at top (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-24)

**Problem**: The Canvas **Tidy** button didn't pull tasks into the group they belong to, and didn't move group members to the top. Tasks sitting low stayed low; a task due today stuck in another group was never moved into Today.

**Root cause** (`src/composables/canvas/useTidyLayout.ts`): (1) restacked with `taskPositioning: 'compactFromCurrentTop'`, which anchored the stack at the current topmost task instead of the header; (2) the re-home pass only touched orphans (`if (task.parentId) continue`) and only restacked `parentId === group.id` tasks — so dated tasks in the wrong group / loose tasks inside custom groups were never adopted.

**Fix**: (1) switched Tidy to `taskPositioning: 'fromHeader'` (tasks stack at `groupY + HEADER 50 + PADDING 20`). (2) Date-association pass now runs over **all** dated tasks (dropped the orphan guard) and re-parents each into its `findMatchingGroupForDueDate` group (today→Today, etc.); undated tasks are left alone. (3) Spatial-adoption fallback adopts loose tasks whose center sits inside a **custom** group's bounds via `getDeepestContainingGroup`, skipping date-claimed tasks so the date rule wins. All writes use the `'DRAG'` origin (within Single-Writer geometry invariant; `useCanvasSync.ts` untouched).

**Follow-up (v1.4.52)**: v1.4.50 still overflowed — tasks pulled into Today stacked from the top but spilled out the bottom because group height was summed from raw task heights independently of the grid-snapped position loop, so the box under-sized and clipped tail tasks (worse as more tasks piled in). Fixed in `useCanonicalDayGroupLayout.ts` by deriving group height from the tasks' ACTUAL placed footprint (`maxTaskBottomRelative + GROUP_PADDING`, floored at `DAY_GROUP_HEIGHT`) instead of a parallel sum — the box now always contains its tasks.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/unit/canvas/canonical-layout.test.ts`.

**Verified**: `tests/unit/canvas/` 124 pass (incl. new overflow-regression test with 13 tall tasks exceeding the height floor); lint clean. Shipped v1.4.52 to Electron auto-updater.

---

### TASK-1797: Local task API for Life OS Advisor (Electron-integrated, token-based) (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW (opened 2026-05-24) — implemented + verified locally; pending in-app round-trip + ship.

**Problem**: Life OS Advisor (separate local app) needs to read FlowState tasks for context and create/update them on explicit user approval, over a tiny localhost API.

**Approach**: Node `http` sidecar (`server/local-api/server.cjs`, zero new runtime deps — reuses `@supabase/supabase-js`) over the same Supabase `tasks` table. Additive; UI keeps syncing via realtime. Two modes:
- **Token mode (shipped)**: Electron auto-spawns the sidecar via `utilityProcess` when enabled in Settings; renderer forwards the logged-in session (anon key + user JWT) so all queries are RLS-scoped. No service-role key shipped. Off by default; random per-machine bearer shown in Settings.
- **Service-role mode (standalone)**: `doppler run -- npm run api` for headless/app-closed use on your own machine; never bundled.

Binds 127.0.0.1 only, rejects non-loopback Host (403), bearer required in token mode, no CORS headers. Default port 5577.

**Endpoints**: `GET /api/health`, `GET /api/tasks?status=&limit=` (≤25, fields id/title/status/priority/dueDate/projectId), `POST /api/tasks`, `PATCH /api/tasks/:id`. App↔DB status map `todo→planned`/`done` (self-contained copy of `toDbStatus`, since `supabaseMappers.ts` imports Pinia).

**Files**: `server/local-api/server.cjs` + `README.md`, `electron/ipc/localApi.ts` (new), `electron/main.ts`, `electron/preload.ts`, `src/composables/useLocalApiBridge.ts` (new), `src/stores/auth.ts`, `src/services/auth/supabase.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`, `package.json` (`api` script + esbuild bundle in `electron:build-main` + esbuild devDep). Plan: `~/.claude/plans/linked-wobbling-blanket.md`.

**Verified**: (1) `setSession` RLS-scoping in plain Node — anon→0 rows, with-session→only the user's rows; (2) full token-mode integration through a real Electron `utilityProcess` + bundled sidecar — pre-session 503, post-session correct RLS-scoped reads, POST 200; (3) HTTP layer (health/401/403/400/404/DB-error→JSON); (4) esbuild bundles supabase-js self-contained (537KB); (5) standalone service-role mode boots (no regression); (6) no new type/lint errors. **Pending (user-run)**: `npm run electron:dev` → sign in → enable in Settings → curl with bearer → POST shows in UI via realtime. Then ship per rules 6/7 (version bump + Electron deploy).

---

### ~~TASK-1791~~: Design overhaul — fix critique findings across all views (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-25) — shipped to production. Rebased onto master and merged via PR #157, deployed to in-theflow.com (web) + Electron auto-updater (1.4.50). Follow-up PR #158 self-hosted the Clash Display font (was blocked by the edge CSP). Restore tag `pre-design-overhaul-2026-05-21`.

**Phases (all ✅ implemented, each its own commit):**
- ✅ Phase 1: text contrast — `--text-muted` 0.45→0.55, `--text-subtle` 0.35→0.45 (WCAG AA)
- ✅ Phase 2: project-color left accent on board cards (project identity in mixed-project views)
- ✅ Phase 3: quick-add elevated to primary (brand accent), Create project demoted to ghost
- ✅ Phase 4: clock/timer divider, idle-timer resting border, long-break icon User→Armchair
- ✅ Phase 5: guiding inbox/canvas-group empty states; confirmed calendar empty inbox is filter behavior, not a bug

Type-check: 0 new errors introduced (GroupNodeSimple's 9 pre-existing errors tracked under TASK-1789).

**Problem**: Whole-app design critique flagged 5 priority issues: (1) low-contrast actionable text (dates/estimates at 35-45% opacity), (2) color double-encoding (priority shown as both dots and pills; teal overloaded across brand/active/status/project), (3) no clear primary action (Create project louder than quick-add), (4) unlabeled 7-icon header soup with clock+timer jammed together, (5) weak/possibly-buggy empty states (Calendar filter-empty hides seeded tasks; canvas partially-populated groups have no add prompt).

**Approach**: Safe phased overhaul, each phase checkpointed + screenshot-diffed against baseline. Restore via `git reset --hard pre-design-overhaul-2026-05-21`.
- Phase 1: text contrast tokens (design-tokens.css)
- Phase 2: color semantics — pills as single priority encoding, project identity on cards, teal=brand only (TaskCardStatus.vue, TaskRowPriority.vue, TaskRowProject.vue)
- Phase 3: primary action — quick-add loudest, demote Create project (SidebarQuickTaskInput.vue, SidebarProjectsSection.vue)
- Phase 4: header — group/label icons, separate clock from Pomodoro timer (AppHeader.vue)
- Phase 5: empty/edge states + investigate Calendar default-filter bug (CalendarInboxList.vue, canvas)

**Baseline screenshots**: `.dev/screenshots/critique-{board,canvas,calendar,tasks}.png`

---

### ~~BUG-1796~~: Canvas rendered zero nodes — `toRelativePosition` used but not imported (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-23)

**Problem**: After v1.4.48, the app loaded but the Canvas was completely empty (no nodes, no groups) for users with parented canvas data, while the inbox panel listed tasks normally.

**Root cause**: `src/composables/canvas/useCanvasSync.ts` calls `toRelativePosition(...)` at lines 302 (group nodes) and 457 (task nodes) but never imported it (exported from `src/utils/canvas/coordinates.ts:50`). Introduced by BUG-1792 (commit 9c92acc3). Both call sites only run for a node with a *visible parent*, so a nested group / task-in-group triggered `ReferenceError: toRelativePosition is not defined`. `syncStoreToCanvas` is `try { …build… setNodes() } finally {}` with no `catch`, so the throw skipped `setNodes()` entirely → empty canvas. Surfaced via Vue's effect error handler (logged, non-fatal) so no white screen.

**Why it slipped through**: `npm run build` (Vite/esbuild) doesn't type-check; CI type-check is disabled by TASK-1789 (~160 errors). `vue-tsc` *does* flag it (`TS2304: Cannot find name 'toRelativePosition'`), ESLint does not (typescript-eslint disables `no-undef`). The e2e harness can't reproduce it: in-memory seeded groups get wiped by the DB realtime reload, so seeded parented nodes lose their parent before sync.

**Fix**: Add `toRelativePosition` to the existing `@/utils/canvas/coordinates` import in `useCanvasSync.ts`.

**Regression test**: `tests/unit/canvas/useCanvasSync-imports.test.ts` statically asserts every coordinates helper *called* in `useCanvasSync.ts` is imported. Verified it fails pre-fix (names `toRelativePosition`) and passes after. `geometry-invariants` + `sync-readonly` suites still green (54 tests).

**Follow-up**: TASK-1789 (re-enable CI type-check) is the systemic guard for this class of bug.

**Files**: `src/composables/canvas/useCanvasSync.ts`, `tests/unit/canvas/useCanvasSync-imports.test.ts`. Version bump 1.4.48 → 1.4.49.

---

### ~~BUG-1795~~: Null task title crashed Board and Canvas via TaskCardBadges (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-23)

**Problem**: Electron app showed "Something went wrong — Cannot read properties of undefined (reading 'trim')" on the Board view, and the Canvas rendered empty (37 placed tasks, none visible).

**Root cause**: `TaskCardBadges.vue` computed `hasTaskTitle` as `props.task.title.trim()`. A task with a `null`/`undefined` title threw during render. `TaskCard` (which renders `TaskCardBadges`) appears on the Board AND in the Canvas inbox panel (`UnifiedInboxList`), so one bad task took down both views. Render-side companion to the sync/DB defenses in BUG-1777/BUG-1779.

**Fix**: Guard the computed — `(props.task.title ?? '').trim().length > 0`.

**Regression test**: `tests/unit/components/task-card-badges-null-title.test.ts` mounts the component with `null` and `undefined` titles. Verified it fails on the pre-fix code (reproduces the exact throw) and passes after.

**Files**: `src/components/kanban/card/TaskCardBadges.vue`, `tests/unit/components/task-card-badges-null-title.test.ts`. Version bump 1.4.47 → 1.4.48.

---

### ~~BUG-1792~~: Canvas idle sync persisted stale group/task positions (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-22)

**Problem**: Canvas groups and tasks could move without user dragging, then stay wrong after refresh. That meant a passive sync/render path was not just displaying stale geometry; it could replay stale Vue Flow/PositionManager coordinates into persistent store state.

**Root cause**: `useCanvasSync.ts` treated existing Vue Flow node positions and `PositionManager` as authoritative during read/sync paths. `PositionManager` is an interaction-time cache, so idle syncs triggered by unrelated task/title/filter activity could reuse stale drag/frame coordinates instead of store/Supabase absolute coordinates.

**Fix**: Make store/Supabase absolute coordinates authoritative for canvas read paths. Group nodes now read from `group.position`; task nodes read from `task.canvasPosition`; nested Vue Flow positions are derived with `toRelativePosition(absolutePos, getGroupAbsolutePosition(parentId, groups))`. Removed the idle sync block that preserved existing Vue Flow positions over freshly derived store positions.

**Hardening**: `taskOperations.updateTask()` now strips forbidden geometry fields from `SYNC` and `SMART-GROUP` updates before persistence. These sources can still update metadata, but cannot mutate `parentId`, `canvasPosition`, `positionFormat`, or `positionVersion`.

**Regression tests**: Added `tests/e2e/canvas-geometry-local.spec.ts` coverage for both group and task idle drift. The tests create canvas geometry, trigger unrelated idle sync activity, refresh, and assert positions are unchanged with no geometry write logs.

**Verification**:
- `./scripts/run-e2e.sh tests/e2e/canvas-geometry-local.spec.ts -g "idle sync activity and refresh do not persist (group|task) position changes" --project=chromium` passed.
- `npm test -- --run tests/unit/geometry-invariants.test.ts tests/unit/sync-readonly.test.ts tests/unit/smartgroup-metadata.test.ts` passed.
- `npm test -- --run tests/unit/stores/task-store-crud.test.ts tests/unit/geometry-invariants.test.ts tests/unit/sync-readonly.test.ts tests/unit/smartgroup-metadata.test.ts` passed.
- `npm run build` passed.
- `npm run electron:build` passed.

**Files**: `src/composables/canvas/useCanvasSync.ts`, `src/stores/tasks/taskOperations.ts`, `tests/e2e/canvas-geometry-local.spec.ts`, `tests/unit/stores/task-store-crud.test.ts`, `tests/global-setup.ts`.

---

### TASK-1789: Fix ~160 pre-existing type-check errors blocking CI (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED (opened 2026-05-18) — **NEXT UP**

**Problem**: `npm run type-check` reports ~166 errors across ~50 files (CanvasView, BoardView, PerformanceView, auth.ts, GroupNodeSimple, AISettingsTab, KanbanColumn, etc.). CI has been failing on the `check` job for 5+ consecutive runs. The VPS deploy workflow runs separately from CI so deploys aren't blocked, but the red-CI state masks regressions any future PR might introduce.

**Scope**: pure type-fix sweep. No behavior changes. Errors fall into known buckets — wrong vue-flow prop signatures on Canvas, missing null-guards on optional types, `Record<string, unknown>` mismatches on wrapper handlers, Pinia auth.ts typing drift, missing `from` field on NodeChange objects. Split into one PR per high-error file to keep blast radius small.

**Why now**: TASK-1785 (calendar ripple + lock) landed clean type-wise and dropped 4 errors. Every fix from here should keep the bar green. Letting CI stay red trains the team to ignore the gate.

**Top files by error count** (npm run type-check, 2026-05-18):
- src/views/CanvasView.vue — 13
- src/views/PerformanceView.vue — 12
- src/stores/auth.ts — 12
- src/components/settings/tabs/AISettingsTab.vue — 9
- src/components/canvas/GroupNodeSimple.vue — 9
- src/views/CalendarView.vue — 8
- src/components/kanban/KanbanColumn.vue — 7

**First step on resume**: `npm run type-check 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn` to confirm error-code distribution, then fix the highest-count file first.

**Out of scope**: no runtime/UX changes, no refactors, no behavior tweaks. Pure type annotations and minimal restructuring.

---

### ~~TASK-1790~~: Restore timer follower poll as Realtime backstop (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (shipped 2026-05-18, v1.4.37, commit 4b68d919)

**Problem**: KDE widget shows a running Pomodoro (e.g. 9m on task "לארגן משימות / טאבים") while the Vue/Electron app on the same machine shows idle `25:00`. Cross-device sync is broken.

**Root cause**: Commit `f616303a` ("accumulated fixes — timer sync") removed `resumeFollowerPoll()` from two idle-transition sites in `src/stores/timer.ts` and made the no-active-session branch of `initializeSync()` in `src/composables/timer/useTimerSync.ts` rely **solely** on Supabase Realtime to detect sessions started by other devices. The same file (`src/composables/supabase/useRealtimeSubscription.ts:168`) explicitly handles `CLOSED`/`TIMED_OUT`/`CHANNEL_ERROR` as expected runtime conditions (BUG-1320). Any missed Realtime INSERT (cold-start race, WS drop, replication hiccup) leaves Vue permanently deaf — verified against VPS DB: matching session existed in `timer_sessions` with the right `user_id` and `task_id` while Vue showed idle.

**Fix**:
- `useTimerSync.ts:17` — bump `FOLLOWER_POLL_INTERVAL_MS` from 3000 to 15000 so continuous polling is cheap (~4 queries/min) and BUG-1085's anti-spam intent is preserved.
- `useTimerSync.ts:~159` — don't auto-pause the poll on no-session; the poll IS the backstop.
- `useTimerSync.ts:~640` — resume follower poll in init's no-session branch.
- `useTimerSync.ts:~255` — drop `currentSession.value` requirement from the 30s backoff retry so idle polling resumes after network failures.
- `timer.ts:~441, ~546` — restore `sync.resumeFollowerPoll()` on the two idle-transition paths f616303a stripped.
- `packages/kde-widget/contents/ui/main.qml:4277` — defensive: add `&user_id=eq.<root.userId>` to widget's active-session SELECT (RLS already enforces server-side, this is hygiene).

**Verification**: VPS DB confirms task `7009f622-e45f-428e-be41-f0e0900ee549` ("לארגן משימות / טאבים") had an active `timer_sessions` row during screenshot while Vue showed 25:00 idle.

---

### ~~TASK-1785~~: Calendar Shift+drag ripple-push reschedule mode (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-21, Push 1 v1.4.37 + Push 2 v1.4.41)

**Problem**: Dragging a calendar task to a later time only re-times that one task. When a meeting runs long or a block shifts, users have to manually re-time every later task on the day — N drags for one logical "everything moved later" action.

**Goal**: Add a Shift modifier on calendar drag. Hold Shift + drag a task to a later time → every later task on the same day shifts forward by the same delta. Locked tasks are skipped. Crossing midnight spills into the next day. One drag = one undo step.

**User-confirmed scope (v1)**:
- Same day, all later tasks (not just colliders)
- Spill into next day past midnight
- Per-task `calendarLocked` field; ripple skips locked tasks (Push 2)
- Live ghost-shift preview while Shift is held mid-drag
- Negative delta (drag earlier) explicitly out of scope for v1

**Status**:
- **Push 1 + 1.5** (PR #149, shipped v1.4.37): pure ripple math + 15 unit tests, day + week view wiring (handlers shared via CalendarView), live ghost preview via `rippleGhostOffsets` map.
- **Push 2** (PR #152, shipped v1.4.41): per-task `calendarLocked` field. Migration `20260520000000_add_calendar_locked_to_tasks.sql` applied to local + production Supabase (682 rows defaulted false). Mapper round-trip + ripple skip-protect (`if (task.calendarLocked) continue`). "Lock time on calendar" toggle in calendar context menu only (gated by `context` prop in ModalManager). 🔒 corner indicator in day + week view. Tests: mapper round-trip + api-contract allowlist.

**Out of scope (deferred)**: compress mode (Shift+drag earlier), bulk-lock, lock-from-board/list/canvas.

**Plan file**: `~/.claude/plans/yes-and-ask-me-flickering-river.md`

---

### TASK-1773: Planning canvas interaction polish (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (opened 2026-05-01)

**Problem**: The mini planning canvas has the core graph interactions now, but the creation flow still feels mechanical: cable-dropped nodes do not immediately enter edit mode, selected nodes lack an obvious local action surface, and messy sessions need a lightweight tidy affordance.

**Planned slices**:
1. ~~Auto-focus the title field when cable-drop creates a connected subtask.~~ ✅ DONE (commit `98d5b5df`)
2. ~~Add a selected-node floating toolbar for add/edit/delete actions.~~ ✅ DONE (2026-05-03, v1.4.9 — `MiniCanvasFloatingToolbar.vue` via `@vue-flow/node-toolbar`)
3. Add a mini-canvas Tidy action that cleans up subtask/note spacing. 📋 PLANNED
4. Add restrained node/edge microinteractions with reduced-motion support. 📋 PLANNED

**Files**: `src/components/mini-canvas/`, `src/composables/mini-canvas/`.

---

### ~~BUG-1781~~: Canvas "Hide overdue tasks" toggle flipped state without re-filtering visible nodes (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: Clicking the calendar/Hide-overdue button on the canvas right-side toolbar flipped `taskStore.hideCanvasOverdueTasks` (icon swapped Calendar↔CalendarX correctly) but the canvas didn't visually hide/show overdue task nodes.

**Root cause**: `useCanvasOrchestrator.ts:158-164` wrapped `taskStore` inside a plain object with getters before passing to `useCanvasFilteredState`. The getter wrapper around Pinia refs is a brittle reactivity pattern — Vue's tracking through plain-object getters can break depending on consumer access patterns, and the `...canvasStore` spread immediately above stripped reactivity off everything else.

**Fix**: pass the live Pinia `taskStore` directly to `useCanvasFilteredState`. Native Pinia auto-tracking applies; no plain-object indirection.

**Regression test**: `tests/e2e/canvas-toolbar-regressions.spec.ts` — describe "BUG-1781 — Canvas hide-overdue toggle reactively re-filters". Mutates two seeded test-user tasks (one overdue, one future) with canvas positions, clicks the Hide-overdue button, asserts the overdue node leaves the DOM via its `data-id` selector, clicks again, asserts the overdue node returns. Runs on both chromium + webkit.

**Files**: `src/composables/canvas/useCanvasOrchestrator.ts`, `src/composables/canvas/useCanvasFilteredState.ts`, `tests/e2e/canvas-toolbar-regressions.spec.ts`.

---

### ~~BUG-1782~~: Canvas Tidy button silently no-op'd for users without day-of-week groups (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: Clicking the LayoutGrid/Tidy button on the canvas right-side toolbar did nothing for users whose canvas only had custom-named groups (no Today/Tomorrow/Mon-Sun). `tidyDayGroups()` filtered inputs by `detectPowerKeyword` and bailed early when none matched.

**Fix (user-approved)**: broaden the input collector at `useTidyLayout.ts:75-93` to include every group with a position. Tidy now lays out custom + smart + day groups uniformly in a canonical single row, preserving the user's left-to-right X order and restacking tasks inside each.

**Side effect**: custom groups get resized to canonical day-group width/height (350-700w × 1000h). Documented; user explicitly chose this scope.

**Test contract update**: `tests/unit/canvas/tidy-layout.test.ts` — renamed "ignores custom-named groups" → "includes custom-named groups alongside day groups" with corresponding assertion flip.

**Regression test**: `tests/e2e/canvas-toolbar-regressions.spec.ts` — describe "BUG-1782 — Canvas Tidy works on custom-named groups". Creates 3 custom groups (no day-keyword) at non-canonical positions via `canvasStore.createGroup`, clicks Tidy, asserts all 3 settle to the same Y (canonical row) and X values are evenly spaced. Runs on both chromium + webkit.

**Files**: `src/composables/canvas/useTidyLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`, `tests/e2e/canvas-toolbar-regressions.spec.ts`.

---

### ~~BUG-1783~~: RecurrenceDeleteModal action buttons looked dim / low contrast (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-05-03, v1.4.10)

**Problem**: User reported "Skip this occurrence" + "Stop all future occurrences" buttons in `RecurrenceDeleteModal.vue` looked broken/dim.

**Cause**: prior styling commits (5 in total since the modal was added) progressively reduced background opacity and used fractional-alpha border colours (`rgba(78,205,196,0.8)`) that read as washed-out against the modal's dark surface. The current outlined-only design didn't visually communicate "primary action".

**Fix**: subtle CSS contrast bump in `RecurrenceDeleteModal.vue` scoped style:
- Border switched from `rgba(*, 0.8)` to full-saturation `var(--brand-primary)` / `var(--color-danger)`.
- Default background gains a tinted gradient (`linear-gradient(180deg, rgba(*, 0.12), rgba(*, 0.06))`) plus a 1px inset shadow ring so the brand colour reads at a glance.
- Hover deepens the gradient + adds a coloured drop-shadow halo.

**Why not BaseButton**: BaseButton enforces `white-space: nowrap` which would clip the two-line label/subtitle pattern these action buttons use. Bespoke styling is appropriate for this multi-line-action pattern.

**Regression test**: `tests/unit/recurrence-delete-modal-styles.test.ts` — source-text assertions on the SFC's scoped style block (jsdom doesn't apply Vue scoped CSS reliably). 5 tests: Skip border references `var(--brand-primary)`, Stop border references `var(--color-danger)`, neither contains a fractional-alpha rgba (the washed-out shape), both have `linear-gradient` backgrounds with brand RGB tints, label colours still resolve to brand tokens.

**Files**: `src/components/common/RecurrenceDeleteModal.vue`, `tests/unit/recurrence-delete-modal-styles.test.ts`.

---

### ~~BUG-1780~~: Canvas group positions reset to canonical on every launch (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22, v1.3.72)

**Problem**: User drags or resizes a day-group to a new position/size; closes Electron; relaunches; group jumps back to pre-rearrange position. The resize + drag persistence pipeline writes `groups.position_json = {x, y, width, height}` correctly (verified). The regression is on the LOAD side — `src/views/CanvasView.vue:520` runs `runDayGroupCatchup()` as soon as Vue Flow is ready on every launch, which calls `applyCanonicalLayoutMoves(groupMoves)` and overwrites user-arranged positions with canonical values.

**Fix**: Subtractive edit at `CanvasView.vue:514-524` — `runDayGroupCatchup` now skips `applyCanonicalLayoutMoves` and only applies `taskMoves` (dueDate-driven task re-homing on midnight is preserved). `applyCanonicalTaskMoves` has a three-tier fallback for parent-position lookup (groupMoves map → Vue Flow node → canvas store), so passing `[]` makes it use the current user-customized group positions. Explicit canonical layout is still available on demand via the Tidy button (`handleTidyLayout`, unchanged).

**Risk**: BUG-1776 adjacency. Subtractive change; rollback is a one-line revert.

**Files**: `src/views/CanvasView.vue`.

---

### ~~BUG-1779~~: DB-level defense against blank task titles (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-22)

**Problem**: `public.tasks.title` is only `text not null` — empty string accepted. Client-side `toSupabaseTask` sanitizes but any bypass (RPC, direct SQL, future code that forgets the mapper) can write blanks. Defense-in-depth gap exposed by BUG-1777 post-mortem.

**Fix**: New migration `supabase/migrations/20260422T000000_task_title_normalize_trigger.sql` creating `trg_normalize_task_title()` function + `BEFORE INSERT OR UPDATE OF title` trigger on `public.tasks`. Normalizes NULL/empty/whitespace-only titles to `'Untitled Task'` and trims non-blank titles. Applied to VPS production; `pg_trigger` confirms registration.

**Files**: `supabase/migrations/20260422T000000_task_title_normalize_trigger.sql`.

---

### ~~BUG-1778~~: Content fields wiped for 7 tasks (description, priority, due_date, etc.) (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22)

**Problem**: The 2026-04-21 22:54 corruption wiped more than titles. Diff against pg_dump backup `flowstate_20260421_223002.sql.gz` showed lost fields across the 7 previously-blank tasks: `description` (1), `priority` (5), `due_date` (all 7), `estimated_duration` (2), `project_id` (2), `is_pinned` (2), `is_in_inbox` flipped (4 — via BUG-1777 repair side effect). `subtasks`, `tags`, `recurrence_rule`, `depends_on`, `reminders` unchanged in both snapshots — no loss there.

**Fix**: Same non-destructive pattern as BUG-1777 — backup restored into temp DB `bug1777_restore` on VPS, 7 rows extracted as JSONB, loaded into prod via temp table + `UPDATE FROM`. COALESCE for nullable scalars (only restore when current is NULL/empty); direct overwrite for booleans. Single transaction with `RETURNING` verification. All 7 rows updated; pixielabs got its long Hebrew project note back + pinned + 180min + project_id. Temp DB dropped, backup file removed.

**Files**: `scripts/recover-blank-task-titles.sql`, `scripts/recover-titles-from-backup.sh` (reused from BUG-1777).

---

### ~~BUG-1777~~: Blank task titles bypass sync guard, cause "Untitled Task" artifacts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-22, v1.3.71)

**Problem**: 7 tasks in VPS production Supabase have `title = ""` / NULL. They reach the Electron app because `fromSupabaseTask` at `src/utils/supabaseMappers.ts:584` passes `record.title` through unchanged, and `updateTaskFromSync` at `src/stores/tasks.ts:217` only rejected `title === undefined` — empty strings slipped through. The load-time `repairTaskTitles` relabels them "Untitled Task" and is supposed to move them to Inbox, but the user's screenshot on v1.3.70 still shows them on the Canvas "Today" column.

**Root cause (verified)**: `taskValidation.ts:108` treats blank title as a *warning*, so `sanitizeLoadedTasks` passes blanks through. `updateTaskFromSync` guard missed empty strings. Source of the 7 blank rows predates 1.3.69's preventive sanitization.

**Fix**:
1. `src/stores/tasks.ts:217` — replace `title === undefined` guard with `sanitizeTaskTitle()` call. Empty/whitespace/non-string titles become "Untitled Task" at the sync-ingress chokepoint.
2. Deliberately NOT touching `fromSupabaseTask` — the existing `repairTaskTitles` on load depends on seeing blank titles to trigger its inbox-move side effect.
3. VPS recovery: pull original titles from `public.task_audit_log` (indexed by `task_id, event_at DESC`), `UPDATE tasks SET title = … WHERE id = … AND (title IS NULL OR title = '')`. Realtime propagates the restored titles to all clients.
4. Version bump 1.3.70 → 1.3.71 + `./scripts/deploy-electron-update.sh` (CLAUDE.md rules 6 & 7).

**Tests added**:
- `src/utils/__tests__/taskValidation.test.ts` — 10 cases covering `sanitizeTaskTitle` for ''/null/undefined/whitespace/non-string and `repairTaskTitles` counts + side effects (canvasPosition/parentId cleared, isInInbox=true).
- `src/stores/__tests__/tasks.test.ts` — 4 cases on `updateTaskFromSync`: sanitizes '', sanitizes whitespace, still drops missing-id updates, passes valid titles through.

All 43 store tests + 10 validation tests pass. (Pre-existing circular dep `taskValidation.ts ↔ taskOperations.ts` from 1.3.69/1.3.70 is NOT introduced by this fix.)

**Files**: `src/stores/tasks.ts`, `src/utils/__tests__/taskValidation.test.ts`, `src/stores/__tests__/tasks.test.ts`, `package.json`.

**Plan**: `~/.claude/plans/getting-untitled-tasks-in-eventual-seahorse.md`.

---

### ~~BUG-1776~~: Canvas day-group Tidy/Rotate still produces overlap + orphans (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-05-04, v1.4.16)

**Problem**: The Canvas "Tidy day-group layout" button (and the "Rotate day groups" auto/manual path) still produces visually broken state in production despite 10 shipped versions of fixes. Symptoms across v1.3.55 → v1.3.64:
  - Day-groups render at inconsistent widths despite `updateNode({ width, height, style })` in v1.3.64.
  - Adjacent day-groups overlap horizontally (Monday visually collides with Wednesday).
  - Tasks tear out of their parent group and float below it (BUG-1203 `isNodeCompletelyInside` zero-padding detach path).
  - Orphan-recovery pass added in v1.3.64 doesn't visibly rehome previously-detached tasks.
  - Clicking Tidy repeatedly doesn't converge — layout stays wrong.

**What's already shipped (NOT enough)**:
  - v1.3.57: removed xSpread gate + wired catchup on `isVueFlowReady`.
  - v1.3.59: removed `<Teleport to="body">` wrapper from CanvasToolbar (previous "button does nothing" fix).
  - v1.3.60–61: fixed right-click reschedule (`skipDueDateInheritance`, strict exact-date matching).
  - v1.3.62: canonical layout primitive, Tidy button, uniform widths/heights.
  - v1.3.63: bumped `DAY_GROUP_HEIGHT` 920 → 1000 (fixed off-by-40 that overflowed 8th task past parent).
  - v1.3.64: added `width`/`height` top-level fields to `updateNode` (not just style), double `nextTick` before sync release, orphan-rehome pre-pass.

**Perplexity research (external, 2026-04-20)** confirmed Vue Flow 1.48+ internals:
  - `updateNode({ style: { width: '350px' } })` is fragile — must use top-level `width`/`height` fields too. ✅ Applied in v1.3.64.
  - Single `nextTick` lags Vue Flow's dimension bookkeeping. Double `nextTick` or `setTimeout(r, 0)` required. ✅ Applied in v1.3.64.
  - **Unverified suspicion**: when a node has `parentNode` set, its `position` must be RELATIVE to parent. My rotation/tidy writes absolute to store; `useCanvasSync.ts:89` claims to translate abs→rel for parented nodes during sync — but never verified live under the tidy batch conditions. Could still be the root cause.

**Resolution (v1.4.11-v1.4.16)**:
- `useCanvasInteractions.ts` now persists group drags together with descendant task/group absolute positions.
- `useNodeSync.ts` persists nested Vue Flow nodes from relative positions instead of stale `computedPosition`.
- `useCanonicalDayGroupLayout.ts` centralizes group width/height/spacing and task placement.
- `useDayGroupRotation.ts` anchors explicit toolbar rotation to the live weekday clock so weekday-only groups start at today.
- `useTidyLayout.ts` uses today's semantic order for day groups, keeps Tidy compact at `400px`, and stacks tasks vertically with visible spacing instead of widening groups into a horizontal layout.
- `CanvasView.vue` forces Vue Flow node refresh after explicit canonical layout writes to clear stale internal `computedPosition` state.

**Regression coverage**:
- `tests/e2e/canvas-geometry-local.spec.ts` covers real toolbar clicks for compact Tidy, today-first Tidy order, Today/Tomorrow rotation, weekday-only rotation, visible DOM order, group widths, and task spacing.
- `tests/e2e/playwright.canvas-local.config.ts` runs those canvas checks without the Supabase auth global setup.
- `tests/unit/canvas/tidy-layout.test.ts` covers today's semantic order and vertical task stack positions.
- `tests/unit/canvas/day-group-position-rotation.test.ts` covers rotation order, Today/Tomorrow offset, child task positions, and sync suppression release.
- `tests/unit/canvas/canonical-layout.test.ts` covers canonical spacing/size math.

**Verification**:
- `npx playwright test --config tests/e2e/playwright.canvas-local.config.ts` passed 4/4.
- `npx vitest run --maxWorkers=4 tests/unit/canvas/tidy-layout.test.ts tests/unit/canvas/canonical-layout.test.ts tests/unit/canvas/day-group-position-rotation.test.ts` passed 32/32.
- `npm run electron:build` passed.
- Electron updater deployed and manifest verified at `1.4.16`.

**User confirmation**: User reported the Tidy button looks like it is working after v1.4.16.

**Files to revisit** (DON'T blindly re-edit):
  - `src/composables/canvas/useCanonicalDayGroupLayout.ts` — pure layout math (verified correct in 10 unit tests).
  - `src/composables/canvas/useDayGroupRotation.ts` — rotation entry + sort order.
  - `src/composables/canvas/useTidyLayout.ts` — tidy entry + orphan rehome.
  - `src/views/CanvasView.vue::applyCanonicalLayoutMoves` — the updateNode bridge.
  - `src/composables/canvas/useCanvasSync.ts:89` — claims to translate abs→rel for parented nodes. VERIFY THIS ACTUALLY RUNS inside the tidy batch, given `canvasSyncInProgress=true` suppresses sync.

**Risk note**: Do not reintroduce horizontal Tidy task layout for day groups. That was the cause of stretched groups and insufficient vertical spacing.

**Related artifacts**:
  - [SOP-069](./sop/SOP-069-teleport-async-mount-trap.md) — Teleport + async-mount trap (fixed in v1.3.59, still relevant).
  - `src/constants/canvas.ts::DAY_GROUP_*` — canonical layout constants.

---

### ~~TASK-1758~~: Deploy World's Greatest Bot + rename WhatsApp bot to Botty (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-19)

**What was done**:
- Renamed `packages/whatsapp-bot/` → `packages/botty/` (package name, log prefixes, docker-compose service name)
- Deployed Botty to VPS (`/opt/botty/`) — built Docker image, runs on `supabase_default` network, WAHA webhook updated to point to Botty
- Deployed World's Greatest Bot (`/opt/worlds-greatest-bot/`) — Discord bot with voice join notifications, AI posts, activity tracking; registered 17 slash commands; dashboard at `http://84.46.253.137:3049`
- Updated watchpost `bots.json` with both new entries

**Files**: `packages/botty/`, `watchpost/vps/bots.json`

---

### ~~BUG-1773~~: Canvas auto-placement overlaps tasks in day-groups + not left-aligned (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-18)

**Problem**: When tasks are automatically routed into day-of-week groups (on canvas mount via `autoPlaceEligibleTasks`, multi-select "Move to Tomorrow", or "Send to Canvas" from inbox), siblings land at the same starting position or overlap each other, and the first task is indented 20px from the group's left padding instead of being true-left-aligned.

**Goal**: Left-align tasks at the group's padding edge, always stack subsequent tasks vertically with a consistent gap, even across batch placements where reactivity may lag.

**Fix**:
1. `useSmartGroupMatcher.ts::calculatePositionInGroup` — dropped the `+20` empty-group nudge; replaced center-fallback (overlap source) with continued below-stack; added optional `alreadyPlacedPositions` param so batch callers stay immune to reactivity timing
2. `useCanvasAutoPlacement.ts::autoPlaceEligibleTasks` — maintains a local `Map<groupId, positions[]>` across the loop and passes into the helper
3. `useCanvasTaskActions.ts` Move-to-Tomorrow multi-select — same local tracker pattern

**Tests added**: `tests/unit/canvas/smart-group-matcher.test.ts` (5 tests, all green): first-task left-align, stacking gap, batch `alreadyPlacedPositions`, overflow-below-not-center, other-group isolation.

**Files**: `src/composables/canvas/useSmartGroupMatcher.ts`, `src/composables/canvas/useCanvasAutoPlacement.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, `tests/unit/canvas/smart-group-matcher.test.ts`

---

### ~~FEATURE-1774~~: Allow hiding items from Quick Tasks Frequent list (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-18)

**Problem**: The Quick Tasks dropdown's "Frequent" section (derived from tasks with completedPomodoros > 0) had no way to dismiss a specific task. Users who stopped caring about a historically-frequent task had no affordance to hide it.

**Goal**: Add a per-user "hide from Frequent" action that persists locally and filters the list immediately.

**Fix**:
1. `useQuickTasks.ts` — module-scoped `dismissedFrequentIds` Set hydrated from `localStorage['flowstate:dismissed-frequent']`, `dismissFromFrequent(id)` action, `restoreFrequentDismissals()` escape hatch, filter applied in `frequentTasks` computed
2. `QuickTaskDropdown.vue` — X button in the Frequent `v-for` row (before the Pin button), wired via `handleHideFrequent`

**Tests added**: `tests/unit/composables/useQuickTasks-dismiss.test.ts` (3 tests, all green): persists to localStorage, excludes dismissed from `frequentTasks`, restore clears.

**Storage**: localStorage-only (intentionally not cross-device synced — display preference, not task data).

**Files**: `src/composables/useQuickTasks.ts`, `src/components/timer/QuickTaskDropdown.vue`, `tests/unit/composables/useQuickTasks-dismiss.test.ts`

---

### ~~BUG-1775~~: Quick Sort chips mirror sidebar; deletes roll back on remote failure (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-18)

**Problem**: Quick Sort EDIT popover's project chips show projects the user cannot see in the sidebar tree (e.g., `flow-state`, `משחק Blood And Rust` appeared as chips while absent from sidebar). Two defects combine:

1. **CategorySelector flattens what the sidebar hides.** `src/components/layout/CategorySelector.vue:90-133` walks the whole project tree up to depth 10 and slices to `maxShortcuts=9` — zero coupling to `useSidebarManagement.expandedProjects`. Children of collapsed sidebar parents still appear as chips.
2. **Silent remote-delete failures.** `src/stores/projects.ts:271-352` (`deleteProject`) and `:357-429` (`deleteProjects`) splice `_rawProjects` optimistically, then `await deleteProjectRemote(...)`, but catch only logs — no rollback, no toast. A failed remote call leaves UI "deleted" while the server keeps the row. Next fetch/realtime resurrects it.
3. **Inline `!p.parentId` root filters duplicated** across 5 callsites instead of consuming the existing `projectStore.rootProjects`.

Confirmed live on VPS production Supabase — both reported rows have `is_deleted=false`, non-null `parent_id`, identical `updated_at=2026-04-18 08:32:24+00`.

**Goal**: (a) Quick Sort chips reflect exactly what the sidebar tree shows. (b) A failed remote delete restores local state + surfaces an error. (c) One canonical root-projects getter across sidebar, Quick Sort, Kanban, AllTasks, useSidebarManagement.

**Plan**: See `~/.claude/plans/iridescent-stargazing-cat.md`.

**Files**: `src/stores/projects.ts`, `src/stores/tasks.ts`, `src/types/tasks.ts`, `src/components/layout/CategorySelector.vue`, `src/components/sidebar/SidebarProjectsSection.vue`, `src/views/AllTasksView.vue`, `src/components/kanban/KanbanSwimlane.vue`, `src/composables/app/useSidebarManagement.ts`.

---

### ~~TASK-1772~~: Unify Pinned lists — drop pinned_tasks table, use task.isPinned everywhere (✅ DONE)

**Priority**: P2 | **Status**: ✅ **DONE** (2026-04-18)

**Problem**: Calendar view shows two "Pinned" sections with different contents — top-right lightning-icon dropdown (4 shortcut rows from `pinned_tasks` table) vs left Inbox sidebar (1 real task with `isPinned=true`). Two independent systems share one label; user didn't know there were two.

**Goal**: One unified pinned list backed by `task.isPinned`. Every pinned item is a real task editable/removable from any surface.

**Approach**:
1. Rewrite `useQuickTasks.ts` pinned source to computed over `taskStore.tasks.filter(t => t.isPinned)`
2. Rewire pin/unpin/pinFromTask to `taskStore.createTask/updateTask`
3. Rewire KDE widget `main.qml` 3 REST endpoints from `/pinned_tasks` to `/tasks?is_pinned=eq.true`
4. One-time client migration: convert 4 existing `pinned_tasks` rows into real tasks with `isPinned=true`
5. Delete `usePinnedTasksDatabase.ts`, `PinnedTask` type, `pinned_tasks` dbTables entry
6. Supabase migration: `DROP TABLE pinned_tasks CASCADE`
7. Bump version, deploy web + Electron, update KDE widget

**Files**: `src/composables/useQuickTasks.ts`, `src/components/timer/QuickTaskDropdown.vue`, `src/types/quickTasks.ts`, `src/composables/supabase/usePinnedTasksDatabase.ts` (DELETE), `src/constants/dbTables.ts`, `packages/kde-widget/contents/ui/main.qml`, `supabase/migrations/<ts>_drop_pinned_tasks.sql`

---

### BUG-1771: Canvas "Add Task to Group" overlaps existing tasks at group center (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Right-clicking inside a day-group and choosing "Add Task to Group" creates the new task at the geometric center of the group, overlapping existing siblings. Users perceive this as sibling tasks "moving" when in fact only the new node renders on top. The creation path also lacks any diagnostic log for the chosen position.

**Goal**: Use the existing collision-aware `calculatePositionInGroup` helper on the menu path and add two DEV-gated logs that expose the placement decision.

**Approach**:
1. In `createTaskInGroup` else-branch, call `calculatePositionInGroup(group, taskStore._rawTasks)` instead of centering
2. Add `[TASK-CREATE]` log before `finalPosition` compose (group, entry path, sibling count, chosen pos)
3. Add `[TASK-CREATE]` log before `createTaskWithUndo` call (parentId, canvasPosition, isDefaultPosition)
4. Leave `screenPos` branch untouched (drag-to-place path); leave `calculatePositionInGroup` internals untouched

**Files**: `src/composables/canvas/useCanvasTaskActions.ts`

---

### FEATURE-1759: Unified Knowledge + Custom Lists roadmap foundation (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: FlowState is strong as an action system, but it does not yet support a coherent second-brain / data-management workflow or lightweight custom lists like groceries without overloading the task model.

**Goal**: Extend FlowState into a unified action + knowledge system where tasks remain the execution layer, notes become the thinking/reference layer, and custom lists become the lightweight execution layer.

**Approach**:
1. Add a shared content taxonomy and visibility rules first
2. Turn `/catalog` into a real knowledge surface
3. Add note/page workflows optimized for capture and retrieval
4. Add grouped custom lists with lightweight list items
5. Reuse AI and search infrastructure only after the base model is stable

**Files**: `src/types/tasks.ts`, `src/stores/tasks.ts`, `src/views/AllTasksView.vue`, `src/router/index.ts`, `src/services/ai/`, `src/components/common/TiptapEditor.vue`

---

### TASK-1760: Content taxonomy: task, note, list + shared visibility rules (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: The app currently treats most rich content as tasks, but there is no explicit content kind or rules for where notes/lists should appear.

**Goal**: Introduce a minimal content taxonomy so the app can distinguish task, note, and list behavior without splitting into multiple disconnected systems.

**Approach**:
1. Add a content-kind field and shared display rules
2. Define where each kind appears: inbox, board, calendar, catalog, AI context
3. Ensure note/list entities do not pollute scheduling/task-focused views by default
4. Preserve reuse of existing task persistence and offline/sync patterns where possible

**Files**: `src/types/tasks.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/tasks/taskPersistence.ts`, `src/composables/tasks/useTaskFiltering.ts`, `src/utils/supabaseMappers.ts`

---

### TASK-1761: Catalog -> Knowledge Hub MVP with type filters and capture entry (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: `/catalog` is labeled as a knowledge base in UI copy, but it is still just the flat tasks view.

**Goal**: Make Catalog the home for knowledge browsing and capture across tasks, notes, and lists.

**Approach**:
1. Add content-type filters and segmented views
2. Add quick capture entry points for note and list creation
3. Support browsing by project/container/tag/type
4. Preserve fast categorization and bulk actions

**Files**: `src/views/AllTasksView.vue`, `src/layouts/AppHeader.vue`, `src/components/base/FilterControls.vue`, `src/components/filters/SavedViewsDropdown.vue`

---

### TASK-1762: Note/Page MVP using task-based content, markdown, tags, attachments (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: There is no dedicated second-brain note/page workflow despite existing rich-text, attachments, and task description support.

**Goal**: Ship a first useful note/page system without introducing a fully separate note architecture.

**Approach**:
1. Reuse the task-based model for note/page entities
2. Use existing markdown/Tiptap editor and attachment support
3. Support tags and project/container placement
4. Optimize note UX for quick capture and later retrieval
5. Defer full graph/backlink semantics to later tasks

**Files**: `src/types/tasks.ts`, `src/components/common/TiptapEditor.vue`, `src/components/tasks/TaskEditModal.vue`, `src/components/tasks/TaskAttachments.vue`

---

### TASK-1763: Custom Lists MVP: lightweight items, groups, reorder, check off (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: Lists like groceries, packing, shopping, and household supplies are too lightweight and repetitive to model as full tasks by default.

**Goal**: Add list containers with lightweight list items and grouped sections that feel native and fast.

**Approach**:
1. Add list entities and lightweight list items
2. Support grouped sections like Produce, Pantry, Household
3. Support fast add, check/uncheck, drag reorder, regroup, clear completed
4. Keep promotion to full task as an explicit action, not the default

**Files**: `src/types/tasks.ts`, `src/stores/tasks.ts`, `src/views/AllTasksView.vue`, `src/components/tasks/`, `src/components/common/`

---

### TASK-1764: Recurring list templates and reset/reuse workflow (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: Reusable lists such as weekly groceries or packing checklists need a reset/template workflow, not task recurrence semantics.

**Goal**: Allow a list to be reused or regenerated on demand and optionally on a recurring schedule.

**Approach**:
1. Add list template/reset behavior
2. Support duplicate-from-template and clear-completed reset
3. Add optional recurrence for list regeneration
4. Keep this separate from task clone-on-complete recurrence rules

**Files**: `src/types/tasks.ts`, `src/stores/tasks/taskOperations.ts`, `src/stores/tasks/taskPersistence.ts`, `src/types/recurrence.ts`

---

### TASK-1765: Unified search across tasks, notes, and lists (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Problem**: A second brain is only useful if capture and retrieval are excellent; current search is task-centric.

**Goal**: Make search a cross-content retrieval surface for tasks, notes, lists, and list items where appropriate.

**Approach**:
1. Extend search indexing/filtering across content kinds
2. Search title, body, tags, project/container, and list/group names
3. Add content-type and scope filters
4. Defer semantic/vector search until structured search proves insufficient

**Files**: `src/components/layout/SearchModal.vue`, `src/composables/tasks/useTaskFiltering.ts`, `src/services/ai/tools.ts`, `src/stores/tasks.ts`

---

### TASK-1766: Promote note or list item into full task flow (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: Some notes and list items become actionable, but there is no explicit conversion flow.

**Goal**: Let users promote lightweight knowledge/list content into full tasks with minimal friction.

**Approach**:
1. Add "Convert to task" or "Promote to task" actions
2. Preserve source context and backlinks/reference where useful
3. Optionally prefill project, due date, tags, and metadata
4. Keep the original source item intact unless user chooses move/replace semantics

**Files**: `src/stores/tasks/taskOperations.ts`, `src/components/tasks/TaskContextMenu.vue`, `src/components/tasks/TaskEditModal.vue`

---

### TASK-1767: AI can read notes/lists and turn them into useful actions (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED

**Problem**: AI memory/context currently leans on task/work-profile data, not on a richer personal knowledge layer.

**Goal**: Let AI search notes/lists, summarize them, and convert them into useful actions or plans.

**Approach**:
1. Expose notes/lists to AI retrieval tools and user context building
2. Add flows like summarize note, extract actions, build grocery list, regroup list items
3. Feed note/list interactions into existing work-profile and memory graph systems
4. Defer embeddings/RAG until normal structured retrieval is in place

**Files**: `src/services/ai/tools.ts`, `src/services/ai/userContext.ts`, `src/composables/useWorkProfile.ts`, `src/stores/aiChat.ts`

---

### ~~TASK-1768~~: Persist mini-canvas planning notes for knowledge workflows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-02)

**Problem**: `planningNotes` already existed and were a strong fit for second-brain thinking, but persistence was deferred — three commented placeholders in `src/utils/supabaseMappers.ts` skipped the field, so notes vanished on reload.

**Resolution**: Stored as `planning_notes JSONB DEFAULT '[]'` on the `tasks` table (mirrors the existing `subtasks` jsonb pattern — same offline queue, same realtime sync, same RLS).

1. ✅ New migration `20260502000000_add_planning_notes_to_tasks.sql` (idempotent — column already existed locally; migration locks it in git for production parity).
2. ✅ Uncommented three lines in `src/utils/supabaseMappers.ts` (row-type field, `toSupabaseTask` write, `fromSupabaseTask` read) and added `PlanningNote` to imports.
3. ✅ Round-trip verified by new unit test in `tests/unit/data-integrity-crud.test.ts` ("planningNotes JSONB array preserves structure after round-trip"). Contract test allowlist updated in `tests/contract/api-contract.test.ts`.
4. ⏳ Production migration application — needs explicit user approval before SSH'ing to VPS.

**Files**: `src/utils/supabaseMappers.ts`, `supabase/migrations/20260502000000_add_planning_notes_to_tasks.sql`, `tests/unit/data-integrity-crud.test.ts`, `tests/contract/api-contract.test.ts`. No client-code changes needed — `useMiniCanvasActions.ts` already wrote `task.planningNotes` through `taskStore.updateTask`.

**Out of scope** (separate tasks): TASK-1767 (AI context from notes), TASK-1769 (backlinks), separate `planning_notes` table for cross-task sharing.

---

### TASK-1769: Lightweight links/backlinks between notes and tasks (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

**Problem**: Capture and search are the first priority, but over time note-to-note and note-to-task relationships will matter.

**Goal**: Add simple explicit links/backlinks without committing to a heavy graph feature too early.

**Approach**:
1. Support explicit references between tasks, notes, and lists
2. Show related items in detail views
3. Track backlinks automatically where practical
4. Defer graph visualization and advanced knowledge navigation

**Files**: `src/types/tasks.ts`, `src/components/tasks/TaskEditModal.vue`, `src/views/AllTasksView.vue`, `src/services/ai/`

---

### ~~BUG-1758~~: Inbox Canvas Order sort ignored X for same-Y rows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-12)

- Calendar, Board (Unified) and Mobile inboxes sorted canvas-order tasks by `canvasPosition.y` only
- Grid rows (multiple tasks sharing a Y) came out in arbitrary array order instead of matching canvas reading order
- Added an X tiebreaker driven by `useDirection().isRTL` (LTR: left→right, RTL: right→left)
- Made group-level X sort direction-aware in the same pass (preserves existing RTL behavior, fixes LTR)
- Confirmed root cause against the user's real DB: rows at y=210/440/670/900/1130 with 4 tasks each at distinct X

**Files**: `src/composables/inbox/useCalendarInboxState.ts`, `src/composables/inbox/useUnifiedInboxState.ts`, `src/mobile/composables/useMobileInboxLogic.ts`, `src/composables/inbox/__tests__/useUnifiedInboxState.spec.ts`

---

### ~~BUG-1794~~: Rotate day groups sends same-day Saturday tasks to next Saturday (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-29)

**Problem**: Pressing **Rotate day groups** with Today/Tomorrow smart groups present could resolve the current weekday group to next week. A Saturday group on Saturday wrote task `dueDate` to next Saturday instead of today.

**Fix**: `getDayGroupDate()` now treats weekday groups as the literal next occurrence including today, regardless of Today/Tomorrow groups. Today/Tomorrow still win automatic placement through matcher specificity instead of forcing weekday groups a week forward.

**Verified**: `npm run test -- tests/unit/canvas/day-group-date-suffix.test.ts tests/unit/canvas/day-group-catchup.test.ts tests/unit/canvas/smart-group-matcher.test.ts tests/unit/canvas/day-group-position-rotation.test.ts` (41/41), `npm run type-check`, `npx eslint src/utils/dayGroupDate.ts`, `npm run electron:build` for v1.4.79, `./scripts/deploy-electron-update.sh --notes "Fix rotate day groups keeping same-day Saturday tasks on today"`, public updater manifest check. Full `npm run lint` still reports repo-wide pre-existing lint debt; touched source file is clean.

**Release status**: v1.4.79 deployed to the Electron updater. `https://in-theflow.com/updates/electron/latest-linux.yml` returns `version: 1.4.79`.

**Files**: `src/utils/dayGroupDate.ts`, `tests/unit/canvas/day-group-date-suffix.test.ts`, `tests/unit/canvas/day-group-catchup.test.ts`, `tests/unit/canvas/smart-group-matcher.test.ts`.

---

### ~~TASK-1756~~: Canvas day group date rotation + dynamic Today/Tomorrow dates (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-19)

**Final fix (2026-04-19, shipped as v1.3.59)**: The real blocker turned out to be a `<Teleport to="body">` wrapper in `CanvasToolbar.vue` — it left the toolbar's click handler bound to a component instance whose parent link got severed by an async-mount race, so `$emit('rotateDayGroups')` was a silent no-op. Removed the Teleport entirely (CanvasView already renders CanvasToolbar as a sibling to VueFlow, so `position: fixed` works without Teleport). See [SOP-069](./sop/SOP-069-teleport-async-mount-trap.md) for the full write-up. Companion improvements shipped in the same release: persisted `lastRotationDate` guard via `useStorage`, `useCurrentDay` now listens to `pageshow`/`focus`/`online`, catchup wiring keyed on `isVueFlowReady`. 88 unit tests green.

**Reopen reason (2026-04-17)**: User reports day-of-week groups still don't update to the correct dates. Today is Friday 17.4.26 — reproducing in dev to capture exact failure mode before patching.

**Fix applied 2026-04-17** (commit pending):

1. **Shared date helper** — new `src/utils/dayGroupDate.ts::getDayGroupDate()` used by both the group header (`GroupNodeSimple.vue`) and rotation (`useDayGroupRotation.ts`). Removes the formula drift that caused header suffix and rotation dueDate to disagree.
2. **`|| 7` bug** — the old `((…) % 7) || 7` fall-through in `GroupNodeSimple.vue` turned today=target into +7 days. Fixed. The Friday group on a Friday now shows today (17.4.26) instead of next Friday when no Today/Tomorrow smart group exists. Live-verified in dev server: Friday=17.4.26, Monday=20.4.26.
3. **Midnight reactivity** — new singleton composable `src/composables/useCurrentDay.ts` exposes a reactive "today" ref that flips at 00:00 and on tab-visibility regain. `dayOfWeekDateSuffix` + `currentTargetTimestamp` in `GroupNodeSimple.vue` now depend on this ref, so the header label re-renders at midnight without a reload.
4. **onMoves / Vue Flow bridge** — confirmed `applyDayGroupMoves` in `CanvasView.vue:362` calls `updateNode` with `section-`-prefixed IDs, wiring the rotation to the Vue Flow node layout. Added `tests/unit/canvas/day-group-onmoves.test.ts` (5 tests) pinning: return payload uses `section-<id>`, midnight callback fires with correct payload, feature-flag off suppresses callback, no-op when already sorted, `getNodePosition` overrides stale store positions.

**Test coverage** (all green as of 2026-04-17):
- `tests/unit/canvas/day-group-date-suffix.test.ts` (7 tests)
- `tests/unit/composables/useCurrentDay.test.ts` (3 tests)
- `tests/unit/canvas/day-group-onmoves.test.ts` (5 tests)
- `tests/unit/canvas/day-group-position-rotation.test.ts` (11 tests, pre-existing)
- Total: 77 canvas + composables tests green, no new TS errors.

**Live verification** (dev server, Friday 2026-04-17 14:18):
- "Friday" group header reads `17.4.26` (today). "Monday" reads `20.4.26` (+3 days).
- "Rotate day groups" toolbar button fires `[DAY-ROTATION]` logs with correct sort order (Friday first as today).
- "2 day groups updated for today" banner shown after rotation.

**Symptoms to verify in-app** (Friday 2026-04-17):
- Day-of-week group for today's weekday shows next week's date (e.g. Friday group shows 24.4 instead of 17.4) when no Today/Tomorrow smart group exists — **should be fixed** by formula change.
- Visual position rotation still pending from prior pass (Vue Flow controlled-mode blocker).
- Possible regression interacting with BUG-1757 fix (dueDate edit leaving task in old group).

**Previous scope (2026-04-11, now partial; corrected by BUG-1794 on 2026-05-29)**:
- Today/Tomorrow smart groups show dynamic date suffixes (e.g., "Today / 11.4.26")
- Day-of-week groups no longer skip dates covered by Today/Tomorrow; placement priority handles overlaps.
- Rotation button (CalendarClock icon) in canvas toolbar
- Midnight auto-rotation updates task dueDates, respects weekStartsOn
- Visual position rotation pending — algorithm works but Vue Flow controlled-mode prevents visual updates

**Files**: `src/composables/canvas/useDayGroupRotation.ts`, `src/components/canvas/GroupNodeSimple.vue`, `src/components/canvas/CanvasToolbar.vue`, `src/views/CanvasView.vue`, `src/stores/settings.ts`

---

### ~~TASK-1753~~: Constitution reminder PreToolUse hook (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-05)

**Problem**: Constitution and project docs are referenced in CLAUDE.md but no enforcement exists — agents could skip reading them.

**Changes**: Added `.claude/hooks/constitution-reminder.sh` PreToolUse hook. Fires once per session on first source file edit, reminds agent to check Constitution + project docs. Never blocks. Skips docs, tests, configs.

**Files**: `.claude/hooks/constitution-reminder.sh`, `.claude/settings.json`

---

### ~~TASK-1751~~: Documentation deep audit + Constitution extraction (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-05)

**Problem**: Core documentation (system-architecture.md, design-system.md, SOPs, CLAUDE.md) had significant staleness — wrong values, missing features, dead Tauri references — causing AI agents to make incorrect decisions.

**Changes**:
- Fixed CLAUDE.md: all Tauri→Electron refs (13 locations), table count 19→32
- Fixed design-system.md: 5 wrong glass-bg opacity values, 12 missing BaseModal props, 7 new token subsystems
- Fixed system-architecture.md: version, counts, 5 missing directories
- Archived 6 dead Tauri SOPs, fixed SOP-065 ID collision, corrected README
- Created `~/.claude/knowledge/constitution.md` (167 lines) — reusable dev standards
- Slimmed CLAUDE.md from 476→405 lines by extracting universal rules to Constitution

**Files**: `CLAUDE.md`, `docs/claude-md-extension/design-system.md`, `docs/claude-md-extension/system-architecture.md`, `docs/sop/` (20+ files), `~/.claude/knowledge/constitution.md`

---

### ~~TASK-1744~~: Redesign Inbox Filter/Sort into Compact Toolbar (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-03)

**Summary**: Replaced the multi-row sort buttons + filter chips (consuming ~40% viewport) with a single 32px compact toolbar. Sort dropdown collapses 5 buttons into 1, filter popover organizes all options in sections, active filter pills show only enabled filters as removable pills. ~60% vertical space reduction.

**Files**:
- `src/components/inbox/unified/InboxSortDropdown.vue` (new)
- `src/components/inbox/unified/InboxFilterPopover.vue` (new)
- `src/components/inbox/unified/ActiveFilterPills.vue` (new)
- `src/components/inbox/unified/InboxToolbar.vue` (new)
- `src/components/inbox/unified/UnifiedInboxHeader.vue` (modified)
- `src/components/inbox/UnifiedInboxPanel.vue` (modified)

---

### ~~TASK-1741~~: Regression Test Gap Analysis + Fix Pre-Existing Failures (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01)

**Summary**: Architect-driven gap analysis identified the top 5 untested critical systems. Wrote 71 regression tests across 5 new files covering: supabase mappers (28 tests, guards BUG-1211/1286/1562), smart merge algorithm (12 tests, guards BUG-1738), timer race guard (5 tests, guards BUG-TIMER-RACE), recurrence scheduler (12 tests), and cross-tab sync (10 tests). Also fixed all 14 pre-existing test failures caused by stale Tauri assertions after TASK-1718 Electron migration, version drift, and missing allow-list entries.

**Files**:
- `tests/unit/utils/supabaseMappers.test.ts` (new, 28 tests)
- `tests/unit/stores/smart-merge.test.ts` (new, 12 tests)
- `tests/unit/stores/timer-race-guard.test.ts` (new, 5 tests)
- `tests/unit/composables/recurrence-scheduler.test.ts` (new, 12 tests)
- `tests/unit/sync/cross-tab-sync.test.ts` (new, 10 tests)
- 8 existing test/config files updated to fix 14 failures

**Result**: 95 files, 1959 tests, all passing (0 failures).

---

### ~~BUG-1741~~: Switching Shared→Personal Workspace Doesn't Load Tasks (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-02)

**Root cause**: Race condition in `switchWorkspace()` — presence disconnect hung on a dead channel. The watch in `useAppInitialization.ts` called `removeAllChannels()` when `activeWorkspaceId` changed, killing the presence channel before `switchWorkspace` could cleanly disconnect it. Also added re-entry guard to prevent concurrent switch calls.

**Fix**: (1) Disconnect presence BEFORE changing `activeWorkspaceId`, (2) add `isSwitchingWorkspace` re-entry guard.

**Files**: `src/stores/workspace.ts`

---

### BUG-1743: PWA blank screen when fully offline (🔄 IN PROGRESS)

**Priority**: P1-HIGH | **Status**: 🔄 IN PROGRESS

**Problem**: PWA shows blank screen when opened offline with expired JWT. Auth `refreshSession()` blocks the entire init chain — no timeout, no fallback to cached data.

**Root causes**:
1. `useAppInitialization.ts:57` — Cache load (Phase A) gated behind `await authStore.initialize()` which makes network calls
2. `auth.ts:210` — `refreshSession()` has no timeout; hangs indefinitely on flaky networks
3. `auth.ts:263-269` — Failed refresh wipes session (`user.value = null`), preventing cached data load even when IndexedDB has data

**Fixes**:
1. Add 5s AbortController timeout to `refreshSession()` in auth.ts
2. Reorder init: load IndexedDB cache BEFORE auth (cache doesn't need auth)
3. Keep expired session when refresh fails and IndexedDB has cached data (extend grace period)

**Files**: `src/stores/auth.ts`, `src/composables/app/useAppInitialization.ts`

---

### ~~BUG-1742~~: Calendar: can't schedule tasks between hours (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-02)

**Problem**: Three calendar issues prevented scheduling tasks at half-hour boundaries (e.g. 3:30-4:30 PM). Also fixed a crash in AllTasksView and useMobileInboxLogic when sorting by title on tasks with undefined title.

**Root causes**:
1. QuickTaskCreate end time input was cosmetic — ignored by duration dropdown, no bidirectional binding
2. Week view drag-to-create hardcoded `minute: 0` for calculated end time
3. Week view double-click to create hardcoded `minute: 0` for calculated end time
4. Sort by title crashed on undefined title in AllTasksView and useMobileInboxLogic

**Fixes**:
- QuickTaskCreate end time input now wired bidirectionally with duration dropdown
- Week view drag-to-create and double-click now respect half-hour precision
- Sort comparators now handle undefined title gracefully

**Files**: `src/components/calendar/CalendarDayView.vue`, `src/components/calendar/CalendarWeekView.vue`, `src/views/AllTasksView.vue`, `src/composables/mobile/useMobileInboxLogic.ts`

---

### ~~BUG-1740~~: Leave/Delete Workspace Does Nothing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Fix**: Added `leaveWorkspace()` store action + "Delete Workspace" button for owners. Both remove workspace locally and switch to personal.

**Files**: `src/stores/workspace.ts`, `src/components/settings/tabs/WorkspaceSettingsTab.vue`, i18n locales

---

### ~~BUG-1739~~: Canvas Bulk Delete Stops Working After First Delete (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE

**Problem**: When deleting multiple tasks from canvas sequentially (not Shift+Delete), after a few deletions the delete stops working. The confirmation modal appears but pressing confirm does nothing.

**Root Cause**: `undoSingleton.ts:783` — `commitOperation` accesses `pendingOperation.description` but `pendingOperation` is `null`. The undo singleton tracks only one pending operation at a time. Rapid sequential deletes from canvas bulk-delete (`useCanvasTaskActions.ts:408 confirmBulkDelete`) each call `deleteTaskWithUndo` which calls `commitOperation`, but the first delete consumes `pendingOperation`, leaving it `null` for subsequent deletes.

**Error**: `TypeError: can't access property "description", pendingOperation is null` at `undoSingleton.ts:783`

**Stacktrace path**: `confirmBulkDelete → deleteTaskWithUndo → commitOperation → pendingOperation.description (null)`

**Fix**: Canvas Delete key now removes tasks from canvas only (moves to inbox) instead of soft-deleting from system. Shift+Delete still performs actual deletion. Ctrl+Z undo works for both. Batch delete uses single undo operation (`beginOperation` once, delete all, `commitOperation` once) to avoid race conditions with drag settling.

**Files**: `src/composables/canvas/useCanvasTaskActions.ts:408`, `src/stores/undoSingleton.ts:783`

---

### ~~BUG-1738~~: Workspace Switch Causes Task Deletion — Data Integrity (✅ DONE)

**Priority**: P0 (Critical) | **Status**: ✅ DONE (2026-04-04)

**Problem**: Switching workspaces triggers a cascade that soft-deletes real tasks from the production database. Affects all users with multiple workspaces.

**Root Cause Chain** (verified from production logs 2026-03-31):
1. User switches workspace (`personal → other-workspace`)
2. Other workspace loads with 0 groups, 2 tasks
3. Canvas sync (BUG-1203 stale parentId cleanup) sees tasks with `parentId` pointing to groups from the **previous** workspace → clears their `parentId` because groups "don't exist" in current workspace
4. When switching back to personal workspace, `SMART-MERGE` sees ~130 tasks modified locally (parentId cleared) that "don't match the DB" → drops them as "stale local-only"
5. Dropped tasks trigger `deleteTask()` → **soft-deletes real tasks from production DB**
6. Result: 26 tasks soft-deleted, user sees "most tasks disappeared"

**Evidence**: Production DB showed 26 tasks soft-deleted between 12:22–22:23 on 2026-03-31. All restored via `UPDATE tasks SET is_deleted = false`.

**Fix Strategy** (multi-layer):

1. **BUG-1203 scope guard** — `useCanvasSync.ts` line 454: Before clearing `parentId`, verify the group truly doesn't exist in the **current workspace's** group set. During workspace transitions (groups=0 transient state), skip the cleanup entirely.
   - File: `src/composables/canvas/useCanvasSync.ts`
   - Guard: `if (canvasStore._rawGroups.length === 0) return` — don't clear parentIds when no groups loaded

2. **SMART-MERGE guard** — Don't drop local-only tasks during workspace switch transitions. Add a `isWorkspaceSwitching` flag that suppresses the "stale local-only" logic.
   - File: `src/stores/tasks/taskPersistence.ts` (or wherever SMART-MERGE runs)
   - Guard: skip dropping during `workspaceStore.isSwitching`

3. **Canvas sync workspace scope** — `syncStoreToCanvas` should only process tasks belonging to the current workspace. Filter tasks by `workspace_id` before sync.
   - File: `src/composables/canvas/useCanvasSync.ts`

4. **Delete safety net** — Before any batch soft-delete triggered by sync/merge, log the count and require threshold confirmation (e.g., refuse to delete >5 tasks in a single sync cycle without explicit user action).
   - File: `src/composables/supabase/useTasksDatabase.ts`

**Testing**:
- [ ] Switch workspaces back and forth 5 times — zero task count changes
- [ ] Switch to empty workspace and back — all tasks preserved
- [ ] Canvas parentIds survive workspace round-trip

**Dependencies**: None (standalone fix)

---

### ~~TASK-1734~~: Task Audit Log — Forensic Task Lifecycle Tracker (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: When tasks disappear, there's no way to definitively answer "what happened to my task about X?". Tombstones only store UUIDs (no title/content), and hard-deleted tasks lose their identity entirely.

**Solution**: Postgres trigger-based immutable audit log (`task_audit_log` table) that automatically captures every task lifecycle event (CREATED, SOFT_DELETED, RESTORED, STATUS_CHANGED, HARD_DELETED) with the task's title and key fields. Uses `pg_trgm` for fuzzy title search. Immutable via Postgres rules (no UPDATE/DELETE). Test user events excluded via email pattern check.

**Files**: `supabase/migrations/20260329120000_task_audit_log.sql`, `src/composables/supabase/useTaskAuditLog.ts`, `src/composables/supabase/index.ts`

---

### BUG-1737: Canvas Delete + Ctrl+Z undo unreliable — task reappears then vanishes (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: After deleting a task on canvas and pressing Ctrl+Z, the task sometimes reappears briefly then vanishes again due to race conditions in the dual-write delete architecture.

**Root cause**: `deleteTask()` both enqueues a sync queue DELETE and directly soft-deletes in Supabase. Undo cancels the queue DELETE but the direct soft-delete's realtime echo re-splices the restored task. Secondary: sync queue DELETE-cancels-CREATE swallows undo's CREATE.

**Files**: `src/composables/undoSingleton.ts`, `src/stores/tasks/taskOperations.ts`, `src/services/offline/writeQueueDB.ts`

---

### ~~BUG-1736~~: Flaky E2E — "create task in Canvas → node appears" fails on WebKit (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Problem**: Playwright E2E test `crud-workflows.spec.ts:429` intermittently fails on WebKit. Likely a timing issue with Vue Flow node mounting.

**Files**: `tests/e2e/crud-workflows.spec.ts`

---

### ~~BUG-1735~~: KDE widget calendar block shows pomodoro time instead of scheduled duration (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: KDE system tray widget's "Xm" calendar block countdown displayed pomodoro remaining time instead of the actual calendar event's wall-clock remaining time. A 60-min scheduled block showed "21m" (pomodoro countdown) instead of the true remaining calendar time.

**Root cause**: `updateCurrentBlock()` in `main.qml` had logic that (1) extended the calendar block's end time when pomodoro ran past it, and (2) used `Math.ceil(root.secondsRemaining / 60)` (pomodoro time) instead of `endMinutes - nowMinutes` (calendar time) when a timer was active.

**Fix**: Removed block extension logic and simplified `bestMinutesLeft` to always use `endMinutes - nowMinutes`. The circular pomodoro timer continues showing pomodoro countdown independently.

**Files**: `packages/kde-widget/contents/ui/main.qml`

---

### ~~TASK-1730~~: Fix Electron OAuth Google sign-in flow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: `signInWithGoogle()` in `src/stores/auth.ts` has branches for Tauri and Capacitor but no branch for Electron. It falls through to the PWA path which calls `supabase.auth.signInWithOAuth()` with `redirectTo: window.location.origin` — which in Electron's `file://` context navigates the window to the production website, losing app context and the electronStorage adapter.

**Fix**:
1. Add Electron branch in `signInWithGoogle()` using `skipBrowserRedirect: true` + `openExternal()` to open OAuth URL in system browser
2. Add `will-navigate` interceptor in `electron/main.ts` to catch the OAuth callback and inject the auth code into the renderer
3. Add `electron-auth-code` event listener in auth.ts to exchange the code for a session
4. Create `public/auth/callback/index.html` as the OAuth redirect landing page

**Files**: `src/stores/auth.ts`, `electron/main.ts`, `public/auth/callback/index.html`

---

### ~~BUG-1733~~: Production errors — FK violation, dev CSS preload, undo safeClone SyntaxError (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-28)

**Problems fixed**:
1. `tasks_parent_id_fkey` FK violation — orphaned constraint on production DB blocks task sync
2. `/src/assets/styles.css` 404 in production — hardcoded dev path in preload
3. `permanentlyDeleteTaskWithUndo` SyntaxError — `safeClone()` returns Vue reactive proxies
4. `claim_timer_leadership` RPC 404 — migration not deployed to production

**Fix**: Dropped orphaned FK constraint via migration, removed dead CSS preload from main.ts, added `toRaw()` to undo safeClone. Timer RPC requires manual migration deploy.

**Files**: `src/main.ts`, `src/composables/undoSingleton.ts`, `supabase/migrations/20260327120000_drop_tasks_parent_id_fkey.sql`

---

### ~~BUG-1726~~: `useBeforeUnload()` called outside setup context in useAppInitialization.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-30)

**Problem**: Vue warns that `useBeforeUnload()` is being called outside a component setup context. The call in `useAppInitialization.ts` needs to be moved or restructured so it runs during the component's `setup()` phase.

**Fix**: Removed duplicate `useBeforeUnload()` call from `MainLayout.vue`. The composable was already correctly called in `useAppInitialization.ts` (via `App.vue` setup context). The duplicate in MainLayout could fire outside proper setup timing.

**Files**: `src/layouts/MainLayout.vue`

---

### ~~BUG-1727~~: BaseModal extraneous non-props attributes warning (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-31) — Duplicate of BUG-1724

**Problem**: Vue warns about extraneous non-props attributes being passed to `BaseModal`. The component needs `inheritAttrs: false` added to its options so it can control where attrs are applied (typically the inner wrapper, not the fragment root).

**Resolution**: Already fixed by BUG-1724 (`defineOptions({ inheritAttrs: false })` added at line 105). No callers pass extraneous attrs.

**Files**: `src/components/base/BaseModal.vue`

---

### ~~BUG-1728~~: Projects store sync race condition (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-31)

**Problem**: Projects store has a sync race condition — concurrent sync operations can interleave and produce inconsistent state. Needs a `syncUpdateInProgress` guard flag to prevent overlapping sync calls.

**Fix**: Added promise-based deduplication to `loadProjectsFromDatabase()`. If a load is already in flight, concurrent callers await the same promise instead of starting a new one.

**Files**: `src/stores/projects.ts` (or equivalent projects store)

---

### ~~BUG-1729~~: CanvasView duplicate attribute in template (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE

**Problem**: `CanvasView.vue` template has a duplicate attribute on an element, causing a Vue compile warning. The duplicate attribute needs to be identified and removed.

**Files**: `src/views/CanvasView.vue`

---

### ~~BUG-1717~~: Fix `ref is not defined` runtime error in CanvasView production build (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-28)

**Problem**: Production build (both web and Electron) throws `ReferenceError: ref is not defined` at `CanvasView-*.js:2:151250` during the `setup()` function. The error crashes the Canvas view. All source files correctly import `ref` from `vue` — the issue is in the production bundle (tree-shaking or chunk splitting bug).

**Impact**: Canvas view broken in production web (`in-theflow.com`) and Electron. Board/Calendar/Catalog views work fine.

**Fix**: `src/stores/canvasTaskBridge.ts` uses module-level `ref()` calls that evaluate at import time. Pinned the module to the `vue-vendor` manualChunks entry in `vite.config.ts` so it always bundles in the same chunk as Vue, eliminating the chunk-ordering race condition.

**Files changed**: `vite.config.ts` (manualChunks), `src/stores/canvasTaskBridge.ts` (BUG-1717 comment)

---

### BUG-1723: Supabase Realtime connection drops with CHANNEL_ERROR cycling (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-04-04)

---

### ~~BUG-1724~~: BaseModal Vue warning — extraneous class attribute on fragment root (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-25)

---

### ~~BUG-1725~~: Lifecycle hooks called outside component setup context (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

---

### ~~BUG-1731~~: Electron auth persistence — sessions lost on app restart (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Electron's `file://` protocol didn't reliably persist localStorage across app restarts. Auth tokens were lost and users were logged out after closing and reopening the app.

**Fix**:
1. **electronStorage adapter** — IPC-backed storage adapter that routes auth tokens through `electron-store` disk-backed store (survives restarts)
2. **localhost HTTP OAuth server** — Same pattern as Tauri: start `http://localhost:3001` server in Electron main process to capture OAuth callback (since `file://` can't handle redirects)
3. **Settings > Account Updates section** — Added in Electron to show auto-updater status (parallel to Tauri)

**Files**: `src/services/auth/electronStorage.ts`, `src/composables/useElectronAuth.ts`, `electron/ipc/auth.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`

---

### ~~BUG-1732~~: Canvas group badge counts task not rendered (parentId without canvasPosition) (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-26)

---

### ~~TASK-1718~~: Electron Phase 2 — Platform Detection Swap (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Replace all Tauri detection with Electron detection.

**Tasks**:
1. Update `src/utils/platform.ts`: add `isElectron()` using `window.electronAPI !== undefined`
2. Update all 9 raw `window.__TAURI__` / `window.__TAURI_INTERNALS__` checks across the codebase
3. Update `src/main.ts`: swap `.tauri-app` class → `.electron-app` (or remove entirely since Electron = Chromium)
4. Delete 186 `.tauri-app` CSS rules from `src/assets/styles.css` — Electron uses Chromium, no WebKitGTK workarounds needed
5. Update `vite.config.ts`: swap `isTauri` → `isElectron` for PWA disable logic

**Files to modify**: `src/utils/platform.ts`, `src/main.ts`, `src/assets/styles.css`, `vite.config.ts`, + 9 files with raw `__TAURI__` checks

---

### ~~TASK-1719~~: Electron Phase 3 — IPC Handlers (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Create Electron IPC handlers to replace Tauri's 13 `invoke()` commands and 10 plugins.

**Tasks**:
1. Create `electron/ipc/shell.ts` — `shell.openExternal()` for URLs, `child_process.exec()` for Docker/Supabase
2. Create `electron/ipc/store.ts` — `electron-store` for settings persistence (replaces `@tauri-apps/plugin-store`)
3. Create `electron/ipc/fs.ts` — Node.js `fs` for auth token file at `~/.config/flowstate`
4. Create `electron/ipc/dialog.ts` — `dialog.showSaveDialog()` for backup export
5. Create `electron/ipc/http.ts` — Node.js `fetch` in main process for CORS-free requests (Ollama, iCal)
6. Register all handlers in `electron/main.ts`
7. Update renderer-side composables to use `window.electronAPI.invoke()` instead of Tauri `invoke()`

**Composables to update**: `useTauriStartup.ts` → `useElectronStartup.ts`, `usePersistentRef.ts`, `backup/backupExport.ts`, `useTauriOAuth.ts`, `useTauriUpdater.ts`, `useTauriDebug.ts`

---

### ~~TASK-1720~~: Electron Phase 4 — Auto-Updater + Deploy Pipeline (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Set up `electron-updater` and deploy pipeline to VPS.

**Tasks**:
1. Install `electron-updater`
2. Create `electron/updater.ts` — check/download/install flow
3. Rewrite `scripts/deploy-tauri-update.sh` → `scripts/deploy-electron-update.sh`
4. Update VPS to serve Electron updates at `/updates/electron/`
5. Update `TauriUpdateNotification.vue` → `ElectronUpdateNotification.vue`
6. First production Electron build + deploy
7. Verify auto-update works end-to-end

---

### ~~TASK-1721~~: Electron Phase 5 — Cleanup & CI/CD (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

**Scope**: Clean up Tauri remnants and set up CI/CD for Electron.

**Tasks**:
1. Remove `src-tauri/` from active development (keep in git history at `tauri-archive-v1.3.28` tag)
2. Remove all `@tauri-apps/*` npm dependencies
3. Update `.github/workflows/` for Electron builds
4. Update CLAUDE.md — replace Tauri references with Electron
5. Update `docs/sop/SOP-011-tauri-distribution.md` → Electron distribution SOP
6. Final E2E test run to verify nothing broke

---

### ~~TASK-1715~~: Migrate Desktop App from Tauri to Electron (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-25) | **Archive**: `tauri-archive-v1.3.28`

**Why**: WebKitGTK (Tauri) has too many rendering bugs vs Chromium. Electron uses Chromium = zero CSS parity issues with web app.

**Scope**: Replace Tauri shell only. Vue 3 + Vite frontend stays identical.

**Phase 1: Electron Setup (Foundation)** ✅
- [x] Install electron, electron-builder, electron-updater
- [x] Create `electron/main.ts` (main process), `electron/preload.ts`
- [x] Configure Vite for Electron (manual, `base: './'`)
- [x] Basic window opens with the Vue app

**Phase 2: Platform Detection Swap** ✅ (TASK-1718)
- [x] Update `src/utils/platform.ts`: `isElectron()` via `window.electronAPI`, `isTauri()` returns false
- [x] Update all 3 raw `window.__TAURI__` checks
- [x] Delete 38 `.tauri-app` CSS rule blocks — Electron uses Chromium, no workarounds needed
- [x] Add `.electron-app` class in `main.ts`

**Phase 3+4: IPC Handlers + Plugin Replacements** ✅ (TASK-1719)
- [x] `electron/ipc/shell.ts` — `shell.openExternal()`
- [x] `electron/ipc/store.ts` — JSON key-value store (replaces `@tauri-apps/plugin-store`)
- [x] `electron/ipc/fs.ts` — Node.js `fs` via IPC
- [x] `electron/ipc/dialog.ts` — `dialog.showSaveDialog()`
- [x] `electron/ipc/http.ts` — `net.fetch` in main process (CORS bypass)
- [x] `electron/ipc/window.ts` — minimize, maximize, close
- [x] All handlers registered in `electron/main.ts`

**Remaining (separate tasks):**
- Phase 5: Auto-updater → TASK-1720
- Phase 6: Build & Deploy → TASK-1721

**Files to modify:**
- `src/utils/platform.ts` — swap detection
- `src/main.ts` — swap `.tauri-app` → `.electron-app`
- `src/assets/styles.css` — delete 186 `.tauri-app` rules
- `vite.config.ts` — Electron build integration
- `package.json` — swap deps + scripts
- 38 files using `isTauri()` → `isElectron()`

---

### ~~BUG-1706~~: Set up Epiphany WebKitGTK testing workflow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Goal**: Install Epiphany (GNOME Web) as a fast WebKitGTK testing environment. Same engine as Tauri's wry — point at `localhost:5546` to test CSS without building Tauri.

**Tasks**:
- Install `epiphany-browser` (uses system WebKitGTK)
- Verify it reproduces the sidebar clipping bug
- Document workflow in CLAUDE.md

---

### ~~BUG-1707~~: Fix sidebar width calculation for WebKitGTK (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE | **Depends on**: ~~BUG-1706~~

**Root Cause Analysis** (confirmed via Perplexity research):
- `.sidebar` has redundant `width: 100%; min-width: 240px; max-width: 340px` PLUS the grid track `minmax(240px, 340px)` — double-constraining causes WebKitGTK to miscalculate
- `overflow: hidden` on `.sidebar` + nested flex with `min-width: 0` triggers known cross-engine shrinkage bugs
- `contain: style` may have side effects in WebKitGTK despite spec saying it shouldn't

**Fix order** (test each in Epiphany):
1. Change `.sidebar` to `width: auto; min-width: 0` — let grid track own the width
2. If still broken: remove `overflow: hidden` from `.sidebar`
3. If still broken: remove `contain: style`
4. If still broken: temporarily remove `backdrop-filter` to isolate compositing effects

**Files**: `src/layouts/AppSidebar.vue`, `src/layouts/MainLayout.vue`

---

### ~~BUG-1708~~: Deploy verified WebKitGTK sidebar fix to Tauri (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE | **Depends on**: ~~BUG-1707~~

**Scope**: Version bump + `./scripts/deploy-tauri-update.sh` — only after fix confirmed in Epiphany.

---

### ~~TASK-1596~~: Test infrastructure setup — coverage + factories + helpers (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-21)

**Scope**: Install `@vitest/coverage-v8`, update `vitest.config.ts` with coverage config, remove `tests/integration/**` from exclude, create `tests/factories/index.ts` with `createMockTask/Project/TimerSession` factories, and add `tests/helpers/selectors.ts` with `data-testid` selectors. No production source code changes.

**Files**: `vitest.config.ts`, `tests/factories/index.ts`, `tests/helpers/selectors.ts`, `package.json`

---

### ~~BUG-1583~~: Timer starts then stops + KDE widget session sync (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Bug 1 — Timer race condition**: `startTimer()` had an async gap between `clearExistingSession()` and `saveTimerSessionWithLeadership()`. During this gap, the follower poll (3s interval) or visibility handler would query DB, find no active session, and null out `currentSession`. Fixed by moving `isDeviceLeader=true` + `pauseFollowerPoll()` before the first `await`, and adding an `isStarting` guard flag that blocks both the follower poll and `resyncFromDatabase` during the start sequence.

**Bug 2 — KDE widget orphaned sessions**: Widget's `startNewSession()` and `startSessionForTask()` POSTed new sessions without clearing existing ones, leaving multiple `is_active=true` rows. Fixed by PATCHing all active sessions to `is_active: false` before creating the new one.

**Files**: `src/stores/timer.ts`, `src/composables/timer/useTimerSync.ts`, `packages/kde-widget/contents/ui/main.qml`

---

### BUG-1582: IndexedDB cache corruption (444k tasks) + Tauri time-filter dropdown unresponsive (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Bug 1 — IndexedDB cache corruption**: Inbox badge showed 444,000 tasks (actual DB: 227). Corrupted IndexedDB cache persisted across restarts. Fixed by adding a self-healing guard in `useAppInitialization.ts` — if cached task count exceeds 1,000, the cache is cleared and skipped (falls through to Phase B Supabase load). Also added a write-side guard in `readCacheDB.ts::cacheTasks()` that refuses to write arrays > 1,000 tasks, preventing re-corruption. The dedup post-check now also enforces the 1,000-task ceiling.

**Bug 2 — Tauri time-filter dropdown unresponsive**: The `NPopover` dropdowns (time filter and group filter) in `UnifiedInboxHeader.vue` used `raw` prop which removes Naive UI's default DOM injection. In Tauri's WebKitGTK, the popover content was clipped by parent `overflow: hidden` containers. Fixed by adding `to="body"` to both `NPopover` components so content teleports out of the clipped container to `<body>`. Added `z-index: var(--z-popover)` and `position: relative` to `.time-filter-options` and `.group-filter-chips` CSS so they stack correctly when teleported.

**Files**: `src/composables/app/useAppInitialization.ts`, `src/services/offline/readCacheDB.ts`, `src/components/inbox/unified/UnifiedInboxHeader.vue`

---

### ~~TASK-1579~~: Consolidate canvas viewport to single source of truth in canvasViewport.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Canvas viewport `{x, y, zoom}` existed in 3 separate locations with no sync:
1. `canvasUi.ts` — duplicate `viewport` ref with its own localStorage + Supabase watcher
2. `canvasViewport.ts` — the actual owner, used by `canvas.ts`
3. `settings.ts` — `canvasViewport` field in `AppSettings` (data transport vessel for DB mapper)

**Fix**: Removed `viewport` ref, `setViewport`, `setViewportWithHistory`, `saveZoomToHistory`, `zoomHistory`, `loadSavedViewport`, and the viewport watcher from `canvasUi.ts`. Added debounced (2s) Supabase write to `canvasViewport.ts`'s `setViewport`. `settings.ts` `canvasViewport` field kept as the DB transport vessel used by `supabaseMappers.ts`.

**Files**: `src/stores/canvas/canvasUi.ts`, `src/stores/canvas/canvasViewport.ts`

---

### ~~TASK-1560~~: Redesign SidebarWorkspaceSwitcher — always-visible with create workspace flow (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-16)

**Scope**: Redesign `src/components/sidebar/SidebarWorkspaceSwitcher.vue` to always show (remove `v-if="shouldShowSwitcher"`), add inline workspace creation with name input + teal confirm button, add copy-invite-link per shared workspace, and add 5 missing translation keys to both locale files.

---

## Workspace Collaboration — Post-Implementation Bugs

### ~~BUG-1561~~: Sync queue classifyError fails on Supabase PostgrestError objects (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE

**Problem**: `classifyError()` in `retryStrategy.ts` called `String(error)` on Supabase `PostgrestError` objects (plain objects, NOT `instanceof Error`). Produced `"[object Object]"` — all PostgREST errors fell through to `'unknown'` → retried infinitely → rate limit cascade.

**Fix**: Three-branch message extraction (instanceof Error → plain object .message → String fallback). Regression tests added for PostgrestError shapes.

**Files**: `src/services/offline/retryStrategy.ts`, `src/services/offline/__tests__/retryStrategy.spec.ts`

---

### ~~BUG-1562~~: taskPersistence smart-merge enqueues raw camelCase payloads to sync queue (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: `taskPersistence.ts:416-420` enqueues raw app-side task objects (with `_soft_deleted`, `projectId`, `isInInbox` etc.) directly to the sync queue, bypassing `toSupabaseTask()`. When the queue processes these, Supabase returns 400 because camelCase fields don't exist as DB columns.

**Root cause**: Smart-merge local-only task preservation used `payload: localTask as unknown as Record<string, unknown>` instead of mapping through `toSupabaseTask()`.

**Fix**: Use `toSupabaseTask()` mapper before enqueueing. Already implemented in `src/stores/tasks/taskPersistence.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`

---

### ~~BUG-1563~~: Workspace switch shows personal tasks in shared workspace (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: When switching to a shared workspace, the empty-overwrite protection in `taskPersistence.ts` and `canvas.ts` blocks loading 0 tasks (legitimate for an empty workspace), keeping 216 personal tasks visible.

**Root cause**: BUG-169 safety guard treats "0 loaded, N existing" as data loss — doesn't account for workspace switches where 0 tasks IS correct.

**Fix**: Check `isSwitchingWorkspace` flag from workspace store to bypass protection during switches. Already implemented in `taskPersistence.ts`, `canvas.ts`, `canvasGroups.ts`.

**Files**: `src/stores/tasks/taskPersistence.ts`, `src/stores/canvas.ts`, `src/stores/canvas/canvasGroups.ts`

---

### BUG-1564: loadMembers() PGRST200 — cross-schema JOIN to auth.users fails (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: `loadMembers()` in workspace store uses PostgREST JOIN to `auth.users` which is in a different schema. PostgREST can't resolve the FK.

**Fix**: Removed the JOIN, fetch raw member records only. Display names deferred to Phase 3 profiles table.

**Files**: `src/stores/workspace.ts`

---

### BUG-1565: Sync queue processes during workspace switch causing 400s (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17)

**Problem**: When switching workspaces, realtime events for departing tasks trigger sync queue operations that upsert with stale context.

**Fix**: Added `isSwitchingWorkspace` flag to workspace store, sync queue's `processQueue()` checks it before processing.

**Files**: `src/stores/workspace.ts`, `src/composables/sync/useSyncOrchestrator.ts`

---

### ~~BUG-1566~~: One-time IndexedDB cleanup needed after camelCase payload contamination (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-24)

**Problem**: Stale sync queue ops with camelCase payloads accumulated in IndexedDB before BUG-1562 fix. These ops retry infinitely (due to BUG-1561), causing rate limit cascades that take down the entire app on every page load.

**Fix**: One-time `indexedDB.deleteDatabase()` cleanup at app startup in `main.ts`. Cleanup guard uses localStorage key so it runs only once. Safe because all tasks exist in production DB. Should be removed after cleanup completes.

**Files**: `src/main.ts`

---

## Data Architecture Debt — Single Source of Truth Fixes

### ~~TASK-1572~~: Consolidate canvas viewport from 3 stores into 1 (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `viewport: {x, y, zoom}` exists in 3 independent places with NO sync mechanism between them:
1. `canvasUi.ts → viewport` (in-memory only)
2. `canvasViewport.ts → viewport` (persisted to localStorage + Supabase `user_settings.canvas_viewport`)
3. `settings.ts → canvasViewport` (inside settings blob, goes through settings save path)

On a new device, all three can restore to different positions. On pan/zoom, only `canvasViewport.ts` and `canvasUi.ts` update — Supabase only gets the value when a full settings save fires.

**Fix**: Delete `canvasUi.ts → viewport` field. Use `canvasViewport.ts` as the single owner. Remove `settingsStore.canvasViewport` field and replace with a read-on-startup from `canvasViewport` store. Add a debounced watcher that pushes viewport changes to Supabase.

**Files**: `src/stores/canvas/canvasUi.ts`, `src/stores/canvas/canvasViewport.ts`, `src/stores/settings.ts`

---

### ~~TASK-1573~~: Fix settings auto-sync gap — timer/API settings never reach Supabase (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `syncSettingsToSupabase()` in `settings.ts` only writes `pushNotifications` and `timeBlockNotifications` to Supabase automatically. All other settings (timer durations, Groq API key, Google tokens, saved views) only reach Supabase on explicit full save. On a new/second device, these settings are always stale.

**Fix**: Expand `syncSettingsToSupabase()` to write the full `AppSettings` blob on every debounced change (debounce 2s). This mirrors the pattern already used by `useAISync.ts` for AI conversations.

**Files**: `src/stores/settings.ts`

---

### ~~TASK-1574~~: Unify theme/locale/sidebarCollapsed — remove duplication between ui.ts and settings.ts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Three fields are independently maintained in both `ui.ts` and `settings.ts` with NO sync:
- `theme`: `ui.ts` uses `'auto'`, `settings.ts` uses `'system'` — different type strings, `uiStore.theme` is NOT persisted
- `locale`/`language`: written to `flowstate-app-locale` by `ui.ts` AND embedded inside `flowstate-settings-v2` by `settings.ts` — two code paths, no reconciliation
- `sidebarCollapsed`: in `settings.ts` blob but never written (orphaned field)

**Fix**: Make `uiStore.theme` a computed reading from `settingsStore.theme`. Standardize on `'auto'` vs `'system'` (pick one). Remove standalone `flowstate-app-locale` key, drive everything from `settingsStore.language`. Remove orphaned `sidebarCollapsed` from settings schema.

**Files**: `src/stores/ui.ts`, `src/stores/settings.ts`, `src/i18n/useDirection.ts`

---

### ~~TASK-1575~~: Fix hideDoneTasks — 7 independent copies, mobile not persisted (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: The "hide done tasks" concept has 7 independent, unsynchronized copies:
1. `hideBoardDoneTasks` (task store, persisted)
2. `hideCanvasDoneTasks` (task store, persisted)
3. `hideCalendarDoneTasks` (task store, persisted)
4. `showDoneOnly` canvas inbox (usePersistentRef, separate key)
5. `showDoneOnly` calendar inbox (usePersistentRef, separate key)
6. `useMobileFilters.hideDoneTasks` — NOT persisted, defaults `true` on every reload
7. `SearchModal.activeFilters.hideDone` — resets every time modal opens

**Fix**: Mobile `useMobileFilters.hideDoneTasks` should use `usePersistentRef`. `SearchModal` initial value should read from `taskStore.hideBoardDoneTasks`. Document that the 3 per-view flags in the store are intentionally independent (board/canvas/calendar have separate hide-done states).

**Files**: `src/composables/mobile/useMobileFilters.ts`, `src/components/layout/SearchModal.vue`

---

### ~~TASK-1576~~: Create src/constants/ — storageKeys, taskConstants, dbTables, routes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Magic strings scattered throughout the codebase with no single source of truth:
- Task status strings (`'todo'`, `'done'`) in 120 files — TypeScript type exists but no runtime constant
- Priority strings (`'high'`, `'medium'`, `'low'`) in 144 files — same
- ~40 localStorage `flowstate-*` keys — only backup keys have a `STORAGE_KEYS` object; `flowstate-canvas-viewport` written by 2 independent files, `flowstate-recurrence-lock-{date}` generated in 3 places
- Supabase table names in 40+ `.from()` calls — 3 leak outside the DB composable layer
- Route paths as string literals in ~15 `router.push()` call sites

**Fix**:
1. `src/constants/taskConstants.ts` — `TASK_STATUS` and `TASK_PRIORITY` `as const` objects
2. `src/constants/storageKeys.ts` — all `flowstate-*` keys, extending backup system's pattern
3. `src/constants/dbTables.ts` — all Supabase table name strings
4. Export `ROUTES` const from `src/router/index.ts`, replace bare string `router.push()` calls

**Files**: `src/constants/` (new files), `src/types/tasks.ts`, `src/router/index.ts`, `src/utils/guestModeStorage.ts`, `src/stores/tasks/taskOperations.ts`, `src/composables/useRecurrenceScheduler.ts`

---

### ~~TASK-1577~~: Load completedSessions from pomodoro_history on timer init (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `timerStore.completedSessions` starts empty on every page load. Supabase has `pomodoro_history` table but it's only written to (never read). Code in `ai/tools.ts` reads `completedSessions.length` to count "sessions today" — always returns 0 after reload, giving wrong AI context.

**Fix**: Added `loadTodaySessionsFromDB()` async function to timer store that:
1. Queries `pomodoro_history` using `fetchPomodoroHistory(0)` from `useWorkProfileDatabase`
2. Maps DB records to `PomodoroSession` shape (generates UUIDs for session IDs which DB doesn't store)
3. Populates `completedSessions.value` with loaded records
4. Only runs when authenticated AND `aiLearningEnabled` is true
5. Watcher on `authStore` triggers load when auth becomes available
6. Cleanup unsubscribes watcher on store disposal

**Files**: `src/stores/timer.ts`

---

### ~~TASK-1578~~: Fix hardcoded brand colors in JS — useDragAndDrop.ts and KanbanColumn.vue (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: Design token violations where CSS variables should be used:
- `useDragAndDrop.ts:71` — ghost element CSS string contains `rgba(78,205,196,0.4)` (brand teal hardcoded in JavaScript, completely outside token system)
- `KanbanColumn.vue:291-293` — priority color map with `#ef4444`, `#f59e0b`, `#3b82f6` (should use `--color-priority-*` tokens)
- `FlowTaskCard.vue:281-292` — hardcoded `#f59e0b`, `#4ade80` for status colors
- `FaviconManager.vue:48-50` — hardcoded `#ef4444`, `#22c55e`, `#6b7280` for timer states

**Fix**: Replace with CSS custom property reads in JS (`getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')`) or inject the ghost element as a class with CSS styles instead of inline string.

**Files**: `src/composables/useDragAndDrop.ts`, `src/components/tasks/KanbanColumn.vue`, `src/components/canvas/FlowTaskCard.vue`, `src/services/FaviconManager.ts`

---

## Test Failures (P2)

### ~~BUG-1568~~: WebKitGTK CSS safety test fails — text-overflow: clip in CategorySelector (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `CategorySelector.vue` style block line 198 uses `text-overflow: clip !important` without the required `/* WebKitGTK-safe */` annotation. The `css-syntax.test.ts` safety test catches this as a potential Tauri/WebKitGTK compatibility issue.

**Fix**: Add `/* WebKitGTK-safe */` annotation on the same line, or replace `text-overflow: clip` with a WebKitGTK-compatible alternative.

**Files**: `src/components/layout/CategorySelector.vue`

---

### ~~BUG-1569~~: Circular dependency — timer.ts → tasks.ts → taskStates.ts → projects.ts → taskOperations.ts (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `dependencies.test.ts` detects a circular import cycle: `timer.ts` → `tasks.ts` → `taskStates.ts` → `projects.ts` → `taskOperations.ts` → back to `timer.ts`. This can cause initialization ordering issues and makes the codebase harder to reason about.

**Fix**: Extract shared types/utilities into a separate module, use dynamic imports, or restructure store dependencies to break the cycle.

**Files**: `src/stores/timer.ts`, `src/stores/tasks.ts`, `src/stores/tasks/taskStates.ts`, `src/stores/projects.ts`, `src/stores/tasks/taskOperations.ts`

---

### ~~BUG-1570~~: Task filtering test fails — "today" smart view returns 0 tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: `tasks.test.ts` "filters tasks by today smart view" expects `filteredTasks.length >= 1` after `setSmartView('today')`, but gets 0. Either the test seed data isn't creating a task with today's date correctly, or the smart view filter logic has a date comparison bug.

**Fix**: Investigate whether the test setup creates tasks with `dueDate` set to today correctly, and whether `setSmartView('today')` filter matches the expected format. Fix the test or the filter logic.

**Files**: `src/stores/__tests__/tasks.test.ts`, `src/stores/tasks/taskStates.ts`

---

## Active Bugs (P0-P1)

### ~~TASK-1788~~: Extract canvas rotation handlers from CanvasView.vue into useCanvasRotationLayout composable (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-18) | **Opened**: 2026-05-18

**Problem**: BUG-1786 (v1.4.33) and BUG-1787 (v1.4.34) both touched canvas rotation/render logic locked inside `src/views/CanvasView.vue`. The newly-added findNode null-retry and canvasSyncInProgress pre-acquire could only be tested via E2E because they were inside an SFC, not a composable.

**Fix**: Pure refactor — extracted `applyCanonicalLayoutMoves`, `applyCanonicalTaskMoves` (with BUG-1787 null-retry), `refreshRenderedNodesFromModel`, `releaseOnDoubleNextTick`, `getVisualNodePosition`, `getRenderedNodeSize`, `getRenderedCanvasZoom`, `handleRotateDayGroups` (with BUG-1787 sync-lock pre-acquire), `handleTidyLayout`, `runDayGroupCatchup`, plus `useDayGroupRotation`/`useTidyLayout` initialization into new composable `src/composables/canvas/useCanvasRotationLayout.ts`. CanvasView.vue net diff: -249 lines. Added 7 new unit tests covering the previously-uncovered paths.

**Files**:
- New: `src/composables/canvas/useCanvasRotationLayout.ts` (~360 lines, moved from CanvasView.vue)
- Modified: `src/views/CanvasView.vue` (-249 net lines)
- New: `tests/unit/canvas/canvas-rotation-layout.test.ts` (7 cases)

**Verification**: 184/184 unit tests pass. No new TS errors. Build clean.

**Plan file**: `~/.claude/plans/mighty-petting-stearns.md`

---

### ~~BUG-1787~~: Canvas rotate-days makes tasks visually disappear from groups (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-17, shipped v1.4.34)

**Problem**: Clicking the rotate-days toolbar button left tasks counted in their groups but visually rendered outside the group rectangle. Day-of-week groups rotated correctly, but Today/Tomorrow power-keyword groups were skipped, leaving stale `dueDate` on their children.

**Root cause**: (1) `rotateDayGroups()` only iterated `keyword.category === 'day_of_week'` groups, skipping Today/Tomorrow `date`-category groups. (2) `handleRotateDayGroups` did NOT pre-acquire `canvasSyncInProgress=true` before calling `rotateDayGroups()` — the SMART-GROUP `dueDate` writes fired the sync watcher mid-rotation, leaving Vue Flow node positions stale. `applyCanonicalTaskMoves` then silently skipped tasks whose `findNode` returned null.

**Fix**: (1) Extended `rotateDayGroups` to rotate Today/Tomorrow too (left "this week"/"this weekend"/"later" alone as span keywords). (2) `handleRotateDayGroups` sets `canvasSyncInProgress.value = true` BEFORE invoking `rotateDayGroups`. (3) `applyCanonicalTaskMoves` collects null-findNode tasks and retries on `nextTick`. Still-missing tasks log a `[BUG-1787]` warning.

**Files**: `src/composables/canvas/useDayGroupRotation.ts`, `src/views/CanvasView.vue`, `tests/unit/canvas/day-group-today-tomorrow-rotation.test.ts` (new, 8 cases), `tests/e2e/canvas-rotate-render-bug-1787.spec.ts` (new, 2 cases)

**Shipped in**: v1.4.34 (deployed via `deploy-electron-update.sh` 2026-05-17)

---

### ~~BUG-1786~~: Canvas "Move to Today" leaves tasks bucketed as Tomorrow when they carry a calendar instance (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-17, shipped v1.4.33)

**Problem**: On Canvas (Electron), moving a task to Today via drag, right-click date menu, or overdue "Reschedule → Today" updated `task.dueDate` and (for drag) `parentId`, but never touched `task.instances[].scheduledDate`. Because `getTaskInstances` (`src/stores/tasks.ts:30`) makes any reader prefer `instances[]` over `dueDate`, Board view, smart-group matchers, and day-rotation continued to bucket the task as Tomorrow.

**Fix**: Added `realignInstancesToDate(task, dateStr)` helper in `src/stores/tasks/taskOperations.ts`. Skips recurring tasks and tasks with no instances (preserves BUG-1467). Wired into three canvas writers so the new `dueDate` and realigned `instances` ship atomically in a single `updateTask` call.

**Files**: `src/stores/tasks/taskOperations.ts`, `src/composables/canvas/useCanvasInteractions.ts:855` (drag), `src/composables/canvas/node/useTaskNodeActions.ts:295` (overdue reschedule), `src/composables/tasks/useTaskContextMenuActions.ts` (context menu — dropped `isCalendarEvent` gate), `src/stores/__tests__/tasks.test.ts` (3 new helper cases).

**Shipped in**: v1.4.33 (deployed via `deploy-electron-update.sh` 2026-05-17)

---

### ~~BUG-1784~~: Canvas Tidy button flips 9+ tasks into a messy 2-column staggered grid (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-09)

**Problem**: User arranges 9 tasks vertically in the Today group, clicks Tidy, and the cards rearrange into a 2-column staggered layout instead of staying in a clean single column. Five prior commits on `regression-canvas-recovery` (c9c5b651, 137ca809, c4e939a4, af37a03e, 79ceedbb) addressed adjacent symptoms (zoom-aware DOM measurement, persistence, gap math, rotation alignment) but did not touch the actual trigger.

**Root cause**: `useCanonicalDayGroupLayout.ts:110` flipped `hasOverflow = true` whenever `taskCount > CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN` (8). Tasks 9+ moved to column 1 at `groupX + 260`, while column 1's Y cursor started at `firstTaskY` (top of group) — producing the staggered pattern visible in the user's screenshot.

**Fix**: Added `maxTasksPerColumn?: number | null` to `CanonicalLayoutOptions`. When `null`, `maxPerColumn = Infinity` so all tasks land in column 0 and the group height grows via the existing `requiredHeight` math. Tidy passes `maxTasksPerColumn: null`. Rotation still uses the default 8-task threshold. Added a 9-task regression unit test asserting all `taskMoves[*].position.x === 20` and Y monotonically increases.

**Files**: `src/composables/canvas/useCanonicalDayGroupLayout.ts`, `src/composables/canvas/useTidyLayout.ts`, `tests/unit/canvas/tidy-layout.test.ts`

**Shipped in**: v1.4.22 (deployed via `deploy-electron-update.sh` 2026-05-09)

---

### ~~BUG-1757~~: Editing task due date to another day leaves it inside canvas day-group, date resets to today (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-12)

**Problem**: When a task parented to a canvas smart day-group (e.g. "Today = 12/04/2026") had its due date edited to another day (e.g. 19/04/2026), the task stayed visually inside the today-group. Worse, `useDayGroupRotation` (`src/composables/canvas/useDayGroupRotation.ts:111-112`) re-applied the group's current date to every `parentId === group.id` child, silently overwriting the user's edit back to today.

**Fix**: In `updateTask()` (`src/stores/tasks/taskOperations.ts`), when `updates.dueDate` is present, the call didn't come from `'SMART-GROUP'` source, the task has a `parentId`, and the caller isn't already managing `parentId` — look up the parent group, confirm it has a power keyword (skip freeform groups per user preference), and use `findMatchingGroupForDueDate(newDueDate, canvasStore.groups)` to check whether the new date still belongs in that group. If not, clear `parentId`, `canvasPosition`, set `isInInbox: true`, bump `positionVersion`. This detaches the Vue Flow child (visual exit), and the rotation loop stops touching the task (`useDayGroupRotation` filters on `parentId === group.id`). Mirrors the `doneForNow` v1.3.43 pattern at lines 1177-1189.

**Files**: `src/stores/tasks/taskOperations.ts` (added imports + new branch before `syncDateFields`)

---

### ~~BUG-1733~~: Production errors — FK violation, dev CSS preload, undo safeClone SyntaxError (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-28)

**Problems fixed**:
1. `tasks_parent_id_fkey` FK violation — orphaned constraint on production DB blocks task sync
2. `/src/assets/styles.css` 404 in production — hardcoded dev path in preload
3. `permanentlyDeleteTaskWithUndo` SyntaxError — `safeClone()` returns Vue reactive proxies
4. `claim_timer_leadership` RPC 404 — migration not deployed to production

**Fix**: Dropped orphaned FK constraint via migration, removed dead CSS preload from main.ts, added `toRaw()` to undo safeClone. Timer RPC requires manual migration deploy.

**Files**: `src/main.ts`, `src/composables/undoSingleton.ts`, `supabase/migrations/20260327120000_drop_tasks_parent_id_fkey.sql`

---

### ~~BUG-1523~~: iCal parser skips ALL recurring events — RRULE expansion missing (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `useExternalCalendar.ts` lines 96-98 explicitly `continue` on any event with `RRULE:` that lacks a `RECURRENCE-ID`. This means every recurring event (weekly standups, daily check-ins, monthly 1:1s) is silently dropped. Only one-off events appear in the calendar.

**Fix**: Implement lightweight RRULE expansion (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY) generating instances in a -30/+90 day window. Cap at 500 instances. Replace the `continue` with expansion logic. Keep `RECURRENCE-ID` override detection.

---

### ~~BUG-1526~~: Push notification click actions dead — no client-side SW message handler (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `src/sw.ts` sends `NAVIGATE_TO_TASK`, `NAVIGATE_TO`, and `SNOOZE_NOTIFICATION` messages to open clients after a push notification click. No handler existed on the client to act on these messages — clicks had zero effect.

**Fix**: Added a `navigator.serviceWorker` `message` event listener in `useAppInitialization.ts` (lines 864–905). Handles all three message types: routes to `/focus/:taskId`, pushes arbitrary URLs via router, and snoozes the matching notification via `notificationStore.snoozeNotification()`. Listener is registered at composable setup time and cleaned up in `onUnmounted`.

---

### ~~BUG-1533~~: Task duplication, ghost reappearance, and sync resurrection bugs (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-16)

**12 bugs fixed**: Canvas Delete moved to inbox instead of deleting, sync queue CREATE resurrected deleted tasks (tombstone check added), cross-tab DELETE spliced wrong array, doneForNow double-invocation guard, calendarFilteredTasks missing dedup, createTask pre-push duplicate guard, done tasks staying in inbox, smart merge 5-min resurrection window (→30s), coalescer blind to syncing ops, stale queue 24h purge, recurrence unique DB constraint, stale comment fix. Production DB cleanup: 174 done tasks cleared from inbox.

### ~~BUG-1508~~: Permanently deleting a recurring task causes infinite recreation loop (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-24)

**Problem**: When a recurring task is permanently deleted, the deferred recurrence scheduler (`useRecurrenceScheduler.ts`) finds an older `done` ancestor with `recurrenceRule` still set, sees no active successor (deleted task is gone from `_rawTasks`), and creates a new clone — effectively resurrecting the deleted task. This loops infinitely: delete → scheduler recreates → delete → recreates.

**Fix approach**: When permanently deleting a recurring task, advance the recurrence chain first (bump `recurrenceCount`/`lastRecurrenceDate` on the ancestor) so the scheduler creates the *next* occurrence, not the same one again. This preserves the recurring series while respecting the deletion.

---

### ~~BUG-1509~~: Undo deleted task vanishes on next refresh — is_deleted not cleared (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Ctrl+Z after deleting a task re-creates it locally via `createTask` upsert, but the upsert payload never includes `is_deleted: false`. The DB row stays `is_deleted: true`. On next page refresh, `fetchTasks` filters it out and the task silently disappears.

**Root cause**: `createTask` in `taskOperations.ts` spreads `taskDataWithoutPositionAndInstances` which carries `_soft_deleted: true` from undo snapshots (if realtime echo processed before undo). The sync queue payload was patched but the direct Supabase write via `toSupabaseTask` still read `_soft_deleted` → wrote `is_deleted: true`.

**Fix**: Added `_soft_deleted: false, deletedAt: undefined` after the spread in `createTask` (`taskOperations.ts:144-148`) so they always override any stale flags from the undo snapshot.

---

### ~~BUG-1510~~: Delete canvas group orphans child tasks — they vanish (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: `deleteGroup` in `canvasGroups.ts` removes the group but doesn't clear `parentId` on child tasks. Canvas renderer skips tasks with missing parent. Deferred cleanup has no retry — if it fails, tasks stay invisible.

**Fix**: Before deleting a group, explicitly clear `parentId` on all child tasks. Positions are already absolute — no conversion needed.

---

### ~~BUG-1511~~: Timer dual leadership — no atomic CAS allows two leaders (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Timer leadership is claimed by writing `device_leader_id` without checking if someone else already claimed it. Two devices can both become leader → timer counts at 2x speed → session completes twice → double XP (BUG-1513).

**Fix implemented**:
- `supabase/migrations/20260313210000_atomic_timer_leadership.sql`: `claim_timer_leadership` RPC with conditional UPDATE
- `src/composables/supabase/useTimerDatabase.ts`: added `claimLeadership()` wrapper
- `src/composables/timer/useTimerSync.ts`: all 3 leadership-claim sites + heartbeat now use atomic RPC; heartbeat demotes itself if lease lost
- `src/stores/timer.ts`: passes `claimLeadership` through to `useTimerSync` deps

---

### ~~BUG-1512~~: Timer session expires while app closed — silently discarded (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: When app reopens and recovery detects `remainingTime <= 0`, it marks session inactive but never calls `completeSession()`. No pomodoro count, no XP, no history entry.

**Fix**: In `useTimerSync.ts` recovery path, set `currentSession.value` with the expired session (remainingTime=0) then call `onCountdownComplete()` instead of the manual DB-only update. This routes through `completeSession()` for full credit.

---

### ~~BUG-1513~~: Double XP under dual timer leadership (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14, resolved by BUG-1511 fix)

**Problem**: When two devices are both timer leaders (BUG-1511), both independently call `completeSession()` and award XP. The `isCompleting` lock only protects within a single JS context.

**Fix**: Resolves automatically when BUG-1511 is fixed (atomic leadership).

---

### ~~BUG-1514~~: Auth refresh fails after offline — pending writes permanently orphaned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When token expires offline and refresh fails on reconnect, `auth.ts` cleared the session unconditionally on the first refresh attempt. Pending sync writes were orphaned with no auth token and permanently failed.

**Fix**: Replaced the single raw `refreshSession()` call in the `window.addEventListener('online', ...)` handler with a retry loop (up to 3 attempts, exponential backoff: 1s, 3s, 9s). Session is only cleared if ALL retries fail. Each attempt is logged. The existing `performTokenRefresh` function (proactive timer refresh) already had retry logic — the online reconnect handler now follows the same pattern.

---

### ~~BUG-1515~~: Undo task completion doesn't revert XP or stats (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE

**Problem**: Complete task → earn XP. Ctrl+Z → task goes back to todo. XP stays. No `onTaskUncompleted` hook exists. Exploitable: complete-undo-complete loop for infinite XP.

**Fix**: Added `deductXp()` and `decrementStat()` to `gamification.ts`. Added `onTaskUncompleted()` to `useGamificationHooks.ts`. Wired into the `wasDone && isNowNotDone` branch in `taskOperations.ts`. Levels are intentionally not decremented (they are permanent). XP deduction is clamped at 0. Negative xp_log entries written for auditability.

---

### ~~BUG-1516~~: Multi-device edit overwrites — whole-document LWW loses field-level changes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: Sync payload includes ALL task fields, not just changed ones. Edit title on phone, edit description on desktop → last save overwrites the other's field. Silent data loss.

**Fix**: Track which fields changed in `updateTask`, send only those in the sync payload.

---

### ~~BUG-1517~~: Auth token expires mid-sync — remaining operations permanently abandoned (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**Problem**: 401 during sync is classified as `permanent` error. Retry set to 1 year out. All remaining queued operations also fail and get abandoned. No token refresh attempted.

**Fix**: Add `auth` error category in retry strategy. On 401, call `supabase.auth.refreshSession()` before retrying. Only permanent-fail if refresh itself fails.

---

### ~~BUG-1530~~: Dragging task to Today canvas group doesn't update Calendar inbox (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-18)

**Problem**: When a task is dragged into the "Today" group on the canvas, the due date gets set to today but the task doesn't appear in the Calendar inbox when filtered to "Today". The calendar inbox shows stale data and doesn't reflect the canvas group assignment.

**Fix**: Investigate whether the canvas drop handler properly sets `due_date` and whether the calendar inbox's Today filter watches for reactive due_date changes. Likely a reactivity or sync issue between canvas group membership and the calendar view's task filtering.

---

### ~~BUG-1529~~: Context menu shows wrong multi-select count (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-24)

**Problem**: Right-clicking a single task in the calendar/board view shows "Mark 6 as Done" and "Delete 6" instead of just "Mark as Done" — the selection count is wrong, showing stale/phantom selections. The menu displays an inflated count of selected tasks (6) even when only 1 task is actually selected.

**Root cause**: `handleContextMenu` in AllTasksView.vue/TaskList.vue never cleared the multi-selection when right-clicking a task outside the current selection. The stale `selectedTaskIds` persisted, inflating the count shown in the menu.

**Fix applied (2026-03-24)**:
- `AllTasksView.vue` handleContextMenu: clear selection when right-clicked task is not in current selection
- `TaskList.vue` handleContextMenu: same guard before emitting contextMenu event
- `BoardView.vue` onUnmounted: call `taskStore.clearSelection()` to prevent phantom selections across view switches

---

### ~~BUG-1502~~: "Sync external calendars" button doesn't sync Google Calendar (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-12)

**Problem**: Clicking "Sync external calendars" in the calendar header dropdown only triggered iCal sync (`externalCalendar.syncNow`), not Google Calendar sync. Google Calendar events only refreshed on page mount or every 30 minutes via polling interval — manual sync button was ineffective.

**Fix**: Created `syncAllExternalCalendars()` handler in `CalendarView.vue` that calls both `externalCalendar.syncNow()` and `googleCalendar.syncNow()`. Wired it to the `@sync-external-calendar` event.

---

### ~~BUG-1449~~: KDE widget notification barrage + popup dismiss + nanny task selection (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problems**: Six KDE widget bugs — pre-end warning & overlay card inner MouseArea absorbed clicks instead of dismissing; session completion triggered multiple notifications (barrage) when concurrent `checkSessionCompletion()` XHR calls each fired `onSessionComplete()`; nanny popup task click passed pinned_tasks table ID instead of real task ID; nanny popup too narrow (buttons clipped); overlay card too short (dismiss text clipped); Start Work button used solid fill.

**Fixes**: Dismiss on card click; dual barrage guard (`checkingCompletion` + `sessionJustCompleted`); nanny uses `selectPinnedTask()`; popup 500x380; overlay card height 400; glass morphism button.

---

### ~~BUG-1432~~: Overdue tasks display today's date instead of actual due date (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-05)

**Problem**: Tasks that should appear as overdue are shown with today's date everywhere — visible in the "Today" group on the canvas. Their actual due date is being overwritten or misread as the current date.

**Root cause**: Two paths: (1) `useMoveToCanvasGroup.ts` — "Move to Group" context menu blindly spread `getSectionProperties()` into task updates, overwriting existing dueDate with today's date. (2) `taskValidation.ts` sanitizer defaulted missing dueDate to today instead of empty string.

**Fix**: Added dueDate guard in `useMoveToCanvasGroup.ts` (matching existing guard in `useUnifiedInboxActions.ts`). Changed sanitizer fallback to empty string.

---

### ~~BUG-1430~~: Sidebar Date Filters Navigate to Catalog View (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Clicking "Today", "This Week", or other smart view filters in the sidebar navigated users to the Catalog view (`/tasks`) instead of staying on the current view (Canvas, Board, Calendar).

**Root cause**: `AppSidebar.vue:976` had an unconditional `router.push('/tasks')` in the local `selectSmartView` function (from TASK-1330).

**Fix**: Made navigation conditional — only navigate to `/tasks` if the current route doesn't support smart view filters (Canvas `/`, Board `/board`, Calendar `/calendar`, Catalog `/tasks`/`/catalog` all support them natively).

---

### ~~BUG-1429~~: Calendar Inbox Duplicate Display (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-02)

**Problem**: Tasks dragged from Calendar Inbox onto calendar grid remain visible in the inbox after being scheduled, creating duplicate task entries.

**Root cause**: TASK-1412 added `canvasOrder` sort which bypasses the scheduling check in `useUnifiedInboxState.ts`. When a task is dragged to the calendar and assigned a date, the inbox filter should remove it (task is now scheduled), but the inbox still displays it due to the filter logic being skipped.

**Fix** (in progress):
1. `useUnifiedInboxState.ts`: Restore scheduling check in filter logic even when using `canvasOrder` sort
2. Verify inbox filter properly excludes scheduled tasks regardless of sort mode
3. Test drag-drop from inbox to calendar grid doesn't leave duplicate entries

---

### ~~BUG-1411~~: Supabase fetch timeout storm — cascading AbortErrors crash sync (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: `fetchActiveTimerSession` polls every ~10s. When VPS/network is slow, each call times out at `supabase.ts:105` (`AbortError`), spawning 3 retries (500ms → 1s → 2s). Before retries finish, the next poll fires — creating overlapping retry cascades.

**Fix** (7 files changed + 1 new):
1. **Timer poll guards** (`useTimerSync.ts`): `isSaving` mutex on heartbeat, `isPolling` mutex on follower poll, consecutive failure backoff (30s after 3 failures)
2. **Fetch timeout 10s → 30s** (`supabase.ts`): VPS can be slow under load, 10s was too aggressive
3. **Offline-first read cache** (`readCacheDB.ts` NEW): Dexie IndexedDB database caches tasks/groups/projects after every successful Supabase fetch
4. **Cache fallback** (`taskPersistence.ts`, `projects.ts`, `canvas.ts`): When Supabase is unreachable, load last-known-good data from IndexedDB cache
5. **Offline mode indicator** (`syncStatus.ts`): Shows "Offline — showing cached data (Xmin old)" in sync status
6. **Auto-reconnect** (`useAppInitialization.ts`): Listens for `online` event, auto-reloads from Supabase when connectivity returns
7. **Cache isolation** (`auth.ts`): Clears read cache on sign-out to prevent data leaking between users
8. **75 tests** covering cache CRUD, offline fallback cycles, large datasets, sign-out isolation

---

### ~~BUG-1410~~: Done tasks still appear on canvas after marking as done (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-13)

**Problem**: When marking a task as done, it remains visible on the canvas instead of being removed/hidden.

**Root causes**: (1) Auto-archive didn't increment `positionVersion`, so sync could restore old position. (2) Sync handler restored canvas positions for done tasks. (3) No UI toggle to control `hideCanvasDoneTasks` on canvas.

**Fix**: 4 changes across 3 files:
1. `taskOperations.ts`: Auto-archive now increments `positionVersion`; merge respects it via `syncedUpdates.positionVersion ?? newVersion`
2. `tasks.ts`: Sync handler skips position restoration for `status === 'done'` tasks (2 locations)
3. `CanvasToolbar.vue`: Added "Show/Hide done tasks" toggle button

---

### ~~BUG-1408~~: Canvas tasks get blurry when zooming out (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Task nodes on the canvas become blurry/pixelated when zooming out. Regression from BUG-1216 which removed `transform-style: preserve-3d` and changed `backface-visibility` to `hidden` on the viewport.

**Fix**: Restored `transform-style: preserve-3d !important` and `backface-visibility: visible !important` on `.vue-flow__transformation-pane`/`.vue-flow__viewport` in `vue-flow-overrides.css`. This prevents the browser from flattening all nodes into a single bitmap texture — each node renders independently at display resolution, staying crisp at any zoom level.

---

### ~~TASK-1428~~: Auto-inherit group properties when creating task in a group (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-03)

**Problem**: Creating a task inside a group like "Today" should automatically assign that group's properties to the new task (e.g., today's due date). Currently the user must manually set properties after creation.

**Scope**: Investigate which group types carry inheritable properties (date-based groups, status groups, priority groups, project groups) and implement reliable auto-assignment on task creation within those groups.

---

### ~~TASK-1412~~: Calendar Inbox Canvas Order Sort — right-to-left DFS + sort direction toggle (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Problem**: The Calendar inbox `canvasOrder` sort used simple group X position (left→right), without connection-aware DFS for nested tasks and with no way to reverse the order. Users wanted right-to-left ordering (rightmost canvas columns first) and a toggle to flip any sort direction.

**Fix**:
1. `useUnifiedInboxState.ts`: Added `SortDirection` type + `sortDirection` persistent state. `canvasOrder` now sorts groups by descending X (right-to-left), then DFS within each group using `parentTaskId` tree structure. Other sort modes multiplied by `dir` to support asc/desc.
2. `UnifiedInboxPanel.vue`: Destructures and passes `sortDirection` down to header.
3. `UnifiedInboxHeader.vue`: Imports `SortDirection`, adds prop + emit, passes to `InboxFilters`.
4. `InboxFilters.vue`: Imports icons + type, adds prop/emit, renders toggle button after canvas-order sort button.

---

### ~~TASK-1435~~: Active Task Glass Pill — KDE Companion Widget + AppHeader (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: When a Pomodoro timer is running on a task, the user wants to see the active task name at a glance — both in the web app header and in the KDE Plasma panel next to the timer widget.

**Approach**: Two-part implementation:
1. **Web app**: Glass-morphism pill in `AppHeader.vue` next to the timer, showing project color dot + task name with smooth enter/leave transitions
2. **KDE Plasma widget**: Separate companion widget (`com.pomoflow.activetask`) that reads task state from `/tmp/flowstate-active-task.json` written by the main timer widget via a temp file bridge

**Key decisions**:
- Temp file bridge avoids duplicating Supabase auth in the companion widget
- Main widget resolves task name inline in `writeActiveTaskFile()` for reliable reactivity
- Companion widget uses `Plasma5Support.DataSource` with shell `cat` command (not XMLHttpRequest, which is sandboxed in Plasma widgets)

**Steps**:
- [x] ~~AppHeader.vue: add glass pill with project dot + task name + transitions~~ ✅
- [x] ~~Main KDE widget: add `currentTaskName` property + `writeActiveTaskFile()` bridge~~ ✅
- [x] ~~New KDE widget: `packages/kde-widget-active-task/` with compact pill + full popup~~ ✅
- [x] ~~Install script + metadata.json for `com.pomoflow.activetask`~~ ✅

---

### ~~TASK-1424~~: KDE Widget Nanny Notifications — Schedule-Gated Idle Reminders (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-03)

**Problem/Opportunity**: User wants a gentle reminder from the KDE widget when no Pomodoro session is active during configured work hours. Must be helpful without being counterproductive (notification fatigue, guilt, off-hours annoyance).

**Research findings**: Clockify/Toggl Track model is best practice — schedule-gated, low-frequency, invitation-framed. Guilt framing (Duolingo-style) backfires long-term. Key: reminders should feel like a friendly assistant, not a boss.

**Approach** (evidence-based):
1. **Settings**: opt-in (default OFF), configurable work hours (Mon-Fri 9am-6pm default), trigger threshold (30/60/90 min of no active session), intensity/tone preference
2. **Trigger logic**: `IF (current day in active_days) AND (current time in work_hours) AND (no timer running for >= threshold) THEN notify`
3. **Notification**: KDE system notification with positive framing, rotating message bank (5-10 variants), one-click "Start Session" action
4. **Escape valves**: "Snooze 1hr", "Quiet today", configurable or disable entirely
5. **Never fire** if Pomodoro or break timer is currently active
6. **Cap**: max 1 notification per hour

**Steps**:
- [ ] Add nanny notification settings to KDE widget config UI (enable/disable, work hours, days, interval, tone)
- [ ] Implement idle detection timer in widget (poll timer status, track idle duration)
- [ ] Create message bank with 5-10 positive-framed rotation variants
- [ ] Wire KDE system notifications with "Start Session" + "Snooze" actions
- [ ] Add "Quiet today" toggle to widget UI
- [ ] Test edge cases (break timer active, outside work hours, snooze expiry)

---

### ~~FEATURE-1414~~: Task Image Attachments via Google Drive (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-02)

**Problem/Opportunity**: Users want to attach images to tasks. VPS storage is limited (Contabo), so images must be stored externally. Google Drive is the chosen backend — user already has Google OAuth configured via Supabase for Calendar integration.

**Approach**: Add `drive.file` scope to existing OAuth, create `google-drive-proxy` edge function (mirrors calendar proxy pattern), add `attachments` JSONB column to tasks table, build drag-drop upload UI in task editor. Client-side image compression (max 1920px, JPEG 0.8). Files stored in auto-created `FlowState/` Drive folder. Client-side thumbnail generation for instant preview.

**Steps**:
- [x] ~~Add `drive.file` scope to OAuth in `auth.ts`~~ ✅
- [x] ~~Rename calendar-specific token keys to generic (`googleCalendarToken` → `googleProviderToken`)~~ ✅
- [x] ~~Create `google-drive-proxy` edge function~~ ✅
- [x] ~~Create `googleDriveService.ts` client service~~ ✅
- [x] ~~Add `TaskAttachment` type + `attachments` field to Task + mappers + migration~~ ✅
- [x] ~~Build `TaskAttachments.vue` upload UI in task editor~~ ✅
- [x] ~~Self-hoster setup guide (SOP-038)~~ ✅

---

### ~~TASK-1409~~: Highlight active/in-progress tasks in Calendar view (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-23)

**Problem**: In the Calendar day/week view, tasks that are active (status = "in progress") look identical to other tasks. They should have a visual highlight (e.g., teal border glow or accent indicator) so the user can instantly see what they're currently working on.

**Fix**: Added `status-active` CSS class to all 3 calendar views (Day, Week, Month). In-progress tasks get a teal left border (`--brand-primary`) with subtle inset glow (`--brand-primary-dim`). Follows same pattern as existing `status-done` class. Uses design tokens only — no hardcoded colors.

---

### ~~TASK-1405~~: Replace LLM Distribution with Deterministic Algorithm in Weekly Plan (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Weekly Plan AI used LLM (Llama 3.3 70B via Groq) to assign tasks to days. Even with detailed MANDATORY RULES prompts, the LLM ignored routine preferences, misplaced tasks, and produced generic reasoning.

**Fix**: Replaced Step 1 (LLM distribution) with a deterministic 4-tier algorithm:
- **Tier 1**: Hard constraints (due dates, routine keyword matches from memory graph)
- **Tier 2**: Urgency (overdue spread via round-robin across Mon-Wed, in-progress early)
- **Tier 3**: Priority (high-priority on peak days, top-priority project batching)
- **Tier 4**: Fill (day scoring by capacity, project batching, complexity/meeting-day penalties)

Kept: LLM week theme (Step 3), dynamic questions, all memory/profile infrastructure. Removed ~300 lines of LLM prompt building + rebalancer + fallback plan code.

---

### ~~TASK-1403~~: Recurring Tasks — Clone-on-Complete with recurrence_rule column (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-22)

Added `recurrence_rule`, `recurrence_parent_id`, `recurrence_count` columns to tasks table. When a recurring task is completed, the system clones it as a new task with the next due date. Replaces old pre-generated instances approach.

### ~~TASK-1402~~: Decouple canvas/calendar inbox filtering — isInInbox now user-controlled (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Placing a task on canvas set `isInInbox: false`, hiding it from **both** canvas AND calendar inboxes. Same for scheduling on calendar. `isInInbox` was auto-toggled by 13 placement actions instead of being a user-controlled flag.

**Fix**: Removed all 13 auto-set `isInInbox: false` from placement actions across 10 files. Inbox visibility now uses position-based filtering: canvas inbox checks `!canvasPosition`, calendar inbox checks `!isScheduledOnCalendar`. `isInInbox` is now purely a user-controlled "remove from inbox" flag. Data migration applied (213 rows restored on VPS).

---

### ~~BUG-1407~~: Canvas node connections don't work (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-23)

**Problem**: Cannot connect canvas task nodes by dragging from handle to handle. Connections silently fail with no feedback.

**Root Cause**: 5 issues: (1) `connect-on-drag-nodes` invalid Vue Flow prop (silently ignored), (2) no `connectionMode` (default "strict" too restrictive), (3) no `connectionRadius` (20px too small), (4) silent rejection when target had `parentTaskId` (no re-parenting), (5) `syncEdges()` without `force: true`.

**Fix**: Removed invalid prop, added `connection-mode="loose"` + `:connection-radius="30"`, allowed re-parenting, force-synced edges on user-initiated connections.

---

### ~~BUG-1404~~: Context menu dropdowns don't work from search right-click (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

**Problem**: Right-clicking a task in the SearchModal (Cmd+K) opens the TaskContextMenu correctly, but the hover submenus (Project, Status, Duration) are unreachable — they render behind the search overlay.

**Root Cause**: Z-index layering. SearchModal overlay is `z-index: 1400` (`--z-popover`). TaskContextMenu is `z-index: 9999` (above overlay ✅). But submenus are Teleported to `<body>` with `z-index: calc(--z-dropdown + 1) = 1001` — below the search overlay (1400) ❌.

**Fix**:
1. All 4 submenu components: Changed `z-index` from `calc(var(--z-dropdown) + 1)` to `10001` (above search overlay)
2. `SectionSelector.vue`: Added missing `class="select-dropdown"` + `ref="dropdownRef"` on Teleported div, fixed click-outside handler with `capture: true`, fixed CSS syntax error
3. `useAppShortcuts.ts`: Added `event.code === 'KeyF'` for Hebrew keyboard layout compatibility

**Files Changed**: `StatusSubmenu.vue`, `DurationSubmenu.vue`, `ProjectSubmenu.vue`, `MoreSubmenu.vue`, `SectionSelector.vue`, `useAppShortcuts.ts`

---

### ~~TASK-1488~~: Fix Search Modal Z-Index — Confirmation Dialog Hidden Behind Overlay (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-08)

**Problem**: When deleting a task from search results via right-click context menu, the ConfirmationModal opens BEHIND the SearchModal overlay and is invisible. Additionally, search results would close unexpectedly after certain context menu actions.

**Root Cause**: Z-index layering issue. SearchModal used `--z-modal: 1300` and ConfirmationModal (BaseModal) also used `--z-modal: 1300`. Since both have the same z-index in ModalManager, and ConfirmationModal is rendered first in the DOM (line 65-73 before SearchModal at 76-81), the SearchModal appeared on top, blocking the confirmation dialog.

**Fix**:
1. `ConfirmationModal.vue`: Added `class="confirmation-modal-override"` to BaseModal wrapper
2. Added CSS rule `:deep(.confirmation-modal-override .modal-overlay) { z-index: var(--z-toast); }` to elevate ConfirmationModal to `--z-toast: 1450` (above SearchModal's 1300)
3. Result: Confirmation dialogs now always appear on top of search modals, and users can interact with them properly

**Files Changed**: `src/components/common/ConfirmationModal.vue`

---

### ~~BUG-1490~~: KDE Widget Stops Syncing — Token Refresh Chain Break (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problem**: KDE widget silently stops syncing with the main app after some period. Tasks, pinned tasks, and projects stop updating and require a manual widget restart to recover.

**Root Cause**: Three compounding bugs in `main.qml`:
1. **Token refresh timer chain break**: `tokenRefreshTimer` has `repeat: false`. On network errors or non-200/non-401 responses, `refreshAccessToken()` never restarts the timer → token eventually expires → all polling silently fails with auth errors.
2. **Missing 401 handling in fetch functions**: Only `fetchCurrentSession` handled 401 by calling `refreshAccessToken()`. `fetchTasks`, `fetchPinnedTasks`, and `fetchProjects` just logged and silently failed when the token expired mid-session.
3. **`isRefreshingToken` deadlock**: If an XHR hangs (network issue), `isRefreshingToken` stays `true` forever, blocking all future refresh attempts permanently.

**Fix**:
1. Added fallback `else` branch in `refreshAccessToken()` for non-200/non-400/401 statuses: restarts timer with 60s retry interval. Also restores normal interval on success.
2. Added `401 → refreshAccessToken()` handling to all three fetch functions.
3. Added `refreshTokenStartTime` property + timestamp-based stuck detection: if `isRefreshingToken` is true for >30s, forces reset and proceeds.

**Files Changed**: `packages/kde-widget/contents/ui/main.qml`

---

### ~~BUG-1492~~: Canvas Position Drift — Consecutive Drags Cause parentId Flip-Flopping (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Problem**: Dragging canvas tasks in quick succession causes visible position drift. Tasks alternately get assigned to a group and then back to root on each drag.

**Root Cause A — BUG-1191 handler skips saves**: The stale-parentNode guard in `useCanvasInteractions.ts` detected when Vue Flow's `node.parentNode` diverged from the store's `task.parentId` (valid during rapid consecutive drags before VF syncs). It was restoring the node position from the store (overwriting the user's actual drag position) and calling `continue` to skip saving. This threw away Drag N+1's real position, causing drift.

**Root Cause B — Containment padding gap causes flip-flop**: The "still inside parent" early-exit used `padding=2` while `getDeepestContainingGroup` used `padding=10`. A task with center 2–10px from the group edge failed the early-exit check, fell through, failed containment detection, and was assigned as root. Next drag with 16px grid snap shifted it back in → assigned to group. This cycled on every drag.

**Fix**:
1. **BUG-1191 handler**: Removed position restoration and `continue`. Now only fixes `node.parentNode` alignment and falls through to the normal path which uses the snapshotted absolute position (always the correct visual position).
2. **Hysteresis padding**: Changed both containment checks from `padding=2` to `padding=-20`. Negative padding expands the parent boundary outward by 20px — a task only detaches when dragged >20px outside the boundary. The 16px grid snap can never cause a flip-flop across a 20px hysteresis zone.

**Files Changed**: `src/composables/canvas/useCanvasInteractions.ts`

---

### ~~BUG-1493~~: Catalog view — collapsed state resets, expand/collapse broken, cross-group drag regression (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-09)

**Problems**:
1. `expandedGroups` in `TaskList.vue` is a plain `ref<Set>` — resets to all-expanded on every remount (navigation away and back).
2. `expandAll()`/`collapseAll()` work momentarily but reset on next reactive update or remount.
3. Cross-group drag in Catalog view (e.g., Overdue → Today with dueDate grouping) may be broken.

**Fix**: Persist collapsed group keys in localStorage via `usePersistentRef`, key `flowstate:catalog-collapsed-groups`. Update `toggleGroupExpand`, `expandAll`, `collapseAll`, initialization, and the new-group watcher to respect persisted state. Investigate drag regression.

**Files**: `src/components/tasks/TaskList.vue`

---

### ~~BUG-1320~~: Production console log spam — WakeLock, LWW echo, legacy IDs, Realtime drops (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Production console (in-theflow.com) flooded with 5 categories of noise:
1. Hundreds of `[WakeLock] Failed to request wake lock: DOMException` when tab is hidden
2. `[SYNC] LWW: Server wins` on every sync cycle (echo from direct save + sync queue race)
3. `[SUPABASE-MAPPER] Invalid UUID detected` on every sync for legacy group "Today"
4. `[REALTIME] Connection dropped (CHANNEL_ERROR)` when browser suspends background WebSockets
5. Transient CORS/network failures from ServiceWorker during tab sleep (handled by existing retry)

**Fix**: 4 targeted changes:
- `useWakeLock.ts`: Guard `requestWakeLock()` with `document.visibilityState === 'hidden'` check
- `useSyncOrchestrator.ts`: Downgrade LWW echo logs (delta < 2s) from `warn` to `debug`
- `supabaseMappers.ts`: Deduplicate warnings via `Set` — legacy group/UUID warnings fire once per session
- `useSupabaseDatabase.ts`: Downgrade CHANNEL_ERROR/CLOSED to `debug` when tab is hidden

**Files**: `src/composables/useWakeLock.ts`, `src/composables/sync/useSyncOrchestrator.ts`, `src/utils/supabaseMappers.ts`, `src/composables/useSupabaseDatabase.ts`

---

### ~~TASK-1337~~: Storybook Design Streamlining — Align All Stories with Design System (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-02)

**Goal**: Review and streamline every Storybook story to use the project's design system consistently. Replace all non-design-system elements with proper project components and tokens.

**What "Streamlining" Means**:
- Native `<select>` → `CustomSelect.vue`
- Native checkboxes → project checkbox components
- Hardcoded colors → design tokens from `design-tokens.css`
- Solid-fill buttons → glass bg + colored border pattern (`--glass-bg-soft` + `backdrop-filter: blur(8px)`)
- Any non-glass-morphism UI → proper glass morphism styling
- Primary action color is TEAL (`--brand-primary` / #4ECDC4), NOT green

**Progress Tracker**: `.claude/storybook-review-progress.md` (163 stories, 18 categories)

**Categories** (in review order):
- [ ] ai (4 stories)
- [ ] auth (8 stories)
- [ ] calendar (5 stories)
- [ ] canvas (15 stories) — 1 done (MultiSelectionOverlay)
- [ ] canvas/inbox (3 stories)
- [ ] canvas/node (6 stories)
- [ ] design-system (1 story)
- [ ] gamification (11 stories)
- [ ] kanban (7 stories)
- [ ] layout (12 stories)
- [ ] modals (12 stories)
- [ ] primitives (21 stories)
- [ ] pwa (1 story)
- [ ] settings (11 stories)
- [ ] task-management (22 stories)
- [ ] task-management/context-menu (3 stories)
- [ ] task-management/row (4 stories)
- [ ] views (8 stories)

**Related**: ~~BUG-1311~~ (3 story files fail to import — ✅ FIXED 2026-02-17)

---

### ~~BUG-1290~~: Week View Not Loading (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Calendar week view doesn't render at all. Switching to week mode shows blank content.

**Root Cause**: `CalendarWeekView.vue` injects `getWeekEventStyle` and `isCurrentWeekTimeCell` from `calendar-helpers`, but `CalendarView.vue` never provides them. Both functions are `undefined`, crashing the week view template when `:style="getWeekEventStyle(event)"` is called.

**Fix**: Added `getWeekEventStyle` and `isCurrentWeekTimeCell` to the `provide('calendar-helpers')` object in `CalendarView.vue` and destructured them from `weekView` composable.

**Files**: `src/views/CalendarView.vue`

**Progress (2026-02-10):** Root cause identified and fixed — added missing `getWeekEventStyle` and `isCurrentWeekTimeCell` to `provide('calendar-helpers')`. Type-check passes. Awaiting user verification.

---

### ~~BUG-1218~~: RTL Missing in Calendar Task Create Dialog and Timer Task Name (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: The Calendar-specific QuickTaskCreate dialog and the header timer task name don't support RTL/Hebrew text, while the rest of the app does. Hebrew text in the calendar task title input shows LTR cursor position. Timer task name in the header bar doesn't auto-detect Hebrew direction.

**Fix**:
1. Add `useHebrewAlignment` to `QuickTaskCreate.vue` (Calendar variant) — matches `QuickTaskCreateModal.vue`
2. Fix `.timer-task` CSS in `AppHeader.vue` — use `unicode-bidi: plaintext` unconditionally instead of `:dir(rtl)` selector that never matches in LTR documents

---

### ~~TASK-1220~~: Quick Sort Pull-Down Capture Panel (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Goal**: When user drags the screen down in any mobile view, reveal a command center panel with:
- Search existing tasks
- Create a new task (spacious input with keyboard)
- Record a task with audio (voice-to-text via Whisper)
- Quick action tiles: Quick Sort, Timer, Today, Settings

**Changes**: Implemented as pull-down gesture in `MobileLayout.vue` (available from ALL mobile views, not just Quick Sort). Panel includes task input, voice recording, search with results, and 4 action tiles.

**Files**: `src/mobile/layouts/MobileLayout.vue`

---

### ~~BUG-1286~~: PWA Today View Shows 2:00 AM on All Tasks Due to UTC Timezone Parsing (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Tasks in the Mobile Today View all showed "2:00 AM" even though the user never set any due time. Additionally, the time-based grouping broke — all untimed tasks landed in "Evening" instead of "Anytime Today".

**Root Cause**: `MobileTodayView.vue` extracted time from `dueDate` (a date-only field) instead of checking the explicit `dueTime` field. Date-only strings like "2026-02-08" are parsed by `new Date()` as UTC midnight, which becomes 2:00 AM in Israel (UTC+2). The untimed task filter used `getHours() === 0` which only works in UTC+0 and fails in other timezones.

**Fix Applied (2026-02-08)**:
1. **Changed `getTaskHour()`** — Now uses `task.dueTime` instead of parsing time from `dueDate`
2. **Fixed untimed task filter** — Changed from `getHours() === 0` to `getTaskHour() === null`, making it timezone-agnostic
3. **Replaced `formatDueTime()`** — Now uses `getDueBadge()` which only shows time when explicit `dueTime` is set
4. **Fixed `sanitizeTimestamp()` in supabaseMappers.ts** — Preserves date-only strings (YYYY-MM-DD) instead of converting to UTC ISO

**Files Changed**:
- `src/mobile/views/MobileTodayView.vue` — Display and grouping fixes
- `src/utils/supabaseMappers.ts` — Preserve date-only strings

**Test Case**: Create a task with due date "2026-02-08" but no due time. In Israel (UTC+2), it should show "Anytime Today", not "2:00 AM".

---

### ~~BUG-1204~~: Challenges Table 404 / Initialization Failure (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: Console errors show `user_challenges` table returning 404 and `[Challenges] Initialization failed`. The challenges migration existed locally but was never applied to the VPS database.

**Root Cause**: VPS has no Supabase CLI migration tracking (`supabase_migrations.schema_migrations` doesn't exist). Migrations were applied manually via direct SQL but the challenges migration was missed.

**Additional Issue Found**: Two conflicting migration files existed (`20260206070234` and `20260206163002`) creating the same tables with different schemas. Code expected columns from both (e.g., `created_at`/`updated_at` from older, computed `completion_rate` from newer).

**Fix Applied (2026-02-07)**:
1. Merged both migrations into single canonical file (`20260206163002_challenges.sql`)
2. Deleted duplicate migration (`20260206070234_challenges.sql`)
3. Applied merged migration directly to VPS via SSH (`docker exec -i supabase-db psql`)
4. Verified PostgREST serves both endpoints (HTTP 200)

**Tables Created**: `user_challenges`, `challenge_history` (VPS now has 19 tables)
**Columns Added to `user_gamification`**: 9 new RPG fields (corruption, multiplier, class, counters)
**Also Created**: RLS policies, indexes, helper functions, auto-archive trigger, realtime subscription

**Known Remaining Issue**: `updateChallengeCounters()` uses `supabase.rpc('increment')` which doesn't exist — but the function is scaffolded MVP code that just logs (line 680). Not blocking.

**Errors**:
- `Failed to load resource: 404 (Not Found) (user_challenges)` — **FIXED**
- `[Challenges] Initialization failed` — **FIXED** (pending user verification)

---

### ~~TASK-1217~~: Add "Today" Filter to KDE Plasma Widget (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-22)

Add a "Today" button/filter option to the KDE Plasma widget's task list that filters to only show tasks with today's due date. Queries `due_date` column via Supabase REST API.

**Files**: `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml`

---

### ~~TASK-1177~~: Offline-First Sync System to Prevent Data Loss (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-23)

**Problem**: User lost significant work on production (in-theflow.com) due to silent sync failures.

**Root Causes Identified** (6 agents investigated):
1. **Silent error swallowing** (`taskOperations.ts:290-301`) - Save failures logged but not retried
2. **Smart merge drops tasks** (`taskPersistence.ts:272-287`) - Local-only tasks dropped after 5 min
3. **No write queue** - Failed writes lost forever
4. ~~**Optimistic UI no rollback**~~ ✅ - updateTask now has rollback on failure (Phase 4)
5. **Sync timeout silent** (`useNodeSync.ts:252-256`) - Timeout errors explicitly silenced
6. **No beforeunload** - Can close tab with unsaved data

**Solution Architecture (Offline-First)**:

1. ~~**Phase 1: Write Queue with IndexedDB**~~ ✅ (P0)
   - All writes go to IndexedDB FIRST, then sync to Supabase
   - Retry with exponential backoff: 1s, 2s, 4s, 8s... up to 60s max
   - 10 retry attempts before marking as "failed" (requires manual retry)
   - Never discard operations - persist until confirmed synced

2. ~~**Phase 2: Sync Status Indicator**~~ ✅ (P0)
   - Visual indicator in AppHeader.vue control panel
   - States: Synced (green), Syncing (blue), Pending (amber), Error (red), Offline (gray)
   - Error state NEVER auto-dismisses

3. ~~**Phase 3: Fix Smart Merge Logic**~~ ✅ (P0)
   - NEVER drop local-only tasks automatically
   - Queue for sync retry instead

4. ~~**Phase 4: Add Rollback to updateTask**~~ ✅ (P1) — DONE 2026-02-23
   - ~~Capture previous state before update~~
   - ~~Rollback local state on failure~~
   - Synchronous rollback via `persisted` flag: snapshot → optimistic mutation → track persistence → rollback if ALL paths fail
   - `onPermanentFailure` pub/sub callback in sync orchestrator for UI notification
   - Removed unused `RollbackState<T>` type

5. ~~**Phase 5: beforeunload Protection**~~ ✅ (P1)
   - Warn user before closing tab with unsaved changes

**Files to Create**:
- `src/types/sync.ts` - WriteOperation, WriteConflict, SyncStatus types
- `src/services/offline/writeQueueDB.ts` - Dexie.js IndexedDB schema
- `src/services/offline/operationSorter.ts` - Create→Update→Delete ordering
- `src/services/offline/operationCoalescer.ts` - Merge multiple updates
- `src/services/offline/retryStrategy.ts` - Exponential backoff calculation
- `src/composables/sync/useSyncOrchestrator.ts` - Main queue processing
- `src/stores/syncStatus.ts` - Pinia store for sync state
- `src/components/sync/SyncStatusIndicator.vue` - Header indicator
- `src/components/sync/SyncErrorPopover.vue` - Error details popover
- `src/composables/useBeforeUnload.ts` - Page close protection

**Files to Modify**:
- `src/stores/tasks/taskOperations.ts` - Use sync queue, add rollback
- `src/stores/tasks/taskPersistence.ts` - Fix smart merge, extend protection
- `src/stores/tasks.ts` - Fix 5s pending timeout
- `src/layouts/AppHeader.vue` - Add SyncStatusIndicator

**Success Criteria**:
- [x] User NEVER loses data, even with network failures
- [x] User ALWAYS sees current sync status
- [x] User CANNOT close tab with unsaved changes (without warning)
- [x] Failed syncs retry automatically with backoff
- [x] Offline edits persist across browser sessions
- [x] Smart merge NEVER drops local-only tasks

---

### ~~BUG-1182~~: saveTasks Fails After Realtime Disconnect (✅ DONE)

**Root Cause**: After sleep/wake, the JWT token expires but `withRetry()` retries 401 errors with the same stale token (all 3 attempts fail). The save failure was silently swallowed in `saveTasksToStorage()`, causing data loss.

**Fix (3 layers)**:
1. Token refresh in `withRetry()` before retrying on 401/403 (`useSupabaseDatabase.ts`)
2. Proactive token refresh on visibility change / wake-up (`useSupabaseDatabase.ts`)
3. Surface save failures when authenticated — re-throw instead of silently swallowing (`taskPersistence.ts`)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: After realtime connection drops (BUG-1179), task save operations fail:
```
i@.../index-CAXNPz-Z.js:144:4526
saveTasks@.../index-CAXNPz-Z.js:144:14019
```

---

### ~~TASK-1128~~: Add "Create Group From Selection" Context Menu Option (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Feature**: When multiple tasks are selected on canvas, right-click should show "Add to New Group" option that:
1. Creates a new group at the bounding box location of selected tasks
2. Automatically parents all selected tasks to the new group
3. Sizes the group to contain all selected tasks with padding

**Implementation**:
- [x] Add context menu option when `selectedNodes.length > 1`
- [x] Calculate bounding box of selected nodes
- [x] Create group with appropriate position and dimensions
- [x] Update selected tasks' parentId to new group

**Awaiting**: User verification

**Files Changed**:
- `src/components/canvas/CanvasContextMenu.vue` - Added "Add to New Group" menu option
- `src/components/canvas/CanvasContextMenus.vue` - Event forwarding
- `src/composables/canvas/useCanvasActions.ts` - `createGroupFromSelection()` implementation
- `src/views/CanvasView.vue` - Wired up event handler

---

### ~~BUG-1103~~: Local Dev Auth Signs Out Both Tabs on Second Tab Sign-In (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-01-28)

**Problem**: In local development, when user has two browser tabs open:
1. Sign in on first tab - works
2. Open second tab and try to sign in
3. Both tabs get signed out

**Symptoms**: Auth session not persisting across multiple browser tab instances during local development.

**Likely Causes**:
1. Session token overwrite/conflict between tabs
2. `onAuthStateChange` listener firing logout event to all tabs
3. Supabase local storage key collision
4. Race condition in auth initialization across tabs

**Files to Investigate**: `src/stores/auth.ts`, `src/services/auth/supabase.ts`

**Related**: BUG-1086 (auth persistence issues on VPS)

---

### ~~BUG-347~~: FK Constraint Violation on parent_task_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-13)

**Root Cause**: Tasks saved with `parent_task_id` refs to deleted tasks, no existence validation, race conditions in batch upserts.

**Solution**: Catch-and-retry on FK error code `23503` - clear parent refs and retry once. Applied in `useSupabaseDatabase.ts` (`saveTask()`, `saveTasks()`).

---

### ~~BUG-309~~: Ctrl+Z Keyboard Shortcut Not Triggering Undo (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Fix Applied**: Added `executeUndo()`, `executeRedo()`, `executeNewTask()` calls + `shouldIgnoreElement()` check in `src/utils/globalKeyboardHandlerSimple.ts`.

---

### ~~TASK-1524~~: Migrate old `recurrence` field to new `recurrenceRule` on app init (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-14)

**Problem**: Tasks created before TASK-1403 use `recurrence: TaskRecurrence` (old format) but not `recurrenceRule: SimpleRecurrenceRule` (new format). Recurring badge, delete dialog, and scheduler all depend on `recurrenceRule`, so old tasks appeared non-recurring.

**Solution**: Created `src/composables/useRecurrenceMigration.ts` with:
- `convertOldToNew(oldRecurrence)` — converts `TaskRecurrence` → `SimpleRecurrenceRule` for patterns `daily`/`weekly`/`monthly`/`yearly` (skips `none` and `custom`)
- `migrateIfNeeded()` — iterates `taskStore._rawTasks`, skips tasks that already have `recurrenceRule`, updates via `taskStore.updateTask()` (hits Supabase), marks done in localStorage key `flowstate-recurrence-migration-v1`
- Migration is idempotent, runs once per device, preserves old `recurrence` field

Wired into `src/composables/app/useAppInitialization.ts` — runs after tasks load (Phase B background refresh), before recurrence scheduler (`useRecurrenceScheduler`).

**Files changed**:
- `src/composables/useRecurrenceMigration.ts` (new)
- `src/composables/app/useAppInitialization.ts` (added migration call)

---

### ~~TASK-1521~~: Calendar day/week drag deferred to mouseup (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-24)

**Problem**: The `_startEventDrag` (day view) and `_startWeekDrag` (week view) handlers called `taskStore.updateTask()` inside the mousemove handler on every slot change. This caused excessive DB writes and had no undo support.

**Fix**: Applied preview-then-commit pattern (mirrors the existing resize handler):
- Added `dragPreview` ref in `useCalendarDayView.ts` and `weekDragPreview` ref in `useCalendarWeekView.ts`
- `getEventStyle` / `getWeekEventStyle` use the preview slot/dayIndex during drag for visual feedback
- `mousemove` only updates the local preview refs — zero store writes
- `mouseup` calls `taskStore.updateTaskWithUndo()` once (supports Ctrl+Z)
- `Escape` key cancels the drag with no persistence
- Duplicate-mode (Alt+drag) still creates a task on mouseup only

**Files changed**:
- `src/composables/calendar/useCalendarDayView.ts`
- `src/composables/calendar/useCalendarWeekView.ts`

---

### ~~TASK-1520~~: Add recurring indicator badge to task cards (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**What**: Added a small `Repeat` icon badge (teal, `var(--brand-primary)`) to task cards in all views when `task.recurrenceRule` is set. Tooltip shows `describeRecurrenceRule()` output (e.g., "Repeats every day").

**Files changed**:
- `src/components/kanban/card/TaskCardBadges.vue` — recurring badge after attachments badge
- `src/components/canvas/node/TaskNodeMeta.vue` — recurring badge with "Recurring" text label + new `recurrenceRule` prop
- `src/components/canvas/TaskNode.vue` — passes `task?.recurrenceRule` to `TaskNodeMeta`
- `src/components/tasks/HierarchicalTaskRowContent.vue` — recurring icon between due date and progress bar

---

### ~~TASK-1525~~: Recurring task delete dialog — Skip/Stop/Cancel (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-14)

**What**: Phase 1 of recurring task management. When deleting a recurring task, shows a dialog with three options:
- **Skip this occurrence** — advances recurrence chain to next date (calls `skipRecurringOccurrence()`)
- **Stop all future occurrences** — clears `recurrenceRule` chain-wide (calls `stopRecurrence()`)
- **Cancel** — do nothing

All 11 delete paths in the app now route through the recurrence-aware dialog globally via CustomEvent pattern.

**Files changed**:
- `src/components/modals/RecurrenceDeleteModal.vue` — modal dialog with Skip/Stop/Cancel buttons, shows recurrence preview
- `src/composables/useRecurrenceAwareDelete.ts` — composable that intercepts all delete operations, shows dialog if task is recurring
- `src/stores/tasks/taskOperations.ts` — `skipRecurringOccurrence()` and `stopRecurrence()` operations
- `src/services/modals/ModalManager.ts` — updated to emit custom delete events that composable listens to
- Multiple delete paths updated: Kanban context menu, Canvas context menu, Quick Sort, Calendar drag, Board, etc. (all 11 entry points)

**Key insight**: Instead of updating 11 delete call sites individually, created a global composable that listens for CustomEvent "delete-task" emissions from ModalManager. All delete paths emit the event, composable intercepts and shows dialog if needed.

---

## Active Tasks (IN PROGRESS)

### ~~BUG-1580~~: Replace native confirm() dialogs broken in Tauri/WebKitGTK (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-21)

**Problem**: Three places use native `confirm()` / `window.confirm()` which silently fails in Tauri's WebKitGTK webview — the dialog never appears and the call returns `false`, making task deletion impossible from the canvas.

**Files**:
1. `src/composables/canvas/useCanvasTaskActions.ts:321` — `deleteSelectedTasks()` uses `confirm()`
2. `src/components/canvas/MultiSelectionOverlay.vue:214` — `bulkDelete()` uses `confirm()`
3. `src/components/sidebar/SidebarWorkspaceSwitcher.vue:364` — `handleDeleteWorkspace()` uses `window.confirm()`

**Fix**:
1. `useCanvasTaskActions.ts`: Populate `bulkDeleteItems` + open `isBulkDeleteModalOpen` (same pattern as `useCanvasHotkeys.ts`)
2. `MultiSelectionOverlay.vue`: Route through same canvas bulk delete modal (emit to parent or use modals store)
3. `SidebarWorkspaceSwitcher.vue`: Add `ConfirmationModal` component with reactive state

---

### ~~TASK-1581~~: Audit and update system-architecture.md (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-21)

**Summary**: Comprehensive audit of `docs/claude-md-extension/system-architecture.md` against the actual codebase. Removed stale `architecture.md` (redirected 8 references). Fixed 28 discrepancies: wrong file counts (composables, components, services), missing directories, outdated route info (`/morning` is an overlay not a route), disabled Tauri notification plugin, expanded DB schema from 19→24+ tables, and added new i18n and Utilities sections.

---

### ~~BUG-1437~~: Task doesn't inherit group properties on move (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: When moving a task into a canvas group, the task doesn't inherit the group's properties (e.g., due date from a date-based group). The task retains its old values instead of adopting the group's context.

**Fix**: Removed the overly aggressive BUG-1432 guard (`if (key === 'dueDate' && task.dueDate) continue`) from `src/composables/canvas/useCanvasInteractions.ts` lines 774-779. The guard was inside the `if (targetGroup && oldParentId !== newParentId)` block — meaning it only ran on cross-group moves anyway. The outer condition already prevents same-group repositioning from overwriting dates, making the inner guard redundant and harmful. Cross-group moves now correctly inherit the new group's dueDate.

---

### ~~TASK-1436~~: Active Task Glass Pill next to Pomodoro Timer (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-07)

**Problem**: The Pomodoro timer shows the task name as a small muted text inside the timer display. This lacks visual prominence and doesn't match the glass morphism design system.

**Scope**:
1. Remove old `.timer-task` inline text from timer display
2. Add a separate glass pill component after the timer in `.control-panel`
3. Pill shows project color dot (or emoji) + task name with fade+slide transition

**Files**: `src/layouts/AppHeader.vue`

---

### ~~TASK-1060~~: Infrastructure & E2E Sync Stability (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-02-22)

**Problem**: Intermittent sync failures across Web, Tauri, PWA, KDE Widget - 0 tasks shown, WebSocket 403 errors, SIGTERM exits.

**Root Causes Found**:
1. CI/CD `deploy.yml` was killing System Caddy, starting Docker Caddy (conflict)
2. SWR cache not invalidated on auth change (fixed in BUG-1056)
3. Silent session refresh failure didn't set error state (fixed 2026-01-30)
4. No retry on initial database load (fixed 2026-01-30)
5. Fetch functions started before auth ready (fixed 2026-01-30)
6. Tauri `.expect()` panic on startup failure (fixed 2026-01-30)
7. Circular dependency causing TDZ error in production build (BUG-1099, fixed 2026-01-30)

**Infrastructure Fixes Applied** (2026-01-24):
- Docker stack stopped, System Caddy re-enabled
- Fixed `deploy.yml` - static files only, graceful Caddy reload

**Phase 2 Fixes Applied** (2026-01-30):
- Mark `initializationFailed` when session refresh fails (`auth.ts`)
- Add retry wrapper (3x with backoff) for initial database load (`useAppInitialization.ts`)
- Add auth initialization guard to `fetchTasks`, `fetchProjects`, `fetchGroups` (`useSupabaseDatabase.ts`)

**Phase 3 Fixes Applied** (2026-01-30):
- Replace `.expect()` panic with graceful error handling + helpful messages (`lib.rs`)

**Phase 4 Audit Findings** (2026-01-30):
- Offline database (`useOfflineDatabase.ts`) is a shell - NOT integrated with Supabase
- Notification fallback lacks action buttons when SW unavailable
- SWR cache 3s stale window acceptable but may cause brief position flash
- Added Caddy systemd auto-restart config

**Remaining Phases** (condensed):
- [ ] Phase 1.3: Verify JWT keys in `/opt/supabase/docker/.env` (requires VPS SSH)
- [x] Phase 2: Auth flow audit + fixes (DONE 2026-01-30)
- [x] Phase 3: Tauri debug + panic fix (DONE 2026-01-30)
- [x] Phase 4: PWA service worker audit (DONE 2026-01-30 - offline DB gap identified)
- [x] Phase 5: KDE widget token refresh on startup (DONE 2026-01-31 - was loading expired tokens)
- [ ] Phase 6: Cross-platform E2E matrix test (requires testing)

**Success Criteria**: Caddy 24h+ uptime, no 0-task loads, Tauri no SIGTERM, PWA overnight persistence.

**Key Files**: `/etc/caddy/Caddyfile`, `src/stores/auth.ts`, `src/composables/useSupabaseDatabase.ts`, `src-tauri/src/lib.rs`, `kde-widget/package/contents/ui/main.qml`

---

### TASK-1214: Child Groups Inherit Parent Group Properties (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS (Started: 2026-02-06)

**Problem**: When dropping a task into a nested child group, the task only inherits properties from the immediate child group. Parent group properties (especially dates like "Today") are NOT inherited.

**Expected Behavior**: Task dropped into child group → inherits date from parent group + any properties from child group (child overrides parent for conflicts).

**Solution Implemented**:
1. Added `getParentChain()` utility in `storeHelpers.ts` - traverses from child to parent groups
2. Modified `getSectionProperties()` to traverse parent chain and merge properties (root → child order)
3. Updated `useCanvasInteractions.ts` to pass `allGroups` for inheritance

**Current Status**: Implementation verified with 16 unit tests. Debug logging cleaned up. `applyAllNestedSectionProperties` fixed to thread `allGroups` param.

**Key Files**:
- `src/utils/canvas/storeHelpers.ts` - `getParentChain()` function (cycle-safe, depth-limited)
- `src/composables/canvas/useCanvasSectionProperties.ts` - Parent chain traversal + merge (root→child)
- `src/composables/canvas/useCanvasInteractions.ts` - Passes allGroups to enable inheritance
- `tests/unit/canvas/parentChainInheritance.test.ts` - 16 unit tests covering chain traversal + property merge

---

### ~~TASK-149~~: Canvas Group Stability Fixes (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-04-04)

**Problems**: Position jump during resize, zombie groups, tolerance snapping, inconsistent containment, group duplication.

**Diagnostics**: `assertNoDuplicateIds()` helper in `src/utils/canvas/invariants.ts`.

**Pending Fixes**: 4 (settling flag timing), 5 (remove tolerance snapping), 8 (zombie prevention).

---

### TASK-241: Position Versioning & Conflict Detection (✅ Phase 1 COMPLETE)

**Priority**: P0-CRITICAL | **Status**: ✅ Phase 1 COMPLETE

**Phase 1 Done**:
- [x] SQL migration for `position_version` auto-increment triggers
- [x] `src/utils/canvas/coordinates.ts` - position conversion source of truth
- [x] `src/composables/canvas/useCanvasOperationState.ts` - state machine

**Phase 2 Pending**:
- [ ] Run SQL migration in Supabase Dashboard
- [ ] Wire state machine into `useCanvasOrchestrator`
- [ ] Test: drag → refresh → verify position persists

---

### ~~FEATURE-1223~~: AI Chat System Overhaul — RTL, Inline Editing, Full-Screen, Agent Chains (✅ DONE)

**Priority**: P0-P3 (phased) | **Status**: ✅ DONE (2026-03-25) — Phases 1-3+5 complete. Phase 4 (polish) deferred to P4.

**Problem**: The AI Chat panel has critical UX issues (RTL broken for Hebrew, task names truncated, raw ISO dates, no inline editing) and lacks key features (full-screen mode, conversation history, voice input, gamification integration, multi-step agent workflows).

**5-Agent Expert Research (2026-02-08)**: UX Expert, AI Automation Expert, AI Agent Chains Expert, RTL/i18n Expert, Product Strategy Expert all completed deep analysis. Full findings in conversation history.

#### Phase 1: Fix & Foundation (P0 — IMMEDIATE)

- [x] ~~**TASK-1223**~~: ✅ RTL fix — CSS logical properties, `dir="auto"` on task titles, panel position mirroring
- [x] ~~**TASK-1224**~~: ✅ Task name truncation — replace `nowrap` with 2-line clamp (`-webkit-line-clamp: 2`)
- [x] ~~**TASK-1225**~~: ✅ Date formatting — new `formatRelativeDate()` utility using `Intl.RelativeTimeFormat` (auto Hebrew/English)
- [x] ~~**TASK-1226**~~: ✅ Inline task editing in chat results — clickable priority/status/date dropdowns on task list items
- [x] ~~**TASK-1227**~~: ✅ Task list item 2-row layout — priority dot + title (row 1), date + status badges (row 2)

#### Phase 2: Expand & Enrich (P1 — ✅ DONE)

- [x] ~~**TASK-1228**~~: ✅ Expandable panel — toggle 380px → 600px → fullscreen with keyboard shortcut (Ctrl+Shift+F)
- [x] ~~**TASK-1229**~~: ✅ Gamification tools — `get_gamification_status`, `get_active_challenges`, `get_achievements_near_completion`
- [x] ~~**TASK-1230**~~: ✅ Cyberflow AI personality mode — "Grid Handler" netrunner persona via system prompt toggle
- [x] ~~**TASK-1231**~~: ✅ Voice input — microphone button with Web Speech API, auto-fills input, pulse animation
- [x] ~~**TASK-1232**~~: ✅ Productivity tools — `get_productivity_stats`, `suggest_next_task`, `get_weekly_summary`
- [x] ~~**TASK-1233**~~: ✅ Native function calling — Groq/OpenRouter `tools[]` API parameter with text-based regex fallback for Ollama

#### Phase 3: Deep Features (P2 — ✅ DONE)

- [x] ~~**TASK-1234**~~: ✅ Conversation history — multiple conversations, auto-naming, localStorage model, conversation list UI
- [x] ~~**TASK-1235**~~: ✅ Full-screen `/ai-chat` route — dedicated view with conversation sidebar, two-column layout
- [x] ~~**TASK-1236**~~: ✅ Deterministic agent chains — "Plan my day", "End of day review", "Focus mode setup" (works with Ollama)
- [x] ~~**TASK-1237**~~: ✅ ReAct agentic loop — multi-step reasoning for Groq/OpenRouter (circuit-breaker, abort, error recovery)
- [x] ~~**TASK-1238**~~: ✅ AI challenge narrator — push narrative events to chat on challenge complete/fail
- [x] ~~**TASK-1239**~~: ✅ Inline actions on results — "Mark done", "Start timer" hover buttons on task items

#### Phase 4: Polish & Innovation (P4 — DEFERRED)

- [ ] **TASK-1240**: Supabase chat persistence — `ai_conversations` + `ai_messages` tables, cross-device sync
- [ ] **TASK-1241**: Mobile bottom sheet — replace side panel with bottom sheet on mobile
- [ ] **TASK-1243**: ⏸️ PAUSED — AI Game Master boss fights — real-time narrated boss encounters via chat
- [ ] **TASK-1245**: Dynamic prompt assembly — only include relevant tool definitions per request type
- [ ] **TASK-1296**: AI Assist composable — `useAITaskAssist` with 7 actions (subtasks, priority, breakdown, date, title, related, summarize)
- [ ] **TASK-1297**: AI Assist popover component — `AITaskAssistPopover.vue` with action buttons + result display
- [ ] **TASK-1298**: Context menu AI Assist — ✨ button in TaskContextMenu with AI popover
- [ ] **TASK-1299**: Edit modal AI Assist — ✨ button in TaskEditModal footer, auto-populate form fields
- [ ] **TASK-1300**: Quick create AI Assist — ✨ button in QuickTaskCreate next to title input
  **Progress (2026-02-12):** All 5 files implemented + integrated. Hebrew/RTL language detection added. Sticky bar translucency fixed. Awaiting user testing.

#### Phase 5: AI Chat Intelligence Improvements (P1 — ONGOING)

- [x] ~~**TASK-1329**~~: ✅ Fix mixed-language responses — localized pipeline headers (preDigestedReasoning, reasoningDirective, contextOptimizer), localized ReAct tool feedback injection, added ReAct language retry loop, added agent chain language directive. 8 gaps identified, 6 high/medium fixed. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1330**~~: ✅ Improve prompt quality — 14-finding audit: consolidated 6 contradictory length instructions into 1 canonical rule, disambiguated 3 overlapping tools, slimmed tool feedback (~600 tokens/step saved), expanded intent classifier (13→25 tools), removed anti-fluff contradictions, fixed personality prompt override, fixed field name mismatches in pre-digested reasoning, removed broad keywords, added agent chain language awareness. (✅ DONE 2026-02-23)
- [x] ~~**TASK-1331**~~: ✅ Weekly plan AI quality — 7-gap audit: (1) pass BehavioralContext through chat tool path, (2) resolve project names for batching, (3) replace plan digest/directive short-circuits with structured scheduling facts, (4) agent chain passes frontload preference when 3+ overdue, (5) enriched chain prompt with per-day distribution + unscheduled, (6) added on_hold/future-dated task filters, (7) skip past weekdays in chat-triggered plans. (✅ DONE 2026-02-25)
- [x] ~~**TASK-1332**~~: ✅ Add Kimi K2 to Groq model dropdown — DONE (added `moonshotai/kimi-k2-instruct-0905`)
- [ ] **TASK-1363**: AI chat shows done tasks + raw UUIDs + unstructured verbose responses — filter done from list/search by default, hide IDs from AI output, tighten response formatting rules
- [x] ~~**BUG-1374**~~: ✅ AI Chat 4-bug combo — (1) English input → Hebrew response (task data context overrides language), (2) Hebrew text renders LTR (Step indicator breaks `dir="auto"`), (3) fluffy generic advice instead of concise analysis, (4) wrong tasks returned (`list_tasks` has no date/priority filter). Pipeline + prompt-level fixes all applied 2026-02-21. (✅ DONE 2026-02-21)

**Key Files**:
- `src/components/ai/ChatMessage.vue` — message rendering, task list items, inline actions, RTL CSS
- `src/components/ai/AIChatPanel.vue` — panel layout, settings, quick actions, full-screen nav
- `src/components/ai/AITaskAssistPopover.vue` — AI assist popover with context-aware actions + results (Phase 4)
- `src/views/AIChatView.vue` — full-screen AI chat with conversation sidebar (Phase 3)
- `src/composables/useAIChat.ts` — chat logic, tool execution, agent chains, ReAct loop
- `src/composables/useAITaskAssist.ts` — 7 AI-powered task assist actions (Phase 4)
- `src/composables/useAgentChains.ts` — deterministic multi-step tool chains (Phase 3)
- `src/composables/useAIChallengeNarrator.ts` — gamification event narrator (Phase 3)
- `src/stores/aiChat.ts` — conversation model, multi-chat persistence
- `src/services/ai/tools.ts` — tool definitions (20 current, 6+ planned)
- `src/services/ai/router.ts` — provider routing
- `src/utils/dateUtils.ts` — date formatting utilities

**Competitors Analyzed**: Linear AI, ClickUp Brain, Notion AI 3.0, Todoist Ramble, Motion, GitHub Copilot Chat, Cursor IDE

#### Phase 6: Programmatic Guardrails Pipeline — ChatGPT-Level Reliability (P1 — PLANNED)

**Goal:** Move AI chat from prompt-engineering-dependent to code-enforced reliability. Pre/post-processing pipeline between user input and LLM output ensures language, quality, and formatting are enforced deterministically — not hoped for via prompts.

**Architecture:**
```
User Input → [Pre-Processing] → LLM (ReAct loop) → [Post-Processing] → Render
```

**New file structure:** `src/services/ai/pipeline/` (types, preprocess, postprocess, languageDetector, contextOptimizer, responseValidator)

**Infrastructure:**
- [x] ~~**TASK-1375**~~: ✅ Pipeline orchestrator + types — create `src/services/ai/pipeline/` with `types.ts` (PreProcessResult, PostProcessResult, Guardrail, PipelineConfig interfaces) and `index.ts` (createPipeline, runPreProcess, runPostProcess). Pure function composition, fully testable.
- [x] ~~**TASK-1376**~~: ✅ Language detector — `languageDetector.ts` with `detectLanguage(text)` using Unicode range analysis (extract from qualityAssessment.ts:468-483) and `detectLanguageMismatch(input, output)`. No LLM calls — deterministic.
- [x] ~~**TASK-1377**~~: ✅ Context optimizer — `contextOptimizer.ts` to replace inline task injection in `buildSystemPrompt` (lines 360-418). Separate Hebrew titles from English metadata labels, character budget (3000 chars), date-relative filtering (today/overdue first). **Highest single ROI fix** — reduces language contamination at the source.

**Post-Processing Guardrails:**
- [x] ~~**TASK-1378**~~: ✅ Response validator — consolidate ALL response cleanup from 3 locations (stripToolBlocks, stripTextToolCalls, ChatMessage.vue renderedContent regex) into one `responseValidator.ts`. Add UUID stripping, reuse `runRuleChecks` from qualityAssessment.ts.
- [x] ~~**TASK-1379**~~: ✅ Language enforcer — post-processing guardrail using TASK-1376's `detectLanguageMismatch()`. V1: detect + flag in metadata (`languageMismatch: true`) for UI indicator. V2 (future): re-call LLM for translation.
- [x] ~~**TASK-1380**~~: ✅ Response length enforcer — cap responses by intent (greetings: 200 chars, tool summaries: 500 chars, analytical: warn on >2000 chars without structure).

**Integration:**
- [x] ~~**TASK-1381**~~: ✅ Wire pre-processing into useAIChat — call `runPreProcess()` before ReAct loop, replace inline `buildSystemPrompt` task injection with contextOptimizer, pass `PreProcessResult` through loop. Depends: TASK-1375, 1376, 1377.
- [x] ~~**TASK-1382**~~: ✅ Wire post-processing into useAIChat — run `runPostProcess()` after ReAct loop (before `completeStreamingMessage`), replace inline cleanup. Depends: TASK-1378, 1379, 1380, 1381.
- [x] ~~**TASK-1383**~~: ✅ Simplify ChatMessage.vue renderedContent — remove redundant regex stripping (now handled by pipeline). `renderedContent` becomes: sanitize + markdown render only. Depends: TASK-1382.
- [x] ~~**TASK-1384**~~: ✅ Unit tests for pipeline — test each guardrail independently (language detection, response cleaning, context optimization, pipeline composition). Depends: TASK-1375–1380.

**Dependency graph:**
```
Wave 1: TASK-1375, TASK-1376 (no deps)
Wave 2: TASK-1377, TASK-1378, TASK-1379, TASK-1380 (depend on Wave 1)
Wave 3: TASK-1381, TASK-1384 (depend on Wave 2)
Wave 4: TASK-1382 (depends on Wave 3)
Wave 5: TASK-1383 (cleanup, depends on Wave 4)
```

#### Phase 7: AI Intelligence Layer — From Prompt-Dependent to Code-Enforced Reliability (P1 — PLANNED)

**Goal:** Make AI chat as reliable as ChatGPT/Claude Desktop. Four pillars: (1) pre-digested reasoning so the LLM formats facts rather than discovers them, (2) generic fluff detection with retry, (3) tool hints so the right tool is called first try, (4) fuzzy title resolution so "mark the auth bug as done" just works.

**Research basis (2025-2026):** Linear AI / Cursor pattern: compute reasoning in code, LLM only writes prose. Groq Llama 3.3 70B tool calling is documented as intermittent (Agno #4090). uFuzzy outperforms Fuse.js for short string matching. Rule-based validation before LLM-as-judge is the cost-effective quality gate.

**Pillar 1: Pre-Digested Reasoning (highest ROI)**
- [x] ~~**TASK-1388**~~: ✅ Pre-digested reasoning engine — instead of sending raw JSON tool results and hoping the LLM reasons, compute the analysis IN CODE (days overdue, subtask progress %, project context, priority ranking) and send pre-written facts the LLM only needs to format naturally. Pattern: `"Task X: 3 days overdue, 0/5 subtasks, high priority in Project Auth"` → LLM writes connecting prose. Inject into tool result follow-up prompt in `useAIChat.ts`. Key insight from Cursor/Linear: minimize what the LLM invents, maximize what deterministic code computes.
- [x] ~~**TASK-1389**~~: ✅ Skeleton prompting for agent chains — refactor `useAgentChains.ts` chain prompts to use skeleton pattern: code generates structured sections (overdue analysis, today's priorities, progress summary), LLM fills only 1-sentence natural language bridges between sections. Eliminates "wall of generic text" from plan_my_day and end_of_day_review chains.

**Pillar 2: Generic Response Detection + Retry**
- [x] ~~**TASK-1390**~~: ✅ Fluff detector guardrail — `src/services/ai/pipeline/fluffDetector.ts`. Heuristic scoring: check if response references actual task titles from context (0.3 weight), contains specific data points like dates/numbers (0.15), has no generic advisory phrases like "consider", "it's essential", "you might want to" (0.05 each). Score 0-1, threshold 0.5 = retry. Based on 2025 "Detecting Prompt Knowledge Gaps" paper specificity dimensions. Zero-cost, runs client-side.
- [x] ~~**TASK-1391**~~: ✅ Validation + retry loop — when fluff detector score < 0.5 after tool results, retry once with stricter prompt: append the validation feedback ("your response referenced no specific tasks, try again naming actual tasks from the results"). Max 1 retry to avoid latency. If retry also fails, return best attempt with post-processing cleanup. Wire into `useAIChat.ts` post-ReAct section.

**Pillar 3: Tool Hints + Intent Routing**
- [x] ~~**TASK-1392**~~: ✅ Keyword-based tool hints — `src/services/ai/pipeline/toolHints.ts`. Deterministic keyword → tool mapping: "overdue" → `get_overdue_tasks`, "plan my week" → `generate_weekly_plan`, "timer" → `get_timer_status`/`start_timer`, "what should I" → `suggest_next_task`. Inject hint into system prompt: "Consider using `get_overdue_tasks` for this query." Reduces ReAct steps from 2-3 to 1. Supports Hebrew keywords too.
- [x] ~~**TASK-1393**~~: ✅ `projectId` filter on `list_tasks` — add optional `projectId` parameter to `list_tasks` tool definition and execution. Already has project data accessible. 15-minute quick win.
- [x] ~~**TASK-1394**~~: ✅ Counting vs listing system prompt clarification — add explicit rule: "For COUNTING questions (how many, what's total), answer from context — do NOT call tools. For LISTING questions (show me, what are my tasks), use tools to show interactive cards." Prevents unnecessary tool calls.

**Pillar 4: Fuzzy Title Resolution**
- [x] ~~**TASK-1395**~~: ✅ Install uFuzzy + `resolveTask()` helper — `npm install @leeoniya/ufuzzy`. Create `src/services/ai/entityResolver.ts` with `resolveTask(idOrTitle, tasks)`: (1) exact UUID match, (2) exact TASK-XXX ID match, (3) uFuzzy title search. Returns best match or top-3 candidates if ambiguous. uFuzzy chosen over Fuse.js: 7.5KB, ~1ms for 1k items, better quality on short strings without tuning.
- [x] ~~**TASK-1396**~~: ✅ Wire `resolveTask()` into write tools — modify `validateTaskExists()` in `tools.ts` to fall through to `resolveTask()` when UUID lookup fails. Affects: `update_task`, `update_task_status`, `delete_task`, `start_timer`, `stop_timer`. User says "mark the video as done" → LLM passes title fragment → `resolveTask` finds the task.
- [x] ~~**TASK-1397**~~: ✅ `mark_task_done` convenience tool — new tool alias that accepts `taskTitle` (string) instead of requiring UUID. Internally calls `resolveTask()` + `taskStore.updateTask(id, { status: 'done' })`. Most common user action shouldn't depend on UUID resolution.
- [x] ~~**TASK-1398**~~: ✅ Conversation entity memory — track recently-mentioned task IDs in conversation metadata. When user says "it", "that task", "the last one", resolve to most recently mentioned entity. Store in `aiChat` store alongside messages. Enables multi-turn: "show overdue tasks" → "mark the first one as done."

**Dependency graph:**
```
Wave 1 (no deps):     TASK-1388, TASK-1390, TASK-1392, TASK-1393, TASK-1394, TASK-1395
Wave 2 (dep Wave 1):  TASK-1389, TASK-1391, TASK-1396, TASK-1397
Wave 3 (dep Wave 2):  TASK-1398
```

**npm packages to install:** `@leeoniya/ufuzzy` (7.5KB, fuzzy matching)

---

### ~~TASK-1249~~: Codebase Hygiene Audit — Placeholders, Hardcoded Values, Debug Leftovers (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-02-27)

**Summary**: Comprehensive 7-agent audit found 10 CRITICAL, 34 MEDIUM, 29 LOW issues across placeholders, hardcoded values, demo content, debug leftovers, design token violations, AI config, and metadata.

**Sub-Tasks (ordered by priority)**:

#### P0 — Security & Broken Functionality
- [x] **~~TASK-1250~~**: ✅ Fix API key storage — removed plaintext localStorage inputs since proxy handles keys server-side (`AIChatPanel.vue`)
- [x] **~~TASK-1251~~**: ✅ Fix direct API calls bypassing proxy — route model-listing through `aiChatProxy.ts` instead of direct fetch to groq.com/openrouter.ai (`AIChatPanel.vue:275,290`)
- [x] **~~TASK-1252~~**: ✅ Remove or gate `/keyboard-test` debug route — ships without auth, exposes task creation/deletion debug panel (`router/index.ts:105-108`)
- [x] **~~TASK-1253~~**: ✅ Gate `window.__flowstate_tauri_debug` behind `import.meta.env.DEV` (`useTauriDebug.ts:270-276`)
- [x] **~~TASK-1254~~**: ✅ Fix CORS wildcard on Supabase Edge Functions — restricted to `in-theflow.com` + Tauri + dev origins (`supabase/functions/*/index.ts`)
- [x] **~~TASK-1255~~**: ✅ Fix WelcomeModal dead buttons — removed non-functional saveDisplayName, exportData, and stubbed userStats (`WelcomeModal.vue`)
- [x] **~~TASK-1256~~**: ✅ Fix stale production origins — `flowstate.app` → `in-theflow.com` (`environments.ts`)
- [x] **~~TASK-1257~~**: ✅ Fix `productionLogger.ts` — now uses Supabase session token via `supabase.auth.getSession()`

#### P1 — Production Quality
- [x] **~~TASK-1258~~**: ✅ Replace httpbin.org with self-hosted endpoint — production code now uses `in-theflow.com` (`performanceBenchmark.ts`, `useNetworkOptimizer.ts`)
- [x] **~~TASK-1259~~**: ✅ Remove unconditional `%c[DEBUG]` styled log from `useCanvasOrchestrator.ts`
- [x] **~~TASK-1260~~**: ✅ Remove ~30 bug-specific debug tags across 10 files (`[BUG-339-DEBUG]`, `[TASK-288-DEBUG]`, `[DELETE-DEBUG]`, `[BUG-1116:DRAG-DEBUG]`, `[KEYBOARD]` etc.)
- [x] **~~TASK-1261~~**: ✅ Fix silent no-op stubs — now throw Error or console.warn (`taskPersistence.ts`)
- [x] **~~TASK-1262~~**: ✅ Re-enable CI lint & unit tests (`.github/workflows/ci.yml`)
- [x] **~~TASK-1263~~**: ✅ Add Open Graph + Twitter Card meta tags + improved description (`index.html`)
- [x] **~~TASK-1264~~**: ✅ Update stale AI model references — router.ts, types.ts, openrouterProxy.ts
- [x] **~~TASK-1265~~**: ✅ Fix AI proxy health check consuming real API tokens every 60s — switched to OPTIONS request instead of chat completion (`aiChatProxy.ts:412-421`)

#### P2 — Code Quality & Design System
- [x] **~~TASK-1266~~**: ✅ CSS design token migration — top offending files migrated. Original: 1,420 raw rgba + 434 hex across 129 files. Migrated 15 top-offending component files (MultiSelectToggle, DragHandleVisuals, BaseCard, TaskRow, KanbanColumn.css, KanbanSwimlane.css, TaskCard.css, GroupModal, EmojiPicker, AccountSettingsTab, useToast, errorHandler, GamificationPanel, DoneToggleVisuals, AchievementToast). True violations reduced to ~101 rgba + ~170 hex (long tail of 2-7 per file across many components).
- [x] **~~TASK-1267~~**: ✅ Standardize localStorage key prefixes — settings.ts migrated with migration logic for old keys
- [x] **~~TASK-1268~~**: ✅ Extract magic timeout numbers to named constants — created `src/config/timing.ts` with PENDING_WRITE_TIMEOUT_MS, DRAG_SETTLE_TIMEOUT_MS, FILE_DIALOG_TIMEOUT_MS, CROSS_TAB_DEDUP_TIMEOUT_MS, RESIZE_SETTLE_TIMEOUT_MS
- [x] **~~TASK-1269~~**: ✅ Create centralized `src/config/urls.ts` — EXTERNAL_URLS with DiceBear, GitHub, production site, Storybook dev
- [x] **~~TASK-1270~~**: ✅ Fix hardcoded i18n defaults — updated ui.ts comment, wrapped password strength labels in `t()` calls, added en/he translations
- [x] **~~TASK-1271~~**: ✅ Improve Cyberflow empty states — added explanatory subtext to CyberSkillTree, CyberAchievements, CyberShop
- [x] **~~TASK-1272~~**: ✅ Mobile design token compliance — MobileTodayView migrated to tokens
- [x] **~~TASK-1273~~**: ✅ Update PWA manifest description — updated to FlowState branding with full feature description
- [x] **~~TASK-1274~~**: ✅ Migrate `'uncategorized'` sentinel to constant — created UNCATEGORIZED_PROJECT_ID in taskOperations.ts, used in supabaseMappers + useSupabaseDatabase

#### P3 — Backlog / Polish
- [x] **~~TASK-1275~~**: ✅ Remove 5 obsolete verification scripts in `scripts/` (verify-shadow-layer, verify-auth-user, verify-backup-system, verify-bug339-migration, verify-restore)
- [x] **~~TASK-1276~~**: ✅ Remove Storybook `title: 'PLACEHOLDER'` duplicate key (`OverflowTooltip.stories.ts:4`)
- [x] **~~TASK-1277~~**: ✅ Standardize z-index usage — replaced ~60 hardcoded values across 50 files with `var(--z-*)` tokens (dropdown, modal, popover, tooltip layers)
- [x] **~~TASK-1278~~**: ✅ Standardize font-size usage — replaced ~100 hardcoded px/rem values across 32 files with `var(--text-*)` tokens
- [x] **~~TASK-1279~~**: ✅ Add missing package.json metadata — homepage, repository, bugs fields
- [x] **~~TASK-1280~~**: ✅ Add copyright field to Tauri bundle config (`tauri.conf.json`)
- [x] **~~TASK-1281~~**: ✅ Adopt build-time console.log stripping — esbuild `pure` config strips console.log/debug in production
- [x] **~~TASK-1282~~**: ✅ Stop filtering console.error/warn in consoleFilter.ts — now always pass through

---

### ~~TASK-1494~~: Tauri Parity Testing Suite (✅ DONE)

**Priority**: P1 | **Status**: ✅ **DONE** — Obsolete (Tauri removed)

---

### ~~TASK-1495~~: Morning Dashboard Redesign — Opt-in Ritual + State Machine (✅ DONE)

**Priority**: Medium | **Status**: ✅ DONE (2026-03-13)

**Problem/Opportunity**: Morning dashboard was a forced full-page takeover that interrupted users during onboarding. Users need an opt-in ritual that fits into their morning workflow — suggested during the "golden window" (06:00-11:00) but always dismissible.

**Solution**: Redesigned as a lightweight, non-blocking ritual with two-step flow:
1. **Step 1**: Pick focus tasks (up to 3) from prioritized candidates (overdue, high-priority, active)
2. **Step 2**: Schedule them via auto-placement or manual time-blocking
3. **Summary chip**: Shows completion status throughout the day

**Architecture**:
- **`useMorningRitual.ts`**: State machine (idle → picking → scheduling → done/dismissed) + time window gating (06:00-11:00) + one-time-per-day enforcement via localStorage
- **UI Components**:
  - `MorningBanner.vue`: Dismissible banner with call-to-action, only shows during golden window
  - `MorningRitualPanel.vue`: Bottom sheet with step indicator + action buttons (Skip/Start)
  - `MorningCandidateCard.vue`: Compact task preview (title, priority badge, duration estimate)
  - `MorningSummaryChip.vue`: Shows "3/3 tasks scheduled" or "Ritual dismissed" after completion
- **Reuse**: CustomSelect (time picker), TaskContextMenu (priority/due date quick edits), TaskEditModal (full edit), BaseBadge (priority indicators)

**Integration**:
- `App.vue`: Mount banner + panel + summary chip globally (always available)
- `MorningDashboardView.vue`: Auto-open ritual on `/morning` route, show summary chip in header

**New Files**:
- `src/composables/useMorningRitual.ts`
- `src/components/morning-dashboard/MorningBanner.vue`
- `src/components/morning-dashboard/MorningRitualPanel.vue`
- `src/components/morning-dashboard/MorningCandidateCard.vue`
- `src/components/morning-dashboard/MorningSummaryChip.vue`

**Modified Files**:
- `src/App.vue`
- `src/views/MorningDashboardView.vue`

---

## Planned Tasks (NEXT/BACKLOG)

### ~~TASK-1484~~: Escape key closes TaskContextMenu (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-08)

**Problem**: TaskContextMenu had no Escape key handler. Pressing Escape did nothing while the context menu was open.

**Fix**: Added `handleKeyDown` listener on `document` when context menu becomes visible, calls `closeAllSubmenusNow()` + `emit('close')` on Escape. Includes `stopPropagation` to prevent other global Escape handlers from interfering. All other context menus (ContextMenu.vue, EdgeContextMenu.vue, useContextMenu.ts) already had Escape handling.

### ~~TASK-1473~~: Add calendar view to mobile PWA (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Add a mobile-optimized calendar view to the PWA bottom navigation. Replace the AI Chat tab with Calendar in the nav bar; move AI Chat into the Menu overlay instead.

**Implementation**:
- Created `MobileCalendarView.vue` — day view with time grid (6AM-11PM), task cards color-coded by priority, date navigation, current time indicator, unscheduled tasks section, RTL support
- Added mobile route `/mobile-calendar` in router with desktop redirect to `/calendar`
- Replaced AI nav tab with Calendar tab in `MobileNav.vue` (Calendar icon)
- Added AI Chat as a menu item in `MobileNav.vue` menu overlay (Sparkles icon + "AI Chat" label)

---

### ~~TASK-1474~~: Move AI Chat from mobile nav bar to menu overlay (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-07)

**Goal**: Remove AI Chat from the mobile bottom navigation bar (currently 4th tab) and add it as an item in the hamburger Menu overlay instead. This frees the nav slot for Calendar.

**Changes**:
- `MobileNav.vue`: Removed AI `router-link`, added menu item with Sparkles icon that navigates to `/mobile-ai-chat`
- AI Chat view works when accessed from menu

---

### ~~TASK-1500~~: Memory auto-refresh and verify memory health wired into Settings (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Goal**: Add `refreshIfStale()` to `useWorkProfile.ts` that only runs `computeCapacityMetrics()` when observations are >24h old (instead of always on startup). Wire into app initialization. Verify AISettingsTab already has memory health UI.

**Changes**:
- `src/composables/useWorkProfile.ts`: Added `refreshIfStale()` — checks `memoryGraph` timestamps, skips refresh if freshest observation is <24h old, generates initial observations if none exist
- `src/composables/app/useAppInitialization.ts`: Replaced unconditional `computeCapacityMetrics()` call with `refreshIfStale()` (fire-and-forget, respects `aiLearningEnabled` setting)
- `AISettingsTab.vue`: Already had full Memory Health section (TASK-1356) — grade badge, section dots, progress, "Run Quick Check" button, hint to full dashboard. No changes needed.

---

### INQUIRY-1413: Evaluate open-source readiness for community sharing (📋 PLANNED)

**Priority**: P2 | **Status**: 📋 PLANNED (2026-02-23)

**Question**: Is FlowState ready to share with the open-source community? Users should be able to connect their own Supabase instance and use all features — no paid tiers, no locked features.

**Audit Areas**:
- Hardcoded secrets, API keys, VPS IPs in committed code
- Supabase setup documentation (schema, migrations, RLS policies)
- Environment variable documentation (.env.example completeness)
- First-run experience (can a new user self-host?)
- License file
- README quality for OSS contributors
- Doppler/proprietary service dependencies
- Build reproducibility without private infra

---

### ~~INQUIRY-1249~~: WhatsApp Bot Integration for Task Creation via WAHA + Groq (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Concept**: WhatsApp bot that receives forwarded messages, parses them with Groq AI, and creates tasks in FlowState automatically.

**Implementation**: Built complete bot at `packages/whatsapp-bot/` (~375 LOC):
- `src/index.ts` — Express webhook server, WAHA event handler, chat ID allowlist security
- `src/groqParser.ts` — Llama 3.3 70B via Groq API, extracts title/priority/dueDate/duration from Hebrew/English messages
- `src/supabaseClient.ts` — Direct REST insert to FlowState tasks table, sets `is_in_inbox: true` for triage
- `src/wahaClient.ts` — WhatsApp confirmation messages via WAHA API
- `docker-compose.yml` — WAHA (NOWEB engine) + bot, ready to deploy

**Architecture**:
```
WhatsApp (dedicated number) → WAHA (Docker, Contabo VPS) → Webhook → Supabase Edge Function
                                                                          ↓
                                                                   Groq API (free)
                                                                          ↓
                                                                   Supabase REST → FlowState
```

**Estimated Cost**: $0/month (all free tiers)

**Deployment steps** (user manual):
- [x] ~~Build webhook handler (Node.js/TypeScript)~~ ✅
- [x] ~~Integrate Groq for message parsing~~ ✅
- [x] ~~Connect to FlowState Supabase via REST API~~ ✅
- [x] ~~Deploy WAHA Docker container on Contabo VPS~~ ✅ (port 3050, Doppler secrets)
- [x] ~~Set up Doppler integration for WAHA secrets~~ ✅ (restart script at `/opt/waha/restart-waha.sh`)
- [ ] Buy dedicated SIM card for WhatsApp number
- [ ] Link WhatsApp number via WAHA dashboard (scan QR)
- [ ] Test end-to-end flow

---

### TASK-1458: WhatsApp Bot — Link Number & E2E Test (⏸️ PAUSED)

**Priority**: P2 | **Status**: ⏸️ PAUSED (2026-03-06) — waiting for user to buy a SIM card

**Blocked on**: Dedicated phone number (SIM card purchase)

**What's done**:
- WAHA container deployed on VPS (port 3050, `supabase_default` network)
- Doppler secrets configured (`WAHA_API_KEY`, `WAHA_DASHBOARD_USERNAME/PASSWORD`, `GROQ_API_KEY`)
- Restart script at `/opt/waha/restart-waha.sh` pulls fresh secrets from Doppler
- Dashboard accessible at `http://84.46.253.137:3050/dashboard`

**Remaining**:
- [ ] Buy dedicated SIM card
- [ ] Start session in WAHA dashboard, scan QR with new number
- [ ] Test: send WhatsApp message → verify task appears in FlowState inbox
- [ ] Configure chat ID allowlist for the new number

---

### ~~TASK-1118~~: Test Suite Cleanup - Reduce 615 Tests to ~100 Essential (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-10)

**Result**: Reduced 985 → 878 tests (-11%), fixed 3 pre-existing failures, halved execution time (10s → 5s). Removed duplicates, tautologies, and collapsed redundant tests into `it.each`. All 878 tests pass.

---

### TASK-1386: Google Calendar Proxy Edge Function (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE | **Completed**: 2026-02-21

**Problem/Opportunity**: FlowState needs to display Google Calendar events in the calendar views without exposing OAuth tokens or making Google API calls from the client.

**Scope**: Create `supabase/functions/google-calendar-proxy/index.ts` — a Supabase Edge Function that:
- Validates the caller via Supabase JWT before proxying to Google
- Supports `list-calendars` and `list-events` actions
- Performs automatic token refresh on Google 401 and returns `newAccessToken` to client
- Follows the same CORS/auth pattern as `ai-chat-proxy`

**Implementation**:
- [x] Create `supabase/functions/google-calendar-proxy/index.ts`
- [x] CORS headers matching ai-chat-proxy (ALLOWED_ORIGINS, getCorsHeaders)
- [x] Supabase JWT validation via `createClient` + `getUser()`
- [x] `list-calendars` → GET `/users/me/calendarList`, returns `{ calendars: { id, summary, backgroundColor }[] }`
- [x] `list-events` → GET `/calendars/{calendarId}/events` with singleEvents/orderBy/timeMin/timeMax/maxResults=250
- [x] Token refresh on 401: POST to `oauth2.googleapis.com/token`, retry, return `newAccessToken`
- [x] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `Deno.env.get()`

**Files**:
- `supabase/functions/google-calendar-proxy/index.ts` (new)

---

### ~~TASK-359~~: Quick Add + Sort Feature (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

Batch capture mode: `Ctrl+.` opens Quick Capture modal, type titles + Enter, Tab to sort phase, 1-9 assigns project.

**Files**: `src/composables/useQuickCapture.ts`, `src/components/quicksort/QuickCaptureModal.vue`

---

### ~~TASK-1119~~: Remove Web Speech API - Use Whisper Only (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

**Rationale**: Web Speech API has poor quality compared to Whisper:
- Browser-dependent (different results on Chrome/Firefox/Safari)
- Poor Hebrew support
- No mixed-language (code-switching) support
- Requires manual language selection

**Scope**: Mobile only (desktop components still use browser speech as fallback)

**Changes Made**:
1. Removed Browser/AI mode toggle from MobileInboxView
2. Made Whisper (via Groq) the only voice input method for mobile
3. Simplified voice UI - single mic button, no mode selection
4. Simplified cancelVoice to Whisper-only
5. Removed all `voiceMode`, `voiceLanguage`, `toggleVoiceMode` references

**Files Modified**:
- `src/mobile/views/MobileInboxView.vue` - Whisper-only voice UI

**Note**: `useSpeechRecognition.ts` kept for desktop components (UnifiedInboxInput, QuickCaptureTab, AppSidebar)

**Related**: ~~FEATURE-1023~~, ~~BUG-1109~~, ~~TASK-1131~~

---

### ~~TASK-1131~~: Offline Voice Queue - Save & Retry When Online (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-13)

**Problem**: With Whisper-only voice input (TASK-1119), offline recording fails silently.

**Solution**: Save audio blob to IndexedDB, show badge, auto-transcribe when back online.

**Implementation Complete**:
1. Created `useOfflineVoiceQueue.ts` composable
   - Saves audio blob to IndexedDB when offline
   - Uses VueUse `useOnline()` for connectivity detection
   - Watches online status and processes queue when reconnected
   - Auto-retries failed transcriptions (max 3 attempts)
2. Modified `useWhisperSpeech.ts`:
   - Added `onOfflineRecord` callback option
   - Added `isQueued` status for UI feedback
   - Exposed `isOnline` state
3. Updated `MobileInboxView.vue`:
   - Badge on mic button shows pending count
   - Offline indicator when not connected
   - Voice feedback shows "Saved offline" status
   - Haptic feedback on queue save

**Files Created/Modified**:
- `src/composables/useOfflineVoiceQueue.ts` (CREATE) - IndexedDB queue management
- `src/composables/useWhisperSpeech.ts` (MODIFY) - Offline callback support
- `src/mobile/views/MobileInboxView.vue` (MODIFY) - UI integration

**Depends On**: ~~TASK-1119~~ (Whisper-only simplification) ✅

**Effort**: ~2-3 hours

---

### ~~TASK-353~~: Design Better Canvas Empty State (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-03-13)

Current empty state is minimal. Add visual illustration, feature highlights, guest mode sign-in prompt.

**File**: `src/components/canvas/CanvasEmptyState.vue`

**Resolution**: Redesigned with animated SVG illustration (floating task cards with connecting lines), 4 feature pills, engaging copy ("Your spatial canvas awaits"), glass-morphism action buttons with keyboard hints (N/G), ambient grid dots, sparkle effects, and full prefers-reduced-motion support. Storybook stories updated with 3 variants.

---

### Stress Test Suite (📋 PLANNED)

| Task | Description |
|------|-------------|
| TASK-362 | Sync conflict resolution (2 tabs editing, offline+online, race conditions) |
| TASK-363 | Auth edge cases (expired JWT, session timeout, concurrent sessions) |
| TASK-364 | WebSocket stability (disconnect, reconnect, subscribe cycles) |
| TASK-366 | Redundancy assessment (SPOF mapping, fallback testing) |

---

### ~~BUG-1199~~: Canvas Inbox Right-Click Acts as Ctrl+Click (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Right-clicking on a task in the canvas inbox behaves as if Ctrl+Click was pressed (multi-select behavior) instead of opening a context menu or doing nothing.

**Root Cause**: The native `@click` event fires for ALL mouse buttons (left=0, right=2). When right-clicking, `@click` fires first (running selection logic), then `@contextmenu` fires. Canvas nodes don't have this issue because Vue Flow's `@node-click` filters by button internally.

**Fix Applied**: Added `event.button !== 0` early return in `handleTaskClick()` so only left-clicks trigger selection logic. Right-clicks now only fire the `@contextmenu` handler.

**Files Changed**:
- `src/composables/inbox/useUnifiedInboxActions.ts` - Added button check (1 line)

---

### ~~FEATURE-1200~~: Quick Add Full RTL Support + Auto-Expand for Long Tasks (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-02-27)

**Feature**: Two improvements to the Quick Add input in the main sidebar:

1. **Full RTL support**: The quick add input should properly support RTL text (Hebrew). Text direction should auto-detect or follow app locale.
2. **Auto-expand to fullscreen**: When typing a long task title that exceeds the input width, automatically open a fullscreen task creator popup/modal so the user has more space to write.

**Requirements**:
- [x] Add `dir="auto"` or RTL detection to quick add input — ✅ Done by TASK-1324 (`quickTaskDirection` computed in AppSidebar.vue)
- [x] RTL-aware placeholder text and icons — ✅ Done by TASK-1324 (Hebrew translations in `he.json`)
- [x] Character/width threshold to trigger fullscreen expansion — ✅ Auto-opens at 20+ words or 150+ chars
- [x] Smooth transition from inline input to fullscreen modal — ✅ Expand button + auto-trigger via `QuickTaskCreateModal`
- [x] Carry over typed text to the fullscreen creator — ✅ `initialTitle` prop on `QuickTaskCreateModal`
- [x] Fullscreen creator should also be fully RTL-aware — ✅ Uses `useHebrewAlignment` composable

**Implementation**:
- `AppSidebar.vue`: Expand button (Maximize2 icon) on textarea + auto-trigger at high threshold + `QuickTaskCreateModal` integration
- `QuickTaskCreateModal.vue`: Added `initialTitle` prop for text carry-over
- RTL: `quickTaskDirection` computed (regex on first char), Hebrew i18n placeholders, `useHebrewAlignment` in modal

---

### ~~FEATURE-1201~~: Intro/Onboarding Page for Guest and Signed-In Users (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-13)

**Feature**: Single-screen welcome modal replacing the old WelcomeModal. Same flow for guest and signed-in users.

**Design Pivot**: Initially built as 4-step wizard, then pivoted to single screen based on UX research showing multi-step wizards have ~10-19% completion rates with 72% user abandonment. Linear (most admired productivity UX) uses zero wizards. Single screen gets users to first task faster.

**Design Decisions (Resolved)**:
- [x] What to show: Logo, 3 feature highlights, "Get Started" CTA, optional sign-up link for guests
- [x] Format: Single welcome screen (research-backed — "quick win" retains 80% more users)
- [x] Reappear: No — dismissed permanently via localStorage (`flowstate-onboarding-v2`)

**Implementation**:
- [x] `useOnboardingWizard.ts` composable — visibility, dismiss, keyboard, localStorage persistence
- [x] `OnboardingWizard.vue` — single-screen modal with Teleport, glass morphism, auth-aware sign-up CTA
- [x] Moved from MainLayout to App.vue — now shows on both desktop and mobile
- [x] Removed old WelcomeModal from MainLayout (component kept for reference)
- [x] Keyboard: Enter or Escape to dismiss
- [x] Storybook stories (Guest + Signed In variants)
- [x] Build passes, zero new TS errors

**Files Created**: `src/composables/app/useOnboardingWizard.ts`, `src/components/onboarding/OnboardingWizard.vue`, `src/stories/modals/OnboardingWizard.stories.ts`
**Files Modified**: `src/App.vue`, `src/layouts/MainLayout.vue`

---

### ~~TASK-1283~~: Google Calendar Plugin — Calendar View Integration (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-02-22) | **Blocked By**: ~~FEATURE-1202~~

**Feature**: Add a plugin/settings option to connect Google Calendar. Once connected, display Google Calendar events alongside FlowState tasks in the Calendar view.

**Requirements**:
- [ ] Google OAuth must include `calendar.readonly` scope (extends FEATURE-1202)
- [ ] Settings UI: "Connect Google Calendar" toggle in Settings > Integrations
- [ ] Fetch events from Google Calendar API (read-only)
- [ ] Display events in Calendar view with distinct styling (differentiate from tasks)
- [ ] Handle token refresh for long-lived sessions
- [ ] Graceful degradation when offline or token expired

**Key Decisions Needed**:
- Read-only vs read-write (create FlowState tasks from calendar events?)
- Which calendars to sync (primary only vs user-selectable)
- Event display style (overlay, side-by-side, merged timeline)

---

### ~~TASK-1452~~: KDE Widget — Switch Active Timer to Different Task (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-05)

**Task**: When a Pomodoro timer is running on task A and user clicks play on task B, reassign the running timer session to task B instead of creating a new session.

**Implementation**:
1. Added `switchTaskForSession()` method to KDE widget backend
2. Implemented 3-state play icon:
   - Stopped state: play icon
   - Running on OTHER task: skip-forward icon (indicates timer switch)
   - Running on THIS task: chronometer icon (indicates timer active)
3. Smart click handler:
   - Checks if timer running and on different task
   - If yes: calls `switchTaskForSession()` to reassign
   - If no: starts new timer session normally

---

### ~~BUG-1453~~: Production CSS Preload + Mobile Quick Sort Swipe Broken (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Two issues reported:**
1. Production CSS preload failure (`MorningDashboardView-7ECQeecR.css`)
2. Mobile PWA Quick Sort card swipe/drag not working (user says "used to work")

#### Sub-issue 1: CSS Preload Failure — RESOLVED

**Root cause**: `SITE_URL` and `API_URL` GitHub Actions repository variables were deleted (between Mar 3-4). This broke the Cloudflare cache purge step in `.github/workflows/deploy.yml`, causing 18 consecutive deploy failures. VPS got new assets via rsync but Cloudflare CDN served stale `index.html` referencing old CSS/JS hashes that no longer existed on VPS.

**Fixes applied (3 commits pushed):**
- Restored `SITE_URL` (`https://in-theflow.com`) and `API_URL` (`https://api.in-theflow.com`) via `gh variable set`
- Made CF purge step resilient: guards against empty SITE_URL with graceful skip instead of `exit 1`
- Fixed 6 pre-existing CI type/lint errors in ChatMessage.vue, BaseModal.vue, AIQualityDashboard.vue, QuickSortCard.vue
- Deploy pipeline now fully green (all steps pass including chunk integrity verification)

#### Sub-issue 2: Mobile Quick Sort Swipe — RESOLVED

**Three layers of root cause fixed:**

1. **Touch event regression** (commit `072eea6c`): `preventDefault()` in `touchstart` before direction known — Android Chrome drops entire touch sequence. Fixed: `touchstart` always `{ passive: true }`, `preventDefault()` deferred to `touchmove` after 10px lock threshold.

2. **CSS `!important` overrides killing transform**: `global-overrides.css` had `.task-card:hover { transform: none !important }` and `.task-card:active { transform: scale(0.99) !important }` — both override the inline `translateX` during drag. Fixed: added `:not(.swiping)` to both selectors.

3. **Overflow clipping on mobile**: Ancestor containers (`.mobile-content`, `.sort-phase`, `.qs-main`) had `overflow: hidden/auto` which clips the card's `translateX` displacement. CSS doesn't allow `overflow-x: visible` with `overflow-y: auto` (browsers force both to `auto`). **Fix: Card switches to `position: fixed` during swipe**, capturing `getBoundingClientRect()` on swipe start and pinning to viewport coordinates. This escapes ALL ancestor overflow clipping. Also removed `perspective: 1000px` from `.card-stack` (CSS spec: perspective creates containing block for fixed descendants).

**Additional improvements:**
- Mobile-friendly edit bottom sheet with toggle pills, project picker with emoji icons
- Overlay dead zone (50px before showing, max 0.7 opacity)
- Velocity-based swipe minimum distance (40% threshold) to prevent accidental triggers
- SOP: `docs/sop/SOP-063-mobile-swipe-gestures.md`
- `.github/workflows/deploy.yml` — deploy pipeline (fixed)

**Relevant commits:**
- `072eea6c` — batch update (useSwipeGestures refactor + user's QuickSortCard rewrite)
- `3a149cb6` — last known working version of useSwipeGestures
- `af3a63b7` — mobile QuickSort visual fixes
- `939ce6a5` — split MobileQuickSortView into sub-components

**Files**: `packages/kde-widget/contents/ui/main.qml`

**Architecture**:
- Reuses existing session management (`timer_sessions` table)
- Updates `task_id` on running session instead of creating duplicate
- Preserves elapsed time, start time, pomodoro count
- No breaking changes to sync protocol

**Progress (2026-03-05):** Feature implemented and verified. Play icon now shows 3 states correctly. Timer successfully switches to different task when user clicks play. Tested with both timer running and idle states.

---

### Other Planned Tasks

| Task | Priority | Description |
|------|----------|-------------|
| ~~**TASK-1289**~~ | **P0** | ✅ **Investigate severe task position drift episode** |
| ~~**TASK-1285**~~ | **P0** | ✅ **Commit deploy safeguards & clean up 20 dead Claude hooks** (2026-02-10) |
| ~~**FEATURE-1293**~~ | **P2** | ✅ **Catalog View UX/UI Redesign — bulk ops, scanning, inline editing, review/triage** |
| ~~BUG-1199~~ | P1 | ✅ Canvas inbox right-click acts as Ctrl+Click |
| ~~BUG-1206~~ | P0 | ✅ Task details not saved when pressing Save in canvas (3-layer fix: pending write guard + extended isVeryRecent + modal-aware recovery) |
| ~~BUG-1208~~ | P1 | ✅ Task edit modal closes on text selection release |
| ~~BUG-1212~~ | P0 | ✅ Sync queue CREATE retry causes "duplicate key" corruption |
| ~~BUG-1286~~ | P2 | ✅ PWA Today View shows 2:00 AM on all tasks due to UTC timezone parsing |
| ~~**BUG-1291**~~ | **P0** | ✅ **Timer not starting from calendar play btn / context menu Start btn / canvas; Calendar has no right-click context menu** |
| ~~**BUG-1292**~~ | **P1** | ✅ **KDE Widget intermittently fails to start break timer (30s polling gap after session complete)** |
| ~~**TASK-1292**~~ | **P0** | ✅ **Quick task creation in KDE widget — quick-add input (+ / play buttons) + pinned task chips (monorepo)** |
| ~~**BUG-1293**~~ | **P1** | ✅ **Canvas CSS tokenization damage — broken shadows, phantom tokens, debug elements** |
| ~~**BUG-1294**~~ | **P1** | ✅ **Calendar play button shouldn't reset timer or create new instances when timer is already running for that task** |
| ~~**BUG-1296**~~ | **P1** | ✅ **Time block notifications never fire — _rawTasks → rawTasks property name mismatch** |
| ~~**BUG-1302**~~ | **P1** | **✅ Time block notifications still not firing — milestones silently missed despite BUG-1296 fix** |
| ~~**BUG-1303**~~ | **P2** | ✅ **Mark Done doesn't stop active timer running on that task** (✅ DONE — fix in taskOperations.ts:431) |
| ~~**BUG-1304**~~ | **P2** | ✅ **Done tasks in calendar view have no visual done indicator** (✅ DONE — visual indicator in all 3 calendar views) |
| ~~**BUG-1305**~~ | **P2** | ✅ **TaskQuickEditPopover renders behind AI Chat panel — z-index stacking issue** |
| ~~**TASK-1337**~~ | **P3** | ✅ **Storybook Design Streamlining — align all stories with design system** |
| ~~**TASK-1338**~~ | **P0** | ✅ **Configurable PWA Push Notifications — per-category controls, quiet hours, server-side push service** |
| ~~**BUG-1311**~~ | **P3** | ✅ **Storybook: 3 story files fail to import (ReloadPrompt, CalendarDayView, CalendarWeekView)** |
| ~~**TASK-1311**~~ | **P2** | ✅ **Add date picker to Quick Sort** |
| ~~**TASK-1312**~~ | **P2** | ✅ **Quick Sort context panel — date/day, priority, project info (desktop + PWA responsive)** |
| ~~**TASK-1313**~~ | **P3** | ✅ **UI polish: FocusView pause & leave, kanban tooltips, date picker popover, RTL dir** |
| ~~**FEATURE-1314**~~ | **P2** | ✅ **AI Weekly Quick Sort — sort week's tasks with AI + push to canvas date groups** |
| **TASK-1326** | **P2** | **👀 Weekly Plan AI Enhancements (Batching, Theme, Feedback Loop)** |
| ~~**TASK-1385**~~ | **P2** | ✅ **Weekly Plan AI — deterministic rebalancer + smarter model routing + prompt quality** |
| ~~**TASK-1399**~~ | **P2** | ✅ **Weekly Plan — model/provider selector connected to centralized AI model registry** |
| ~~**TASK-1400**~~ | **P2** | ✅ **SOP-045 Tauri AppImage Update Workflow + fix stale binary — created SOP, fixed user's stale v1.2.18 AppImage, removed debug logging from canvas drag** |
| ~~**FEATURE-1317**~~ | **P3** | ✅ **AI Work Profile / Persistent Memory — learn user work patterns for smarter weekly plans** |
| ~~**TASK-1316**~~ | **P2** | ✅ **AI Provider Usage & Cost Tracking — new Settings tab with per-provider token/cost totals** |
| ~~**TASK-1341**~~ | **P2** | ✅ **Quick Sort UX Polish — left sidebar action buttons, arrow key shortcuts, action feedback overlays, swipe fix** (✅ DONE 2026-02-16) |
| **FEATURE-1342** | **P2** | **🔄 AI Task Suggestions — per-task/group button to auto-suggest priority, due date, status based on user data** |
| ~~**BUG-1343**~~ | **P2** | ✅ **Quick Sort exits when swiping right on PWA mobile** (✅ DONE 2026-02-17) |
| ~~**BUG-1350**~~ | **P0** | ✅ **New Task transcription page closes prematurely — transcription doesn't appear on PWA mobile** (✅ DONE 2026-02-18) |
| ~~**BUG-1352**~~ | **P1** | ✅ **Calendar inbox filtered by board smart view — only shows 4 tasks instead of all unscheduled** (✅ DONE 2026-02-17) |
| ~~**BUG-1353**~~ | **P0** | ✅ **Sidebar quick task: metadata buttons disappear on click + no save confirmation** (✅ DONE 2026-02-17) |
| ~~**BUG-1355**~~ | **P1** | ✅ **Can't log out — Supabase signOut fails silently, session re-establishes. Buttons squashed. Post-logout UI stuck** (✅ DONE 2026-02-17) |
| ~~**BUG-1357**~~ | **P0** | ✅ **Mobile PWA timer sync broken with web app** (✅ DONE 2026-02-18) |
| ~~**TASK-1354**~~ | **P2** | ✅ **AI quality assessment + timer fixes + CSS cleanup** (✅ DONE 2026-02-18) |
| ~~**BUG-1351**~~ | **P0** | ✅ **Calendar drag ghost stuck after inbox→day drop** (✅ DONE 2026-02-17) |
| ~~**BUG-1349**~~ | **P2** | ✅ **QuickSort progress bar jumps when pressing number keys to assign project** (✅ DONE 2026-02-17) |
| ~~**BUG-1359**~~ | **P0** | ✅ **vue-i18n version mismatch causing $t() SyntaxErrors — upgraded vue-i18n 9→11, re-applied i18n translations across 11 files (EN+HE)** (✅ DONE 2026-02-19) |
| ~~**BUG-1348**~~ | **P0** | ✅ **Priority badge color mismatch — medium badge gray instead of orange** (✅ DONE 2026-02-17) |
| ~~**TASK-1356**~~ | **P2** | ✅ **AI Memory Assessment System — test/evaluate memory effectiveness for user context + AI usage across app, CLI + admin settings UI** (✅ DONE 2026-02-18) |
| **TASK-1358** | **P2** | **🔄 Rewrite 28 canvas todo tests — replace over-designed Vue Flow mocking with direct store/handler unit tests using real data shapes** |
| ~~**BUG-1347**~~ | **P0** | ✅ **KDE Plasma widget freeze — gated 40+ console.log behind debug flag, staggered concurrent XHR with Qt.callLater(), reactive transition timer, throttled canvas repaints** (✅ DONE 2026-02-19) |
| ~~**BUG-1365**~~ | **P0** | ✅ **Calendar day view — task disappears after editing and saving (false positive scheduleExplicitlyRemoved for instance-based tasks)** (✅ DONE 2026-02-19) |
| ~~**BUG-1360**~~ | **P0** | ✅ **Canvas long task cards cut off when zooming — removed LOD content hiding, overflow:hidden chain, title 3-line clamp** (✅ DONE 2026-02-20) |
| ~~**BUG-1567**~~ | **P2** | ✅ **Deleted projects still appear in QuickSort CategorySelector — project store `projects` computed doesn't filter soft-deleted projects (is_deleted=true)** (✅ DONE 2026-03-18) |
| ~~**TASK-1571**~~ | **P2** | ✅ **Edit Task modal RTL support — added dir="auto" to 7 inputs across TaskEditHeader, QuickTaskCreate, QuickTaskCreateModal, TaskEditSubtasks, TaskTable** (✅ DONE 2026-03-18) |
| ~~**TASK-1692**~~ | **P2** | ✅ **Desktop task list RTL + chat Hebrew paragraphs — reversed TaskRow/TaskTable grid in [dir="rtl"], fixed priority indicator logical props, added unicode-bidi:plaintext to markdown block elements** (✅ DONE 2026-03-23) |
| **TASK-1693** | **P2** | 🔄 **Calendar virtual timer block — inject virtual CalendarEvent for the currently-timed task when it has no real instance for today, so it always appears on the day view** |
| ~~**BUG-1361**~~ | **P1** | ✅ **Calendar inbox drag ghost pills stuck on screen — endGlobalDrag() never called when source element removed by reactive filtering** (✅ DONE 2026-02-19) |
| **FEATURE-1363** | **P2** | **📋 Add reminders & notifications to all platforms (PWA, Electron, KDE widget)** |
| ~~**BUG-1346**~~ | **P1** | ✅ **Mobile Inbox tab broken in PWA on mobile — layout/design broken** (✅ DONE 2026-03-04) |
| ~~**TASK-1362**~~ | **P0** | ✅ **Calendar task selection, multi-select & keyboard actions — click to select, Ctrl+click multi-select, Delete→inbox, Shift+Delete→remove, drag-back to inbox** (✅ DONE 2026-02-20) |
| ~~**BUG-1366**~~ | **P1** | ✅ **i18n locale desync — UI stays Hebrew when English selected, store locale hardcoded to 'en' ignoring localStorage** (✅ DONE 2026-02-20) |
| ~~**BUG-1367**~~ | **P2** | ✅ **Canvas inbox panel on wrong side — parent CSS overrode is-right-side to left, flipped to right** (✅ DONE 2026-02-20) |
| ~~**BUG-1368**~~ | **P2** | ✅ **? keyboard shortcut broken on Hebrew layout — event.key check fails on non-Latin layouts, added event.code fallback** (✅ DONE 2026-02-20) |
| ~~**BUG-1374**~~ | **P1** | ✅ **AI Chat 4-bug combo — Hebrew response on English input, LTR for Hebrew text, fluffy advice, wrong tasks returned (all fixed 2026-02-21)** |
| ~~**TASK-1375**~~ | **P1** | ✅ **AI Pipeline orchestrator + types — create pipeline/ with guardrail interfaces and function composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1376**~~ | **P1** | ✅ **Language detector — deterministic Unicode-range detection, detectLanguageMismatch()** (✅ DONE 2026-02-21) |
| ~~**TASK-1377**~~ | **P1** | ✅ **Context optimizer — separate task titles from metadata, character budget, date-relative filtering** (✅ DONE 2026-02-21) |
| ~~**TASK-1378**~~ | **P1** | ✅ **Response validator — consolidate 3 cleanup locations into one, add UUID stripping, reuse qualityAssessment rules** (✅ DONE 2026-02-21) |
| ~~**TASK-1379**~~ | **P1** | ✅ **Language enforcer — post-processing guardrail, detect mismatch + flag in metadata** (✅ DONE 2026-02-21) |
| ~~**TASK-1380**~~ | **P1** | ✅ **Response length enforcer — cap by intent (greetings, tool summaries, analytical)** (✅ DONE 2026-02-21) |
| ~~**TASK-1381**~~ | **P1** | ✅ **Wire pre-processing into useAIChat — call runPreProcess before ReAct, use contextOptimizer** (✅ DONE 2026-02-21) |
| ~~**TASK-1382**~~ | **P1** | ✅ **Wire post-processing into useAIChat — runPostProcess after ReAct, replace inline cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1383**~~ | **P1** | ✅ **Simplify ChatMessage.vue renderedContent — remove redundant regex, pipeline handles cleanup** (✅ DONE 2026-02-21) |
| ~~**TASK-1384**~~ | **P1** | ✅ **Unit tests for pipeline — guardrails, language detection, context optimization, composition** (✅ DONE 2026-02-21) |
| ~~**TASK-1388**~~ | **P1** | **✅ Pre-digested reasoning engine — compute task analysis in code, LLM formats facts naturally** (✅ DONE) |
| ~~**TASK-1389**~~ | **P1** | **✅ Skeleton prompting for agent chains — code generates sections, LLM writes bridges** (✅ DONE) |
| ~~**TASK-1390**~~ | **P1** | **✅ Fluff detector guardrail — heuristic scoring: task name references, data points, no generic phrases** (✅ DONE) |
| ~~**TASK-1391**~~ | **P1** | **✅ Validation + retry loop — retry once with feedback when fluff score < 0.5** (✅ DONE) |
| ~~**TASK-1392**~~ | **P1** | **✅ Keyword-based tool hints — deterministic keyword→tool mapping injected into system prompt** (✅ DONE) |
| ~~**TASK-1393**~~ | **P1** | **✅ `projectId` filter on `list_tasks` — quick win, 15 minutes** (✅ DONE) |
| ~~**TASK-1394**~~ | **P1** | **✅ Counting vs listing clarification — system prompt rule to prevent unnecessary tool calls** (✅ DONE) |
| ~~**TASK-1395**~~ | **P1** | **✅ Install uFuzzy + `resolveTask()` helper — fuzzy title matching for entity resolution** (✅ DONE) |
| ~~**TASK-1396**~~ | **P1** | **✅ Wire `resolveTask()` into write tools — title-based resolution fallback in `validateTaskExists()`** (✅ DONE) |
| ~~**TASK-1397**~~ | **P1** | **✅ `mark_task_done` convenience tool — accepts title string, most common user action** (✅ DONE) |
| ~~**TASK-1398**~~ | **P1** | **✅ Conversation entity memory — track mentioned tasks, resolve pronouns ("it", "that one")** (✅ DONE) |
| **TASK-1386** | **P2** | **✅ Google Calendar proxy Edge Function — list-calendars, list-events, token refresh on 401** |
| ~~**BUG-1417**~~ | **P1** | ✅ **Canvas nodes nearly invisible — undefined `--shadow-color-sm` token + near-identical bg = no depth** (✅ DONE 2026-02-27) |
| ~~**TASK-1420**~~ | **P1** | ✅ **Add project selector to task edit modal — TaskEditMetadata missing project field** (✅ DONE 2026-02-27) |
| ~~**TASK-1419**~~ | **P1** | ✅ **Inbox multi-select bulk property updates — context menu actions apply to all selected tasks** (✅ DONE 2026-02-27) |
| ~~**TASK-1418**~~ | **P1** | ✅ **Too many buttons on calendar dashboard — consolidate into dropdown or settings** (✅ DONE 2026-02-27) |
| ~~**TASK-1435**~~ | **P2** | ✅ **Active task glass pill — KDE companion widget + AppHeader pill showing current Pomodoro task** (✅ DONE 2026-03-03) |
| ~~**TASK-1424**~~ | **P2** | ✅ **KDE widget nanny notifications — schedule-gated idle reminders when no Pomodoro active** (✅ DONE 2026-03-03) |
| ~~**TASK-1423**~~ | **P2** | ✅ **KDE widget: add button to open Tauri or web app** (✅ DONE 2026-03-03) |
| ~~**TASK-1431**~~ | **P2** | ✅ **KDE widget "Today" toggle button — standalone chip in pinned row, composable with any dropdown filter** (✅ DONE 2026-03-02) |
| ~~**TASK-1429**~~ | **P0** | ✅ **KDE Widget Task Editing — inline edit panel (status/priority/due date) + "Open in App" deep link + perm delete + duration presets** (✅ DONE 2026-03-03) |
| ~~**TASK-1428**~~ | **P0** | ✅ **Auto-inherit group properties when creating task in a group (e.g. "Today" → today's due date)** (✅ DONE 2026-03-03) |
| ~~**TASK-1440**~~ | **P1** | ✅ **Gamification offline resilience — local-first state updates + try/catch wrapping for all Supabase writes** (✅ DONE 2026-03-03) |
| ~~**TASK-1441**~~ | **P2** | ✅ **Graceful offline UX for non-cacheable features — AI chat, file uploads, Drive show informative messages instead of failing silently** (✅ DONE 2026-03-03) |
| ~~**BUG-1442**~~ | **P1** | ✅ **timer_sessions.position_version column does not exist — DB schema mismatch** (✅ DONE 2026-03-04 — code already guards correctly, no path queries this column) |
| ~~**TASK-1443**~~ | **P2** | ✅ **Calendar Delete key shows confirmation dialog before unscheduling event (instead of silent action)** (✅ DONE 2026-03-04) |
| ~~**TASK-1448**~~ | **P2** | ✅ **KDE Widget quick-add due date dropdown — default "Today" so tasks appear in today views** (✅ DONE 2026-03-05) |
| ~~**TASK-1450**~~ | **P2** | ✅ **Integrate Quick Sort sessions into offline sync queue for full PWA offline support** (✅ DONE 2026-03-05) |
| ~~**TASK-1451**~~ | **P2** | ✅ **Auto-inherit filter context when creating tasks — useFilterDefaults composable** (✅ DONE 2026-03-05) |
| ~~**TASK-1452**~~ | **P2** | ✅ **KDE Widget — Switch Active Timer to Different Task** (✅ DONE 2026-03-05) |
| ~~**TASK-1460**~~ | **P2** | ✅ **KDE Widget — Bump task limit to 100 + group by project** (✅ DONE 2026-03-06) |
| ~~**BUG-1461**~~ | **P1** | ✅ **KDE widget hard-DELETE caused ghost tasks in web app — changed to soft-delete + smart merge fix** (✅ DONE 2026-03-06) |
| ~~**BUG-1806**~~ | **P1** | ✅ **Mark-done can still trigger phantom nudge state** (✅ DONE 2026-05-28, shipped v1.4.78) |
| ~~**BUG-1805**~~ | **P1** | ✅ **KDE nanny nudge resurfaced after marking a task done** (✅ DONE 2026-05-27) |
| ~~**TASK-1484**~~ | **P3** | ✅ **Escape key closes TaskContextMenu** (✅ DONE 2026-03-08) |
| ~~**TASK-1496**~~ | **P2** | ✅ **Non-obstructive overflow tooltips on all truncated text app-wide** (✅ DONE 2026-03-09) |
| **BUG-1498** | **P2** | 🔄 **Taskbar nanny not triggering after 5min idle without active task (INQUIRY-1489 regression)** |
| **BUG-1497** | **P2** | 📋 **CSS safety test failing due to missing fileURLToPath import** |
| ~~**BUG-1732**~~ | **P2** | ✅ **Canvas group badge counts task not rendered — parentId without canvasPosition** (✅ DONE 2026-03-26) |
| ~~**TASK-1487**~~ | **P2** | ✅ **Search modal: delete fix + filter pills (Today, Hide Done, High Priority, No Date)** (✅ DONE 2026-03-08) |
| ~~**BUG-1490**~~ | **P2** | ✅ **KDE widget stops syncing — token refresh chain break, missing 401 handling, isRefreshingToken deadlock** (✅ DONE 2026-03-09) |
| ~~**BUG-1530**~~ | **P2** | ✅ **Dragging task to Today canvas group doesn't update Calendar inbox** (✅ DONE 2026-03-14) |
| **BUG-1491** | **P0** | 🔄 **Canvas duplicate tasks appear sporadically across views** (🔄 IN PROGRESS 2026-03-09) |
| ~~**INQUIRY-1489**~~ | **P2** | ✅ **Nanny activation for unchosen tasks idle >5min in taskbar** (✅ DONE 2026-03-09) |
| ~~**TASK-1501**~~ | **P3** | ✅ **AI tools audit: fix byStatus stale keys, add undo to update_task and create_group** (✅ DONE 2026-03-10) |
| ~~**BUG-1504**~~ | **P2** | ✅ **Canvas inbox: left-click multi-selects tasks unexpectedly, can't deselect** (✅ DONE 2026-03-12) |
| ~~**BUG-1521**~~ | **P2** | ✅ **KDE Widget: pinned task chip click does nothing — searches only filtered tasks, misses match** (✅ DONE 2026-03-14) |
| ~~**BUG-1506**~~ | **P0** | ✅ **Edit Task: description loses bullet points on save — htmlToMarkdown regex truncation** (✅ DONE 2026-03-14) |
| ~~**BUG-1505**~~ | **P2** | ✅ **KDE Widget: Nanny popup only shows ~2 tasks — increase limit and sort by due date** (✅ DONE 2026-03-13) |
| **TASK-1499** | **P2** | 📋 **KDE widget: fix canvas sort/filter — wrong column + missing Y-position sorting** (📋 PLANNED) |
| ~~**TASK-1500**~~ | **P2** | ✅ **Smart model routing: complexity classifier + hybrid pricing (free for simple, premium for complex)** (✅ DONE 2026-03-13) |
| ~~**TASK-1486**~~ | **P2** | ✅ **Pinned/persistent tasks — always-visible utility tasks (e.g. "General Dev", "Organize Tasks") separate from regular task list** (✅ DONE 2026-03-13) |
| ~~**TASK-1485**~~ | **P2** | ✅ **Move AI Assist to More submenu + teal Mark Done line** (✅ DONE 2026-03-09) |
| ~~**TASK-1457**~~ | **P2** | ✅ **Demo test user + Playwright fixtures — seeded user with tasks, groups, and data for E2E testing** (✅ DONE 2026-03-13) |
| ~~**TASK-1456**~~ | **P0** | ✅ **Add permanent delete button to right-click context menu** (✅ DONE 2026-03-06) |
| ~~**TASK-1455**~~ | **P2** | ✅ **Catalog view: show uncategorized tasks so they can be categorized in-place** (✅ DONE 2026-03-09) |
| ~~**TASK-1454**~~ | **P2** | ✅ **Quick Sort: match PWA look/behavior on desktop + confirm permanent delete** (✅ DONE 2026-03-09) |
| ~~**BUG-1472**~~ | **P1** | ✅ **Canvas and Calendar inbox filters synced — persistence keys not context-scoped** (✅ DONE 2026-03-07) |
| ~~**BUG-1453**~~ | **P0** | ✅ **Production CSS preload + mobile Quick Sort swipe broken** (✅ DONE 2026-03-07) |
| ~~**BUG-1477**~~ | **P1** | ✅ **Zombie tasks reappear after permanent delete — tombstone/delete ordering + DB trigger conflict** (✅ DONE 2026-03-07) |
| ~~**BUG-1479**~~ | **P2** | ✅ **Date picker calendar closes when moving cursor to it — NPopover mouseleave** (✅ DONE 2026-03-07) |
| ~~**BUG-1447**~~ | **P2** | ✅ **Pin task disappears on Enter + task search + widget sync** (✅ DONE 2026-03-05) |
| **TASK-1446** | **P2** | ✅ **BUG-1137: Add Guest Session ID for migration tracking — explicit UUID links guest data to new account on sign-up** (✅ DONE 2026-03-04) |
| ~~**TASK-1445**~~ | **P2** | ✅ **Fix focus mode dropdown closing on hover + overlapping menus — UX research & redesign** (✅ DONE 2026-03-05) |
| ~~**TASK-1459**~~ | **P2** | ✅ **Storybook story quality pass — fix broken/unclear stories for Teleport components and PWA Screens** (✅ DONE 2026-03-07) |
| ~~**TASK-1444**~~ | **P1** | ✅ **Tauri desktop app design parity — investigate and fix visual discrepancies vs web/Storybook** (✅ DONE — Obsolete) **Archived**: Superseded by TASK-1715 (Electron migration) |
| **INQUIRY-1438** | **P0** | 📋 **Assess open-source self-hosting readiness — what's needed for GitHub sharing (Win/Mac/Linux)** (📋 PLANNED) |
| ~~**BUG-1451**~~ | **P1** | ✅ **Task done/deleted state inconsistent across views — Board hideDoneTasks coupled to Canvas/Calendar** (✅ DONE 2026-03-05) |
| ~~**BUG-1449**~~ | **P1** | ✅ **KDE widget notification barrage + popup dismiss + nanny task selection** (✅ DONE 2026-03-05) |
| ~~**TASK-1434**~~ | **P0** | ✅ **Calendar drag-to-create — click and drag on time slots to create a new task** (✅ DONE 2026-03-03) |
| ~~**TASK-1433**~~ | **P0** | ✅ **Right-click task context menu UX overhaul — reduce bloat, fix hierarchy, progressive disclosure** (✅ DONE 2026-03-03) |
| ~~**BUG-1432**~~ | **P1** | ✅ **Overdue tasks display today's date instead of actual due date** (✅ DONE 2026-03-05) |
| ~~**TASK-1427**~~ | **P0** | ✅ **Offline: merge write queue into read cache on offline load** (✅ DONE 2026-03-04) |
| ~~**TASK-1426**~~ | **P0** | ✅ **Offline: auth grace period — keep expired session for local ops** (✅ DONE 2026-03-04) |
| ~~**TASK-1425**~~ | **P0** | ✅ **Offline: fast startup — skip Supabase when navigator.onLine=false** (✅ DONE 2026-03-04) |
| **TASK-1422** | **P0** | 🔄 **Full offline mobile support — PWA works E2E without network** (🔄 IN PROGRESS 2026-03-02) |
| ~~**TASK-1421**~~ | **P0** | ✅ **Investigate & fix sluggish localhost performance** (✅ DONE 2026-03-02) |
| ~~**BUG-1416**~~ | **P0** | ✅ **Calendar inbox "today" filter shows wrong tasks — dueDate format mismatch (ISO vs YYYY-MM-DD)** (✅ DONE 2026-03-13) |
| ~~**BUG-1415**~~ | **P0** | ✅ **Catalog drag doesn't move task to target group — drops on task rows make subtasks instead of transferring between groups** (✅ DONE 2026-02-25) |
| ~~**TASK-1405**~~ | **P1** | ✅ **Replace LLM Distribution with Deterministic Algorithm in Weekly Plan** (✅ DONE 2026-03-13) |
| ~~**TASK-1403**~~ | **P2** | ✅ **Recurring Tasks — Clone-on-Complete with recurrence_rule column** (✅ DONE 2026-02-22) |
| ~~**TASK-1402**~~ | **P1** | ✅ **Decouple canvas/calendar inbox filtering — isInInbox now user-controlled, placement uses position-based filtering** (✅ DONE 2026-02-22) |
| ~~**TASK-1387**~~ | **P1** | **✅ Centralize all AI model references to single source of truth** (✅ DONE 2026-02-21) |
| ~~**TASK-1372**~~ | **P1** | **✅ Calendar delete should warn tasks will return to inbox — left-click + Delete on calendar needs confirmation dialog** (✅ DONE 2026-03-13) |
| ~~**BUG-1371**~~ | **P0** | ✅ **Connected canvas node persists after deletion — deleting a node with edges leaves it visible on canvas** (✅ DONE 2026-02-20) |
| ~~**BUG-1370**~~ | **P0** | ✅ **Canvas inbox drag broken — can't drag tasks from canvas inbox to canvas (Tauri + possibly local dev)** (✅ DONE 2026-02-20) |
| ~~**BUG-1369**~~ | **P0** | ✅ **Canvas tasks persist after marked done — completed tasks remain visible on canvas instead of being removed** (✅ DONE 2026-02-21) |
| ~~**TASK-1345**~~ | **P2** | ✅ **Perfect Hebrew Whisper Transcription on Mobile PWA — language param, Hebrew prompt, temperature=0, iOS Safari .m4a fix, verbose_json confidence filtering** |
| ~~**TASK-1344**~~ | **P2** | ✅ **AI Feature Parity Desktop→PWA + API Pricing/Usage Settings Sync — code done, useAISync.ts implemented** |
| **FEATURE-1345** | **P2** | **🔄 Capacitor Android App — wrap Vue PWA for Play Store distribution (config + build scaffold done)** |
| ~~**TASK-1339**~~ | **P0** | ✅ **Tasks must persist over refresh in guest mode** (✅ DONE 2026-02-17) |
| ~~**BUG-1340**~~ | **P0** | ✅ **Kanban drag-drop broken — Vue 3 $attrs boolean bug (forceFallback/delayOnTouchOnly passed as empty string)** |
| ~~**TASK-1327**~~ | **P0** | ✅ **Centralized LLM Model Registry — single source of truth for all AI model lists, updating one place updates all dropdowns** (✅ DONE 2026-02-17) |
| ~~**TASK-1324**~~ | **P0** | ✅ **URL Display Truncation — shorten long pasted URLs/links across all views (CSS ellipsis, full URL preserved)** (✅ DONE 2026-02-17) |
| ~~**BUG-1333**~~ | **P0** | ✅ **Calendar inbox shows only 2 tasks — stale auto-instances + wrong filter source** |
| ~~**TASK-1323**~~ | **P1** | ✅ **Console Log Cleanup — reduce verbose/debug logging noise across app** (✅ DONE 2026-02-14) |
| ~~**TASK-1322**~~ | **P1** | ✅ **Calendar Month View Fixes — remove dueDate pollution, vertical event layout, drag-move fix, hover tooltips** (✅ DONE 2026-02-17) |
| ~~**TASK-1319**~~ | **P0** | ✅ **Keyboard Shortcuts Help Panel — ? button + Shift+? shortcut, organized categories, blurred backdrop** (✅ DONE 2026-02-14) |
| ~~**TASK-1320**~~ | **P1** | ✅ **Quick Sort UX Redesign — Edit-in-Place with Explicit Advancement (pin-by-ID, Save button, swipe swap)** |
| ~~**BUG-1309**~~ | **P0** | ✅ **Remove corruption overlay, arena, and all gamification UI — visual noise and disconnected UX** |
| ~~**BUG-1301**~~ | **P0** | ✅ **Sync indicator stuck on "Syncing 1 changes..." — orphaned 'syncing' ops in IndexedDB never recover** |
| ~~TASK-1215~~ | P0 | ✅ Persist full UI state across restarts (filters, view prefs, canvas toggles) via useStorage |
| ~~TASK-1246~~ | P2 | ✅ Multi-select filters for inbox (priority, project, duration) with checkboxes + persistence |
| ~~TASK-1247~~ | P2 | ✅ Add "Next 3 Days" filter to inbox (canvas icon bar + unified inbox dropdown) |
| ~~TASK-1248~~ | P1 | ✅ Design token audit & cleanup — all 7 phases complete, ~100+ violations fixed across 30 files |
| ~~TASK-1249~~ | P0 | ✅ Codebase Hygiene Audit — placeholders, hardcoded values, debug leftovers (33/33 sub-tasks done) |
| ~~TASK-1250~~ | P0 | ✅ Fix API key storage — removed plaintext localStorage (proxy handles keys server-side) |
| ~~TASK-1251~~ | P0 | ✅ Fix direct API calls bypassing proxy (AIChatPanel.vue) |
| ~~TASK-1252~~ | P0 | ✅ Remove/gate /keyboard-test debug route (ships without auth) |
| ~~TASK-1253~~ | P0 | ✅ Gate window.__flowstate_tauri_debug behind DEV |
| ~~TASK-1254~~ | P0 | ✅ Fix CORS wildcard on Edge Functions — restricted to allowed origins |
| ~~TASK-1255~~ | P0 | ✅ Fix WelcomeModal — removed dead buttons and stubbed stats |
| ~~TASK-1256~~ | P0 | ✅ Fix stale flowstate.app → in-theflow.com origins |
| ~~TASK-1257~~ | P0 | ✅ Fix productionLogger — now uses Supabase session token |
| ~~TASK-1258~~ | P1 | ✅ Replace httpbin.org with self-hosted endpoint |
| ~~TASK-1259~~ | P1 | ✅ Remove unconditional %c[DEBUG] styled canvas log |
| ~~TASK-1260~~ | P1 | ✅ Remove ~30 bug-specific debug tags across 10 files |
| ~~TASK-1261~~ | P1 | ✅ Fix silent no-op stubs — now throw or warn |
| ~~TASK-1262~~ | P1 | ✅ Re-enable CI lint & unit tests |
| ~~TASK-1263~~ | P1 | ✅ Add Open Graph + Twitter Card meta tags |
| ~~TASK-1264~~ | P1 | ✅ Update stale AI model references |
| ~~TASK-1265~~ | P1 | ✅ Fix AI proxy health check consuming real API tokens (OPTIONS request) |
| ~~TASK-1266~~ | P2 | ✅ CSS design token migration — ~305 values migrated in 20+ files, remaining violations still exist |
| ~~TASK-1267~~ | P2 | ✅ Standardize localStorage key prefixes |
| ~~TASK-1268~~ | P2 | ✅ Extract magic timeout numbers to named constants (src/config/timing.ts) |
| ~~TASK-1269~~ | P2 | ✅ Create centralized src/config/urls.ts |
| ~~TASK-1270~~ | P2 | ✅ Fix hardcoded i18n defaults (ui.ts, SignupForm.vue) |
| ~~TASK-1271~~ | P2 | ✅ Improve Cyberflow empty states (terse text) |
| ~~TASK-1272~~ | P2 | ✅ Mobile design token compliance |
| ~~TASK-1273~~ | P2 | ✅ Update PWA manifest description |
| ~~TASK-1274~~ | P2 | ✅ Migrate 'uncategorized' sentinel to constant |
| ~~TASK-1275~~ | P3 | ✅ Remove 5 obsolete verification scripts |
| ~~TASK-1276~~ | P3 | ✅ Remove Storybook PLACEHOLDER duplicate key |
| ~~TASK-1277~~ | P3 | ✅ Standardize z-index usage (~60 values in 50 files) |
| ~~TASK-1278~~ | P3 | ✅ Standardize font-size usage (~100 values in 32 files) |
| ~~TASK-1279~~ | P3 | ✅ Add missing package.json metadata fields |
| ~~TASK-1280~~ | P3 | ✅ Add copyright to Tauri bundle config |
| ~~TASK-1281~~ | P3 | ✅ Adopt build-time console.log stripping (esbuild pure config) |
| ~~TASK-1282~~ | P3 | ✅ Stop filtering console.error/warn in consoleFilter.ts |
| ~~FEATURE-1200~~ | P2 | ✅ Quick Add full RTL support + auto-expand for long tasks (✅ DONE 2026-02-27) |
| ~~FEATURE-1201~~ | P2 | ✅ Single-screen welcome modal — research-backed, auth-aware, replaces WelcomeModal |
| ~~FEATURE-1202~~ | P1 | ✅ Google Auth sign-in (OAuth) |
| ~~TASK-1283~~ | P1 | ✅ Google Calendar plugin — show events in Calendar view (depends on FEATURE-1202) |
| ~~**TASK-1284**~~ | **P0** | ✅ **Add quick task creation to KDE Plasma widget (monorepo)** |
| ~~**BUG-1793**~~ | **P2** | ✅ **KDE widget "Today" filter reset on reload (todayOnly not persisted)** |
| ~~**BUG-1794**~~ | **P1** | ✅ **Electron app flickers signed-out then back in on window focus changes** |
| TASK-292 | P3 | Canvas connection edge visuals (animations, gradients) |
| TASK-310 | P2 | Automated SQL backup to cloud storage |
| TASK-293 | P2 | Canvas viewport - center on Today + persist position |
| TASK-313 | P2 | Canvas multi-select batch status change |
| TASK-179 | P2 | Refactor TaskEditModal.vue (~1800 lines) |
| TASK-123 | P2 | Consolidate network status implementations |
| TASK-139 | P3 | Undo state persistence to localStorage |
| TASK-125 | P3 | Remove debug console.log (reduced scope) |
| TASK-065 | P3 | GitHub release (remove hardcoded creds, Docker guide) |
| ~~TASK-079~~ | P3 | ✅ ~~Tauri mobile (Android/iOS)~~ — Archived: Tauri replaced by Electron (TASK-1715). Mobile strategy TBD. |
| TASK-157 | P3 | ADHD-Friendly view redesign (Phases 2-4 pending) |
| TASK-1120 | P2 | 🔄 Deep UX/UI analysis and enhancement of catalog views |
| ~~**FEATURE-1443**~~ | **P0** | ✅ ~~**Morning Dashboard — removed route/auto-redirect (Morning Ritual banner kept)**~~ (✅ DONE 2026-03-18) |
| **TASK-1464** | **P1** | **Break Timer On-Screen Overlay — full-screen pomodoro overlay during break with countdown, minimize/stop/+5min controls, glass morphism** |
| ~~**TASK-1465**~~ | **P2** | ✅ ~~**AI Features Audit — review all AI features, decide what to keep vs ditch (broken/no value)**~~ |
| ~~**TASK-1466**~~ | **P2** | ✅ **Start task without resetting timer — allow switching active task while timer runs (web + pinned), add reset option to KDE widget** |
| ~~**BUG-1462**~~ | **P1** | ✅ **Notification spam — clicking any action (Start Work/Break/+5min) should dismiss ALL notification types** (✅ DONE) |
| ~~**TASK-1469**~~ | **P2** | ✅ **AI Chat anti-spam fix — fix ReAct loop spam, limit tool calls per turn, rewrite system prompt to be concise, add output truncation** |
| **TASK-1470** | **P2** | **Task Assist UX resurface — Ctrl+. shortcut hint, smart inline hint, 28-test AI effectiveness suite** | 👀 REVIEW |
| ~~**BUG-1467**~~ | **P2** | ~~**Tasks auto-appear on calendar at 9:00 AM when dragged to Board date columns — moveTaskToDate created calendar instances instead of only setting dueDate**~~ (✅ DONE 2026-03-07) |
| **TASK-1473** | **P0** | **KDE Widget: Add task search/filter — search box to find tasks without scrolling through long lists** |
| ~~**TASK-1475**~~ | **P1** | ~~**KDE Widget: Nanny popup show recent tasks — show commonly used tasks alongside pinned tasks, not only pinned**~~ (✅ DONE 2026-03-07) |
| **TASK-1476** | **P2** | **Catalog: drag tasks to collapsed project groups — allow dropping on closed categories, remove darkening overlay during drag** |
| ~~**TASK-1478**~~ | **P1** | ~~**KDE Widget: Unify dropdown & overlay styling — replace PlasmaComponents.ComboBox with QQC2 glass morphism popups for Sort/Filter; replace Kirigami.Icon with styled emoji in fullscreen overlay**~~ (✅ DONE 2026-03-07) |
| ~~**BUG-1481**~~ | **P2** | ~~**Calendar inbox hides canvas tasks with non-canvasOrder sorts — isInInbox gate too restrictive**~~ (✅ DONE 2026-03-07) |
| ~~**TASK-1480**~~ | **P2** | ~~**Remove beads dependency — MASTER_PLAN.md as single source of truth, delete .beads/, sync scripts, hooks, update docs**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1483**~~ | **P2** | ~~**PWA Today mode shows overdue tasks mixed with today's tasks without visual separation — add distinct Overdue section**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1492**~~ | **P2** | **✅ Canvas position drift when dragging multiple tasks consecutively — race between lock release, settling state, and realtime echoes** (✅ DONE 2026-03-13) |
| ~~**BUG-1493**~~ | **P2** | ~~**Catalog view: collapsed categories reset on navigation, expand/collapse buttons broken, cross-group drag regression**~~ (✅ DONE 2026-03-09) |
| ~~**TASK-1492**~~ | **P2** | ~~**Fix Due Date kanban view — flat layout (no per-project rows) + dateless tasks route to No Date column**~~ (✅ DONE 2026-03-09) |
| ~~**BUG-1503**~~ | **P2** | ~~**Tauri desktop: tasks not updating when adding/deleting on canvas or canvas inbox — WebKitGTK dataTransfer.getData() returns empty, needed dragData singleton fallback**~~ (✅ DONE 2026-03-12) |
| ~~**TASK-1507**~~ | **P2** | ~~**Quick Sort swipe UX polish — center approval notification with fun animation + add "nothing set" reminder popup on accidental swipe**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1518**~~ | **P2** | ✅ **Catalogue view: context menu can't dismiss by clicking away + category drag lag** (✅ DONE 2026-03-13) |
| ~~**BUG-1519**~~ | **P2** | ~~**Date picker calendar blurry — stacked backdrop-filter blur on context menu + submenu + NDatePicker panel**~~ (✅ DONE 2026-03-13) |
| **TASK-1520** | **P2** | **Add recurring indicator badge to task cards (Kanban, Canvas, Table views)** (✅ DONE 2026-03-14) |
| **~~TASK-1525~~** | **P1** | **Recurring task delete dialog — Skip/Stop/Cancel with global recurrence-aware delete** (✅ DONE 2026-03-14) |
| ~~**TASK-1521**~~ | **P1** | **Calendar day/week view drag deferred to mouseup — preview-then-commit pattern, adds undo support** (✅ DONE 2026-03-24) |
| ~~**TASK-1522**~~ | **P2** | ~~**Blank screen on refresh — add loading animation to index.html**~~ (✅ DONE 2026-03-14) |
| **TASK-1523** | **P1** | **Undo/sync race fix — cancel stale sync queue ops when undo/redo restores task create/delete** (✅ DONE 2026-03-14) |
| **~~TASK-1524~~** | **P1** | **Migrate old `recurrence` field to new `recurrenceRule` format on app init** (✅ DONE) |
| **IDEA-1482** | **P3** | **Try CodeGraphContext for codebase graph analysis — Python tool that indexes code into a graph DB for relationship queries (callers/callees/call chains) across 130+ composables. Could help navigate complex canvas/ dependencies. Repo: github.com/CodeGraphContext/CodeGraphContext** |
| ~~**BUG-1526**~~ | **P1** | ~~**Push notification click actions dead — SW posts NAVIGATE_TO_TASK/NAVIGATE_TO/SNOOZE_NOTIFICATION but no client handler existed; added SW message listener in useAppInitialization.ts**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1527**~~ | **P2** | ~~**Remove entire gamification system (XP, achievements, challenges, shop, Cyberflow RPG) — ~23,700 lines removed, DB tables left dormant**~~ (✅ DONE 2026-03-14) |
| ~~**TASK-1531**~~ | **P2** | ~~**KDE dock: show current scheduled calendar block next to pomodoro timer — always-visible context of what's planned now, with toggle in KDE widget settings**~~ (✅ DONE) |
| **TASK-1532** | **P1** | **"Done for Now" vs "Done Fully" for recurring tasks — Hybrid clone model: "done for now" creates completion record + advances original to next occurrence; "done fully" stops recurrence (current behavior). DoneToggle click = done-for-now for recurring, context menu offers both options.** (🔄 IN PROGRESS) |
| **FEATURE-1759** | **P1** | **📋 Unified Knowledge + Custom Lists roadmap foundation** |
| **TASK-1760** | **P1** | **📋 Content taxonomy: task, note, list + shared visibility rules** |
| **TASK-1761** | **P1** | **📋 Catalog -> Knowledge Hub MVP with type filters and capture entry** |
| **TASK-1762** | **P1** | **📋 Note/Page MVP using task-based content, markdown, tags, attachments** |
| **TASK-1763** | **P1** | **📋 Custom Lists MVP: lightweight items, groups, reorder, check off** |
| **TASK-1764** | **P2** | **📋 Recurring list templates and reset/reuse workflow** |
| **TASK-1765** | **P1** | **📋 Unified search across tasks, notes, and lists** |
| **TASK-1766** | **P2** | **📋 Promote note or list item into full task flow** |
| **TASK-1767** | **P2** | **📋 AI can read notes/lists and turn them into useful actions** |
| ~~**TASK-1768**~~ | **P2** | ✅ **Persist mini-canvas planning notes for knowledge workflows** (✅ DONE (2026-05-02)) |
| **TASK-1769** | **P3** | **📋 Lightweight links/backlinks between notes and tasks** |
| ~~**TASK-1533**~~ | **P0** | ✅ **Epic: Workspace Collaboration — multi-user workspace layer for FlowState (26 sub-tasks across 4 phases)** (✅ DONE (2026-04-02)) |
| ~~**TASK-1534**~~ | **P0** | **DB migration: Create workspace tables (workspaces, workspace_members, workspace_invites, task_comments, workspace_activity)** (✅ DONE (2026-03-17)) |
| ~~**TASK-1535**~~ | **P0** | **DB migration: Add workspace_id to tasks, projects, groups + assigned_to on tasks** (✅ DONE (2026-03-17)) |
| ~~**TASK-1536**~~ | **P0** | **DB migration: SECURITY DEFINER function user_workspace_ids() for RLS performance** (✅ DONE (2026-03-17)) |
| ~~**TASK-1537**~~ | **P0** | **DB migration: Rewrite 32+ RLS policies to be workspace-aware** (✅ DONE (2026-03-17)) |
| ~~**TASK-1538**~~ | **P0** | **DB migration: Add new tables to supabase_realtime publication** (✅ DONE (2026-03-17)) |
| ~~**TASK-1539**~~ | **P1** | **Pinia store: workspaces.ts — activeWorkspaceId, CRUD, switchWorkspace** (✅ DONE (2026-03-17)) |
| ~~**TASK-1540**~~ | **P1** | **Update supabaseMappers.ts with workspace_id** (✅ DONE (2026-03-17)) |
| ~~**TASK-1541**~~ | **P1** | ✅ **Update useTaskFiltering.ts with workspace filter** (✅ DONE (2026-04-01)) |
| ~~**TASK-1542**~~ | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts for workspace context** (✅ DONE (2026-03-17)) |
| ~~**TASK-1543**~~ | **P1** | **Update projects.ts store for workspace filtering** (✅ DONE (2026-03-17)) |
| ~~**TASK-1544**~~ | **P1** | **Update canvas store (groups) for workspace filtering** (✅ DONE (2026-03-17)) |
| ~~**TASK-1545**~~ | **P1** | **UI: Workspace switcher component in sidebar** (✅ DONE (2026-03-17)) |
| ~~**TASK-1546**~~ | **P1** | **Update auth.ts: fetch workspaces on login** (✅ DONE (2026-03-17)) |
| ~~**TASK-1547**~~ | **P0** | **Offline sync queue: inject workspace_id into queued payloads** (✅ DONE (2026-03-17)) |
| ~~**TASK-1548**~~ | **P0** | **Realtime subscriptions: workspace_id filtering + workspace switch handling** (✅ DONE (2026-03-17)) |
| ~~**TASK-1549**~~ | **P0** | **Cross-tab sync: add workspaceId to protocol** (✅ DONE (2026-03-17)) |
| ~~**TASK-1550**~~ | **P1** | ✅ **Guest mode isolation for workspace feature** (✅ DONE (2026-04-01)) |
| ~~**TASK-1551**~~ | **P1** | **Invite flow: generate link, accept via Edge Function, /#/invite/:token route** (✅ DONE (2026-03-17)) |
| ~~**TASK-1552**~~ | **P1** | ✅ **Task assignment UI: assigned_to dropdown, avatar badges, filters** (✅ DONE (2026-04-01)) |
| ~~**TASK-1553**~~ | **P1** | **Task comments: CRUD + realtime + UI** (✅ DONE (2026-03-31)) |
| ~~**TASK-1554**~~ | **P2** | **Activity feed: logging + display** (✅ DONE (2026-04-01)) |
| ~~**TASK-1555**~~ | **P1** | **Partner-friendly UX: hide complexity for single-workspace users** (✅ DONE (2026-04-01)) |
| ~~**TASK-1556**~~ | **P1** | **Hebrew translations for all workspace strings** (✅ DONE (2026-03-17)) |
| ~~**TASK-1557**~~ | **P2** | ✅ **Member management UI** (✅ DONE (2026-04-02)) |
| ~~**TASK-1558**~~ | **P2** | **Empty states for workspaces** (✅ DONE (2026-04-01)) |
| ~~**TASK-1559**~~ | **P3** | ✅ **Member presence (v2 nice-to-have)** (✅ DONE (2026-04-02)) |

---

## Workspace Collaboration (TASK-1533 Epic)

> **Goal**: Add multi-user workspace collaboration to FlowState. Personal workspace stays as-is (workspace_id IS NULL). Shared workspaces allow 2+ members to share tasks, projects, and canvas.
> **Priority**: P0 | **Status**: 🔄 IN PROGRESS
> **Brief**: User-provided implementation brief covers DB schema, RLS, stores, UI, and phased rollout.
> **Architect Assessment**: Feasibility confirmed with 5 HIGH-risk areas identified (RLS migration, offline sync queue, realtime subscriptions, cross-tab sync, invite chicken-and-egg).

### Phase 1: Foundation

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1533**~~ | **P0** | ✅ **Epic: Workspace Collaboration — tracking parent for all sub-tasks** | ✅ DONE (2026-04-02) | — |
| ~~**TASK-1534**~~ | **P0** | **DB migration: Create workspaces, workspace_members, workspace_invites, task_comments, workspace_activity tables** | ✅ DONE (2026-03-17) | — |
| ~~**TASK-1535**~~ | **P0** | **DB migration: Add workspace_id (NULLABLE) to tasks, projects, groups tables + assigned_to on tasks** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1536**~~ | **P0** | **DB migration: Create `user_workspace_ids()` SECURITY DEFINER function for RLS performance** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1537**~~ | **P0** | **DB migration: Rewrite ALL RLS policies to be workspace-aware (32+ policies across 8+ tables). Must handle workspace_id IS NULL for personal tasks. TEST AGAINST PRODUCTION DATA COPY.** | ✅ DONE (2026-03-17) | TASK-1535, TASK-1536 |
| ~~**TASK-1538**~~ | **P0** | **DB migration: Add workspace_id to supabase_realtime publication for task_comments and workspace_activity** | ✅ DONE (2026-03-17) | TASK-1534 |
| ~~**TASK-1539**~~ | **P1** | **Pinia store: Create src/stores/workspaces.ts — activeWorkspaceId, workspaces[], members[], switchWorkspace(), createWorkspace(), inviteMember(), acceptInvite(), removeMember()** | ✅ DONE (2026-03-17) | TASK-1537 |
| ~~**TASK-1540**~~ | **P1** | **Update supabaseMappers.ts: Add workspace_id to toSupabaseTask(), toSupabaseProject(), toSupabaseGroup() mappers** | ✅ DONE (2026-03-17) | TASK-1535 |
| ~~**TASK-1541**~~ | **P1** | ✅ **Update useTaskFiltering.ts: Add workspace_id filter predicate so board/canvas/calendar/inbox respect active workspace** | ✅ DONE (2026-04-01) | TASK-1539, TASK-1540 |
| ~~**TASK-1542**~~ | **P1** | **Update taskPersistence.ts + useTasksDatabase.ts: Pass workspace context to fetchTasks, add .eq('workspace_id', ...) filter** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1543**~~ | **P1** | **Update projects.ts store: Filter projects by activeWorkspaceId, same pattern as tasks** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1544**~~ | **P1** | **Update canvas store (groups): Filter groups by activeWorkspaceId, validate workspace match on parentId assignment** | ✅ DONE (2026-03-17) | TASK-1539, TASK-1540 |
| ~~**TASK-1545**~~ | **P1** | **UI: Workspace switcher component in sidebar — dropdown with "Personal" + shared workspaces + "Create Workspace" action** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1546**~~ | **P1** | **Update auth.ts: On login, fetch workspaces via workspace_members join, restore last-used workspace from localStorage** | ✅ DONE (2026-03-17) | TASK-1539 |

### Phase 2: Sync Safety (CRITICAL — must be done before enabling workspaces)

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1547**~~ | **P0** | **Offline sync queue: Inject workspace_id into queued payloads in useSyncOrchestrator.ts. Defense-in-depth for ops created before migration (existing IndexedDB queue entries lack workspace_id)** | ✅ DONE (2026-03-17) | TASK-1540 |
| ~~**TASK-1548**~~ | **P0** | **Realtime subscriptions: Update useRealtimeSubscription.ts to filter by workspace_id instead of user_id. Handle workspace switch (teardown old channel, create new). Add isWorkspaceSwitching flag to prevent reconnect logic from fighting intentional disconnects.** | ✅ DONE (2026-03-17) | TASK-1538, TASK-1539 |
| ~~**TASK-1549**~~ | **P0** | **Cross-tab sync: Add workspaceId to CrossTabMessage and TaskOperation interfaces in useCrossTabSync.ts. Handler must ignore messages from different workspace. Broadcast workspace switch events.** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1550**~~ | **P1** | ✅ **Guest mode isolation: Ensure workspace store returns empty/disabled state when !isAuthenticated. Verify migrateGuestData() targets personal workspace (NULL workspace_id) only.** | ✅ DONE (2026-04-01) | TASK-1539 |

### Phase 3: Collaboration Features

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1551**~~ | **P1** | **Invite flow: Generate invite link (workspace_invites table), copy/share UI, route /#/invite/:token, accept-invite Edge Function (SECURITY DEFINER — must add user to workspace_members server-side, chicken-and-egg problem)** | ✅ DONE (2026-03-17) | TASK-1539 |
| ~~**TASK-1552**~~ | **P1** | ✅ **Task assignment: Add assigned_to dropdown in task detail showing workspace members, avatar badge on Board/Kanban cards, "My tasks" / "All" / "Unassigned" filter** | ✅ DONE (2026-04-01) | TASK-1539, TASK-1551 |
| ~~**TASK-1553**~~ | **P1** | **Task comments: CRUD for task_comments, real-time via Supabase Realtime, comment thread UI in task detail panel + simplified workspace edit modal** | ✅ DONE (2026-03-31) | TASK-1548 |
| ~~**TASK-1554**~~ | **P2** | **Activity feed: Log writes to workspace_activity (task_created, task_completed, comment_added, member_joined), sidebar panel or view with feed UI** | ✅ DONE (2026-04-01) | TASK-1539 |

### Phase 4: Partner UX & Polish

| ID | Priority | Description | Status | Depends On |
|----|----------|-------------|--------|------------|
| ~~**TASK-1555**~~ | **P1** | **Partner-friendly UX: Hide workspace switcher when user has exactly 1 workspace. Invite-only onboarding path (sign up → land directly in shared workspace). Auto-assign tasks to default workspace for single-workspace users.** | ✅ DONE (2026-04-01) | TASK-1545, TASK-1551 |
| ~~**TASK-1556**~~ | **P1** | **Hebrew translations: Add workspaces namespace to he.json — workspace, members, invite, comments, activity feed, all new UI strings** | ✅ DONE (2026-03-17) | TASK-1545 |
| ~~**TASK-1557**~~ | **P2** | ✅ **Member management UI: Remove member, transfer ownership, role display (owner/admin/member)** | ✅ DONE (2026-04-02) | TASK-1539 |
| ~~**TASK-1558**~~ | **P2** | **Empty states: New workspace welcome, no tasks yet, no members yet, pending invite states** | ✅ DONE (2026-04-01) | TASK-1545 |
| ~~**TASK-1559**~~ | **P3** | ✅ **Member presence: Show who's online in workspace using Supabase Realtime Presence (nice-to-have v2)** | ✅ DONE (2026-04-02) | TASK-1548 |

### Key Architecture Decisions

1. **workspace_id IS NULLABLE** — NULL means "personal workspace". No data migration needed for existing tasks.
2. **SECURITY DEFINER function** `user_workspace_ids()` for RLS performance — caches per-transaction, avoids correlated subquery per row.
3. **Invite acceptance via Edge Function** — accepting user can't INSERT into workspace_members (not yet a member → RLS blocks). Server-side function required.
4. **Realtime per-workspace** — subscribe to active workspace only, teardown/rebuild on switch. No multi-workspace listening.
5. **Sync queue defense-in-depth** — inject workspace_id into payloads at queue processing time for legacy operations that predate the migration.
6. **Timer, gamification, AI chat remain personal** — not workspace-scoped.

### Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS policy rewrite (32+ policies) — wrong policy = data leakage or lockout | CRITICAL | Test against production data copy. Deploy schema-only first, let sync queue drain. |
| Offline sync queue — existing IndexedDB ops lack workspace_id | HIGH | workspace_id NULLABLE + inject at processing time |
| Realtime filter change — breaking for existing subscriptions | HIGH | Workspace switch tears down old channel cleanly |
| Cross-tab workspace mismatch — Tab A workspace A, Tab B workspace B | MEDIUM | Add workspaceId to cross-tab protocol, ignore mismatches |
| Invite chicken-and-egg — user can't join workspace they're not in | MEDIUM | Edge Function with service_role key |
| Canvas parentId cross-workspace — task in workspace B references group in workspace A | LOW | App-level validation in drag handlers |

#### ~~BUG-1793~~: KDE widget "Today" filter reset on reload (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-05-23) | **Depends On**: —
**Description**: The widget's "Today" toggle (`todayOnly`) was a runtime-only QML property, not backed by `plasmoid.configuration`. It silently reset to `false` on every widget reload / plasmashell restart, so the list showed ALL non-done tasks (~59) instead of just tasks due today — appearing as a "completely different set" than the Electron app. The filter *logic* (`filterTasksForToday`/`taskMatchesToday`) was already correct and matches the app's `useSmartViews.isTodayTask` (verified against live production data: shows exactly the due-today tasks, overdue excluded by design).
**Fix**: Added persisted `todayOnly` Bool key to `contents/config/main.xml`; initialize `property bool todayOnly: plasmoid.configuration.todayOnly` and write back on toggle in `main.qml`. Bumped widget `metadata.json` 1.1.0→1.1.1. Verified live via journal: Today-on fetch uses `limit=1000` + client filter and loads only the due-today count; choice now survives restarts.

---

#### ~~BUG-1794~~: Electron app flickers signed-out then back in on window focus changes (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-05-23) | **Depends On**: —
**Description**: On the Electron desktop app, the UI intermittently flashed the login screen and then re-signed-in a few seconds later — a transient flicker, not a real logout. Root cause: `useRealtimeSubscription.ts` called `auth.refreshSession()` *unconditionally* on every `visibilitychange → visible` (BUG-1182). Electron fires focus/visibility changes far more often than a browser tab (window focus/blur/occlusion, OS notifications), so this redundant refresh ran on top of Supabase `autoRefreshToken` + the scheduled refresh in `auth.ts`. The resulting auth-event churn produced spurious `SIGNED_OUT` events, and the UI reads `isAuthenticated = !!user.value` with no debounce, so it flashed logged-out until the next refresh recovered the session.
**Fix**: (A) Expiry-gate the wake-up refresh in `src/composables/supabase/useRealtimeSubscription.ts` — only `refreshSession()` when a real session is missing-expiry or within 120s of expiry; `autoRefreshToken` covers the rest. (B) Defense-in-depth in `src/stores/auth.ts`: a non-explicit `SIGNED_OUT` with no recoverable session now defers clearing `user`/`session` behind a 2s grace timer; a valid session re-appearing (SIGNED_IN/TOKEN_REFRESHED) cancels it, so no login-screen flash. Explicit user sign-out (`isSigningOut`) still clears immediately. Tests: `tests/unit/stores/auth-flow.test.ts` updated (#24 grace-period clear) + new #24b (transient SIGNED_OUT→SIGNED_IN stays signed in); 30/30 pass.

---

#### ~~TASK-1533~~: Epic: Workspace Collaboration — Tracking Parent (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-04-02) | **Depends On**: —
**Description**: Epic tracking parent for all workspace collaboration sub-tasks (TASK-1534 through TASK-1559). No implementation work — exists to group and track the full collaboration milestone.

---

#### ~~TASK-1534~~: DB Migration — Core Workspace Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: —
**Description**: Create `workspaces`, `workspace_members`, `workspace_invites`, `task_comments`, and `workspace_activity` tables via Supabase migration. These tables form the foundational schema for all collaboration features.

---

#### ~~TASK-1535~~: DB Migration — Add workspace_id to Existing Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Add `workspace_id` (NULLABLE) column to `tasks`, `projects`, and `groups` tables, plus `assigned_to` column on `tasks`. NULL workspace_id means "personal workspace" — no data migration needed for existing rows.

---

#### ~~TASK-1536~~: DB Migration — user_workspace_ids() SECURITY DEFINER Function (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Create `user_workspace_ids()` SECURITY DEFINER function for RLS performance. Caches per-transaction to avoid correlated subquery per row when evaluating workspace-aware RLS policies.

---

#### ~~TASK-1537~~: DB Migration — Rewrite All RLS Policies (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1535, TASK-1536
**Description**: Rewrite ALL RLS policies to be workspace-aware (32+ policies across 8+ tables). Must handle `workspace_id IS NULL` for personal tasks. TEST AGAINST PRODUCTION DATA COPY before applying. This is the highest-risk migration in the epic.

---

#### ~~TASK-1538~~: DB Migration — Realtime Publication for Workspace Tables (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1534
**Description**: Add `workspace_id` filter to supabase_realtime publication for `task_comments` and `workspace_activity` tables so realtime events are scoped per workspace.

---

#### ~~TASK-1539~~: Pinia Store — workspaces.ts (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1537
**Description**: Create `src/stores/workspaces.ts` with `activeWorkspaceId`, `workspaces[]`, `members[]`, and actions: `switchWorkspace()`, `createWorkspace()`, `inviteMember()`, `acceptInvite()`, `removeMember()`. Central source of truth for workspace context across all stores.

---

#### ~~TASK-1540~~: Update supabaseMappers.ts for workspace_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1535
**Description**: Add `workspace_id` to `toSupabaseTask()`, `toSupabaseProject()`, and `toSupabaseGroup()` mapper functions in `supabaseMappers.ts` so all write operations include workspace context.

---

#### ~~TASK-1541~~: Update useTaskFiltering.ts for workspace_id (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539, TASK-1540
**Description**: Add `workspace_id` filter predicate to `useTaskFiltering.ts` so board, canvas, calendar, and inbox views all respect the active workspace and only show tasks belonging to it.

---

#### ~~TASK-1542~~: Update taskPersistence.ts + useTasksDatabase.ts for workspace context (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Pass workspace context to `fetchTasks` and add `.eq('workspace_id', ...)` filter in `taskPersistence.ts` and `useTasksDatabase.ts` so database reads are scoped to the active workspace.

---

#### ~~TASK-1543~~: Update projects.ts Store for workspace filtering (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Filter projects by `activeWorkspaceId` in `projects.ts` store, following the same pattern applied to tasks in TASK-1541/1542.

---

#### ~~TASK-1544~~: Update Canvas Store (groups) for workspace filtering (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539, TASK-1540
**Description**: Filter canvas groups by `activeWorkspaceId` in the canvas store. Validate workspace match on `parentId` assignment in drag handlers to prevent cross-workspace canvas group references.

---

#### ~~TASK-1545~~: UI — Workspace Switcher Component (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Build workspace switcher component in the sidebar — dropdown listing "Personal" plus shared workspaces, with a "Create Workspace" action at the bottom. Hides automatically when user has exactly 1 workspace (see TASK-1555).

---

#### ~~TASK-1546~~: Update auth.ts — Fetch Workspaces on Login (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: On login, fetch workspaces via `workspace_members` join and restore last-used workspace from `localStorage` in `auth.ts`. Ensures workspace context is available immediately after authentication.

---

#### ~~TASK-1547~~: Offline Sync Queue — Inject workspace_id into Payloads (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1540
**Description**: Inject `workspace_id` into queued payloads in `useSyncOrchestrator.ts`. Defense-in-depth for ops created before the migration — existing IndexedDB queue entries lack `workspace_id` and must be patched at processing time.

---

#### ~~TASK-1548~~: Realtime Subscriptions — Filter by workspace_id (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1538, TASK-1539
**Description**: Update `useRealtimeSubscription.ts` to filter by `workspace_id` instead of `user_id`. Handle workspace switch by tearing down the old channel and creating a new one. Add `isWorkspaceSwitching` flag to prevent reconnect logic from fighting intentional disconnects.

---

#### ~~TASK-1549~~: Cross-Tab Sync — Add workspaceId to Message Protocol (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Add `workspaceId` to `CrossTabMessage` and `TaskOperation` interfaces in `useCrossTabSync.ts`. Handlers must ignore messages from a different workspace. Broadcast workspace switch events so all tabs stay in sync.

---

#### ~~TASK-1550~~: Guest Mode Isolation (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Ensure workspace store returns empty/disabled state when `!isAuthenticated`. Verify `migrateGuestData()` targets personal workspace (`NULL workspace_id`) only so guest data never bleeds into shared workspaces.

---

#### ~~TASK-1551~~: Invite Flow — Link Generation, Route, Edge Function (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1539
**Description**: Generate invite links via the `workspace_invites` table, copy/share UI, route `/#/invite/:token`, and an accept-invite Edge Function with `SECURITY DEFINER` (required because accepting user can't INSERT into `workspace_members` until they're already a member — RLS chicken-and-egg).

---

#### ~~TASK-1552~~: Task Assignment — assigned_to Dropdown + Board Badges (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539, TASK-1551
**Description**: Add `assigned_to` dropdown in task detail showing workspace members, avatar badge on Board/Kanban cards, and "My tasks" / "All" / "Unassigned" filter options.

---

#### ~~TASK-1553~~: Task Comments — CRUD + Realtime Thread UI + Workspace Edit Modal (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-31) | **Depends On**: TASK-1548
**Description**: Full CRUD for `task_comments` with real-time updates via Supabase Realtime. Comment thread UI inside the task detail panel. Simplified workspace edit modal with collaboration bar (assignee, status, due date pills), workspace context strip, "More options" disclosure, and permission gating.

- [x] `src/types/workspace.ts` — `TaskComment` interface appended
- [x] `src/composables/supabase/useTaskComments.ts` — composable with fetchComments, addComment, updateComment, deleteComment, subscribeToComments
- [x] `src/components/tasks/edit/TaskComments.vue` — comment thread with realtime, optimistic CRUD, initials avatars, hover edit/delete
- [x] Simplified workspace edit modal (5-zone layout, collab bar, "More options" disclosure)
- [x] Workspace switch redirects from Canvas to Catalog
- [x] Production DB columns fixed (`is_deleted`, `reply_to_comment_id`)
- [x] E2E tests for workspace and personal task flows

---

#### ~~TASK-1554~~: Activity Feed — workspace_activity Log + UI (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Log writes to `workspace_activity` for events: `task_created`, `task_completed`, `comment_added`, `member_joined`. Sidebar panel or dedicated view with activity feed UI showing recent workspace events.

---

#### ~~TASK-1555~~: Partner-Friendly UX Polish (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1545, TASK-1551
**Description**: Hide workspace switcher when user has exactly 1 workspace. Invite-only onboarding path (sign up → land directly in shared workspace). Auto-assign tasks to default workspace for single-workspace users.

---

#### ~~TASK-1556~~: Hebrew Translations for Workspace Features (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-17) | **Depends On**: TASK-1545
**Description**: Add `workspaces` namespace to `he.json` covering all new UI strings: workspace, members, invite, comments, activity feed, and all related actions and states.

---

#### ~~TASK-1557~~: Member Management UI (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1539
**Description**: Member management UI with remove member, transfer ownership, and role display (owner / admin / member) actions accessible from workspace settings.

---

#### ~~TASK-1558~~: Empty States for Workspace Flows (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-01) | **Depends On**: TASK-1545
**Description**: New workspace welcome screen, "no tasks yet", "no members yet", and pending invite states — covering all empty-state scenarios introduced by the workspace collaboration feature.

---

#### ~~TASK-1559~~: Member Presence via Supabase Realtime Presence (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-02) | **Depends On**: TASK-1548
**Description**: Show who's online in a workspace using Supabase Realtime Presence API. Implemented via separate Realtime channel (`presence:{workspaceId}`), tracks active/idle tab state via visibilitychange API. Online indicators shown on AssigneeAvatar (green/amber dot) and in WorkspaceSettingsTab member list.

---

## System Review 2026-01-31 Findings

> **Source**: Comprehensive system review with 4 parallel agents (Security, Code Quality, Architecture, Health Check)
> **Validated**: npm test (587 passed), npm audit (16 vulnerabilities), npm outdated, npm run lint (349 errors)
> **Total Issues**: 48 (P0: 2, P1: 14, P2: 19, P3: 13)

---

### ~~BUG-1136~~: Add Entity Ownership Check to Tombstone RLS (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: Tombstone soft-delete RLS policy was missing UPDATE policy — upsert with onConflict silently failed for authenticated users.

**Solution**: Added UPDATE RLS policy with `auth.uid() = user_id` check. Migration: `20260304000000_tombstone_rls_update_policy.sql`. Applied to local + production.

**Files**: `supabase/migrations/20260304000000_tombstone_rls_update_policy.sql`

---

### ~~BUG-1137~~: Add Guest Session ID for Migration (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-07)

**Problem**: When guest user signs up, their guest data may leak or not migrate properly.

**Solution**: Generate and store unique guest session ID, use it to migrate guest data on sign-up.

**Files**: `src/stores/auth.ts:361`

---

### ~~BUG-1141~~: Add CSP Headers to Limit XSS Impact (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No Content Security Policy headers configured on production web app.

**Solution**: Added enforcing CSP header to VPS Caddyfile. Policy: `default-src 'self'`, SHA-256 hash for FOUC inline script, `'unsafe-inline'` for Vue scoped styles, explicit allowlist for Google Fonts, Dicebear avatars, Supabase API/WebSocket. Tauri CSP was already configured. `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` for XSS mitigation.

**Files**: `/etc/caddy/Caddyfile` (VPS), `src-tauri/tauri.conf.json` (already had CSP)

---

### ~~BUG-1142~~: Add Rate Limiting to API Calls (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-04)

**Problem**: No rate limiting on API endpoints, vulnerable to abuse. Edge functions (whisper-transcribe, url-scraper-proxy) had no auth check.

**Solution**: (1) Enabled Kong `rate-limiting` plugin on VPS: auth 20/min, REST 300/min. (2) Added `validateSupabaseAuth()` to `whisper-transcribe` and `url-scraper-proxy` edge functions. (3) Added auth token headers to client-side callers (urlScraper.ts, useWhisperSpeech.ts, useMobileInboxLogic.ts).

**Files**: `docker/self-host/volumes/api/kong.yml`, `supabase/functions/whisper-transcribe/index.ts`, `supabase/functions/url-scraper-proxy/index.ts`, `src/services/ai/urlScraper.ts`, `src/composables/useWhisperSpeech.ts`, `src/mobile/composables/useMobileInboxLogic.ts`

---

### ~~BUG-1143~~: Add onUnmounted Cleanup to MobileQuickSortView (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (2026-03-13)

**Problem**: Memory leak - MobileQuickSortView creates setTimeout timers but never cleans them up on unmount.

**Root Cause**: `handleSave()` and `handleMarkDone()` both create `setTimeout` for celebration overlay (600ms) without tracking or clearing on unmount. If component unmounts before timeout fires, stale refs are set.

**Fix**:
1. Added `celebrationTimers` array to track all setTimeout IDs
2. Updated `handleSave()` and `handleMarkDone()` to push timer IDs to tracking array
3. Added `onUnmounted()` hook to clear all pending timers

**Note**: `useSwipeGestures` and `useQuickSort` composables already have their own `onUnmounted` cleanup — no additional cleanup needed for those.

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~BUG-1406~~: Mobile Quick Sort — Bottom Controls Cut Off + Missing Project Assignment (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: On mobile Quick Sort view, the bottom thumb zone (action buttons: Done/Save/Assign/Delete) is clipped by the bottom navigation bar. The date pill row is also truncated (only Today/Tmrw/+3d visible, missing Wknd/+1wk/+1mo). No visible way to assign projects from the sort phase.

**Root Cause**: The `MobileQuickSortFilters.vue` thumb zone padding-bottom didn't account for the 64px mobile bottom nav bar. The sort phase had `overflow: hidden` preventing scroll to bottom controls.

**Fix**:
1. ✅ Added `var(--space-16)` (64px nav) + `var(--space-6)` + `env(safe-area-inset-bottom)` to thumb zone padding-bottom
2. ✅ Changed sort phase from `overflow: hidden` to `overflow-y: auto` so all controls are reachable
3. ✅ Verified Assign button visible and wired to project sheet via `openProjectSheet`
4. ✅ Fixed thumb zone gradient (`linear-gradient` → `transparent`)
5. ✅ Fixed AI "Apply All" to set values locally without persisting — user reviews then hits Save

---

### ~~TASK-1144~~: Split MobileQuickSortView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 2518 lines, exceeding 500-line limit. Hard to maintain and test.

**Solution**: Extract into composables and sub-components:
- `useMobileQuickSortLogic.ts` - business logic
- `MobileQuickSortCard.vue` - card component
- `MobileQuickSortFilters.vue` - filter UI

**Files**: `src/mobile/views/MobileQuickSortView.vue`

---

### ~~TASK-1145~~: Split MobileInboxView.vue (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: File is 1919 lines, exceeding 500-line limit.

**Solution**: Extract into composables and sub-components.

**Files**: `src/mobile/views/MobileInboxView.vue`

---

### ~~TASK-1146~~: Split useSupabaseDatabase.ts by Domain (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-22)

**Problem**: File was 1736 lines with mixed concerns.

**Solution**: Split into 10 domain composables under `src/composables/supabase/` + shared infrastructure. Original file is now a 3-line re-export.

**Files**: `src/composables/supabase/` (13 files)

---

### ~~TASK-1147~~: Replace 199 `any` Types with Proper Interfaces (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-27)

**Problem**: 199 instances of `any` type across 90 files weaken type safety.

**Solution**: Audited and replaced all remaining `any` types with proper TypeScript interfaces. Key changes:
- Added `isVirtual?: boolean` to `CalendarEvent` interface, eliminating 31 `as any` casts across 3 calendar views
- Replaced markdown-it `any` params with `Token`, `Renderer`, `MarkdownIt.Options` types in ChatMessage.vue
- Added `TaskListItem`, `CalendarHelpers`, `WeekDay` type definitions to replace unsafe casts
- Changed `Record<*, any>` icon maps to `Record<*, Component>` in gamification/mobile files
- Fixed `ComputedRef<any[]>` in undoSingleton.ts with proper `UseRefHistoryRecord` type
- Fixed `Ref<any[]>` in useCanvasInteractions.ts with proper `Node[]` type

**Files**: src/types/tasks.ts, src/components/ai/ChatMessage.vue, src/components/calendar/Calendar{Day,Month,Week}View.vue, src/composables/undoSingleton.ts, src/composables/canvas/useCanvasInteractions.ts, src/components/gamification/cyber/CyberShop.vue, src/components/gamification/cyber/CyberAchievements.vue, src/components/gamification/ShopModal.vue, src/mobile/components/MobileInboxFilters.vue

---

### ~~TASK-1149~~: Split timer.ts into 4 Services (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: Timer store was 1328 lines with mixed concerns.

**Solution**: Split into focused services:
- `src/stores/timer.ts` — slim orchestrator (456 lines)
- `src/composables/timer/useTimerSync.ts` — intervals, leadership, DB, Realtime (763 lines)
- `src/composables/timer/useTimerNotifications.ts` — browser/SW notifications (163 lines)
- `src/composables/timer/useTimerAudio.ts` — sound playback (86 lines)

Public API unchanged — zero consumer migration needed.

**Files**: `src/stores/timer.ts`

---

### ~~TASK-1152~~: Fix 40 eslint-disable/@ts-ignore Suppressions (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: 40 eslint-disable and @ts-ignore comments indicate tech debt.

**Solution**: Audit each suppression and fix underlying issues.

**Files**: 17 files with suppressions

---

### ~~TASK-1154~~: Standardize Error Handling Pattern (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Inconsistent error handling - some functions throw, others return null.

**Solution**: Standardized DB layer: write ops re-throw after `handleError()`, read ops return empty/null. Fixed 4 files: `permanentlyDeleteGroup/Project` now re-throw, `fetchUserSettings` uses structured `handleError`, AI sync fire-and-forget calls now have `.catch()` handlers.

**Files**: `src/composables/supabase/useGroupsDatabase.ts`, `useProjectsDatabase.ts`, `useSettingsDatabase.ts`, `src/composables/useAISync.ts`

---

### ~~TASK-1155~~: Split AppSidebar.vue (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-04)

**Problem**: File was 1974 lines, exceeding 500-line limit.

**Solution**: Extracted 6 sub-components + 1 composable. AppSidebar.vue reduced to 104-line shell.

**Files**: `src/layouts/AppSidebar.vue`, `src/components/sidebar/` (6 files), `src/composables/app/useQuickTaskInput.ts`

---

### ~~TASK-1156~~: Split useBackupSystem.ts (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: File was 1412 lines, exceeding 500-line limit.

**Solution**: Split into 8 modular sub-composables under `src/composables/backup/` using Context + Factory pattern. Old import path preserved as re-export barrel. 22/22 tests pass.

**Files**: `src/composables/backup/` (8 files), `src/composables/useBackupSystem.ts` (barrel)

---

### ~~TASK-1157~~: Extract Magic Numbers to Named Constants (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-13)

**Problem**: Magic numbers scattered throughout code.

**Solution**: Create `src/constants/` directory with named constants.

**Files**: Multiple files

**Resolution**: Extracted ~40 magic numbers across 17 files into named constants. Created `src/constants/calendar.ts` (slot height, snap minutes), `src/constants/breakpoints.ts` (mobile breakpoint). Extended `src/config/timing.ts` (flash, toast, startup delays) and `src/constants/canvas.ts` (navigation animation). Fixed stale raw `30000` in timer.ts. Zero logic changes.

---

### ~~TASK-1160~~: Add Virtualized Task Lists (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Problem**: Rendering 500+ tasks causes performance issues.

**Solution**: Implement `@tanstack/vue-virtual` for Board and Calendar views.

**Files**: Board view, Calendar view components

---

### TASK-1161: Create Shared Domain Layer for Mobile (📋 PLANNED)

**Priority**: P4 | **Status**: 📋 PLANNED

**Problem**: Mobile views duplicate logic from desktop views.

**Solution**: Create `src/domain/` with shared composables.

**Files**: `src/domain/` (new), mobile views

---

### ~~FEATURE-1162~~: Smart Filters / Saved Views (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-05)

**Feature**: Allow users to save filter combinations as named views.

**Implementation**:
1. ~~Create `saved_filters` Supabase table~~ → Stored in settings JSONB (syncs via existing pipeline)
2. ✅ SavedViewsDropdown component with glass-morphism design
3. ✅ Quick access bookmark dropdown in FilterControls + InboxFilters
4. ✅ Composable `useSavedViews.ts` for capture/apply/save/delete
5. ✅ Persists via localStorage + Tauri Store + Supabase user_settings

**Files**: `src/types/savedViews.ts`, `src/composables/useSavedViews.ts`, `src/components/filters/SavedViewsDropdown.vue`, `src/stores/settings.ts`, `src/components/base/FilterControls.vue`, `src/components/canvas/InboxFilters.vue`

---

### FEATURE-1164: Habit Tracking Mode (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: Extend recurring tasks to support habit tracking with streaks and statistics.

**Files**: Task types, new views

---

### FEATURE-1166: Create Public API (📋 PLANNED)

**Priority**: P3-LOW | **Status**: 📋 PLANNED

**Feature**: REST API for external integrations (Zapier, IFTTT, custom scripts).

**Files**: New Edge Functions, API documentation

---

### ~~TASK-1169~~: Add Unit Tests for Database Layer (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-02-23)

**Problem**: No dedicated tests for database composable.

**Solution**: Add tests with mocked Supabase client.

**Files**: `tests/unit/composables/useSupabaseDatabase.spec.ts`

---

### TASK-1171: Add Mobile View E2E Tests (🔄 IN PROGRESS)

**Priority**: P2-MEDIUM | **Status**: 🔄 IN PROGRESS

**Problem**: Mobile views have E2E test coverage gaps.

**Solution**: Add Playwright tests for mobile viewport.

**Files**: `tests/e2e/mobile/`

---

### ~~TASK-1172~~: Update VueUse 10.11 → 14.1 (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE

**Problem**: VueUse is 4 major versions behind.

**Prerequisites**: Requires Vue 3.5+ upgrade first.

**Files**: `package.json`

**Resolution**: Already upgraded to @vueuse/core@14.2.1 with Vue 3.5.26. No action needed.

---

### ~~TASK-1175~~: Fix 349 Linter Errors (✅ DONE)

**Priority**: P3-LOW | **Status**: ✅ DONE (2026-03-14)

**Problem**: 349 ESLint errors and 292 warnings.

**Solution**: Run `npm run lint --fix` and manually fix remaining issues.

**Files**: Multiple files

**Resolution**: Reduced from 349 errors to 12 (all intentionally skipped). Fixed: unused vars/imports (29), extra semicolons, useless v-binds, boolean shorthand, define-macros-order, max-attributes-per-line. Remaining 12: 11 `vue/custom-event-name-casing` (kebab-case events can't be renamed without breaking parents) + 1 `no-unsafe-finally` (logic issue, not lint fix).

---

### System Review Summary

**Metrics**:
- Tests: 587 passed, 28 todo (615 total)
- Linter: 349 errors, 292 warnings
- npm audit: 16 vulnerabilities (0 critical, 2 high)
- Codebase: 585 files, 136,067 lines of code


---


## Roadmaps

### ROAD-004: Mobile PWA (✅ DONE)

**Status**: ✅ DONE (2026-01-19) - All phases complete.

See archive for TASK-324, TASK-325, TASK-326 details.

---

### ROAD-013: Sync Hardening (✅ DONE)

**Status**: ✅ DONE (2026-01-14)

Implemented "Triple Shield" Drag/Resize Locks. Multi-device E2E moved to TASK-285.

---

### ~~ROAD-010~~: Gamification - "Cyberflow" (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-01-30)

**Archived**: Gamification removed in TASK-1527

**Parent Feature**: FEATURE-1118

**Sub-Features**:
- FEATURE-1132: AI Game Master Challenge System (🔄 IN PROGRESS)
  - Database migration: `user_challenges`, `challenge_history` tables
  - Types: `src/types/challenges.ts`
  - Store: `src/stores/challenges.ts`
  - AI Game Master: `src/services/ai/gamemaster.ts`, `challengeTemplates.ts`
  - UI: CorruptionOverlay, ChallengeCard, DailyChallengesPanel, BossFightPanel
  - Integration: `useGamificationHooks.ts` tracks challenge progress
  - Skill: `.claude/skills/cyberflow-rpg/SKILL.md`
- [ ] **TASK-1242**: Corruption-influenced AI personality — glitchy tone at high corruption levels (moved from Phase 4)

**Blocking**: BUG-1204 - Apply migration to database (table returns 404)

---

### ~~TASK-1317~~: Cyberflow RPG — Full Cyberpunk Game UI Overhaul (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-02-07)

**Archived**: Gamification removed in TASK-1527

**Parent**: FEATURE-1118

**Goal**: Complete cyberpunk visual overhaul of the gamification system with dedicated Cyberflow command center, Anti-Chore game design, and system interconnections.

**Phase 1: Visual Foundation** ✅
- Installed augmented-ui, added cyberpunk fonts (Rajdhani, Orbitron, Space Mono)
- Created `src/assets/cyberflow-tokens.css` (neon palette, glow effects, clip-paths, animations)
- Created `src/composables/useCyberflowTheme.ts` (intensity-aware theme composable)

**Phase 2: Cyberflow Hub Page** ✅
- New `/cyberflow` route with 5-tab navigation (Overview/Missions/Boss/Upgrades/Trophies)
- Created 12 new cyber components (CyberDashboardHub, CyberMissionBriefing, CyberBossFight, CyberCharacterProfile, CyberSkillTree, CyberAchievements, CyberShop, etc.)
- Hub-and-spoke layout: Overview cards → drill into tabs

**Phase 3: Header Widget Redesign + Intensity Levels** ✅
- Restyled LevelBadge, XpBar, StreakCounter with cyberpunk aesthetics
- Intensity filtering wired up (minimal/moderate/intense)
- Exposure toast system (shielded/exposed) with proper icon rendering

**Phase P0: Anti-Chore Game Mechanics** ✅
- Created `docs/game-mechanics.md` — authoritative game design reference
- Removed exposed penalty (timer = invitation, not obligation)
- Removed XP decay (earned XP permanent forever)
- Updated SHIELDED_XP_BONUS from 1.10 to 1.15
- Suppressed nagging "EXPOSED" toast per Distraction Test

**Progress (2026-02-08):** Phases 1-3 complete + P0 anti-chore constants applied. 624 tests passing, zero TS errors. Next: P1 items (streak multiplier, corruption XP modifier, partial boss credit).

**Phase 4: RPG HUD Header Redesign** (TASK-1305, 🔄 IN PROGRESS)
- Created `GamificationHUD.vue` — single RPG-styled component replacing inline header widgets
- 4 visual states: unauth CTA ("CONNECT TO THE GRID"), minimal (text only), moderate (full bar), intense (glow + shine + narrative)
- Uses cyberflow design tokens: corner-cut-sm clip-path, cf-dark-3 bg, cf-cyan border/glow, Space Mono typography
- Backdrop blur via `::before` pseudo-element (clip-path + backdrop-filter incompatibility fix)
- Refactored AppHeader.vue: removed ~80 lines of inline widgets, replaced with `<GamificationHUD />`
- Added challenge pick animation to DailyChallengesPanel (glow + collapse + auto-navigate)
- Fixed kill-flow-state.sh hanging on zombie PIDs (added timeout to pwdx)
- Fixed missing verify-auth script reference in package.json dev script

**Progress (2026-02-12):** Phase 4 HUD implemented. Challenge pick animations working. User testing in progress — multiplier and penalty visualization discussed but not yet implemented.

---

### ~~BUG-1302~~: Time Block Notifications Still Not Firing (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: Despite BUG-1296 fix (`_rawTasks` → `rawTasks`), time block notifications are still not firing. User has a 120-min calendar block scheduled and received no milestone alerts (halfway, 1-min-before, ended).

**Root Causes Found** (multi-agent investigation):
1. **Late tolerance too tight** (2 min) — desktop apps sleep/background, `setInterval` skips ticks, milestones silently missed
2. **Singleton guard fragile** — module-level `isInitialized` survives but interval could die, `start()` refuses to restart
3. **Silent notification delivery** — `deliverNotification()` had no error handling, no logging, failed invisibly
4. **Missing permission request** — Timer store requests Notification permission at init, but time blocks didn't
5. **Instance data not in sync queue** — `createTaskInstance` was fire-and-forget, instances not backed up by sync queue
6. **Toast too short** — 5s duration easy to miss

**Fixes Applied** (4 files):
1. `useTimeBlockNotifications.ts` — Late tolerance 2min→10min, resilient singleton (restarts if interval died), delivery logging, toast duration 5s→8s, skip completed/soft-deleted tasks
2. `notificationDelivery.ts` — Added try-catch, logging on permission denied/API unavailable/delivery success, returns boolean
3. `useAppInitialization.ts` — Explicit `Notification.requestPermission()` before starting time block polling
4. `taskOperations.ts` — Added `instances` to sync queue payload for offline backup

**Files**:
- `src/composables/useTimeBlockNotifications.ts` — Core composable (polling, milestone detection, delivery)
- `src/utils/notificationDelivery.ts` — Browser Notification API wrapper
- `src/composables/app/useAppInitialization.ts` — Where composable is mounted
- `src/stores/tasks/taskOperations.ts` — Sync queue payload for instance persistence

---

### ~~BUG-1307~~: Week View Events Render as Thin Slivers on Thu-Sun Columns (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: In the calendar week view, events on Monday and Tuesday render correctly with proper width, title, time, and duration. However, events on Thursday through Sunday appear as nearly invisible thin vertical lines/slivers instead of proper event blocks.

**Root Cause**: CSS `.week-event { left: var(--space-1); right: var(--space-1); }` overrode the JS-computed percentage-based `left`/`width` from `getWeekEventStyle()`. The fixed CSS values clamped all events to the same position regardless of day column.

**Fix Applied**:
- [x] Removed CSS `left`/`right` overrides from `.week-event` in `CalendarWeekView.vue`
- [x] Added 2px inset padding via `calc()` in `getWeekEventStyle()` for column gap

**Files Changed**:
- `src/components/calendar/CalendarWeekView.vue` — Removed conflicting CSS left/right
- `src/composables/calendar/useCalendarWeekView.ts` — `calc()` padding in left/width

---

### ~~BUG-1308~~: Month View Shows Only 2 Columns Instead of 7 (✅ DONE)

**Priority**: P1-HIGH | **Status**: ✅ DONE (2026-03-13)

**Problem**: The calendar month view grid was missing day-of-week header row (MON-SUN).

**Root Cause**: Template had no weekday header component. CSS grid was correct (`repeat(7, 1fr)`) and 42 cells were generated correctly, but without header labels the layout appeared broken.

**Fix Applied**:
- [x] Added `month-weekday-header` row with Mon-Sun labels above the grid
- [x] Added CSS for header grid matching 7-column layout

**Files Changed**:
- `src/components/calendar/CalendarMonthView.vue` — Added weekday header row + CSS

---

### ~~FEATURE-1118~~: Gamification System - Design & Implementation (✅ DONE — Obsolete)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE — Obsolete (2026-01-30)

**Archived**: Gamification removed in TASK-1527

**Goal**: Add game-like elements to FlowState to increase engagement and make productivity feel rewarding.

**Design**: See `docs/game-mechanics.md` for full game design document (Anti-Chore Manifesto, system interconnections, ARIA personality, progression curve).

---

### ROAD-011: AI Assistant (⏸️ PAUSED)

**Priority**: P3 | Task breakdown, auto-categorization, NL input. Stack: Ollama + Claude/GPT-4.

---

### ROAD-025: Backup Containerization (📋 PLANNED)

**Priority**: P3 | Move `auto-backup-daemon.cjs` into Docker container for VPS distribution.

---

### TASK-1471: Docker Self-Host E2E Test (🔄 IN PROGRESS)

**Priority**: P3 | **Status**: 🔄 IN PROGRESS

**Goal**: Verify a fresh self-hosted installation works end-to-end before sharing repo publicly.

**Bugs found & fixed (committed)**:
- [x] Kong `rate-limiting` plugin not declared in `KONG_PLUGINS` — added
- [x] `init-db.sh` had wrong filename (`fix_id_types.sql` → `20260106000000_fix_id_types.sql`) and was missing 12 of 24 migrations — fixed
- [x] `.env.self-host` / `.env.self-host.test` not gitignored — added
- [x] `supabase/postgres:17.2.0` image tag doesn't exist — updated to `17.6.1.095`
- [x] Created `scripts/test-self-host.sh` with 6 E2E tests + `--keep` flag for browser testing

**Remaining**:
- [ ] Run `./scripts/test-self-host.sh --keep` — builds full Docker stack and runs 6 E2E tests
- [ ] Once tests pass, verify in browser at `http://localhost:13050`
- [ ] To tear down: `docker compose -p flowstate-test -f docker-compose.self-host.yml --env-file .env.self-host.test down -v`

**Files**: `.gitignore`, `docker-compose.self-host.yml`, `docker/self-host/init-db.sh`, `scripts/test-self-host.sh`

---

## Task Dependency Index (PWA Prerequisites) - ✅ ALL COMPLETE

All blocking tasks (TASK-118, 119, 120, 121, 122) completed. See archive for details.

---

## Architecture Constraints

- **Geometry write policy**: Only drag handlers + explicit move actions may change `parentId`, `canvasPosition`, `parentGroupId`, `position`
- **Sync is read-only**: `syncStoreToCanvas` does NOT write to stores
- **Smart Groups metadata-only**: May update `dueDate`/`status`/`priority`, never geometry

---

### ~~TASK-1440~~: Gamification Offline Resilience (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-03)

**Problem**: Gamification store writes directly to Supabase. When offline, XP awards, streak updates, stat increments, achievement unlocks, and purchases silently fail — causing data loss for gamification state.

**Strategy**: Local-first state updates — update Pinia state BEFORE Supabase writes. Wrap all Supabase writes in try/catch with `console.warn`. On failure, local state stays updated; server reconciles on next load.

**Changes** (`src/stores/gamification.ts`):
- `awardXp`: Local XP/level update first, notifications fire immediately, Supabase write in try/catch, reconcile from server on success
- `recordDailyActivity`: Local streak update first (streak loss is critical UX), Supabase write in try/catch + warn on failure; streak freeze deduction also local-first via fire-and-forget
- `incrementStat`: Local stat update first, Supabase write in try/catch
- `unlockAchievement`: Local achievement unlock first + toast shows immediately, Supabase upsert in try/catch
- `purchaseItem`: Local XP deduction + item ownership first, all Supabase writes in try/catch with warn (purchase still succeeds locally)

**Marker**: All wrapped calls tagged with `[OFFLINE-SAFE]` comment for traceability.

**Files**: `src/stores/gamification.ts`

---

### ~~TASK-1463~~: Clean Up Project Root — Remove/Consolidate Temp Files (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-07)

**Problem**: Project root has 141 debug PNG screenshots, tracked temp reports/scripts, stale lockfiles, and other clutter that doesn't belong at the root level.

**Cleanup plan**:
1. Delete 141 debug PNG screenshots from root (all untracked)
2. Remove tracked temp files: `full_report.txt`, `lint_report.txt`, `ts_errors.txt`, `unused_vars_report.txt`, `console-task-1348.txt`, `current-state.md`, `snapshot-*.md`, `bulk_replace*.js`, `components_lint_report.json`, `lint_report.json`, `lint_output.log`, `test_output.log`, `typecheck_output.txt`, `any_files.txt`
3. Remove stale `pnpm-lock.yaml` (project uses npm), `.cursorrules`
4. Remove `stats.html` (2.9MB build artifact)
5. Add `*.png` and temp patterns to `.gitignore` to prevent recurrence

---

### ~~TASK-1465~~: AI Features Audit — Review and Clean Up All AI Features (✅ DONE)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: Multiple AI features exist across the app in various states — some broken, some unused, some duplicated. No clear picture of what's working, what's valuable, and what should be removed.

**Scope**: Review all AI features and decide what to keep vs ditch.

**Findings**:
- Weekly Plan AI: LLM distribution replaced with deterministic algorithm (TASK-1405). LLM used only for week theme (Step 3) — keep.
- ARIA Game Master: Challenge generation broken. Template fallback preserved. AI rebuild removed from scope.
- AI Chat (Groq/Ollama): Working but ReAct loop dumps walls of tool result data (→ TASK-1469).
- Task Assist: Working but hidden in context menu — users never find it (→ TASK-1470).
- AI Memory Health Dashboard: Low value, internal tooling only — evaluate for removal.
- AI Quality Dashboard: Low value, internal tooling only — evaluate for removal.

**Outcome**: Spawned 2 follow-up tasks (TASK-1469, TASK-1470). Deleted broken/no-value AI files. Simplified AIHubView to surface only working features.

---

### ~~TASK-1469~~: AI Chat Anti-Spam Fix (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-14)

**Problem**: AI Chat ReAct loop dumps walls of raw tool result data into the conversation instead of answering questions concisely. Users see JSON blobs, long lists, and repeated tool calls before getting an answer.

**Fix**:
1. Limit tool calls per turn (max 3-5 before forcing a synthesis step)
2. Rewrite system prompt to emphasize concise, conversational responses — tool results are context, not output
3. Add output truncation for tool results shown in UI (collapse long results with "show more")
4. Review ReAct loop termination conditions — ensure it stops when answer is found, not when tool quota is exhausted

**Category**: AI / Chat

**Resolution**: Hidden step indicators from message content (metadata only), reduced MAX_REACT_STEPS 5→3, added forceful synthesis instruction after tool results, added 4 conciseness rules to system prompt, added step-indicator cleanup regex to cleanResponse(), capped digest length (fallback 1500→800, all paths 2000 max).

---

### TASK-1500: Supabase Chat Persistence + Usage Log Sync (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-10)

**Problem**: AI chat conversations and usage log entries were stored in localStorage only, meaning no cross-device sync.

**Fix**:
- Created `src/services/ai/chatPersistence.ts` — Supabase CRUD (load/save/delete) for `ai_conversations` table. Uses existing `supabase` client from `@/services/auth/supabase`. Silently fails on error.
- Created `src/services/ai/usageSync.ts` — 60s interval flush of accumulated usage entries to `ai_usage_log` via `upsert_ai_usage_log` RPC. Aggregates by date/provider/model before upserting.
- Modified `src/stores/aiChat.ts` — `initialize()` now async; tries Supabase first (VPS-first), falls back to localStorage. Debounced Supabase save wired into `debouncedSaveConversations`. Delete mirrors to Supabase. `startUsageSync()` called on init. Added `syncStatus` ref.

**Category**: AI / Persistence / Sync

---

### TASK-1470: Task Assist UX Resurface (👀 REVIEW)

**Priority**: P2 | **Status**: 👀 REVIEW (2026-03-31)

**Problem**: AI Task Assist is functional but buried in a context menu popover. Most users never discover it. It provides real value (AI suggestions for task breakdown, priority, time estimates) but zero discoverability.

**Implemented**:
1. ✅ AI Assist button with `Ctrl+.` shortcut hint in TaskEditModal toolbar
2. ✅ `Ctrl+.` keyboard shortcut registered in KeyboardShortcutsPanel (searchable)
3. ✅ Smart inline suggestion prompt — persistent for new users, re-triggers for incomplete tasks (completeness < 0.5)
4. ✅ `useTaskCompleteness` composable — scores task metadata completeness (priority, dueDate, duration, subtasks)
5. ✅ localStorage-backed AI discovery tracking (`AI_ASSIST_DISCOVERED` key)
6. ✅ **28-test AI effectiveness suite** — validates result quality, task improvement measurement, acceptance tracking, parsing robustness, and UX flow
7. ✅ Fixed vitest Tauri stub — resolved 17 previously broken test files

**Category**: AI / UX

---

### ~~TASK-1527~~: Remove Entire Gamification System (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

Removed the entire gamification system (~23,700 lines): XP, achievements, challenges, shop, boss fights, corruption, Cyberflow RPG view, cyberflow design tokens, and all integration hooks. DB tables left dormant (no migration needed, reversible). Build passes, 883/884 tests pass.

**Category**: Cleanup / Architecture

---

### ~~BUG-1528~~: Tiny gray dot appears on today's date in date picker (✅ DONE)

**Priority**: P2-MEDIUM | **Status**: ✅ DONE (2026-03-14)

**Problem**: Naive UI's built-in `<div class="n-date-panel-date__sup">` rendered a gray dot on today's date, overlapping with our custom `::after` dot indicators.

**Fix**: Hidden the default element with `display: none !important` in `global-overrides.css`. Our custom white/teal dots remain.

**Category**: UI Bug

---

### ~~BUG-1531~~: Duplicated tasks keep being created (✅ DONE)

**Priority**: P0-CRITICAL | **Status**: ✅ DONE (fixed via BUG-1533 on 2026-03-16)

**Problem**: Tasks were being duplicated — same task appeared multiple times, causing massive inflation (333,111 tasks). Root cause: recurrence scheduler cloning on every page load + calendar view missing dedup + 300s smart merge window too wide.

**Resolution**: Fixed by BUG-1533 commit `46cb445a` (12 duplication fixes): localStorage lock on recurrence, DB-level dedup check + unique index, Map-based calendar dedup, smart merge window tightened to 30s. DB verified clean: 0 duplicates, 96 healthy tasks.

**Category**: Data Integrity / Sync

---

---

## ~~Epic: Comprehensive Testing Strategy (TASK-1584 — TASK-1670)~~ — 🗄️ ARCHIVED

> 🗄️ ARCHIVED (2026-03-25) — Over-engineered 87-task plan deleted. Writing tests reactively on bugs is more practical. TASK-1586 and TASK-1589 were completed and remain useful.

## Bugs Found by E2E Tests (TASK-1671 — TASK-1682)

> **Goal**: Fix all real bugs discovered by the E2E test suite.
> **Priority**: P0-P1 | **Status**: 📋 PLANNED

| ID | Task | Priority | Status |
|----|------|----------|--------|
| ~~BUG-1671~~ | Fix workspace migration — `workspace_id` column missing from tasks/projects/groups, `workspace_members` table missing. Migration exists but fails due to `projects.id` type conflict (uuid vs text). Fix migration or drop FK constraint first. | P0 | ✅ **DONE** — Obsolete (Tauri removed). Note: workspace migration schema issue (projects.id type conflict) may still need fixing independently. |
| ~~BUG-1672~~ | Fix sidebar clipping in Tauri — sidebar text cut off, only icons visible. CSS grid `minmax(240px, 340px)` not respected in WebKitGTK. | P1 | ✅ **DONE** |
| ~~BUG-1673~~ | Fix Catalog view empty — status filter 'all' treated as literal match + WebKitGTK Realtime desync. Fixed in browser, Tauri deferred to Electron migration. | P0 | ✅ **DONE** (2026-03-24) |
| ~~BUG-1674~~ | Fix Inbox dropdown behind sidebar — calendar dropdown z-index lower than sidebar stacking context. | P1 | ✅ **DONE** |
| ~~BUG-1675~~ | Fix Canvas view empty in E2E — Vue Flow nodes don't render for test user. Workspace query errors prevent task loading. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1676~~ | Fix Board view empty — kanban columns render but no task cards. Same workspace root cause. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1677~~ | Fix context menu positioning — right-click menu not appearing or appearing outside viewport bounds. | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1678~~ | Fix tooltip z-index — tooltips render with z-index 'auto' instead of explicit value, may appear behind content. | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1679~~ | Fix PWA manifest not linked in dev mode — `<link rel="manifest">` missing when devOptions.enabled=false. | P2 | ✅ **DONE** |
| ~~BUG-1680~~ | Fix card border-radius not rendering — task cards missing rounded corners in some views. | P3 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~BUG-1681~~ | Fix Inbox panel shows no content — inbox collapsed by default, badge/content not accessible. | P2 | ✅ **DONE** — Obsolete (Tauri removed). Note: inbox empty state should be verified in Electron. |
| ~~BUG-1682~~ | Fix sidebar project names not loading — seeded project data not reaching sidebar due to workspace query errors. | P0 | ✅ **DONE** — Obsolete (dependency on BUG-1671) |
| ~~BUG-1691~~ | Fix tasks turning untitled (empty title saved) | P0 | ✅ **DONE** |
| ~~BUG-1696~~ | Tauri: Project names clipped to 24px in sidebar (WebKitGTK confirmed) | P1 | ✅ **DONE** |
| ~~BUG-1697~~ | Tauri: overflow:clip hides scrollable content in WebKitGTK | P1 | ✅ **DONE** |
| ~~BUG-1698~~ | Tauri: Views render blank pages when navigating (WebDriver test confirmed) | P1 | ✅ **DONE** |
| ~~BUG-1699~~ | E2E: 126 of 602 Playwright tests failing (CRUD, morning dashboard, multi-tab sync, mobile, PWA, performance) | P1 | ✅ **DONE** |
| ~~BUG-1700~~ | E2E: Initial render takes 12.7s (performance test expects <3s FCP) | P1 | ✅ **DONE** |
| ~~BUG-1701~~ | E2E: Memory growth >20MB across create/delete cycles | P2 | ✅ **DONE** — Obsolete (Tauri removed). Note: memory growth on create/delete cycles is a general concern, not Tauri-specific. |
| ~~BUG-1709~~ | Tauri: Inbox task cards — left done-toggle icons unclear + right action icons cover RTL text | P2 | ✅ **DONE** |
| ~~BUG-1710~~ | ✅ Tauri: "Unhandled promise rejection" error on launch (Promise:undefined:undefined) | P1 | ✅ **DONE** |
| ~~BUG-1711~~ | Tauri: Task completion celebration overlay is see-through (should be opaque) | P2 | ✅ **DONE** — Obsolete (Tauri removed) |
| ~~TASK-1712~~ | Tauri visual parity: task cards/UI degrade vs web app — need automated WebKitGTK visual regression | P1 | ✅ **DONE** (Tauri archived) |
| ~~BUG-1702~~ | Tauri: WebDriver test infra — view navigation uses localhost:1420 instead of embedded URLs | P2 | ✅ **DONE** |
| ~~BUG-1703~~ | Tauri: WebDriver font test false positive — "serif" substring matches "sans-serif" | P3 | ✅ **DONE** |
| ~~BUG-1704~~ | HTML: `<button>` nested inside `<button>` in SavedViewsDropdown.vue — invalid HTML | P2 | ✅ **DONE** |
| ~~BUG-1705~~ | CSS: 2 unannotated overflow:clip usages in MobileQuickSortView.vue (unit test failing) | P2 | ✅ **DONE** |

#### ~~BUG-1671~~: Workspace Migration Failure (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed). Note: workspace migration schema issue (projects.id type conflict) may still need fixing independently.

- **Priority**: P0-CRITICAL
- **Root Cause**: `20260317000000_workspace_collaboration.sql` adds `workspace_id` to tasks/projects/groups and creates `workspace_members` table. Migration fails because `20260106000000_fix_id_types.sql` changes `projects.id` from uuid to text, but `pinned_tasks.project_id` FK still expects uuid. The FK constraint must be dropped/recreated first.
- **Impact**: ALL views fail to load data because every query now includes `.is('workspace_id', null)` which errors on missing column.
- **Fix**: Either fix the migration chain order, or manually drop the FK constraint before running migrations.

#### ~~BUG-1672~~: Sidebar Clipping in Tauri (✅ DONE)
- **Priority**: P1-HIGH
- **Root Cause**: CSS `grid-template-columns: minmax(240px, 340px) 1fr` in MainLayout.vue not respected by WebKitGTK. Sidebar renders at icon-only width. Fixed by removing `contain: layout`, CSP fix via `dangerousDisableAssetCspModification`, and OverflowTooltip inline-flex→flex.
- **Files**: `src/layouts/MainLayout.vue`, `src/layouts/AppSidebar.vue`

#### ~~BUG-1673~~: Catalog View Empty (✅ DONE)
- **Priority**: P0 | **Fixed**: 2026-03-24
- **Root Cause**: (1) Status filter `'all'` from ViewControls stored literally — `filteredTasks` matched `task.status === 'all'` (nothing). Persisted in localStorage, making bug permanent. (2) In Tauri/WebKitGTK, Supabase Realtime CHANNEL_ERROR drops likely cause data desync where rawTasks has data but filteredTasks empties.
- **Fix**: Normalized 'all' → null in setActiveStatusFilter + applyFilterState migration + defense-in-depth guard in useTaskFiltering. TaskTable groups watcher gets immediate:true. Diagnostic logging added for Tauri desync detection.
- **Status**: Fixed in browser. Tauri-specific Realtime desync deferred to Electron migration (TASK-1715).

#### ~~BUG-1675~~ to ~~BUG-1676~~: Empty Views (✅ DONE)

> ✅ **DONE** — Obsolete (dependency on BUG-1671)

- **Priority**: P0-CRITICAL
- **Root Cause**: Caused by BUG-1671 (workspace migration). Fixing the migration fixes these.
- **Dependency**: BUG-1671

#### ~~BUG-1674~~: Inbox Dropdown Behind Sidebar (✅ DONE)
- **Priority**: P1-HIGH
- **Root Cause**: Inbox panel's NPopover dropdowns rendered inside a stacking context trapped by sidebar z-index.
- **Fix**: Already resolved in BUG-1582 — `to="body"` added to both NPopover components in UnifiedInboxHeader.vue. No NDatePicker exists in inbox components.
- **Files**: `src/components/inbox/unified/UnifiedInboxHeader.vue`

---

### ~~BUG-1691~~: Fix tasks turning untitled (empty title saved) (✅ DONE)

**Priority**: P0 | **Status**: ✅ DONE (2026-03-22)

**Problem**: Tasks lose their titles and become "untitled" after editing. Users save tasks with content but the title field becomes empty.

**Root Causes**:
1. **TaskTable.vue** `saveEdit()` — no empty-string guard allowed blank titles to be saved on blur when user edits and clears the field
2. **tasks.ts** realtime sync — operator precedence bug (`!taskDoc.title === undefined` always false due to `!` binding tighter than `===`) disabled title validation, allowing empty strings through sync
3. **AllTasksView.vue** `handleUpdateTask()` — added guard blocking empty title updates to prevent user-triggered saves

**Files**: `src/components/common/TaskTable.vue`, `src/stores/tasks/tasks.ts`, `src/views/AllTasksView.vue`

---

## Tauri & E2E Test Audit Findings (BUG-1696 — BUG-1705)

> **Goal**: Fix all bugs found during the March 2026 comprehensive test audit.
> **Context**: E2E suite was completely broken (Vitest/Playwright collision). After fixing `playwright.config.ts`, 126 failures surfaced. WebDriver tests against real WebKitGTK confirmed additional Tauri-specific bugs.
> **Priority**: P1-P2 | **Status**: 📋 PLANNED

#### ~~BUG-1696~~: Tauri Project Names Clipped to 24px (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test against real WebKitGTK (wry 0.54.1)
- **Symptom**: Project items in sidebar render at 24px width instead of >100px. Only icons visible, names clipped.
- **Related**: BUG-1672 (broader sidebar clipping). This is a specific sub-issue — project name elements are narrower than the sidebar itself.
- **Evidence**: WebDriver test `sidebar project names have readable width` — Expected >100, Received 24
- **Fix**: Removed `contain: layout` from `.sidebar` (breaks flex sizing in WebKitGTK wry 0.54.1). Added defensive `width: 100%` to BaseNavItem and projects-list. CSS-only, 3 files.
- **Files**: `src/layouts/AppSidebar.vue`, `src/components/base/BaseNavItem.vue`, `src/components/sidebar/SidebarProjectsSection.vue`

#### ~~BUG-1697~~: overflow:clip Hides Content in WebKitGTK (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test + Vitest css-syntax safety test
- **Symptom**: 1 element using `overflow:clip` with scrollable content — content vanishes in WebKitGTK.
- **Fix**: Replace `overflow: clip` with `overflow: hidden` per SOP-060. Also fix 2 unannotated usages in MobileQuickSortView.vue (BUG-1705).
- **Reference**: `docs/sop/SOP-060-webkitgtk-gotchas.md`

#### ~~BUG-1698~~: Tauri Views Render Blank on Navigation (✅ DONE)
- **Priority**: P1 | **Confirmed by**: WebDriver test + screenshot showing "Could not connect to localhost"
- **Root Cause**: Tests navigate to `http://localhost:1420/` but the debug build embeds the frontend — no dev server running. App loads initially (first test page works) but subsequent `browser.url()` calls fail.
- **Fix**: WebDriver tests should navigate using relative paths or detect the embedded base URL from the initial page.
- **Screenshot**: `.dev/screenshots/webdriver/view-canvas-*.png` shows "Could not connect to localhost: Connection refused"

#### ~~BUG-1699~~: 126 Playwright E2E Tests Failing (✅ DONE)
- **Priority**: P1 | **Scope**: 126 of 602 tests across chromium + webkit + tauri-simulation
- **Breakdown**:
  - CRUD Workflows: 6 failures (TimeoutError on task edit modal selectors)
  - Morning Dashboard: ~12 failures (drag-to-slot, pool rendering)
  - Multi-Tab Sync: ~9 failures (cross-tab data sync)
  - Mobile Core Flows: 6 failures (bottom nav, menu, timer)
  - PWA Runtime: 6 failures (SW, offline, FCP >3s)
  - CSS Rendering: multiple (layout, scrollbars, RTL)
  - Tauri Layout/Specific: ~9 failures (sidebar collapse, calendar, drag)
  - Data Integrity: 1 failure (data stuck empty after reload)
  - Self-Host: 1 failure (quick add task)
  - Taskbar Nanny: 1 failure (threshold without chosen task)
- **Note**: These were previously invisible because the entire E2E suite crashed before running (Vitest/Playwright `Symbol($$jest-matchers-object)` collision). Fixed by changing `testDir` in `playwright.config.ts`.

#### ~~BUG-1700~~: Initial Render Takes 12.7s (✅ DONE)
- **Priority**: P1 | **Confirmed by**: Playwright memory-perf test
- **Resolution**: FCP is actually ~1s (Chromium) / ~1.8s (WebKit). The 12.7s was from broken test infra. Verified 2026-03-24.
- ~~**Symptom**: Performance test expects FCP under 3 seconds, actual initial render took 12.7s~~

#### ~~BUG-1701~~: Memory Growth >20MB (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed). Note: memory growth on create/delete cycles is a general concern, not Tauri-specific.

- **Priority**: P2 | **Confirmed by**: Playwright memory-perf test
- **Symptom**: Memory grows >20MB across create/delete cycles, suggesting leak in task store or Supabase subscriptions

#### ~~BUG-1711~~: Tauri Task Completion Celebration Overlay See-Through (✅ DONE)

> ✅ **DONE** — Obsolete (Tauri removed)

- **Priority**: P2 | **Confirmed by**: User screenshot in Tauri production app
- **Symptom**: "Sweet!" celebration overlay with checkmark is transparent — background content visible through it. Should have opaque/glass background.
- **Root cause**: Likely same CSP issue as BUG-1674 — `backdrop-filter` or background styles not applying in Tauri production. Or `.tauri-app` override missing for this component.
- **Files**: `src/components/tasks/` (DoneToggle celebration overlay)

#### ~~BUG-1710~~: Tauri Unhandled Promise Rejection on Launch (✅ DONE)
- **Priority**: P1 | **Confirmed by**: User report in Tauri production app (v1.3.25)
- **Error**: `Error: Unhandled promise rejection` at `Promise:undefined:undefined`
- **Impact**: Error dialog on app launch, may block functionality

#### ~~BUG-1713~~: DnD to specific day group in Catalog fails (Unknown dueDate group key) (✅ DONE)
- **Priority**: P2 | **Status**: ✅ DONE (2026-03-24)
- **Problem**: Dragging a task to a per-day group (e.g., Wednesday) in the Catalog view's dueDate grouping failed silently. The `applyGroupTransfer` function in TaskList.vue only recognized generic bucket keys (today, tomorrow, thisWeek, etc.) but not the `day-YYYY-MM-DD` keys generated for individual weekday groups.
- **Root Cause**: Missing handler for per-day group keys in the dueDate assignment logic. Only generic bucket grouping was supported, not individual calendar days.
- **Fix**: Added `else if (group.key.startsWith('day-'))` handler to extract the date from the key format and set it as dueDate. The handler parses the `day-YYYY-MM-DD` format and assigns that date to the task.
- **Files**: `src/components/tasks/TaskList.vue`

#### ~~BUG-1714~~: RTL: Project names with mixed Hebrew/Latin text render in wrong direction (✅ DONE)
- **Priority**: P2 | **Status**: ✅ DONE (2026-03-24)
- **Problem**: Project names containing both Hebrew and Latin characters (e.g., "פרויקטים עם קבוצת AI מעצבים ב") displayed in wrong text direction (LTR instead of RTL) in sidebar nav items, app header subtitle, and canvas group headers.
- **Root Cause**: Text-rendering elements lacked proper directionality hints, causing the browser to default to LTR for mixed-direction text.
- **Fix**: Added `dir="auto"` to text-rendering elements in `BaseNavItem` (`.nav-label`), `AppHeader` (`.title-filter`), and `CanvasGroup` (`.section-name`) so the browser auto-detects base direction from the first strong character.
- **Files**: `src/components/base/BaseNavItem.vue`, `src/layouts/AppHeader.vue`, `src/components/canvas/CanvasGroup.vue`

#### ~~TASK-1712~~: Tauri Visual Parity — Automated WebKitGTK Regression Testing (✅ DONE)

> ⏸️ **ARCHIVED**: Deferred to Electron migration. See [MASTER_PLAN_TAURI_ARCHIVE.md](MASTER_PLAN_TAURI_ARCHIVE.md)

- **Priority**: P1 | **Type**: Infrastructure + Bug fixes
- **Problem**: Task cards, icons, overlays, and UI components look/work better in the web app than in Tauri. Multiple visual issues reported (BUG-1709 icons, BUG-1711 overlay, text overlap). No automated way to detect these before deploying.
- **Goal**: Build a testing pipeline that catches Tauri/WebKitGTK visual regressions BEFORE deployment, so Claude can fix them without the user manually testing each build.
- **Approach**:
  1. Extend `scripts/webkit-test.py` to run with `cargo tauri dev` (real Tauri IPC, not HTTP mock)
  2. Add screenshot comparison (baseline vs current) for each view
  3. Add checks for: element overlap, icon sizing, opacity, glass morphism, RTL text rendering
  4. Integrate into deploy pipeline (block deploy if visual regression detected)
- **Depends on**: Working `cargo tauri dev --no-dev-server-wait` workflow
- **Files**: `scripts/webkit-test.py`, `scripts/deploy-tauri-update.sh`, `tests/webdriver/`

#### ~~BUG-1709~~: Tauri Inbox Task Cards — Icons Unclear + Text Overlap (✅ DONE)
- **Priority**: P2 | **Confirmed by**: User screenshot in Tauri production app
- **Issue 1**: ~~Left done-toggle icons appear as unclear blobs instead of recognizable checkmark circles~~ — Fixed: size 14→16, added `background: var(--success-bg-subtle)` + 20px circle behind icon in `.done-indicator`
- **Issue 2**: ~~Right-side action icons overlap Hebrew RTL task title text~~ — Fixed: all physical `right`/`left` properties on `.task-actions`, `.timer-indicator`, `.done-indicator` replaced with `inset-inline-end`/`inset-inline-start`; added `padding-inline-end: var(--space-8)` to task content in both cards
- **Files**: `src/components/inbox/unified/UnifiedInboxTaskCard.vue`, `src/components/inbox/calendar/CalendarTaskCard.vue`

#### ~~BUG-1702~~: WebDriver Test Navigation Uses Wrong URLs (✅ DONE)
- **Priority**: P2 | **Type**: Test infrastructure
- **Problem**: `webkitgtk-layout-bugs.ts` tests 4 & 5 navigate to `http://localhost:1420/` which is the Tauri dev server port. Debug builds embed the frontend, so no dev server is running.
- **Fix**: Use the initial page URL as base, or navigate via JS (`window.location.hash = '#/board'`) instead of `browser.url()`
- **File**: `tests/webdriver/specs/webkitgtk-layout-bugs.ts`

#### ~~BUG-1703~~: WebDriver Font Test False Positive (✅ DONE)
- **Priority**: P3 | **Type**: Test infrastructure
- **Problem**: Font test checks `fontFamily.not.toContain('serif')` but actual value `"v-sans, system-ui, ... sans-serif"` matches because "sans-serif" contains "serif"
- **Fix**: Use regex `/(?<!sans-)serif/` or check for exact "serif" as standalone font name
- **File**: `tests/webdriver/specs/webkitgtk-layout-bugs.ts:351`

#### ~~BUG-1704~~: Nested `<button>` in SavedViewsDropdown (✅ DONE)
- **Priority**: P2 | **Confirmed by**: Vite build warning
- **Problem**: `<button>` element nested inside another `<button>` at lines 45-51 of `SavedViewsDropdown.vue`. Invalid HTML per spec, causes click handling issues.
- **File**: `src/components/filters/SavedViewsDropdown.vue:45-51`

#### ~~BUG-1705~~: Unannotated overflow:clip in MobileQuickSortView (✅ DONE)
- **Priority**: P2 | **Confirmed by**: Vitest css-syntax safety test (1 of 1812 failing)
- **Problem**: 2 usages of `overflow: hidden` with SOP-060 comment but missing `/* WebKitGTK-safe */` annotation on lines 13 and 280
- **Fix**: Add `/* WebKitGTK-safe */` annotation or verify the fallback is correct
- **File**: `src/mobile/views/MobileQuickSortView.vue`

---

## TypeScript Strict Mode Errors (TASK-1683 — TASK-1689)

> **Goal**: Fix all 388 `tsc --noEmit` errors to achieve strict type safety. Build passes (Vite skips these) but they mask real bugs.
> **Priority**: P2 | **Status**: 📋 PLANNED

| ID | Task | Priority | Status |
|----|------|----------|--------|
| ~~TASK-1683~~ | ✅ Fix Supabase database composable types (85 errors, 11 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1684~~ | ✅ Fix Canvas composable types (120 errors, 9 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1685~~ | ✅ Fix App initialization & sidebar types (40 errors, 2 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1686~~ | ✅ Fix Calendar composable types (22 errors, 4 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1687~~ | ✅ Fix Sync & timer types (29 errors, 3 files) | P2 | ✅ **DONE** (2026-04-02) |
| ~~TASK-1688~~ | ✅ Fix AI, board, and cross-tab types (41 errors, 8 files) | P2 | ✅ **DONE** (2026-04-02) |
| TASK-1689 | Fix miscellaneous type errors (51 errors, 18 files) | P3 | 📋 PLANNED |

#### ~~TASK-1683~~: Supabase Database Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 85 errors across 11 files in `src/composables/supabase/`
- **Root patterns**: (1) `supabase` client imported as possibly null — needs non-null assertion or guard. (2) Supabase `.select('*')` returns `{}` type — needs explicit type parameter or cast. (3) `Record<string, unknown>` vs concrete interface mismatches in `.forEach()` callbacks.
- **Fix approach**: Add `supabase!` non-null assertion in `_infrastructure.ts` or add null guards. Add type parameters to `.select<T>()` calls. Type callback parameters with concrete interfaces.

#### ~~TASK-1684~~: Canvas Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 120 errors across 9 files in `src/composables/canvas/`
- **Root patterns**: (1) Vue Flow `findNode()` returns `unknown` — needs type assertion. (2) `NodeChange[]` vs `unknown[]` in `onNodesChange` handlers. (3) Untyped `payload` in Realtime event handlers. (4) `undoHistory` ref typed as `unknown`.
- **Fix approach**: Add proper Vue Flow type imports (`GraphNode`, `NodeChange`). Type the Realtime payload handlers. Fix `undoHistory` ref generic parameter.

#### ~~TASK-1685~~: App Initialization & Sidebar Types (✅ DONE)
- **Priority**: P2
- **Error count**: 40 errors across 2 files
- **Root patterns**: Supabase Realtime `.on('postgres_changes')` callback payload is typed as `{}`. Properties like `id`, `is_deleted`, `title`, `name` accessed on it.
- **Fix approach**: Type the Realtime payload with `RealtimePostgresChangesPayload<{[key: string]: unknown}>` and cast `.new`/`.old` to task/project/group interfaces.

#### ~~TASK-1686~~: Calendar Composable Types (✅ DONE)
- **Priority**: P2
- **Error count**: 22 errors across 4 files
- **Root patterns**: (1) `instance` callbacks typed as `Record<string, unknown>` instead of `TaskInstance | RecurringTaskInstance`. (2) Catch clause `e` is `unknown` — needs `instanceof Error` guard. (3) Property destructuring from `unknown` objects.
- **Fix approach**: Change callback parameter types to use proper interfaces. Add error guards in catch blocks.

#### ~~TASK-1687~~: Sync & Timer Types (✅ DONE)
- **Priority**: P2
- **Error count**: 29 errors across 3 files
- **Root patterns**: (1) `useTimerLeaderElection.ts` — `handleLeaderMessage(sync: unknown)` uses `sync.action`, `sync.leaderId` etc. without narrowing. (2) `useSyncOrchestrator.ts` — various payload types.
- **Fix approach**: Define a `LeaderMessage` discriminated union type. Type sync operation payloads.

#### ~~TASK-1688~~: AI, Board, and Cross-Tab Types (✅ DONE)
- **Priority**: P2
- **Error count**: 41 errors across 8 files
- **Root patterns**: Mixed — `Record<string, unknown>` vs concrete types, `unknown` assertions, missing generics.
- **Fix approach**: Add proper type annotations file by file. Most are simple type parameter additions.

#### TASK-1689: Miscellaneous Type Errors (📋 PLANNED)
- **Priority**: P3
- **Error count**: 51 errors across 18 files
- **Root patterns**: Scattered minor type issues — `unknown` catch variables, missing properties, test mock types.
- **Fix approach**: Fix individually. Low priority since these are in less critical paths.

---

## Canvas Image Paste Feature (TASK-1690)

### ~~TASK-1690~~: Ctrl+V paste-image support for CanvasView (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-25)

**Goal**: Allow users to paste screenshots from clipboard directly onto the canvas. Pasted images appear as draggable `imageNode` nodes, with click-to-zoom lightbox. Images are compressed and stored in Supabase Storage (with data URL fallback for offline/guest mode).

**What works**: Paste (Ctrl+V), render on canvas, click-to-select (teal ring), drag, double-click lightbox, Delete key removes, undo via global operation stack.

**Follow-up**: ~~TASK-1722~~ (✅ DONE — context menu overlap, delete+undo, lightbox focus)

---

### ~~TASK-1722~~: Canvas ImageNode interaction polish (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Parent**: TASK-1690 follow-up

**Issues fixed**:
1. ✅ Right-click context menu overlap — added `.image-node` guard to `handleCanvasRightClick`
2. ✅ Delete + Ctrl+Z undo — fixed global keydown listener (was skipping Delete), replaced broken `permanentlyDeleteTaskWithUndo` with `bulkDeleteTasksWithUndo`, always push image deletes to undo stack
3. ✅ Lightbox focus return — already working from TASK-1690

**Root causes found**: Delete key not reaching handler (focus stolen by VueFlow nodes), `permanentlyDeleteTaskWithUndo` corrupting shared `pendingOperation` singleton state, tombstone blocking undo restore, console filter swallowing debug logs (`[TASK-` pattern)

**Files**: `src/composables/canvas/useCanvasEvents.ts`, `src/composables/canvas/useCanvasTaskActions.ts`, `src/views/CanvasView.vue`, `src/composables/undoSingleton.ts`

---

### BUG-1723: Supabase Realtime connection drops with CHANNEL_ERROR cycling (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS (2026-04-04)

**Problem**: Realtime WebSocket connection repeatedly drops with `CHANNEL_ERROR` and `CLOSED` events (unknown reason), then reconnects. This causes unnecessary data reloads, duplicate PROJECT event floods (6 projects × multiple reconnects), and potential missed events during the disconnect window.

**Symptoms from console**:
- `📡 [REALTIME] Connection dropped (CHANNEL_ERROR): unknown reason`
- `📡 [REALTIME] Connection dropped (CLOSED): unknown reason`
- Duplicate `removeChannel` calls (recursion guard catches them)
- After reconnect: full recovery reload + PROJECT event storm (all 6 projects re-emitted multiple times)

**Investigation areas**:
1. Check Supabase Realtime server health / connection limits on VPS
2. Review channel subscription cleanup — recursion guard suggests double-teardown
3. Check if tab visibility changes trigger disconnects
4. Review reconnect backoff strategy (currently ~1s)
5. Deduplicate PROJECT events after reconnect recovery

**Files**: `src/composables/useRealtimeSubscription.ts`, `src/composables/useAppInitialization.ts`

---

### BUG-1724: BaseModal Vue warning — extraneous class attribute on fragment root (📋 PLANNED)

**Priority**: P3 | **Status**: 📋 PLANNED

**Problem**: Every `BaseModal` usage triggers Vue warning: "Extraneous non-props attributes (class) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes." Affects `ConfirmationModal`, `RecurrenceDeleteModal`, and all modals across Canvas, Calendar, and Sidebar views.

**Root cause**: `BaseModal` renders a fragment (multiple root nodes) or uses `<Teleport>` as root, so Vue can't auto-inherit the `class` attribute from parent components like `ConfirmationModal`.

**Fix options**:
1. Wrap `BaseModal` template in a single root element
2. Use `inheritAttrs: false` and manually bind `$attrs` to the correct element
3. Remove `class` pass-through from `ConfirmationModal` wrapper

**Files**: `src/components/base/BaseModal.vue`, `src/components/common/ConfirmationModal.vue`

---

### ~~BUG-1725~~: Lifecycle hooks called outside component setup context (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-04-08)

**Problem**: Console warns `onMounted is called when there is no active component instance` and `onUnmounted is called when there is no active component instance`. This happens during app initialization, likely from an async composable that registers lifecycle hooks after an `await` statement.

**Root cause**: Vue 3 requires lifecycle hooks to be registered synchronously during `setup()`. If a composable uses `async setup()` or calls `onMounted`/`onUnmounted` after an `await`, the hooks won't bind to any component instance.

**Investigation**:
1. Search for `onMounted` / `onUnmounted` calls inside async functions or after `await` in composables
2. Check `useAppInitialization.ts` — it orchestrates many async operations during startup
3. Check Realtime subscription setup — connection happens async

**Impact**: Hooks silently fail to register, meaning cleanup code in `onUnmounted` never runs (potential memory leaks).

**Files**: `src/composables/useAppInitialization.ts`, composables called during init

---

### ~~BUG-1731~~: Electron auth persistence — sessions lost on app restart (✅ DONE)

**Priority**: P1 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Electron's `file://` protocol didn't reliably persist `localStorage` across app restarts. Auth tokens were lost whenever users closed and reopened the app, forcing re-authentication.

**Root cause**:
1. Electron's `file://` scheme doesn't support persistent storage across restarts (localStorage is ephemeral)
2. OAuth callback couldn't be captured in Electron's `file://` context (no HTTP server to receive redirects)
3. Settings > Account section didn't show update status for Electron users

**Fix**:
1. **electronStorage adapter** (`src/services/auth/electronStorage.ts`) — IPC-backed storage adapter that routes auth tokens through `electron-store` (disk-persisted key-value store)
2. **localhost OAuth server** (`electron/ipc/auth.ts`) — Start `http://localhost:3001` in main process to capture OAuth callback (same pattern as Tauri)
3. **Electron-aware auth flow** (`src/composables/useElectronAuth.ts`) — Routes Electron through `skipBrowserRedirect: true` + `openExternal()` for browser-based OAuth
4. **Account settings mirror** (`src/components/settings/tabs/AccountSettingsTab.vue`) — Added "Updates" section for Electron showing auto-updater status (parallel to Tauri)

**Files**: `src/services/auth/electronStorage.ts`, `src/composables/useElectronAuth.ts`, `electron/ipc/auth.ts`, `src/components/settings/tabs/AccountSettingsTab.vue`

---

### ~~BUG-1732~~: Canvas group badge counts task not rendered (parentId without canvasPosition) (✅ DONE)

**Priority**: P2 | **Status**: ✅ DONE (2026-03-26)

**Problem**: Canvas group badge showed inflated task count — tasks with `parentId` but no `canvasPosition` were counted in the group's task total but never rendered as Vue Flow nodes. Additionally, the task edit modal's section selector would change the `canvasPosition` but forget to set `parentId`, causing tasks assigned to canvas sections via the modal to render as root nodes instead of being contained inside their assigned groups.

**Root cause**:
1. `canvasGroups.ts` badge count computed property counted all tasks with a `parentId` without verifying they also had a valid `canvasPosition`
2. `useTaskEditActions.ts` section change logic set `canvasPosition` (for rendering) but didn't set `parentId` (for group membership), creating orphaned visual nodes

**Fix**:
1. **canvasGroups.ts**: Updated badge count to require BOTH `parentId` AND `canvasPosition` to be present — tasks missing geometry are excluded from the count
2. **useTaskEditActions.ts**: Section change now atomically sets both `parentId` and `canvasPosition` together, ensuring task becomes a proper group child on save

**Files**: `src/stores/canvas/canvasGroups.ts`, `src/composables/tasks/useTaskEditActions.ts`

---

### BUG-1737: Canvas Delete + Ctrl+Z undo unreliable — task reappears then vanishes (🔄 IN PROGRESS)

**Priority**: P2 | **Status**: 🔄 IN PROGRESS

**Problem**: After deleting a task on canvas and pressing Ctrl+Z, the task sometimes reappears briefly then vanishes again. Undo is unreliable.

**Root cause**: Three race conditions in the dual-write delete architecture:
1. **Realtime echo re-delete (primary)**: `deleteTask()` both enqueues a sync queue DELETE *and* directly soft-deletes in Supabase. Undo cancels the queue DELETE but the direct soft-delete already triggered a realtime echo that re-splices the restored task.
2. **Sync queue DELETE-cancels-CREATE**: The sync orchestrator's DELETE handler proactively cancels pending CREATEs for the same entity — including the CREATE that undo just enqueued.
3. **`deleteOperationsByType` not status-aware**: If the sync queue DELETE is already `syncing` (in-flight HTTP), deleting it from IndexedDB doesn't cancel the request.

**Recommended fixes** (prioritized):
1. Suppress realtime DELETE echoes for 5s after undo restore (`addPendingWrite` window)
2. Make `deleteOperationsByType` status-aware (warn on `syncing` operations)
3. Consider single-write path for DELETEs (sync queue only, no direct save)

**Files**: `src/composables/undoSingleton.ts`, `src/stores/tasks/taskOperations.ts`, `src/services/offline/writeQueueDB.ts`, `src/composables/app/useAppInitialization.ts`

---

### ~~BUG-1736~~: Flaky E2E — "create task in Canvas → node appears" fails on WebKit (✅ DONE)

**Priority**: P3 | **Status**: ✅ DONE (2026-04-01)

**Problem**: Playwright E2E test `crud-workflows.spec.ts:429` ("create task in Canvas → node appears") intermittently fails on WebKit. Likely a timing issue — Vue Flow node mounting is slower in WebKit, or canvas ready state isn't properly awaited.

**Potential fixes**:
1. Add `waitForSelector` with longer timeout for the Vue Flow node
2. Wait for canvas `isCanvasReady` state before interacting
3. Skip on WebKit if it's a known platform limitation

**Files**: `tests/e2e/crud-workflows.spec.ts`

---

## Partner Collaboration Roadmap — Shared Task OS

### FEATURE-1805: Partner collaboration — shared task operating system (📋 PLANNED)

**Priority**: P1 | **Status**: 📋 PLANNED

**Goal**: Make FlowState usable as a shared daily operating system for two people: shared projects, tasks, board/calendar planning, assignment, comments, activity, and realtime updates. This is intentionally not a full Notion clone; docs/databases/pages are out of scope unless later proven necessary.

**Existing foundation**: Workspace tables/RLS/invites/members, workspace switcher, task assignment, presence, activity feed, workspace-aware task/project/group queries, and realtime filters already exist. The work is to harden and complete the shared-workspace experience.

**Non-goals for first release**:
- Full Notion-style page/database/block editor
- Public team/organization product surface
- Shared Canvas as the first milestone
- Complex granular permissions beyond owner/admin/member/viewer basics

#### Phase 1: Shared workspace hardening MVP

**Priority**: P1 | **Target**: 2-4 weeks

**Scope**:
- Verify workspace create/invite/accept/switch flows end-to-end in Electron.
- Ensure task/project loads, writes, realtime updates, and offline queue operations are always scoped by `workspaceId`.
- Make Board usable for shared workspaces: create/edit/delete/move tasks, project grouping, assignment filter, and partner visibility.
- Keep Canvas personal-only during this phase; redirect behavior is acceptable.
- Add focused RLS, sync-queue, realtime, and workspace-switch regression coverage.

**Acceptance criteria**:
- User and partner can both see and mutate the same shared workspace tasks.
- Personal tasks never appear in shared workspace, and shared tasks never appear in personal workspace.
- Simultaneous edits do not duplicate, resurrect, or silently discard tasks in normal Board workflows.
- Electron build ships the feature behind existing workspace UI.

#### Phase 2: Shared planning workflow

**Priority**: P1 | **Target**: 2-3 weeks after Phase 1

**Scope**:
- Make Calendar safe and useful in shared workspaces.
- Support assignment, unassigned work, and "mine/all" filters across Board and Calendar.
- Add task comments and activity feed polish for real partner handoff.
- Add notifications or visible badges for partner changes where low-risk.

**Acceptance criteria**:
- Both users can plan shared work on Board and Calendar without losing updates.
- Comments/activity make it clear who changed what recently.
- Shared planning remains reliable through reloads, Electron restarts, and realtime reconnects.

#### Phase 3: Daily-use reliability pass

**Priority**: P1 | **Target**: 2-3 weeks after Phase 2

**Scope**:
- Stress-test sync, offline recovery, conflict behavior, workspace switching, tombstones, and undo/redo in shared workspaces.
- Add regression tests around the historically risky paths: LWW conflicts, deletion/undo, realtime reconnect, cached stale data, and workspace cache isolation.
- Tighten role behavior: owner/admin/member/viewer permissions should match RLS and UI affordances.
- Build and deploy through the Electron updater flow.

**Acceptance criteria**:
- Shared task OS is safe enough for daily use by two people.
- Known sync/realtime failure modes have direct regression coverage.
- `npm run electron:build` passes and updater manifest is verified after release.

#### Phase 4: Shared Canvas evaluation

**Priority**: P2 | **Status**: 📋 PLANNED, defer until Phases 1-3 are stable

**Scope**:
- Decide whether shared Canvas is actually needed after daily task collaboration is working.
- If needed, design shared Canvas around explicit workspace geometry ownership, conflict handling, and realtime update safety.
- Do not enable shared Canvas by default until geometry sync has strong tests.

**Acceptance criteria**:
- A clear go/no-go decision exists for shared Canvas.
- If implemented, Canvas group/task positions do not jump, overwrite, or cross-leak between users/workspaces.

---

## Formatting Guide

**Task Format**: `### TASK-XXX: Title (STATUS)` with `🔄 IN PROGRESS`, `✅ DONE`, `📋 PLANNED`

**Priority**: `P0-CRITICAL`, `P1-HIGH`, `P2-MEDIUM`, `P3-LOW`

**Progress**: Checked boxes `- [x]` calculate % automatically.

---

## References

- **Archive**: `docs/archive/MASTER_PLAN_JAN_2026.md` (completed tasks)
- **Code Review Archive**: `docs/archive/CODE_REVIEW_FINDINGS_JAN_2026.md`
- **Crisis Analysis**: `docs/reports/2026-01-20-auth-data-loss-analysis.md`

---

*Condensed January 27, 2026 - Reduced from ~2,300 lines to ~380 lines (84% reduction)*
