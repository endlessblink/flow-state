# Changelog

All notable changes to FlowState will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

**Context Menu & Task Actions**
- Context menu redesign with 9 clean items and progressive disclosure submenus (priority, more actions)
- AI Assist integration in context menu, edit modal, and quick create
- Batch edit modal for bulk task property updates
- Inbox multi-select with bulk property updates (TASK-1419)
- "On Canvas" inbox filter
- Focus Mode button on task cards and rows

**Calendar**
- Calendar drag-create for quick event creation
- Calendar week view resize improvements
- Calendar active task highlight synced with running timer (TASK-1409)
- Calendar day view task edit preserves instance without disappearing (BUG-1365)
- Calendar done tasks no longer reappear or disappear unexpectedly (BUG-1343, BUG-1365)
- Calendar context menu right-click works when filters are active (BUG-1291)
- Calendar timer play button no longer resets timer for same task (BUG-1294)
- Calendar task instance: cumulative time tracking + start time never moves (BUG-1291)
- Calendar inbox no longer filtered by board smart view (BUG-1352)
- Calendar week view slivers and month header fixes (BUG-1307, BUG-1308)

**KDE Widget**
- KDE widget edit panel with due date ComboBox and proper button sizing (TASK-1443)
- Quick task creation directly from KDE widget (TASK-1292)
- Rich nanny notification popup (native QML, replaces notify-send) (TASK-1424)
- KDE widget "Today" toggle composable chip filter (TASK-1431)
- KDE widget reliable Tauri launch with scroll fix and dev link (TASK-1423)
- KDE Plasma freeze prevention (BUG-1347)
- Native KDE Plasma notifications via notify-send fallback (BUG-1302)

**Offline / PWA**
- Cache-first PWA loading for offline task creation (TASK-1428)
- Comprehensive offline support across all app features (TASK-1438–1442)
- Chunk load failure auto-recovery: unregisters stale service worker and reloads (BUG-1184)
- Post-deploy chunk integrity verification in CI/CD (BUG-1184)
- Offline sync unit test suite — 172 tests (TASK-1177)

**AI & Weekly Plan**
- AI Chat with native function calling, streaming, and voice input (FEATURE-1223)
- AI Chat history persistence and popover positioning (FEATURE-1223)
- AI Chat slash commands for help and skills
- AI Chat tab added to header navigation
- AI memory health dashboard (TASK-1356)
- AI usage tracking with router-level auto-recording (TASK-1316)
- Weekly Plan AI: chip-based interview, deterministic questions, mandatory scheduling rules (TASK-1385)
- Weekly Plan AI: personal context connected to Supabase WorkProfile (TASK-1385)
- Weekly Plan AI: replace LLM distribution with deterministic algorithm (TASK-1405)
- Weekly Plan AI: model selector with centralized LLM model registry (TASK-1327)
- Proactive Google Calendar token refresh (TASK-1283)
- Google Auth sign-in across PWA, Tauri, and KDE widget (FEATURE-1202)
- AI proactive nudges and task quick-edit popover (TASK-1283)
- LLM intent classifier for Hebrew and multilingual input (TASK-1413)
- Whisper large-v3 for improved Hebrew transcription accuracy (TASK-1345)
- AI prompt quality improvements: 14-finding audit, 24 tests added (TASK-1350)

**Gamification**
- Gamification corruption overlay, arena, and stale UI removed (BUG-1309)
- RPG HUD active mission indicator (TASK-1305)
- Recurring tasks: clone-on-complete with recurrence_rule column (TASK-1403)
- Challenges database migration and system refactor (FEATURE-1132)

**Mobile**
- Single-screen onboarding welcome modal (FEATURE-1201)
- Mobile FAB replacing quick-add bar + two-finger swipe hint
- Mobile QuickSort: 4-direction swipe, edit-in-place advancement, tab integration (TASK-1320)
- Mobile QuickSort split into 6 sub-components (TASK-1144)
- Mobile command panel with two-finger pull-down gesture
- Mobile AI chat with RTL and Hebrew support
- Quick Sort card date picker (TASK-1311)
- "Next 3 Days" inbox filter (TASK-1247)

**Canvas**
- Canvas-task bridge module to eliminate circular dependency (TASK-1158)
- Canvas Ctrl+Click toggle selection (BUG-1295)
- Drag-to-group-header: dueDate support + add-task button (TASK-1342)
- Smart Suggest feedback writes to memory graph (FEATURE-1342)
- Sidebar-to-canvas task creation
- "On Canvas" inbox filter (TASK-1420)

