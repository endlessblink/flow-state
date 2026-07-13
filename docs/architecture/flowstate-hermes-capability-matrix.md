# FlowState → Hermes capability matrix

Status date: 2026-07-14. FlowState source snapshot: `97a296bb` plus the
production-UUID and merge-safety hardening on
`feat/hermes-broad-capabilities-20260713`. Hermes source includes the exact task
read added in `102e39786`.

Hermes is maintained in a separate repository. Its integration boundary is the
bearer-protected FlowState Local Task API on `127.0.0.1:5577`; Hermes must not
call Supabase directly. The connector snapshot audited here registers exact
task read, bounded task search, task mutation, timer-read, task-instance,
Done-for-now, duplicate-merge, and subtask tools. Subtask tools remain "ahead":
they exist in Hermes but have no matching FlowState routes yet.

## Legend and safety contract

- **Local API/Hermes:** Yes, Partial, Missing, or Ahead.
- **Safety:** RO = read-only; REV = reversible; DA = destructive-adjacent;
  HIGH = structural or coordination-sensitive.
- **P/I:** preview/idempotency. `N/A` means a read needs neither.
- **Audit/RB:** durable audit/rollback. FlowState's task audit trigger records
  basic lifecycle events, while the renderer AI-command substrate has richer
  preview/diff/audit/local snapshots. Neither is a universal Local API receipt.
- A meaningful mutation is not considered safely exposed until preview, stable
  request identity, state-conflict detection, receipt read-back, and live UI
  reconciliation exist at the same user/workspace scope.

## A. Tasks

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Get exact task | Search/details; task store lookup + Supabase mapper | Yes: `GET /api/tasks/:id`, full task projection and workspace-member correct | Yes: `flowstate_get_task` | RO | N/A | N/A | API row; Search, Today, Inbox, Canvas | Implemented identity primitive; keep exact ID mandatory for writes. P0 |
| Search by title | Search modal/task filtering; signed-in RLS query | Yes: `GET /api/tasks/search?q=`, bounded, scoped, and completion-record-safe | Yes: `flowstate_search_tasks` | RO | N/A | N/A | Compact exact IDs; Search modal identity comparison | Implemented discovery primitive; never infer duplicates from title alone. P0 |
| List/filter tasks | Board, All Tasks, Today, Inbox; task filtering composables | Partial: status/due/25 max, no cursor, owner-only | Yes | RO | N/A | N/A | API list vs each UI filter | Add stable cursor, workspace scope, explicit completion-record exclusion. P0 |
| Create task | All creation surfaces; `taskOperations.createTask` | Partial: direct row insert, no preview/idempotency/workspace | Yes | REV | No/No | Basic CREATED trigger; no API rollback | Exact read + taskMutation reload | Route through shared command/receipt; add request ID. P1 |
| Update metadata | Details/board/inbox; `taskOperations.updateTask` | Partial: title/status/priority/due/progress only; direct row update | Yes | REV | No/No | Basic status audit only; UI undo not API | Exact read + taskMutation reload | Add description/tags/metadata using shared command and preview for material batches. P1 |
| Complete non-recurring | Task actions; `updateTask` completion semantics | Partial: generic patch sets status/progress but bypasses some renderer hooks | Yes | REV | No/No | STATUS_CHANGED only; no receipt | Exact read; Today/Inbox/Canvas | Extract shared completion command before calling this complete. P1 |
| Soft-delete/archive | Context menus/trash; `deleteTask`, `TrashService` | Partial: soft-delete, no preview/request ID | Yes | DA | No/No | SOFT_DELETED; UI undo/restore exists | Deleted read + Trash/UI removal | Require preview/receipt and expose restore. P1 |
| Restore | Trash; `TrashService.restoreTask` / DB restore | Missing | Missing | REV | Desirable/No | RESTORED; tombstone cleanup path | Exact read + Trash/Search | Expose app-mediated exact restore with receipt. P2 |
| Recent changes | Task history UI / `useTaskAuditLog`, `search_task_audit` RPC | Missing | Missing | RO | N/A | Source is the audit log | Audit rows + exact task | Expose sanitized, workspace-correct audit read. P3 |
| Duplicate candidates | Search/manual inspection; exact/search API supplies IDs but no classifier | Partial | Partial via exact/search tools | RO | N/A | None | Candidate IDs + human-reviewed reasons | Add read-only candidate evidence; never approve by title. P2 |
| Merge duplicate | Transactional `flowstate_merge_tasks` RPC with fail-closed compatibility checks | Yes: preview/apply + request receipt | Yes: `flowstate_merge_tasks` | HIGH | Yes/Yes | Immutable merge receipt; transaction rollback | Survivor active, duplicate archived, preserved history, taskMutation/UI reload | Implemented for compatible non-recurring tasks; keep structural conflicts typed and conservative. P0 |
| Batch update/delete | BatchEdit, multi-select, unified undo | Missing | Missing | DA/HIGH | Mandatory/Mandatory | Renderer undo snapshot only | Read every affected ID; all list surfaces | Adapt AI-command batch/undo concepts into durable command receipts. P2 |

