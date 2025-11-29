# Resolution Algorithms

Deep dive into conflict resolution strategies and algorithms.

## Overview

Pomo-Flow supports six resolution strategies, each with specific algorithms for merging conflicting documents.

| Strategy | Algorithm | Auto-Resolution | Use Case |
|----------|-----------|-----------------|----------|
| LOCAL | Direct copy | Yes | Keep local changes |
| REMOTE | Direct copy | Yes | Accept remote changes |
| LAST_WRITE_WINS | Timestamp comparison | Yes | Simple conflicts |
| MERGE | Smart field merge | Yes | Non-overlapping changes |
| MANUAL | User selection | No | Complex conflicts |
| CUSTOM | User-defined | Configurable | Special cases |

---

## Strategy: LOCAL

### Algorithm

Simply returns the local version, discarding all remote changes.

```typescript
function resolveLocal(conflict: ConflictInfo): ResolutionResult {
  return {
    success: true,
    resolvedDocument: {
      ...conflict.localVersion.data,
      _rev: conflict.localVersion.rev
    },
    resolutionType: ResolutionType.LOCAL,
    fieldsResolved: conflict.conflictingFields,
    timestamp: Date.now()
  }
}
```

### When to Use

- User explicitly wants to keep their local work
- Remote version is known to be corrupted
- Offline-first priority

---

## Strategy: REMOTE

### Algorithm

Returns the remote version, discarding local changes.

```typescript
function resolveRemote(conflict: ConflictInfo): ResolutionResult {
  return {
    success: true,
    resolvedDocument: {
      ...conflict.remoteVersion.data,
      _rev: generateNewRev(conflict.remoteVersion.rev)
    },
    resolutionType: ResolutionType.REMOTE,
    fieldsResolved: conflict.conflictingFields,
    timestamp: Date.now()
  }
}
```

### When to Use

- Syncing from authoritative source
- Local changes were experimental
- Team member's version takes priority

---

## Strategy: LAST_WRITE_WINS

### Algorithm

Compares timestamps and uses the most recently updated version.

```typescript
function resolveLastWriteWins(conflict: ConflictInfo): ResolutionResult {
  const localTime = conflict.localVersion.updatedAt
  const remoteTime = conflict.remoteVersion.updatedAt

  const winner = localTime >= remoteTime
    ? conflict.localVersion
    : conflict.remoteVersion

  return {
    success: true,
    resolvedDocument: {
      ...winner.data,
      _rev: generateNewRev(winner.rev),
      _resolvedAt: Date.now(),
      _resolutionMethod: 'last_write_wins'
    },
    resolutionType: ResolutionType.LAST_WRITE_WINS,
    fieldsResolved: conflict.conflictingFields,
    timestamp: Date.now(),
    notes: `Used ${localTime >= remoteTime ? 'local' : 'remote'} version (newer by ${Math.abs(localTime - remoteTime)}ms)`
  }
}
```

### Timestamp Handling

