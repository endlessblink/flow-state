# FlowState Standard Operating Procedures (SOPs)

**Last Updated**: March 18, 2026
**Total Documents**: 40 active, 45 archived (85 total)

---

## Quick Navigation

| Category | Location | Description |
|----------|----------|-------------|
| Canvas | `canvas/`, root `SOP-018` | Vue Flow canvas system |
| Calendar | `active/CALENDAR-*` | Calendar drag, resize |
| Distribution | root `SOP-011` | Tauri builds, startup, releases |
| Attachments | root `SOP-057` | Google Drive image attachments |
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
├── *.md           # Numbered SOPs (SOP-001 to SOP-066)
├── active/        # Category-prefixed active SOPs (13 files)
├── canvas/        # Canvas system documentation (7 files)
├── reference/     # Implementation guides (3 files)
├── deployment/    # PWA/VPS deployment guides (2 files)
└── archived/      # Historical fixes (45 files)
```

---

## Active SOPs by Location

### Root Directory (57 files)

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
| `SOP-028-watchpost-task-sync.md` | Watchpost task status sync issues |
| `SOP-029-ai-verification-hooks.md` | AI "done" claim verification system |
| `SOP-030-doppler-secrets-management.md` | Doppler secrets management |
| `SOP-031-cors-configuration.md` | CORS configuration for self-hosted Supabase |
| `SOP-032-cloudflare-cache-mime-prevention.md` | Cloudflare cache MIME type prevention |
| `SOP-033-cloudflare-ci-cd-auto-purge.md` | Cloudflare CI/CD automatic cache purge |
| `SOP-034-tauri-linux-microphone.md` | Tauri Linux microphone limitation |
| `SOP-035-auth-initialization-race-fix.md` | Auth initialization race condition fix |
| `SOP-036-supabase-jwt-key-regeneration.md` | Supabase JWT key regeneration |
| `SOP-037-tauri-updater-signing.md` | **Tauri in-app auto-updater & signing** |
| `SOP-038-kde-widget-supabase-config.md` | KDE widget Supabase configuration |
| `SOP-039-timer-active-highlight-calendar.md` | Timer-active highlight for calendar events |
| `SOP-040-cross-device-position-sync.md` | Cross-device position sync |
| `SOP-041-kde-widget-combobox-popup.md` | KDE Plasma 6 widget ComboBox popup handling |
| `SOP-042-rtl-support-pattern.md` | RTL support pattern for text inputs |
| `SOP-043-kde-plasma6-notifications.md` | KDE Plasma 6 widget notifications |
| `SOP-044-vps-dns-oauth-troubleshooting.md` | VPS DNS & OAuth redirect troubleshooting |
| `SOP-045-tauri-appimage-update-workflow.md` | Tauri AppImage update workflow |
| `SOP-046-weekly-plan-ai-pipeline.md` | Weekly plan AI pipeline |
| `SOP-047-tauri-webkit-drag-drop.md` | Tauri WebKitGTK drag-and-drop fix |
| `SOP-048-mobile-route-guards.md` | Mobile route guards |
| `SOP-049-watchpost-parser.md` | Watchpost MASTER_PLAN.md parser rules |
| `SOP-050-store-auth-initialization.md` | Store auth-wait initialization pattern |
| `SOP-051-mobile-client.md` | Self-hosted mobile client for Claude Code + Watchpost |
| `SOP-052-data-persistence-patterns.md` | Data persistence patterns |
| `SOP-053-tauri-linux-css-limitations.md` | Tauri Linux CSS limitations (WebKitGTK) |
| `SOP-054-realtime-sync-position-preservation.md` | Realtime sync position preservation |
| `SOP-055-whisper-edge-function.md` | Whisper voice transcription via Supabase Edge Function |
| `SOP-056-inbox-panel-auto-size.md` | Inbox panel auto-size width |
| `SOP-057-google-drive-attachments.md` | **Google Drive Attachments** (self-hosted setup guide) |
| `SOP-058-naive-ui-date-picker-styling.md` | Naive UI date picker styling |
| `SOP-059-stress-testing.md` | Stress testing system |
| `SOP-060-calendar-time-indicator.md` | Calendar current time indicator |
| `SOP-061-mobile-pwa-network-resilience.md` | Mobile PWA network resilience |
| `SOP-062-route-error-boundary.md` | Route error boundary for dynamic import failures |
| `SOP-063-mobile-swipe-gestures.md` | Mobile swipe gesture implementation |
| `SOP-064-task-permanent-delete.md` | Task permanent delete architecture |
| `SOP-065-recurrence-scheduler-dedup.md` | Recurrence scheduler deduplication |
| `SOP-066-compact-chip-overflow.md` | Compact chips & pills overflow/clipping fixes |

### Active Directory (13 files)

| File | Description |
|------|-------------|
| `CALENDAR-drag-drop-reference.md` | Calendar drag/drop patterns |
| `MIGRATION-pouchdb-to-sqlite.md` | PouchDB to SQLite migration |
| `SOP-016-guest-mode-auth-flow.md` | Guest mode authentication |
| `SOP-022-skills-config-sync.md` | Skills configuration auto-sync |
| `SOP-AUTH-reliability.md` | Auth reliability patterns |
| `SOP-DATE-FIELD-SYNC.md` | Unified task property sync system (BUG-1321) |
| `STYLING-glassmorphism-guide.md` | Glassmorphism CSS guide |
| `SYNC-conflict-resolution.md` | Conflict detection/resolution |
| `SYNC-system-consolidation.md` | Sync system consolidation |
| `TASKS-raw-safety-pattern.md` | `_raw*` prefix pattern |
| `TASKS-store-patterns.md` | Store refactoring patterns |
| `TIMER-sync-architecture.md` | Cross-device timer sync |
| `UNDO-system-architecture.md` | Undo/redo architecture |

### Canvas Directory (7 files)

| File | Description |
|------|-------------|
| `README.md` | Canvas architecture index |
| `CANVAS-POSITION-SYSTEM.md` | Position/coordinate system |
| `CANVAS-DRAG-DROP.md` | Drag, drop, selection |
| `CANVAS-DEBUGGING.md` | Debugging tools |
| `CANVAS-DUPLICATE-DETECTION.md` | Duplicate node detection |
| `CANVAS-NODE-EXTENT.md` | Node extent/boundary system |
| `PENDING-WRITE-REGISTRY.md` | Pending write registry pattern |

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
| SOP-022 to SOP-027 | Post-consolidation + Addendum SOPs |
| SOP-028 to SOP-047 | Feature & infrastructure SOPs |
| SOP-048 to SOP-057 | Renumbered duplicates (March 2026) |
| SOP-058 to SOP-066 | Post-March 2026 SOPs |

---

## Updates (March 18, 2026)

- Added SOP-066: Compact Chips & Pills — Overflow and Clipping Fixes (QuickSort and CategorySelector patterns)

## Updates (March 7, 2026)

- Renumbered 10 duplicate SOP IDs (SOP-048 to SOP-057) to resolve conflicts
- Previous SOP-026/031/032/033/035/036/037/038 had 2-3 files sharing the same number

## Updates (February 23, 2026)

- Added SOP-038: Google Drive Attachments Setup for FEATURE-1414

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
