# FlowState Standard Operating Procedures (SOPs)

**Last Updated**: April 5, 2026
**Total Documents**: 31 active, 57 archived (88 total)

---

## Quick Navigation

| Category | Location | Description |
|----------|----------|-------------|
| Canvas | `canvas/`, root `SOP-018` | Vue Flow canvas system |
| Calendar | `active/CALENDAR-*` | Calendar drag, resize |
| Distribution | root `SOP-065` | Electron desktop app |
| Attachments | root `SOP-057` | Google Drive image attachments |
| Cloudflare | root `SOP-023` | Tunnel configuration |
| Menu Patterns | root `SOP-024` | Teleported menus |
| Vue Flow | root `SOP-025` | Vue Flow reactivity patterns |
| Styling | `active/STYLING-*` | CSS, glassmorphism |
| Tasks | root `SOP-013`, `SOP-019` | Task IDs, multi-agent locking |
| Timer | root `SOP-012`, `active/TIMER-*` | Pomodoro sync, highlighting |
| Undo | `active/UNDO-*` | Undo/redo architecture |
| Skills | `active/SOP-022` | Skills config auto-sync |

---

## Folder Structure

```
docs/sop/
├── *.md           # Numbered SOPs (SOP-001 to SOP-068)
├── active/        # Category-prefixed active SOPs (9 files)
├── canvas/        # Canvas system documentation (7 files)
├── deployment/    # PWA/VPS deployment guides (2 files)
└── archived/      # Historical fixes (57 files)
```

---

## Active SOPs by Location

### Root Directory (47 files)

| File | Description |
|------|-------------|
| `SOP-004-css-shadow-overflow-clipping.md` | CSS shadow/glow overflow |
| `SOP-009-reactive-task-nodes.md` | Reactive task nodes |
| `SOP-010-dev-manager-orchestrator.md` | Dev manager orchestrator |
| `SOP-012-timer-active-highlight.md` | Active timer task highlighting |
| `SOP-013-immutable-task-ids.md` | Immutable task ID system |
| `SOP-018-canvas-group-nesting.md` | Group nesting validation |
| `SOP-019-multi-agent-file-locking.md` | Multi-agent file locking |
| `SOP-020-inbox-filter-date-logic.md` | Inbox filter date logic |
| `SOP-023-cloudflare-tunnel-supabase.md` | Cloudflare tunnel setup |
| `SOP-024-teleported-menu-patterns.md` | Teleported menu patterns |
| `SOP-025-tauri-vue-flow-reactivity.md` | Vue Flow reactivity patterns |
| `SOP-026-custom-domain-deployment.md` | Custom domain (in-theflow.com) setup |
| `SOP-027-mobile-testing-workflow.md` | Mobile testing via Playwright viewport |
| `SOP-028-watchpost-task-sync.md` | Watchpost task status sync issues |
| `SOP-029-ai-verification-hooks.md` | AI "done" claim verification system |
| `SOP-030-doppler-secrets-management.md` | Doppler secrets management |
| `SOP-031-cors-configuration.md` | CORS configuration for self-hosted Supabase |
| `SOP-032-cloudflare-cache-mime-prevention.md` | Cloudflare cache MIME type prevention |
| `SOP-033-cloudflare-ci-cd-auto-purge.md` | Cloudflare CI/CD automatic cache purge |
| `SOP-035-auth-initialization-race-fix.md` | Auth initialization race condition fix |
| `SOP-036-supabase-jwt-key-regeneration.md` | Supabase JWT key regeneration |
| `SOP-038-kde-widget-supabase-config.md` | KDE widget Supabase configuration |
| `SOP-039-timer-active-highlight-calendar.md` | Timer-active highlight for calendar events |
| `SOP-040-cross-device-position-sync.md` | Cross-device position sync |
| `SOP-041-kde-widget-combobox-popup.md` | KDE Plasma 6 widget ComboBox popup handling |
| `SOP-042-rtl-support-pattern.md` | RTL support pattern for text inputs |
| `SOP-043-kde-plasma6-notifications.md` | KDE Plasma 6 widget notifications |
| `SOP-044-vps-dns-oauth-troubleshooting.md` | VPS DNS & OAuth redirect troubleshooting |
| `SOP-046-weekly-plan-ai-pipeline.md` | Weekly plan AI pipeline |
| `SOP-048-mobile-route-guards.md` | Mobile route guards |
| `SOP-049-watchpost-parser.md` | Watchpost MASTER_PLAN.md parser rules |
| `SOP-050-store-auth-initialization.md` | Store auth-wait initialization pattern |
| `SOP-051-mobile-client.md` | Self-hosted mobile client for Claude Code + Watchpost |
| `SOP-052-data-persistence-patterns.md` | Data persistence patterns |
| `SOP-054-realtime-sync-position-preservation.md` | Realtime sync position preservation |
| `SOP-055-whisper-edge-function.md` | Whisper voice transcription via Supabase Edge Function |
| `SOP-056-inbox-panel-auto-size.md` | Inbox panel auto-size width |
| `SOP-057-google-drive-attachments.md` | **Google Drive Attachments** (self-hosted setup guide) |
| `SOP-058-naive-ui-date-picker-styling.md` | Naive UI date picker styling |
| `SOP-059-stress-testing.md` | Stress testing system |
| `SOP-060-calendar-time-indicator.md` | Calendar current time indicator |
| `SOP-060-webkitgtk-gotchas.md` | WebKitGTK cross-platform gotchas |
| `SOP-061-mobile-pwa-network-resilience.md` | Mobile PWA network resilience |
| `SOP-062-route-error-boundary.md` | Route error boundary for dynamic import failures |
| `SOP-063-mobile-swipe-gestures.md` | Mobile swipe gesture implementation |
| `SOP-064-task-permanent-delete.md` | Task permanent delete architecture |
| `SOP-065-electron-desktop-app.md` | **Electron Desktop App** (builds, distribution, auto-updater) |
| `SOP-066-compact-chip-overflow.md` | Compact chips & pills overflow/clipping fixes |
| `SOP-067-recurrence-scheduler-dedup.md` | Recurrence scheduler deduplication |
| `SOP-068-testing-strategy.md` | Testing strategy |

