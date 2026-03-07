# SOP-040: Calendar Current Time Indicator

**Created**: 2026-01-29
**Related Task**: BUG-1095
**Status**: Active

## Problem

The calendar current time indicator (red horizontal line showing current time position) was invisible because CSS color variables were referenced but never defined.

### Root Cause

In `design-tokens.css`, semantic tokens referenced undefined HSL variables:

```css
/* These were REFERENCED but never DEFINED */
--color-success: hsl(var(--green-500));  /* --green-500 undefined! */
--color-danger: hsl(var(--red-500));     /* --red-500 undefined! */
--color-info: hsl(var(--blue-500));      /* --blue-500 undefined! */
```

Only `--teal-500` was defined. This caused all elements using `--color-danger` (like the time indicator) to render as transparent.

## Solution

### 1. Add Missing Color Variables

Add to `src/assets/design-tokens.css` near line 49 (after `--teal-500`):

```css
/* Core Color Palette (HSL values for semantic tokens) */
--red-500: 0, 84%, 60%;      /* #ef4444 - danger, errors, current time indicator */
--green-500: 142, 71%, 45%;  /* #22c55e - success, completed */
--blue-500: 217, 91%, 60%;   /* #3b82f6 - info, links */
```

### 2. Fix Invalid CSS Syntax

In `CalendarDayView.vue`, fix invalid negative variable syntax:

```css
/* WRONG - invalid syntax */
margin-left: -var(--space-1_5);

/* CORRECT */
margin-left: calc(-1 * var(--space-1_5));
```

### 3. Make Indicator Non-Intrusive

Apply best practices from [FullCalendar](https://fullcalendar.io/docs/nowIndicator):

| Property | Before | After | Reason |
|----------|--------|-------|--------|
| `z-index` | 100 | 2 | Behind tasks (z-index: 5) |
| Dot size | 12px | 8px | Less intrusive |
| Line opacity | 100% | 70% | Tasks show through |
| `pointer-events` | none | none | Clicks pass through |

## Key Files

- `src/assets/design-tokens.css` - Color variable definitions
- `src/components/calendar/CalendarDayView.vue` - Time indicator CSS

## Verification

1. Run `npm run dev`
2. Open http://localhost:5546/#/calendar
3. Verify red time indicator line visible at current time
4. Navigate to different day → line disappears
5. Return to today → line reappears
6. If tasks overlap the line, they should appear on top

## Debug Commands

Check if CSS variables resolve correctly:

```javascript
// In browser console
const root = document.documentElement;
const style = getComputedStyle(root);
console.log('--red-500:', style.getPropertyValue('--red-500'));
console.log('--color-danger:', style.getPropertyValue('--color-danger'));

// Check indicator element
const dot = document.querySelector('.time-indicator-dot');
console.log('dot background:', getComputedStyle(dot).backgroundColor);
// Should be rgb(239, 67, 67), NOT rgba(0, 0, 0, 0)
```

## Prevention

When adding new semantic tokens that reference color variables:
1. Verify the referenced variable exists in the base palette section
2. Use the naming pattern `--{color}-{shade}` (e.g., `--red-500`)
3. Test visually - transparent elements indicate undefined variables
