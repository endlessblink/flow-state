# FlowState System Architecture

> **Last verified**: April 5, 2026 | **Version**: 1.3.38
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

## Views (19 total + AIChatView sub-view)

### Desktop Views (13)
| Route | View | Purpose |
|-------|------|---------|
| `/` | CanvasView | Free-form spatial task organization (Vue Flow) |
| `/board` | BoardView | Kanban board with status columns |
| `/calendar` | CalendarView | Time-based task scheduling + drag-create |
| `/calendar-test` | CalendarViewVueCal | Experimental vue-cal calendar |
| `/tasks`, `/catalog` | AllTasksView | Flat task list / catalog view |
| `/quick-sort` | QuickSortView | Triage uncategorized tasks one-by-one |
| `/ai` | AIHubView | AI chat entry point (renders AIChatView as sub-view) |
| `/focus/:taskId` | FocusView | Single-task focus mode with timer |
| — (overlay) | MorningDashboardView | Morning ritual overlay launched from App.vue via useMorningRitual() |
| `/today-flow` | TodayFlowView | Today's tasks flow view |
| `/performance` | PerformanceView | Gamification stats (admin only) |
| `/invite/:token` | InviteAcceptView | Workspace invite acceptance |
| `/design-system` | — | Redirects to Storybook |

### Mobile Views (6)
| Route | View | Purpose |
|-------|------|---------|
| `/timer` | MobileTimerView | Mobile Pomodoro timer |
| `/today` | MobileTodayView | Mobile today tasks |
| `/mobile-quick-sort` | MobileQuickSortView | Swipeable quick sort |
| `/mobile-ai-chat` | MobileAIChatView | Mobile AI chat |
| `/mobile-calendar` | MobileCalendarView | Mobile calendar |
| `/mobile-inbox` | MobileInboxView | Mobile unified inbox |

---

## Stores (14 top-level + sub-modules)

| Store | File | Purpose |
|-------|------|---------|
| `tasks` | `stores/tasks.ts` | Facade — delegates to `tasks/` sub-modules |
| `canvas` | `stores/canvas.ts` | Canvas state, delegates to `canvas/` sub-modules |
| `canvasImages` | `stores/canvasImages.ts` | Canvas image nodes — localStorage + Supabase Storage |
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

## Composables (~160 files, 18 directories)

| Directory | Count | Purpose |
|-----------|-------|---------|
| `canvas/` | ~31 | Vue Flow lifecycle, sync, groups, hotkeys, resize, selection, alignment, connections, filtering, smart groups |
| `canvas/node/` | 2 | Task node actions + state |
| `tasks/` | 6 | Edit state/actions, filtering, context menu, migrations, filter defaults |
| `tasks/card/` | 2 | Task card state/actions |
| `tasks/row/` | 1 | Task row state |
| `calendar/` | 10 | Scroll, navigation, modals, interaction, timer integration, month/day/week views, Google Calendar, external calendar |
| `supabase/` | 16 | DB composables for tasks, projects, groups, settings, timer, notifications, quick sort, pinned tasks, work profiles, tombstones, realtime subscriptions, infrastructure, task audit log, task comments, workspace activity |
| `sync/` | 3 | Broadcast channel, timer leader election, sync orchestrator |
| `backup/` | 8 | Core, export, restore, history, golden snapshot, types |
| `inbox/` | 3 | Calendar inbox, unified inbox state/actions |
| `board/` | 4 | Board context menu, board modals, board actions, board state |
| `timer/` | 4 | Audio, notifications, timer sync, index |
| `mobile/` | 1 | Mobile filters |
| `app/` | 5 | App initialization, onboarding wizard, sidebar management, app shortcuts, quick task input |
| `ui/` | 3 | Done toggle, drag handle state/interaction |
| `workspace/` | 3 | useTaskAssignment, useWorkspaceEmptyState, useWorkspacePresence |
| Root | ~72 | All other composables (AI, voice, platform, Tauri, Capacitor, taskbar nanny, morning dashboard, etc.) |