**Infrastructure & Security**
- Open-source release preparation: Polyform Shield license, self-hosting docs
- Self-hosting Docker Compose stack with setup script (TASK-1223)
- Rate limiting and authentication on API endpoints (BUG-1142)
- Tauri Content Security Policy enabled (BUG-1134)
- Tauri shell permissions restricted to explicit allowlist (BUG-1135)
- Tauri filesystem write scope restricted to app-specific paths (BUG-1139)
- CI/CD parameterization for OSS readiness
- Design token migration: top 10 offending files migrated from hardcoded CSS (TASK-1266)
- Focus Mode view rebuilt with design tokens and full functionality
- Keyboard shortcuts panel with search filter (TASK-1319)
- Settings modal restructured from 6 to 7 tabs (TASK-1321)
- Time block notification system (TASK-1219)
- Tauri UI state persistence (usePersistentRef) across all useStorage calls (TASK-1215)
- Timer store split into 4 focused services (TASK-1149)

**AppHeader & UI**
- Active task glass pill in AppHeader showing currently running timer task (TASK-1435)
- KDE companion widget active task display

### Fixed

- Pending writes re-applied after background Supabase token refresh (TASK-1428)
- Active task pill cleared when timer session ends (TASK-1435)
- KDE widget task not appearing after creation (BUG-1435)
- Sync queue write queue payloads mapped from DB format to app format (TASK-1428)
- Sidebar date filters no longer navigate away from current view (BUG-1430)
- Scrollbar ghost/teal bleed-through on KDE Linux
- Canvas node extent too small causing invisible drag barrier for groups (BUG-1310)
- Canvas position drift eliminated: reconciliation race + stale parentId write-back (BUG-1203, BUG-1209)
- Canvas tasks nearly invisible due to undefined shadow tokens (BUG-1417)
- Canvas tasks blurry when zooming out (BUG-1408)
- Canvas done tasks reappearing after refresh (BUG-1365)
- Canvas Ctrl+Click selection blocked by pointer-events (BUG-1295)
- Canvas nested group creation at correct position (BUG-1127)
- Canvas CSS tokenization damage: shadows and phantom tokens (BUG-1293)
- Kanban drag-drop completely broken due to vuedraggable bare boolean attrs (BUG-1335)
- Board tasks stuck in Overdue column after drag (BUG-1189)
- Board empty columns appearing after refresh (BUG-1365)
- Sync queue duplicate key: switched insert to upsert for CREATE (BUG-1212)
- Soft-delete writing wrong column (`_soft_deleted` → `is_deleted`) causing permanent task loss (BUG-1211)
- Task disappearance on sync: LWW conflict resolution now applies serverData correctly (BUG-1211)
- Sync indicator stuck on "Syncing 1 changes..." forever (BUG-1301)
- Sync queue orphaned "null" string in payload sanitized
- Tauri task edit data loss (BUG-1206)
- Tauri infinite loading: guard all Notification.requestPermission() calls (BUG-1303)
- Tauri drag-drop immediate cancel on WebKitGTK (BUG-1370)
- Tauri sync broken by incorrect anon key now validated at startup (BUG-1183)
- Inbox-to-canvas drop blocked during drag-settling window (BUG-1361)
- Drag ghost pill self-cleaning safety net (BUG-1361)
- Calendar drag ghost stuck after inbox drop (BUG-1351)
- Timer auto-starting work session after break on multi-device (BUG-1315)
- Timer restart prevented when pressing play on already-running timer
- Timer not starting from calendar/canvas play buttons (BUG-1291)
- Phantom calendar task instances auto-appearing without user action (BUG-1325)
- Quick Sort progress bar jumping on project assign (BUG-1349)
- Quick Sort card overflow and bottom controls cut off by nav bar (BUG-1406)
- PWA service worker infinite reload loop in dev mode (BUG-1322)
- PWA mobile sync network resilience (BUG-352)
- CORS dynamic origin reflection replaced with allowlist (BUG-1132)
- Edge Function CORS scoping bug breaking AI chat (BUG-1131)
- Canvas nodes not refreshing on smart view change (BUG-1210)
- Tombstone RLS update policy (BUG-1136)
- Production CSP headers (BUG-1141)
- Supabase URL console.log guarded with DEV mode check (BUG-1140)
- Sidebar smart view filter not persisting in Tauri (BUG-1219)
- Priority badge color mismatch: medium now orange (BUG-1348)
- vue-i18n v9/v11 incompatibility causing SyntaxError in production (BUG-1359)
- TipTap editor content reset: compare markdown instead of HTML to prevent sync echo
- Task content deletion on save caused by sync echo overwrite
- npm audit: 7 vulnerabilities resolved (3 high, 3 moderate, 1 low) (TASK-1174)
- Mobile QuickSort visual issues and inbox task list cutoff
- Mobile pull-down native gesture disabled to prevent swipe-back exit (BUG-1343)
- Phantom CSS tokens breaking mobile views (BUG-1346)
- Console log spam removed (BUG-1320, TASK-1323)

