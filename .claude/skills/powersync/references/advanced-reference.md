# PowerSync Advanced Reference

Deep explanations of architecture decisions, security implications, and advanced patterns.

---

## 1. Why COOP/COEP Headers Are Required

### The Technical Background

PowerSync uses SQLite compiled to WebAssembly (WASM) for high-performance local storage. The fastest storage option is OPFS (Origin Private File System), which requires `SharedArrayBuffer`.

**The Security Chain:**
1. `SharedArrayBuffer` enables shared memory between threads
2. Due to Spectre/Meltdown vulnerabilities, browsers restrict `SharedArrayBuffer`
3. To enable it, your page must be in a "cross-origin isolated" state
4. Cross-origin isolation requires COOP + COEP headers

### Header Meanings

| Header | Value | Purpose |
|--------|-------|---------|
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents your document from sharing a browsing context group with cross-origin documents |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Prevents the document from loading cross-origin resources without explicit permission |

### Impact on External Resources

If you load images from external CDNs (like S3 or Cloudinary), those resources must also serve:

```
Cross-Origin-Resource-Policy: cross-origin
```

If they don't, they will fail to load in your app.

---

## 2. SSR Architecture: The "Safe Loader" Pattern

### The Problem

Frameworks like Next.js and Nuxt try to run your code in Node.js during:
- **SSG (Static Site Generation)**: Build time
- **SSR (Server-Side Rendering)**: Request time

PowerSync SDK imports `@journeyapps/wa-sqlite`, which attempts to access browser-only APIs:
- `navigator.userAgent`
- `self.importScripts`

Node.js throws: `ReferenceError: navigator is not defined`

### The Solution: Dynamic Import Isolation

**Never import the database at the top level of any file that might run on the server.**

#### Bad Pattern (Crashes Server Build)

```typescript
// Component.vue
import { db } from './database' // Crashes server build!
```

#### Good Pattern (Browser-Only)

```typescript
// Component.vue
onMounted(async () => {
  const { db } = await import('./database') // Only runs in browser
  await db.init()
})
```

---

## 3. OPFS vs IndexedDB Performance

### Storage Options

| VFS Type | Performance | Requirements |
|----------|-------------|--------------|
| `WASQLiteVFS.OPFSCoopSyncVFS` | Native SQLite speed | COOP/COEP headers |
| `WASQLiteVFS.IDBBatchAtomicVFS` | Slower (IndexedDB) | No special headers |

### When OPFS Fails

If COOP/COEP headers are missing:
- PowerSync falls back to IndexedDB automatically
- Performance is significantly slower
- Multi-tab sync may not work correctly

### Detecting VFS Mode

```typescript
const db = getDatabase()
console.log('Using VFS:', db.database.options.vfs)
// OPFSCoopSyncVFS = fast, IDBBatchAtomicVFS = slow fallback
```

---

## 4. Multi-Tab Concurrency Architecture

### The Problem

By default, SQLite on the web locks the database file. If Tab A is writing, Tab B cannot read.

### The Solution

`WASQLiteVFS.OPFSCoopSyncVFS` + `enableMultiTabs: true`

### How It Works

1. **SharedWorker**: Serializes access to the OPFS file handle
2. **Message Passing**: Tabs communicate through the SharedWorker
3. **Instant Updates**: Changes in Tab A trigger `db.watch()` in Tab B

### Result

Users can have 10+ tabs open; a change in one reflects in all others instantly.

---

## 5. Optimistic UI Architecture

### Goal

Make the app feel "instant" even on 3G connections.

### How It Works

1. **Local Write**: UI updates immediately because `db.watch()` triggers on local INSERT
2. **Background Sync**: The `Connector.uploadData()` method runs asynchronously
3. **Eventual Consistency**: If the server rejects the change, PowerSync rolls back the local transaction (or you handle the conflict)

### Implementation Pattern

```typescript
// 1. Generate ID locally
import { v4 as uuidv4 } from 'uuid/dist/esm-browser/index.js'
const id = uuidv4()

// 2. Insert immediately (optimistic)
await db.execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, 'New Task'])

// 3. UI updates instantly via watch()
// 4. PowerSync syncs in background
// 5. If server rejects, handle conflict or rollback
```

---

## 6. Testing Architecture

### The Challenge

Standard test runners (Vitest, Jest) run in Node.js (JSDOM), which cannot:
- Execute binary WASM files
- Spawn real Web Workers

### Testing Strategy

| Test Type | Environment | What to Test |
|-----------|-------------|--------------|
| **Unit Tests** | Vitest/Jest (mocked) | Your application logic |
| **Integration Tests** | Playwright/Cypress (real browser) | Real WASM, real Worker |

### Advanced Mock Pattern

This mock simulates data updates for testing reactive UI:

```typescript
// __mocks__/@powersync/web.ts
import { vi } from 'vitest'

const subscribers = new Set<() => void>()

export class PowerSyncDatabase {
  // Simulate a live query
  watch(sql: string) {
    return {
      [Symbol.asyncIterator]: async function* () {
        // Yield initial empty state
        yield { rows: { _array: [] } }

        // Listen for "fake" updates
        while (true) {
          await new Promise<void>(r => subscribers.add(r))
          yield { rows: { _array: [{ id: 'mock-1', name: 'Updated' }] } }
        }
      }
    }
  }

  // Trigger a fake update for tests
  static emitChange() {
    subscribers.forEach(r => r())
    subscribers.clear()
  }
}
```

### Using in Tests

```typescript
import { PowerSyncDatabase } from '@powersync/web'

test('UI updates when data changes', async () => {
  // ... render component with watch()

  // Simulate a database change
  PowerSyncDatabase.emitChange()

  // Assert UI updated
  expect(screen.getByText('Updated')).toBeInTheDocument()
})
```

---

## 7. Conflict Resolution Patterns

### When Conflicts Occur

1. User edits offline
2. Another user edits the same record online
3. First user comes back online
4. PowerSync detects the conflict

### Resolution Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Last-Write-Wins** | Latest timestamp wins | Simple apps, low conflict risk |
| **Server-Wins** | Server version always wins | Authoritative server data |
| **Client-Wins** | Client version always wins | User experience priority |
| **Merge** | Combine changes intelligently | Complex data structures |
| **User-Prompt** | Ask user to resolve | Critical data, transparency |

### Implementation

```typescript
// In your Connector class
async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
  const batch = await database.getCrudBatch(100)
  if (!batch) return

  for (const op of batch.crud) {
    try {
      await this.uploadOperation(op)
    } catch (error) {
      if (error.status === 409) {
        // Conflict detected
        await this.resolveConflict(op)
      }
    }
  }

  await batch.complete()
}
```

---

## 8. Debugging Tips

### Check VFS Mode

```javascript
// Browser console
const db = window.__POWERSYNC_DB__
console.log('VFS:', db?.database?.options?.vfs)
```

### Check Headers

```javascript
// Browser console
console.log('Cross-Origin-Isolated:', crossOriginIsolated)
// true = OPFS enabled, false = IndexedDB fallback
```

### Check Worker Status

```javascript
// Browser DevTools -> Application -> Service Workers
// Look for wa-sqlite worker
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slow writes | Missing COOP/COEP | Add deployment headers |
| Worker 404 | Missing assets | Run `npx powersync-sdk-web copy-assets` |
| SSR crash | Top-level import | Use dynamic import in `onMounted` |
| Tests crash | WASM in Node.js | Add mock file + alias |
