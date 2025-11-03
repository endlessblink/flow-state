# Design Tokens Documentation

## Overview

This document serves as the single source of truth for all design tokens used in the Pomo Flow productivity application. Design tokens are the smallest building blocks of our design system, representing consistent values for colors, typography, spacing, and more.

## Usage

Always import design tokens from the global CSS variables:

```css
/* Use design tokens instead of hardcoded values */
.my-component {
  background: var(--surface-primary); /* ✅ Correct */
  padding: var(--space-4);           /* ✅ Correct */
  /* NOT: background: #ffffff;     /* ❌ Incorrect */
}
```

## Color System

### Primary Colors

| Token | Value | Usage | Example |
|-------|-------|-------|---------|
| `--brand-primary` | `#8b5cf6` | Primary brand color, CTAs | Buttons, links, accents |
| `--brand-hover` | `#7c3aed` | Hover state for primary | Primary button hover |
| `--brand-active` | `#6d28d9` | Active/pressed state | Primary button active |

### Semantic Colors

| Token | Value | Meaning | Usage |
|-------|-------|---------|------|
| `--color-work` | `#22c55e` | Success, completed states | Done tasks, success messages |
| `--color-break` | `#f59e0b` | Warning, attention | Priority medium, warnings |
| `--color-danger` | `#ef4444` | Error, destructive actions | Delete, error states |
| `--color-info` | `#3b82f6` | Information, low priority | Info messages, low priority |

### Surface Colors

| Token | Value | Usage |
|-------|-------|------|
| `--surface-primary` | `#ffffff` | Main backgrounds, cards |
| `--surface-secondary` | `#f8fafc` | Alternative backgrounds |
| `--surface-tertiary` | `#f1f5f9` | Subtle backgrounds, panels |
| `--surface-hover` | `#e2e8f0` | Hover states |
| `--glass-bg-light` | `rgba(255, 255, 255, 0.1)` | Light glass morphism |
| `--glass-bg-medium` | `rgba(255, 255, 255, 0.25)` | Medium glass morphism |
| `--glass-bg-heavy` | `rgba(255, 255, 255, 0.4)` | Heavy glass morphism |

### Text Colors

| Token | Value | Usage |
|-------|-------|------|
| `--text-primary` | `#1e293b` | Primary text, headings |
| `--text-secondary` | `#64748b` | Secondary text, descriptions |
| `--text-muted` | `#94a3b8` | Muted text, captions |
| `--text-subtle` | `#cbd5e1` | Subtle text, placeholders |

### Border Colors

| Token | Value | Usage |
|-------|-------|------|
| `--border-subtle` | `#e2e8f0` | Subtle borders |
| `--border-medium` | `#cbd5e1` | Default borders |
| `--border-strong` | `#94a3b8` | Strong borders |
| `--glass-border` | `rgba(255, 255, 255, 0.2)` | Glass morphism borders |

### Overlay & Background

| Token | Value | Usage |
|-------|-------|------|
| `--overlay-dark` | `rgba(0, 0, 0, 0.6)` | Modal overlays |
| `--overlay-bg` | `rgba(0, 0, 0, 0.5)` | General overlays |

## Typography

### Font Families

