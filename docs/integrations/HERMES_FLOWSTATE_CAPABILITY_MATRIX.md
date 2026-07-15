# Hermes ↔ FlowState safe capability matrix

Audit date: 2026-07-13. FlowState is the data/domain authority. Hermes is a
separate repository (`devops/hermes/hermes-agent-capabilities`) and calls only
the signed-in, loopback Local Task API; it never writes Supabase directly.

Legend: **live** = implemented at both boundaries, **partial** = a narrower safe
subset exists, **missing** = domain/UI capability exists but is not exposed,
**prohibit** = intentionally not exposed.

| Capability | UI/domain path | Local API | Hermes | Risk / preview / retry | Verification and recommendation |
|---|---|---|---|---|---|
| Health | Electron sidecar lifecycle | live | live | read-only | Sidecar health; keep |
| Assistant context summary | AI memory/context queries | live | live | read-only, aggregate only | Read-back only; keep summaries rather than raw chats |
| Complete open-task inventory | scoped task query layer | live, stable keyset pages with typed complete/fresh receipt | live | read-only | Exact total is valid only when the live receipt is both fresh and complete |
| List done/due tasks | task query layer | live, 25 cap | live | read-only | Search/Today/Inbox comparison; retain as a bounded filter, not an inventory count |
| Search title/description | global task identity lookup | live | live | read-only | Exact IDs returned; add cursor/project filters |
| Get exact task | task mapper/query | live | live | read-only | Returns recurrence, subtasks, blocks, Canvas placement; use before/after writes |
| Create task | `flowstate_task_lifecycle_v1` via `POST /api/tasks` | live (canonical preview/apply) | pending H4 connector migration | reversible; stable operation/task identity; exact approval binding | Receipt proves revision/change/read-back; renderer reload |
| Update basic task metadata | `taskOperations.updateTask` | partial | partial | meaningful mutation; canonical approval contract in Hermes, generic API remains unsafe for recurrence | Search/Board/Today; do not use for recurring completion |
| Complete non-recurring task | `flowstate_complete_task_v1` via `POST /api/tasks/:id/complete` | live (dedicated preview/apply) | live (dedicated preview/apply) | reversible; exact ID + approval digest; recurring tasks rejected (`recurring_task`) | Receipt read-back proves `status`/`completedAt`; Board/Today |
| Soft delete | `flowstate_task_lifecycle_v1` via `POST /api/tasks/:id/delete` | live (canonical preview/apply) | pending H4 connector migration | destructive-adjacent; stable operation + exact revision/approval | Receipt proves deleted row and tombstone symmetry |
| Restore / permanent delete | `POST /api/tasks/:id/restore`; permanent delete intentionally absent | restore live / permanent delete missing | pending H4 connector migration / missing | restore is revision-bound; permanent delete requires explicit typed confirmation | Receipt proves active row and cleared tombstone; keep permanent delete deferred |
| Reopen completed non-recurring task | `POST /api/tasks/:id/reopen` | live (canonical preview/apply) | pending H4 connector migration | reversible; recurring identity rejected | Receipt proves todo state and cleared completion timestamp |
| Recurrence definition/current chain | task recurrence fields | live through exact read | live through exact read | read-only | Stable `parentId`/count/current task; keep |
| Occurrence history | completion-record task rows | partial through search/list | partial | read-only | Add dedicated chain-history endpoint |
| Done for now | shared `done_for_now_task` transaction | live | live | preview-first; state-bound apply; durable idempotency receipt | History + next occurrence + Search/Today/Inbox/Canvas + live renderer reload |
| Edit/pause/resume/end recurrence | renderer task update + recurrence UI | missing | missing | structural; preview/idempotency missing | Extract transactional recurrence commands before exposing |
| Duplicate candidate inspection | search/exact reads | partial | partial | read-only; no title-based approval | Add explicit candidate endpoint |
| Merge exact duplicate | shared `merge_tasks` transaction | live | live | preview-first; state-bound apply; durable idempotency receipt; conservative typed conflicts | Search/Board/Today/Inbox/Canvas reload to one survivor; recurring/AI-graph/group merges intentionally unsupported |
| List subtasks | embedded task array | live | live | read-only | Exact task read/list endpoint |
| Create/update/complete/reorder/delete subtask | task embedded-array operations | live, preview-first | live | apply uses stable request ID; task-row update atomic | Renderer reload; durable receipt table still recommended |
| Atomic subtask batch | command-style array transform | live | live | preview-first; one task-row write | Read-back list; keep 50-op cap |
| List work blocks | task `instances` | live | live | read-only | Calendar/Canvas |
| Create work block | `createTaskInstance` | live | live | preview-first; apply lacks durable request receipt | Calendar/Canvas; add idempotent apply |
| Move/resize/remove work block | Calendar undo-aware instance commands | missing | missing | reversible structural; preview/receipt missing | Extract instance command service, then expose |
| Conflict detection | Calendar/task instances | missing | missing | read-only preview | Add before block mutation |
| List/get projects | project store/database | missing | missing | read-only | Expose next; needed for safe assignment |
| Assign/remove project | `moveTaskToProject` + undo | partial through generic `projectId` only | partial | meaningful mutation; no preview | Replace with explicit validated project command |
| List/get Canvas groups | canvas group store | missing | missing | read-only | Expose IDs/context before any geometry writes |
| Canvas position/group/order reads | task position + group rows | partial through exact task | partial | read-only | Add group-aware read endpoint |
| Canvas move/group/ungroup/remove placement | Canvas interaction + undo command substrate | missing | missing | geometry-sensitive; must preview/apply through renderer authority | Do not expose raw geometry writes |
| Current timer + diagnostics | timer store/local snapshot | live | live | read-only | Electron/KDE leader state |
| Start/pause/resume/stop/complete/break | timer store and AI action-command substrate | Local API control exists only for signed-in internal callers | missing | stateful/cross-device; selected apply + leader checks required | Add narrow Hermes tools after receipt/read-back contract |
| Task context/planning memory | task contexts + AI command substrate | aggregate only | aggregate only | private data; raw bulk reads prohibited | Expose exact task context only when needed |
| Clarification capture/recommendation feedback | AI action-command substrate | internal clarification routes | missing | approval and audit required | Adapt existing command substrate, not direct writes |
| External-source activation | no stable external-reference domain mapping | missing | missing | structural + external side effect | Design separate idempotent activation mapping; prohibit token storage |
| Credentials/raw auth/direct DB | none | prohibit | prohibit | high risk | Never expose |

## Synchronization boundary

Token-mode Electron forwards the current Supabase session to the sidecar. Every
task query is additionally constrained to the session user. Successful Local API
task writes send only `{ operation, taskId }` through utility process → Electron
main → preload → renderer; the renderer invalidates task cache and reloads the
active workspace. Realtime remains useful, but is no longer the only convergence
mechanism.

## Priority order after Done for now

1. Work-block move/resize/remove plus conflict preview and durable receipts.
2. Project/group reads and explicit assignment commands.
3. Timer controls with device-leader verification.
4. Recurrence edit/pause/resume/end commands.
5. Canvas structural commands through the existing undo/action-command domain.

Generic status/due-date updates remain deliberately insufficient for recurrence,
merge, work-block lifecycle, timer leadership, and Canvas geometry.
