# SOP-066: Compact Chips & Pills — Overflow and Clipping Fixes

## Purpose
Prevent layout breakage, text truncation, and clipping when displaying compact chips/pills in constrained-width panels (bottom sheets, modals, edit overlays). This SOP documents CSS and flexbox patterns that prevent common overflow and truncation regressions.

## Problems Solved

### 1. Pill Row Overflow — Text Gets Cut Off
**Symptom**: Pills in a horizontal row exceed container width and are hidden by `overflow: hidden`.

**Root Cause**: Flex children with `flex: 1` or `flex: auto` without `min-width: 0` can't shrink below their natural content width.

**Fix**: Set `min-width: 0` on the flex container:
```css
.pill-group {
  display: flex;
  gap: var(--space-2);
  flex: 1;
  min-width: 0; /* Allow shrinking below content width for scroll */
}
```

### 2. Chip Text Truncation with `-webkit-line-clamp`
**Symptom**: Text is truncated even though `overflow: visible` and `max-width: none` are set.

**Root Cause**: `display: -webkit-box` with `-webkit-line-clamp: 1` persists across elements. Flex children with `flex: 1` (which expands to `flex: 1 1 0%`) start with flex-basis of 0%, forcing the element to 0 width before content measurement. The `-webkit-line-clamp` constraint then truncates the already-constrained width.

**Fix**: Explicitly unset the line-clamp and `box-orient` properties:
```css
.category-selector--compact .project-name {
  max-width: none !important;
  flex: 0 0 auto !important;      /* Take natural content width, don't shrink */
  -webkit-line-clamp: unset !important;
  -webkit-box-orient: unset !important;
  overflow: visible !important;
}
```

**Key principle**: `-webkit-line-clamp` is "sticky" — you must explicitly unset it, not just hope `overflow: visible` overrides it.

### 3. Selection Border/Outline Clipping
**Symptom**: When a chip is selected and has an active border, box-shadow, or outline, the border gets clipped by the parent container.

**Root Cause**: Parent containers with `padding: 0` don't provide space for decorative borders that extend outside the element's border box.

**Fix**: Add padding to parent container to make space for selection indicators:
```css
.category-selector--compact .category-grid {
  padding: var(--space-1) var(--space-2) !important;
}
```

### 4. Horizontal Scroll Not Working in Flex Containers
**Symptom**: `overflow-x: auto` doesn't activate even though content exceeds container width.

**Root Cause 1**: Flex children with `flex: 1 1 0%` (shorthand `flex: 1`) shrink to fit the container. The browser never sees overflow because items shrink before scrolling becomes necessary.

**Root Cause 2**: `overflow-x: auto` + `overflow-y: visible` → CSS spec forces `visible` to `auto`. You CANNOT mix visible/non-visible overflow on perpendicular axes. The browser resolves this conflict by making both axes `auto`.

**Fix**: Use `flex: 0 0 auto` to preserve natural width and add `min-width: 0` to allow scroll to activate:
```css
.pill {
  flex: 0 0 auto;      /* Don't shrink, take natural content width */
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1_5) var(--space-2);
  white-space: nowrap;
}

.pill-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;        /* Parent must shrink to allow horizontal scroll */
}
```

**Key insight**: For flex children with decorative content (pills, chips), use `flex: 0 0 auto` to preserve their natural width. Only use `flex: 1` when you want items to expand equally to fill space.

## Critical CSS Patterns

### Flexbox Width Calculation Rules

| Property | Behavior | Use Case |
|----------|----------|----------|
| `flex: 1` (= `1 1 0%`) | Item shrinks to 0, then grows to fill | Equal-width distribution (e.g., priority buttons) |
| `flex: 0 0 auto` | Item takes natural content width | Pills, chips, badge-style elements |
| `min-width: 0` | Required on flex parents to allow children to shrink | Enables scroll containers inside flex layouts |
| `max-width: none` | Overrides inherited `max-width` constraint | Use with `flex: 0 0 auto` to prevent unintended truncation |

### Overflow Axis Mixing (CSS Spec Limitation)

```css
/* WRONG — visible + non-visible on perpendicular axes */
.container {
  overflow-x: auto;      /* Can be auto, scroll, hidden, clip */
  overflow-y: visible;   /* Can ONLY be visible on all axes, or auto/scroll on all */
}
/* Result: Browser forces both to auto */

/* CORRECT — when you need overflow-x but scrollable y */
.container {
  overflow-x: auto;
  overflow-y: auto;
  /* Or omit y and rely on default auto behavior */
}
```

### Selection State Padding (Active Indicators)

When chips have active states with `border-color`, `box-shadow`, or `outline`:

```css
.chip-container {
  padding: var(--space-1) var(--space-2);  /* Space for selection indicators */
  gap: var(--space-1_5);
}

.chip {
  flex: 0 0 auto;
  border: 1px solid var(--border-subtle);
  transition: all var(--duration-fast) ease;
}

.chip.active {
  border-color: var(--brand-primary);      /* Border extends into padding space */
  box-shadow: 0 0 0 2px var(--overlay-bg); /* Glow effect needs padding */
}
```

**Rule**: Parent `padding` must be ≥ decoration width (typically `var(--space-1)` is sufficient for 1px borders).

## File References

### Implementation Files
| File | Pattern | Purpose |
|------|---------|---------|
| `src/views/QuickSortView.vue` | `.pill-group`, `.pill-scroll`, `.pill`, `.pill.active` | Horizontal pill scrolling in edit overlay |
| `src/components/layout/CategorySelector.vue` | `.category-selector--compact` | Compact chip grid for project selection |

