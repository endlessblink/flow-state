# Failure-Class Matrix

Use this when a FlowState issue keeps recurring, was described as already fixed, or appears under a broad symptom such as "KDE timer broken", "Electron lost sync", "subtasks still visible", or "canvas broke again".

Do not claim the broad symptom is fixed until the exact failure mode and uncovered modes are named.

## Required Closeout Fields

Copy this block into the relevant `docs/MASTER_PLAN.md` bug entry before marking a recurring issue done.

```md
**Failure-class matrix**:

| Class | Checked? | Evidence | Covered by this fix? |
| --- | --- | --- | --- |
| User repro shape |  |  |  |
| Data shape / persisted row shape |  |  |  |
| Renderer store/state |  |  |  |
| Electron main/preload bridge |  |  |  |
| Localhost sidecar endpoint |  |  |  |
| KDE polling/control path |  |  |  |
| Supabase persistence/realtime |  |  |  |
| Updater/runtime version |  |  |  |
| Stale live process/cache state |  |  |  |

**Exact failure mode fixed**:

**Explicitly not covered**:

**Regression added for reported repro**:

**Live boundary proof**:
```

## Enforcement Intent

The matrix is not paperwork. It prevents broad DONE labels after proving only one root cause. If a row is irrelevant, mark it `N/A` and explain why. If a row is not checked, do not use broad wording like "KDE timer fixed"; use a precise label such as "fixed: completion-at-zero path".

