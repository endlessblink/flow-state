# Design System

> **Last verified**: April 5, 2026 | **Token files**: `src/assets/design-tokens.css` (~1,450 lines), `src/assets/theme-variables.css` (`--theme-*` tokens for light/dark switching)
> **Read this before any UI work. NEVER hardcode CSS values — always use design tokens.**
>
> **Note:** `theme-variables.css` defines `--theme-*` tokens used for light/dark theme switching. These are separate from the base tokens in `design-tokens.css` and must be consulted for any theme-aware styling.

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
--glass-bg-subtle   (0.02)    --glass-bg-weak    (0.04)
--glass-bg-light    (0.08)    --glass-bg-tint     (0.10)
--glass-bg-medium   (0.15)    --glass-bg-soft     (0.18)
--glass-bg-heavy    (0.25)    --glass-bg-solid    (0.95, .tauri-app/.pwa-app ONLY — NOT available in regular web mode)
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
--brand-hover             /* hsl(var(--teal-400)) — BUG: --teal-400 is NOT DEFINED in design-tokens.css (only --teal-500 exists). This token resolves to an invalid value at runtime. */
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

## Blur Scale

```css
--blur-xs (8px)   --blur-sm (10px)   --blur-regular (12px)
--blur-md (16px)  --blur-lg (24px)   --blur-xl (32px)
```

Use these instead of hardcoded `blur(Xpx)` values in `backdrop-filter`.

---

## Button Heights & Icon Sizes

**Button heights:**
```css
--btn-sm (1.75rem / 28px)   --btn-md (2rem / 32px)   --btn-lg (2.25rem / 36px)
```

**Icon sizes (for Lucide icons and SVG):**
```css
--icon-xs (10px)  --icon-sm (12px)  --icon-md (14px)
--icon-lg (16px)  --icon-xl (20px)  --icon-2xl (24px)
```

---

## Filter Chip Tokens

Sidebar smart-view filter chips each have a `bg`, `border`, and `glow` token. Colors are distinct per filter type:

```css
--filter-today-bg/border/glow       /* Sky blue (rgba 56,189,248) */
--filter-week-bg/border/glow        /* Darker sky blue (rgba 14,165,233) */
--filter-tasks-bg/border/glow       /* Blue (rgba 59,130,246) */
--filter-uncategorized-bg/border/glow  /* Orange (rgba 245,158,11) */
```

Pattern: `bg` at 0.12–0.15 alpha, `border` at 0.45–0.50, `glow` is `0 0 16px color(0.25)`.

---

## Calendar Tokens

Calendar UI elements use indigo/purple tones. Key token groups:

```css
/* Hover */
--calendar-hover-bg           /* rgba(99,102,241, 0.02) */
--calendar-hover-bg-medium    /* rgba(99,102,241, 0.05) */

/* Drag-to-create ghost */
--calendar-creating-bg/bg-alt/border
--calendar-ghost-bg-start/end/border/shadow

/* Today column */
--calendar-today-bg-start/bg-end/border/glow
--calendar-today-badge-start/end/shadow

/* Current time indicator — green */
--calendar-current-time-bg-start/bg-end/border/glow
```

All indigo/purple (`rgb(99,102,241)`) except current-time indicator which uses green (`rgb(16,185,129)`).

---

## Kanban Tokens

**Layout sizing:**
```css
--kanban-column-width (360px)   --kanban-column-width-lg (340px)
--kanban-column-width-md (320px) --kanban-column-width-sm (300px)
--kanban-gap (16px)             --kanban-column-min-height (200px)
--kanban-drag-area-min-height (120px)
```

**Background tokens:**
```css
--kanban-bg                    /* transparent */
--kanban-column-bg             /* var(--glass-bg-medium) */
--kanban-column-bg-hover       /* var(--glass-bg-heavy) */
--kanban-header-bg             /* var(--surface-hover) */
--kanban-card-glass-bg         /* rgba(35,32,55, 0.7) purple-tinted */
--kanban-badge-bg              /* var(--glass-bg-heavy) */
--kanban-card-footer-border    /* var(--glass-border-light) */
--kanban-card-tag-bg/border    /* glass-bg-medium / glass-border */
--kanban-card-description-color /* var(--text-tertiary) */
```

---

## Project Indicator Tokens

Consistent sizing for emoji icons and colored dots across all views:

**Container sizes (for `ProjectEmojiIcon`):**
```css
--project-indicator-size-xs (16px)  /* Ultra-compact */
--project-indicator-size-sm (20px)  /* TaskCard, TaskRow */
--project-indicator-size-md (24px)  /* TaskNode, canvas */
--project-indicator-size-lg (32px)  /* Featured displays */
```

**Emoji font sizes within containers:**
```css
--project-emoji-size-xs (12px)  --project-emoji-size-sm (14px)
--project-emoji-size-md (18px)  --project-emoji-size-lg (24px)
```

**Colored circle dot sizes (fallback for projects without emoji):**
```css
--project-circle-size-xs (4px)  --project-circle-size-sm (6px)
--project-circle-size-md (7px)  --project-circle-size-lg (10px)
```

**Glow variants:** `--project-indicator-glow-subtle/medium/strong` (all use `currentColor` for project-color-aware glow).

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
--duration-instant (50ms*)     --duration-fast (150ms)
--duration-normal (200ms)      --duration-slow (300ms)
--duration-slower (500ms)

