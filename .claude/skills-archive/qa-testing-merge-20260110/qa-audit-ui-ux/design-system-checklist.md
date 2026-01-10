# Design System Compliance Checklist

## Overview

This document provides detailed checklists for ensuring all components comply with the Pomo-Flow design token system defined in `src/assets/design-tokens.css`.

## Token Tier System

### Tier 1: Base Palette (HSL Values)
**Purpose:** Raw color values - should NEVER be used directly in components

```css
/* ❌ NEVER use base palette directly */
.component {
  background: hsl(var(--gray-900));
  color: hsl(var(--blue-500));
}

/* ✅ ALWAYS use semantic tokens instead */
.component {
  background: var(--surface-secondary);
  color: var(--brand-primary);
}
```

**Base Palette Tokens (Reference Only):**
- `--gray-950` through `--gray-50` - Grayscale
- `--blue-500`, `--blue-400` - Brand blue
- `--green-500` - Success green
- `--red-500` - Error red
- `--yellow-500` - Warning yellow
- `--purple-500` - Accent purple

### Tier 2: Semantic Tokens (Use These!)
**Purpose:** Theme-aware, context-appropriate tokens

#### Surface Tokens (Backgrounds)
```css
--surface-primary      /* Main background (darkest) */
--surface-secondary    /* Card backgrounds */
--surface-tertiary     /* Elevated elements */
--surface-elevated     /* Highest elevation */
--surface-hover        /* Hover state background */
--surface-active       /* Active/pressed background */
```

**Usage Example:**
```vue
<div class="bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]">
  Card content
</div>
```

#### Text Tokens
```css
--text-primary    /* Main text content */
--text-secondary  /* Secondary text */
--text-tertiary   /* Between secondary and muted */
--text-muted      /* De-emphasized text */
--text-subtle     /* Very subtle text */
--text-disabled   /* Disabled state text */
```

**Usage Example:**
```vue
<h2 class="text-[var(--text-primary)]">{{ title }}</h2>
<p class="text-[var(--text-secondary)]">{{ description }}</p>
<span class="text-[var(--text-muted)]">{{ metadata }}</span>
```

#### Border Tokens
```css
--border-subtle       /* Very subtle borders */
--border-medium       /* Standard borders */
--border-strong       /* Prominent borders */
--border-interactive  /* Interactive element borders */
--border-primary      /* Primary border color */
--border-secondary    /* Secondary borders */
--border-hover        /* Border on hover */
```

**Usage Example:**
```vue
<div class="border border-[var(--border-subtle)] hover:border-[var(--border-hover)]">
  Bordered container
</div>
```

#### Brand Colors
```css
--brand-primary   /* Primary brand color */
--brand-hover     /* Brand color on hover */
--brand-active    /* Brand color when active */
```

### Tier 3: Functional Colors (Context-Specific)
**Purpose:** Specific UI contexts (Pomodoro, priority, calendar)

#### Pomodoro States
```css
--color-work      /* Active work session (green) */
--color-break     /* Break period (orange) */
--color-focus     /* Deep focus (purple) */
--color-navigation /* Navigation elements (blue) */
--color-neutral   /* Secondary elements (gray) */
```

#### Priority System
```css
--color-priority-high    /* Urgent tasks (red) */
--color-priority-medium  /* Default priority (orange) */
--color-priority-low     /* Low urgency (blue) */

/* Priority backgrounds for calendar */
--priority-high-bg
--priority-medium-bg
--priority-low-bg

/* Priority glows */
--priority-high-glow
--priority-medium-glow
--priority-low-glow
```

#### Interactive States
```css
/* Active state (green themed) */
--state-active-border
--state-active-bg
--state-active-glass
--state-active-text

/* Hover state (green themed) */
--state-hover-border
--state-hover-bg
--state-hover-shadow
--state-hover-glow

/* Selection state (blue themed) */
--state-selected-bg
--state-selected-border
--state-selected-shadow
--state-selected-glow
```

