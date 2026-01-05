/**
 * Group Mapper - Converts between CanvasGroup (app) and SqlGroup (database) formats
 *
 * This mapper handles ALL group/section fields to ensure zero data loss during
 * the PouchDB to PowerSync migration.
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

import type { CanvasGroup } from '../stores/canvas'
import type { SqlGroup } from '../services/database/SqlDatabaseTypes'
import { parseJsonColumn, stringifyForSql, jsBoolToSql, sqlBoolToJs } from '../services/database/SqlDatabaseTypes'

/**
 * Convert CanvasGroup (app model) to SqlGroup (database model)
 */
export function toSqlGroup(group: CanvasGroup): SqlGroup {
    const now = new Date().toISOString();

    return {
        id: group.id,

        // Core Identity
        name: group.name,
        type: group.type,
        color: group.color || '',

        // Geometry (JSON)
        position_json: stringifyForSql(group.position) || '{}',

        // Settings (JSON)
        filters_json: stringifyForSql(group.filters) || '{}',
        layout: group.layout || 'vertical',

        // State
        is_visible: jsBoolToSql(group.isVisible !== false), // Default to visible
        is_collapsed: jsBoolToSql(group.isCollapsed),
        collapsed_height: group.collapsedHeight || 0,

        // Hierarchy
        parent_group_id: group.parentGroupId || undefined,

        // Advanced Features (Power Groups)
        is_power_mode: jsBoolToSql((group as any).isPowerMode),
        power_keyword_json: stringifyForSql((group as any).powerKeyword) || undefined,
        assign_on_drop_json: stringifyForSql((group as any).assignOnDrop) || undefined,
        collect_filter_json: stringifyForSql((group as any).collectFilter) || undefined,
        auto_collect: jsBoolToSql((group as any).autoCollect),
        is_pinned: jsBoolToSql((group as any).isPinned),
        property_value: (group as any).propertyValue || undefined,

        // Timestamps
        created_at: (group as any).createdAt || now,
        updated_at: group.updatedAt || now,

        // Soft Delete
        is_deleted: jsBoolToSql((group as any).isDeleted)
    };
}

/**
 * Convert SqlGroup (database model) to CanvasGroup (app model)
 */
export function fromSqlGroup(sqlGroup: SqlGroup): CanvasGroup {
    // Parse JSON fields safely
    const position = parseJsonColumn(sqlGroup.position_json, { x: 0, y: 0, width: 400, height: 600 });
    const filters = parseJsonColumn(sqlGroup.filters_json, {});
    const powerKeyword = parseJsonColumn(sqlGroup.power_keyword_json, null);
    const assignOnDrop = parseJsonColumn(sqlGroup.assign_on_drop_json, null);
    const collectFilter = parseJsonColumn(sqlGroup.collect_filter_json, null);

    const group: CanvasGroup = {
        id: sqlGroup.id,

        // Core Identity
        name: sqlGroup.name,
        type: sqlGroup.type as CanvasGroup['type'],
        color: sqlGroup.color || '',

        // Geometry
        position,

        // Settings
        filters,
        layout: (sqlGroup.layout as CanvasGroup['layout']) || 'vertical',

        // State
        isVisible: sqlBoolToJs(sqlGroup.is_visible),
        isCollapsed: sqlBoolToJs(sqlGroup.is_collapsed),
        collapsedHeight: sqlGroup.collapsed_height || undefined,

        // Hierarchy
        parentGroupId: sqlGroup.parent_group_id || null,

        // Timestamp
        updatedAt: sqlGroup.updated_at
    };

    // Add optional advanced features if present
    if (sqlBoolToJs(sqlGroup.is_power_mode)) {
        (group as any).isPowerMode = true;
    }
    if (powerKeyword) {
        (group as any).powerKeyword = powerKeyword;
    }
    if (assignOnDrop) {
        (group as any).assignOnDrop = assignOnDrop;
    }
    if (collectFilter) {
        (group as any).collectFilter = collectFilter;
    }
    if (sqlBoolToJs(sqlGroup.auto_collect)) {
        (group as any).autoCollect = true;
    }
    if (sqlBoolToJs(sqlGroup.is_pinned)) {
        (group as any).isPinned = true;
    }
    if (sqlGroup.property_value) {
        (group as any).propertyValue = sqlGroup.property_value;
    }

    return group;
}

/**
 * Check if a group ID is valid
 */
export function isValidGroupId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return id.length > 0 && id.length < 100;
}

/**
 * Extract group ID from PouchDB document ID
 */
export function extractGroupId(docId: string): string {
    if (docId.startsWith('section-')) {
        return docId.substring(8); // Remove 'section-' prefix
    }
    if (docId.startsWith('group-')) {
        return docId.substring(6); // Remove 'group-' prefix
    }
    return docId;
}

/**
 * Create PouchDB-style document ID from group ID
 */
export function createGroupDocId(groupId: string): string {
    if (groupId.startsWith('section-') || groupId.startsWith('group-')) {
        return groupId;
    }
    return `section-${groupId}`;
}
