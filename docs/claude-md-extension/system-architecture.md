# FlowState System Architecture

> **Last verified**: March 16, 2026 | **Version**: 1.3.15
> **Read this before any major feature work, refactoring, or architectural decisions.**

---

## App Identity

**FlowState** is a personal productivity app combining task management across Canvas, Board, Calendar, and Focus views with an integrated Pomodoro timer, AI chat assistant, morning ritual dashboard, and gamification system. Deployed as both a PWA (VPS) and a Tauri desktop app (Linux/Windows/macOS).

---

## Tech Stack (Verified Versions)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Vue 3 (Composition API) | 3.5.26 |
| **Build** | Vite | 7.3.1 |
| **Types** | TypeScript | 5.9.3 |
| **State** | Pinia | 2.1.7 |
| **Routing** | Vue Router (hash mode) | 4.6.4 |
| **Styling** | Tailwind CSS + Design Tokens | 3.4.0 |
| **UI Library** | Naive UI | 2.43.1 |
| **Canvas** | Vue Flow | 1.47.0 |
| **Rich Text** | TipTap | 3.15.3 |
| **Icons** | Lucide Vue Next | 0.562.0 |
| **Utilities** | VueUse | 14.2.1 |
| **Drag & Drop** | vuedraggable | 4.1.0 |
| **Database** | Supabase (self-hosted) | 2.89.0 |
| **Offline DB** | Dexie (IndexedDB) | 4.2.1 |
| **i18n** | vue-i18n | 11.2.8 |
| **Fuzzy Search** | uFuzzy | 1.0.19 |
| **Desktop** | Tauri | 2.10 |
| **Mobile** | Capacitor | 8.x |
| **3D Effects** | Three.js + TresJS | 0.182.0 / 5.4.1 |
| **Testing** | Vitest + Playwright + Storybook | 3.2.4 / 1.57.0 / 10.1.4 |

---

## Views (18 total)

### Desktop Views (13)
| Route | View | Purpose |
|-------|------|---------|
| `/` | CanvasView | Free-form spatial task organization (Vue Flow) |
| `/board` | BoardView | Kanban board with status columns |
| `/calendar` | CalendarView | Time-based task scheduling + drag-create |
| `/calendar-test` | CalendarViewVueCal | Experimental vue-cal calendar |
| `/tasks`, `/catalog` | AllTasksView | Flat task list / catalog view |
| `/quick-sort` | QuickSortView | Triage uncategorized tasks one-by-one |
| `/ai` | AIHubView | AI chat entry point |
| `/focus/:taskId` | FocusView | Single-task focus mode with timer |
| `/morning` | MorningDashboardView | Morning ritual: pick Big 3, time-block |
| `/today-flow` | TodayFlowView | Today's tasks flow view |
| `/performance` | PerformanceView | Gamification stats (admin only) |
| `/invite/:token` | InviteAcceptView | Workspace invite acceptance |
| `/design-system` | — | Redirects to Storybook |

### Mobile Views (5)
| Route | View | Purpose |
|-------|------|---------|
| `/timer` | MobileTimerView | Mobile Pomodoro timer |
| `/today` | MobileTodayView | Mobile today tasks |
| `/mobile-quick-sort` | MobileQuickSortView | Swipeable quick sort |
| `/mobile-ai-chat` | MobileAIChatView | Mobile AI chat |
| `/mobile-calendar` | MobileCalendarView | Mobile calendar |

---

## Stores (13 top-level + sub-modules)

| Store | File | Purpose |
|-------|------|---------|
| `tasks` | `stores/tasks.ts` | Facade — delegates to `tasks/` sub-modules |
| `canvas` | `stores/canvas.ts` | Canvas state, delegates to `canvas/` sub-modules |
| `timer` | `stores/timer.ts` | Pomodoro timer + cross-device leadership |
| `auth` | `stores/auth.ts` | Supabase auth session |
| `settings` | `stores/settings.ts` | User preferences |
| `ui` | `stores/ui.ts` | Global UI state (sidebar, modals) |
| `projects` | `stores/projects.ts` | Project CRUD |
| `aiChat` | `stores/aiChat.ts` | AI conversations + streaming |
| `quickSort` | `stores/quickSort.ts` | Quick sort session state |
| `notifications` | `stores/notifications.ts` | In-app notifications |
| `syncStatus` | `stores/syncStatus.ts` | Sync status indicator |
| `workspace` | `stores/workspace.ts` | Workspace (personal vs shared) |
| `canvasTaskBridge` | `stores/canvasTaskBridge.ts` | Canvas↔task data bridge |