---

## Services (8 directories, ~60 files)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `ai/` | ~30 | LLM providers (Groq, Ollama, OpenRouter), ReAct pipeline, 20+ AI tools, usage tracking, chat persistence |
| `ai/providers/` | 6 | Provider implementations |
| `ai/pipeline/` | 15 | Intent routing, language detection, response validation, entity memory |
| `ai/proxy/` | 1 | AI chat proxy (`aiChatProxy.ts`) |
| `auth/` | 1 | Supabase auth service |
| `canvas/` | 3 | PositionManager, LockManager, types |
| `calendar/` | 1 | Google Calendar integration |
| `drive/` | 1 | Google Drive integration |
| `offline/` | 5 | IndexedDB write queue (Dexie), read cache, operation coalescing, retry strategy |
| `trash/` | 1 | Soft-delete trash management |
| `notifications/` | 1 | Capacitor push notifications |

---

## Components (~280+ files, 35+ directories)

| Directory | Count | Key Components |
|-----------|-------|----------------|
| `base/` | 13 | BaseButton, BaseInput, BaseBadge, BaseCard, BaseModal, BasePopover, BaseIconButton, BaseDropdown, BaseNavItem, FilterControls, OverflowTooltip, ProjectEmojiIcon, AppLogo |
| `common/` | 15 | CustomSelect, ConfirmationModal, MarkdownEditor, MarkdownRenderer, EmojiPicker, MultiSelectToggle, RecurrenceDeleteModal, TimeDisplay, TauriUpdateNotification, ErrorBoundary |
| `canvas/` | ~22 | GroupNodeSimple, CanvasToolbar, CanvasContextMenu, GroupEditModal, ResizeHandle, CanvasModals |
| `canvas/node/` | 6 | TaskNodeHeader, TaskNodeDescription, TaskNodePriority, TaskNodeMeta, TaskNodeSelection, OverdueBadge |
| `tasks/` | ~14 | DoneToggle, DragHandle, TaskContextMenu |
| `tasks/edit/` | 6 | TaskEditHeader, TaskEditSubtasks, TaskEditMetadata, TaskEditChildTasks, RecurrenceSelector, TaskComments |
| `tasks/context-menu/` | 8 | CanvasGroupSubmenu, DoneForNowSubmenu, DueDateSubmenu, DurationSubmenu, MoreSubmenu, PrioritySubmenu, ProjectSubmenu, StatusSubmenu (+ constants.ts) |
| `tasks/row/` | 6 | Task row sub-components |
| `kanban/` | 3+sub | KanbanSwimlane, TaskCard, KanbanColumn (+ `card/` sub-directory) |
| `inbox/` | 15 | CalendarInboxPanel, UnifiedInboxPanel (top-level) + `calendar/` (4: CalendarInboxHeader, CalendarInboxInput, CalendarInboxList, CalendarTaskCard) + `unified/` (9: UnifiedInboxHeader, UnifiedInboxInput, UnifiedInboxList, UnifiedInboxTaskCard, PinnedTasksSection, InboxToolbar, InboxFilterPopover, InboxSortDropdown, ActiveFilterPills) |
| `morning-dashboard/` | 14 | MorningRitualPanel, BigThreeCard, MorningCandidateCard, MorningTimeBlockCalendar, TaskPoolCard, MorningQuickCapture |
| `sidebar/` | 7 | SidebarHeader, SidebarProjectsSection, SidebarQuickTaskInput, SidebarWorkspaceSwitcher, SidebarSmartViews, SidebarUserFooter, SidebarDurationSection |
| `settings/` | ~14 | SettingsModal + tabs (Timer, Appearance, Integrations, Storage, etc.) |
| `ai/` | 7 | AIChatPanel, ChatMessage, AISetupWizard, AITaskAssistPopover, AIQualityDashboard, AIMemoryHealthDashboard, TaskQuickEditPopover |
| `auth/` | 6 | AuthModal, GoogleSignInButton, LoginForm, SignupForm, UserProfile, ResetPasswordView |
| `sync/` | 2 | SyncStatusIndicator, SyncErrorPopover |
| `projects/` | 4 | ProjectModal, ProjectDropZone, ProjectTreeItem, ProjectFilterDropdown |
| `notifications/` | 3 | NannyReminder, ReminderPicker, NotificationPreferences |
| `layout/` | 7 | SettingsModal, CommandPalette, SearchModal, KeyboardShortcutsPanel, ViewControls, CategorySelector, SidebarSmartItem |
| `ui/` | 4 | LocalModeBanner, WelcomeModal, BraveBanner, AuthStatusNotice |
| `onboarding/` | 1 | OnboardingWizard |
| `today-flow/` | 1 | FlowTaskCard |
| `error/` | 1 | RouteErrorBoundary |
| `workspace/` | 3 | AssigneeAvatar, SidebarActivityFeed, WorkspaceEmptyState |
| `mini-canvas/` | 6 | MiniCanvasOverlay, MiniCanvasToolbar, MiniCanvasEmptyState, ParentTaskNode, SubtaskNode, NoteNode |
| `mobile/` | 14 | MobileQuickSortCard, SwipeableTaskItem, TaskCreateBottomSheet, MobileNav, VoiceTaskConfirmation |

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
- **Image nodes**: upload images to canvas via `canvasImages` store + `canvasImageUpload` service + `ImageNode.vue` component (backed by localStorage + Supabase Storage)

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
- **Supabase persistence**: AI conversations synced cross-device via `ai_conversations` table
- **Proxy**: `aiChatProxy.ts` service layer for provider abstraction

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
- 10 active plugins: dialog, fs, shell, process, updater, store, http, log, OAuth, single-instance (notification plugin disabled — BUG-1289: `block_on()` panic on Linux)
- CSP-secured with IPC bridge

