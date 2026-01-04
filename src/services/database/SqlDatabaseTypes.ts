import { PowerSyncDatabase } from '@journeyapps/powersync-sdk-web';
import { DatabaseSchema } from '@/database/AppSchema';

export type AppDatabase = PowerSyncDatabase;

export interface SqlTask {
    id: string;
    title: string;
    status: string;
    project_id?: string;
    description?: string;
    total_pomodoros: number;
    estimated_pomodoros: number;
    order: number;
    column_id?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    is_deleted: number; // 0 or 1
    deleted_at?: string;
}

export interface SqlProject {
    id: string;
    name: string;
    color: string;
    created_at: string;
    updated_at: string;
    is_deleted: number;
}
