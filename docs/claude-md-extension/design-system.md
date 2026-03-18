# Design System

> **Last verified**: March 16, 2026 | **Token file**: `src/assets/design-tokens.css` (~1,450 lines)
> **Read this before any UI work. NEVER hardcode CSS values — always use design tokens.**

---

## Required Token Usage (MANDATORY)

| Property | Never Use | Always Use |
|----------|-----------|------------|
| **Background colors** | `rgba(18, 18, 20, 0.98)` | `var(--overlay-component-bg)` |
| **Glass effects** | `rgba(255, 255, 255, 0.06)` | `var(--glass-bg-heavy)` |
| **Borders** | `rgba(255, 255, 255, 0.12)` | `var(--glass-border)` |
| **Backdrop blur** | `blur(20px)` | `var(--overlay-component-backdrop)` |
| **Border radius** | `12px`, `8px` | `var(--radius-lg)`, `var(--radius-md)` |
| **Spacing** | `8px`, `12px`, `16px` | `var(--space-2)`, `var(--space-3)`, `var(--space-4)` |
| **Font sizes** | `10px`, `13px` | `var(--text-xs)`, `var(--text-sm)` |
| **Transitions** | `0.15s ease-out` | `var(--duration-fast) var(--ease-out)` |
| **Shadows** | `0 12px 40px rgba(...)` | `var(--overlay-component-shadow)` |

---

## Token Reference (3-Tier System)

### Tier 1 — Base Palette

**Slate scale**: `--slate-950` through `--slate-50` (HSL values)
**Brand teal**: `--teal-500: 174, 62%, 58%` → `#4ECDC4`
**Core colors**: `--red-500`, `--green-500`, `--blue-500`
**Primary scale**: `--color-primary-50` through `--color-primary-900`

### Tier 2 — Semantic Tokens

**Surfaces:**
```css
--surface-primary          /* Main background */
--surface-secondary        /* Cards, panels */
--surface-tertiary         /* Nested elements */
--surface-elevated         /* Raised elements */
--surface-hover            /* Hover state */
--surface-active           /* Active/pressed state */
```

**Glass Morphism (purple-tinted, lightest → heaviest):**
```css
--glass-bg-subtle   (0.02)    --glass-bg-weak    (0.03)
--glass-bg-light    (0.04)    --glass-bg-tint     (0.05)
--glass-bg-medium   (0.06)    --glass-bg-soft     (0.10)
--glass-bg-heavy    (0.25)    --glass-bg-solid    (0.95, Tauri)
--glass-panel-bg    (0.60, semi-transparent panels)
```

**Glass Borders:**
```css
--glass-border          (0.10)    --glass-border-hover   (0.15)
--glass-border-faint    (0.03)    --glass-border-light   (0.06)
--glass-border-medium   (0.16)    --glass-border-strong  (0.28)
--glass-border-soft     (0.12)
```

**Text Hierarchy:**
```css
--text-primary   (100%)    --text-secondary  (80%)
--text-tertiary  (60%)     --text-muted      (45%)
--text-subtle    (35%)     --text-disabled   (25%)
```

**Brand:**
```css
--brand-primary           /* #4ECDC4 (teal) — THE action color */
--brand-hover             /* #3db8af */
--brand-active            /* #2da39a */
--brand-primary-subtle    /* Soft teal bg */
--brand-primary-dim       /* Dimmed teal border */
--brand-glow-sm           /* Teal glow for hover effects */
--brand-focus-ring        /* Focus ring */
```

**Interactive States:**
```css
--state-active-border/bg/glass/text
--state-hover-border/bg/shadow/glow
--state-selected-bg/border/shadow/glow
```

### Tier 3 — Functional/Component Tokens

**Status Colors (task cards):**
```css
--status-planned-bg/border/text       /* Blue */
--status-in-progress-bg/border/text   /* Amber */
--status-done-bg/border/text          /* Green */
--status-backlog-bg/border/text       /* Gray */
--status-on-hold-bg/border/text       /* Orange */
```

**Priority Colors:**
```css
--color-priority-high    (#ef4444)    --priority-high-bg/border/text/glow
--color-priority-medium  (#f59e0b)    --priority-medium-bg/border/text/glow
--color-priority-low     (#3b82f6)    --priority-low-bg/border/text/glow
```