**Rust IPC Commands** (12 total, registered in `src-tauri/src/lib.rs`):
| Command | Purpose |
|---------|---------|
| `get_memory_usage` | Debug: reads `/proc/self/status` for RSS/VSize (SIGTERM debugging) |
| `check_docker_installed` | Check if Docker is available |
| `check_docker_status` | Check Docker daemon status |
| `start_docker_desktop` | Start Docker Desktop |
| `check_supabase_installed` | Check Supabase CLI availability |
| `check_supabase_status` | Check Supabase running state |
| `start_supabase` | Start local Supabase |
| `stop_supabase` | Stop local Supabase |
| `get_supabase_config` | Read Supabase config (URL, keys) |
| `run_supabase_migrations` | Apply pending DB migrations |
| `cleanup_services` | Graceful shutdown of all services |
| `get_local_backup_policy` / `set_local_backup_policy` | Read/write `.env.local` backup settings |

**Platform Detection** (`src/utils/platform.ts`):
- Single-source-of-truth: detects `tauri` / `capacitor` / `pwa` / `browser`
- Exports: `isTauri()`, `isCapacitor()`, `isPWA()`, `isBrowser()`, `isNative()`, `isMobileNative()`, `isDesktopNative()`
- `shouldTrustNavigatorOnline()` — always `false` for Tauri (WebKitGTK `navigator.onLine` is unreliable)
- `_resetPlatformCache()` for test teardown

**Notification Routing** (`src/utils/notificationDelivery.ts`):
- Unified `deliverNotification({ title, body, tag })` routes to platform-appropriate channel:
  - Tauri + Linux → `notify-send` via `@tauri-apps/plugin-shell` (KDE Plasma integration)
  - Capacitor → Local Notifications plugin
  - Browser → Notification API fallback
- Avoids `Notification.requestPermission()` inside Tauri (BUG-1303: WebKitGTK hangs)

