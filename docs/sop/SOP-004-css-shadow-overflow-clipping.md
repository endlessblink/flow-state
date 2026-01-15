# SOP-004: CSS Shadow/Glow Overflow Clipping Prevention

## Problem

Box shadows and hover glows extend **outside** element boundaries. When a parent container has `overflow: hidden` or `overflow: auto`, these shadows get clipped.

## Symptoms

- Hover glow cut off on one or more sides
- Box shadow invisible or partially visible
- Border effects clipped at container edges

## Root Cause

```css
/* Parent container clips child shadows */
.container {
  overflow-y: auto;  /* Clips shadows that extend beyond boundary */
  overflow-x: hidden; /* Also clips */
  padding: 0;        /* No space for shadow to render */
}

/* Child has shadow that needs space */
.card:hover {
  box-shadow: 0 0 20px rgba(78, 205, 196, 0.2); /* 20px blur radius */
}
```

## Solution

**Option A: Add padding equal to or greater than shadow blur radius**

```css
.container {
  overflow-y: auto;           /* Keep scrolling */
  padding: var(--space-6);    /* 24px >= 20px shadow blur */
}
```

**Option B: Use overflow: visible (loses scrolling)**

```css
.container {
  overflow: visible;  /* Shadows render, but no scrolling */
}
```

## Design Token Reference

| Shadow Size | Minimum Padding |
|-------------|-----------------|
| 10px blur   | `var(--space-3)` (12px) |
| 16px blur   | `var(--space-4)` (16px) |
| 20px blur   | `var(--space-6)` (24px) |
| 30px blur   | `var(--space-8)` (32px) |

## Files Affected (Kanban Board)

| File | Selector | Property |
|------|----------|----------|
| `src/components/kanban/KanbanColumn.css` | `.tasks-container` | `overflow-y`, `padding` |
| `src/assets/global-overrides.css` | `.kanban-column .tasks-container` | `padding` |

## Current Implementation (TASK-287)

```css
/* KanbanColumn.css */
.tasks-container {
  overflow-y: auto;
  overflow-x: visible;
  padding: var(--space-6);  /* 24px for 20px glow */
  padding-bottom: var(--space-10);  /* Extra for last card */
}

/* global-overrides.css */
.kanban-column .tasks-container {
  padding: var(--space-6) !important;
}
```

## Testing Checklist

1. [ ] Hover over task card - glow visible on all 4 sides
2. [ ] With many tasks - column still scrolls
3. [ ] First card - top shadow not clipped
4. [ ] Last card - bottom shadow not clipped
5. [ ] RTL layout - left/right shadows render correctly

## Prevention

Before adding `overflow: hidden/auto` to any container:
1. Check if children have box-shadow or hover effects
2. Add padding >= shadow blur radius
3. Test hover states visually

## Related

- `--state-hover-glow: 0 0 20px rgba(78, 205, 196, 0.20)` (design-tokens.css)
- TASK-243: Original shadow clipping fix
- BUG-207: Hover clipping in tasks container