--ease-linear  --ease-in  --ease-out  --ease-in-out
--spring-smooth*  --spring-bouncy  --spring-swift  --spring-gentle
```

> **Known duplicates in design-tokens.css (last definition wins):**
> - `--duration-instant`: defined as `100ms` (line ~446) and `50ms` (line ~989). **Effective value: 50ms.**
> - `--spring-smooth`: defined as `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (line ~456) and `cubic-bezier(0.4, 0, 0.2, 1)` (line ~983). **Effective value: `cubic-bezier(0.4, 0, 0.2, 1)`** — which is identical to `--ease-in-out`.

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

> **IMPORTANT — BaseButton vs `.btn-*` classes are NOT interchangeable:**
> - `BaseButton variant="primary"`: transparent bg + `--brand-primary` border + `--brand-primary` text. **No glass, no backdrop-filter.**
> - `.btn-primary` (ad-hoc CSS class): `--glass-bg-soft` bg + `--brand-primary` border + `backdrop-filter: blur(8px)`. **Not a global Tailwind utility** — defined locally in various components with inconsistent implementations.
>
> Use `BaseButton` for all new buttons. Only use `.btn-primary` class in non-Vue contexts (e.g., Storybook decorators).

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
**Props**: `isOpen`, `title`, `description`, `size` (sm|md|lg|xl|full), `variant` (default|danger|warning|success), `closeOnOverlayClick`, `closeOnEscape`, `submitOnEnter` (default: true), `showHeader` (default: true), `showFooter` (default: false), `showCloseButton` (default: true), `showCancelButton` (default: true), `showConfirmButton` (default: true), `cancelText`, `confirmText`, `closeAriaLabel`, `trapFocus`, `loading`, `confirmDisabled`, `titleClass`, `descriptionClass`, `bodyClass`, `footerClass`
**Emits**: `close`, `cancel`, `confirm`, `open`, `afterOpen`, `afterClose`
**Slots**: default (body), title, description, footer
**Note**: Teleports to body. Has focus trap + scroll lock. Enter key submits by default (skips textarea/contenteditable). Cancel/confirm text defaults to i18n `common.cancel`/`common.confirm`.

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
**Props**: `active`, `selected`, `nested`, `hasChildren`, `expanded`, `colorDot`, `colorType` ('hex' | 'emoji'), `emoji`, `count`, `projectId`
**Emits**: `click`, `toggleExpand`, `taskDrop`, `projectDrop`
**Note**: Supports drag-and-drop for tasks and project nesting. `hasChildren` shows expand/collapse chevron. `colorType` controls whether to render emoji or hex color dot.

### AppLogo
**Props**: `size?: 'xs'|'sm'|'md'|'lg'|'xl'|number` (default: `'sm'`), `round?: boolean`
**Size map**: xs=16, sm=24, md=32, lg=48, xl=64. Pass a raw number for custom px size.
**Note**: Renders the FlowState logo image. Falls back silently on load error. `round` adds `border-radius: var(--radius-full)`.

### FilterControls
Renders four filter dropdowns: project, smart view, status, and assignment (workspace-only). Uses CustomSelect for all dropdowns.

---

## Common Components (`src/components/common/`)

### CustomSelect — THE ONLY dropdown component
**Import**: `import CustomSelect from '@/components/common/CustomSelect.vue'`
**Props**: `modelValue: string|number|null`, `options: {label, value}[]`, `placeholder?`, `compact?`
**Note**: Teleport-based, position-aware. NEVER use native `<select>` or `<NSelect>`.

### ConfirmationModal
**Props**: `isOpen`, `title?`, `message?`, `details?: string[]`, `confirmText?`
**Note**: Wraps BaseModal with `variant="danger"`.

### TiptapEditor
**Props**: `modelValue: string`, `textDirection: 'ltr' | 'rtl'`
**Emits**: `update:modelValue`
**Note**: Full WYSIWYG editor with toolbar (headings H1–H3, bold/italic/underline/strikethrough, lists, blockquote, code block, horizontal rule, link, table, text color). Stores and emits markdown (not HTML). Uses debounced emit (150ms). Handles Shift+Enter to exit lists. **Distinct from `MarkdownEditor`** — use `TiptapEditor` when a visible formatting toolbar is needed; use `MarkdownEditor` for inline/lightweight editing.

### GroupModal
**Props**: `isOpen: boolean`, `group?: CanvasSection | null`, `position?: { x, y }`
**Emits**: `close`, `created`, `updated`
**Note**: Create/edit canvas groups (name, color presets + custom hex, parent group selector). Uses `BaseInput` and `CustomSelect` internally. **Does NOT use `BaseModal`** — it builds its own overlay div with Teleport. Compliance gap: should be migrated to `BaseModal`.

### FaviconManager
No props (reads from timer store directly). Hidden component (renders a `display:none` canvas). Dynamically updates the browser favicon with a progress ring around the app logo when the Pomodoro timer is active. Work phase = red ring, break phase = green ring. Updates only when the tab is visible for performance. Accepts optional `config` prop to override colors/sizes.

### IOSInstallPrompt
No props. Shows a bottom-sheet prompt on iOS Safari (non-standalone) guiding users to tap Share → Add to Home Screen. Dismissal persisted in `localStorage`. Auto-hides if already installed as PWA.

### Other Common Components
- `MarkdownEditor` — TipTap rich text editor (lightweight, no visible toolbar)
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