## B. Recurrence

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Read definition/chain/current occurrence | Task details/context menu; task recurrence fields and instances | Partial via exact task; history/root chain not separately queryable | Partial through Done-for-now receipt only | RO | N/A | N/A | Exact task plus completion records | Add explicit chain ID, root ID, current occurrence and history endpoints. P1 |
| Calculate next date | Recurrence UI; pure `computeNextDueDate` | Yes inside Done-for-now preview only | Yes through preview | RO | N/A | Preview version | Preview response | Expose a read-only recurrence preview for cadence edits. P1 |
| Done for now | Context menu; shared service + transactional `flowstate_done_for_now` RPC | Yes, preview/apply, workspace/request receipt | Yes: `flowstate_done_for_now` | REV | Yes/Yes | Immutable receipt + completion row; transaction rollback on failure | Exact read, taskMutation authoritative reload; Search/Today/Inbox/Canvas | Implemented first vertical slice; keep generic recurring status completion blocked. P0 |
| Explicit next-date override | Done-for-now submenu/service | Yes with recurrence validation | Yes | REV | Yes/Yes | Same receipt | Receipt next occurrence + UI date | Keep only within RPC validation. P0 |
| Occurrence history | Calendar completion records | Missing dedicated read | Missing | RO | N/A | Completion rows exist | Calendar plus chain IDs | Add bounded chain-history read excluding private bulk fields. P1 |
| Edit cadence | Task recurrence editor; `updateTask(recurrenceRule)` | Missing | Missing | HIGH | Mandatory/Mandatory | Generic task audit is insufficient | Definition + regenerated previews/UI | Extract a shared transactional recurrence command. P2 |
| Pause/resume/end | End conditions and recurrence editor; no clear shared pause command | Missing | Missing | HIGH | Mandatory/Mandatory | Missing semantic receipt | Chain/current occurrence/UI | Define product semantics before exposure. P2 |
| Exactly-one active occurrence | DB partial unique index for `(parent,count)` | Enforced for populated live rows; completion clones need RPC discipline | Indirect | HIGH invariant | N/A/DB constraint | Done receipt | Chain read + DB assertion | Preserve constraint and add concurrency integration tests. P0 |

## C. Duplicate merge

| Capability | UI/domain | Local API | Hermes | Safety | P/I | Audit/RB | Verification | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Find likely duplicates | Similar-title search only; no domain classifier | Partial via exact/search endpoints | Partial via exact/search tools | RO | N/A | N/A | Return exact IDs, chain IDs and human-reviewed evidence | Add a bounded candidate-evidence read; title similarity alone is insufficient. P2 |
| Preview survivor/transfer plan | Transactional RPC preview over locked, scoped task state | Yes | Yes | HIGH | Yes/N/A | Preview version + proposed preserved counts | Full retained/transferred summary and typed conflict | Implemented for compatible non-recurring tasks. P0 |
| Apply merge | Transactional `flowstate_merge_tasks` RPC | Yes | Yes | HIGH | Yes/Yes | Immutable request receipt; full transaction rollback | Survivor read, duplicate archived, preserved history, live task reload | Implemented with exact IDs and approval-gated apply. P0 |
| Recurring task merge | No defined series/occurrence merge semantics | Rejected with typed conflict | Rejected | HIGH | N/A | No writes | Both task chains remain unchanged | Keep unsupported until product semantics are defined. P2 |
| Dependency-linked merge | Dependency graph requires graph-aware retargeting | Rejected with typed conflict | Rejected | HIGH | N/A | No writes | Dependency edges unchanged | Add a dedicated graph-preserving planner before exposure. P2 |
| AI-memory-linked merge | Context ownership/provenance requires memory-aware retargeting | Rejected with typed conflict | Rejected | HIGH | N/A | No writes | AI context rows unchanged | Keep fail-closed until privacy and provenance rules exist. P4 |
| Active timer / pending notification merge | Runtime and delivery ownership cannot be transferred safely in the current transaction | Rejected with typed conflict | Rejected | HIGH | N/A | No writes | Timer/notification state unchanged | Stop/settle explicitly, then preview again; never transfer active coordination state implicitly. P3 |

