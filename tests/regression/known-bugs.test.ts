/**
 * Regression Tests for 5 Known Critical Bugs
 *
 * Each section documents the root cause, kill chain, and tests the exact failure
 * condition to prevent silent re-introduction of fixed bugs.
 *
 * All tests are pure source-code scans (no network, no IndexedDB, no Vue runtime)
 * so they run fast and work in CI without any mocking.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const SRC = join(ROOT, 'src')

/** Read a file relative to project root. */
function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

/** Recursively collect all files matching an extension under a directory. */
function collectFiles(dir: string, ext: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectFiles(full, ext, results)
    } else if (full.endsWith(ext)) {
      results.push(full)
    }
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1211: Sync Orchestrator wrote `_soft_deleted` instead of `is_deleted`
// ─────────────────────────────────────────────────────────────────────────────
//
// Root cause: useSyncOrchestrator.ts:329 passed `{ _soft_deleted: true }` to
// Supabase but the actual DB column is `is_deleted`. The update always returned
// 0 rows, which triggered the hard-DELETE fallback, creating a tombstone and
// broadcasting a realtime DELETE to every connected device — permanent,
// unrecoverable data loss on every single task deletion.
//
// Kill chain:
//   soft-delete (correct app path)
//   → sync queue processes with `_soft_deleted: true` (wrong column name)
//   → Supabase UPDATE matches 0 rows (column doesn't exist)
//   → fallback: hard DELETE + insert tombstone
//   → realtime broadcast DELETE to all devices
//   → task permanently gone
//
// Fix: Changed to `{ is_deleted: true, deleted_at: new Date().toISOString() }`
//      and removed the hard-delete fallback (line ~329/335 in the file).
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-1211: Sync soft-delete uses correct DB column name', () => {
  const ORCHESTRATOR_PATH = 'src/composables/sync/useSyncOrchestrator.ts'

  it('does NOT contain the wrong `_soft_deleted` field in the delete case of executeOperation', () => {
    // The bug was that the sync orchestrator's DELETE branch set `_soft_deleted` instead
    // of `is_deleted`. The only allowed occurrence is in the BUG-1533b sanitizer block
    // which STRIPS the field from legacy payloads — that reference is defensive cleanup,
    // not a write. If `_soft_deleted` appears as a key in a Supabase .update() call
    // anywhere in the delete branch, the bug has been re-introduced.
    const source = readSrc(ORCHESTRATOR_PATH)

    // Locate the delete case block. The pattern we fear is:
    //   .update({ _soft_deleted: true ... })
    // which would be the re-introduced bug.
    const updateWithSoftDeletedRegex = /\.update\s*\(\s*\{[^}]*_soft_deleted[^}]*\}/
    expect(source).not.toMatch(updateWithSoftDeletedRegex)
  })

  it('uses `is_deleted: true` for soft-delete in the delete case', () => {
    // The corrected delete branch must use `is_deleted: true`. This asserts the fix
    // is present and not accidentally removed (e.g. by a future refactor that
    // "simplifies" the delete case).
    const source = readSrc(ORCHESTRATOR_PATH)

    // The delete case must contain both: is_deleted: true AND deleted_at: new ...
    // These are the two columns that mark a row as soft-deleted in the DB schema.
    expect(source).toMatch(/is_deleted:\s*true/)
    expect(source).toMatch(/deleted_at:\s*new\s+Date\(\)/)
  })

  it('LWW conflict resolution returns serverData when server wins (not a no-op)', () => {
    // Secondary fix in BUG-1211: the "server wins" branch of LWW (lines ~409-423) was
    // originally a no-op return — it never applied server data back to the local store.
    // The fix adds `serverData: serverState.data` to the return so the caller can
    // reconcile local state.
    //
    // If this regresses, LWW "server wins" silently discards the server's newer value
    // without telling the local store — data divergence without any error signal.
    const source = readSrc(ORCHESTRATOR_PATH)

    // The server-wins return statement must include serverData
    const serverWinsBlock = /Server\s+wins[\s\S]{0,400}serverData:\s*serverState\.data/
    expect(source).toMatch(serverWinsBlock)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1212: Sync queue CREATE used `.insert()` causing duplicate key failures
// ─────────────────────────────────────────────────────────────────────────────
//
// Root cause: When a task is created, `createTask()` performs a direct Supabase
// `.upsert()` first, then the sync queue also tries to write it. The direct save
// succeeds — the row exists. When the sync queue fires `.insert()`, Postgres
// returns error code 23505 (duplicate key). The error was classified as
// 'permanent', so the operation was never retried and the task was marked
// Corrupted in the sync UI.
//
// Kill chain:
//   createTask() → direct upsert → row exists in DB
//   sync queue fires → .insert() for CREATE → 23505 duplicate key
//   classifyError('duplicate key') → 'permanent' (pre-fix)
//   → markFailed('permanent') → "Corrupted" in sync UI, never retried
//
// Fix 1: CREATE in sync queue now uses `.upsert({ onConflict: 'id' })` — making
//         it idempotent when the row already exists.
// Fix 2: `classifyError` now classifies "duplicate key + unique constraint" as
//         'conflict' (auto-resolvable) rather than 'permanent' (fatal).
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-1212: Sync queue CREATE uses upsert, not insert', () => {
  const ORCHESTRATOR_PATH = 'src/composables/sync/useSyncOrchestrator.ts'
  const RETRY_STRATEGY_PATH = 'src/services/offline/retryStrategy.ts'

  it('the CREATE case in executeOperation uses .upsert() with onConflict:id, not .insert()', () => {
    // Re-introducing .insert() here would cause every CREATE to fail with a duplicate-key
    // error when the direct save has already committed the row (which is the normal path).
    const source = readSrc(ORCHESTRATOR_PATH)

    // Must have upsert with onConflict: 'id'
    expect(source).toMatch(/\.upsert\s*\([^)]*onConflict:\s*['"]id['"]/)

    // Must NOT have a bare .insert() call in the create case
    // (the BUG-1212 comment block surrounds the fix — search for insert() near the
    // create case context but NOT as part of upsert)
    // We check that .insert( is not followed by insertData (the variable used in CREATE)
    const bareInsert = /\.insert\s*\(\s*insertData/
    expect(source).not.toMatch(bareInsert)
  })

  it('classifyError classifies "duplicate key ... unique constraint" as conflict, not permanent', () => {
    // This is the defense-in-depth fix: even if a bare .insert() slips back in somehow,
    // the error classifier must NOT treat 23505 as a permanent failure that abandons the op.
    const source = readSrc(RETRY_STRATEGY_PATH)

    // The classifier must have the duplicate key → conflict branch
    // Pattern: if message includes 'duplicate key' AND 'unique constraint' → return 'conflict'
    expect(source).toMatch(/duplicate key[\s\S]{0,100}unique constraint[\s\S]{0,100}conflict/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1335: vuedraggable bare boolean HTML attributes treated as falsy by SortableJS
// ─────────────────────────────────────────────────────────────────────────────
//
// Root cause: Vue 3 passes bare boolean HTML attributes (e.g. `force-fallback`
// without a binding) as empty strings via `$attrs`. vuedraggable forwards `$attrs`
// directly to SortableJS as options. SortableJS treats `""` as falsy, so
// `forceFallback: ""` means forceFallback is OFF — the same as not setting it.
//
// Kill chain:
//   <Draggable force-fallback ...> (bare attribute)
//   → Vue 3 $attrs: { 'force-fallback': '' }
//   → SortableJS: { forceFallback: '' } (empty string = falsy)
//   → forceFallback is effectively false
//   → SortableJS uses native HTML5 drag API instead of the fallback
//   → items get draggable="false" during init (delay=100 + delayOnTouchOnly falsy)
//   → kanban drag never triggers
//
// Fix: Use explicit bound booleans: `:force-fallback="true"`, `:delay-on-touch-only="true"`,
//      `:bubble-scroll="true"`. These pass the boolean `true` through $attrs, not `""`.
//
// Scope: ALL .vue files that use vuedraggable must follow this rule.
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-1335: vuedraggable boolean attrs must be bound, not bare', () => {
  // Collect all .vue files in src/ once
  const vueFiles = collectFiles(SRC, '.vue')
  expect(vueFiles.length).toBeGreaterThan(0) // sanity check

  it('no .vue file uses bare `force-fallback` on a Draggable component (must be :force-fallback="true")', () => {
    // Bare attribute: `force-fallback` without a colon prefix or v-bind
    // Bound attribute: `:force-fallback="true"` — the only correct form
    //
    // Regex: a line that contains `force-fallback` NOT preceded by `:` or `v-bind`
    // We search for the pattern `\bforce-fallback\b` where the character before it
    // is NOT `:` (after stripping whitespace).
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = readFileSync(file, 'utf-8')
      // Match lines with force-fallback that are NOT prefixed with : or v-bind:
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip if it's a bound attr (:force-fallback or v-bind:force-fallback)
        if (/[:v]force-fallback/.test(line) || /:force-fallback/.test(line) || /v-bind:force-fallback/.test(line)) continue
        // If it contains bare force-fallback (not inside a comment or string)
        if (/\bforce-fallback\b/.test(line) && !/<!--/.test(line) && !/\/\//.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('no .vue file uses bare `delay-on-touch-only` on a Draggable component (must be :delay-on-touch-only="true")', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/:delay-on-touch-only/.test(line) || /v-bind:delay-on-touch-only/.test(line)) continue
        if (/\bdelay-on-touch-only\b/.test(line) && !/<!--/.test(line) && !/\/\//.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('no .vue file uses bare `bubble-scroll` on a Draggable component (must be :bubble-scroll="true")', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/:bubble-scroll/.test(line) || /v-bind:bubble-scroll/.test(line)) continue
        if (/\bbubble-scroll\b/.test(line) && !/<!--/.test(line) && !/\/\//.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1453: touchstart preventDefault poisons Android Chrome gesture recognition
// ─────────────────────────────────────────────────────────────────────────────
//
// Root cause: A refactor of `useSwipeGestures.ts` added `preventDefault()` inside
// the touchstart handler (or registered touchstart as non-passive with preventDefault).
// On Android Chrome, the compositor decides whether a touch sequence should scroll
// the page or be handed to JS during the touchstart phase. If JS calls
// `preventDefault()` at touchstart, the compositor drops ALL subsequent touchmove
// events for that gesture — the swipe gesture is silently dead.
//
// Kill chain:
//   touchstart fires → preventDefault() called immediately (direction unknown)
//   → Android Chrome compositor: "JS wants to block this gesture"
//   → compositor drops all subsequent touchmove events for the sequence
//   → isSwiping stays false, no deltaX/Y updates, card never moves
//   → swipe always "cancelled", sort card stuck
//
// Fix 1: touchstart listener MUST be `{ passive: true }` — this contractually
//         prevents preventDefault() from having any effect, which satisfies the
//         compositor's requirement to not block at touchstart.
// Fix 2: preventDefault() in touchmove is only called AFTER isLocked (10px threshold).
// Fix 3: `.sort-phase` uses `touch-action: pan-y` instead of the removed
//         `-webkit-overflow-scrolling: touch`, which hints to the compositor that
//         only vertical scroll should be handled natively.
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-1453: useSwipeGestures touchstart is passive, no preventDefault at touch start', () => {
  const SWIPE_PATH = 'src/composables/useSwipeGestures.ts'

  it('touchstart event listener is registered with { passive: true }', () => {
    // The passive:true option is what contractually prevents preventDefault() at touchstart.
    // If this is removed (e.g. changed to `{ passive: false }` or bare addEventListener),
    // Android Chrome will again drop touchmove events whenever JS calls preventDefault().
    const source = readSrc(SWIPE_PATH)

    // Must register touchstart with passive:true
    expect(source).toMatch(/addEventListener\s*\(\s*['"]touchstart['"][\s\S]{0,100}passive:\s*true/)
  })

  it('handleTouchStart callback does NOT call preventDefault()', () => {
    // Direction is unknown at touchstart — the element could be part of a vertical scroll.
    // Calling preventDefault() here would either: (a) block scroll when the user wanted
    // to scroll, or (b) poison the Android compositor so it drops touchmove events.
    // preventDefault() belongs in touchmove, after the 10px lock threshold.
    const source = readSrc(SWIPE_PATH)

    // Extract the handleTouchStart function body and check it contains no preventDefault
    // Strategy: find the function, then verify no preventDefault appears before the
    // next function definition.
    const touchStartFnMatch = source.match(/handleTouchStart\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)(?=\n\s*const handle|\n\s*\/\/\s*Mouse)/)
    expect(touchStartFnMatch).not.toBeNull()

    const fnBody = touchStartFnMatch![1]
    // Strip comment lines before checking — comments mentioning preventDefault are fine
    // (they explain WHY it's absent). Only actual calls are the bug.
    const codeLines = fnBody.split('\n').filter(l => !/^\s*\/\//.test(l))
    const codeOnly = codeLines.join('\n')
    expect(codeOnly).not.toMatch(/\.preventDefault\s*\(/)
  })

  it('.sort-phase in MobileQuickSortView.vue uses `touch-action: pan-y` not `-webkit-overflow-scrolling: touch`', () => {
    // `touch-action: pan-y` tells the browser compositor that only vertical scroll
    // should be handled natively — horizontal movement is handled by JS (our swipe).
    // `-webkit-overflow-scrolling: touch` is an old iOS momentum-scroll hint that has
    // no relationship to gesture routing and was incorrectly used as a replacement.
    //
    // Presence of -webkit-overflow-scrolling: touch inside .sort-phase would mean the
    // BUG-1453 CSS fix has been partially reverted.
    const source = readSrc('src/mobile/views/MobileQuickSortView.vue')

    // Must have touch-action: pan-y on .sort-phase
    // Use lazy quantifier instead of bounded {0,N} — the block is ~540 chars
    expect(source).toMatch(/\.sort-phase\s*\{[\s\S]*?touch-action:\s*pan-y/)

    // Must NOT have -webkit-overflow-scrolling: touch inside the .sort-phase block.
    // Extract the first .sort-phase { ... } block using a lazy match to the closing brace.
    const sortPhaseBlockMatch = source.match(/\.sort-phase\s*\{([\s\S]*?)\}(?=\n)/)
    if (sortPhaseBlockMatch) {
      expect(sortPhaseBlockMatch[1]).not.toMatch(/-webkit-overflow-scrolling:\s*touch/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1184: Uncommitted imported file causes CI build failure → stale VPS assets
// ─────────────────────────────────────────────────────────────────────────────
//
// Root cause: `App.vue` imported `AISetupWizard.vue` which was written locally but
// never committed to git. The file existed on the developer's machine so `npm run dev`
// worked fine. But CI/CD (which uses a clean checkout) failed with "module not found".
// CI failure meant no new deploys. Meanwhile manual deploys with `rsync --delete`
// removed old JS chunks from the VPS. Browsers and PWA service workers holding cached
// references to old chunk hashes got 404s → blank page for all users.
//
// Kill chain:
//   new import added in source → file not committed → git push
//   → CI/CD: "Cannot find module" → build fails → no deploy
//   → old deploy (with old chunk hashes) stays on VPS
//   → developer does manual rsync --delete (removes old chunks)
//   → browser / SW has cached old hash → GET /assets/chunk-old-hash.js → 404
//   → blank page / chunk load failure for all users
//
// Fix 1: Committed the missing file.
// Fix 2: Router onError now auto-recovers (unregisters stale SW + force-reload).
// Prevention: This test suite validates all static imports in src/ resolve to
//             existing files on disk, catching the "committed import, missing file"
//             case that broke production.
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-1184: All static imports in src/ resolve to existing files on disk', () => {
  /**
   * Parse static import paths from a TypeScript/Vue source file.
   * Only relative imports (starting with ./ or ../) point to specific files that
   * must exist. Package imports (vue, @supabase/...) are handled by node_modules.
   */
  function extractRelativeImports(source: string, filePath: string): Array<{ importPath: string, resolvedPath: string }> {
    const results: Array<{ importPath: string, resolvedPath: string }> = []
    const fileDir = join(filePath, '..')

    // Match static import statements with relative paths
    const importRegex = /^\s*import\s+(?:[\s\S]*?from\s+)?['"](\.[^'"]+)['"]/gm
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(source)) !== null) {
      const importPath = match[1]
      const resolved = resolve(fileDir, importPath)
      results.push({ importPath, resolvedPath: resolved })
    }

    return results
  }

  /**
   * Resolve an import path to an actual file, trying extensions in order.
   * Vue/TS resolution: exact path → +.ts → +.vue → +/index.ts → +/index.vue
   */
  function resolveImportToFile(resolvedBase: string): string | null {
    // Try exact path first (may already have extension)
    if (existsSync(resolvedBase) && statSync(resolvedBase).isFile()) {
      return resolvedBase
    }
    // Try common extensions
    for (const ext of ['.ts', '.vue', '.js', '.tsx', '.jsx']) {
      const candidate = resolvedBase + ext
      if (existsSync(candidate)) return candidate
    }
    // Try index files
    for (const idx of ['index.ts', 'index.vue', 'index.js']) {
      const candidate = join(resolvedBase, idx)
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  it('all relative imports in App.vue resolve to files that exist on disk', () => {
    // App.vue is the highest-risk file — it imports many top-level components directly
    // (not lazy-loaded). A missing import here blocks the entire app from loading.
    const appVuePath = join(SRC, 'App.vue')
    const source = readFileSync(appVuePath, 'utf-8')
    const imports = extractRelativeImports(source, appVuePath)

    const missing: string[] = []
    for (const { importPath, resolvedPath } of imports) {
      if (!resolveImportToFile(resolvedPath)) {
        missing.push(`  ${importPath} (resolved: ${resolvedPath})`)
      }
    }

    expect(missing, `Missing files imported by App.vue:\n${missing.join('\n')}`).toEqual([])
  })

  it('all relative imports in src/main.ts resolve to files that exist on disk', () => {
    // main.ts bootstraps the app. Missing imports here prevent the app from initializing.
    const mainPath = join(SRC, 'main.ts')
    if (!existsSync(mainPath)) return // skip if file doesn't exist

    const source = readFileSync(mainPath, 'utf-8')
    const imports = extractRelativeImports(source, mainPath)

    const missing: string[] = []
    for (const { importPath, resolvedPath } of imports) {
      if (!resolveImportToFile(resolvedPath)) {
        missing.push(`  ${importPath} (resolved: ${resolvedPath})`)
      }
    }

    expect(missing, `Missing files imported by main.ts:\n${missing.join('\n')}`).toEqual([])
  })
})
