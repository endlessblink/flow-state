# Changelog

All notable changes to FlowState will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open-source release preparation (Polyform Shield license, self-hosting docs)
- Context menu redesign with 9 clean items and progressive disclosure submenus
- KDE widget edit panel: due date ComboBox + proper button sizing
- Active task glass pill in AppHeader and KDE companion widget
- Rich nanny notification popup replacing notify-send (native QML)
- Comprehensive offline support across all app features
- KDE widget "Today" toggle composable chip filter
- KDE widget reliable Tauri launch with scroll fix and dev link
- Auto-inherit group properties when creating a task inside a group

### Fixed
- Pending writes re-applied after background Supabase token refresh
- Active task pill cleared when timer session ends
- KDE widget task not appearing after creation
- Sync queue write queue payloads mapped from DB format to app format
- Cache-first PWA loading for offline task creation
- Sidebar date filters no longer navigate away from current view
- Scrollbar ghost/teal bleed-through on KDE Linux

### Changed
- Performance: O(N) dedup, single-pass counts, optimizeDeps for faster localhost

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
