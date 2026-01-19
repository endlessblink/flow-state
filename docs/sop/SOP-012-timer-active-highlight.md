# SOP-012: Timer-Active Task Highlighting

## Purpose

Provide consistent visual feedback when a task has an active Pomodoro timer running, across all views (Canvas, Board, Calendar, Catalog).

## Pattern

When a timer is started for a task, that task should be visually highlighted in ALL views where it appears, using a glowing effect with pulse animation.

## Implementation Pattern

### Step 1: Import Timer Store

```typescript
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

const timerStore = useTimerStore()
```

### Step 2: Add Computed Property

```typescript
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})
```

### Step 3: Add Class Binding

```vue
<div
  class="task-card"
  :class="{ 'timer-active': isTimerActive }"
>
```

### Step 4: Add CSS Styles

```css
/* Timer active state - amber glow */
.task-card.timer-active {
  border-color: var(--timer-active-border);
  box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  animation: pulse-timer 2s ease-in-out infinite;
}

.task-card.timer-active:hover {
  box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
}

@keyframes pulse-timer {
  0%, 100% {
    box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  }
  50% {
    box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
  }
}
```

## Design Tokens

All timer-active styling uses design tokens from `src/assets/design-tokens.css`:

| Token | Value | Purpose |
|-------|-------|---------|
| `--timer-active-border` | `var(--color-work)` | Amber border color |
| `--timer-active-glow` | `0 0 20px rgba(251, 191, 36, 0.4)` | Subtle amber glow |
| `--timer-active-glow-strong` | `0 0 30px rgba(251, 191, 36, 0.6)` | Stronger glow for pulse |
| `--timer-active-shadow` | `0 8px 16px rgba(0, 0, 0, 0.2)` | Shadow for depth |
| `--timer-active-shadow-hover` | `0 12px 24px rgba(0, 0, 0, 0.25)` | Hover shadow |

## Current Implementations

| View | Component | Style |
|------|-----------|-------|
| Canvas | `TaskNode.vue` | Blue glow (`--blue-shadow`) |
| Calendar | `CalendarTaskCard.vue` | Pulsing timer icon |
| Board | `TaskCard.vue` | Amber glow + pulse |
| Catalog | `TaskRow.vue` | Amber glow + pulse |
| Hierarchical | `HierarchicalTaskRowContent.vue` | Amber glow + pulse |

## Key Files

```
src/stores/timer.ts                        # Timer state (isTimerActive, currentTaskId)
src/assets/design-tokens.css               # Timer design tokens (lines 537-576)
src/components/kanban/TaskCard.vue         # Board view
src/components/kanban/TaskCard.css         # Board view styles
src/components/tasks/TaskRow.vue           # Catalog view
src/components/tasks/HierarchicalTaskRow.css  # Hierarchical catalog styles
src/components/canvas/TaskNode.vue         # Canvas view
```

## Timer Store API

The timer store exposes these computed properties:

```typescript
// From src/stores/timer.ts
const isTimerActive = computed(() => currentSession.value?.isActive || false)
const currentTaskId = computed(() => currentSession.value?.taskId || null)
```

## Adding Timer Highlight to New Components

When creating a new task display component, follow this checklist:

- [ ] Import `useTimerStore` from `@/stores/timer`
- [ ] Create `isTimerActive` computed property
- [ ] Add `'timer-active': isTimerActive` to class binding
- [ ] Add `.timer-active` CSS with design tokens
- [ ] Add pulse animation (optional but recommended)
- [ ] Test by starting a timer and verifying the glow appears

## Related SOPs

- [TIMER-sync-architecture.md](./active/TIMER-sync-architecture.md) - Cross-device timer sync
- [STYLING-glassmorphism-guide.md](./active/STYLING-glassmorphism-guide.md) - Glass morphism patterns

---

**Created**: January 18, 2026
**Task**: TASK-314
