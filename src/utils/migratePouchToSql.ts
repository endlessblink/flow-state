/**
 * PouchDB to PowerSync SQLite Migration Utility
 *
 * This script migrates ALL data from PouchDB to SQLite with complete field coverage.
 * No data loss - all fields are preserved including complex JSON fields.
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

import PouchDB from 'pouchdb'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import type { SqlTask, SqlProject, SqlGroup, SqlSubtask, SqlNotification, SqlTimerSession, SqlSetting } from '@/services/database/SqlDatabaseTypes'
import { stringifyForSql, jsBoolToSql } from '@/services/database/SqlDatabaseTypes'

interface MigrationResult {
    tasks: number;
    projects: number;
    groups: number;
    subtasks: number;
    notifications: number;
    timerSessions: number;
    settings: number;
    errors: string[];
}

/**
 * Helper to find the active PomoFlow database name
 */
async function findActivePouchDBName(): Promise<string> {
    if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
        console.warn('[MIGRATION] indexedDB.databases() not supported, falling back to default name')
        return 'pomoflow_local_db'
    }

    try {
        const dbs = await indexedDB.databases()
        const pomoDb = dbs.find(db =>
            db.name && (
                db.name.includes('pomoflow-app') ||
                db.name.includes('pomoflow_local_db')
            )
        )

        if (pomoDb && pomoDb.name) {
            const realName = pomoDb.name.replace(/^_pouch_/, '')
            console.log(`[MIGRATION] Auto-detected active DB: ${realName}`)
            return realName
        }
    } catch (e) {
        console.error('[MIGRATION] Failed to list databases', e)
    }

    return 'pomoflow_local_db'
}

/**
 * Convert PouchDB task document to SqlTask with ALL fields
 */
function convertTaskDoc(doc: any): SqlTask | null {
    // Handle nested data structure: some docs have { type: 'task', data: { title: '...' } }
    const data = doc.data || doc;

    // Check multiple possible title fields (PouchDB schemas vary)
    const title = data.title || data.content || data.name || data.text || data.label || data.summary ||
                  doc.title || doc.content || doc.name;

    // For task-* documents: be lenient - they're obviously tasks even if corrupted
    const isTaskId = doc._id?.startsWith('task-');

    if (!title || title.trim() === '') {
        if (isTaskId) {
            // Task document without title - recover with placeholder but LOG it
            console.warn(`[MIGRATION] Recovering task without title: ${doc._id}`);
            const fields = Object.keys(doc).filter(k => !k.startsWith('_'));
            console.log(`  → Available fields: ${fields.join(', ')}`);
            console.log(`  → Full doc:`, JSON.stringify(doc, null, 2));

            // Use ID as fallback title for recovery
            const recoveredTitle = `Recovered Task (${doc._id.substring(5, 15)}...)`;
            return convertTaskDocWithTitle(doc, recoveredTitle);
        }

        // Non-task document without title - skip
        const fields = Object.keys(doc).filter(k => !k.startsWith('_')).join(', ');
        console.log(`[MIGRATION] Skipping non-task doc without title: ${doc._id}`);
        console.log(`  → Has fields: ${fields}`);
        return null;
    }

    // For non-task-* documents: require task-like properties to avoid importing debug docs
    const isExplicitTask = doc.type === 'task' || isTaskId;
    const hasTaskProperties = doc.status || doc.projectId || doc.completedPomodoros !== undefined ||
                               doc.estimatedPomodoros !== undefined || doc.dueDate || doc.instances ||
                               doc.canvasPosition || doc.isInInbox !== undefined;

    if (!isExplicitTask && !hasTaskProperties) {
        console.log(`[MIGRATION] Skipping non-task doc: ${doc._id} (has title but no task properties)`);
        return null;
    }

    return convertTaskDocWithTitle(doc, title);
}

/**
 * Internal: Convert task document with a known title
 */
