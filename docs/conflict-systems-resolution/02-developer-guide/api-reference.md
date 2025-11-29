# API Reference

Complete API documentation for Pomo-Flow's conflict resolution system.

## Table of Contents

- [Type Definitions](#type-definitions)
- [ConflictDetector Class](#conflictdetector-class)
- [ConflictResolution Class](#conflictresolution-class)
- [UI Component Props](#ui-component-props)
- [Type Guards](#type-guards)

---

## Type Definitions

### Enums

#### ConflictType

```typescript
export enum ConflictType {
  EDIT_EDIT = 'edit_edit',
  EDIT_DELETE = 'edit_delete',
  MERGE_CANDIDATES = 'merge_candidates',
  VERSION_MISMATCH = 'version_mismatch',
  CHECKSUM_MISMATCH = 'checksum_mismatch'
}
```

| Value | Description |
|-------|-------------|
| `EDIT_EDIT` | Both local and remote versions modified the same field |
| `EDIT_DELETE` | One version edited a field while the other deleted it |
| `MERGE_CANDIDATES` | Changes don't overlap and can be automatically merged |
| `VERSION_MISMATCH` | Document revision numbers don't match expected sequence |
| `CHECKSUM_MISMATCH` | Data integrity check failed between versions |

#### ResolutionType

```typescript
export enum ResolutionType {
  LOCAL = 'local',
  REMOTE = 'remote',
  MERGE = 'merge',
  MANUAL = 'manual',
  LAST_WRITE_WINS = 'last_write_wins',
  CUSTOM = 'custom'
}
```

| Value | Description |
|-------|-------------|
| `LOCAL` | Keep the local version, discard remote changes |
| `REMOTE` | Accept the remote version, discard local changes |
| `MERGE` | Combine both versions using smart merge algorithm |
| `MANUAL` | Requires user intervention to resolve |
| `LAST_WRITE_WINS` | Use the version with the most recent timestamp |
| `CUSTOM` | Apply custom resolution logic defined by user |

---

### Interfaces

#### ConflictInfo

Primary conflict representation containing all conflict metadata.

```typescript
export interface ConflictInfo {
  id: string
  documentId: string
  type: ConflictType
  localVersion: DocumentVersion
  remoteVersion: DocumentVersion
  conflictingFields: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: number
  deviceId?: string
  canAutoResolve: boolean
  suggestedResolution?: ResolutionType
}
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier for this conflict instance |
| `documentId` | `string` | ID of the document with conflicts |
| `type` | `ConflictType` | Classification of the conflict |
| `localVersion` | `DocumentVersion` | Local document version details |
| `remoteVersion` | `DocumentVersion` | Remote document version details |
| `conflictingFields` | `string[]` | List of field paths with conflicts |
| `severity` | `'low' \| 'medium' \| 'high' \| 'critical'` | Impact severity level |
| `detectedAt` | `number` | Unix timestamp of detection |
| `deviceId` | `string?` | Origin device identifier (optional) |
| `canAutoResolve` | `boolean` | Whether automatic resolution is possible |
| `suggestedResolution` | `ResolutionType?` | Recommended resolution strategy |

#### DocumentVersion

Represents a specific version of a document.

```typescript
export interface DocumentVersion {
  rev: string
  data: Record<string, any>
  updatedAt: number
  updatedBy?: string
  checksum?: string
}
```

| Property | Type | Description |
|----------|------|-------------|
| `rev` | `string` | PouchDB/CouchDB revision string |
| `data` | `Record<string, any>` | Document content |
| `updatedAt` | `number` | Unix timestamp of last update |
| `updatedBy` | `string?` | User/device that made the update |
| `checksum` | `string?` | Data integrity checksum |

#### ResolutionResult

Result of a conflict resolution operation.

```typescript
export interface ResolutionResult {
  success: boolean
  resolvedDocument: Record<string, any>
  resolutionType: ResolutionType
  fieldsResolved: string[]
  timestamp: number
  notes?: string
}
```

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | Whether resolution completed successfully |
| `resolvedDocument` | `Record<string, any>` | Final merged document |
| `resolutionType` | `ResolutionType` | Strategy used for resolution |
| `fieldsResolved` | `string[]` | List of resolved field paths |
| `timestamp` | `number` | Unix timestamp of resolution |
| `notes` | `string?` | Optional resolution notes |

#### ConflictDiff

Represents a single field-level conflict.

```typescript
export interface ConflictDiff {
  field: string
  localValue: any
  remoteValue: any
  severity: 'low' | 'medium' | 'high'
  autoResolvable: boolean
  suggestedResolution?: any
}
```

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Field path (supports nested: `"subtasks.0.title"`) |
| `localValue` | `any` | Value in local version |
| `remoteValue` | `any` | Value in remote version |
| `severity` | `'low' \| 'medium' \| 'high'` | Field-level severity |
| `autoResolvable` | `boolean` | Can be auto-resolved |
| `suggestedResolution` | `any?` | Suggested merged value |

#### ConflictStats

Aggregate statistics for conflict tracking.

```typescript
export interface ConflictStats {
  total: number
  byType: Record<ConflictType, number>
  bySeverity: Record<string, number>
  autoResolved: number
  manuallyResolved: number
  pending: number
}
```

#### TaskConflict

Task-specific conflict wrapper for UI components.

```typescript
export interface TaskConflict {
  localTask: Task
  remoteTask: Task
  conflicts: ConflictDiff[]
  priority: 'low' | 'medium' | 'high'
  canAutoMerge: boolean
}
```

---

## ConflictDetector Class

Main class for detecting and analyzing conflicts.

**Location**: `src/utils/conflictDetector.ts`

### Constructor

```typescript
constructor(options?: ConflictDetectorOptions)
```

#### ConflictDetectorOptions

```typescript
interface ConflictDetectorOptions {
  deviceId?: string
  checksumEnabled?: boolean
  severityThresholds?: {
    criticalFields: string[]
    highFields: string[]
  }
}
```

### Methods

#### detectConflict

Detects conflicts in a document with `_conflicts` array.

```typescript
detectConflict(document: any): ConflictInfo | null
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `document` | `any` | PouchDB document with potential `_conflicts` |

**Returns:** `ConflictInfo | null` - Conflict info if found, null otherwise

**Example:**
```typescript
const detector = new ConflictDetector()
const doc = await db.get('task-123', { conflicts: true })
const conflict = detector.detectConflict(doc)

if (conflict) {
  console.log(`Found ${conflict.type} conflict with severity: ${conflict.severity}`)
}
```

#### identifyConflictType

Determines the type of conflict between two document versions.

```typescript
identifyConflictType(
  localDoc: Record<string, any>,
  remoteDoc: Record<string, any>
): ConflictType
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `localDoc` | `Record<string, any>` | Local document version |
| `remoteDoc` | `Record<string, any>` | Remote document version |

**Returns:** `ConflictType` - The identified conflict type

**Example:**
```typescript
const conflictType = detector.identifyConflictType(localTask, remoteTask)
if (conflictType === ConflictType.MERGE_CANDIDATES) {
  // Safe to auto-merge
}
```

#### calculateSeverity

Calculates the severity level of a conflict.

```typescript
calculateSeverity(conflictInfo: ConflictInfo): 'low' | 'medium' | 'high' | 'critical'
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `conflictInfo` | `ConflictInfo` | Conflict to analyze |

**Returns:** Severity level based on affected fields

**Severity Rules:**
- `critical`: Title, status, or ID fields affected
- `high`: Due date, priority, or completion state affected
- `medium`: Description, tags, or subtasks affected
- `low`: Metadata or non-essential fields only

#### canAutoResolve

Determines if a conflict can be automatically resolved.

```typescript
canAutoResolve(conflictInfo: ConflictInfo): boolean
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `conflictInfo` | `ConflictInfo` | Conflict to evaluate |

**Returns:** `true` if auto-resolution is safe

**Auto-Resolution Criteria:**
- No overlapping field changes
- No critical fields affected
- Timestamp-based resolution is deterministic
- Data integrity checksums match

#### getConflictingFields

Extracts the list of fields that differ between versions.

```typescript
getConflictingFields(
  localDoc: Record<string, any>,
  remoteDoc: Record<string, any>
): string[]
```

**Returns:** Array of field paths with differences

**Example:**
```typescript
const fields = detector.getConflictingFields(local, remote)
// Returns: ['title', 'subtasks.0.completed', 'updatedAt']
```

---

## ConflictResolution Class

Main class for resolving conflicts.

**Location**: `src/utils/conflictResolution.ts`

### Constructor

```typescript
constructor(options?: ConflictResolutionOptions)
```

#### ConflictResolutionOptions

```typescript
interface ConflictResolutionOptions {
  defaultStrategy?: ResolutionType
  customResolvers?: Record<string, FieldResolver>
  preserveHistory?: boolean
}

type FieldResolver = (localValue: any, remoteValue: any) => any
```

### Methods

#### resolveConflict

Resolves a conflict using the specified strategy.

```typescript
async resolveConflict(
  conflictInfo: ConflictInfo,
  strategy: ResolutionType,
  customResolutions?: Record<string, any>
): Promise<ResolutionResult>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `conflictInfo` | `ConflictInfo` | Conflict to resolve |
| `strategy` | `ResolutionType` | Resolution strategy to use |
| `customResolutions` | `Record<string, any>?` | Per-field custom values |

**Returns:** `Promise<ResolutionResult>` - Resolution outcome

**Example:**
```typescript
const resolution = new ConflictResolution()
const result = await resolution.resolveConflict(
  conflict,
  ResolutionType.MERGE,
  { title: 'Custom merged title' }
)

if (result.success) {
  await db.put(result.resolvedDocument)
}
```

#### analyzeFieldConflicts

Performs deep field-level conflict analysis.

```typescript
analyzeFieldConflicts(
  localDoc: Record<string, any>,
  remoteDoc: Record<string, any>
): ConflictDiff[]
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `localDoc` | `Record<string, any>` | Local document |
| `remoteDoc` | `Record<string, any>` | Remote document |

**Returns:** Array of `ConflictDiff` for each conflicting field

**Example:**
```typescript
const diffs = resolution.analyzeFieldConflicts(localTask, remoteTask)
diffs.forEach(diff => {
  console.log(`Field: ${diff.field}`)
  console.log(`  Local: ${diff.localValue}`)
  console.log(`  Remote: ${diff.remoteValue}`)
  console.log(`  Auto-resolvable: ${diff.autoResolvable}`)
})
```

#### suggestResolution

Suggests the best resolution strategy for a conflict.

```typescript
suggestResolution(conflictInfo: ConflictInfo): ResolutionType
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `conflictInfo` | `ConflictInfo` | Conflict to analyze |

**Returns:** Recommended `ResolutionType`

**Suggestion Logic:**
1. `MERGE_CANDIDATES` type ’ `MERGE`
2. No overlapping changes ’ `MERGE`
3. Remote is newer ’ `LAST_WRITE_WINS`
4. Critical fields affected ’ `MANUAL`

#### mergeDocuments

Performs smart merge of two document versions.

```typescript
mergeDocuments(
  localDoc: Record<string, any>,
  remoteDoc: Record<string, any>,
  fieldPreferences?: Record<string, 'local' | 'remote'>
): Record<string, any>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `localDoc` | `Record<string, any>` | Local document |
| `remoteDoc` | `Record<string, any>` | Remote document |
| `fieldPreferences` | `Record<string, 'local' \| 'remote'>?` | Per-field preference |

**Returns:** Merged document

**Example:**
```typescript
const merged = resolution.mergeDocuments(local, remote, {
  title: 'local',
  description: 'remote',
  subtasks: 'local'
})
```

#### applyResolution

Applies a resolution result to the database.

```typescript
async applyResolution(
  db: PouchDB.Database,
  result: ResolutionResult,
  conflictRevs: string[]
): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `db` | `PouchDB.Database` | Database instance |
| `result` | `ResolutionResult` | Resolution to apply |
| `conflictRevs` | `string[]` | Conflict revisions to delete |

---

## UI Component Props

### ConflictResolutionDialog

```typescript
interface ConflictResolutionDialogProps {
  taskConflict: TaskConflict
  onResolve: (resolutions: Record<string, any>) => void
  onCancel: () => void
}
```

**Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| `resolve` | `Record<string, any>` | Emitted with user's resolution choices |
| `cancel` | `void` | Emitted when user cancels resolution |

**Usage:**
```vue
<ConflictResolutionDialog
  :task-conflict="currentConflict"
  @resolve="handleResolution"
  @cancel="handleCancel"
/>
```

### ManualMergeModal

```typescript
interface ManualMergeModalProps {
  conflict: ConflictDiff
}
```

**Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| `save` | `any` | Emitted with manually merged value |
| `cancel` | `void` | Emitted when user cancels merge |

---

## Type Guards

Runtime type checking utilities.

### isConflictInfo

```typescript
function isConflictInfo(value: unknown): value is ConflictInfo
```

**Example:**
```typescript
if (isConflictInfo(data)) {
  // TypeScript knows data is ConflictInfo
  console.log(data.conflictingFields)
}
```

### isConflictType

```typescript
function isConflictType(value: unknown): value is ConflictType
```

### isResolutionType

```typescript
function isResolutionType(value: unknown): value is ResolutionType
```

---

## Usage Examples

### Basic Conflict Detection and Resolution

```typescript
import { ConflictDetector, ConflictResolution } from '@/utils'
import { ConflictType, ResolutionType } from '@/types/conflicts'

async function handleSync(db: PouchDB.Database, docId: string) {
  // Get document with conflicts
  const doc = await db.get(docId, { conflicts: true })

  // Detect conflicts
  const detector = new ConflictDetector()
  const conflict = detector.detectConflict(doc)

  if (!conflict) {
    console.log('No conflicts detected')
    return
  }

  // Analyze and resolve
  const resolution = new ConflictResolution()

  if (conflict.canAutoResolve) {
    const result = await resolution.resolveConflict(
      conflict,
      conflict.suggestedResolution || ResolutionType.LAST_WRITE_WINS
    )
    await resolution.applyResolution(db, result, doc._conflicts)
    console.log('Auto-resolved successfully')
  } else {
    // Show UI for manual resolution
    showConflictDialog(conflict)
  }
}
```

### Custom Field Resolver

```typescript
const resolution = new ConflictResolution({
  customResolvers: {
    // Always keep the longer description
    description: (local, remote) => {
      return (local?.length || 0) > (remote?.length || 0) ? local : remote
    },
    // Combine arrays without duplicates
    tags: (local, remote) => {
      return [...new Set([...(local || []), ...(remote || [])])]
    }
  }
})
```

### Reactive Conflict Monitoring

```typescript
import { ref, watchEffect } from 'vue'

const pendingConflicts = ref<ConflictInfo[]>([])
const detector = new ConflictDetector()

// Monitor sync changes
db.changes({
  live: true,
  include_docs: true,
  conflicts: true
}).on('change', (change) => {
  const conflict = detector.detectConflict(change.doc)
  if (conflict && !conflict.canAutoResolve) {
    pendingConflicts.value.push(conflict)
  }
})
```

---

## Error Handling

All methods may throw these errors:

| Error | Cause | Recovery |
|-------|-------|----------|
| `ConflictDetectionError` | Failed to parse conflict revisions | Retry with `{ conflicts: true }` |
| `ResolutionError` | Merge operation failed | Try alternative strategy |
| `DatabaseError` | PouchDB operation failed | Check database connection |
| `ChecksumError` | Data integrity validation failed | Fetch fresh document |

```typescript
try {
  const result = await resolution.resolveConflict(conflict, strategy)
} catch (error) {
  if (error instanceof ResolutionError) {
    // Fallback to manual resolution
    showConflictDialog(conflict)
  }
}
```

---

## See Also

- [Architecture Overview](./architecture-overview.md) - System design details
- [Integration Guide](./integration-guide.md) - Integration procedures
- [Understanding Conflicts](../01-user-guide/understanding-conflicts.md) - User guide