```css
--font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Font Sizes

| Token | Size | Usage |
|-------|------|------|
| `--text-xs` | `12px` | Small text, captions |
| `--text-sm` | `14px` | Default text, body |
| `--text-base` | `16px` | Large body text |
| `--text-lg` | `18px` | Large text |
| `--text-xl` | `20px` | Small headings |
| `--text-2xl` | `24px` | Medium headings |
| `--text-3xl` | `30px` | Large headings |
| `--text-4xl` | `36px` | XL headings |
| `--text-5xl` | `48px` | XXL headings |
| `--text-6xl` | `60px` | Hero text |

### Font Weights

| Token | Weight | Usage |
|-------|--------|------|
| `--font-light` | `300` | Light text |
| `--font-normal` | `400` | Default weight |
| `--font-medium` | `500` | Medium emphasis |
| `--font-semibold` | `600` | Emphasized text |
| `--font-bold` | `700` | Strong emphasis |

### Line Heights

| Token | Value | Usage |
|-------|-------|------|
| `--leading-tight` | `1.25` | Compact text |
| `--leading-normal` | `1.5` | Default text |
| `--leading-relaxed` | `1.625` | Relaxed text |

## Spacing

### Scale

The spacing scale follows a consistent 4px base unit:

| Token | Value | Usage |
|-------|-------|------|
| `--space-0` | `0px` | No spacing |
| `--space-1` | `4px` | Micro spacing |
| `--space-2` | `8px` | Small spacing |
| `--space-3` | `12px` | Medium-small spacing |
| `--space-4` | `16px` | Medium spacing |
| `--space-5` | `20px` | Medium-large spacing |
| `--space-6` | `24px` | Large spacing |
| `--space-8` | `32px` | XL spacing |
| `--space-10` | `40px` | XXL spacing |
| `--space-12` | `48px` | XXXL spacing |
| `--space-16` | `64px` | Section spacing |

### Component-Specific Spacing

| Token | Value | Usage |
|-------|-------|------|
| `--btn-sm` | `32px` | Small button height |
| `--btn-md` | `40px` | Medium button height |
| `--btn-lg` | `48px` | Large button height |

## Border Radius

| Token | Value | Usage |
|-------|-------|------|
| `--radius-sm` | `4px` | Small elements |
| `--radius-md` | `8px` | Default radius |
| `--radius-lg` | `12px` | Large radius |
| `--radius-xl` | `16px` | XL radius |
| `--radius-2xl` | `20px` | Modal/panel radius |
| `--radius-full` | `9999px` | Circular elements |

## Shadows

| Token | Value | Usage |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1)` | Default elevation |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.1)` | Large elevation |
| `--shadow-xl` | `0 20px 25px -5px rgba(0, 0, 0, 0.1)` | XL elevation |
| `--shadow-2xl` | `0 25px 50px -12px rgba(0, 0, 0, 0.25)` | Modal/overlay elevation |

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|------|
| `--z-dropdown` | `1000` | Dropdowns |
| `--z-sticky` | `1100` | Sticky headers |
| `--z-modal` | `2000` | Modal overlays |
| `--z-tooltip` | `3000` | Tooltips |

## Animations & Transitions

### Durations

| Token | Value | Usage |
|-------|-------|------|
| `--duration-fast` | `150ms` | Quick transitions |
| `--duration-normal` | `200ms` | Default transitions |
| `--duration-slow` | `300ms` | Slow transitions |

### Spring Easings

| Token | Value | Usage |
|-------|-------|------|
| `--spring-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Smooth easing |
| `--spring-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Bouncy easing |
| `--spring-gentle` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Gentle easing |

## Interactive States

### Hover State Tokens

| Token | Value | Usage |
|-------|-------|------|
| `--state-hover-bg` | `var(--glass-bg-medium)` | Hover background |
| `--state-hover-border` | `var(--border-strong)` | Hover border |
| `--state-hover-shadow` | `0 4px 12px rgba(0, 0, 0, 0.15)` | Hover shadow |
| `--state-hover-glow` | `0 0 20px rgba(139, 92, 246, 0.3)` | Hover glow |

### Active State Tokens

| Token | Value | Usage |
|-------|-------|------|
| `--state-active-bg` | `var(--glass-bg-heavy)` | Active background |
| `--state-active-border` | `var(--brand-primary)` | Active border |
| `--state-active-glass` | `blur(16px) saturate(180%)` | Active glass effect |

### Focus State Tokens

| Token | Value | Usage |
|-------|-------|------|
| `--state-focus-ring` | `0 0 0 3px rgba(139, 92, 246, 0.3)` | Focus ring |

## Component-Specific Tokens

### Calendar

| Token | Value | Usage |
|-------|-------|------|
| `--calendar-today-badge-start` | `var(--brand-primary)` | Today badge start |
| `--calendar-today-badge-end` | `var(--brand-hover)` | Today badge end |
| `--calendar-creating-bg` | `rgba(139, 92, 246, 0.1)` | Creating state background |
| `--calendar-creating-border` | `var(--brand-primary)` | Creating state border |

### Priority Colors

| Token | Value | Usage |
|-------|-------|------|
| `--color-priority-low` | `var(--color-info)` | Low priority |
| `--color-priority-medium` | `var(--color-break)` | Medium priority |
| `--color-priority-high` | `var(--color-danger)` | High priority |

### Danger/Warning Variants

| Token | Value | Usage |
|-------|-------|------|
| `--danger-bg-subtle` | `rgba(239, 68, 68, 0.1)` | Danger background |
| `--danger-bg-light` | `rgba(239, 68, 68, 0.2)` | Light danger background |
| `--danger-bg-medium` | `rgba(239, 68, 68, 0.3)` | Medium danger background |
| `--danger-border-subtle` | `rgba(239, 68, 68, 0.3)` | Subtle danger border |
| `--danger-border-medium` | `rgba(239, 68, 68, 0.5)` | Medium danger border |
| `--danger-border-hover` | `rgba(239, 68, 68, 0.7)` | Hover danger border |

### Purple/Brand Variants

| Token | Value | Usage |
|-------|-------|------|
| `--purple-bg-subtle` | `rgba(139, 92, 246, 0.1)` | Purple background |
| `--purple-bg-start` | `rgba(139, 92, 246, 0.2)` | Purple gradient start |
| `--purple-bg-end` | `rgba(139, 92, 246, 0.3)` | Purple gradient end |
| `--purple-border-subtle` | `rgba(139, 92, 246, 0.3)` | Subtle purple border |
| `--purple-border-medium` | `rgba(139, 92, 246, 0.5)` | Medium purple border |
| `--purple-border-light` | `rgba(139, 92, 246, 0.2)` | Light purple border |
| `--purple-glow-subtle` | `0 0 10px rgba(139, 92, 246, 0.3)` | Subtle purple glow |
| `--purple-glow-medium` | `0 0 20px rgba(139, 92, 246, 0.4)` | Medium purple glow |

## Dark Mode Tokens

### Surface Colors (Dark)

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--surface-primary` | `#ffffff` | `#1e293b` |
| `--surface-secondary` | `#f8fafc` | `#334155` |
| `--surface-tertiary` | `#f1f5f9` | `#475569` |