### Changed
- Performance: O(N) dedup, single-pass counts, optimizeDeps for faster localhost (TASK-1421)
- Optimistic updates for task delete and bulk-delete with failure toast (TASK-1159)
- Calendar header view options consolidated into popover, removed action buttons
- Status values simplified: full audit of old status refs removed
- MobileQuickSortView split into 6 focused sub-components (TASK-1144)
- Timer store refactored into 4 focused services (TASK-1149)
- Canvas overdue task collector quarantined (violates geometry invariants)
- Stale gamification/cyberflow Storybook stories removed (25 stories)
- Root clutter cleanup: 331 unused files removed (TASK-1246)
- LLM model registry centralized as single source of truth (TASK-1327)

### Security
- Rate limiting and auth added to all REST API endpoints (BUG-1142)
- Tauri CSP enabled and shell permissions restricted to allowlist (BUG-1134, BUG-1135)
- Tauri filesystem scope restricted to app-specific paths (BUG-1139)
- CORS origin allowlist replaces dynamic reflection (BUG-1132)
- Tombstone RLS policy corrected (BUG-1136)
- Production CSP headers hardened (BUG-1141)
- v-html XSS audit completed — all 5 usages verified secure (BUG-1133)
- isAdmin localStorage override guarded by DEV mode (BUG-1138)
- Client-side API key code fully removed (BUG-1131)

---

## [1.2.3] - 2026-02-02

### Added
- Gamification XP bar and level display integrated into app header (FEATURE-1118)

### Fixed
- UUID validation for sync queue — groups and tasks now properly validated before writes (TASK-1183)
- LWW conflict resolution: auto-resolve version conflicts with last-write-wins strategy

---

## [1.2.2] - 2026-01-31

### Fixed
- Hotfix: sync edge cases from 1.2.1 stabilization

---

## [1.2.1] - 2026-01-31

### Fixed
- Quick Sort project buttons no longer truncate names (BUG-1129)
- Hebrew transcription no longer confused with Arabic script (BUG-1109)
- Tauri sync broken by incorrect anon key in `.env.production` (BUG-1111)
- CSS text-align for RTL voice inputs (BUG-1108)
- Circular dependency causing TDZ error in canvas store (BUG-1099)

---

## [1.2.0] - 2026-01-31

### Added
- VPS Supabase self-hosted production deployment (Contabo VPS + Caddy + Cloudflare)
- Tauri auto-updater with signed AppImage distribution (TASK-1114)
- NLP parser integrated into mobile voice input (FEATURE-1023)
- Groq/Ollama AI chat with Tauri-aware API routing
- RLS enabled on all 19 Supabase tables (TASK-161 follow-up)
- KDE widget dropdowns with glass morphism design tokens (TASK-1111)
- Mobile improvements: task picker v2, canvas interactions, timer fixes
- SOPs for mobile network resilience (SOP-041) and RTL support (SOP-042)

### Fixed
- Tauri release profile optimizations for better performance (BUG-1115)
- PWA mobile sync errors resolved (BUG-1107)

---

## [1.1.0-hardening] - 2026-01-11

### Added
- Canvas hardening: optimistic sync with position-lock semantics (7 s timeout)
- Architecture consolidation: `useCanvasSync.ts` as single read-only sync source
- Canvas geometry invariants enforced — drag handlers are sole position writers
- Settings system refactor with integrated backup settings panel
- Guest mode fully ephemeral with no data leakage (TASK-147)

### Changed
- CanvasView decomposed into dedicated stores and composables (~30 canvas composables)
- Migrated to `useSupabaseDatabaseV2` to resolve caching issues and PGRST204 errors
- Board view deep refinement with CSS extraction and logic externalization

### Fixed
- Canvas task nodes rendering empty on first refresh (BUG-151)
- Deleted groups no longer reappear after sync (BUG-060, BUG-061)
- Critical canvas resize/reset bugs in sync logic

---

## [0.9.1] - 2025-12-25

### Changed
- Task store refactoring complete: consolidated duplicate Conflict, Backup, and Sync systems
- Components reorganized into subdirectories (TASK-037)
- Backup settings re-enabled and integrated into SettingsModal

---

## [0.9.0] - 2025-12-23

### Added
- Major refactoring stable checkpoint
- Canvas group system complete refactor (TASK-141)
- RLS enabled on all Supabase tables (TASK-161)

### Changed
- Legacy context menu and sanitizer files cleaned up (TASK-144)
- CanvasView logic extracted to dedicated stores and composables

---

[Unreleased]: https://github.com/endlessblink/flow-state/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/endlessblink/flow-state/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/endlessblink/flow-state/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/endlessblink/flow-state/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/endlessblink/flow-state/compare/v1.1.0-hardening...v1.2.0
[1.1.0-hardening]: https://github.com/endlessblink/flow-state/compare/v0.9.1...v1.1.0-hardening
[0.9.1]: https://github.com/endlessblink/flow-state/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/endlessblink/flow-state/releases/tag/v0.9.0
