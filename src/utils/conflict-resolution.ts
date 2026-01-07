import type { UnifiedTask } from '@/types/unified-task';
import type { ConflictDiff } from './threeWayMerge';
import type {
  ConflictInfo,
  ResolutionResult} from '@/types/conflicts';
import {
  ConflictType,
  ResolutionType,
  DocumentVersion
} from '@/types/conflicts';

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

export enum ResolutionStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  SMART_MERGE = 'SMART_MERGE',
  LOCAL_WINS = 'LOCAL_WINS',
  REMOTE_WINS = 'REMOTE_WINS',
  DELETION_WINS = 'DELETION_WINS',
  MANUAL = 'MANUAL'
}

export interface ResolutionRule {
  field: string;
  condition: 'always' | 'when-empty' | 'when-longer';
  action: 'prefer-local' | 'prefer-remote' | 'merge' | 'prefer-truthy' | 'prefer-longer' | 'union';
  priority: number;
}

// Added for compatibility with legacy systems
export interface UserResolutionRule {
  name: string
  field: string
  condition: 'always' | 'when-empty' | 'when-newer' | 'when-contains' | 'when-longer' | 'custom'
  value?: unknown
  action: 'prefer-local' | 'prefer-remote' | 'prefer-non-empty' | 'prefer-true' | 'prefer-false' | 'prefer-longer' | 'prefer-newer' | 'prefer-earlier' | 'prefer-higher' | 'merge' | 'union' | 'merge-deep' | 'ask' | 'custom'
  priority: number
  customAction?: (local: unknown, remote: unknown) => unknown
}

export class ConflictResolutionService {
  private rules: Map<string, ResolutionRule[]> = new Map();
  private deviceId: string;

  constructor(deviceId: string = 'default-device') {
    this.deviceId = deviceId;
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Ported from legacy ConflictResolver
    this.rules.set('title', [
      { field: 'title', condition: 'when-empty', action: 'prefer-local', priority: 1 },
      { field: 'title', condition: 'always', action: 'prefer-longer', priority: 2 }
    ]);

    this.rules.set('description', [
      { field: 'description', condition: 'always', action: 'merge', priority: 1 }
    ]);
  }

  /**
   * Resolve many task conflicts at once
   */
  resolve(conflicts: TaskConflict[]): UnifiedTask[] {
    console.log(`🔧 Resolving ${conflicts.length} task conflicts...`);
    return conflicts.map(conflict => this.resolveSingleConflict(conflict));
  }

