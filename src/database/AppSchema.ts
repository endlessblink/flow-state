import { column, Schema, Table } from '@journeyapps/powersync-sdk-web';

// Define the Tasks table
const tasks = new Table({
    name: 'tasks',
    columns: {
        // Core Fields
        title: column.text,
        status: column.text,
        description: column.text, // Formerly 'note' or 'description'
        project_id: column.text,

        // Timer Fields
        total_pomodoros: column.integer,
        estimated_pomodoros: column.integer,

        // Sorting & System
        order: column.integer, // For Kanban sorting
        column_id: column.text, // For Kanban columns
        created_at: column.text,
        updated_at: column.text,
        completed_at: column.text,

        // Soft Delete Support
        is_deleted: column.integer, // SQLite uses 0/1 for booleans
        deleted_at: column.text
    }
});

// Define the Projects table
const projects = new Table({
    name: 'projects',
    columns: {
        name: column.text,
        color: column.text,
        description: column.text,
        icon: column.text,

        // Sorting
        order: column.integer,

        // System
        created_at: column.text,
        updated_at: column.text,

        // Soft Delete
        is_deleted: column.integer,
        deleted_at: column.text
    }
});

// Global App Schema
export const AppSchema = new Schema([
    tasks,
    projects
]);

export type DatabaseSchema = typeof AppSchema.types;
