# Documentation Consolidation Report

**Generated:** January 11, 2026
**Files Analyzed:** 2,493 markdown files
**Current Tech Stack:** Vue 3 + TypeScript + Supabase (NOT PouchDB)

---

## Quick Summary

| Category | Count | Action Needed |
|----------|-------|---------------|
| **DELETE** (obsolete) | 6 files | Safe to remove |
| **UPDATE** (outdated) | 4 files | Fix tech references |
| **CONSOLIDATE** (duplicates) | 12+ files | Merge into fewer docs |
| **KEEP** (accurate) | ~50 core docs | No changes needed |
| **ARCHIVE** (historical) | 200+ files | Already archived, can trim |

---

## IMMEDIATE ACTIONS (Priority Order)

### 1. DELETE - Obsolete Files

| File | Reason | Risk |
|------|--------|------|
| `docs/claude-md-extension/database.md` | 100% PouchDB content, app uses Supabase | LOW |
| `docs/archive/mapping-old/3.11.25/` (entire folder) | Duplicate of 4.11.25 snapshot | LOW |
| `tests/sync/conflict-reproduction.spec.ts` | PouchDB test, no longer relevant | LOW |
| `.claude/skills-archive/obsolete-tech-20260110/` | IndexedDB backup debugger skill | LOW |

### 2. UPDATE - Fix Outdated References

| File | Issue | Fix |
|------|-------|-----|
| `docs/claude-md-extension/architecture.md` | References PouchDB, useDatabase.ts | Replace with Supabase architecture |
| `docs/claude-md-extension/troubleshooting.md` | Database section mentions PouchDB | Update to Supabase troubleshooting |
| `README.md` | Says "PouchDB + CouchDB sync" | Update to Supabase |
| `src/utils/consoleFilter.ts` | Filters PouchDB errors | Remove PouchDB filtering |

### 3. CONSOLIDATE - Merge Duplicates

| Keep This | Merge These Into It |
|-----------|---------------------|
| `CLAUDE.md` | Tech stack from README.md (keep README for external users) |
| `docs/sop/active/CANVAS-position-reset-fix.md` | `canvas-position-debugging.md` (same content) |
| `docs/archive/mapping-old/4.11.25/` | Delete 3.11.25/ (identical copy) |

---

## Documentation Health by Folder

### `/docs/claude-md-extension/` (7 files)

| File | Status | Action |
|------|--------|--------|
| `architecture.md` | OUTDATED | Update PouchDB → Supabase |
| `backup-system.md` | ACCURATE | Keep |
| `code-patterns.md` | ACCURATE | Keep |
| `database.md` | OBSOLETE | **DELETE** |
| `design-system.md` | ACCURATE | Keep |
| `testing.md` | ACCURATE | Keep |
| `troubleshooting.md` | PARTIAL | Update database section |

### `/docs/sop/` (56 files)

| Subfolder | Files | Status |
|-----------|-------|--------|
| `active/` | 40 | KEEP - Active fix procedures |
| `archived/` | 8 | KEEP - Historical reference |
| `bug-analysis/` | 4 | KEEP - Test plans |
| `reference/` | 4 | KEEP - Safety guidelines |

**Note:** SOPs are well-organized. No consolidation needed.

### `/docs/archive/` (68 files)

| Subfolder | Status | Action |
|-----------|--------|--------|
| `mapping-old/3.11.25/` | DUPLICATE | **DELETE** (4.11.25 is identical) |
| `mapping-old/4.11.25/` | HISTORICAL | Keep as single snapshot |
| `prd/` | REFERENCE | Keep for product history |
| `Phase-*/` | HISTORICAL | Keep |

### `/plans/` (11 files)

| File | Status | Notes |
|------|--------|-------|
| All 11 plans | ACTIVE | Created Jan 6-11, 2026 |

**No cleanup needed** - All plans are current and actively referenced.

### `/.claude/skills/` (79 files)