## D. Subtasks

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| List ordered subtasks | Task details; embedded `task.subtasks` | Missing | Ahead | RO | N/A | N/A | Exact parent read/details | Add workspace-scoped compact route. P1 |
| Create/update/complete/reopen/reorder | Task details; `createSubtask`, `updateSubtask` | Missing | Ahead | REV | Required for structural edits/Missing | Parent task audit lacks subtask detail; UI undo only | Parent exact read + taskMutation | Reuse a shared embedded-array transaction with preview/version/request ID. P1 |
| Delete | Task details; `deleteSubtask` | Missing | Ahead | DA | Mandatory/Missing | Missing semantic receipt | Parent exact read/details | Same atomic command; no blind array overwrite. P1 |
| Atomic batch | AI command batch concepts; no durable subtask transaction | Missing | Ahead | HIGH | Mandatory/Mandatory | Renderer-only batch audit/rollback | Stable ordering receipt + UI | Implement after single-subtask command. P2 |

## E. Work blocks and task instances

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| List | Calendar/task details; `getTaskInstances` | Yes, owner-only | Yes | RO | N/A | N/A | Calendar/task exact read | Make workspace-correct and expose stable block identity. P1 |
| Preview/create | Calendar scheduling; `createTaskInstance` replaces for non-recurring and appends for recurring | Partial: preview then blind append/random ID | Yes | REV | Yes/No | None | API read; Calendar/Canvas | Route through shared instance semantics; add request ID/conflict check. P1 |
| Move/resize/update | Calendar; `updateTaskInstance` | Missing | Missing | REV | Mandatory/Missing | UI undo only | Calendar + exact instance | Expose shared update with before/after version. P1 |
| Conflict detection | Calendar scheduling logic is distributed | Missing | Missing | RO/REV | Preview required | N/A | Conflict list and Calendar | Extract conflict service before mutation endpoint. P1 |
| Remove | Calendar; `deleteTaskInstance` | Missing | Missing | DA | Mandatory/Missing | UI undo only | Instance read absent + Calendar | Add preview/apply with receipt. P1 |

## F. Projects and groups

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| List/get projects | Sidebar/project views; `useProjectStore` | Missing | Missing | RO | N/A | N/A | Project store/sidebar | Add compact workspace-scoped reads first. P1 |
| List/get groups | Canvas; `useCanvasStore.groups` | Missing | Missing | RO | N/A | N/A | Canvas group state | Broker renderer-owned shape or shared DB mapper. P1 |
| Assign/remove task project | Task details; `updateTask(projectId)` | Patch does not support project ID | Missing | REV | Preview for structural move/No | Generic audit omits assignment | Exact task + project view | Add validated project existence/workspace command. P1 |
| Create/update project | Project store commands | Missing | Missing | REV | Preview/Idempotent request | Local undo/queue only | Project read + sidebar/realtime | Use renderer broker/shared project service. P2 |
| Delete project / rehome tasks | `deleteProject` has snapshot rollback | Missing | Missing | HIGH | Mandatory/Mandatory | UI snapshot rollback only | Project absence + every affected task | Do not expose raw deletes; broker the domain command with plan. P2 |
| Group structural changes | Canvas group commands | Missing | Missing | HIGH | Mandatory/Mandatory | AI command local audit can help | Canvas group/task parent state | Keep behind Canvas command broker. P3 |