**Semantic Status:**
```css
--color-success (#10b981)    --color-warning (#f59e0b)
--color-danger  (#ef4444)    --color-info    (#3b82f6)
```

**Overlay Components (modals, dropdowns, context menus):**
```css
--overlay-component-bg        /* rgba(28,25,45,0.92) */
--overlay-component-backdrop  /* blur(20px) */
--overlay-component-border    /* 1px solid rgba(255,255,255,0.15) */
--overlay-component-shadow    /* Layered dark shadow */
--dropdown-bg                 /* Dropdown background */
--dropdown-item-hover-bg      /* Item hover state */
```

**Timer:**
```css
--timer-active-border/glow/glow-strong
--timer-work-stroke/glow       /* Teal for work */
--timer-break-stroke/glow      /* Amber for break */
```

---

## Spacing (8px Grid)

```css
--space-0 (0)       --space-px (1px)    --space-0_5 (2px)
--space-1 (4px)     --space-1_5 (6px)   --space-2 (8px)
--space-2_5 (10px)  --space-3 (12px)    --space-3_5 (14px)
--space-4 (16px)    --space-5 (20px)    --space-6 (24px)
--space-7 (28px)    --space-8 (32px)    --space-9 (36px)
--space-10 (40px)   --space-12 (48px)   --space-14 (56px)
--space-16 (64px)   --space-20 (80px)   --space-24 (96px)
--space-32 (128px)
```

Semantic aliases: `--gap-xs/sm/md/lg`, `--padding-xs/sm/md/lg/xl/2xl`, `--margin-xs/sm/md/lg`

---

## Typography

```css
--text-2xs (10px)   --text-xs (12px)    --text-meta (13px)
--text-sm (14px)    --text-base (16px)  --text-lg (18px)
--text-xl (20px)    --text-2xl (24px)   --text-3xl (30px)   --text-4xl (36px)

--font-light (300)  --font-normal (400) --font-medium (500)
--font-semibold (600) --font-bold (700)

--leading-none (1)  --leading-tight (1.25) --leading-snug (1.375)
--leading-normal (1.5) --leading-relaxed (1.625) --leading-loose (2)
```

---

## Border Radius

```css
--radius-none (0)    --radius-xs (2px)   --radius-sm (6px)
--radius-md (8px)    --radius-lg (16px)  --radius-xl (20px)
--radius-2xl (24px)  --radius-3xl (32px) --radius-full (9999px)
```

---

## Animation

```css
--duration-instant (50-100ms)  --duration-fast (150ms)
--duration-normal (200ms)      --duration-slow (300ms)
--duration-slower (500ms)

--ease-linear  --ease-in  --ease-out  --ease-in-out
--spring-smooth  --spring-bouncy  --spring-swift  --spring-gentle
```

---

## Z-Index Scale

```css
--z-base (0)           --z-dropdown (1000)     --z-sticky (1100)
--z-overlay (1200)     --z-modal (1300)        --z-popover (1400)
--z-toast (1450)       --z-tooltip (1500)      --z-context-menu (9999)
--z-submenu (10001+)
```

---

## Shadows

```css
--shadow-xs/sm/md/lg/xl/2xl          /* Standard elevation */
--shadow-dark-sm/md/lg/xl            /* Dark theme variants */
--shadow-subtle/medium/strong        /* Semantic */
--shadow-glass/glow                  /* Glass morphism */
--shadow-card/card-hover/modal/dropdown  /* Component-specific */
--shadow-primary/success/warning/danger  /* Status shadows */
```

---

## Button Pattern (CRITICAL)

**ALL buttons MUST use glass morphism. NEVER solid fill.**

```css
/* ✅ CORRECT */
background: var(--glass-bg-soft);
color: var(--brand-primary);
border: 1px solid var(--brand-primary);
backdrop-filter: blur(8px);

/* ❌ WRONG */
background: var(--brand-primary);
color: white;
border: none;
```

**Tailwind classes**: `.btn-primary` (glass+teal), `.btn-secondary` (surface+border), `.btn-ghost` (transparent)

**Solid `var(--brand-primary)` bg is ONLY acceptable for**: checkbox fills, toggle dots, progress bars, status badges — NOT buttons.

---

## Base Components (`src/components/base/`)

