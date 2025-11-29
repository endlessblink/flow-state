# Integration Guide

How to integrate the conflict resolution system into your Pomo-Flow components and workflows.

## Prerequisites

- Understanding of Vue 3 Composition API
- Familiarity with PouchDB/CouchDB sync
- Knowledge of TypeScript

---

## Quick Integration

### Basic Setup

```typescript
import { ConflictDetector, ConflictResolution } from '@/utils'
import { ConflictType, ResolutionType } from '@/types/conflicts'

// Create instances
const detector = new ConflictDetector()
const resolver = new ConflictResolution()

// Detect and resolve
async function handleDocument(doc: any) {
  const conflict = detector.detectConflict(doc)

  if (conflict?.canAutoResolve) {
    const result = await resolver.resolveConflict(
      conflict,
      ResolutionType.LAST_WRITE_WINS
    )
    return result.resolvedDocument
  }

  return doc
}
```

---

## Integration Points

### 1. Sync Event Handler

Integrate with PouchDB replication events:

```typescript
// src/composables/useSync.ts
import { ref } from 'vue'
import { ConflictDetector, ConflictResolution } from '@/utils'
import type { ConflictInfo } from '@/types/conflicts'

export function useSync(db: PouchDB.Database) {
  const pendingConflicts = ref<ConflictInfo[]>([])
  const detector = new ConflictDetector()

  // Monitor sync changes
  const changes = db.changes({
    live: true,
    since: 'now',
    include_docs: true,
    conflicts: true
  })

  changes.on('change', async (change) => {
    if (change.doc?._conflicts?.length) {
      const conflict = detector.detectConflict(change.doc)

      if (conflict && !conflict.canAutoResolve) {
        pendingConflicts.value.push(conflict)
      } else if (conflict) {
        await autoResolve(conflict)
      }
    }
  })

  async function autoResolve(conflict: ConflictInfo) {
    const resolver = new ConflictResolution()
    const result = await resolver.resolveConflict(
      conflict,
      conflict.suggestedResolution!
    )

    if (result.success) {
      await db.put(result.resolvedDocument)
      await deleteConflictRevisions(db, conflict)
    }
  }

  return {
    pendingConflicts,
    changes
  }
}
```

### 2. Store Integration

Integrate with Pinia task store:

```typescript
// src/stores/tasks.ts
import { defineStore } from 'pinia'
import { ConflictDetector } from '@/utils'
import type { ConflictInfo } from '@/types/conflicts'

export const useTaskStore = defineStore('tasks', () => {
  const conflicts = ref<Map<string, ConflictInfo>>(new Map())
  const detector = new ConflictDetector()

  // Check task for conflicts after sync
  function checkTaskConflict(task: Task & { _conflicts?: string[] }) {
    if (task._conflicts?.length) {
      const conflict = detector.detectConflict(task)
      if (conflict) {
        conflicts.value.set(task.id, conflict)
        return true
      }
    }
    conflicts.value.delete(task.id)
    return false
  }

  // Get conflict for specific task
  function getTaskConflict(taskId: string): ConflictInfo | undefined {
    return conflicts.value.get(taskId)
  }

  // Clear conflict after resolution
  function clearConflict(taskId: string) {
    conflicts.value.delete(taskId)
  }

  return {
    conflicts,
    checkTaskConflict,
    getTaskConflict,
    clearConflict
  }
})
```

### 3. Component Integration

Add conflict UI to task components:

```vue
<!-- src/components/TaskCard.vue -->
<template>
  <div class="task-card" :class="{ 'has-conflict': hasConflict }">
    <!-- Task content -->
    <div class="task-content">
      {{ task.title }}
    </div>

    <!-- Conflict indicator -->
    <div v-if="hasConflict" class="conflict-indicator" @click="openConflictDialog">
      <WarningIcon />
      <span>Sync Conflict</span>
    </div>

    <!-- Conflict dialog -->
    <ConflictResolutionDialog
      v-if="showDialog"
      :task-conflict="taskConflict"
      @resolve="handleResolution"
      @cancel="showDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import ConflictResolutionDialog from '@/components/sync/ConflictResolutionDialog.vue'

const props = defineProps<{ task: Task }>()
const taskStore = useTaskStore()
const showDialog = ref(false)

const hasConflict = computed(() =>
  taskStore.conflicts.has(props.task.id)
)

const taskConflict = computed(() =>
  taskStore.getTaskConflict(props.task.id)
)

function openConflictDialog() {
  showDialog.value = true
}

async function handleResolution(resolutions: Record<string, any>) {
  // Apply resolutions to task
  await taskStore.applyConflictResolution(props.task.id, resolutions)
  showDialog.value = false
}
</script>
```

---

## Notification Integration

### Show Conflict Notifications

```typescript
// src/composables/useConflictNotifications.ts
import { watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useNotificationStore } from '@/stores/notifications'

export function useConflictNotifications() {
  const taskStore = useTaskStore()
  const notifications = useNotificationStore()

  watch(
    () => taskStore.conflicts.size,
    (newCount, oldCount) => {
      if (newCount > oldCount) {
        const added = newCount - oldCount
        notifications.show({
          type: 'warning',
          title: 'Sync Conflicts Detected',
          message: `${added} new conflict${added > 1 ? 's' : ''} need resolution`,
          action: {
            label: 'Review',
            handler: () => openConflictReview()
          }
        })
      }
    }
  )
}
```

