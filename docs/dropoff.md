# Session Dropoff: Task Store & Persistence Repairs

## 📌 Context
Working on BUG-037 (Deleted tasks recreated) and resolving issues where task titles were not updating while descriptions were. Discovered several structural issues in `src/stores/tasks.ts`.

## 🛠️ Work Done
1.  **State Management & Scoping**:
    *   Moved `manualOperationInProgress` and `isLoadingFromDatabase` flags to the top of `useTaskStore`.
    *   Previously, `manualOperationInProgress` was declared on line 1046, which was *after* several functions that used it, potentially causing scoping issues in some environments or during refactors.
2.  **Consolidated Loading**:
    *   Removed redundant `loadTasksFromPouchDB` (which was the one actually getting called on initialization).
    *   Consolidated all loading logic into `loadFromDatabase` which includes the critical BUG-037 filtering logic.
    *   `initializeFromPouchDB` now calls `loadFromDatabase`.
3.  **Atomic Task Updates**:
    *   Refactored `updateTask` to merge updates against the *current* state in the array (`tasks.value[taskIndex]`) instead of a captured variable. This prevents race conditions where rapid updates might clobber each other.
4.  **Lint & Syntax Cleanup**:
    *   Fixed several minor lint errors and ensured proper typing in `tasks.ts`.

## 🔍 Pending Issues & Next Steps
1.  **Delayed UI Updates**:
    *   **User Report**: "only after refreshing the screen the task descriptions and names update".
    *   **Diagnosis**: This suggests that `saveTasksToStorage` is working (persistence is fine), but the local reactive state isn't triggering a re-render or is being blocked.
    *   **Hypothesis**: The `manualOperationInProgress` flag might be staying `true` longer than expected, or there's a conflict between the local `tasks.value` update and the sync mechanism.
2.  **Verification**:
    *   Need to verify if titles (subjects) now persist correctly.
    *   Check for any console errors during task edits.

## 🚀 Next Session Action Plan
- [ ] Debug the "update on refresh only" issue. Inspect `TaskEditModal.vue` and `updateTaskWithUndo`.
- [ ] Verify that `manualOperationInProgress` is correctly reset in all exit paths of undo/redo operations.
- [ ] Confirm task title persistence with a clean test.