### BaseButton
**Props**: `variant` (primary|secondary|ghost|danger|active), `size` (sm|md|lg), `iconOnly`, `disabled`, `loading`, `pressed`
**Emits**: click, keydown, focus, blur
**Note**: All variants are outline/glass. Default variant is `secondary`.

### BaseIconButton
**Props**: `variant` (default|primary|success|warning|danger), `size` (sm|md|lg), `active`, `disabled`
**Note**: Always square. `is-active` adds teal stroke.

### BaseModal
**Props**: `isOpen`, `title`, `size` (sm|md|lg|xl|full), `variant` (default|danger|warning|success), `closeOnOverlayClick`, `closeOnEscape`, `trapFocus`, `loading`, `confirmDisabled`
**Slots**: default (body), title, description, footer
**Note**: Teleports to body. Has focus trap + scroll lock.

### BaseBadge
**Props**: `variant` (default|success|warning|danger|info|count), `size` (sm|md|lg), `rounded`

### BaseCard
**Props**: `variant` (default|outlined|filled), `hoverable`, `glass`, `elevated`
**Slots**: header, default, footer

### BaseInput
**Props**: `modelValue`, `type`, `label`, `placeholder`, `helperText`, `disabled`, `required`
**Slots**: prefix, suffix
**Note**: Auto-detects Hebrew text for RTL alignment.

### BasePopover
**Props**: `isVisible`, `x`, `y`, `position` (auto|top|bottom|left|right), `variant` (menu|tooltip|dropdown)
**Note**: Teleport-based, auto viewport positioning.

### BaseDropdown
**Props**: `modelValue`, `options`, `placeholder`, `searchable`, `multiple`
**Slots**: trigger, option

### OverflowTooltip
**Props**: `text`, `tooltipPosition`, `lineClamp`
**Note**: Only shows tooltip when text actually overflows.

### ProjectEmojiIcon
**Props**: `emoji`, `size` (xs|sm|md|lg|xl), `color`, `variant` (default|plain)

### BaseNavItem
**Props**: `active`, `selected`, `nested`, `colorDot`, `emoji`, `count`, `projectId`
**Note**: Supports drag-and-drop for tasks and project nesting.

### FilterControls
Reads from task store directly. Renders project/status filter dropdowns.

---

## Common Components (`src/components/common/`)

### CustomSelect — THE ONLY dropdown component
**Import**: `import CustomSelect from '@/components/common/CustomSelect.vue'`
**Props**: `modelValue: string|number|null`, `options: {label, value}[]`, `placeholder?`, `compact?`
**Note**: Teleport-based, position-aware. NEVER use native `<select>` or `<NSelect>`.

### ConfirmationModal
**Props**: `isOpen`, `title?`, `message?`, `details?: string[]`, `confirmText?`
**Note**: Wraps BaseModal with `variant="danger"`.

### Other Common Components
- `MarkdownEditor` — TipTap rich text editor
- `MarkdownRenderer` — Safe markdown display
- `MultiSelectToggle` — Multi-select UI
- `EmojiPicker` — Emoji picker panel
- `RecurrenceDeleteModal` — Recurrence-aware delete
- `TauriUpdateNotification` — Auto-updater toast
- `ErrorBoundary` — Vue error boundary
- `TimeDisplay` — Time utility
- `ReloadPrompt` — PWA reload prompt

---

## Tailwind Component Classes

| Class | Description |
|-------|-------------|
| `.btn` | Base button layout/typography |
| `.btn-primary` | Glass bg + teal border + teal text + backdrop-filter |
| `.btn-secondary` | Surface bg + border |
| `.btn-ghost` | Transparent bg, text only |
| `.task-base` | Task card with hover/select/drag states |
| `.timer-widget` | Timer container with active/break states |
| `.interactive-element` | Ripple effect on click |
| `.gpu-accelerated` | `translateZ(0)` + `will-change: transform` |
| `.focus-ring` | Focus-visible outline |
| `.loading-shimmer` | Animated shimmer |

RTL utilities: `.ms-*`, `.me-*`, `.ps-*`, `.pe-*`, `.start-*`, `.end-*`, `.text-start`, `.text-end`

---

## Glass Morphism Layers

