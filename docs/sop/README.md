# FlowState Standard Operating Procedures (SOPs)

**Last Updated**: January 18, 2026
**Total Documents**: 33 (added SOP-011-tauri-distribution.md)

---

## Quick Navigation

| Category | Prefix | Description |
|----------|--------|-------------|
| Canvas | `CANVAS-` | Vue Flow canvas view fixes |
| Calendar | `CALENDAR-` | Calendar drag, resize, scheduling |
| Distribution | `SOP-011` | Tauri desktop builds, releases |
| Migration | `MIGRATION-` | Database migration procedures |
| Sync | `SYNC-` | PouchDB/CouchDB sync, conflicts |
| Styling | `STYLING-` | CSS, glassmorphism, design tokens |
| Tasks | `TASKS-` | Task store, persistence, reactivity |
| Timer | `TIMER-` | Pomodoro timer sync, cross-device |
| UI | `UI-` | General UI components |
| Undo | `UNDO-` | Undo/redo system architecture |

---

## Folder Structure

```
docs/sop/
├── active/      # Current, actively-referenced SOPs
├── canvas/      # Canvas system documentation (Vue Flow)
├── reference/   # Comprehensive guides (not bug-fixes)
└── archived/    # Completed fixes (historical reference)
```

---

## Active SOPs

### Canvas (CANVAS-*)

> **See Also:** [Canvas System Index](./canvas/README.md) for architecture documentation

| File | Description |
|------|-------------|
| `canvas/README.md` | **Index**: Canvas architecture and composable reference |
| `canvas/CANVAS-POSITION-SYSTEM.md` | Position/coordinate system, geometry invariants |
| `canvas/CANVAS-DRAG-DROP.md` | Drag, drop, and selection behavior |
| `canvas/CANVAS-DEBUGGING.md` | Debugging tools and troubleshooting |
| `active/CANVAS-viewport-jump-fix.md` | Viewport initialization without jumps |
| `active/CANVAS-group-drag-fix.md` | Group/section drag operations |
| `active/CANVAS-nested-groups-fix.md` | Nested group drag behavior |
| `active/CANVAS-blurry-text-fix.md` | Text rendering clarity |
| `active/CANVAS-done-toggle-fix.md` | Task completion toggle positioning |
| `active/CANVAS-header-overflow-fix.md` | Section header overflow handling |
| `active/CANVAS-resize-jump-fix.md` | Section resize without jumps |
| `active/CANVAS-modularization.md` | CanvasView.vue modularization |

### Calendar (CALENDAR-*)

| File | Description |
|------|-------------|
| `CALENDAR-drag-drop-reference.md` | **Consolidated**: All drag/drop patterns |

### Sync (SYNC-*)

| File | Description |
|------|-------------|
| `SYNC-loop-fix.md` | Infinite sync loop prevention |
| `SYNC-conflict-resolution.md` | Conflict detection and resolution |
| `SYNC-cross-browser.md` | Cross-browser sync compatibility |
| `SYNC-backup-false-positive.md` | Backup system false positive fix |
| `SYNC-system-consolidation.md` | **Consolidated**: Duplicate system removal |
| `SYNC-supabase-circular-loop-fix.md` | **NEW**: Supabase realtime circular loop fix |

### Styling (STYLING-*)

| File | Description |
|------|-------------|
| `STYLING-glassmorphism-guide.md` | **Consolidated**: All glass/CSS debugging |
| `STYLING-dark-theme-fix.md` | Dark theme visibility issues |

### Migration (MIGRATION-*)

| File | Description |
|------|-------------|
| `MIGRATION-pouchdb-to-sqlite.md` | PouchDB → SQLite migration fixes (BUG-087) |

### Tasks (TASKS-*)

| File | Description |
|------|-------------|
| `TASKS-store-patterns.md` | **Consolidated**: Store refactoring & reactivity |
| `TASKS-multi-instance-locking.md` | Multi-Claude-instance task locking |
| `TASKS-raw-safety-pattern.md` | `_raw*` prefix pattern for safe store data access |

### UI (UI-*)

| File | Description |
|------|-------------|
| `UI-filter-highlighting.md` | Filter highlighting system |
| `UI-sidebar-categories.md` | Sidebar category counts fix |

### Undo (UNDO-*)

| File | Description |
|------|-------------|
| `UNDO-system-architecture.md` | Undo/redo system architecture & troubleshooting |

### Timer (TIMER-*)

| File | Description |
|------|-------------|
| `TIMER-sync-architecture.md` | Cross-device timer sync (Vue app + KDE widget) |

### Distribution (SOP-011)

| File | Description |
|------|-------------|
| `SOP-011-tauri-distribution.md` | Tauri builds, signing, GitHub releases, auto-updater |

---

## Reference Guides

| File | Description |
|------|-------------|
| `canvas-implementation-guide.md` | Complete canvas architecture reference |
| `canvas-safety-guidelines.md` | Anti-patterns and safe development |
| `data-safety-audit.md` | Data safety verification checklist |
| `calendar-consolidation-initiative.md` | Calendar system consolidation roadmap |

---

## Archived SOPs

Historical fixes no longer actively referenced:

| File | Original Issue |
|------|----------------|
| `BUG-037-implementation-plan.md` | Zombie task fix plan |
| `bundle-size-cleanup-2025-12-27.md` | One-time cleanup |
| `deleted-tasks-recreation-fix.md` | Task deletion persistence |
| `inbox-shift-click-fix.md` | Shift-click selection |
| `timer-cross-device-sync-fix.md` | Timer sync issue |
| `tasknode-priority-indicator-fix.md` | Priority badge styling |
| `calendar-ui-element-leakage-fix.md` | Calendar UI cleanup |

---

## Using SOPs with Claude Code

### Finding Relevant SOPs

```bash
# By category
ls docs/sop/active/CANVAS-*
ls docs/sop/active/SYNC-*

# By keyword
grep -l "reactivity" docs/sop/active/*.md
grep -l "drag" docs/sop/active/*.md
```

### SOP Document Structure

Each SOP follows a consistent format:

1. **Header**: Category, Status, Last Updated, Merged From
2. **Overview**: Problem summary
3. **Root Cause**: Technical analysis
4. **Solution**: Code changes with examples
5. **Verification**: Testing checklist
6. **Related Files**: Affected source files

---

## Maintenance Guidelines

### When to Create a New SOP

- After fixing a production bug
- When implementing complex system changes
- For rollback procedures

### Naming Convention

```
{CATEGORY}-{description}.md

Examples:
CANVAS-viewport-persistence.md
SYNC-offline-queue-fix.md
STYLING-priority-colors.md
```

### Consolidation Rules

Merge SOPs when:
- They cover the same component/feature
- One supersedes another
- Combined context is more useful

---

## Migration Notes

**January 2026 Reorganization**:
- Consolidated 44 files → 27 files (~30% reduction)
- Created 4 merged documents from 12 overlapping SOPs
- Established prefix naming for AI retrieval optimization
- Separated active/reference/archived for clarity

**Old Location**: `docs/🐛 debug/sop/` (deprecated, will be removed)
**New Location**: `docs/sop/` (current)

---

## Related Documentation

- `CLAUDE.md` - Project development guidelines
- `docs/MASTER_PLAN.md` - Project roadmap and task tracking
- `docs/conflict-systems-resolution/` - Conflict resolution architecture