## G. Canvas

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Read node geometry/order/parent/visibility | Canvas store + task/group positions | Missing | Missing | RO | N/A | N/A | Renderer Canvas state, not task discoverability | Add bounded renderer-broker read; distinguish task from work block. P2 |
| Move/reorder/group/ungroup | Canvas composables/store; `canvas.node.move` AI command | Missing | Missing | HIGH | AI preview exists/command-batch ID only | Renderer IndexedDB audit + snapshot rollback | Canvas geometry and independent-client realtime | Adapt AI command substrate through correlated renderer broker. P3 |
| Remove placement, keep task | `removeTaskNodesFromCanvas`/task update | Missing | Missing | DA | Mandatory/Missing | UI undo paths | Search still finds task; Canvas does not | Expose only app-mediated semantic command. P2 |
| Delete from Canvas | Multiple soft/permanent delete modes | Generic task delete only, semantics differ | Generic delete only | HIGH | Mandatory/Missing | Some UI undo/tombstone support | Trash/Search/Canvas | Prohibit Canvas deletion through generic delete. P3 |

## H. Timer and focus

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Current timer/diagnostics | Timer store + renderer snapshot bridge | Yes | Yes | RO | N/A | N/A | API snapshot, KDE, app timer | Keep; diagnostics remain secret-free. P0 |
| Start exact task/general/break | `timer.startTimer` owns leadership/session semantics | Partial raw `/api/timer/control` start bypasses store | Missing | HIGH | Preview/No | Timer history only | Device leader + app/KDE + DB | Replace raw control with renderer broker/shared command. P3 |
| Pause/resume | `pauseTimer`/`resumeTimer` | Partial `toggle` only; bypasses renderer | Missing | REV/HIGH | State preview/No | None | App/KDE/session row | Broker explicit pause/resume, reject stale expected state. P3 |
| Stop/complete | `stopTimer`/`completeSession` | Missing | Missing | HIGH | Preview/Idempotent session ID | Completion history hooks in store | App/KDE/history | Broker store semantics; never direct row patch. P3 |
| Single active leader invariant | Timer leadership/device heartbeat | Not guaranteed by raw start sequence | Missing | HIGH invariant | N/A | Session history | Two-device/KDE integration test | Do not broaden timer mutations until this passes. P3 |

## I. Assistant context and planning

| Capability | UI surface / reusable domain path | Local API | Hermes | Safety | P/I | Audit/RB | Verification and UI sync | Recommendation / priority |
|---|---|---:|---:|---:|---|---|---|---|
| Assistant summary | AI sidebar/morning/weekly planning data | Yes aggregate-only | Yes | RO | N/A | N/A | Summary counts vs bounded source reads | Preserve privacy boundary; add freshness/schema version. P1 |
| Task/project context read/write | AI memory database services | Summary counts only | Missing | RO/REV | Writes require preview/request ID | Memory snapshots exist in AI commands | Sanitized context + relevant planning UI | Expose bounded reads before writes. P3 |
| Planning sample / next block | Weekly plan/morning dashboard; Hermes planning artifacts | No dedicated FlowState API | Hermes artifact surface exists | RO/REV | Proposal preview exists in UI; apply varies | AI command audit local only | Tasks/blocks/timer read-back | Keep reasoning in Hermes; mutations use capability endpoints. P3 |
| Clarification capture | Local AI clarification start/resume endpoints | Yes | Not registered as FlowState tools | REV | Workflow state/Run ID | Clarification events | Assistant context/planning continuation | Expose only if Hermes needs shared FlowState memory. P4 |
| Recommendation feedback / beliefs | AI memory services and `memory.feedback.record` | Counts only | Missing | REV | AI command preview/command ID | AI memory snapshots | Sanitized memory reads | Defer until privacy, retention, and workspace rules are explicit. P4 |
| Audit read-back | `task_audit_log`; AI command audit store | Missing | Missing | RO | N/A | Source itself | Request/task timeline | Add sanitized durable receipt/audit endpoint. P3 |
| Rollback | AI command local snapshots; task/project undo paths | Missing | Missing | HIGH | Preview of rollback required/Idempotent | Local snapshots, not cross-device durable | Exact affected entities + live UI | Expose only rollback types with durable shared semantics. P4 |