### Active Directory (9 files)

| File | Description |
|------|-------------|
| `CALENDAR-drag-drop-reference.md` | Calendar drag/drop patterns |
| `SOP-016-guest-mode-auth-flow.md` | Guest mode authentication |
| `SOP-022-skills-config-sync.md` | Skills configuration auto-sync |
| `SOP-AUTH-reliability.md` | Auth reliability patterns |
| `SOP-DATE-FIELD-SYNC.md` | Unified task property sync system (BUG-1321) |
| `STYLING-glassmorphism-guide.md` | Glassmorphism CSS guide |
| `TASKS-raw-safety-pattern.md` | `_raw*` prefix pattern |
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

---

## Archived SOPs (57 files)

Historical fixes in `archived/`. Notable entries:

| File | Original Issue |
|------|----------------|
| `SOP-006-canvas-resize-handle-visibility.md` | Canvas resize handle visibility (Resolved) |
| `SOP-007-task-node-selection-indicators.md` | Task node selection indicators (Resolved) |
| `SOP-008-canvas-connection-ux.md` | Canvas connection UX (Resolved) |
| `SOP-011-tauri-distribution.md` | Tauri distribution — superseded by SOP-065 (Electron) |
| `SOP-021-quick-capture-tab.md` | Quick capture tab feature (Complete) |
| `SOP-034-tauri-linux-microphone.md` | Tauri Linux microphone limitation — superseded by SOP-065 |
| `SOP-037-tauri-updater-signing.md` | Tauri auto-updater & signing — superseded by SOP-065 |
| `SOP-045-tauri-appimage-update-workflow.md` | Tauri AppImage update workflow — superseded by SOP-065 |
| `SOP-047-tauri-webkit-drag-drop.md` | Tauri WebKitGTK drag-and-drop — superseded by SOP-065 |
| `SOP-053-tauri-linux-css-limitations.md` | Tauri Linux CSS limitations — superseded by SOP-065 |
| `MIGRATION-pouchdb-to-sqlite.md` | PouchDB to SQLite migration |
| `SYNC-conflict-resolution.md` | Conflict detection/resolution |
| `SYNC-system-consolidation.md` | Sync system consolidation |
| `SYNC-loop-fix.md` | Infinite sync loop prevention |
| `SYNC-supabase-circular-loop-fix.md` | Supabase realtime loop |
| `STYLING-dark-theme-fix.md` | Dark theme visibility |
| `TASKS-store-patterns.md` | Store refactoring patterns |
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
| SOP-058 to SOP-068 | Post-March 2026 SOPs |

---

## Updates (April 5, 2026)

- Archived 6 Tauri SOPs (SOP-011, 034, 037, 045, 047, 053) — superseded by SOP-065-electron-desktop-app.md
- Archived 4 resolved SOPs (SOP-006, 007, 008, 021)
- Renamed SOP-065-recurrence-scheduler-dedup.md → SOP-067 and SOP-065-testing-strategy.md → SOP-068 to fix ID collision
- Removed non-existent `reference/` directory from folder structure
- Corrected 4 active/ table entries that were actually in archived/ (MIGRATION-pouchdb-to-sqlite, SYNC-conflict-resolution, SYNC-system-consolidation, TASKS-store-patterns)
- Fixed SOP-006 internal title (was "SOP-005")
- Fixed "Pomo-Flow" → "FlowState" in STYLING-glassmorphism-guide.md
- Updated architecture diagram in SOP-030: "Release (Tauri)" → "Release (Electron)"

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
