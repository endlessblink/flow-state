# Offline-First Cloud Sync Architecture

## Overview

Pomo-Flow uses a **hybrid offline-first approach** where all data is stored locally in IndexedDB and optionally synced to cloud storage when online.

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                  User Interface                      │
│         (Vue 3 Components + Pinia Stores)           │
└─────────────────┬──────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────┐
│              Sync Coordinator                       │
│  • Operation Queue                                  │
│  • Conflict Detection                               │
│  • Retry Logic                                      │
└─────────────────┬──────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │                           │
┌───▼────────────┐      ┌──────▼──────────┐
│   IndexedDB    │      │  Cloud Storage   │
│  (Primary)     │      │  (Backup/Sync)   │
│                │      │                  │
│  • Tasks       │      │  • JSONBin       │
│  • Attachments │      │  • GitHub Gist   │
│  • Comments    │      │  • Supabase*     │
│  • Metadata    │      │  • Firebase*     │
└────────────────┘      └──────────────────┘
```

## Data Flow

### 1. Write Operation (User Creates/Updates Task)

```typescript
User Action (e.g., Edit Task)
  ↓
Pinia Store Action (updateTask)
  ↓
1. Write to IndexedDB immediately (optimistic)
  ↓
2. Add to sync queue with operation metadata
  ↓
3. Update UI instantly (no loading state)
  ↓
4. Background: Attempt cloud sync when online
  ↓
5. On success: Mark operation as synced
   On failure: Keep in queue, retry later
```

### 2. Read Operation (User Views Data)

```typescript
User Navigation (e.g., Open Board View)
  ↓
Pinia Store Getter
  ↓
Read from IndexedDB (instant, always available)
  ↓
Display in UI
  ↓
Background: Check for cloud updates (if online)
  ↓
If newer data found: Merge and refresh UI
```

### 3. Sync Operation (Online → Pull Changes)

```typescript
Network Status: ONLINE
  ↓
1. Fetch cloud data (with last-sync timestamp)
  ↓
2. Compare timestamps
  ↓
3. Detect conflicts (same task edited on multiple devices)
  ↓
4. Auto-resolve: Last-Write-Wins (LWW)
  ↓
5. Update IndexedDB with merged data
  ↓
6. Refresh Pinia stores
  ↓
7. Show sync status indicator in UI
```

## Conflict Resolution Strategy

### Conflict Detection

A conflict occurs when:
- Same task edited on Device A and Device B
- Both offline at time of edit
- Both sync when online

### Resolution Algorithm: Last-Write-Wins (LWW)

```typescript
interface SyncedTask extends Task {
  lastModifiedBy: string      // Device ID
  lastModifiedAt: number       // Unix timestamp
  syncVersion: number          // Incremented on each sync
}

function resolveConflict(local: SyncedTask, remote: SyncedTask): SyncedTask {
  // Simple LWW based on timestamp
  if (remote.lastModifiedAt > local.lastModifiedAt) {
    return remote // Remote wins
  } else if (remote.lastModifiedAt < local.lastModifiedAt) {
    return local // Local wins
  } else {
    // Same timestamp - use device ID as tiebreaker
    return remote.lastModifiedBy > local.lastModifiedBy ? remote : local
  }
}
```

### Field-Level Merging (Advanced)

For critical fields, merge at field level instead of full object:

```typescript
function mergeTask(local: Task, remote: Task): Task {
  return {
    ...remote, // Start with remote as base

    // Keep local pomodoro count if higher (can't decrease)
    completedPomodoros: Math.max(
      local.completedPomodoros,
      remote.completedPomodoros
    ),

    // Merge subtasks (union of both)
    subtasks: mergeSubtasks(local.subtasks, remote.subtasks),

    // Merge attachments (union of both)
    attachments: mergeAttachments(local.attachments, remote.attachments),

    // Use latest modification time
    lastModifiedAt: Math.max(local.lastModifiedAt, remote.lastModifiedAt)
  }
}
```

## Operation Queue System

### Queue Structure

```typescript
interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'task' | 'project' | 'attachment' | 'comment'
  entityId: string
  data: any
  timestamp: number
  deviceId: string
  retryCount: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  error?: string
}
```

### Queue Storage

Store in IndexedDB table: `sync_queue`

```typescript
// Add operation to queue
const queueOperation = async (operation: QueuedOperation) => {
  await db.sync_queue.add(operation)
  triggerSyncIfOnline()
}

// Process queue (called when online)
const processQueue = async () => {
  const pending = await db.sync_queue
    .where('status').equals('pending')
    .sortBy('timestamp') // FIFO order

  for (const op of pending) {
    try {
      await uploadToCloud(op)
      await db.sync_queue.update(op.id, { status: 'synced' })
    } catch (error) {
      await db.sync_queue.update(op.id, {
        status: op.retryCount > 3 ? 'failed' : 'pending',
        retryCount: op.retryCount + 1,
        error: error.message
      })
    }
  }
}
```

## Attachment Sync Strategy

Attachments (images, PDFs, etc.) require special handling due to size.

### Small Files (<1MB)

- Store in IndexedDB as Blob
- Sync directly to cloud as base64

### Large Files (>1MB)

- Store in IndexedDB as Blob
- Upload to cloud storage (Cloudflare R2, S3)
- Store only URL/reference in synced data
- Lazy download on other devices when needed

```typescript
interface Attachment {
  id: string
  taskId: string
  name: string
  type: string
  size: number