```typescript
function getEffectiveTimestamp(version: DocumentVersion): number {
  // Priority order for timestamp sources
  return version.updatedAt
    || version.data.updatedAt
    || version.data.modifiedAt
    || extractTimestampFromRev(version.rev)
    || 0
}

function extractTimestampFromRev(rev: string): number {
  // Some CouchDB setups encode timestamp in rev
  // Format: "123-abc_1699876543210"
  const match = rev.match(/_(\d{13})$/)
  return match ? parseInt(match[1]) : 0
}
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Same timestamp | Prefer local (user's device) |
| Missing timestamp | Use revision number |
| Future timestamp | Cap at current time |
| Zero timestamp | Treat as oldest |

---

## Strategy: MERGE (Smart Merge)

### Algorithm Overview

The smart merge algorithm combines non-conflicting changes from both versions while flagging true conflicts for manual resolution.

```typescript
function resolveSmartMerge(conflict: ConflictInfo): ResolutionResult {
  const merged: Record<string, any> = {}
  const autoResolved: string[] = []
  const needsManual: string[] = []

  // Start with local as base
  const base = { ...conflict.localVersion.data }

  // Get all field differences
  const differences = analyzeFieldDifferences(
    conflict.localVersion.data,
    conflict.remoteVersion.data
  )

  for (const diff of differences) {
    const resolution = resolveField(diff, conflict)

    if (resolution.auto) {
      merged[diff.path] = resolution.value
      autoResolved.push(diff.path)
    } else {
      needsManual.push(diff.path)
    }
  }

  // Apply auto-resolved fields to base
  const resolvedDoc = applyFieldChanges(base, merged)

  return {
    success: needsManual.length === 0,
    resolvedDocument: resolvedDoc,
    resolutionType: ResolutionType.MERGE,
    fieldsResolved: autoResolved,
    timestamp: Date.now(),
    notes: needsManual.length > 0
      ? `${needsManual.length} fields need manual resolution`
      : 'Fully auto-merged'
  }
}
```

### Field Resolution Logic

```typescript
function resolveField(
  diff: FieldDifference,
  conflict: ConflictInfo
): { auto: boolean; value: any } {
  const { localValue, remoteValue, path } = diff

  // Case 1: Only one side changed
  if (localValue === getOriginalValue(path)) {
    return { auto: true, value: remoteValue }
  }
  if (remoteValue === getOriginalValue(path)) {
    return { auto: true, value: localValue }
  }

  // Case 2: Both changed to same value
  if (deepEqual(localValue, remoteValue)) {
    return { auto: true, value: localValue }
  }

  // Case 3: Array fields - try to merge
  if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
    const merged = mergeArrays(localValue, remoteValue)
    if (merged.success) {
      return { auto: true, value: merged.value }
    }
  }

  // Case 4: String fields - check for append-only
  if (typeof localValue === 'string' && typeof remoteValue === 'string') {
    const merged = mergeStrings(localValue, remoteValue)
    if (merged.success) {
      return { auto: true, value: merged.value }
    }
  }

  // Case 5: Nested objects
  if (isObject(localValue) && isObject(remoteValue)) {
    const merged = mergeObjects(localValue, remoteValue)
    if (merged.success) {
      return { auto: true, value: merged.value }
    }
  }

  // Cannot auto-resolve
  return { auto: false, value: null }
}
```

### Array Merge Algorithm

```typescript
function mergeArrays(
  local: any[],
  remote: any[]
): { success: boolean; value?: any[] } {
  // Check if items have IDs
  const hasIds = local.some(i => i?.id) || remote.some(i => i?.id)

  if (hasIds) {
    return mergeArraysById(local, remote)
  }

  // For primitive arrays, combine unique values
  if (isPrimitiveArray(local) && isPrimitiveArray(remote)) {
    const combined = [...new Set([...local, ...remote])]
    return { success: true, value: combined }
  }

  // Cannot safely merge complex arrays without IDs
  return { success: false }
}

function mergeArraysById(
  local: any[],
  remote: any[]
): { success: boolean; value?: any[] } {
  const result: any[] = []
  const seen = new Set<string>()

  // Index by ID
  const localMap = new Map(local.map(i => [i.id, i]))
  const remoteMap = new Map(remote.map(i => [i.id, i]))

  // Process all IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)

    if (localItem && remoteItem) {
      // Both have item - merge recursively
      const merged = mergeObjects(localItem, remoteItem)
      if (!merged.success) {
        return { success: false }
      }
      result.push(merged.value)
    } else {
      // Only one has item - keep it
      result.push(localItem || remoteItem)
    }

    seen.add(id)
  }

  return { success: true, value: result }
}
```

### String Merge Algorithm

```typescript
function mergeStrings(
  local: string,
  remote: string
): { success: boolean; value?: string } {
  // Check for append-only pattern
  if (remote.startsWith(local)) {
    return { success: true, value: remote }
  }
  if (local.startsWith(remote)) {
    return { success: true, value: local }
  }

  // Check for common prefix + different additions
  const commonPrefix = findCommonPrefix(local, remote)
  if (commonPrefix.length > 0) {
    const localSuffix = local.slice(commonPrefix.length)
    const remoteSuffix = remote.slice(commonPrefix.length)

    // Both added different content
    if (localSuffix && remoteSuffix) {
      return {
        success: true,
        value: commonPrefix + localSuffix + '\n' + remoteSuffix
      }
    }
  }

  // Cannot auto-merge
  return { success: false }
}

function findCommonPrefix(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++
  }
  return a.slice(0, i)
}
```

---

## Strategy: MANUAL

### Algorithm

Presents conflicts to user and applies their selections.

```typescript
function resolveManual(
  conflict: ConflictInfo,
  userSelections: Record<string, 'local' | 'remote' | any>
): ResolutionResult {
  const resolved: Record<string, any> = {
    ...conflict.localVersion.data // Start with local base
  }

  for (const [field, selection] of Object.entries(userSelections)) {
    if (selection === 'local') {
      resolved[field] = getNestedValue(conflict.localVersion.data, field)
    } else if (selection === 'remote') {
      resolved[field] = getNestedValue(conflict.remoteVersion.data, field)
    } else {
      // Custom value provided
      setNestedValue(resolved, field, selection)
    }
  }

  return {
    success: true,
    resolvedDocument: {
      ...resolved,
      _rev: generateNewRev(conflict.localVersion.rev)
    },
    resolutionType: ResolutionType.MANUAL,
    fieldsResolved: Object.keys(userSelections),
    timestamp: Date.now()
  }
}
```

### Nested Field Handling

```typescript
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined

    // Handle array notation: "items[0]" or "items[abc123]"
    const arrayMatch = key.match(/^(\w+)\[(.+)\]$/)
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch
      const array = current[arrayKey]
      if (!Array.isArray(array)) return undefined

      // Check if index is numeric or ID
      if (/^\d+$/.test(index)) {
        return array[parseInt(index)]
      } else {
        return array.find(item => item.id === index)
      }
    }

    return current[key]
  }, obj)
}