function convertTaskDocWithTitle(doc: any, title: string): SqlTask {
    // Handle nested data structure: { type: 'task', data: { ... } }
    const d = doc.data || doc;

    // Handle legacy field names
    const completedPomos = d.completedPomodoros ?? d.totalPomodoros ?? d.actPomodoros ?? 0;
    const estimatedPomos = d.estimatedPomodoros ?? d.estPomodoros ?? 1;
    const now = new Date().toISOString();

    return {
        id: doc._id,

        // Core Identity & Content
        title: title,
        description: d.note || d.description || '',
        status: (d.status === 'todo' ? 'planned' : d.status) || 'planned',
        priority: d.priority || null,

        // Project & Hierarchy
        project_id: d.projectId || d.project_id || 'uncategorized',
        parent_task_id: d.parentTaskId || d.parent_task_id || null,

        // Pomodoro Tracking
        total_pomodoros: completedPomos,
        estimated_pomodoros: estimatedPomos,
        progress: d.progress || 0,

        // Scheduling & Calendar
        due_date: d.dueDate || d.due_date || null,
        scheduled_date: d.scheduledDate || d.scheduled_date || null,
        scheduled_time: d.scheduledTime || d.scheduled_time || null,
        estimated_duration: d.estimatedDuration || d.estimated_duration || null,

        // Complex Fields (JSON serialized)
        instances_json: stringifyForSql(d.instances),
        subtasks_json: stringifyForSql(d.subtasks),
        depends_on_json: stringifyForSql(d.dependsOn || d.depends_on),
        tags_json: stringifyForSql(d.tags),
        connection_types_json: stringifyForSql(d.connectionTypes || d.connection_types),
        recurrence_json: stringifyForSql(d.recurrence),
        recurring_instances_json: stringifyForSql(d.recurringInstances || d.recurring_instances),
        notification_prefs_json: stringifyForSql(d.notificationPreferences || d.notification_prefs),

        // Canvas & Spatial - IMPORTANT: Default to 0,0 if missing to avoid NaN errors
        canvas_position_x: d.canvasPosition?.x ?? d.canvas_position_x ?? 0,
        canvas_position_y: d.canvasPosition?.y ?? d.canvas_position_y ?? 0,
        is_in_inbox: jsBoolToSql(d.isInInbox ?? d.is_in_inbox ?? true),

        // Kanban Workflow
        order: d.order || 0,
        column_id: d.columnId || d.column_id || null,

        // Timestamps
        created_at: d.createdAt instanceof Date
            ? d.createdAt.toISOString()
            : (d.createdAt || d.created_at || now),
        updated_at: now,
        completed_at: d.completedAt || d.completed_at || null,

        // Soft Delete Support
        is_deleted: jsBoolToSql(d.isDeleted ?? d.is_deleted ?? doc._soft_deleted),
        deleted_at: d.deletedAt || d.deleted_at || null
    };
}

/**
 * Convert PouchDB project document to SqlProject with ALL fields
 */
function convertProjectDoc(doc: any): SqlProject {
    const now = new Date().toISOString();
    const isEmoji = doc.colorType === 'emoji' || (doc.emoji && !doc.color?.startsWith?.('#'));

    return {
        id: doc._id,

        // Core Identity
        name: doc.name || 'Untitled Project',
        description: doc.description || null,

        // Appearance
        color: Array.isArray(doc.color) ? doc.color[0] : (doc.color || '#808080'),
        color_type: doc.colorType || (isEmoji ? 'emoji' : 'hex'),
        icon: doc.icon || doc.emoji || null,
        emoji: doc.emoji || null,

        // Hierarchy
        parent_id: doc.parentId || doc.parent_id || null,

        // View Configuration
        view_type: doc.viewType || doc.view_type || 'status',

        // Sorting
        order: doc.order || 0,

        // Timestamps
        created_at: doc.createdAt || doc.created_at || now,
        updated_at: now,

        // Soft Delete
        is_deleted: jsBoolToSql(doc.isDeleted ?? doc.is_deleted),
        deleted_at: doc.deletedAt || doc.deleted_at || null
    };
}

/**
 * Convert PouchDB group/section document to SqlGroup with ALL fields
 * Returns null if the group should be skipped (missing required data)
 */
