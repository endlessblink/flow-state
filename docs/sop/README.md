# FlowState Standard Operating Procedures (SOPs)

**Last Updated**: January 22, 2026
**Total Documents**: 33 active (17 root + 12 active/ + 4 canvas/), 45 archived

---

## Quick Navigation

| Category | Prefix | Description |
|----------|--------|-------------|
| Canvas | `CANVAS-`, `SOP-018` | Vue Flow canvas view fixes |
| Calendar | `CALENDAR-` | Calendar drag, resize, scheduling |
| Distribution | `SOP-011` | Tauri desktop builds, releases, startup |
| Cloudflare | `SOP-023` | Cloudflare tunnel configuration |
| Menu Patterns | `SOP-024` | Teleported menu patterns for Tauri |
| Vue Flow | `SOP-025` | Tauri WebKitGTK reactivity issues |
| Migration | `MIGRATION-` | Database migration procedures |
| Sync | `SYNC-` | Supabase sync, conflicts |
| Styling | `STYLING-` | CSS, glassmorphism, design tokens |
| Tasks | `SOP-013`, `SOP-019` | Task IDs, multi-agent locking |
| Timer | `TIMER-`, `SOP-012` | Pomodoro timer sync, highlighting |
| UI | `UI-` | General UI components |
| Undo | `UNDO-` | Undo/redo system architecture |
| Skills | `SOP-022` | Skills configuration auto-sync |

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

### Canvas (CANVAS-*, SOP-018)

> **See Also:** [Canvas System Index](./canvas/README.md) for architecture documentation

| File | Description |
|------|-------------|
| `canvas/README.md` | **Index**: Canvas architecture and composable reference |
| `canvas/CANVAS-POSITION-SYSTEM.md` | Position/coordinate system, geometry invariants |
| `canvas/CANVAS-DRAG-DROP.md` | Drag, drop, and selection behavior |
| `canvas/CANVAS-DEBUGGING.md` | Debugging tools and troubleshooting |
| `SOP-018-canvas-group-nesting.md` | Group nesting validation and fixes |

### Calendar (CALENDAR-*)

| File | Description |
|------|-------------|
| `CALENDAR-drag-drop-reference.md` | **Consolidated**: All drag/drop patterns |

### Distribution & Tauri (SOP-011, SOP-024, SOP-025)

| File | Description |
|------|-------------|
| `SOP-011-tauri-distribution.md` | **Complete Guide**: Builds, startup, Supabase detection, signing, releases |
| `SOP-024-teleported-menu-patterns.md` | Teleported menu patterns for Tauri WebView compatibility |
| `SOP-025-tauri-vue-flow-reactivity.md` | Vue Flow reactivity issues in Tauri/WebKitGTK |

> **Note**: SOP-011 consolidates former SOP-014 (Supabase detection) and SOP-015 (startup guide)

### Sync (SYNC-*)

| File | Description |
|------|-------------|
| `SYNC-loop-fix.md` | Infinite sync loop prevention |
| `SYNC-conflict-resolution.md` | Conflict detection and resolution |
| `SYNC-cross-browser.md` | Cross-browser sync compatibility |
| `SYNC-backup-false-positive.md` | Backup system false positive fix |
| `SYNC-system-consolidation.md` | **Consolidated**: Duplicate system removal |
| `SYNC-supabase-circular-loop-fix.md` | Supabase realtime circular loop fix |

### Styling (STYLING-*)

| File | Description |
|------|-------------|
| `STYLING-glassmorphism-guide.md` | **Consolidated**: All glass/CSS debugging |
| `STYLING-dark-theme-fix.md` | Dark theme visibility issues |

### Migration (MIGRATION-*)

| File | Description |
|------|-------------|
| `MIGRATION-pouchdb-to-sqlite.md` | PouchDB to SQLite migration fixes (BUG-087) |

### Tasks & Locking (SOP-013, SOP-019)

| File | Description |
|------|-------------|
| `SOP-013-immutable-task-ids.md` | Immutable task ID system |
| `SOP-019-multi-agent-file-locking.md` | Multi-agent file locking with deferred execution |

### Cloudflare (SOP-023)