function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.')
  const lastPart = parts.pop()!

  let current = obj
  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {}
    }
    current = current[part]
  }

  current[lastPart] = value
}
```

---

## Strategy: CUSTOM

### Algorithm

Executes user-defined resolution functions.

```typescript
function resolveCustom(
  conflict: ConflictInfo,
  customResolvers: Record<string, FieldResolver>
): ResolutionResult {
  const resolved: Record<string, any> = {}
  const fieldsResolved: string[] = []

  for (const field of conflict.conflictingFields) {
    const resolver = customResolvers[field]

    if (resolver) {
      const localValue = getNestedValue(conflict.localVersion.data, field)
      const remoteValue = getNestedValue(conflict.remoteVersion.data, field)

      const context: ResolverContext = {
        localTimestamp: conflict.localVersion.updatedAt,
        remoteTimestamp: conflict.remoteVersion.updatedAt,
        localDevice: conflict.localVersion.updatedBy,
        remoteDevice: conflict.remoteVersion.updatedBy,
        conflictType: conflict.type,
        severity: conflict.severity
      }

      resolved[field] = resolver(localValue, remoteValue, context)
      fieldsResolved.push(field)
    }
  }

  // Merge with base document
  const finalDoc = {
    ...conflict.localVersion.data,
    ...resolved
  }

  return {
    success: true,
    resolvedDocument: finalDoc,
    resolutionType: ResolutionType.CUSTOM,
    fieldsResolved,
    timestamp: Date.now()
  }
}
```

### Resolver Context

```typescript
interface ResolverContext {
  localTimestamp: number
  remoteTimestamp: number
  localDevice?: string
  remoteDevice?: string
  conflictType: ConflictType
  severity: string
  originalValue?: any // From common ancestor if available
}

type FieldResolver = (
  localValue: any,
  remoteValue: any,
  context: ResolverContext
) => any
```

### Example Custom Resolvers

```typescript
const customResolvers: Record<string, FieldResolver> = {
  // Numeric: take maximum
  completedPomodoros: (local, remote) => Math.max(local || 0, remote || 0),

  // Progress: take higher percentage
  progress: (local, remote) => Math.max(local || 0, remote || 0),

  // Tags: combine unique
  tags: (local, remote) => [...new Set([...(local || []), ...(remote || [])])],

  // Status: priority order
  status: (local, remote) => {
    const priority = { done: 4, in_progress: 3, planned: 2, backlog: 1 }
    return priority[local] >= priority[remote] ? local : remote
  },

  // Description: prefer longer
  description: (local, remote) => {
    return (local?.length || 0) > (remote?.length || 0) ? local : remote
  }
}
```

---

## Revision Generation

### New Revision Algorithm

```typescript
function generateNewRev(baseRev: string): string {
  const [number] = baseRev.split('-')
  const newNumber = parseInt(number) + 1
  const hash = generateHash()

  return `${newNumber}-${hash}`
}

function generateHash(): string {
  // Generate random hash
  const chars = 'abcdef0123456789'
  let hash = ''
  for (let i = 0; i < 32; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)]
  }
  return hash
}
```

---

## Conflict Cleanup

### Delete Losing Revisions

```typescript
async function cleanupConflictRevisions(
  db: PouchDB.Database,
  docId: string,
  keptRev: string,
  conflictRevs: string[]
): Promise<void> {
  // Delete all losing revisions
  for (const rev of conflictRevs) {
    if (rev !== keptRev) {
      try {
        await db.remove(docId, rev)
      } catch (error) {
        // Revision may already be deleted
        if (error.status !== 404) {
          throw error
        }
      }
    }
  }

  // Compact to free space
  await db.compact()
}
```

---

## See Also

- [Conflict Detection](./conflict-detection.md) - How conflicts are detected
- [Data Flow](./data-flow.md) - End-to-end flow
- [Extending the System](../02-developer-guide/extending-the-system.md) - Custom strategies
