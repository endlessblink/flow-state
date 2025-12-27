# SOP: Bundle Size Optimization & Legacy Storage Cleanup
**Last Updated:** December 27, 2025
**Scope:** Build Pipeline (Vite), Bundle Splitting, PouchDB Data Migration

## 1. Overview
This SOP documents the performance and maintenance hardening performed on December 27, 2025. It covers the reduction of the main JavaScript bundle from ~890 KB to < 400 KB and the final migration step for Projects/Sections storage.

## 2. Bundle Size Optimization (TASK-059)

### Goal
Reduce the main application bundle size to under 500 KB to improve initial load speed and enable better PWA performance on mobile devices.

### Strategy: manualChunks Splitting
Vite (Rollup) by default puts most dependencies into a single `vendor.js` or includes them in `index.js`. We implemented a targeted splitting strategy in `vite.config.ts`.

#### Configuration:
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('pouchdb')) return 'vendor-pouchdb'
          if (id.includes('naive-ui')) return 'vendor-ui'
          if (id.includes('lucide-vue-next')) return 'vendor-ui'
          if (id.includes('@vue-flow')) return 'vendor-flow'
          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('@vueuse')) return 'vendor-core'
          return 'vendor'
        }
      }
    }
  }
}
```

#### Results:
| Metric | Before Split | After Split | Change |
| :--- | :--- | :--- | :--- |
| **Main Bundle (Parsed)** | 890 KB | **398 KB** | **-55%** |
| **Main Bundle (Gzipped)** | 283 KB | **117 KB** | **-58%** |

### Verification Procedure
1. Run `npm run build`.
2. Observe the asset size table in the terminal.
3. Verify `index-[hash].js` is under 500 KB.
4. (Optional) Set `visualizer: { open: true }` in `vite.config.ts` to view the `stats.html` TreeMap.

---

## 3. Legacy Storage Cleanup (TASK-048)

### Goal
Permanently remove legacy monolithic documents (`tasks:data`, `projects:data`, `canvas:data`) once the app has successfully transitioned to individual document storage (`task-{id}`, `project-{id}`, `section-{id}`).

### Implementation: `legacyStorageCleanup.ts`
We created a utility that safe-checks the `STORAGE_FLAGS` before deleting the old documents.

#### Logic:
```typescript
const MONOLITHIC_DOCS = [
    { flag: STORAGE_FLAGS.INDIVIDUAL_ONLY, id: 'tasks:data', name: 'Tasks' },
    { flag: STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY, id: 'projects:data', name: 'Projects' },
    { flag: STORAGE_FLAGS.INDIVIDUAL_SECTIONS_ONLY, id: 'canvas:data', name: 'Canvas/Sections' }
]
// ... iterates and calls db.remove(existingDoc)
```

### Integration
The cleanup is called in `src/composables/app/useAppInitialization.ts` AFTER the stores have finished loading data from their respective individual documents.

```typescript
// useAppInitialization.ts
await tasksStore.loadFromDatabase()
// ... other loads
await cleanupLegacyMonolithicDocuments(pouchDb)
```

### Verification Procedure
1. Open the application and check the console.
2. Search for logs prefixed with `🧹 [STORAGE-CLEANUP]`.
3. Expected output on first run:
   - `✅ [STORAGE-CLEANUP] Deleted legacy Projects document (projects:data)`
   - `✅ [STORAGE-CLEANUP] Deleted legacy Canvas/Sections document (canvas:data)`
4. Using PouchDB Inspector or DevTools:
   - Run `await window.pomoFlowDb.get('projects:data')`.
   - Result should be an error (missing) or the document should be gone.

---

## 4. Maintenance & Rollback

### Rollback (Storage)
> [!CAUTION]
> Once legacy documents are deleted and sync clears them from the remote CouchDB, rollback to monolithic storage is only possible via a previously exported JSON backup or CouchDB snapshot.

If data is missing after migration:
1. Immediately stop the app to prevent further syncs.
2. Restore the most recent backup using the "Restore from Backup" feature in Settings.
3. Disable `INDIVIDUAL_ONLY` flags in `database.ts` to revert to dual-write mode until fixed.

### Future Optimizations
- **Lucide Tree Shaking**: Ensure icons are imported individually (e.g., `import { Check } from 'lucide-vue-next'`) rather than from the index if bundle size creeps up again.
- **Naive UI Treeshaking**: Continue auditing Naive UI components for unused modules.