---

## Database Operations

### Delete Conflict Revisions

After resolution, clean up old revisions:

```typescript
async function deleteConflictRevisions(
  db: PouchDB.Database,
  conflict: ConflictInfo
) {
  const doc = await db.get(conflict.documentId, { conflicts: true })

  if (doc._conflicts) {
    for (const rev of doc._conflicts) {
      await db.remove(conflict.documentId, rev)
    }
  }
}
```

### Force Sync After Resolution

```typescript
async function syncAfterResolution(db: PouchDB.Database) {
  // Push resolved documents
  await db.sync(remoteDb, {
    push: true,
    pull: false
  })

  // Then pull to verify
  await db.sync(remoteDb, {
    push: false,
    pull: true
  })
}
```

---

## Error Handling

### Wrap Operations

```typescript
import { ConflictDetectionError, ResolutionError } from '@/utils/errors'

async function safeResolve(conflict: ConflictInfo) {
  try {
    const result = await resolver.resolveConflict(conflict, strategy)
    return result
  } catch (error) {
    if (error instanceof ResolutionError) {
      // Fallback to manual resolution
      showManualDialog(conflict)
    } else if (error instanceof ConflictDetectionError) {
      // Re-fetch document
      await refetchDocument(conflict.documentId)
    } else {
      // Generic error handling
      notifications.error('Failed to resolve conflict')
    }
  }
}
```

### Retry Logic

```typescript
async function resolveWithRetry(
  conflict: ConflictInfo,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await resolver.resolveConflict(conflict, strategy)
    } catch (error) {
      if (attempt === maxRetries) throw error
      await delay(1000 * attempt) // Exponential backoff
    }
  }
}
```

---

## Testing Integration

### Mock Conflict Data

```typescript
// tests/mocks/conflicts.ts
import { ConflictType, ResolutionType } from '@/types/conflicts'
import type { ConflictInfo } from '@/types/conflicts'

export const mockConflict: ConflictInfo = {
  id: 'conflict-1',
  documentId: 'task-123',
  type: ConflictType.EDIT_EDIT,
  localVersion: {
    rev: '2-abc',
    data: { title: 'Local Title', status: 'in_progress' },
    updatedAt: Date.now()
  },
  remoteVersion: {
    rev: '2-xyz',
    data: { title: 'Remote Title', status: 'in_progress' },
    updatedAt: Date.now() - 1000
  },
  conflictingFields: ['title'],
  severity: 'medium',
  detectedAt: Date.now(),
  canAutoResolve: false,
  suggestedResolution: ResolutionType.MANUAL
}
```

### Component Test

```typescript
// tests/components/ConflictResolutionDialog.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ConflictResolutionDialog from '@/components/sync/ConflictResolutionDialog.vue'
import { mockConflict } from '../mocks/conflicts'

describe('ConflictResolutionDialog', () => {
  it('displays conflict fields', () => {
    const wrapper = mount(ConflictResolutionDialog, {
      props: {
        taskConflict: {
          localTask: mockConflict.localVersion.data,
          remoteTask: mockConflict.remoteVersion.data,
          conflicts: [{ field: 'title', localValue: 'Local', remoteValue: 'Remote' }],
          priority: 'medium',
          canAutoMerge: false
        }
      }
    })

    expect(wrapper.text()).toContain('title')
    expect(wrapper.text()).toContain('Local')
    expect(wrapper.text()).toContain('Remote')
  })

  it('emits resolve with selections', async () => {
    const wrapper = mount(ConflictResolutionDialog, { /* ... */ })

    await wrapper.find('.select-local').trigger('click')
    await wrapper.find('.apply').trigger('click')

    expect(wrapper.emitted('resolve')).toBeTruthy()
  })
})
```

---

## Performance Considerations

### Batch Processing

For many conflicts:

```typescript
async function batchResolve(conflicts: ConflictInfo[]) {
  const BATCH_SIZE = 10

  for (let i = 0; i < conflicts.length; i += BATCH_SIZE) {
    const batch = conflicts.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(c => resolver.resolveConflict(c, ResolutionType.LAST_WRITE_WINS))
    )
  }
}
```

### Lazy Loading Dialog

```typescript
const ConflictResolutionDialog = defineAsyncComponent(() =>
  import('@/components/sync/ConflictResolutionDialog.vue')
)
```

---

## Checklist

Before going live:

- [ ] Sync event handler integrated
- [ ] Store tracks pending conflicts
- [ ] UI shows conflict indicators
- [ ] Notifications for new conflicts
- [ ] Error handling in place
- [ ] Conflict cleanup after resolution
- [ ] Tests for critical paths
- [ ] Performance tested with many conflicts

---

## See Also

- [Architecture Overview](./architecture-overview.md) - System design
- [API Reference](./api-reference.md) - Complete API docs
- [Extending the System](./extending-the-system.md) - Custom strategies