```css
/* Subtle (barely visible) */
background: var(--glass-bg-subtle);
backdrop-filter: blur(8px);

/* Standard (cards, panels) */
background: var(--glass-bg-soft);
backdrop-filter: blur(12px);

/* Heavy (overlays, modals) */
background: var(--overlay-component-bg);
backdrop-filter: var(--overlay-component-backdrop);
```

---

## Feature UI Components

### Kanban Board (`src/components/kanban/`)

| Component | Purpose |
|-----------|---------|
| `KanbanColumn` | Status column with vuedraggable list, header (title + count + add), progressive render (30 task limit), WIP-limit CSS (`.wip-exceeded`, `.wip-warning`), HTML5 drop for inbox drags |
| `KanbanSwimlane` | Per-project swimlane wrapping KanbanColumns. 4 view modes: status/date/priority/category. Collapsible header with ProjectEmojiIcon |
| `TaskCard` | Kanban card: priority dot, title, description preview, tag chips, badges, actions. Density variants, focus/timer-active/flash states, progressive disclosure |
| `card/TaskCardBadges` | Badge row: due date (overdue/today color), subtask count, pomodoro count, attachments, recurrence icon |
| `card/TaskCardActions` | Hover action bar: Eye (focus) + Play (timer). Hidden by default, shown on `.task-card:hover` |
| `card/TaskCardStatus` | 10px priority dot button. Clickable to cycle priority. Color-coded high/medium/low/none |

### Calendar (`src/components/calendar/`)

| Component | Purpose |
|-----------|---------|
| `CalendarHeader` | Sticky: prev/next nav, date title, Today button, Day/Week/Month segmented control, View Options popover (project filter, hide-completed, future-recurring, Google Calendar toggle) |
| `CalendarDayView` | Time grid with positioned event cards, current-time indicator, drag-to-create, resize handles (top/bottom), external calendar events |
| `CalendarWeekView` | Multi-column day grid, same architecture as DayView, multi-day event layout |
| `CalendarMonthView` | Month grid with draggable cells, event chips per day, overflow handling, double-click to create |
| `CalendarStatusOverlays` | Overlay layer: system health alert (gradient banner), operation error alert (retryable/permanent), loading spinner |

### Task Table Row (`src/components/tasks/row/`)

| Component | Purpose |
|-----------|---------|
| `TaskRowTitle` | Title cell |
| `TaskRowDueDate` | Clickable date with overdue coloring → Teleport dropdown with presets (Today, Tomorrow, This Week) + date input |
| `TaskRowProject` | Clickable project badge (emoji/color) → Teleport project selector |
| `TaskRowPriority` | Clickable priority badge (color-coded) → Teleport priority dropdown |
| `TaskRowEstimate` | Clickable time estimate → Teleport duration preset dropdown |
| `TaskRowActions` | Hover bar: AI-suggest, Focus, Timer, Edit, Duplicate |

**Pattern**: All `TaskRow*` cells use Teleport-to-body dropdowns to escape table `overflow` clipping.

### Task Interaction Components (`src/components/tasks/`)

| Component | Purpose |
|-----------|---------|
| `done-toggle/DoneToggleVisuals` | Completion checkbox. Variants: `simple` (minimal square) / `default` / `subtle` / `prominent` / `minimal`. Sizes: sm/md/lg. Features: ripple on click, celebration particle burst, circle-to-check animation, glow layers |
| `drag-handle/DragHandleVisuals` | Grip button: 2×3 dot grid (sm/md/lg sizes), multi-layer glass morphism, glow/pulse animation, keyboard nav (arrows) |
| `drag-handle/DragHandleGhost` | Teleported floating ghost while dragging: blue-tinted glass, `position: fixed`, scale(1.1) |
| `drag-handle/DragHandleHints` | Hover tooltip: "Click → Start drag", "↑↓ → Move", "Esc → Cancel" with `<kbd>` styling |
| `TaskContextMenu` | Right-click context menu with status, priority, project, due date sub-menus |
| `SortProgress` | Sort progress indicator |

### Sidebar (`src/components/sidebar/`)