### CSS Rules by Component

**QuickSortView Edit Panel Pills:**
```css
/* Parent: allows flex children to shrink and scroll */
.pill-group {
  display: flex;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

/* Scroll container */
.pill-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
}

/* Individual pill: natural width, no line-clamp interference */
.pill {
  flex: 0 0 auto;
  white-space: nowrap;
}

/* Active state: border visible in padding space */
.pill.active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}
```

**CategorySelector Compact Mode:**
```css
/* Grid with padding for selection indicators */
.category-selector--compact .category-grid {
  padding: var(--space-1) var(--space-2) !important;
  gap: var(--space-1_5) !important;
}

/* Buttons: natural width, unset line-clamp */
.category-selector--compact .category-button {
  padding: var(--space-1) var(--space-2_5) !important;
  border: 1px solid;
}

/* Text: CRITICAL unsets to prevent webkit truncation */
.category-selector--compact .project-name {
  flex: 0 0 auto !important;
  max-width: none !important;
  -webkit-line-clamp: unset !important;
  -webkit-box-orient: unset !important;
  overflow: visible !important;
  white-space: nowrap !important;
}
```

## When to Apply This SOP

### Add This Pattern When:
- [ ] Creating a horizontal row of pills/chips in a flex container
- [ ] Implementing a compact dropdown/selector with disabled text truncation
- [ ] Adding active/hover states with borders or shadows to inline elements
- [ ] Building overflow-x scroll containers inside flex layouts
- [ ] Overriding webkit-specific text-overflow properties

### Verification Checklist:
- [ ] Pills don't overflow container edge
- [ ] Active/selected pill border is fully visible (not clipped)
- [ ] Text is not truncated even with many pills
- [ ] Horizontal scroll activates when content exceeds width
- [ ] Works in both light and dark modes (borders visible)
- [ ] Works with RTL layouts (if applicable)

## Debugging Tips

### Pills Cut Off (Overflow)
**Check**:
```bash
# Inspect computed styles
1. Parent flex container has min-width: 0? (YES = correct)
2. Pill flex value? (should be 0 0 auto, not 1)
3. Pill white-space: nowrap? (required to prevent wrapping)
```

### Text Truncated (Line-Clamp Leak)
**Check**:
```bash
# Browser DevTools
1. Computed -webkit-line-clamp value (unset = correct)
2. display property (should be block or flex, not -webkit-box)
3. Check parent for inherited line-clamp (use computed filter)
```

### Selection Border Clipped
**Check**:
```bash
1. Parent padding > 0? (YES = should prevent clipping)
2. Child border/shadow size? (compare to parent padding)
3. Parent overflow hidden? (change to visible or auto)
```

### Scroll Not Activating
**Check**:
```bash
1. Child flex-basis: (should be auto, not 0%)
2. Child min-width: (should be 0 or omitted)
3. Parent min-width: (should be 0 to allow shrinking)
4. Parent overflow-y: auto or visible? (not visible — use auto if needed)
```

## Common Pitfalls

### Pitfall 1: Forgetting `min-width: 0` on Flex Parent
```css
/* WRONG */
.pill-group {
  display: flex;
  flex: 1;
  /* NO min-width: 0 — children can't shrink below content width */
}

/* CORRECT */
.pill-group {
  display: flex;
  flex: 1;
  min-width: 0; /* This line is CRITICAL */
}
```

### Pitfall 2: Relying on `overflow: visible` to Unset `-webkit-line-clamp`
```css
/* WRONG — line-clamp still applies even with overflow visible */
.text {
  overflow: visible !important;
  max-width: none !important;
  /* Still truncated because -webkit-line-clamp: 1 is inherited */
}

/* CORRECT — explicitly unset the clamp */
.text {
  -webkit-line-clamp: unset !important;
  -webkit-box-orient: unset !important;
  overflow: visible !important;
}
```

### Pitfall 3: Using `flex: 1` for Badge-Style Elements
```css
/* WRONG — flex: 1 shrinks text to 0 width, then truncates */
.pill {
  flex: 1;
  padding: 8px 12px;
}

/* CORRECT — preserve natural width */
.pill {
  flex: 0 0 auto;
  padding: 8px 12px;
}
```

### Pitfall 4: Padding: 0 on Selection Containers
```css
/* WRONG — selection borders get clipped */
.chip-grid {
  padding: 0;  /* No space for borders to extend */
  gap: 8px;
}

/* CORRECT */
.chip-grid {
  padding: var(--space-1) var(--space-2);  /* Space for decoration */
  gap: 8px;
}
```

## Related SOPs & Docs
- [SOP-058: Naive UI Date Picker Styling](SOP-058-naive-ui-date-picker-styling.md) — Similar overflow issues in date picker dropdown
- [SOP-053: Tauri Linux CSS Limitations](SOP-053-tauri-linux-css-limitations.md) — WebKitGTK-specific `-webkit-` property handling
- Design System: `docs/claude-md-extension/design-system.md` — Token usage for spacing/sizing

## Commits & References
- **Initial fix**: QuickSortView pill overflow handling
- **Compact mode**: CategorySelector `-webkit-line-clamp` unset pattern
- **Related BUGs**: None currently; preventative documentation

## Version History
| Date | Change |
|------|--------|
| 2026-03-18 | Created SOP-066 with flex-basis, line-clamp, and padding patterns |
