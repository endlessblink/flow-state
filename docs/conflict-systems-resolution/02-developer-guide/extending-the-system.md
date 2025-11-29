# Extending the System

How to extend and customize Pomo-Flow's conflict resolution system.

## Overview

The conflict resolution system is designed to be extensible at several levels:

1. **Custom Field Resolvers** - Per-field resolution logic
2. **New Conflict Types** - Additional conflict classifications
3. **Custom Resolution Strategies** - New resolution algorithms
4. **UI Customization** - Custom conflict display components

---

## Custom Field Resolvers

### Basic Custom Resolver

```typescript
import { ConflictResolution } from '@/utils'

const resolver = new ConflictResolution({
  customResolvers: {
    // Always keep the longer description
    description: (localValue, remoteValue) => {
      const localLen = localValue?.length || 0
      const remoteLen = remoteValue?.length || 0
      return localLen > remoteLen ? localValue : remoteValue
    }
  }
})
```

### Array Merger

```typescript
const resolver = new ConflictResolution({
  customResolvers: {
    // Combine tags without duplicates
    tags: (local, remote) => {
      const combined = [...(local || []), ...(remote || [])]
      return [...new Set(combined)]
    },

    // Merge subtasks by ID
    subtasks: (local, remote) => {
      const map = new Map()

      // Add all local subtasks
      for (const subtask of (local || [])) {
        map.set(subtask.id, subtask)
      }

      // Merge remote subtasks (newer wins)
      for (const subtask of (remote || [])) {
        const existing = map.get(subtask.id)
        if (!existing || subtask.updatedAt > existing.updatedAt) {
          map.set(subtask.id, subtask)
        }
      }

      return Array.from(map.values())
    }
  }
})
```

### Conditional Resolver

```typescript
const resolver = new ConflictResolution({
  customResolvers: {
    status: (local, remote, context) => {
      // If task is completed, always keep completed status
      if (local === 'done' || remote === 'done') {
        return 'done'
      }

      // Otherwise use most recent
      return context.localTimestamp > context.remoteTimestamp
        ? local
        : remote
    }
  }
})
```

---

## Adding New Conflict Types

### Step 1: Extend the Enum

```typescript
// src/types/conflicts.ts
export enum ConflictType {
  EDIT_EDIT = 'edit_edit',
  EDIT_DELETE = 'edit_delete',
  MERGE_CANDIDATES = 'merge_candidates',
  VERSION_MISMATCH = 'version_mismatch',
  CHECKSUM_MISMATCH = 'checksum_mismatch',
  // New type
  SCHEMA_MISMATCH = 'schema_mismatch'
}
```

### Step 2: Add Detection Logic

```typescript
// src/utils/conflictDetector.ts
class ConflictDetector {
  identifyConflictType(localDoc: any, remoteDoc: any): ConflictType {
    // Check for schema mismatch
    if (this.hasSchemaConflict(localDoc, remoteDoc)) {
      return ConflictType.SCHEMA_MISMATCH
    }

    // Existing logic...
  }

  private hasSchemaConflict(local: any, remote: any): boolean {
    const localVersion = local._schemaVersion || 1
    const remoteVersion = remote._schemaVersion || 1
    return localVersion !== remoteVersion
  }
}
```

### Step 3: Add Resolution Handler

```typescript
// src/utils/conflictResolution.ts
class ConflictResolution {
  async resolveConflict(conflict: ConflictInfo, strategy: ResolutionType) {
    switch (conflict.type) {
      case ConflictType.SCHEMA_MISMATCH:
        return this.resolveSchemaConflict(conflict)
      // Other cases...
    }
  }

  private async resolveSchemaConflict(conflict: ConflictInfo) {
    // Migrate older schema to newer
    const localVersion = conflict.localVersion.data._schemaVersion || 1
    const remoteVersion = conflict.remoteVersion.data._schemaVersion || 1

    if (localVersion > remoteVersion) {
      const migrated = await this.migrateSchema(
        conflict.remoteVersion.data,
        remoteVersion,
        localVersion
      )
      return this.mergeDocuments(conflict.localVersion.data, migrated)
    } else {
      const migrated = await this.migrateSchema(
        conflict.localVersion.data,
        localVersion,
        remoteVersion
      )
      return this.mergeDocuments(migrated, conflict.remoteVersion.data)
    }
  }
}
```

---

## Custom Resolution Strategies

### Step 1: Extend the Enum

```typescript
// src/types/conflicts.ts
export enum ResolutionType {
  LOCAL = 'local',
  REMOTE = 'remote',
  MERGE = 'merge',
  MANUAL = 'manual',
  LAST_WRITE_WINS = 'last_write_wins',
  CUSTOM = 'custom',
  // New strategies
  PRIORITY_BASED = 'priority_based',
  CONSENSUS = 'consensus'
}
```