### 16. Taskbar Nanny (Productivity Nudge)
- Tracks idle time when no Pomodoro is running; nudges user after 5 minutes
- System notification delivery via `deliverNotification()` (platform-aware routing)
- Snooze (30m / 1hr) and "Stop Today" actions
- In-app toast UI: `NannyReminder.vue` (emits `snooze`, `stopToday`, `dismiss`)
- **Debug hook**: `window.__NANNY_THRESHOLD_MINUTES` — set to small value (e.g., `10/60`) for 10-second threshold in tests
- **Key files**: `src/composables/useTaskbarNanny.ts`, `src/components/notifications/NannyReminder.vue`
- **E2E test**: `tests/e2e/taskbar-nanny.spec.ts` (auto-injects accelerated threshold)

### 17. Workspace Collaboration (NEW — March 2026)
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

## Database Schema (32 tables, 34 migrations)

### Core Tables (8)
`tasks`, `groups`, `projects`, `timer_sessions`, `pomodoro_history`, `notifications`, `user_settings`, `quick_sort_sessions`

### Data Integrity (3)
`tombstones` (sync deletion tracking), `task_dedup_audit`, `task_audit_log`

### Gamification (7)
`user_gamification`, `xp_logs`, `achievements`, `user_achievements`, `shop_items`, `user_purchases`, `user_stats`

### Challenges (3)
`user_challenges`, `challenge_history`, `arena_runs` (Daily Cyberpunk Arena)

### Workspace/Collaboration (5)
`workspaces`, `workspace_members`, `workspace_invites`, `task_comments`, `workspace_activity`

### AI (3)
`ai_conversations` (cross-device AI chat sync), `ai_work_profiles`, `ai_usage_log`

### Other
`pinned_tasks`, `push_subscriptions`, `whatsapp_conversations`

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
9. **Tauri notification plugin DISABLED** — BUG-1289: `block_on()` panic on Linux. Use `notify-send` via shell plugin instead. Do not re-enable without resolving the panic.
10. **vue-i18n version coupling** — Plugin v11.x must match runtime v11.x. Version mismatch causes `SyntaxError: Unexpected return type in composer`.

---

## Internationalization (i18n)

- **Runtime**: vue-i18n 11.2.8 (Composition API, `legacy: false`)
- **Plugin**: @intlify/unplugin-vue-i18n 11.0.7 (MUST match runtime generation — plugin v11.x ↔ vue-i18n v11.x)
- **Locales**: `src/i18n/locales/en.json` (English), `src/i18n/locales/he.json` (Hebrew)
- **RTL support**: Hebrew locale renders right-to-left; design tokens and CSS handle bidirectional text
- **Usage**: `$t()` calls in components, `useI18n()` composable in setup functions

---

## Utilities (Key Files)

| File | Purpose |
|------|---------|
| `src/utils/platform.ts` | Platform detection (Tauri/Capacitor/PWA/browser) — see Desktop section |
| `src/utils/notificationDelivery.ts` | Unified notification routing — see Desktop section |
| `src/utils/supabaseMappers.ts` | Type mappers between DB rows and app models (critical for persistence) |
| `src/utils/consoleFilter.ts` | Console noise suppression for known warnings |
| `src/utils/canvas/` | Canvas utilities (7 files): positionCalculator, coordinates, invariants, canvasIds, resourceManager, spatialContainment, storeHelpers |
| `src/utils/security.ts` + `securityHeaders.ts` + `securityHeaderManager.ts` + `securityMonitor.ts` + `cspManager.ts` | Security layer (5 files): CSP management, header enforcement, security monitoring |
| `src/utils/recurrenceUtils.ts` | Recurrence rule parsing and generation |
| `src/utils/dateUtils.ts` | Date formatting and calculation utilities |
| `src/utils/errorHandler.ts` | Global error handling |
| `src/utils/guestModeStorage.ts` | localStorage persistence for guest (unauthenticated) mode |
| `src/utils/globalKeyboardHandlerSimple.ts` | Global keyboard shortcut handler |
| `src/utils/tauriLogger.ts` | Tauri-specific logging |
| `src/utils/openExternal.ts` | Platform-aware external URL opening |
