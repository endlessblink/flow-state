# SOP-018: Naive UI Date Picker Styling

**Created**: 2026-01-23
**Task**: TASK-1011
**Status**: Active

## Overview

This SOP documents how to style Naive UI's `NDatePicker` component in dark theme, specifically for the FlowState application.

## Problem Statement

Naive UI's date picker has a specific HTML structure that differs from typical component patterns:
- Text content (date numbers) is NOT inside the clickable `__trigger` element
- Styling must target multiple elements for different visual properties

## HTML Structure (Critical Knowledge)

```html
<div class="n-date-panel-date n-date-panel-date--current n-date-panel-date--selected">
  <div class="n-date-panel-date__trigger"></div>  <!-- Empty overlay for borders/backgrounds -->
  23                                               <!-- Text is direct child, NOT in trigger! -->
  <div class="n-date-panel-date__sup"></div>      <!-- Superscript indicators -->
</div>
```

### Key Classes

| Class | Meaning |
|-------|---------|
| `n-date-panel-date` | Base date cell |
| `n-date-panel-date--current` | Today's date |
| `n-date-panel-date--selected` | Currently selected date |
| `n-date-panel-date--excluded` | Dates from other months |
| `n-date-panel-date__trigger` | Clickable overlay (borders go here) |

## Styling Approach

### 1. Text Color

**Target the PARENT** `.n-date-panel-date` element, NOT the `__trigger`:

```css
/* ✅ CORRECT - text is in parent */
.n-date-panel .n-date-panel-date.n-date-panel-date--selected {
    color: #10b981 !important;
}

/* ❌ WRONG - trigger is empty */
.n-date-panel-date--selected .n-date-panel-date__trigger {
    color: #10b981 !important;  /* Has no effect! */
}
```

### 2. Borders/Backgrounds

**Target the `__trigger`** element for visual effects:

```css
.n-date-panel .n-date-panel-date.n-date-panel-date--selected .n-date-panel-date__trigger {
    background: transparent !important;
    border: 2px solid #10b981 !important;
}
```

### 3. Dot Indicators (::after)

**Add pseudo-elements to the PARENT** `.n-date-panel-date`:

```css
.n-date-panel .n-date-panel-date.n-date-panel-date--current::after {
    content: '' !important;
    position: absolute !important;
    bottom: 3px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: 4px !important;
    height: 4px !important;
    border-radius: 50% !important;
    background: #10b981 !important;
}
```

### 4. Dimming Excluded Dates

```css
.n-date-panel .n-date-panel-date.n-date-panel-date--excluded {
    opacity: 0.35 !important;
}
```

## Theme Overrides (App.vue)

In addition to CSS, use Naive UI's theme system:

```typescript
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  DatePicker: {
    itemColorActive: 'transparent',        // No fill on selected
    itemColorHover: 'rgba(255, 255, 255, 0.08)',
    itemTextColorActive: '#10b981',        // Green text when selected
    itemBorderRadius: '6px',
    panelHeaderDividerColor: 'rgba(255, 255, 255, 0.08)',
    arrowColor: 'rgba(255, 255, 255, 0.45)',
  },
}

// In template:
<NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
```

## Design Specification

| State | Text Color | Border | Dot |
|-------|-----------|--------|-----|
| Regular | `rgba(255,255,255,0.82)` | none | none |
| Today (not selected) | `#ffffff` | none | white |
| Selected | `#10b981` | `2px solid #10b981` | none |
| Today + Selected | `#10b981` | `2px solid #10b981` | green |
| Excluded (other month) | same | none | none (35% opacity) |

## Timezone Fix

When handling date selection, use local date components to avoid UTC conversion issues:

```typescript
const handleDatePickerSelect = async (timestamp: number | null) => {
  if (!timestamp) return

  // ✅ CORRECT - use local date components
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const formattedDate = `${year}-${month}-${day}`

  // ❌ WRONG - toISOString() converts to UTC, can shift date
  // const formattedDate = date.toISOString().split('T')[0]
}
```

## Files Modified

- `src/App.vue` - Theme overrides
- `src/assets/global-overrides.css` - CSS styling
- `src/components/tasks/TaskContextMenu.vue` - Date picker integration

## Testing

Use Playwright to verify styling:

```typescript
// Check excluded dates are dimmed
const excludedOpacity = await page.locator('.n-date-panel-date--excluded').first()
  .evaluate(el => window.getComputedStyle(el).opacity)
expect(parseFloat(excludedOpacity)).toBeLessThan(1)

// Check selected has green border
const borderColor = await page.locator('.n-date-panel-date--selected .n-date-panel-date__trigger').first()
  .evaluate(el => window.getComputedStyle(el).borderColor)
expect(borderColor).toContain('16, 185, 129')  // #10b981 in RGB
```

## Common Pitfalls

1. **Styling `__trigger` for text** - Text is NOT in trigger element
2. **Using `toISOString()`** - Causes timezone shift, use local date components
3. **Low CSS specificity** - Use `.n-date-panel` parent in selectors
4. **Pseudo-elements on `__trigger`** - Grid layout may clip; use parent element instead