### Text Colors (Dark)

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--text-primary` | `#1e293b` | `#f1f5f9` |
| `--text-secondary` | `#64748b` | `#cbd5e1` |
| `--text-muted` | `#94a3b8` | `#94a3b8` |

### Glass Effects (Dark)

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--glass-bg-light` | `rgba(255, 255, 255, 0.1)` | `rgba(30, 41, 59, 0.6)` |
| `--glass-bg-medium` | `rgba(255, 255, 255, 0.25)` | `rgba(30, 41, 59, 0.8)` |
| `--glass-bg-heavy` | `rgba(255, 255, 255, 0.4)` | `rgba(30, 41, 59, 0.95)` |

## Implementation Guidelines

### 1. Always Use Design Tokens

```css
/* ✅ Correct */
.button {
  background: var(--brand-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
}

/* ❌ Incorrect */
.button {
  background: #8b5cf6;
  padding: 12px 16px;
  border-radius: 12px;
}
```

### 2. Follow Semantic Naming

Use semantic tokens for colors rather than literal color values:

```css
/* ✅ Correct */
.status-success {
  color: var(--color-work);
}

/* ❌ Incorrect */
.status-success {
  color: #22c55e;
}
```

### 3. Maintain Consistent Spacing

Use the spacing scale consistently:

```css
/* ✅ Correct */
.card {
  padding: var(--space-6);
  gap: var(--space-4);
}

/* ❌ Incorrect */
.card {
  padding: 25px;
  gap: 15px;
}
```

### 4. Use Appropriate Shadow Levels

Follow the shadow hierarchy:

```css
/* ✅ Correct */
.button:hover {
  box-shadow: var(--shadow-md);
}

.modal {
  box-shadow: var(--shadow-2xl);
}

/* ❌ Incorrect */
.button:hover {
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}
```

## Adding New Tokens

When adding new design tokens:

1. **Check existing tokens first** - Don't duplicate existing values
2. **Follow naming conventions** - Use semantic, descriptive names
3. **Document thoroughly** - Add usage examples and context
4. **Test in both themes** - Ensure tokens work in light and dark modes
5. **Update this document** - Keep the documentation in sync

## Token Categories

### Functional Tokens
- **Colors**: `--color-*` - Semantic colors for specific purposes
- **Surface**: `--surface-*` - Background colors for UI surfaces
- **Text**: `--text-*` - Text colors with semantic meaning

### Utility Tokens
- **Spacing**: `--space-*` - Consistent spacing values
- **Typography**: `--text-*`, `--font-*`, `--leading-*` - Text styling
- **Border**: `--border-*`, `--radius-*` - Border styling
- **Shadow**: `--shadow-*` - Elevation and depth

### Component Tokens
- **Button**: `--btn-*` - Button-specific sizing
- **Modal**: `--modal-*` - Modal-specific styling
- **State**: `--state-*` - Interactive state styling

This documentation should be kept up-to-date as the design system evolves. All designers and developers should reference this document when working on the Pomo Flow application.