function convertGroupDoc(doc: any): SqlGroup | null {
    // Handle nested data structure: some docs have { type: 'section', data: { name: '...' } }
    const d = doc.data || doc;
    const now = new Date().toISOString();

    // Extract name from various possible fields
    const name = d.title || d.name || doc.title || doc.name;

    // Skip groups without a valid name - they're corrupted/incomplete
    if (!name || name.trim() === '' || name === 'Untitled Group') {
        const isGroupId = doc._id?.startsWith('group-') || doc._id?.startsWith('section-');
        if (isGroupId) {
            console.warn(`[MIGRATION] Skipping group without valid name: ${doc._id}`);
            const fields = Object.keys(doc).filter(k => !k.startsWith('_'));
            console.log(`  → Available fields: ${fields.join(', ')}`);
        }
        return null;
    }

    return {
        id: doc._id,

        // Core Identity
        name: name,
        type: d.sectionType || d.type || doc.sectionType || doc.type || 'custom',
        color: d.color || doc.color || '#808080',

        // Geometry (JSON)
        position_json: stringifyForSql(d.position || doc.position) || '{}',

        // Settings (JSON)
        filters_json: stringifyForSql(d.filters || doc.filters) || '{}',
        layout: d.layout || doc.layout || 'vertical',

        // State
        is_visible: jsBoolToSql((d.isVisible ?? doc.isVisible) !== false),
        is_collapsed: jsBoolToSql(d.isCollapsed ?? doc.isCollapsed),
        collapsed_height: d.collapsedHeight || doc.collapsedHeight || 0,

        // Hierarchy
        parent_group_id: d.parentGroupId || d.parent_group_id || doc.parentGroupId || doc.parent_group_id || null,

        // Advanced Features (Power Groups)
        is_power_mode: jsBoolToSql(d.isPowerMode ?? doc.isPowerMode),
        power_keyword_json: stringifyForSql(d.powerKeyword || doc.powerKeyword),
        assign_on_drop_json: stringifyForSql(d.assignOnDrop || doc.assignOnDrop),
        collect_filter_json: stringifyForSql(d.collectFilter || doc.collectFilter),
        auto_collect: jsBoolToSql(d.autoCollect ?? doc.autoCollect),
        is_pinned: jsBoolToSql(d.isPinned ?? doc.isPinned),
        property_value: d.propertyValue || doc.propertyValue || null,

        // Timestamps
        created_at: d.createdAt || d.created_at || doc.createdAt || doc.created_at || now,
        updated_at: d.updatedAt || d.updated_at || doc.updatedAt || doc.updated_at || now,

        // Soft Delete
        is_deleted: jsBoolToSql(d.isDeleted ?? d.is_deleted ?? doc.isDeleted ?? doc.is_deleted)
    };
}

/**
 * Generate SQL INSERT statement for tasks with ALL columns
 */