| Status | Count |
|--------|-------|
| Active skills | 79 |
| Archived skills | 125 (in skills-archive/) |

**Already consolidated** on Jan 10, 2026. Skills-archive contains merged originals.

---

## PROPOSED NEW STRUCTURE

```
docs/
├── MASTER_PLAN.md              # Primary task tracking (keep)
├── raw-ideas-issues.md         # Ideas inbox (keep)
├── AGENTS.md                   # Agent config (keep)
│
├── guides/                     # NEW: Consolidated active guides
│   ├── architecture.md         # Moved & updated from claude-md-extension/
│   ├── supabase.md             # NEW: Replace database.md
│   ├── backup-system.md        # Moved from claude-md-extension/
│   ├── design-system.md        # Moved from claude-md-extension/
│   ├── code-patterns.md        # Moved from claude-md-extension/
│   ├── testing.md              # Moved from claude-md-extension/
│   └── troubleshooting.md      # Moved & updated from claude-md-extension/
│
├── sop/                        # Keep as-is (well organized)
│   ├── active/
│   ├── archived/
│   ├── bug-analysis/
│   └── reference/
│
├── prompts/                    # Keep as-is
│
├── process-docs/               # Keep as-is
│
├── reports/                    # Keep as-is
│
├── archive/                    # Trimmed historical docs
│   ├── mapping-old/4.11.25/    # Single snapshot (delete 3.11.25)
│   ├── prd/
│   └── Phase-*/
│
└── documentation/              # Vue Flow reference (keep)
```

**Key Changes:**
1. `claude-md-extension/` → `guides/` (clearer name)
2. Delete duplicate archive snapshot
3. Delete obsolete `database.md`
4. Create new `supabase.md` with current architecture

---

## Files to Update Content

### README.md - Line 51
```diff
- Storage: PouchDB (IndexedDB) + optional CouchDB sync
+ Storage: Supabase (PostgreSQL) with RLS
```

### docs/claude-md-extension/architecture.md - Lines 38, 86-92
```diff
- PouchDB persistence with debounced saves
+ Supabase persistence with optimistic updates

- useDatabase.ts, useReliableSyncManager.ts, useCouchDBSync.ts
+ useSupabaseDatabaseV2.ts, supabaseMappers.ts
```

### docs/claude-md-extension/troubleshooting.md - Lines 17-22
```diff
- Check if PouchDB initialized correctly
- Clear IndexedDB and refresh
- Check CouchDB connection
+ Check Supabase connection status
+ Verify JWT keys: npm run generate:keys
+ Check RLS policies in Supabase dashboard
```

---

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| **Total .md files** | 2,493 | ~2,470 |
| **Outdated tech refs** | 15+ files | 0 files |
| **Duplicate content** | 12+ instances | 2-3 instances |
| **PouchDB mentions** | 8 code files + 5 docs | 0 |

---

## Execution Checklist

- [ ] Delete `docs/claude-md-extension/database.md`
- [ ] Delete `docs/archive/mapping-old/3.11.25/` folder
- [ ] Delete `tests/sync/conflict-reproduction.spec.ts`
- [ ] Update README.md storage reference
- [ ] Update architecture.md (remove PouchDB, add Supabase)
- [ ] Update troubleshooting.md database section
- [ ] Remove PouchDB filtering from `src/utils/consoleFilter.ts`
- [ ] Rename `claude-md-extension/` to `guides/` (optional)
- [ ] Create `docs/guides/supabase.md` from CLAUDE.md architecture section

---

## Verification Commands

After cleanup, verify no broken references:

```bash
# Check for remaining PouchDB mentions
rg -i "pouchdb|couchdb" --type md docs/

# Check for broken internal links
rg '\[.*\]\([^h].*\.md\)' docs/ -o | while read link; do
  file=$(echo "$link" | sed -E 's/.*\]\(([^)]+)\).*/\1/')
  [ ! -f "docs/$file" ] && echo "Broken: $file"
done
```

---

