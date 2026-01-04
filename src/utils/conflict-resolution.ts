import type { UnifiedTask } from '@/types/unified-task';

export interface TaskConflict {
  taskId: string;
  localVersion: UnifiedTask;
  remoteVersion: UnifiedTask;
}

export class ConflictResolutionService {
  resolve(_conflicts: TaskConflict[]): UnifiedTask[] {
    console.log('Mock ConflictResolutionService.resolve called');
    return [];
  }
}
