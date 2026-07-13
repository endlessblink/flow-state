# Claude Code Task: Expose the Complete Safe FlowState Capability Surface to Hermes

## Mission

Audit FlowState’s existing user-facing and domain-level capabilities, then expose the complete safe, user-scoped capability surface through the FlowState Local Task API and the Hermes FlowState connector.

The goal is to let Hermes operate as a capable personal assistant without repeatedly becoming blocked by missing operations such as recurring-task completion, duplicate merging, project assignment, work-block editing, timer control, Canvas operations, or exact task reads.

This is not a request for unrestricted machine access, direct production database access, credential access, or hidden autonomous mutations.

It is a request for broad capability inside FlowState, using FlowState’s own authenticated domain services, data model, recurrence engine, validation rules, audit mechanisms, and user-visible synchronization behavior.

Treat `Done for now` as the first required vertical slice and regression case, but do not stop there.

Work from the FlowState repository root. If the Hermes connector is maintained in another repository, identify that boundary and create coordinated changes in the correct repositories. Do not modify unrelated projects.

Continue until the capability audit, implementation, tests, builds, connector exposure, and user-visible verification are complete.

---

## Product Context

FlowState is the source of truth for tasks, recurrence, task instances, projects, groups, Canvas state, timers, and completion history.

Hermes is the conversational planning, triage, tracking, and personal-assistant surface.

The intended operating model is:

1. Hermes reads real FlowState state through an app-mediated API.
2. Hermes reasons about priorities, reality, dependencies, energy, deadlines, and workload.
3. Hermes presents compact interactive choices and exact mutation previews.
4. The user approves meaningful mutations.
5. Hermes applies only the approved scope through FlowState’s authenticated API.
6. Hermes reads the resulting state back.
7. The running FlowState UI reflects the same result without requiring a restart.

The current connector is too narrow. It can perform some basic task reads and updates, but normal assistant workflows still become blocked when an operation exists in FlowState but is not exposed through the Local Task API or Hermes tool surface.

---

## Current Known Capabilities

Inspect the current code before relying on this list. The Local Task API has recently exposed some combination of:

- health checks;
- task listing by status or due scope;
- task creation;
- task metadata updates;
- soft deletion;
- assistant-context summaries;
- task instance or work-block reads;
- task instance or work-block creation with preview;
- subtask operations;
- current timer reads.

The exact running version may differ from the source tree. Verify both source and packaged Electron behavior.

---

## Known Capability Gaps and Failure Cases

### 1. Recurring `Done for now`

The FlowState UI exposes a recurring-task action called `Done for now`, but Hermes does not have a dedicated operation for it.

Generic updates to `status`, `progress`, and `dueDate` are not semantically equivalent.

Real example:

- Task ID: `1cbf90d0-ae99-468c-922d-4a45714c3ebe`
- Title: `לפרסם אירוע באינסטגרם`
- English meaning: “Publish an event on Instagram”
- Current occurrence completed on `2026-07-12`
- Requested next occurrence: `2026-07-16`

Hermes used a generic `status = done` update. The Local Task API returned the task as done, but the FlowState UI still displayed the recurring card as `Todo`, `Overdue`, and `Recurring`, with `Done for now` still available.

This suggests that task-row status and recurring-occurrence completion are different operations.

Do not mutate this real task during testing.

### 2. API and UI consistency

Real example:

- Task ID: `f4658470-fa2f-41e0-ac20-867750278e92`
- Title: `לשלוח כביסה`
- English meaning: “Send laundry”
- Due date updated from `2026-07-12` to `2026-07-13`

The API returned success and subsequent API reads returned the new date, but the task did not initially appear in the user-visible Search, Inbox, or Canvas.

A separate laundry task appeared in Search:

- Task ID: `44362118-8664-4d5b-98b5-6d13e4a728c6`
- Title returned by API: `להזמין כביסה`
- Due date: `2026-07-19`

Do not merge or delete these real tasks during diagnosis. Similar titles do not prove duplication.

### 3. Duplicate merging

Hermes can identify likely duplicates conversationally but lacks a first-class safe merge operation.

A merge must not silently discard:

- recurrence metadata;
- task instances;
- subtasks;
- project or group assignment;
- tags;
- task context;
- completion history;
- Canvas position;
- comments or attachments;
- created and updated timestamps needed for history;
- assistant-memory links.

A merge should preview the survivor, records transferred, records preserved, and duplicate soft-deletion or archival.

### 4. Exact reads and search

