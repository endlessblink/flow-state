# PowerSync Web SDK + Vite Configuration Guide (v3)

Complete Production-Ready Setup for local-first applications with native-speed SQLite.

## Key Features in v3

| Feature | Implementation |
|---------|----------------|
| **Deployment** | Vercel/Netlify configuration for OPFS headers |
| **Patterns** | Offline UX, conflict resolution, multi-tab sync |
| **Performance** | OPFS headers (COOP/COEP) for high-speed SQLite |
| **SSR Safety** | Guards for Next.js/Nuxt |
| **Testing** | Vitest mocking strategies |

---

## 1. Installation

```bash
npm install @powersync/web @journeyapps/wa-sqlite js-logger
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

---

## 2. vite.config.ts (Definitive Configuration)

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue' // or @vitejs/plugin-react
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait()
  ],

  // PERFORMANCE: Headers required for OPFS (High-Performance Storage)
  // These headers enable SharedArrayBuffer, required for the high-speed WASQLiteVFS
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },

  resolve: {
    alias: {
      // Fix: uuid CommonJS -> ESM interop
      'uuid': path.resolve(__dirname, 'node_modules/uuid/dist/esm-browser/index.js'),
    }
  },

  optimizeDeps: {
    // EXCLUDE: These contain WASM + workers that Vite shouldn't pre-bundle
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
    // INCLUDE: Ensure transitive dependencies are bundled
    include: ['js-logger'],
    // INTEROP: Force ESM interop for CJS modules
    needsInterop: ['uuid']
  },

  build: {
    rollupOptions: {
      output: { format: 'es' } // Workers MUST be ES modules, not IIFE
    },
    commonjsOptions: {
      include: [/node_modules/]
    }
  },

  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  }
})
```

---

## 3. Database Setup with OPFS & SSR Guards

This configuration enables native-speed SQLite (OPFS) while preventing crashes in Server-Side Rendering (SSR) environments like Next.js or Nuxt.

```typescript
// src/database.ts
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web'
import { Connector } from './connector'
import { AppSchema } from './schema'

// 1. Singleton instance
let db: PowerSyncDatabase | null = null

export function getDatabase(): PowerSyncDatabase {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: new WASQLiteOpenFactory({
        dbFilename: 'app.db',
        workerUri: '/powersync/wa-sqlite.worker.js',

        // ENABLE OPFS (High Performance)
        // Requires COOP/COEP headers to work
        vfs: WASQLiteVFS.OPFSCoopSyncVFS,
        flags: {
          enableMultiTabs: true // Required for concurrent tab access
        }
      })
    })
  }
  return db
}

// 2. SSR-Safe Initialization
export async function initPowerSync() {
  // SERVER GUARD: Prevent execution in Node.js/Server environments
  if (typeof window === 'undefined') return null;

  const database = getDatabase()
  const connector = new Connector()

  try {
    await database.connect(connector)
    console.log('PowerSync connected')
  } catch (error) {
    console.error('PowerSync connection failed:', error)
  }

  return database
}
```

---

## 4. Deployment Configuration

To maintain high performance in production, your hosting provider must serve the COOP and COEP headers. Without these, the app will fall back to slow IndexedDB.

### Vercel (vercel.json)

Create this file in your project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

### Netlify (netlify.toml)

Create this file in your project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

---

## 5. Testing Strategy (Vitest)

Web Workers and WASM fail in standard Node.js test environments. Use this mock to test your UI logic without crashing.

### Mock File: `src/__mocks__/@powersync/web.ts`

```typescript
import { vi } from 'vitest'

export class PowerSyncDatabase {
  connect = vi.fn().mockResolvedValue(undefined)
  disconnect = vi.fn()
  execute = vi.fn().mockResolvedValue({ rows: { _array: [] } })
  getAll = vi.fn().mockResolvedValue([])
  get = vi.fn().mockResolvedValue(null)

  // Mock the watcher to return an empty async iterator
  watch = vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield { rows: { _array: [] } }
    }
  })

  onChange = vi.fn()
}

export const WASQLiteOpenFactory = vi.fn()
export const AbstractPowerSyncDatabase = vi.fn()
export const column = { text: 'text', integer: 'integer', real: 'real' }
export class Table { constructor(cols: any) {} }
export class Schema { constructor(tables: any) {} }
```

### In vitest.config.ts:

```typescript
export default defineConfig({
  test: {
    alias: {
      '@powersync/web': path.resolve(__dirname, './src/__mocks__/@powersync/web.ts')
    }
  }
})
```

---

## 6. Real-World Production Patterns

### Pattern A: Multi-Tab Sync

When a user has your app open in multiple tabs, data must stay in sync.

- **Config**: `enableMultiTabs: true` in WASQLiteOpenFactory (see Section 3)
- **Behavior**: Writes in Tab A instantly appear in Tab B via SharedWorker/OPFS
- **Requirement**: COOP/COEP headers must be active

### Pattern B: Optimistic Updates (Offline UX)

Don't wait for the server. Show changes instantly.

1. **Generate UUID locally**: `import { v4 as uuidv4 } from 'uuid/dist/esm-browser/index.js'`
2. **Insert to DB**: `await db.execute('INSERT INTO tasks (id, ...) VALUES (?, ...)', [uuidv4(), ...])`
3. **UI Updates**: The `db.watch()` query updates immediately
4. **Sync**: PowerSync handles the background upload when online

### Pattern C: Connection Status Indicator

Give users confidence in the system state.

```typescript
import { ref } from 'vue'

const syncStatus = ref({ connected: false, downloading: false, uploading: false })

db.onChange((status) => {
  syncStatus.value = status
})
```

**UI Template:**
- `connected`: Online
- `!connected`: Offline (Changes saved locally)
- `uploading`: Syncing...

---

## Summary

| Feature | Implementation | File |
|---------|----------------|------|
| Config | vite.config.ts with WASM/TopLevelAwait | vite.config.ts |
| Performance | WASQLiteVFS.OPFSCoopSyncVFS | database.ts |
| Deployment | COOP/COEP Headers | vercel.json / netlify.toml |
| Safety | `typeof window === 'undefined'` | database.ts |
| Testing | Vitest Mocks | src/__mocks__/@powersync/web.ts |
| Patterns | Optimistic UI, Multi-Tab | Component.vue |
