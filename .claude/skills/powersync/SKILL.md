---
name: powersync
description: This skill should be used when setting up, configuring, or debugging PowerSync Web SDK with Vite. Triggers on PowerSync installation, WASM worker configuration, OPFS/IndexedDB storage setup, COOP/COEP header configuration, SSR safety patterns, multi-tab sync, and optimistic UI patterns. Provides production-ready configurations for Vue, React, Next.js, and Nuxt.
---

# PowerSync Web SDK + Vite

Configure PowerSync for high-performance local-first applications with native-speed SQLite via WASM.

## When to Use This Skill

- Setting up PowerSync in a Vite project (Vue, React, or vanilla)
- Debugging WASM worker loading issues
- Configuring COOP/COEP headers for OPFS performance
- Implementing SSR-safe database initialization (Next.js, Nuxt)
- Setting up Vitest mocks for PowerSync
- Implementing multi-tab sync or optimistic UI patterns
- Deploying to Vercel/Netlify with correct headers

## Quick Reference

| Task | Solution |
|------|----------|
| Install dependencies | `npm install @powersync/web @journeyapps/wa-sqlite js-logger` + dev deps |
| Copy WASM assets | `npx powersync-sdk-web copy-assets --public-dir public/powersync` |
| Enable OPFS | `vfs: WASQLiteVFS.OPFSCoopSyncVFS` in WASQLiteOpenFactory |
| Check OPFS status | `console.log('Cross-Origin-Isolated:', crossOriginIsolated)` |
| Fix SSR crash | Use dynamic import: `const { db } = await import('./database')` |

---

## Setup Workflow

### 1. Install Dependencies

```bash
npm install @powersync/web @journeyapps/wa-sqlite js-logger
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

### 2. Copy WASM Assets

```bash
npx powersync-sdk-web copy-assets --public-dir public/powersync
```

Verify files exist:
- `public/powersync/wa-sqlite.worker.js`
- `public/powersync/wa-sqlite-async.wasm`

### 3. Configure Vite

Add to `vite.config.ts`:

```typescript
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [vue(), wasm(), topLevelAwait()],

  // REQUIRED for OPFS performance
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
    rollupOptions: { output: { format: 'es' } },
    commonjsOptions: { include: [/node_modules/] }
  },

  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  }
})
```

### 4. Create Database Singleton

Use the template from `assets/templates/database.ts` or create:

```typescript
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web'

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
  if (typeof window === 'undefined') return null; // SSR guard
  const database = getDatabase()
  await database.connect(new Connector())
  return database
}
```

---

## Error Resolution

### "SharedArrayBuffer is not defined"

**Cause**: Missing COOP/COEP headers in production.

**Fix**: Copy deployment config from `assets/`:
- Vercel: Copy `assets/vercel.json` to project root
- Netlify: Copy `assets/netlify.toml` to project root

### "Window is not defined" (SSR)

**Cause**: Top-level database import in server-rendered code.

**Fix**: Use dynamic import inside lifecycle hook:

```typescript
// BAD
import { db } from './database'

// GOOD
onMounted(async () => {
  const { db } = await import('./database')
})
```

### "Worker 404"

**Cause**: Missing WASM assets.

**Fix**: Run `npx powersync-sdk-web copy-assets --public-dir public/powersync`

### "Test Suite Failed" (Vitest)

**Cause**: WASM/Workers don't run in Node.js.

**Fix**: Copy `assets/templates/powersync-mock.ts` to `src/__mocks__/@powersync/web.ts` and add alias to `vitest.config.ts`.

---

## Production Patterns

### Multi-Tab Sync

Enable with: `flags: { enableMultiTabs: true }` in WASQLiteOpenFactory.

Requires OPFS (COOP/COEP headers active).

### Optimistic Updates

```typescript
import { v4 as uuidv4 } from 'uuid/dist/esm-browser/index.js'

// 1. Generate ID locally
const id = uuidv4()

// 2. Insert immediately
await db.execute('INSERT INTO tasks (id, title) VALUES (?, ?)', [id, 'New Task'])

// 3. UI updates instantly via watch()
// 4. PowerSync syncs in background
```

### Connection Status

```typescript
const syncStatus = ref({ connected: false, uploading: false })
db.onChange((status) => { syncStatus.value = status })
```

---

## Resources

### references/

Detailed documentation for complex configurations:

- **vite-guide.md**: Complete Vite configuration with all options explained
- **advanced-reference.md**: Deep dive into COOP/COEP, OPFS architecture, conflict resolution
- **quick-fixes.md**: Copy-paste solutions for common errors

### assets/

Ready-to-use configuration files:

- **vercel.json**: Deployment headers for Vercel
- **netlify.toml**: Deployment headers for Netlify
- **templates/database.ts**: Complete database setup with OPFS and SSR guards
- **templates/powersync-mock.ts**: Vitest mock for testing

---

## Verification Checklist

Before deploying, verify:

- [ ] `vite.config.ts` has WASM plugins and COOP/COEP headers
- [ ] WASM assets copied to `public/powersync/`
- [ ] `vercel.json` or `netlify.toml` configured for production
- [ ] `crossOriginIsolated === true` in browser console
- [ ] Vitest mock file created and aliased
- [ ] Database imports are dynamic for SSR safety