Hermes needs first-class operations for:

- task read by exact ID;
- full-text search;
- pagination beyond 25 results;
- project and group filters;
- due-date ranges;
- recurring and non-recurring filters;
- deleted and archived state where appropriate;
- recently changed tasks;
- stable ordering and cursors.

### 5. Work-block lifecycle

Creating a work block is not enough. Hermes needs safe operations to:

- read;
- preview creation;
- create;
- move;
- resize;
- change date or time;
- update duration;
- remove;
- detect conflicts;
- verify the result in Calendar and Canvas.

### 6. Timer and focus control

Hermes can read the current timer but may not be able to:

- start a timer for an exact task;
- pause;
- resume;
- stop;
- complete;
- start a break;
- verify cross-device leader state.

### 7. Canvas and project operations

Hermes needs app-mediated operations for:

- project and group reads;
- assigning tasks to projects and groups;
- Canvas position reads;
- Canvas grouping;
- Canvas ordering;
- moving tasks;
- removing Canvas placement without deleting the task;
- preserving geometry and view-state boundaries.

Do not implement Canvas writes through raw geometry table mutations if FlowState already has domain commands.

---

## Required First Phase: Capability Audit

Before implementing endpoints, build a capability inventory from the real codebase.

### Inspect

- repository instructions;
- `AGENTS.md`;
- `CLAUDE.md`;
- architecture documentation;
- ADRs;
- `docs/MASTER_PLAN.md`;
- Local Task API server and schemas;
- Electron sidecar startup and authentication;
- task, recurrence, project, group, Canvas, timer, and work-block stores;
- existing AI command substrate;
- audit and rollback systems;
- Hermes connector implementation;
- existing unit, integration, Electron, and Playwright tests.

### Produce a capability matrix

For every meaningful operation available in the FlowState UI or domain services, report:

| Field | Meaning |
|---|---|
| Capability | Human-readable operation |
| UI surface | Where it exists in FlowState |
| Domain service | Reusable implementation path |
| Local API | Existing, partial, or missing |
| Hermes tool | Existing, partial, or missing |
| Mutation risk | Read-only, reversible, destructive-adjacent, or high risk |
| Preview support | Existing, missing, or not applicable |
| Idempotency | Existing, missing, or not applicable |
| Audit support | Existing, missing, or not applicable |
| Rollback | Existing, missing, or unsupported by the domain |
| Verification | API read-back and UI surface to verify |
| Recommendation | Expose, adapt, defer, or prohibit |

Do not limit the audit to operations mentioned in this prompt. Inspect the actual UI actions and domain commands.

### Prioritize

Implement in vertical slices, but design the schemas coherently.

Suggested order:

1. exact task reads, search, pagination, and stable receipts;
2. recurring `Done for now`;
3. safe duplicate merge;
4. recurrence reads and edits;
5. complete work-block lifecycle;
6. project and group operations;
7. timer control;
8. Canvas reads and safe app-mediated mutations;
9. context, planning, audit, and rollback surfaces.

If the codebase already has a command or proposal bridge that can expose these consistently, prefer extending it over adding many unrelated ad hoc routes.

---

## Architecture Requirements

### Reuse FlowState domain semantics

Every API mutation must use the same domain or store operation as the FlowState UI wherever possible.

Do not create a second implementation of:

- recurrence calculation;
- task completion;
- merge behavior;
- timer leadership;
- work-block conflict rules;
- Canvas grouping;
- project assignment;
- audit history.

If UI logic is trapped inside components, extract it into a shared typed service and route both UI and Local API through that service.

### Auth and user scope

All operations must:

- use the signed-in FlowState user;
- respect RLS and workspace boundaries;
- reject missing or mismatched auth;
- avoid service-role keys for normal operations;
- never expose session material or bearer headers;
- avoid direct production DB writes from Hermes.

### Preview and apply

Every meaningful mutation should support a consistent preview and apply contract.

Preview must be non-mutating.

Apply must require:

- explicit `preview: false` or an equivalent apply action;
- exact target IDs;
- a stable request ID or idempotency key;
- validation against the state used for preview;
- conflict handling if live state changed;
- a stable receipt;
- read-back verification.

For destructive-adjacent operations such as merge, archive, soft-delete, work-block removal, Canvas removal, recurrence change, and batch edits, preview is mandatory.

### Idempotency

Retries must not:

