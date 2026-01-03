# SOP: Glassmorphism & CSS Debugging Guide

**Category**: STYLING
**Status**: Active Reference
**Last Updated**: January 2026
**Merged From**: glassmorphism-debugging.md, glassmorphism_debug.md, storybook-glass-debugging-2025-12-23.md

---

## Overview

This guide consolidates all glassmorphism and CSS debugging knowledge for the Pomo-Flow application. Use this when debugging persistent backgrounds, visibility issues, or Storybook styling problems.

---

## 1. Problem Identification

### Common Symptoms

| Symptom | Likely Cause |
|---------|--------------|
| Persistent gray background despite `transparent` | Parent wrapper has background |
| Glass effect looks muddy/dark | Double-glazing (blur on both parent and child) |
| Component invisible in Storybook | Missing background context or wrong tokens |
| Dropdowns/menus clipped | `overflow: hidden` on glass panel |
| Text unreadable | Wrong opacity on glass background |

### The Render Stack Check

**Always check the full component hierarchy**, not just the target file:

```
Example: InboxPanel.vue was clean, but UnifiedInboxPanel.vue (wrapper) had a background.
```

---

## 2. Debugging Procedure

### Step 1: Identify the Ghost Color

If you see a specific color (e.g., dark gray `rgba(20, 20, 20, 0.31)`):

```bash
# Search codebase for the RGB value
grep -r "20, 20, 20" src/
grep -r "rgba(30, 30, 46" src/
```

This often reveals global design tokens in `design-tokens.css` or one-off overrides.

### Step 2: Check Wrapper Leakage

Wrappers often apply container styles that override child transparency:

- Check parent components for `background` properties
- Look for `:deep()` selectors in parent views
- Verify `z-index` stacking contexts

### Step 3: Verify Token Values

Check `src/assets/design-tokens.css`:

```css
/* Glass effects should have LOW alpha (0.05-0.15) */
--overlay-component-bg: rgba(30, 30, 46, 0.85);  /* Standard */
--overlay-component-bg-lighter: rgba(30, 30, 46, 0.6);  /* Lighter variant */
```

### Step 4: Check Z-Index & Overflow

Glassmorphism creates new stacking contexts via `backdrop-filter`:

```css
/* Risk: dropdowns clipped if parent has overflow: hidden */
.glass-panel {
  backdrop-filter: blur(20px);  /* Creates stacking context */
  overflow: visible;  /* Required for dropdown children */
}
```

---

## 3. Common Pitfalls

### Double Glazing

**Problem**: Applying blur on both parent AND child creates muddy appearance.

**Rule**: Only the floating panel should have the glass effect. The underlying container should be transparent or use the global gradient.

### CSS Specificity Issues

```css
/* Lower specificity */
.time-slot:hover .resize-handle { ... }  /* 0,2,0 = 20 */

/* Higher specificity wins */
.slot-task.is-primary:hover .resize-handle { ... }  /* 0,4,0 = 40 */
```

### Scrollbar Clipping

`overflow: auto` on glass panels can cut off absolute-positioned children (dropdowns, tooltips).

**Fix**: Use `overflow: visible` or `teleport` for dropdown content.

---

## 4. Storybook-Specific Issues

### Invisible Components

Ensure story has a background that highlights glass effect:

```typescript
parameters: {
  backgrounds: {
    default: 'dark-glass-context',
    values: [{ name: 'dark-glass-context', value: '#1a1b2e' }]
  }
}
```

### Fixed-Position Elements Clipped

Use the "Scale Transform" hack for modals/context menus:

```typescript
decorators: [
  (story) => ({
    components: { story },
    template: `
      <div style="transform: scale(1); height: 100vh; width: 100vw; position: relative; background: linear-gradient(45deg, #2c3e50, #000000);">
        <story />
      </div>
    `
  })
],
parameters: {
  layout: 'fullscreen'  // CRITICAL: Use fullscreen, not centered
}
```

---

## 5. Design Token Reference

| Hardcoded Value | Design Token |
|-----------------|--------------|
| `rgba(30, 30, 46, 0.85)` | `var(--overlay-component-bg)` |
| `rgba(30, 30, 46, 0.6)` | `var(--overlay-component-bg-lighter)` |
| `blur(20px)` | `var(--overlay-component-backdrop)` |
| `1px solid rgba(255...0.1)` | `var(--overlay-component-border)` |
| `rgba(0, 0, 0, 0.5)` (overlay) | `var(--overlay-bg)` |

---

## 6. Solution Strategy

### The "User Control" Fix

Instead of hardcoding opacity, use semantic tokens:

1. **Create Token**: Define specific tokens for problematic attributes
   ```css
   --inbox-panel-opacity: 0.6;
   ```

2. **Apply to All Variants**: Ensure Canvas, Calendar, Mobile use same token

3. **Validate**: Change token value and verify it propagates everywhere

---

## 7. Verification Checklist

- [ ] Storybook match: Isolated component looks identical to app integration
- [ ] Background awareness: Global gradient shows through
- [ ] No inline styles: All `style="..."` attributes removed
- [ ] Token usage: All colors use `var(--...)`
- [ ] No hardcoded rgba values in component styles

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `src/assets/design-tokens.css` | CSS custom properties |
| `src/assets/styles.css` | Tailwind directives |
| `src/components/canvas/InboxPanel.vue` | Canvas inbox |
| `src/components/canvas/UnifiedInboxPanel.vue` | Inbox wrapper |

---

**Key Insight**: The most common cause of persistent backgrounds is wrapper components, not the target component itself. Always trace the full render hierarchy.