### Sub-modules
**`stores/tasks/`** (4 files): `taskOperations.ts` (CRUD, subtasks, recurrence), `taskPersistence.ts` (Supabase load/save, smart merge, offline cache), `taskHistory.ts` (undo/redo), `taskStates.ts` (filtering, smart views, computed state)

**`stores/canvas/`** (7 files): `canvasPersistence.ts`, `canvasGroups.ts`, `canvasUi.ts`, `canvasViewport.ts`, `contextMenus.ts`, `modals.ts`, `types.ts`

---

## Composables (~145 files, 17 directories)

| Directory | Count | Purpose |
|-----------|-------|---------|
| `canvas/` | ~31 | Vue Flow lifecycle, sync, groups, hotkeys, resize, selection, alignment, connections, filtering, smart groups |
| `canvas/node/` | 2 | Task node actions + state |
| `tasks/` | 6 | Edit state/actions, filtering, context menu, migrations, filter defaults |
| `tasks/card/` | 2 | Task card state/actions |
| `tasks/row/` | 1 | Task row state |
| `calendar/` | 5 | Scroll, navigation, modals, interaction, timer integration |
| `supabase/` | 5 | Notifications DB, quick sort DB, pinned tasks, work profiles, tombstones |
| `sync/` | 3 | Broadcast channel, timer leader election, sync orchestrator |
| `backup/` | 8 | Core, export, restore, history, golden snapshot, types |
| `inbox/` | 3 | Calendar inbox, unified inbox state/actions |
| `board/` | 2 | Board context menu, board modals |
| `timer/` | 3 | Audio, notifications, index |
| `mobile/` | 1 | Mobile filters |
| `app/` | 2 | Onboarding wizard, sidebar management |
| `ui/` | 3 | Done toggle, drag handle state/interaction |
| Root | ~75 | All other composables (AI, voice, platform, Tauri, Capacitor, etc.) |

---

## Services (6 directories, ~57 files)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `ai/` | ~30 | LLM providers (Groq, Ollama, OpenRouter), ReAct pipeline, 20+ AI tools, usage tracking, chat persistence |
| `ai/providers/` | 6 | Provider implementations |
| `ai/pipeline/` | 15 | Intent routing, language detection, response validation, entity memory |
| `auth/` | 1 | Supabase auth service |
| `canvas/` | 3 | PositionManager, LockManager |
| `calendar/` | 1 | Google Calendar integration |
| `drive/` | 1 | Google Drive integration |
| `offline/` | 5 | IndexedDB write queue (Dexie), read cache, operation coalescing, retry strategy |
| `trash/` | 1 | Soft-delete trash management |
| `notifications/` | 1 | Capacitor push notifications |

---

## Components (~250+ files, 30+ directories)

| Directory | Count | Key Components |
|-----------|-------|----------------|
| `base/` | 12 | BaseButton, BaseInput, BaseBadge, BaseCard, BaseModal, BasePopover, BaseIconButton, BaseDropdown, BaseNavItem, FilterControls, OverflowTooltip, ProjectEmojiIcon |
| `common/` | 15 | CustomSelect, ConfirmationModal, MarkdownEditor, MarkdownRenderer, EmojiPicker, MultiSelectToggle, RecurrenceDeleteModal, TimeDisplay, TauriUpdateNotification, ErrorBoundary |
| `canvas/` | ~20 | GroupNodeSimple, CanvasToolbar, CanvasContextMenu, GroupEditModal, ResizeHandle, CanvasModals |
| `canvas/node/` | 6 | TaskNodeHeader, TaskNodeDescription, TaskNodePriority |
| `tasks/` | ~12 | DoneToggle, DragHandle, TaskContextMenu |
| `tasks/edit/` | 4 | TaskEditHeader, TaskEditSubtasks, TaskEditMetadata |
| `kanban/` | ~9 | KanbanColumn, KanbanCard + sub-components |
| `inbox/` | 11 | UnifiedInboxPanel, UnifiedInboxHeader, PinnedTasksSection |
| `morning-dashboard/` | 14 | MorningRitualPanel, BigThreeCard, MorningCandidateCard, MorningTimeBlockCalendar, TaskPoolCard |
| `sidebar/` | 6 | SidebarHeader, SidebarProjectsSection, SidebarQuickTaskInput |
| `settings/` | ~12 | SettingsModal + tabs (Timer, Appearance, Integrations, etc.) |
| `ai/` | 3 | AISetupWizard, AITaskAssistPopover |
| `auth/` | 3 | AuthModal, GoogleSignInButton |
| `sync/` | 2 | SyncStatusIndicator, SyncErrorPopover |
| `projects/` | 3 | ProjectModal, ProjectDropZone |
| `mobile/` | 21 | MobileQuickSortCard, SwipeableTaskItem, TaskCreateBottomSheet, MobileNav, VoiceTaskConfirmation |

