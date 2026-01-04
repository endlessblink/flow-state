# PowerSync Quick Fixes

Copy-paste solutions for common PowerSync + Vite issues.

---

## Quick Start (4 Steps)

### Step 1: Install Dependencies

```bash
npm install @powersync/web @journeyapps/wa-sqlite js-logger
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

### Step 2: Copy WASM Assets

```bash
npx powersync-sdk-web copy-assets --public-dir public/powersync
```

### Step 3: Configure vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    topLevelAwait()
  ],

  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },

  resolve: {
    alias: {
      'uuid': path.resolve(__dirname, 'node_modules/uuid/dist/esm-browser/index.js'),
    }
  },

  optimizeDeps: {
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
    include: ['js-logger'],
    needsInterop: ['uuid']
  },

  build: {
    rollupOptions: {
      output: { format: 'es' }
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

### Step 4: Create database.ts

```typescript
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web'
import { Connector } from './connector'
import { AppSchema } from './schema'

let db: PowerSyncDatabase | null = null

export function getDatabase(): PowerSyncDatabase {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: new WASQLiteOpenFactory({
        dbFilename: 'app.db',
        workerUri: '/powersync/wa-sqlite.worker.js',
        vfs: WASQLiteVFS.OPFSCoopSyncVFS,
        flags: { enableMultiTabs: true }
      })
    })
  }
  return db
}

export async function initPowerSync() {
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

## Error Solutions

### Error: "SharedArrayBuffer is not defined"

**Cause**: Missing COOP/COEP headers in production.

**Fix for Vercel** - Create `vercel.json`:

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

**Fix for Netlify** - Create `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

---

### Error: "Window is not defined" (Next.js/Nuxt)

**Cause**: Importing database.ts in server-rendered code.

**Fix**: Use dynamic import inside lifecycle hook:

```typescript
// BAD - crashes on server
import { db } from './database'

// GOOD - only runs in browser
onMounted(async () => {
  const { db } = await import('./database')
  await db.init()
})
```

---

### Error: "Worker 404" or "Failed to fetch wa-sqlite.worker.js"

**Cause**: Missing WASM worker assets.

**Fix**:

```bash
npx powersync-sdk-web copy-assets --public-dir public/powersync
```

Verify files exist:
- `public/powersync/wa-sqlite.worker.js`
- `public/powersync/wa-sqlite-async.wasm`

---

### Error: "Test Suite Failed to Run" (Vitest/Jest)

**Cause**: WASM and Web Workers don't work in Node.js.

**Fix**: Create mock file `src/__mocks__/@powersync/web.ts`:

```typescript
import { vi } from 'vitest'

export class PowerSyncDatabase {
  connect = vi.fn().mockResolvedValue(undefined)
  disconnect = vi.fn()
  execute = vi.fn().mockResolvedValue({ rows: { _array: [] } })
  getAll = vi.fn().mockResolvedValue([])
  get = vi.fn().mockResolvedValue(null)
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

Add to `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    alias: {
      '@powersync/web': path.resolve(__dirname, './src/__mocks__/@powersync/web.ts')
    }
  }
})
```

---

### Error: "uuid is not a function" or ESM/CJS interop issues

**Cause**: `uuid` package ships CommonJS, conflicts with ESM build.

**Fix**: Add alias in `vite.config.ts`:

```typescript
resolve: {
  alias: {
    'uuid': path.resolve(__dirname, 'node_modules/uuid/dist/esm-browser/index.js'),
  }
},
optimizeDeps: {
  needsInterop: ['uuid']
}
```

---

### Error: Slow writes in production

**Cause**: App is using IndexedDB fallback instead of OPFS.

**Diagnosis** (in browser console):

```javascript
console.log('Cross-Origin-Isolated:', crossOriginIsolated)
// false = using slow IndexedDB
// true = using fast OPFS
```

**Fix**: Ensure COOP/COEP headers are served. See "SharedArrayBuffer is not defined" fix above.

---

### Error: Multi-tab sync not working

**Cause**: Missing `enableMultiTabs` flag or OPFS not active.

**Fix**: Verify configuration:

```typescript
database: new WASQLiteOpenFactory({
  dbFilename: 'app.db',
  workerUri: '/powersync/wa-sqlite.worker.js',
  vfs: WASQLiteVFS.OPFSCoopSyncVFS,  // Must be OPFS
  flags: { enableMultiTabs: true }   // Must be true
})
```

And ensure `crossOriginIsolated === true` in browser console.

---

## Checklist

Before deploying, verify:

- [ ] `vite.config.ts` has WASM plugins and COOP/COEP headers
- [ ] WASM assets copied to `public/powersync/`
- [ ] `vercel.json` or `netlify.toml` configured for production headers
- [ ] `crossOriginIsolated === true` in browser console (dev & prod)
- [ ] Vitest mock file created and aliased
- [ ] Database imports are dynamic (not top-level) for SSR safety