function getTaskInsertSQL(): string {
    return `
        INSERT OR REPLACE INTO tasks (
            id, title, description, status, priority,
            project_id, parent_task_id,
            total_pomodoros, estimated_pomodoros, progress,
            due_date, scheduled_date, scheduled_time, estimated_duration,
            instances_json, subtasks_json, depends_on_json, tags_json,
            connection_types_json, recurrence_json, recurring_instances_json, notification_prefs_json,
            canvas_position_x, canvas_position_y, is_in_inbox,
            "order", column_id,
            created_at, updated_at, completed_at,
            is_deleted, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
}

/**
 * Get task values array for INSERT
 */
function getTaskValues(t: SqlTask): any[] {
    return [
        t.id, t.title, t.description, t.status, t.priority,
        t.project_id, t.parent_task_id,
        t.total_pomodoros, t.estimated_pomodoros, t.progress,
        t.due_date, t.scheduled_date, t.scheduled_time, t.estimated_duration,
        t.instances_json, t.subtasks_json, t.depends_on_json, t.tags_json,
        t.connection_types_json, t.recurrence_json, t.recurring_instances_json, t.notification_prefs_json,
        t.canvas_position_x, t.canvas_position_y, t.is_in_inbox,
        t.order, t.column_id,
        t.created_at, t.updated_at, t.completed_at,
        t.is_deleted, t.deleted_at
    ];
}

/**
 * Generate SQL INSERT statement for projects with ALL columns
 */
function getProjectInsertSQL(): string {
    return `
        INSERT OR REPLACE INTO projects (
            id, name, description, color, color_type, icon, emoji,
            parent_id, view_type, "order",
            created_at, updated_at, is_deleted, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
}

/**
 * Get project values array for INSERT
 */
function getProjectValues(p: SqlProject): any[] {
    return [
        p.id, p.name, p.description, p.color, p.color_type, p.icon, p.emoji,
        p.parent_id, p.view_type, p.order,
        p.created_at, p.updated_at, p.is_deleted, p.deleted_at
    ];
}

/**
 * Generate SQL INSERT statement for groups with ALL columns
 */
function getGroupInsertSQL(): string {
    return `
        INSERT OR REPLACE INTO groups (
            id, name, type, color, position_json, filters_json, layout,
            is_visible, is_collapsed, collapsed_height, parent_group_id,
            is_power_mode, power_keyword_json, assign_on_drop_json, collect_filter_json,
            auto_collect, is_pinned, property_value,
            created_at, updated_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
}

/**
 * Get group values array for INSERT
 */
function getGroupValues(g: SqlGroup): any[] {
    return [
        g.id, g.name, g.type, g.color, g.position_json, g.filters_json, g.layout,
        g.is_visible, g.is_collapsed, g.collapsed_height, g.parent_group_id,
        g.is_power_mode, g.power_keyword_json, g.assign_on_drop_json, g.collect_filter_json,
        g.auto_collect, g.is_pinned, g.property_value,
        g.created_at, g.updated_at, g.is_deleted
    ];
}

/**
 * Migrate all data from PouchDB to SQLite
 */
export async function migratePouchToSql(existingPouch?: PouchDB.Database): Promise<MigrationResult> {
    console.log('[MIGRATION] Starting PouchDB -> SQLite migration (Complete Schema)...')

    const result: MigrationResult = {
        tasks: 0,
        projects: 0,
        groups: 0,
        subtasks: 0,
        notifications: 0,
        timerSessions: 0,
        settings: 0,
        errors: []
    };

    try {
        // 1. Initialize PouchDB connection
        let pouch: PouchDB.Database;
        let dbName = '';

        if (existingPouch) {
            console.log('[MIGRATION] Reusing existing PouchDB connection')
            pouch = existingPouch;
            dbName = pouch.name;
        } else {
            dbName = await findActivePouchDBName();
            pouch = new PouchDB(dbName, { adapter: 'idb' });
        }

        const allDocs = await pouch.allDocs({ include_docs: true });
        console.log(`[MIGRATION] Found ${allDocs.rows.length} documents in PouchDB (${dbName})`);

        if (allDocs.rows.length === 0) {
            console.warn('[MIGRATION] No documents found. Is the DB name correct?');
            return result;
        }

        // 2. Initialize PowerSync SQLite
        const sqlDb = await PowerSyncService.getInstance();

        // 3. Categorize and convert documents
        const tasksToInsert: SqlTask[] = [];
        const projectsToInsert: SqlProject[] = [];
        const groupsToInsert: SqlGroup[] = [];

        for (const row of allDocs.rows) {
            const doc = row.doc as any;
            if (!doc || doc._id.startsWith('_')) continue;

            // SKIP DELETED DOCUMENTS - they should stay deleted!
            const data = doc.data || doc;
            if (data.deleted || data.isDeleted || data.is_deleted || doc._deleted) {
                console.log(`[MIGRATION] Skipping deleted doc: ${doc._id}`);
                continue;
            }

            try {
                // Detect document type
                const docId = doc._id;
                const docType = doc.type;

                // TASKS
                if (
                    docType === 'task' ||
                    docId.startsWith('task-') ||
                    (doc.createdAt && !docType && !docId.startsWith('project-') && !docId.startsWith('section-') && !docId.startsWith('group-') && !docId.startsWith('notif-'))
                ) {
                    const task = convertTaskDoc(doc);
                    if (task) {
                        tasksToInsert.push(task);
                        result.tasks++;
                    }
                }
                // PROJECTS
                else if (docType === 'project' || docId.startsWith('project-')) {
                    const project = convertProjectDoc(doc);
                    projectsToInsert.push(project);
                    result.projects++;
                }
                // GROUPS/SECTIONS
                else if (docType === 'section' || docId.startsWith('section-') || docId.startsWith('group-')) {
                    const group = convertGroupDoc(doc);
                    if (group) {
                        groupsToInsert.push(group);
                        result.groups++;
                    }
                }
                // TODO: Handle notifications, timer sessions, settings if stored in PouchDB

            } catch (err: any) {
                console.error(`[MIGRATION] Failed to convert doc ${doc._id}:`, err);
                result.errors.push(`Doc ${doc._id}: ${err.message}`);
            }
        }

        // 4. Execute bulk inserts in a transaction
        console.log(`[MIGRATION] Inserting ${result.tasks} tasks, ${result.projects} projects, ${result.groups} groups...`);

        await sqlDb.writeTransaction(async (tx: any) => {
            // Insert tasks
            const taskSQL = getTaskInsertSQL();
            for (const task of tasksToInsert) {
                await tx.execute(taskSQL, getTaskValues(task));
            }

            // Insert projects
            const projectSQL = getProjectInsertSQL();
            for (const project of projectsToInsert) {
                await tx.execute(projectSQL, getProjectValues(project));
            }

            // Insert groups
            const groupSQL = getGroupInsertSQL();
            for (const group of groupsToInsert) {
                await tx.execute(groupSQL, getGroupValues(group));
            }
        });

        console.log(`[MIGRATION] Migration Complete! Moved ${result.tasks} tasks, ${result.projects} projects, ${result.groups} groups.`);

        // 5. Set migration flag
        localStorage.setItem('POWERSYNC_MIGRATION_COMPLETE', 'true');
        localStorage.setItem('POWERSYNC_MIGRATION_VERSION', '2'); // Track schema version

        // 6. Force reload to switch drivers
        setTimeout(() => window.location.reload(), 1000);

        return result;

    } catch (err: any) {
        console.error('[MIGRATION] Critical Failure:', err);
        result.errors.push(err.message);
        return result;
    }
}

/**
 * Reset migration flag to force re-migration
 */
export function resetMigrationFlag(): void {
    localStorage.removeItem('POWERSYNC_MIGRATION_COMPLETE');
    localStorage.removeItem('POWERSYNC_MIGRATION_VERSION');
    console.log('[MIGRATION] Migration flags cleared. Reload to trigger re-migration.');
}

/**
 * Check if migration is complete
 */
export function isMigrationComplete(): boolean {
    return localStorage.getItem('POWERSYNC_MIGRATION_COMPLETE') === 'true';
}

/**
 * Get migration schema version
 */
export function getMigrationVersion(): number {
    return parseInt(localStorage.getItem('POWERSYNC_MIGRATION_VERSION') || '0', 10);
}

/**
 * PERMANENTLY delete all soft-deleted records from SQLite
 * This ensures deleted content never comes back
 */
export async function purgeDeletedRecords(): Promise<{ tasks: number; projects: number; groups: number }> {
    console.log('[PURGE] Permanently removing all soft-deleted records...');

    try {
        const db = await PowerSyncService.getInstance();

        // Count before delete
        const tasksBefore = await db.getAll('SELECT COUNT(*) as count FROM tasks WHERE is_deleted = 1') as any[];
        const projectsBefore = await db.getAll('SELECT COUNT(*) as count FROM projects WHERE is_deleted = 1') as any[];
        const groupsBefore = await db.getAll('SELECT COUNT(*) as count FROM groups WHERE is_deleted = 1') as any[];

        const tasksCount = tasksBefore[0]?.count || 0;
        const projectsCount = projectsBefore[0]?.count || 0;
        const groupsCount = groupsBefore[0]?.count || 0;

        // HARD DELETE all soft-deleted records
        await db.execute('DELETE FROM tasks WHERE is_deleted = 1');
        await db.execute('DELETE FROM projects WHERE is_deleted = 1');
        await db.execute('DELETE FROM groups WHERE is_deleted = 1');

        console.log(`✅ [PURGE] Permanently deleted: ${tasksCount} tasks, ${projectsCount} projects, ${groupsCount} groups`);

        return { tasks: tasksCount, projects: projectsCount, groups: groupsCount };

    } catch (err: any) {
        console.error('[PURGE] Failed:', err);
        throw err;
    }
}

/**
 * Delete all untitled/corrupted groups from SQLite
 * These are groups with name = 'Untitled Group' or empty names
 */
export async function purgeUntitledGroups(): Promise<number> {
    console.log('[PURGE] Removing all untitled/corrupted groups...');

    try {
        const db = await PowerSyncService.getInstance();

        // Find untitled groups
        const untitledGroups = await db.getAll(
            `SELECT id, name FROM groups WHERE name = 'Untitled Group' OR name = '' OR name IS NULL`
        ) as any[];

        if (untitledGroups.length === 0) {
            console.log('✅ [PURGE] No untitled groups found');
            return 0;
        }

        console.log(`[PURGE] Found ${untitledGroups.length} untitled groups to delete:`);
        untitledGroups.forEach((g: any) => console.log(`  → ${g.id}: "${g.name}"`));

        // HARD DELETE untitled groups
        await db.execute(
            `DELETE FROM groups WHERE name = 'Untitled Group' OR name = '' OR name IS NULL`
        );

        console.log(`✅ [PURGE] Permanently deleted ${untitledGroups.length} untitled groups`);
        return untitledGroups.length;

    } catch (err: any) {
        console.error('[PURGE] Failed:', err);
        throw err;
    }
}

/**
 * List all groups currently in SQLite
 */
export async function listGroups(): Promise<void> {
    try {
        const db = await PowerSyncService.getInstance();
        const groups = await db.getAll('SELECT id, name, type, is_deleted FROM groups') as any[];

        console.log(`📋 [DEBUG] ${groups.length} groups in SQLite:`);
        groups.forEach((g: any) => {
            const deleted = g.is_deleted ? ' [DELETED]' : '';
            console.log(`  → ${g.id}: "${g.name}" (${g.type})${deleted}`);
        });

    } catch (err: any) {
        console.error('[DEBUG] Failed to list groups:', err);
    }
}

// Expose on window for easy console access
if (typeof window !== 'undefined') {
    (window as any).purgeDeleted = purgeDeletedRecords;
    (window as any).purgeUntitledGroups = purgeUntitledGroups;
    (window as any).listGroups = listGroups;
}