---

## Feature Map

### 1. Task Management
- Full CRUD with optimistic UI + Supabase persistence
- **Subtasks**: create/update/delete with undo
- **Recurrence**: `recurrenceRule` on tasks, daily clone generation via `useRecurrenceScheduler`
- **Task instances**: Calendar scheduling with separate instance CRUD
- **Tags**: text array field
- **Attachments**: file attachments support
- **Reminders**: task reminder scheduling
- **Smart views**: inbox, today, this_week, etc. with computed counts
- **Filtering**: by status, priority, project, duration, smart view, full-text search
- **Undo/redo**: all operations wrapped with undo support
- **Soft delete**: `is_deleted` + `deleted_at` + tombstones for sync

### 2. Canvas (Vue Flow)
- Free-form spatial task organization with drag-and-drop
- **Groups**: create, edit, resize, membership, color-coded sections
- **Smart Groups**: auto-place tasks by due date using power keywords (today, tomorrow, this week, day names)
- **Day Group Rotation**: midnight auto-update of due dates in weekday groups
- **Connections**: drag to draw edges = subtask relationships
- **Alignment**: Figma-like align/distribute (left/right/top/bottom/center, row/column/grid)
- **Multi-select**: click, Ctrl/Shift, rectangle selection
- **Hotkeys**: Delete, Shift+G (create group), zoom controls
- **Geometry invariants**: single-writer principle, sync is read-only

### 3. Kanban Board
- Status-based columns (planned, in_progress, done, backlog, on_hold)
- Drag-and-drop between columns via vuedraggable
- Force-fallback mode for WebKitGTK compatibility

### 4. Calendar
- Day/week views with time-based scheduling
- Drag-to-create tasks on calendar
- Task instance management (separate from main task)
- Calendar inbox for unscheduled tasks
- Google Calendar integration (service layer)
- Recurrence-aware display with virtual future instances

### 5. Pomodoro Timer
- Work/break sessions with configurable durations
- **Cross-device sync**: leader election model (one device leads, others follow)
- **Tab sync**: BroadcastChannel for instant cross-tab updates
- **KDE Widget**: REST polling follower (2s interval)
- **Wake Lock**: prevents screen sleep during active timer
- **Audio notifications**: sound on session completion
- **Task highlighting**: amber glow + pulse on active timer task
- **Auto-start**: configurable auto-start for breaks/pomodoros

### 6. AI Chat Assistant
- Multi-provider: Groq (cloud), Ollama (local), OpenRouter
- **20+ tools**: task CRUD, timer control, search, summaries
- **ReAct loop**: multi-step reasoning for complex requests
- **Intent routing**: structured intent classification
- **Pipeline**: language detection, response validation, entity memory, fluff detection
- **Context awareness**: current view, selected task, visible tasks
- **Undo buffer**: session-only undo for AI actions
- **Multilingual**: auto-detect LTR/RTL (Hebrew/English)
- **Streaming**: progressive content display

### 7. Morning Dashboard
- **Big Three**: pick top 3 tasks for the day from task pool
- **Task pool**: grouped by overdue, today, in-progress, high-priority, other
- **Time-block calendar**: visual scheduling of selected tasks
- **Drag-and-drop**: pool → slots
- **Search + quick capture**: find tasks, create new ones inline
- **News feed**: Hacker News with 30-min cache