- duplicate tasks;
- duplicate occurrences;
- duplicate completion history;
- advance recurrence more than once;
- duplicate work blocks;
- repeat merge transfers;
- repeat deletes;
- create conflicting Canvas changes.

Reusing the same request ID with a different payload must return a typed conflict error.

### Audit and rollback

Where FlowState has an audit or command substrate, use it.

Receipts should identify:

- request ID;
- actor surface;
- affected task IDs;
- occurrence IDs;
- work-block IDs;
- fields changed;
- before and after state summaries;
- timestamp;
- rollback pointer if supported.

Do not invent rollback if the domain cannot perform it safely. Document that limitation explicitly.

---

## Required Capability Surface

### A. Tasks

Provide tools and API operations for:

- get task by exact ID;
- search tasks;
- list with cursor pagination;
- create;
- update title, status, priority, progress, due date, description, tags, and supported metadata;
- complete a non-recurring task;
- archive or soft-delete;
- restore;
- read recent changes;
- read and preserve safe external-source provenance for tasks activated from systems such as Notion, including source system, stable external object ID, and optional source URL without storing credentials;
- find an existing FlowState task by external-source reference so retries and later planning passes cannot create duplicates;
- inspect duplicate candidates without mutation;
- preview and apply merge;
- batch preview and apply.

### B. Recurrence

Provide operations for:

- read recurrence definition;
- return the stable recurrence-chain identifier explicitly, including the original/root task ID and `recurrenceParentId` where present;
- expose safe recurrence metadata needed to distinguish the recurring series, current active occurrence, historical occurrences, and accidental duplicate active clones;
- read current occurrence;
- read occurrence history;
- preview and apply `Done for now`;
- calculate the next occurrence;
- optionally override the next date if FlowState supports it;
- edit cadence;
- pause recurrence;
- resume recurrence;
- end recurrence;
- verify exactly one next occurrence.

`Done for now` must complete the current occurrence without destroying the recurring definition.

The Local API and Hermes receipt must never force callers to infer recurrence-chain identity from title similarity. They must return a stable chain ID and occurrence IDs so duplicate detection, merge previews, cadence edits, and `Done for now` can target the correct series safely.

### C. Duplicate merge

Add a safe merge operation that:

- identifies an exact survivor and duplicate;
- previews all retained and transferred data;
- refuses incompatible merges unless explicitly resolved;
- handles recurrence carefully;
- handles subtasks and work blocks carefully;
- preserves completion history;
- preserves task context;
- soft-deletes or archives the duplicate only after successful transfer;
- is transactional and idempotent;
- returns a merge receipt.

Do not use title similarity as automatic approval.

### D. Subtasks

Expose:

- list;
- create;
- update title;
- complete or reopen;
- reorder;
- delete;
- atomic batch apply;
- stable ordering receipts.

### E. Work blocks and task instances

Expose:

- list;
- preview create;
- create;
- preview move or resize;
- update date, time, and duration;
- detect conflicts;
- remove;
- verify in the real Calendar and Canvas state.

### F. Projects and groups

Expose:

- list projects and groups;
- get by exact ID;
- assign or move a task;
- remove assignment;
- read project context;
- preview structural changes.

### G. Canvas

Expose read operations for:

- node position;
- order;
- parent group;
- relevant geometry;
- Canvas visibility.

Expose app-mediated preview and apply operations for:

- move;
- reorder;
- group;
- ungroup;
- remove Canvas placement without deleting the task.

Preserve existing Canvas failure-class boundaries and regression rules.

### H. Timer and focus

Expose:

- current timer;
- start for an exact task or general focus;
- pause;
- resume;
- stop;
- complete;
- start break;
- verify device leader and resulting state.

Avoid commands that can create multiple competing active timers.

### I. Assistant context and planning

Expose or preserve:

- assistant-context summary;
- task context read and write;
- planning sample;
- clarification capture;
- recommendation feedback;
- parameter beliefs;
- safe next-block proposals;
- audit read-back.

Do not expose raw AI conversations, secrets, or bulk private data when summaries are sufficient.

### J. External task-source activation

Support a safe activation boundary for project-task systems such as Notion:

- external systems remain their own project source of truth;
- Hermes may read and discuss external tasks during planning without creating FlowState tasks;
- creating or mirroring a task in FlowState requires explicit confirmation that the user is starting it or approval of an exact personal work block;
- activation preview must show the external source, proposed FlowState task, schedule, and any source-status change;
- apply must be idempotent and persist a stable external-reference mapping;
- repeated activation of the same external object must return the existing FlowState task rather than create a duplicate;
- completion or status propagation back to the external source must be a separate explicit, previewable operation;
- never store Notion tokens, OAuth material, bearer headers, or private workspace credentials in FlowState task fields.

