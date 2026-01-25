# SOP-037: Inbox Panel Auto-Size Width

**Created**: January 25, 2026
**Related Task**: BUG-1079
**Status**: Active

## Problem

The inbox panel in Canvas and Calendar views had a fixed 320px width that caused content clipping:
- Header elements (badges, dropdowns, search button) were cut off on edges
- Calendar view was worse due to additional filter chips
- Collapsed state was too wide (48px) taking unnecessary space

## Solution

### 1. Auto-Size Expanded Width

Use CSS `fit-content` with min/max bounds:

```css
.unified-inbox-panel {
  width: fit-content;
  min-width: 320px;  /* Minimum width preserved */
  max-width: 420px;  /* Prevent excessive growth */
}
```

**Why this works**: The panel expands to fit content naturally but stays within reasonable bounds.

### 2. Override for Collapsed State

The collapsed state must reset the min/max to allow slim width:

```css
.unified-inbox-panel.collapsed {
  width: 40px;
  min-width: unset;  /* CRITICAL: Reset min-width */
  max-width: unset;
  align-items: center;  /* Center button and badge */
}
```

**Key insight**: Without `min-width: unset`, the collapsed width cannot shrink below the expanded minimum.

### 3. Header Element Preservation

Prevent header elements from shrinking:

```css
.inbox-header {
  width: fit-content;
  min-width: 100%;  /* Take full panel width */
}

.inbox-header :deep(.n-badge) {
  flex-shrink: 0;  /* Prevent badge compression */
}
```

## Key Files

- `src/components/inbox/UnifiedInboxPanel.vue` - Panel container with width rules
- `src/components/inbox/unified/UnifiedInboxHeader.vue` - Header layout

## Pattern Summary

| State | Width | min-width | max-width |
|-------|-------|-----------|-----------|
| Expanded | fit-content | 320px | 420px |
| Collapsed | 40px | unset | unset |

## Verification

1. Open Canvas view - inbox header should show all elements without clipping
2. Open Calendar view - same verification (was worse before fix)
3. Collapse inbox - should be slim (40px) with centered chevron and badge
4. Expand inbox - should smoothly transition and auto-fit content

## Common Mistakes to Avoid

1. **Don't use fixed width** - Content varies based on filters, badges, locale
2. **Always reset min-width in collapsed** - Otherwise collapse won't work
3. **Use flex-shrink: 0 on critical elements** - Badges, buttons shouldn't compress