  /**
   * Backward compatibility method for legacy ConflictResolver usage
   */
  async resolveConflict(conflict: ConflictInfo): Promise<ResolutionResult> {
    console.log(`🔧 Resolving legacy conflict: ${conflict.documentId} (${conflict.conflictType})`);

    // Select strategy based on conflict type and severity
    const strategy = this.selectLegacyStrategy(conflict);

    let resolvedDocument: any = conflict.localVersion.data;
    let winner = 'local';

    if (strategy === ResolutionType.LAST_WRITE_WINS) {
      const localTime = new Date(conflict.localVersion.updatedAt).getTime();
      const remoteTime = new Date(conflict.remoteVersion.updatedAt).getTime();
      if (remoteTime > localTime) {
        resolvedDocument = conflict.remoteVersion.data;
        winner = 'remote';
      }
    } else if (strategy === ResolutionType.REMOTE_WINS) {
      resolvedDocument = conflict.remoteVersion.data;
      winner = 'remote';
    } else if (strategy === ResolutionType.LOCAL_WINS) {
      resolvedDocument = conflict.localVersion.data;
      winner = 'local';
    }
    // Note: SMART_MERGE would need full ThreeWayMergeEngine instantiation here
    // For now, simpler auto-resolutions are prioritized to restore system stability

    return {
      documentId: conflict.documentId,
      resolutionType: strategy,
      resolvedDocument,
      winner,
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        resolutionReason: `Auto-resolved using ${strategy} via ConflictResolutionService`
      }
    };
  }

  private selectLegacyStrategy(conflict: ConflictInfo): ResolutionType {
    if (conflict.autoResolvable) {
      switch (conflict.conflictType) {
        case ConflictType.EDIT_DELETE:
          return ResolutionType.PRESERVE_NON_DELETED;
        case ConflictType.VERSION_MISMATCH:
          return ResolutionType.LAST_WRITE_WINS;
        default:
          return ResolutionType.LAST_WRITE_WINS;
      }
    }

    if (conflict.severity === 'high') {
      return ResolutionType.MANUAL;
    }

    return ResolutionType.LAST_WRITE_WINS;
  }

  /**
   * Resolve a single task conflict using smart strategies
   */
  private resolveSingleConflict(conflict: TaskConflict): UnifiedTask {
    const strategy = this.selectStrategy(conflict);

    switch (strategy) {
      case ResolutionStrategy.SMART_MERGE:
        return this.smartMerge(conflict);
      case ResolutionStrategy.DELETION_WINS:
        return this.resolveDeletionWins(conflict);
      case ResolutionStrategy.LOCAL_WINS:
        return conflict.localTask;
      case ResolutionStrategy.REMOTE_WINS:
        return conflict.remoteTask;
      case ResolutionStrategy.LAST_WRITE_WINS:
      default:
        return this.resolveLastWriteWins(conflict);
    }
  }

  private selectStrategy(conflict: TaskConflict): ResolutionStrategy {
    // If one is deleted, deletion wins (prevent task resurrection - BUG-037)
    if (conflict.localTask.completedAt && !conflict.remoteTask.completedAt) {
      // Logic for deletion wins...
    }

    // Default to smart merge for most tasks
    return ResolutionStrategy.SMART_MERGE;
  }

  private resolveLastWriteWins(conflict: TaskConflict): UnifiedTask {
    const localTime = new Date(conflict.localTask.updatedAt).getTime();
    const remoteTime = new Date(conflict.remoteTask.updatedAt).getTime();
    return localTime > remoteTime ? conflict.localTask : conflict.remoteTask;
  }

  private resolveDeletionWins(conflict: TaskConflict): UnifiedTask {
    // Logic for BUG-037: Deletion always wins
    return conflict.localTask; // Placeholder
  }

  private smartMerge(conflict: TaskConflict): UnifiedTask {
    const mergedTask = { ...conflict.localTask };
    const localData = conflict.localTask as any;
    const remoteData = conflict.remoteTask as any;

    for (const diff of conflict.conflicts) {
      const field = diff.field;
      const rules = this.rules.get(field);

      if (rules && rules.length > 0) {
        const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
        for (const rule of sortedRules) {
          if (this.shouldApplyRule(rule, diff.localValue, diff.remoteValue)) {
            (mergedTask as any)[field] = this.applyRule(rule, diff.localValue, diff.remoteValue);
            break;
          }
        }
      } else {
        // Default: local wins for unknown conflicting fields
        (mergedTask as any)[field] = diff.localValue;
      }
    }

    mergedTask.updatedAt = new Date();
    return mergedTask;
  }

  private shouldApplyRule(rule: ResolutionRule, local: any, remote: any): boolean {
    switch (rule.condition) {
      case 'always': return true;
      case 'when-empty': return !local || !remote;
      case 'when-longer':
        return typeof local === 'string' && typeof remote === 'string' && local.length !== remote.length;
      default: return false;
    }
  }

  private applyRule(rule: ResolutionRule, local: any, remote: any): any {
    switch (rule.action) {
      case 'prefer-local': return local;
      case 'prefer-remote': return remote;
      case 'prefer-truthy': return local || remote;
      case 'prefer-longer':
        if (typeof local === 'string' && typeof remote === 'string') {
          return local.length >= remote.length ? local : remote;
        }
        return local;
      case 'merge':
        if (typeof local === 'string' && typeof remote === 'string') {
          return `${local}\n\n---\n\n${remote}`;
        }
        return local;
      case 'union':
        if (Array.isArray(local) && Array.isArray(remote)) {
          return Array.from(new Set([...local, ...remote]));
        }
        return local;
      default: return local;
    }
  }
}

export default ConflictResolutionService;
