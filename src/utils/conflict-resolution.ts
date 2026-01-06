import type { UnifiedTask } from '@/types/unified-task';

import type { ConflictDiff } from './threeWayMerge';

export interface TaskConflict {
  taskId: string;
  localVersion: UnifiedTask;
  remoteVersion: UnifiedTask;
  // Aliases for component compatibility
  localTask: UnifiedTask;
  remoteTask: UnifiedTask;
  conflicts: ConflictDiff[];
  priority: 'low' | 'medium' | 'high';
}

export class ConflictResolutionService {
  resolve(_conflicts: TaskConflict[]): UnifiedTask[] {
    console.log('Mock ConflictResolutionService.resolve called');
    return [];
  }
}
