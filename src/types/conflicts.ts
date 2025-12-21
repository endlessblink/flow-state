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
  data: unknown
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
  resolvedDocument: unknown
  winner: string
  timestamp: Date
  conflictData: ConflictInfo
  metadata?: {
    mergedFields?: string[]
    preservedLocalFields?: string[]
    preservedRemoteFields?: string[]
    resolutionReason?: string
    timeDifference?: number
    winnerDevice?: string
    localDeleted?: boolean
    remoteDeleted?: boolean
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
export function isConflictInfo(obj: unknown): obj is ConflictInfo {
  if (!obj || typeof obj !== 'object') return false
  const c = obj as Record<string, unknown>
  return (
    typeof c.documentId === 'string' &&
    typeof c.localVersion === 'object' &&
    typeof c.remoteVersion === 'object' &&
    Object.values(ConflictType).includes(c.conflictType as ConflictType) &&
    c.timestamp instanceof Date &&
    ['low', 'medium', 'high'].includes(c.severity as string) &&
    typeof c.autoResolvable === 'boolean'
  )
}

export function isResolutionResult(obj: unknown): obj is ResolutionResult {
  if (!obj || typeof obj !== 'object') return false
  const r = obj as Record<string, unknown>
  return (
    typeof r.documentId === 'string' &&
    Object.values(ResolutionType).includes(r.resolutionType as ResolutionType) &&
    r.resolvedDocument !== undefined &&
    typeof r.winner === 'string' &&
    r.timestamp instanceof Date &&
    isConflictInfo(r.conflictData)
  )
}