## COMPLETED TASKS - Docs Describing Done Work

### Plans Describing COMPLETED Work (Can Archive)

| Plan File | Task ID | Status | Evidence |
|-----------|---------|--------|----------|
| `canvas-group-system-refactor.md` | TASK-141 | ✅ DONE | Native Vue Flow parentNode system rebuilt |
| `canvas-position-system-refactor.md` | TASK-142 | ✅ DONE | Unified Position Manager implemented |
| `canvas-view-stabilization-eliminate-resets.md` | TASK-131 | ✅ DONE | All 6 phases complete, positions stable |
| `system-consolidation-audit.md` | TASK-144 | ✅ DONE | Phases 1-7 complete |
| `system-tech-debt-audit-2026-01-10.md` | TASK-189 | ✅ DONE | Audit complete, serves as reference |

**Recommendation:** Move to `plans/completed/` subfolder for historical reference.

### Plans Still In Progress

| Plan File | Status | Notes |
|-----------|--------|-------|
| `fix-task-position-jump-after-edit.md` | PLANNED | Not started |
| `improve-milkdown-or-replace.md` | PLANNED | Decision framework |
| `pwa-mobile-support.md` | PLANNED | ROAD-004, not started |
| `pomo-flow-landing-page.md` | PARTIAL | Canvas part done |
| `dev-manager-health-dashboard.md` | ACTIVE | Jan 11 work |
| `canvas-group-task-counting-tests.md` | PLANNED | Test design ready |

---

## SOPs - Archive vs Keep

### SOPs to ARCHIVE (16 files) - Issues Resolved

| SOP File | Issue | Completion Date |
|----------|-------|-----------------|
| `CANVAS-blurry-text-fix.md` | BUG-041 text rasterization | Dec 28, 2025 |
| `CANVAS-done-toggle-fix.md` | TASK-076 positioning | Jan 1, 2026 |
| `CANVAS-group-drag-fix.md` | BUG-034 group drag | Dec 23, 2025 |
| `CANVAS-group-resurrection-fix.md` | BUG-060/061 deleted groups | Jan 9, 2026 |
| `CANVAS-header-overflow-fix.md` | BUG-018 header overflow | Dec 19, 2025 |
| `CANVAS-modularization.md` | Operation Defrag | Jan 2, 2026 |
| `CANVAS-resize-jump-fix.md` | BUG-055 resize moving | Jan 1, 2026 |
| `CANVAS-shift-ctrl-selection-separation.md` | BUG-008 selection | Jan 7, 2026 |
| `CANVAS-shift-drag-selection-fix.md` | BUG-001 rubber-band | Jan 6, 2026 |
| `CANVAS-smart-group-instant-updates.md` | TASK-116 updates | Jan 7, 2026 |
| `CANVAS-viewport-jump-fix.md` | BUG-052 viewport | Dec 31, 2025 |
| `STYLING-dark-theme-fix.md` | Dark theme CSS | Nov 27, 2025 |
| `SYNC-backup-false-positive.md` | BUG-062 false positive | Jan 3, 2026 |
| `SYNC-cross-browser.md` | BUG-054 cross-browser | Jan 1, 2026 |
| `SYNC-loop-fix.md` | BUG-012 infinite loop | Dec 16, 2025 |
| `SYNC-supabase-circular-loop-fix.md` | TASK-105 circular | Jan 6, 2026 |
| `SYNC-timer-uuid-validation.md` | BUG-002 UUID | Jan 6, 2026 |
| `UI-filter-highlighting.md` | Filter highlighting | Dec 1, 2025 |
| `UI-sidebar-categories.md` | Sidebar fix | Nov 28, 2025 |

### SOPs to KEEP (17 files) - Still Active