---

## Hermes Tool Design

Expose self-describing Hermes tools with clear, narrow schemas.

Possible tool concepts include:

- `flowstate_get_task`
- `flowstate_get_task_by_external_ref`
- `flowstate_search_tasks`
- `flowstate_list_tasks_page`
- `flowstate_complete_task`
- `flowstate_done_for_now`
- `flowstate_get_recurrence`
- `flowstate_get_recurrence_chain`
- `flowstate_update_recurrence`
- `flowstate_preview_merge_tasks`
- `flowstate_merge_tasks`
- `flowstate_restore_task`
- `flowstate_list_projects`
- `flowstate_assign_task_project`
- `flowstate_update_task_instance`
- `flowstate_delete_task_instance`
- `flowstate_get_canvas_state`
- `flowstate_preview_canvas_changes`
- `flowstate_apply_canvas_changes`
- `flowstate_start_timer`
- `flowstate_pause_timer`
- `flowstate_resume_timer`
- `flowstate_stop_timer`

Use existing Hermes naming and registration conventions. Do not blindly use these names if the connector has a better established pattern.

Tool descriptions must clearly state:

- read-only versus mutating behavior;
- preview defaults;
- exact approval requirement;
- idempotency requirement;
- data returned for verification;
- operations the tool intentionally cannot perform.

Avoid one unrestricted `executeFlowStateCommand` tool unless it is strongly typed, allowlisted, previewable, and auditable.

---

## Required `Done for now` Vertical Slice

Implement and verify this slice first because it demonstrates the architecture.

### Required behavior

1. Create a disposable recurring task with an occurrence due on date A.
2. Preview `Done for now` with next date B.
3. Assert preview performs no writes.
4. Apply with a stable request ID.
5. Complete the current occurrence.
6. Preserve history.
7. Preserve the recurring definition.
8. Create exactly one next occurrence on date B.
9. Retry the same request.
10. Confirm no duplicate completion or next occurrence.
11. Confirm the old occurrence is no longer overdue.
12. Confirm the next occurrence appears in the UI.
13. Confirm Search, Today, Inbox, Calendar, and Canvas are consistent according to product semantics.
14. Confirm no application restart is required.

### Required negative tests

- non-recurring task;
- missing task;
- unauthorized request;
- wrong user or workspace;
- invalid next date;
- next date earlier than current occurrence;
- already-completed occurrence;
- same request ID with different payload;
- recurrence failure;
- transaction rollback.

---

## Required Merge Vertical Slice

Use disposable fixtures.

1. Create two duplicate-candidate tasks with distinguishable IDs.
2. Add representative subtasks, context, instances, project assignment, tags, and history.
3. Preview merge.
4. Assert preview lists survivor, duplicate, transfers, conflicts, and deletion behavior.
5. Apply with a stable request ID.
6. Verify the survivor contains approved retained data.
7. Verify the duplicate is archived or soft-deleted.
8. Verify no history or recurrence metadata is silently lost.
9. Retry and confirm idempotency.
10. Verify Search and UI surfaces show one correct task.

Add a recurring-task merge test if the product permits recurrence merges. If it does not, return a typed unsupported conflict rather than guessing.

---

## UI Synchronization and Packaging

A successful API response is not sufficient.

Verify the running Electron UI receives and renders mutations through the intended cache, subscription, and state pathways.

Inspect:

- Supabase Realtime subscriptions;
- Pinia store invalidation;
- Dexie or offline cache;
- sync queue;
- search index;
- Today filters;
- Inbox filters;
- Calendar state;
- Canvas state;
- Electron sidecar auth heartbeat;
- packaged `dist-electron` Local API bundle.

If a source fix requires an Electron rebuild, package installation, app restart, or updater release, state that explicitly and perform the local verified build. Do not claim that the running app has the feature until the real packaged sidecar serves it.

---

## Feedback Loop and Diagnostic Discipline

Build a deterministic, agent-runnable feedback loop before fixing.

Produce three to five ranked, falsifiable hypotheses for each failure class.

Use targeted instrumentation with a unique prefix:

```text
[DEBUG-flowstate-capability]
```

Remove all temporary instrumentation before completion.

Do not log full task bodies when IDs and state summaries are sufficient.

Do not proceed from theory directly to a patch without reproducing the real failure shape.