| File | Description |
|------|-------------|
| `SOP-023-cloudflare-tunnel-supabase.md` | Cloudflare tunnel with local Supabase |

### UI (UI-*)

| File | Description |
|------|-------------|
| `UI-filter-highlighting.md` | Filter highlighting system |
| `UI-sidebar-categories.md` | Sidebar category counts fix |

### Undo (UNDO-*)

| File | Description |
|------|-------------|
| `active/UNDO-system-architecture.md` | Undo/redo system architecture & troubleshooting |

### Timer (TIMER-*, SOP-012)

| File | Description |
|------|-------------|
| `active/TIMER-sync-architecture.md` | Cross-device timer sync (Vue app + KDE widget) |
| `SOP-012-timer-active-highlight.md` | Active timer task highlighting across views |

### Skills (SOP-022)

| File | Description |
|------|-------------|
| `active/SOP-022-skills-config-sync.md` | Skills configuration auto-sync system |

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

Historical fixes no longer actively referenced (45 files in `archived/`):

| File | Original Issue |
|------|----------------|
| `BUG-037-implementation-plan.md` | Zombie task fix plan |
| `bundle-size-cleanup-2025-12-27.md` | One-time cleanup |
| `deleted-tasks-recreation-fix.md` | Task deletion persistence |
| `inbox-shift-click-fix.md` | Shift-click selection |
| `timer-cross-device-sync-fix.md` | Timer sync issue |
| `tasknode-priority-indicator-fix.md` | Priority badge styling |
| `calendar-ui-element-leakage-fix.md` | Calendar UI cleanup |
| `SOP-VUE-FLOW-PARENT-CHILD.md` | Vue Flow parent-child refactoring (completed) |
| `POWERSYNC-DEPLOYMENT.md` | PowerSync deployment notes |
| `lint-watcher-setup-guide.md` | Lint watcher setup |
| `SOP-localStorage-fallback-fixes.md` | LocalStorage fallback fixes |
| `SOP_RECENT_CHANGES.md` | Recent changes log |
| ... and 33 more |

---

## Using SOPs with Claude Code

### Finding Relevant SOPs

```bash
# By category
ls docs/sop/CANVAS-*
ls docs/sop/active/SYNC-*

# By keyword
grep -l "reactivity" docs/sop/*.md docs/sop/active/*.md
grep -l "drag" docs/sop/canvas/*.md
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
SOP-{NNN}-{description}.md   # Numbered SOPs
{CATEGORY}-{description}.md  # Category-prefixed SOPs

Examples:
SOP-026-new-feature.md
CANVAS-viewport-persistence.md
SYNC-offline-queue-fix.md
```

### ID Assignments

| Range | Usage |
|-------|-------|
| SOP-001 to SOP-010 | Archived/legacy |
| SOP-011 to SOP-021 | Core SOPs (Jan 2026) |
| SOP-022+ | New SOPs (post-consolidation) |

### Consolidation Rules

Merge SOPs when:
- They cover the same component/feature
- One supersedes another
- Combined context is more useful

---

## Migration Notes

**January 22, 2026 Consolidation**:
- Deleted superseded `TASKS-multi-instance-locking.md` (replaced by SOP-019)
- Merged Tauri SOPs: SOP-014, SOP-015 into SOP-011
- Resolved ID conflicts by renumbering:
  - SOP-012 (skills) -> SOP-022
  - SOP-013 (cloudflare) -> SOP-023
  - SOP-013 (teleported) -> SOP-024
  - SOP-019 (tauri-vue-flow) -> SOP-025
- Archived: SOP-VUE-FLOW-PARENT-CHILD, POWERSYNC-DEPLOYMENT, lint-watcher-setup-guide, SOP-localStorage-fallback-fixes

**January 2026 Reorganization**:
- Consolidated 44 files to 33 active (~25% reduction)
- Created 4 merged documents from 12 overlapping SOPs
- Established prefix naming for AI retrieval optimization
- Separated active/reference/archived for clarity

---

## Related Documentation

- `CLAUDE.md` - Project development guidelines
- `docs/MASTER_PLAN.md` - Project roadmap and task tracking
- `docs/conflict-systems-resolution/` - Conflict resolution architecture
