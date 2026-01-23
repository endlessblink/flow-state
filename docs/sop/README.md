# FlowState Standard Operating Procedures (SOPs)

**Last Updated**: January 22, 2026
**Total Documents**: 38 active, 45 archived (83 total)

---

## Quick Navigation

| Category | Location | Description |
|----------|----------|-------------|
| Canvas | `canvas/`, root `SOP-018` | Vue Flow canvas system |
| Calendar | `active/CALENDAR-*` | Calendar drag, resize |
| Distribution | root `SOP-011` | Tauri builds, startup, releases |
| Cloudflare | root `SOP-023` | Tunnel configuration |
| Menu Patterns | root `SOP-024` | Teleported menus for Tauri |
| Vue Flow | root `SOP-025` | Tauri WebKitGTK reactivity |
| Migration | `active/MIGRATION-*` | Database migrations |
| Sync | `active/SYNC-*` | Supabase sync, conflicts |
| Styling | `active/STYLING-*` | CSS, glassmorphism |
| Tasks | root `SOP-013`, `SOP-019` | Task IDs, multi-agent locking |
| Timer | root `SOP-012`, `active/TIMER-*` | Pomodoro sync, highlighting |
| Undo | `active/UNDO-*` | Undo/redo architecture |
| Skills | `active/SOP-022` | Skills config auto-sync |
| Reference | `reference/` | Implementation guides |

---

## Folder Structure

```
docs/sop/
├── *.md           # Numbered SOPs (SOP-001 to SOP-025)
├── active/        # Category-prefixed active SOPs (12 files)
├── canvas/        # Canvas system documentation (4 files)
├── reference/     # Implementation guides (3 files)
├── deployment/    # PWA/VPS deployment guides (2 files)
└── archived/      # Historical fixes (45 files)
```

---

## Active SOPs by Location

### Root Directory (16 files)

| File | Description |
|------|-------------|
| `SOP-004-css-shadow-overflow-clipping.md` | CSS shadow/glow overflow |
| `SOP-006-canvas-resize-handle-visibility.md` | Resize handle visibility |
| `SOP-007-task-node-selection-indicators.md` | Task selection indicators |
| `SOP-008-canvas-connection-ux.md` | Canvas connection UX |
| `SOP-009-reactive-task-nodes.md` | Reactive task nodes |
| `SOP-010-dev-manager-orchestrator.md` | Dev manager orchestrator |
| `SOP-011-tauri-distribution.md` | **Tauri Complete Guide** (builds, startup, Supabase) |
| `SOP-012-timer-active-highlight.md` | Active timer task highlighting |
| `SOP-013-immutable-task-ids.md` | Immutable task ID system |
| `SOP-018-canvas-group-nesting.md` | Group nesting validation |
| `SOP-019-multi-agent-file-locking.md` | Multi-agent file locking |
| `SOP-020-inbox-filter-date-logic.md` | Inbox filter date logic |
| `SOP-021-quick-capture-tab.md` | Quick capture tab feature |
| `SOP-023-cloudflare-tunnel-supabase.md` | Cloudflare tunnel setup |
| `SOP-024-teleported-menu-patterns.md` | Teleported menu patterns |
| `SOP-025-tauri-vue-flow-reactivity.md` | Tauri Vue Flow reactivity |
| `SOP-026-custom-domain-deployment.md` | Custom domain (in-theflow.com) setup |
| `SOP-027-mobile-testing-workflow.md` | Mobile testing via Playwright viewport |

### Active Directory (12 files)

| File | Description |
|------|-------------|
| `CALENDAR-drag-drop-reference.md` | Calendar drag/drop patterns |
| `MIGRATION-pouchdb-to-sqlite.md` | PouchDB to SQLite migration |
| `SOP-016-guest-mode-auth-flow.md` | Guest mode authentication |
| `SOP-022-skills-config-sync.md` | Skills configuration auto-sync |
| `SOP-AUTH-reliability.md` | Auth reliability patterns |
| `STYLING-glassmorphism-guide.md` | Glassmorphism CSS guide |
| `SYNC-conflict-resolution.md` | Conflict detection/resolution |
| `SYNC-system-consolidation.md` | Sync system consolidation |
| `TASKS-raw-safety-pattern.md` | `_raw*` prefix pattern |
| `TASKS-store-patterns.md` | Store refactoring patterns |
| `TIMER-sync-architecture.md` | Cross-device timer sync |
| `UNDO-system-architecture.md` | Undo/redo architecture |

### Canvas Directory (4 files)

| File | Description |
|------|-------------|
| `README.md` | Canvas architecture index |
| `CANVAS-POSITION-SYSTEM.md` | Position/coordinate system |
| `CANVAS-DRAG-DROP.md` | Drag, drop, selection |
| `CANVAS-DEBUGGING.md` | Debugging tools |

### Reference Directory (3 files)

| File | Description |
|------|-------------|
| `canvas-implementation-guide.md` | Canvas architecture reference |
| `data-safety-audit.md` | Data safety checklist |
| `calendar-consolidation-initiative.md` | Calendar consolidation roadmap |

---

## Archived SOPs (45 files)

Historical fixes in `archived/`. Notable entries:

| File | Original Issue |
|------|----------------|
| `SYNC-loop-fix.md` | Infinite sync loop prevention |
| `SYNC-supabase-circular-loop-fix.md` | Supabase realtime loop |
| `STYLING-dark-theme-fix.md` | Dark theme visibility |
| `UI-filter-highlighting.md` | Filter highlighting |
| `UI-sidebar-categories.md` | Sidebar category counts |
| `SOP-VUE-FLOW-PARENT-CHILD.md` | Vue Flow parent-child refactoring |
| `CANVAS-*.md` | Various canvas fixes (10+ files) |
| `BUG-*.md` | Bug fix documentation |

---

## ID Assignments

| Range | Usage |
|-------|-------|
| SOP-001 to SOP-010 | Legacy/archived |
| SOP-011 to SOP-021 | Core active SOPs |
| SOP-022 to SOP-025 | Post-consolidation SOPs |
| SOP-026+ | Future SOPs |

---

## Consolidation Notes (January 22, 2026)

- Merged SOP-014, SOP-015 into SOP-011 (Tauri guide)
- Deleted `TASKS-multi-instance-locking.md` (superseded by SOP-019)
- Renumbered to resolve ID conflicts:
  - SOP-012 (skills) → SOP-022
  - SOP-013 (cloudflare) → SOP-023
  - SOP-013 (teleported) → SOP-024
  - SOP-019 (tauri-vue-flow) → SOP-025
- Archived 5 miscellaneous files

---

## Related Documentation

- `CLAUDE.md` - Project development guidelines
- `docs/MASTER_PLAN.md` - Project roadmap
