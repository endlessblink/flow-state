import type { UnifiedTask } from '@/types/unified-task';

export class TaskStorage {
  async save(_tasks: UnifiedTask[]): Promise<void> {
    console.log('Mock TaskStorage.save called');
  }

  async load(): Promise<UnifiedTask[]> {
    console.log('Mock TaskStorage.load called');
    return [];
  }

  async delete(_id: string): Promise<void> {
    console.log('Mock TaskStorage.delete called');
  }

  async findById(_id: string): Promise<UnifiedTask | null> {
    console.log('Mock TaskStorage.findById called');
    return null;
  }

  async findAll(): Promise<UnifiedTask[]> {
    console.log('Mock TaskStorage.findAll called');
    return [];
  }

  async getLastSyncTime(): Promise<Date | null> {
    console.log('Mock TaskStorage.getLastSyncTime called');
    return null;
  }

  async setLastSyncTime(_date: Date): Promise<void> {
    console.log('Mock TaskStorage.setLastSyncTime called');
  }
}
