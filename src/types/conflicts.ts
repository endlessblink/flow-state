/**
 * Conflict Detection and Resolution Types
 * Defines interfaces for detecting, analyzing, and resolving sync conflicts
 */

export interface ConflictInfo {
  documentId: string
  localVersion: DocumentVersion
  remoteVersion: DocumentVersion
  conflictType: ConflictType
  timestamp: Date
  severity: 'low' | 'medium' | 'high'
  autoResolvable: boolean
  resolutionApplied?: ResolutionResult
}

export interface DocumentVersion {
  _id: string
  _rev: string
  data: any
  updatedAt: string
  deviceId: string
  version: number
  checksum?: string
  _deleted?: boolean
}

export enum ConflictType {
  EDIT_EDIT = 'edit_edit',           // Both local and remote modified
  EDIT_DELETE = 'edit_delete',       // One modified, one deleted
  MERGE_CANDIDATES = 'merge_candidates', // Compatible changes
  VERSION_MISMATCH = 'version_mismatch', // Version numbers don't align
  CHECKSUM_MISMATCH = 'checksum_mismatch' // Data corruption detected
}

export interface ResolutionResult {
  documentId: string
  resolutionType: ResolutionType
  resolvedDocument: any
  winner: string
  timestamp: Date
  conflictData: ConflictInfo
  metadata?: {
    mergedFields?: string[]
    preservedLocalFields?: string[]
    preservedRemoteFields?: string[]
    resolutionReason?: string
  }
}

export enum ResolutionType {
  LAST_WRITE_WINS = 'last_write_wins',
  PRESERVE_NON_DELETED = 'preserve_non_deleted',
  SMART_MERGE = 'smart_merge',
  MANUAL = 'manual',
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins'
}

export interface ConflictDetectionOptions {
  includeDeleted?: boolean
  checksumValidation?: boolean
  deviceId?: string
  conflictThreshold?: number // Time difference in ms to consider as conflict
}

export interface ConflictStats {
  totalDetected: number
  autoResolved: number
  manualRequired: number
  byType: Record<ConflictType, number>
  bySeverity: Record<'low' | 'medium' | 'high', number>
  averageResolutionTime: number
}

export interface ConflictHistory {
  conflicts: ConflictInfo[]
  resolutions: ResolutionResult[]
  stats: ConflictStats
  lastUpdated: Date
}

// Helper type guards
export function isConflictInfo(obj: any): obj is ConflictInfo {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.documentId === 'string' &&
    typeof obj.localVersion === 'object' &&
    typeof obj.remoteVersion === 'object' &&
    Object.values(ConflictType).includes(obj.conflictType) &&
    obj.timestamp instanceof Date &&
    ['low', 'medium', 'high'].includes(obj.severity) &&
    typeof obj.autoResolvable === 'boolean'
}

export function isResolutionResult(obj: any): obj is ResolutionResult {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.documentId === 'string' &&
    Object.values(ResolutionType).includes(obj.resolutionType) &&
    obj.resolvedDocument &&
    typeof obj.winner === 'string' &&
    obj.timestamp instanceof Date &&
    isConflictInfo(obj.conflictData)
}