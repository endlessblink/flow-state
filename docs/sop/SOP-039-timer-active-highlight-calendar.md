# SOP-039: Timer-Active Highlight for Calendar Events

**Created**: 2026-01-29
**Status**: Active

## Problem

When a Pomodoro timer is running on a task, there's no visual indication in the Calendar view that the task is actively being worked on. Other views (Board, Inbox) have amber glow highlights, but Calendar events lacked this feedback.

## Solution

Add CSS styles for the existing `timer-active-event` class in `CalendarDayView.vue`:

```css
.slot-task.timer-active-event {
  border-color: var(--timer-active-border);
  box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  animation: timer-pulse 2s ease-in-out infinite;
}

.slot-task.timer-active-event:hover {
  box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
}

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

## Key Files

- `src/components/calendar/CalendarDayView.vue` - Calendar event rendering and styles
- `src/assets/design-tokens.css` - Timer-active design tokens (already defined)

## Design Tokens Used

| Token | Purpose |
|-------|---------|
| `--timer-active-border` | Amber border color |
| `--timer-active-glow` | Ambient glow effect |
| `--timer-active-shadow` | Drop shadow |
| `--timer-active-glow-strong` | Enhanced glow on hover |
| `--timer-active-shadow-hover` | Enhanced shadow on hover |

## Verification

1. Start a timer on a task (context menu → "Start Timer")
2. Open Calendar view
3. Verify:
   - Active task has amber border glow
   - Subtle pulse animation (opacity fades slightly every 2s)
   - Glow intensifies on hover

## Related SOPs

- `SOP-012-timer-active-highlight.md` - Original timer highlight implementation for other views