### 8. Quick Sort
- Triage uncategorized tasks (no project, no due date, no priority) one at a time
- Actions: categorize, mark done, delete, save changes
- **Undo/redo stack** per session
- **Streak tracking**: consecutive daily usage
- **Session stats**: efficiency (tasks/minute), total processed
- **Crash recovery**: auto-save active session to localStorage
- **Mobile**: swipeable cards with touch + mouse support

### 9. Unified Inbox
- Collapsible panel with drag-drop support
- **Filters**: time (all/today/3days/week/month), priorities, projects, durations
- **Sort**: newest, priority, dueDate, canvasOrder
- **Search**: full-text within inbox
- **Pinned tasks**: separate section at top
- **Context-aware**: canvas inbox vs calendar inbox (independent filter state)
- **Badge counts**: per time filter + done count

### 10. Gamification
- XP, levels, achievements, shop system
- 7 Supabase tables for gamification data
- Challenge system with daily/weekly challenges
- Arena/competition tables
- Performance view for stats

### 11. Backup & Recovery
- **4-layer system**: Local history → Golden backup → Shadow mirror → SQL dumps
- Unified orchestrator (`useBackupSystem`)
- Export/import capabilities
- Settings > Storage UI for recovery
- Auto-backup on interval

### 12. Offline & Sync
- **Primary**: VPS Supabase (source of truth)
- **Fallback**: IndexedDB write queue (Dexie) for offline/failure
- Operation coalescing: create+update→merged create, create+delete→cancel
- Exponential backoff retry with transient/permanent/conflict classification
- Online/offline detection with auto-pause/resume
- IndexedDB read cache for offline loading
- Guest mode: localStorage persistence

### 13. Mobile Features
- Responsive views for timer, today, calendar, AI chat, quick sort
- Swipeable task items and quick sort cards
- Bottom sheets for task create/edit
- Voice input (Whisper via Supabase Edge Function + Web Speech API fallback)
- Haptics, wake lock, status bar integration (Capacitor)

### 14. KDE Plasma Widget
- Pomodoro timer display (work=teal, break=amber)
- Task list with pinned section
- Nanny popup for task selection when idle
- Current calendar block display
- OAuth token management
- REST polling follower (2s interval)

### 15. Desktop (Tauri)
- Native window with 1200x800 default, 800x600 minimum
- Auto-updater via signed AppImage (endpoint: `in-theflow.com/updates/latest.json`)
- 9 plugins: dialog, fs, shell, process, notification, updater, store, http, OAuth
- 10 Rust commands for Docker/Supabase management
- CSP-secured with IPC bridge

### 16. Workspace Collaboration (NEW — March 2026)
- **Multi-workspace model**: personal workspace (default) + shared workspaces
- **Roles**: owner, admin, member, viewer (`WorkspaceRole` type)
- **Invite flow**: owner/admin generates invite link with email → recipient opens `/#/invite/<token>` → `InviteAcceptView` accepts via Supabase RPC `accept_workspace_invite()` → auto-switches to workspace
- **Workspace switching**: `SidebarWorkspaceSwitcher` dropdown in sidebar, inline workspace creation
- **Data isolation**: `workspace_id` column on tasks/projects/groups. Personal rows have `workspace_id = NULL`
- **RLS**: `user_workspace_ids()` SECURITY DEFINER function. Policies: `workspace_id = ANY(user_workspace_ids())` for shared, `workspace_id IS NULL AND auth.uid() = user_id` for personal
- **Sync integration**: `useSyncOrchestrator` captures `activeWorkspaceId` per operation, pauses during workspace switch (`isSwitchingWorkspace` flag)
- **Navigation guards**: personal-only routes (canvas, quick-sort, morning, today-flow, ai, focus, performance) redirect to `/board` in shared workspaces
- **Navigation visibility**: `useWorkspaceNavigation.ts` hides sidebar items for personal-only routes when in shared workspace

**Key files:**
```
src/types/workspace.ts                     # Workspace, WorkspaceMember, WorkspaceInvite types
src/stores/workspace.ts                    # Pinia store (load, switch, create, invite, accept)
src/views/InviteAcceptView.vue             # Invite acceptance page
src/components/sidebar/SidebarWorkspaceSwitcher.vue  # Workspace dropdown
src/composables/useWorkspaceNavigation.ts  # Route visibility logic
supabase/migrations/20260317000000_workspace_collaboration.sql  # Schema
```