### Step 2: Implement the Strategy

```typescript
// src/utils/resolutionStrategies.ts
export interface ResolutionStrategy {
  name: string
  canAutoResolve: boolean
  resolve(conflict: ConflictInfo): Promise<ResolutionResult>
}

export class PriorityBasedStrategy implements ResolutionStrategy {
  name = 'priority_based'
  canAutoResolve = true

  async resolve(conflict: ConflictInfo): Promise<ResolutionResult> {
    const localPriority = conflict.localVersion.data.priority
    const remotePriority = conflict.remoteVersion.data.priority

    // Higher priority wins
    const priorityOrder = { high: 3, medium: 2, low: 1, null: 0 }
    const useLocal = (priorityOrder[localPriority] || 0) >=
                     (priorityOrder[remotePriority] || 0)

    return {
      success: true,
      resolvedDocument: useLocal
        ? conflict.localVersion.data
        : conflict.remoteVersion.data,
      resolutionType: ResolutionType.PRIORITY_BASED,
      fieldsResolved: conflict.conflictingFields,
      timestamp: Date.now()
    }
  }
}
```

### Step 3: Register the Strategy

```typescript
// src/utils/conflictResolution.ts
import { PriorityBasedStrategy } from './resolutionStrategies'

class ConflictResolution {
  private strategies = new Map<ResolutionType, ResolutionStrategy>()

  constructor(options?: ConflictResolutionOptions) {
    // Register built-in strategies
    this.strategies.set(ResolutionType.LAST_WRITE_WINS, new LastWriteWinsStrategy())
    this.strategies.set(ResolutionType.MERGE, new SmartMergeStrategy())

    // Register custom strategies
    this.strategies.set(ResolutionType.PRIORITY_BASED, new PriorityBasedStrategy())

    // Allow user-provided strategies
    if (options?.customStrategies) {
      for (const [type, strategy] of Object.entries(options.customStrategies)) {
        this.strategies.set(type as ResolutionType, strategy)
      }
    }
  }

  async resolveConflict(conflict: ConflictInfo, strategy: ResolutionType) {
    const handler = this.strategies.get(strategy)
    if (!handler) {
      throw new Error(`Unknown resolution strategy: ${strategy}`)
    }
    return handler.resolve(conflict)
  }
}
```

---

## UI Customization

### Custom Diff Viewer

```vue
<!-- src/components/sync/CustomDiffViewer.vue -->
<template>
  <div class="custom-diff-viewer">
    <div
      v-for="(diff, index) in differences"
      :key="index"
      :class="['diff-line', diff.type]"
    >
      <span class="line-prefix">{{ diff.prefix }}</span>
      <span class="line-content">{{ diff.content }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { diffLines } from 'diff'

const props = defineProps<{
  localValue: string
  remoteValue: string
}>()

const differences = computed(() => {
  const diffs = diffLines(
    String(props.localValue || ''),
    String(props.remoteValue || '')
  )

  return diffs.map(part => ({
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
    prefix: part.added ? '+' : part.removed ? '-' : ' ',
    content: part.value
  }))
})
</script>

<style scoped>
.diff-line.added { background: #e6ffed; }
.diff-line.removed { background: #ffeef0; }
.line-prefix { font-family: monospace; margin-right: 8px; }
</style>
```

### Custom Field Editor

```vue
<!-- src/components/sync/PriorityFieldEditor.vue -->
<template>
  <div class="priority-editor">
    <div
      v-for="option in options"
      :key="option.value"
      class="priority-option"
      :class="{ selected: modelValue === option.value }"
      @click="$emit('update:modelValue', option.value)"
    >
      <span class="priority-icon" :style="{ color: option.color }">
        {{ option.icon }}
      </span>
      <span>{{ option.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string | null }>()
defineEmits<{ 'update:modelValue': [value: string | null] }>()

const options = [
  { value: 'high', label: 'High', icon: '!!!', color: '#ef4444' },
  { value: 'medium', label: 'Medium', icon: '!!', color: '#f59e0b' },
  { value: 'low', label: 'Low', icon: '!', color: '#10b981' },
  { value: null, label: 'None', icon: '-', color: '#6b7280' }
]
</script>
```

### Register Custom Components

```typescript
// src/components/sync/fieldEditors.ts
import type { Component } from 'vue'
import PriorityFieldEditor from './PriorityFieldEditor.vue'
import DateFieldEditor from './DateFieldEditor.vue'
import TagsFieldEditor from './TagsFieldEditor.vue'

export const fieldEditors: Record<string, Component> = {
  priority: PriorityFieldEditor,
  dueDate: DateFieldEditor,
  tags: TagsFieldEditor
}

export function getFieldEditor(fieldName: string): Component | null {
  return fieldEditors[fieldName] || null
}
```