| Component | Purpose |
|-----------|---------|
| `SidebarHeader` | Logo + "FlowState" text, Create Project button, hide-sidebar + settings icon buttons |
| `SidebarSmartViews` | Smart view grid: Today, This Week, All Active chips with drag-drop zones and task counts |
| `SidebarDurationSection` | Collapsible duration filter chips: Quick/Short/Medium/Long with count badges |
| `SidebarProjectsSection` | Project list with multi-select bar (Delete + Clear), inline delete confirmation, "Add Project" button |
| `SidebarQuickTaskInput` | Expandable input + voice recording mic button (pulsing animation), Enter to create |
| `SidebarUserFooter` | Avatar circle + email + "Online" status (authenticated) OR Login button (guest) |
| `SidebarWorkspaceSwitcher` | Workspace dropdown: color dot + name + chevron. Lists Personal + shared workspaces. Inline create + invite link generation |

### Settings (`src/components/settings/`)

**Primitives** (reuse these when building settings UI):

| Component | Purpose |
|-----------|---------|
| `SettingsSection` | Group wrapper: `title` prop → `<h3>` + `<slot />` |
| `SettingsToggle` | Label + description + slide toggle checkbox |
| `SettingsDurationPicker` | Pill button row for minute values (e.g. 15/20/25/30) |
| `SettingsOptionPicker` | Generic segmented option picker: label, description, pill buttons |

**Tabs** (9 total in `settings/tabs/`):

| Tab | Key Content |
|-----|-------------|
| `TimerSettingsTab` | Work/break durations (pill pickers), auto-start toggles |
| `AppearanceSettingsTab` | Sound effects toggle + test buttons, week start picker, language settings |
| `NotificationsSettingsTab` | Master enable toggle, reminder-time checkboxes, channels |
| `WorkflowSettingsTab` | Workflow preferences |
| `IntegrationsSettingsTab` | External service integrations |
| `AISettingsTab` | AI model/provider configuration |
| `StorageSettingsTab` | Backup create/download/restore, golden backup, IndexedDB queue clearing |
| `AboutSettingsTab` | App version, Tauri auto-updater controls, links |
| `AccountSettingsTab` | Email display, logout, password change, Google Calendar OAuth |

### Notifications (`src/components/notifications/`)

| Component | Purpose |
|-----------|---------|
| `NotificationPreferences` | Master enable toggle, reminder-time checkboxes (minutes-before), notification channels |
| `ReminderPicker` | Bell icon button (teal when reminders set, badge count) → NPopover with reminder list + quick-add presets + NDatePicker |

### Toast System (`src/composables/useToast.ts`)

**Imperative** — no Vue component. Creates DOM nodes in `#toast-container` on `document.body`.

```typescript
import { useToast } from '@/composables/useToast'
const toast = useToast()
toast.success('Task created')
toast.error('Failed to save')
toast.warning('Offline mode')
toast.info('Syncing...')
```

Types: success (green left-border), error (red), warning (amber), info (dark glass). 3s default, top-right position, slideIn/slideOut animation.

### Workspace/Collaboration (`src/components/sidebar/SidebarWorkspaceSwitcher.vue`)

- Dropdown in sidebar: Personal workspace + shared workspaces
- Inline workspace creation
- Invite flow: email prompt → generates invite link → copies to clipboard
- Role-based visibility: only owner/admin can invite
- **Note**: Uses `window.prompt()` for email — should be migrated to `BaseModal` + `BaseInput`

---

## UI Pattern Gaps (No Component Exists Yet)

| Pattern | Current Workaround | Recommendation |
|---------|-------------------|----------------|
| Skeleton/loading placeholder | `CalendarStatusOverlays` (calendar only), inline spinners elsewhere | Create `BaseSkeleton` in `base/` |
| Global error banner | Per-component error handling | Consider `BaseAlert` component |

---

## Critical Rules

1. **NEVER** use native `<select>` — always `CustomSelect.vue`
2. **NEVER** use solid-fill buttons — always glass morphism pattern
3. **NEVER** hardcode pixel/rgba values — always CSS custom properties
4. **Primary action color is TEAL** (`--brand-primary` / #4ECDC4), NOT green
5. `var(--color-success)` is for status indicators, NOT action buttons
6. All overlay components use `--overlay-component-*` tokens
7. Check `src/components/base/` and `src/components/common/` before creating ANY UI element
8. Use `useToast()` for transient feedback — never build custom notification divs
9. Settings UIs must use `SettingsSection`/`SettingsToggle`/`SettingsDurationPicker`/`SettingsOptionPicker`
10. `TaskRow*` inline dropdowns use Teleport-to-body pattern — follow this for any new table cell editors