#### Calendar-Specific
```css
/* Purple - Calendar UI elements */
--calendar-hover-bg
--calendar-creating-bg
--calendar-ghost-bg-start
--calendar-today-bg-start
--calendar-today-badge-start

/* Green - Current time indicator */
--calendar-current-time-bg-start
--calendar-current-time-border

/* Amber - Timer active */
--timer-active-bg-start
--timer-active-border
--timer-glow-subtle
```

#### Status Indicators
```css
/* Success states (green) */
--success-bg-start
--success-bg-subtle
--success-border
--success-glow

/* Danger states (red) */
--danger-bg-subtle
--danger-border-subtle
--danger-gradient-start

/* Info states (blue) */
--blue-bg-subtle
--blue-border-medium

/* Warning states (orange) */
--orange-bg-subtle
--orange-bg-light
```

## Spacing System (8px Grid)

### Spacing Scale
```css
--space-0: 0
--space-1: 0.25rem   /* 4px - Micro spacing */
--space-2: 0.5rem    /* 8px - Tight spacing */
--space-3: 0.75rem   /* 12px - Small gaps */
--space-4: 1rem      /* 16px - Standard gaps */
--space-5: 1.25rem   /* 20px - Medium gaps */
--space-6: 1.5rem    /* 24px - Large gaps */
--space-8: 2rem      /* 32px - Section spacing */
--space-10: 2.5rem   /* 40px - XL spacing */
--space-12: 3rem     /* 48px - XXL spacing */
--space-16: 4rem     /* 64px - Section breaks */
```

### Spacing Audit Checklist
- [ ] All padding values use spacing tokens or Tailwind classes
- [ ] All margin values use spacing tokens or Tailwind classes
- [ ] Gap values follow 8px grid (gap-2, gap-4, gap-6)
- [ ] No random spacing values (e.g., 13px, 17px, 25px)
- [ ] Consistent spacing within component types (all buttons same padding)

### Common Spacing Patterns
```vue
<!-- ✅ Good: Consistent spacing using tokens -->
<div class="p-4 space-y-3">
  <div class="flex items-center gap-2">
    <Icon class="w-5 h-5" />
    <span>Content</span>
  </div>
</div>

<!-- ❌ Bad: Random spacing values -->
<div style="padding: 17px">
  <div style="display: flex; gap: 13px">
    <Icon style="width: 22px" />
    <span>Content</span>
  </div>
</div>
```

## Typography System

### Type Scale
```css
--text-xs: 0.75rem    /* 12px - Metadata, labels */
--text-sm: 0.875rem   /* 14px - UI text, buttons */
--text-base: 1rem     /* 16px - Body text */
--text-lg: 1.125rem   /* 18px - Section headers */
--text-xl: 1.25rem    /* 20px - Page titles */
--text-2xl: 1.5rem    /* 24px - Display text */
--text-3xl: 1.875rem  /* 30px - Hero text */
```

### Font Weights
```css
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Line Heights
```css
--leading-none: 1
--leading-tight: 1.25
--leading-snug: 1.375
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-loose: 2
```

### Typography Audit Checklist
- [ ] Font sizes use type scale tokens or Tailwind classes (text-sm, text-base, text-lg)
- [ ] Font weights use design tokens (--font-medium, --font-semibold)
- [ ] Line heights use design tokens or Tailwind classes (leading-tight, leading-normal)
- [ ] Headings follow hierarchy (h1 → h2 → h3, no skipping)
- [ ] No hardcoded font-size or line-height pixel values

### Typography Patterns
```vue
<!-- ✅ Good: Using type scale consistently -->
<template>
  <article>
    <h2 class="text-xl font-semibold text-[var(--text-primary)]">
      {{ title }}
    </h2>
    <p class="text-sm leading-relaxed text-[var(--text-secondary)]">
      {{ description }}
    </p>
    <span class="text-xs text-[var(--text-muted)]">
      {{ metadata }}
    </span>
  </article>
</template>

<!-- ❌ Bad: Hardcoded typography -->
<template>
  <article>
    <h2 style="font-size: 22px; font-weight: 600;">
      {{ title }}
    </h2>
    <p style="font-size: 15px; line-height: 1.6;">
      {{ description }}
    </p>
  </article>