---

## Plugin System

### Define Plugin Interface

```typescript
// src/types/conflictPlugins.ts
export interface ConflictPlugin {
  name: string
  version: string

  // Lifecycle hooks
  onConflictDetected?(conflict: ConflictInfo): void
  onResolutionStart?(conflict: ConflictInfo, strategy: ResolutionType): void
  onResolutionComplete?(result: ResolutionResult): void

  // Extension points
  customResolvers?: Record<string, FieldResolver>
  customStrategies?: Record<string, ResolutionStrategy>
  customValidators?: Record<string, FieldValidator>
}
```

### Create a Plugin

```typescript
// src/plugins/teamConflictPlugin.ts
import type { ConflictPlugin } from '@/types/conflictPlugins'

export const teamConflictPlugin: ConflictPlugin = {
  name: 'team-conflict-resolution',
  version: '1.0.0',

  onConflictDetected(conflict) {
    // Notify team members
    if (conflict.severity === 'critical') {
      notifyTeam(`Critical conflict in ${conflict.documentId}`)
    }
  },

  onResolutionComplete(result) {
    // Log for audit
    auditLog.record({
      type: 'conflict_resolved',
      documentId: result.resolvedDocument.id,
      strategy: result.resolutionType,
      timestamp: result.timestamp
    })
  },

  customResolvers: {
    assignee: (local, remote, context) => {
      // Keep the assignment made by team lead
      if (context.localUser.role === 'lead') return local
      if (context.remoteUser.role === 'lead') return remote
      return local // Default to local
    }
  }
}
```

### Register Plugin

```typescript
// src/utils/conflictResolution.ts
class ConflictResolution {
  private plugins: ConflictPlugin[] = []

  registerPlugin(plugin: ConflictPlugin) {
    this.plugins.push(plugin)

    // Merge custom resolvers
    if (plugin.customResolvers) {
      Object.assign(this.options.customResolvers, plugin.customResolvers)
    }

    // Register custom strategies
    if (plugin.customStrategies) {
      for (const [type, strategy] of Object.entries(plugin.customStrategies)) {
        this.strategies.set(type as ResolutionType, strategy)
      }
    }
  }

  private notifyPlugins(hook: keyof ConflictPlugin, ...args: any[]) {
    for (const plugin of this.plugins) {
      const fn = plugin[hook] as Function | undefined
      if (fn) fn.apply(plugin, args)
    }
  }
}
```

---

## Best Practices

### 1. Keep Resolvers Pure

```typescript
// Good - Pure function
const resolver = (local, remote) => {
  return local.length > remote.length ? local : remote
}

// Bad - Side effects
const resolver = (local, remote) => {
  console.log('Resolving...') // Side effect
  globalState.lastResolution = { local, remote } // Side effect
  return local
}
```

### 2. Handle Edge Cases

```typescript
const resolver = (local, remote) => {
  // Handle null/undefined
  if (local == null && remote == null) return null
  if (local == null) return remote
  if (remote == null) return local

  // Handle empty values
  if (local === '' && remote !== '') return remote
  if (remote === '' && local !== '') return local

  // Normal resolution
  return local.length > remote.length ? local : remote
}
```

### 3. Validate Results

```typescript
class ConflictResolution {
  async resolveConflict(conflict: ConflictInfo, strategy: ResolutionType) {
    const result = await this.executeStrategy(conflict, strategy)

    // Validate result
    this.validateResult(result, conflict)

    return result
  }

  private validateResult(result: ResolutionResult, conflict: ConflictInfo) {
    // Ensure all fields resolved
    for (const field of conflict.conflictingFields) {
      if (!(field in result.resolvedDocument)) {
        throw new Error(`Field ${field} not resolved`)
      }
    }

    // Ensure required fields present
    if (!result.resolvedDocument.id) {
      throw new Error('Resolved document missing ID')
    }
  }
}
```

### 4. Test Extensions

```typescript
describe('PriorityBasedStrategy', () => {
  it('prefers higher priority', async () => {
    const strategy = new PriorityBasedStrategy()
    const conflict = createMockConflict({
      localData: { priority: 'low' },
      remoteData: { priority: 'high' }
    })

    const result = await strategy.resolve(conflict)

    expect(result.resolvedDocument.priority).toBe('high')
  })

  it('handles null priorities', async () => {
    const strategy = new PriorityBasedStrategy()
    const conflict = createMockConflict({
      localData: { priority: null },
      remoteData: { priority: 'medium' }
    })

    const result = await strategy.resolve(conflict)

    expect(result.resolvedDocument.priority).toBe('medium')
  })
})
```

---

## See Also

- [Architecture Overview](./architecture-overview.md) - System design
- [API Reference](./api-reference.md) - Complete API documentation
- [Integration Guide](./integration-guide.md) - Basic integration
