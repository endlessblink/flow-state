/**
 * =============================================================================
 * ADR: CANVAS OVERDUE COLLECTOR - AUTO-MOVE PERMANENTLY DISABLED (TASK-255)
 * =============================================================================
 *
 * STATUS: The auto-move/auto-reparenting functionality is permanently disabled.
 *         Only metadata-only helpers remain active.
 *
 * WHAT THE AUTO-MOVE DID:
 * - Automatically created "Overdue" groups
 * - Moved tasks into groups based on dueDate (auto-reparenting)
 * - Modified task.canvasPosition without user interaction
 *
 * WHY AUTO-MOVE WAS DISABLED:
 * - Violated TASK-255 Geometry Invariants (only drag handlers may change positions)
 * - Caused position drift and sync cascades
 * - Tasks would "jump" unexpectedly when dates changed
 * - Smart Groups changing geometry conflicted with sync architecture
 *
 * GEOMETRY INVARIANT RULES (SOP-002):
 * - Only user-initiated drag operations may change:
 *   - task.parentId
 *   - task.canvasPosition
 *   - group.parentGroupId
 *   - group.position
 * - Smart Groups may ONLY change METADATA (dueDate, status, priority, tags)
 * - Sync operations are READ-ONLY projections
 *
 * WHAT REMAINS ACTIVE:
 * - getNextDayOfWeek() helper for date calculations (metadata-only)
 * - Count badges via aggregatedTaskCountByGroupId (read-only computed)
 *
 * ALTERNATIVE APPROACHES (if needed):
 * - Use smart views/filters to show overdue tasks differently
 * - Require explicit user action to move tasks between groups
 * - Use metadata (dueDate) changes, not visual/position changes
 *
 * HISTORY:
 * - Original as useCanvasSmartGroups.ts
 * - Renamed to useCanvasOverdueCollector.ts
 * - Auto-move disabled via ENABLE_SMART_GROUP_REPARENTING flag: TASK-255
 * - Auto-move code removed: January 2026
 *
 * See: docs/sop/SOP-002-canvas-geometry-invariants.md
 * =============================================================================
 */

import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Overdue Collector - Metadata-Only Version
 *
 * The auto-move functionality has been permanently removed.
 * Only helper functions for metadata/date calculations remain.
 */
export function useCanvasOverdueCollector() {
    // Stores are kept for potential future metadata-only operations
    const _taskStore = useTaskStore()
    const _canvasStore = useCanvasStore()

    /**
     * DISABLED: Previously collected overdue tasks into a group.
     *
     * This function is now a no-op stub. Automatic geometry changes
     * (moving tasks, changing positions) are forbidden by TASK-255.
     *
     * Count badges for overdue tasks are handled via read-only computed
     * properties in the canvas store, not by this function.
     */
    const autoCollectOverdueTasks = async () => {
        // ADR: Automatic geometry changes are forbidden
        // Smart-Groups display count badges via computed properties (read-only)
        // but must NEVER move tasks or modify positions
        console.debug('ℹ️ [SMART-GROUP] autoCollectOverdueTasks is permanently disabled (TASK-255 geometry invariants)')
        return
    }

    /**
     * DISABLED: Previously auto-created Friday/Saturday groups.
     *
     * This function is now a no-op stub. Automatic group creation
     * caused groups to reappear after deletion (BUG-061).
     * Users should create groups manually via context menu.
     */
    const ensureActionGroups = async () => {
        // ADR: Auto-creation of groups is disabled
        // Users create groups manually via canvas context menu
        return
    }

    /**
     * METADATA-ONLY: Calculate the next occurrence of a day of week.
     *
     * This is a pure calculation helper that does NOT modify any geometry.
     * It can be used for metadata operations like setting dueDate.
     *
     * @param date - Starting date
     * @param dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday
     * @returns Next date that falls on the specified day of week
     */
    const getNextDayOfWeek = (date: Date, dayOfWeek: number): Date => {
        const resultDate = new Date(date.getTime())
        resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7)
        return resultDate
    }

    return {
        autoCollectOverdueTasks,
        ensureActionGroups,
        getNextDayOfWeek
    }
}