## Cross-cutting gaps

1. **Workspace scope is inconsistent.** Exact task read, Done-for-now, task
   search, and merge carry the renderer's exact active workspace. Most older
   endpoints still apply `user_id = actor`, which hides collaborator-owned
   workspace rows and does not explicitly pin personal rows to
   `workspace_id IS NULL`.
2. **Most writes bypass renderer domain semantics.** Basic task, instance, and
   timer handlers update rows directly. Their `{ok:true}` does not prove store
   hooks, undo, timer leadership, Canvas semantics, or authoritative UI state.
3. **Receipts are exceptional.** Done-for-now and duplicate merge have preview
   versioning, idempotency, transactionality, and real identifiers. Other
   mutations do not.
4. **UI synchronization is task-only.** The sidecar emits task mutation notices;
   there are no equivalent project/group/instance/timer/Canvas notifications or
   correlated renderer command responses.
5. **Audit is fragmented.** The database task audit is lifecycle-oriented and
   its triggers do not populate all semantic/workspace detail. AI command audit
   and rollback snapshots live in the renderer's IndexedDB and are not a shared
   cross-device API ledger.
6. **Hermes can be ahead of FlowState.** Exact read, search, Done-for-now, and
   merge are aligned. The connector still declares subtask operations for routes
   absent from this FlowState snapshot. Capability health must report
   per-operation availability, not just `/api/health`.
7. **Search/Today/Inbox/Canvas are not the same projection.** Search should find
   living tasks without completion-history rows; Today is due/instance based;
   Inbox follows `is_in_inbox`; Canvas follows placement/group/work-block state.
   End-to-end tests must assert each projection separately.

## Phased delivery priorities

### P0 — implemented trustworthy identity and structural vertical slices

- Maintain exact workspace-scoped read/search, Done-for-now, and compatible
  duplicate merge across FlowState and Hermes.
- Keep production UUID compatibility covered by schema-realistic SQL tests.
- Keep preview/apply receipts, retry/conflict tests, and authoritative task
  reload as release gates.
- Add cursor pagination and workspace-correct filtering to list reads.
- Keep generic recurring `status=done` rejected.

### P1 — common planning primitives

- Complete work-block move/resize/remove through shared instance semantics;
  this is the next missing assistant workflow after Done-for-now and merge.
- Add project/group reads and validated task assignment.
- Add recurrence chain/current/history reads.
- Bring subtask routes and Hermes declarations into one versioned contract.
- Convert non-recurring completion/create/update to previewable receipt-backed
  commands where user approval matters.

### P2 — remaining structural task operations

- Add read-only duplicate-candidate evidence and define graph-aware merge
  semantics before relaxing recurrence/dependency conflicts.
- Add recurrence editing/pause/end semantics.
- Add restore, batch commands, Canvas read, and placement removal.

### P3 — renderer-owned coordinated state

- Implement a correlated sidecar → Electron main → eligible renderer command
  broker with request/response IDs, timeout, workspace epoch, and fail-closed
  renderer-unavailable behavior.
- Route Canvas, project-structure, and timer leadership operations through it.
- Expose sanitized audit/receipt read-back.

### P4 — memory and rollback governance

- Define privacy, retention, workspace, and redaction rules for task context,
  clarification, feedback, and parameter-belief writes.
- Make only genuinely durable rollback types available; explicitly report
  unsupported rollback elsewhere.

## Acceptance gates for every new mutation

1. Preview makes zero writes and names exact IDs/fields.
2. Apply requires explicit approval, the preview state/version, and request ID.
3. Same request/payload returns the same receipt; changed payload conflicts.
4. User and exact personal/workspace scope are checked inside the authoritative
   transaction or domain command.
5. Partial failure rolls back; no early `{ok:true}`.
6. Read-back returns real identifiers and the running UI updates without restart.
7. Search, Today, Inbox, Calendar, and Canvas assertions follow their distinct
   product rules rather than assuming one shared projection.
8. No bearer token, auth header, private bulk row, or raw conversation is logged
   or returned.
