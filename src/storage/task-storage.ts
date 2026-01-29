import type { UnifiedTask } from '@/types/unified-task';

/**
 * Mock TaskStorage - placeholder for future local storage implementation
 * Note: Production uses Supabase via useSupabaseDatabase composable
 */
export class TaskStorage {
  async save(_tasks: UnifiedTask[]): Promise<void> {
    // Mock implementation - no-op
  }

  async load(): Promise<UnifiedTask[]> {
    return [];
  }

  async delete(_id: string): Promise<void> {
    // Mock implementation - no-op
  }

  async findById(_id: string): Promise<UnifiedTask | null> {
    return null;
  }

  async findAll(): Promise<UnifiedTask[]> {
    return [];
  }

  async getLastSyncTime(): Promise<Date | null> {
    return null;
  }

  async setLastSyncTime(_date: Date): Promise<void> {
    // Mock implementation - no-op
  }
}
