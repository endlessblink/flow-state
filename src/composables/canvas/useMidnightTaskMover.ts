/**
 * =============================================================================
 * ADR: MIDNIGHT TASK MOVER - PERMANENTLY DISABLED (TASK-255)
 * =============================================================================
 *
 * STATUS: QUARANTINED - This feature is permanently disabled.
 *
 * WHAT IT DID:
 * - Automatically moved tasks from "Today" group to "Overdue" group at midnight
 * - Modified task.canvasPosition without user interaction
 *
 * WHY IT WAS DISABLED:
 * - Violated TASK-255 Geometry Invariants (only drag handlers may change positions)
 * - Caused position drift when combined with sync operations
 * - Tasks would "jump" unexpectedly after midnight
 * - Sync cascades triggered by automatic position changes
 *
 * GEOMETRY INVARIANT VIOLATION:
 * This feature changed `task.canvasPosition` automatically, which conflicts with
 * the core architectural decision that only user-initiated drag operations
 * should modify geometry fields (parentId, canvasPosition, parentGroupId, position).
 *
 * ALTERNATIVE APPROACHES (if needed):
 * - Use metadata changes (dueDate) instead of visual movement
 * - Implement via filters/smart views that show tasks differently
 * - Require explicit user action to move tasks between groups
 *
 * HISTORY:
 * - Original implementation: TASK-082
 * - Disabled via feature flag: TASK-255
 * - Permanently quarantined: January 2026
 *
 * DO NOT RE-ENABLE without:
 * 1. Full sync architecture review
 * 2. Explicit user confirmation/opt-in
 * 3. Position drift testing across all scenarios
 *
 * See: docs/sop/SOP-002-canvas-geometry-invariants.md
 * =============================================================================
 */

/**
 * QUARANTINED: This composable is a no-op stub.
 *
 * The original implementation automatically moved tasks between groups,
 * which violated geometry invariants and caused position drift.
 *
 * This stub exists only for API compatibility with any code that may
 * still reference useMidnightTaskMover. All methods return immediately
 * without performing any operations.
 */
export function useMidnightTaskMover(
    _canvasStore?: unknown,
    _taskStore?: unknown
) {
    /**
     * DISABLED: Previously moved tasks from "Today" to "Overdue" at midnight.
     *
     * This function now returns immediately without performing any operations.
     * Automatic geometry changes are forbidden by TASK-255.
     */
    const moveTodayTasksToOverdue = async () => {
        // ADR: Automatic geometry changes are forbidden
        // See header comment for full explanation
        return { movedCount: 0, reason: 'permanently-disabled' as const }
    }

    return {
        moveTodayTasksToOverdue
    }
}