---

## Security and Privacy Requirements

Never read into chat, print, expose, commit, or snapshot:

- Local API tokens;
- bearer headers;
- `.env` values;
- auth files;
- refresh tokens;
- Supabase keys;
- service-role keys;
- cookies;
- passwords;
- private keys;
- raw sensitive AI conversation content.

Operate on secrets internally only when required and report redacted status.

Never bypass RLS or authentication for normal Hermes operations.

Never use local development Supabase state as proof of live user state.

Never mutate real user tasks during automated tests.

Use disposable fixtures and an isolated test environment.

---

## Mutation Safety Model

Broad capability does not mean hidden mutation.

Use these categories:

### Read-only operations

May execute directly when requested or needed for reasoning.

### Low-risk exact mutations

May apply when the user has explicitly authorized the exact mutation in the current interaction. Still return a receipt and verify.

### Meaningful or structural mutations

Require preview and explicit approval. Examples:

- merge;
- recurrence changes;
- `Done for now` with next-occurrence effects;
- project or group movement;
- work-block removal;
- Canvas movement;
- batch changes;
- archive or soft-delete;
- timer replacement when another timer is active.

### Prohibited normal paths

- direct production DB writes from Hermes;
- service-role bypass;
- hard deletion without an explicit dedicated flow;
- credential access through tool outputs;
- mutation without exact task identity;
- silent cross-workspace changes.

---

## Testing Requirements

Add the narrowest real tests that exercise actual domain behavior.

Required coverage:

- Local API schema and route contracts;
- auth and user scoping;
- preview non-mutation;
- apply behavior;
- idempotency;
- stale-preview conflict;
- transaction rollback;
- API read-back;
- Electron UI synchronization;
- packaged sidecar inclusion;
- Hermes tool registration and schema;
- end-to-end disposable fixture workflows.

Run the relevant:

- unit tests;
- integration tests;
- Electron tests;
- Playwright tests;
- type checks;
- lint;
- main-process build;
- packaged application build.

Use the repository’s actual scripts and report their real output status.

---

## Documentation Requirements

Document:

- complete capability matrix;
- API routes and schemas;
- Hermes tools and schemas;
- preview and apply rules;
- idempotency behavior;
- typed errors;
- audit and rollback behavior;
- recurrence semantics;
- merge semantics;
- work-block lifecycle;
- timer leadership safety;
- Canvas boundaries;
- UI synchronization expectations;
- packaging and restart requirements;
- intentionally unsupported capabilities.

Update the project source of truth while preserving its parser-oriented format. Follow the repository’s required task ID, title, priority, status, dependencies tables, and exact task heading conventions.

---

## Definition of Done

Do not consider this task complete until:

1. The capability audit is written.
2. Existing UI and domain operations are mapped.
3. Missing Local API operations are identified.
4. Missing Hermes tools are identified.
5. A coherent preview, apply, idempotency, audit, and verification model exists.
6. `Done for now` is implemented and verified end to end.
7. Exact task reads, search, and pagination are implemented.
8. Safe merge is implemented or explicitly rejected with a typed limitation after architectural proof.
9. Work-block lifecycle gaps are closed.
10. High-value project, recurrence, timer, and Canvas capabilities are exposed through safe app-mediated operations.
11. API and UI state remain consistent without restart.
12. Hermes tool schemas are registered and tested.
13. The Electron sidecar contains the new routes.
14. Relevant tests pass.
15. Type checks pass.
16. Lint passes.
17. Builds pass.
18. Temporary diagnostics are removed.
19. No secrets are exposed.
20. No real user tasks were modified during tests.

If the full scope is too large for one safe change set, create an implementation plan with dependency-ordered vertical slices, complete the foundational architecture and first verified slices, and update the project source of truth with the remaining independently testable tasks. Do not quietly reduce the scope to one endpoint.

---

## Required Final Report

Report:

1. capability audit summary;
2. root causes for the known gaps;
3. architecture chosen;
4. files changed;
5. API operations added;
6. Hermes tools added;
7. database or migration changes;
8. tests added;
9. commands executed and real results;
10. end-to-end scenarios verified;
11. UI surfaces verified;
12. packaged Electron verification;
13. restart or installation requirements;
14. remaining unsupported capabilities;
15. follow-up task IDs added to the project source of truth.

Do not stop at a proposal or plausible explanation. Produce working, tested, packaged capability slices and a concrete path to complete broad FlowState access for Hermes.