</template>
```

## Border Radius System

### Radius Scale
```css
--radius-none: 0
--radius-xs: 2px
--radius-sm: 0.375rem   /* 6px - Tight corners */
--radius-md: 0.5rem     /* 8px - Standard */
--radius-lg: 1rem       /* 16px - Large */
--radius-xl: 1.25rem    /* 20px - Extra large */
--radius-2xl: 1.5rem    /* 24px - XXL */
--radius-full: 9999px   /* Pill shape */
```

### Border Radius Audit Checklist
- [ ] Border radius uses design tokens or Tailwind classes (rounded-sm, rounded-md)
- [ ] Consistent rounding for component types (all buttons same radius)
- [ ] No random border-radius values
- [ ] Proper use of rounded-full for circular elements

### Border Radius Patterns
```vue
<!-- ✅ Good: Consistent border radius -->
<button class="rounded-md">Standard Button</button>
<div class="rounded-lg">Card Container</div>
<div class="rounded-full">Avatar</div>

<!-- ❌ Bad: Random border radius -->
<button style="border-radius: 7px">Button</button>
<div style="border-radius: 13px">Card</div>
```

## Shadow & Elevation System

### Shadow Scale
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.08)
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.10)
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12)
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.15)
--shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.18)
--shadow-2xl: 0 16px 32px rgba(0, 0, 0, 0.20)

/* Dark theme shadows */
--shadow-dark-sm: 0 2px 4px rgba(0, 0, 0, 0.25)
--shadow-dark-md: 0 4px 8px rgba(0, 0, 0, 0.30)
--shadow-dark-lg: 0 8px 16px rgba(0, 0, 0, 0.35)

/* Glass effect shadow */
--shadow-glass: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)
```

### Shadow Audit Checklist
- [ ] Shadows use design token scale (--shadow-sm, --shadow-md, etc.)
- [ ] Elevation hierarchy is logical (lower elements = lighter shadows)
- [ ] Glass effects use --shadow-glass
- [ ] No hardcoded box-shadow values outside token system

### Shadow Usage Patterns
```vue
<!-- ✅ Good: Using shadow tokens -->
<div class="shadow-[var(--shadow-md)]">Card</div>
<div class="hover:shadow-[var(--shadow-lg)]">Hover Card</div>

<!-- ❌ Bad: Hardcoded shadows -->
<div style="box-shadow: 0 3px 7px rgba(0,0,0,0.13)">Card</div>
```

## Glass Morphism System

### Glass Background Opacities
```css
--glass-bg-subtle: rgba(255, 255, 255, 0.01)
--glass-bg-weak: rgba(255, 255, 255, 0.02)
--glass-bg-light: rgba(255, 255, 255, 0.03)
--glass-bg-tint: rgba(255, 255, 255, 0.04)
--glass-bg-medium: rgba(255, 255, 255, 0.05)
--glass-bg-soft: rgba(255, 255, 255, 0.06)
--glass-bg-heavy: rgba(255, 255, 255, 0.08)
```

### Glass Borders
```css
--glass-border: rgba(255, 255, 255, 0.10)
--glass-border-light: rgba(255, 255, 255, 0.06)
--glass-border-medium: rgba(255, 255, 255, 0.16)
--glass-border-strong: rgba(255, 255, 255, 0.28)
--glass-border-hover: rgba(255, 255, 255, 0.15)
```

### Blur Effects
```css
--blur-sm: 10px
--blur-md: 16px
--blur-lg: 24px
--blur-xl: 32px
```

### Glass Effect Audit Checklist
- [ ] Glass backgrounds use defined opacity values
- [ ] Backdrop filters use blur tokens (--blur-md, --blur-lg)
- [ ] Glass borders consistent across similar components
- [ ] Fallback for browsers without backdrop-filter support

### Glass Effect Pattern
```vue
<!-- ✅ Good: Using glass utility class -->
<div class="glass-card">
  Glass morphism card
</div>

<!-- OR using custom glass with tokens -->
<div
  class="bg-[var(--glass-bg-light)] border border-[var(--glass-border)]"
  style="backdrop-filter: blur(var(--blur-md))"
>
  Custom glass effect
</div>

<!-- ❌ Bad: Hardcoded glass effect -->
<div
  style="
    background: rgba(255,255,255,0.07);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.12);
  "
>
  Hardcoded glass
</div>
```