**Status**: Code complete, migration NOT yet applied to DB.

---

## Data Flow Architecture

```
User Action
    ↓
Vue Component (thin — display + events only)
    ↓
Composable (business logic, validation)
    ↓
Pinia Store (state mutation + computed derivations)
    ↓
┌─────────────────────────┐
│ Direct Supabase Write   │ ← PRIMARY (VPS is source of truth)
│ (optimistic UI)         │
└─────────────────────────┘
    ↓ (parallel)
┌─────────────────────────┐
│ IndexedDB Write Queue   │ ← BACKUP (offline/failure fallback)
│ (Dexie)                 │
└─────────────────────────┘
    ↓ (on sync)
┌─────────────────────────┐
│ Supabase Realtime       │ → All connected devices
│ (WebSocket broadcast)   │
└─────────────────────────┘
```

### Auth-Aware Initialization
All stores wait for `authStore.isAuthenticated` before loading data from Supabase. This prevents race conditions with JWT tokens.

### Smart Merge on Load
`taskPersistence.ts` uses field-level merge (not whole-task LWW): remote is the base, local content fields overlay if newer. DB-authoritative fields: `isPinned`, `_soft_deleted`, `deletedAt`, `positionVersion`, `createdAt`, `recurrenceCount`, `recurrenceParentId`.

---

## Database Schema (19+ tables, 31 migrations)

### Core Tables (8)
`tasks`, `groups`, `projects`, `timer_sessions`, `pomodoro_history`, `notifications`, `user_settings`, `quick_sort_sessions`

### Data Integrity (2)
`tombstones` (sync deletion tracking), `task_dedup_audit`

### Gamification (7)
`user_gamification`, plus achievement/shop/challenge tables

### Challenges (2)
`user_challenges` + related

### Workspace/Collaboration (3 — NEW)
`workspaces`, `workspace_members`, `workspace_invites`

### Other
`pinned_tasks`, `ai_work_profiles`, `push_subscriptions`, `whatsapp_conversations`, `arena` tables

All tables have RLS (Row-Level Security) enabled. Workspace-aware tables (`tasks`, `projects`, `groups`) use dual RLS: personal rows (`workspace_id IS NULL AND user_id = auth.uid()`) + shared rows (`workspace_id = ANY(user_workspace_ids())`).

---

## Production Infrastructure

```
User (HTTPS) → Cloudflare (DNS/CDN) → Contabo VPS (Caddy) → Self-hosted Supabase
                                              ↓
                                      PWA Static Files (/var/www/flowstate)
```

- **VPS**: Contabo Cloud VPS 2 (6 vCPU, 16GB RAM, NVMe SSD, Ubuntu 22.04)
- **Domain**: in-theflow.com (PWA) + api.in-theflow.com (Supabase API)
- **SSL**: Cloudflare Origin Certificate (15-year validity)
- **Secrets**: Doppler (never .env files on VPS)
- **CI/CD**: GitHub Actions → build → rsync to VPS → Caddy reload
- **Desktop**: Tauri AppImage with signed auto-updater

---

## Key Architectural Constraints

1. **VPS Supabase is PRIMARY** — IndexedDB is backup only. Never remove direct saves.
2. **Canvas geometry invariants** — Only drag handlers write positions. Sync is read-only. Smart-groups update metadata only, never geometry.
3. **Auth-aware stores** — All stores wait for auth before loading. Timer store especially critical.
4. **`taskStore.tasks` is filtered** — Use `taskStore._rawTasks` when you need ALL non-done tasks.
5. **No solid-fill buttons** — Glass morphism pattern only. See design-system.md.
6. **WebKitGTK parity** — No `overflow: clip` without fallback, no `perspective` on fixed parents, always `:force-fallback="true"` on vuedraggable.
7. **Version bump before every deploy** — 3 files: package.json, tauri.conf.json, Cargo.toml.
8. **Workspace-aware operations** — Sync orchestrator captures `activeWorkspaceId` per operation. Personal routes are gated in shared workspaces. RLS enforces data isolation.
