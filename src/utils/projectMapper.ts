/**
 * Project Mapper - Converts between Project (app) and SqlProject (database) formats
 *
 * This mapper handles ALL project fields to ensure zero data loss during
 * the PouchDB to PowerSync migration.
 *
 * Last Updated: January 4, 2026
 * Migration Phase: Complete Schema (Phase 2)
 */

import type { Project } from '../types/tasks'
import type { SqlProject } from '../services/database/SqlDatabaseTypes'
import { jsBoolToSql, sqlBoolToJs } from '../services/database/SqlDatabaseTypes'

/**
 * Convert Project (app model) to SqlProject (database model)
 */
export function toSqlProject(project: Project): SqlProject {
    const now = new Date().toISOString();

    // Determine color type and extract primary color
    const primaryColor = Array.isArray(project.color) ? project.color[0] : project.color;
    const isEmoji = project.colorType === 'emoji' || (project.emoji && !primaryColor?.startsWith('#'));

    return {
        id: project.id,

        // Core Identity
        name: project.name,
        description: (project as any).description || undefined, // May not exist on old projects

        // Appearance
        color: primaryColor,
        color_type: project.colorType || (isEmoji ? 'emoji' : 'hex'),
        icon: project.emoji || undefined,
        emoji: project.emoji || undefined,

        // Hierarchy
        parent_id: project.parentId || undefined,

        // View Configuration
        view_type: project.viewType || 'status',

        // Sorting
        order: (project as any).order || 0,

        // Timestamps
        created_at: project.createdAt instanceof Date
            ? project.createdAt.toISOString()
            : (project.createdAt || now),
        updated_at: now,

        // Soft Delete
        is_deleted: jsBoolToSql((project as any).isDeleted),
        deleted_at: (project as any).deletedAt
            ? ((project as any).deletedAt instanceof Date
                ? (project as any).deletedAt.toISOString()
                : (project as any).deletedAt)
            : undefined
    };
}

/**
 * Convert SqlProject (database model) to Project (app model)
 */
export function fromSqlProject(sqlProject: SqlProject): Project {
    return {
        id: sqlProject.id,

        // Core Identity
        name: sqlProject.name,

        // Appearance - load from database, don't hardcode
        color: sqlProject.color,
        colorType: (sqlProject.color_type as Project['colorType']) || 'hex',
        emoji: sqlProject.emoji || sqlProject.icon || undefined,

        // Hierarchy - load from database
        parentId: sqlProject.parent_id || null,

        // View Configuration - load from database
        viewType: (sqlProject.view_type as Project['viewType']) || 'status',

        // Timestamps
        createdAt: new Date(sqlProject.created_at),
        updatedAt: new Date(sqlProject.updated_at)
    };
}

/**
 * Check if a project ID is valid
 */
export function isValidProjectId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    if (id === 'uncategorized') return true;
    return id.length > 0 && id.length < 100;
}

/**
 * Extract project ID from PouchDB document ID
 */
export function extractProjectId(docId: string): string {
    if (docId.startsWith('project-')) {
        return docId.substring(8); // Remove 'project-' prefix
    }
    return docId;
}

/**
 * Create PouchDB-style document ID from project ID
 */
export function createProjectDocId(projectId: string): string {
    if (projectId.startsWith('project-')) {
        return projectId;
    }
    return `project-${projectId}`;
}