## Animation & Transition System

### Duration Scale
```css
--duration-instant: 50ms
--duration-fast: 150ms
--duration-normal: 200ms
--duration-slow: 300ms
--duration-slower: 500ms
```

### Easing Curves
```css
--spring-smooth: cubic-bezier(0.4, 0, 0.2, 1)
--spring-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)
--spring-swift: cubic-bezier(0.25, 0.46, 0.45, 0.94)
--spring-gentle: cubic-bezier(0.16, 1, 0.3, 1)

/* Legacy aliases */
--ease-linear: linear
--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
```

### Animation Audit Checklist
- [ ] Transition durations use design tokens
- [ ] Easing curves use defined spring functions
- [ ] Similar animations have consistent timing
- [ ] Respects `prefers-reduced-motion` media query
- [ ] GPU-accelerated properties (transform, opacity)

### Animation Patterns
```vue
<!-- ✅ Good: Using animation tokens -->
<template>
  <button
    class="
      transform transition-all
      hover:-translate-y-0.5
    "
    :style="{
      transitionDuration: 'var(--duration-normal)',
      transitionTimingFunction: 'var(--spring-smooth)'
    }"
  >
    Animated Button
  </button>
</template>

<!-- ❌ Bad: Hardcoded animation values -->
<template>
  <button
    style="transition: all 0.25s cubic-bezier(0.4,0,0.2,1)"
  >
    Button
  </button>
</template>
```

## Z-Index System

### Z-Index Layers
```css
--z-base: 0
--z-dropdown: 1000
--z-sticky: 1100
--z-overlay: 1200
--z-modal: 1300
--z-popover: 1400
--z-tooltip: 1500
```

### Z-Index Audit Checklist
- [ ] Z-index values use design tokens
- [ ] Stacking order matches layer hierarchy
- [ ] No random z-index values (e.g., 999, 9999)
- [ ] Modals appear above dropdowns
- [ ] Tooltips appear above everything

### Z-Index Pattern
```vue
<!-- ✅ Good: Using z-index tokens -->
<div class="z-[var(--z-modal)]">Modal</div>
<div class="z-[var(--z-dropdown)]">Dropdown</div>

<!-- ❌ Bad: Random z-index -->
<div style="z-index: 9999">Modal</div>
```

## Quick Audit Commands

### Scan for Violations
```bash
# Find hardcoded colors
grep -rn "color: #\|background: #" src/components --include="*.vue"

# Find hardcoded spacing
grep -rn "padding: [0-9]\|margin: [0-9]" src/components --include="*.vue" | grep -v "var(--"

# Find hardcoded font sizes
grep -rn "font-size: [0-9]" src/components --include="*.vue" | grep -v "var(--"

# Find hardcoded shadows
grep -rn "box-shadow:" src/components --include="*.vue" | grep -v "var(--shadow-"

# Find hardcoded transitions
grep -rn "transition:" src/components --include="*.vue" | grep -v "var(--duration-\|var(--spring-"
```

### Compliance Scoring
```bash
# Total components
total_components=$(find src/components -name "*.vue" | wc -l)

# Components with violations
violations=$(grep -rl "color: #\|background: #" src/components --include="*.vue" | wc -l)

# Calculate compliance percentage
compliance=$(( (total_components - violations) * 100 / total_components ))
echo "Design Token Compliance: ${compliance}%"
```

## Action Items for Non-Compliant Components

### Step 1: Identify Violations
Run automated scans to find specific violations

### Step 2: Replace with Tokens
```vue
<!-- Before -->
<div style="background: #1e293b; color: #f1f5f9; padding: 16px">

<!-- After -->
<div
  class="bg-[var(--surface-secondary)] text-[var(--text-primary)] p-4"
>
```

### Step 3: Test Visual Consistency
- Verify component looks the same with tokens
- Check in both light and dark themes
- Test hover/focus/active states

### Step 4: Document Patterns
- Add to component-patterns.md if new pattern
- Update design system documentation
- Share pattern with team

---

**Last Updated:** October 23, 2025
**Design System Version:** 1.0.0
