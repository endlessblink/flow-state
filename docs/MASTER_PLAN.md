**Last Updated**: January 4, 2026 (BUG-087 Migration Data Loss Fix)
**Version**: 5.16 (SQLite Migration Stability)
**Baseline**: Checkpoint `93d5105` (Dec 5, 2025)

---

## Archive

- **January 2026 completed tasks**: [docs/archive/MASTER_PLAN_JAN_2026.md](./archive/MASTER_PLAN_JAN_2026.md)
- **Historical (2025) completed tasks**: [docs/archive/Done-Tasks-Master-Plan.md](./archive/Done-Tasks-Master-Plan.md)

---

## Current Status

| **Canvas** | ✅ **WORKING** | **Calendar** | ✅ Verified |
| **Sync** | ✅ **WORKING** | **Build/Tests** | ✅ **PASSING** |

---

## Roadmap

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| ~~ROAD-001~~ | ✅ **DONE** | Power Groups | [Details](./archive/Done-Tasks-Master-Plan.md) |
| **ROAD-013** | **Sync Hardening** | **P0** | 🔄 [See Detailed Plan](#roadmaps) |
| ROAD-004 | Mobile support (PWA) | P2 | [See Detailed Plan](#roadmaps) |
| ROAD-011 | AI Assistant | P1 | [See Detailed Plan](#roadmaps) |
| ~~ROAD-022~~ | ✅ **DONE** | Auth (Supabase)| [Details](./archive/MASTER_PLAN_JAN_2026.md) |

---

## Active Work (Summary)

> [!NOTE]
> Detailed progress and tasks are tracked in the [Active Task Details](#active-task-details) section below.

---

<details>
<summary><b>Formatting Guide (For AI/Automation)</b></summary>

### Tasks
- `### TASK-XXX: Title (STATUS)`
- Use `(🔄 IN PROGRESS)`, `(✅ DONE)`, `(📋 PLANNED)`.
- Progress: Checked boxes `- [x]` calculate % automatically.

### Priority
- `P1-HIGH`, `P2-MEDIUM`, `P3-LOW` in header or `**Priority**: Level`.
</details>

<details id="roadmaps">
<summary><b>Detailed Feature Roadmaps</b></summary>

### ROAD-013: Sync Hardening (🔄 IN PROGRESS)
1. Audit current sync issues.
2. Fix conflict resolution UI.
3. Test multi-device scenarios E2E.

### ROAD-010: Gamification - "Cyberflow"
- **XP Sources**: Task completion, Pomodoro sessions, Streaks.
- **Features**: Leveling, Badges, Character Avatar in Sidebar.

### ROAD-011: AI Assistant
- **Features**: Task Breakdown, Auto-Categorization, NL Input ("Add meeting tomorrow 3pm").
- **Stack**: Local (Ollama) + Cloud (Claude/GPT-4).

### ROAD-004: Mobile PWA 
- **Phases**: PWA Manifest → Responsive Layout → Bottom Nav → Mobile Today View.
</details>

<details id="active-task-details">
<summary><b>Active Task Details</b></summary>

### TASK-099: Auth Store & Database Integration (📋 PLANNED)
- Integration with Supabase.
- Refactor `useAuthStore.ts` and `useDatabase.ts`.

### TASK-017: KDE Plasma Widget (Plasmoid) (READY)
- Create a KDE Plasma 6 taskbar widget.

### TASK-039: Duplicate Systems Consolidation (📋 PLANNED)
- Consolidate conflict resolution and backup systems.

### TASK-041: Implement Custom Recurrence Patterns (📋 PLANNED)
- Define custom recurrence syntax and parsing logic.

### TASK-046: Establish Canvas Performance Baselines (📋 PLANNED)
- Establishment of latency metrics using `performanceBenchmark.ts`.

### TASK-065: GitHub Release (📋 TODO)
- Remove hardcoded CouchDB credentials.
- Add Docker self-host guide to README.
- Create MIT LICENSE.

### TASK-079: Tauri Desktop (📋 PLANNED)
- System Tray (icon + menu).
- KDE Taskbar Progress (D-Bus).
- Fokus-style Break Splash Screen.

### TASK-095: Complete TypeScript & Lint Cleaning (📋 TODO)
- Address remaining TS/Lint errors system-wide.

### TASK-096: System Refactor Analysis (📋 TODO)
- Analyze codebase for refactoring opportunities.
</details>

<details>
<summary><b>Rollback & Reference</b></summary>

**Stable Baseline**: `93d5105` (Dec 5, 2025)
**Tag**: `v2.2.0-pre-mytasks-removal`

---

**Principle**: Document reality, not aspirations. Build trust through accuracy.
</details>