| SOP File | Why Keep |
|----------|----------|
| `CALENDAR-drag-drop-reference.md` | Active reference doc |
| `CANVAS-nested-groups-fix.md` | Complex multi-fix system |
| `canvas-position-debugging.md` | Essential debugging guide |
| `CANVAS-position-reset-fix.md` | Critical 10-fix system |
| `MIGRATION-pouchdb-to-sqlite.md` | Migration utility |
| `SOP-BACKUP-SYSTEM.md` | Active backup docs |
| `SOP-VUE-FLOW-PARENT-CHILD.md` | In-progress refactor |
| `STYLING-glassmorphism-guide.md` | CSS debugging guide |
| `SYNC-conflict-resolution.md` | Active sync reference |
| `SYNC-system-consolidation.md` | Prevention guidelines |
| `TASKS-multi-instance-locking.md` | Active production system |
| `TASKS-raw-safety-pattern.md` | Critical data pattern |
| `TASKS-store-patterns.md` | Active architecture ref |
| `UNDO-system-architecture.md` | Active reference |

---

## ARCHITECTURE DISCREPANCIES

### Stores: Documentation vs Code

| Issue | Details |
|-------|---------|
| **Non-existent store documented** | `taskCanvas.ts` in docs, doesn't exist in code |
| **Missing from docs** | `projects.ts` exists in code, not documented |
| **Missing from docs** | `settings.ts` exists in code, not documented |

**Fix:** Update `architecture.md` store list.

### Composables: Outdated References

| File | Line | Issue |
|------|------|-------|
| `architecture.md` | 86 | References deleted `useDatabase.ts` |
| `architecture.md` | 89 | References deleted `useReliableSyncManager.ts` |
| `database.md` | 59-61 | References 3 deleted composables |
| `troubleshooting.md` | 18 | References PouchDB instance |

**Current composables:** `useSupabaseDatabaseV2.ts`, `supabaseMappers.ts`

---

## OUTDATED PRDs (docs/archive/prd/)

### Severely Outdated - Wrong Tech Stack

| PRD File | Issue | Documented | Actual |
|----------|-------|------------|--------|
| `COMPREHENSIVE_PRD.md` | Database | Firebase Firestore + IndexedDB | Supabase (Postgres) |
| `COMPREHENSIVE_PRD.md` | Backup | JSONBin/GitHub Gist | Shadow Mirror + Postgres dumps |
| `PHASE_3_ARCHITECTURE.md` | Features | Recurring tasks/notifications | Not implemented |
| `SAFE_REFACTORING_PLAN.md` | Auth | Firebase users | Supabase auth |
| `CRITICAL_SYSTEM_RESTORATION_PRD.md` | Crisis | Lists system failures | All resolved, app working |

### PRD Action Items

| PRD | Action |
|-----|--------|
| `COMPREHENSIVE_PRD.md` | Mark as "v1 - November 2025" historical |
| `PHASE_3_ARCHITECTURE.md` | Update or archive |
| `CRITICAL_SYSTEM_RESTORATION_PRD.md` | Archive - crisis resolved |
| `RECURRING_TASKS_NOTIFICATIONS_PRD.md` | Mark as "planned/aspirational" |

---

## FULL ACTION SUMMARY

### DELETE (Safe Removal)
- [ ] `docs/claude-md-extension/database.md`
- [ ] `docs/archive/mapping-old/3.11.25/` (entire folder)
- [ ] `tests/sync/conflict-reproduction.spec.ts`

### ARCHIVE (Move to archive)
- [ ] 16 SOPs → `docs/sop/archived/`
- [ ] 5 completed plans → `plans/completed/`
- [ ] Outdated PRDs - add "HISTORICAL" header

### UPDATE (Fix content)
- [ ] `README.md` - Supabase reference
- [ ] `architecture.md` - Remove PouchDB, add missing stores
- [ ] `troubleshooting.md` - Supabase troubleshooting

### VERIFY (Check implementation)
- [ ] `DUE_DATE_SIMPLIFICATION_COMPLETE.md` - verify scheduledDate removed
- [ ] `canvas-group-task-counting-tests.md` - verify tests exist

---

**Next Steps:** Review this report, then confirm which actions to execute.