  // Storage strategy
  storage: 'indexeddb' | 'cloud_url'

  // For local storage
  blob?: Blob

  // For cloud storage
  cloudUrl?: string
  cloudProvider?: 'r2' | 's3' | 'gcs'

  // Sync metadata
  isSynced: boolean
  lastSyncedAt?: number
}
```

## Cloud Provider Options

### Current (JSONBin + GitHub Gist)

**Pros:**
- Free tier available
- Simple REST API
- No auth complexity

**Cons:**
- No real-time sync
- Limited storage (JSONBin: 100KB/bin, Gist: 1MB)
- No file attachment support

### Recommended Upgrade: Supabase

**Pros:**
- Free tier: 500MB database + 1GB storage
- Real-time subscriptions (for future multi-user)
- File storage built-in
- PostgreSQL backend (better queries)
- Offline-first SDK available

**Cons:**
- Requires account setup
- More complex than JSONBin

### Alternative: Firebase

**Pros:**
- Generous free tier
- Excellent offline support
- Mature SDK
- Easy to set up

**Cons:**
- Google account required
- Vendor lock-in

## Migration Path

### Phase 1: Current State (DONE)
✅ IndexedDB for local storage
✅ JSONBin/Gist for cloud backup
✅ Manual sync triggers

### Phase 2: Enhanced Sync (IN PROGRESS)
- [ ] Operation queue system
- [ ] Automatic conflict resolution
- [ ] Background sync worker
- [ ] Sync status UI indicators

### Phase 3: Supabase Integration (FUTURE)
- [ ] Migrate to Supabase backend
- [ ] Real-time subscriptions
- [ ] File attachment cloud storage
- [ ] Multi-device presence

### Phase 4: Collaborative Features (FUTURE)
- [ ] Real-time collaboration (YJS)
- [ ] User authentication
- [ ] Team workspaces
- [ ] Permission system

## Sync Status UI

### Indicators

```vue
<template>
  <div class="sync-status-bar">
    <!-- Offline Mode -->
    <div v-if="!isOnline" class="status offline">
      📴 Offline - Changes will sync when online
    </div>

    <!-- Syncing -->
    <div v-else-if="isSyncing" class="status syncing">
      ⏳ Syncing {{queuedCount}} changes...
    </div>

    <!-- Up to Date -->
    <div v-else-if="isUpToDate" class="status synced">
      ✅ All changes synced - Last sync: {{lastSyncTime}}
    </div>

    <!-- Sync Failed -->
    <div v-else-if="hasSyncError" class="status error">
      ⚠️ Sync failed - {{errorMessage}}
      <button @click="retrySyncClick">Retry</button>
    </div>
  </div>
</template>
```

### Manual Controls

```vue
<template>
  <div class="sync-controls">
    <button @click="syncNow" :disabled="!isOnline">
      🔄 Sync Now
    </button>

    <button @click="viewQueue">
      📋 View Queue ({{queuedCount}})
    </button>

    <button @click="clearCache">
      🗑️ Clear Local Cache
    </button>

    <button @click="exportData">
      💾 Export Backup
    </button>
  </div>
</template>
```

## Performance Considerations

### Bandwidth Optimization

1. **Delta Sync**: Only sync changed fields, not entire objects
2. **Compression**: Use gzip for large JSON payloads
3. **Batching**: Group multiple operations into single sync request
4. **Throttling**: Limit sync frequency (max every 5 minutes)

### Storage Optimization

1. **Cleanup old sync operations** from queue after 30 days
2. **Compress attachments** before storage (WebP for images)
3. **Lazy load attachments** - download only when viewed
4. **IndexedDB quota monitoring** - warn at 80% usage

## Security Considerations

### Data Encryption (Future)

For sensitive data, implement end-to-end encryption:

```typescript
// Encrypt before syncing
const encryptedData = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: generateIV() },
  userKey,
  JSON.stringify(taskData)
)

// Decrypt after downloading
const decryptedData = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: storedIV },
  userKey,
  encryptedData
)
```

### API Key Management

- Store API keys securely in localStorage
- Never commit keys to git
- Provide UI for users to set their own keys
- Support environment variables for deployment

## Testing Strategy

### Offline Scenarios

1. Create task while offline → Go online → Verify sync
2. Edit task on Device A → Edit same task on Device B → Verify conflict resolution
3. Delete task offline → Go online → Verify deletion syncs
4. Upload attachment offline → Go online → Verify upload

### Network Conditions

1. Slow connection (throttle to 3G)
2. Intermittent connection (on/off every 10s)
3. Network timeout during sync
4. Invalid API keys or expired tokens

### Data Integrity

1. Verify no data loss during conflicts
2. Verify attachment Blobs don't corrupt
3. Verify timestamps are consistent across devices
4. Verify queue operations are idempotent

---

**Last Updated**: 2025-01-27
**Status**: Enhanced sync architecture with operation queue and conflict resolution
