# SOP: Canvas Smart Group Header Overflow Fix

**Date**: December 19, 2025
**Bug ID**: BUG-018
**Status**: RESOLVED

---

## Problem Summary

When canvas smart groups (e.g., "Today", "High Priority") were resized to be narrow, the header icons and buttons would:
- Get cut off abruptly
- Overlap with each other
- Break the header layout
- Overflow outside the group boundaries

---

## Root Cause Analysis

### Primary Issue: No Overflow Handling

The section header had 8+ flex items all with `flex-shrink: 0`:

```
Header Layout (before fix):
[color-dot][collapse-btn][name-input][power-indicator][collect-btn][power-toggle][settings][auto-collect][type-badge][count-badge]
```

| Element | Issue |
|---------|-------|
| `.section-header` | No `overflow: hidden`, 50px right padding for badge |
| `.section-name-input` | `flex: 1` but no `min-width` constraint |
| Action buttons | All had `flex-shrink: 0` - couldn't compress |
| `.section-count` | Absolutely positioned (already OK) |

When the group width was reduced, all non-shrinking elements competed for space, causing layout overflow.

---

## Solution

### Fix 1: Wrap Actions in Overflow Container

Created `.header-actions` container around all action buttons:

```vue
<!-- Template change -->
<div v-if="!isCollapsed" class="header-actions">
  <div v-if="isPowerMode" class="power-indicator">...</div>
  <div v-if="isPowerMode" class="collect-wrapper">...</div>
  <button v-if="powerKeyword" class="power-toggle-btn">...</button>
  <button class="settings-btn">...</button>
  <button v-if="section.type !== 'custom'" class="auto-collect-btn">...</button>
  <div v-if="section.type !== 'custom'" class="section-type-badge">...</div>
</div>
```

### Fix 2: CSS for Overflow Container

```css
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 1;
  min-width: 0; /* Allow shrinking below content size */
  overflow: hidden;
  position: relative;
}

/* Fade mask to indicate overflow */
.header-actions::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  background: linear-gradient(to right, transparent, var(--glass-bg-light));
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.section-header:hover .header-actions::after {
  opacity: 0.8;
}
```

### Fix 3: Name Input Shrinking

```css
.section-name-input {
  flex: 1 1 60px; /* Grow, shrink, min basis of 60px */
  min-width: 60px; /* Minimum readable width */
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
```

### Fix 4: Header Overflow Hidden

```css
.section-header {
  overflow: hidden; /* Prevent header overflow */
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/canvas/GroupNodeSimple.vue` | Template: wrapped actions in container; CSS: overflow handling |

---

## Testing Verification

### Test Steps
1. Open Canvas view at http://localhost:5546/canvas
2. Create a smart group (e.g., named "Today" to trigger power mode)
3. Resize the group to be very narrow (~200px)
4. Verify header doesn't overflow or break layout

### Verification Metrics (At 200px Width)
```javascript
{
  sectionWidth: 200,
  headerWidth: 200,
  nameInputWidth: 60,           // Maintains minimum
  headerActionsWidth: 22,       // Compressed visible width
  headerActionsScrollWidth: 160, // Actual content width
  isOverflowing: true           // Overflow hidden working
}
```

### Visual Indicators (Success)
- Header stays within group bounds
- Name input shows with ellipsis if too long
- Action buttons gracefully clip (not break)
- Fade mask appears on hover (indicates more content)

---

## Rollback Procedure

If issues arise, rollback with:

```bash
git checkout HEAD -- src/components/canvas/GroupNodeSimple.vue
```

---

## Lessons Learned

1. **Flexbox overflow** - Containers need `min-width: 0` to shrink below content size
2. **Group related elements** - Wrap action buttons in a single container for unified overflow handling
3. **Progressive disclosure** - Fade mask hints at hidden content without breaking UX
4. **Test with extreme sizes** - Always test UI components at minimum dimensions

---

## Related Documentation

- BUG-018 in MASTER_PLAN.md
- Vue Flow NodeResizer documentation
- CSS Flexbox overflow handling
