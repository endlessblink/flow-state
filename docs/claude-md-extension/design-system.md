# Design System

## Overview

FlowState uses a comprehensive design token system to ensure visual consistency across all components. **NEVER hardcode CSS values** - always use design tokens.

**Token file:** `src/assets/design-tokens.css` (1,248 lines)

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

## Common Token Reference

### Backgrounds
```css
--overlay-component-bg        /* Dark overlay panels */
--glass-bg-light             /* rgba(255,255,255,0.02) */
--glass-bg-medium            /* rgba(255,255,255,0.04) */
--glass-bg-heavy             /* rgba(255,255,255,0.06) */
```

### Borders
```css
--glass-border               /* rgba(255,255,255,0.10) */
--glass-border-hover         /* rgba(255,255,255,0.15) */
--overlay-component-border   /* Full border declaration */
```

### Spacing (8px Grid)
```css
--space-1 (4px)
--space-1_5 (6px)
--space-2 (8px)
--space-2_5 (10px)
--space-3 (12px)
--space-4 (16px)
--space-5 (20px)
--space-6 (24px)
```

### Typography
```css
--text-xs (12px)
--text-sm (14px)
--text-base (16px)
--text-lg (18px)
--text-xl (20px)
```

### Border Radius
```css
--radius-sm (6px)
--radius-md (8px)
--radius-lg (16px)
--radius-xl (20px)
--radius-full (9999px)
```

### Animation
```css
--duration-fast (150ms)
--duration-normal (200ms)
--duration-slow (300ms)
--ease-out
--ease-in-out
--spring-smooth
```

### Priority Colors
```css
--color-priority-high        /* Red tones */
--color-priority-medium      /* Yellow/Orange tones */
--color-priority-low         /* Blue tones */
--color-priority-none        /* Gray tones */
```

---

## Example: Correct vs Incorrect

```css
/* ❌ WRONG - Hardcoded values */
.menu {
  background: rgba(18, 18, 20, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.15s ease-out;
}

/* ✅ CORRECT - Design tokens */
.menu {
  background: var(--overlay-component-bg);
  border: var(--overlay-component-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-out);
}
```

---

## Tailwind Configuration

Extensive customization in `tailwind.config.js`:
- Custom color palette mapped to design tokens
- Component classes (`.task-base`, `.btn`, etc.)
- Canvas-specific utilities
- GPU acceleration helpers
- RTL support plugin

---

## Glass Morphism Theme

FlowState uses a glass morphism design language:
- Consistent dark/light mode support
- Backdrop filters for modern glass effects
- Smooth transitions between themes
- CSS custom property integration

### Glass Effect Layers
```css
/* Light glass (subtle) */
background: var(--glass-bg-light);
backdrop-filter: blur(8px);

/* Medium glass (standard) */
background: var(--glass-bg-medium);
backdrop-filter: blur(12px);

/* Heavy glass (prominent) */
background: var(--glass-bg-heavy);
backdrop-filter: blur(20px);
```

---

## UI Component Standards

| Component Type | Standard Component | Key Rule |
|----------------|-------------------|----------|
| **Dropdowns** | `CustomSelect.vue` | NEVER use native `<select>` |
| **Context Menus** | `ContextMenu.vue` | NEVER use browser context menus |
| **Modals** | `BaseModal.vue`, `BasePopover.vue` | Dark glass morphism required |

**When user says "fix dropdowns"** → Replace native `<select>` with `CustomSelect` component

---

## Shadow & Glow Handling

See [SOP-004: CSS Shadow/Glow Clipping](../sop/SOP-004-css-shadow-overflow-clipping.md) for handling shadows that get clipped by `overflow: hidden`.

**Quick fix:** Add padding equal to shadow spread to parent container.
