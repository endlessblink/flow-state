# THE ONE Design System - Pomo-Flow

## Core Principle

**ONE system for everything. No exceptions.**

Every button, card, nav item, and interactive element uses THE SAME design language:
- **Outlined at rest**
- **Vibrant fill on hover/active** (like "Today" button)
- **Dramatic effects** (keep the personality!)
- **Everything codified in tokens**

---

## THE ONE Button System

### Default State: Outlined
```css
background: transparent;
border: 1px solid var(--border-medium);
color: var(--text-secondary);
```

### Hover/Active State: Vibrant Fill
```css
background: var(--state-active-bg);  /* #4f46e5 bright indigo */
border-color: var(--state-active-bg);
color: var(--state-active-text);     /* white */
box-shadow: var(--state-hover-shadow); /* Dramatic! */
```

**Usage:**
- ALL buttons use `BaseButton`
- ALL icon buttons use `BaseIconButton`
- NO custom button styles allowed
- Variants are for semantic meaning only (danger, success)

---

## THE ONE Card System

### At Rest: Solid + Subtle
```css
background: var(--surface-tertiary);  /* #374151 */
border: 1px solid var(--border-subtle);
box-shadow: var(--shadow-sm);
```

### On Hover: Vibrant Fill (Like "Today" Button)
```css
background: var(--state-active-bg);
border-color: var(--state-active-bg);
color: var(--state-active-text);
box-shadow: var(--state-hover-shadow);
```

**Usage:**
- Kanban cards: Use this system
- Canvas cards: Use this system
- All card-like elements: Use this system
- When hovered, text turns white for contrast

---

## THE ONE Active State System

**The "Today" Button Pattern - Used Everywhere:**

```vue
<!-- Active nav item -->
<BaseNavItem :active="true">
  <!-- Gets vibrant indigo fill automatically -->
</BaseNavItem>

<!-- Hovered button -->
<BaseButton>
  <!-- Gets vibrant indigo fill on hover -->
</BaseButton>

<!-- Hovered card -->
<div class="task-card">
  <!-- Gets vibrant indigo fill on hover -->
</div>
```

**Tokens:**
- `--state-active-bg`: #4f46e5 (bright indigo)
- `--state-active-text`: #ffffff (white)
- `--state-hover-shadow`: Dramatic shadow
- `--state-hover-glow`: Optional glow effect

---

## Dramatic Effects (Keep Them!)

### Glassmorphism - Where It Belongs
```css
/* Canvas/special floating elements */
backdrop-filter: blur(16px) saturate(180%);
```

### Shadows - Dramatic But Consistent
```css
/* Rest state */
box-shadow: var(--shadow-sm);

/* Hover state */
box-shadow: var(--state-hover-shadow);

/* Can add glow for extra drama */
box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
```

### Transforms - Personality!
```css
/* Lift on hover */
transform: translateY(-2px);

/* Slide on hover (nav items) */
transform: translateX(4px);

/* Scale on click */
transform: scale(0.98);
```

---

## Unified Color System

### Semantic Colors (Used Consistently)
- **Red** (#ef4444): High priority, danger, delete
- **Orange** (#f59e0b): Medium priority, warnings
- **Blue** (#3b82f6): Low priority, info, navigation
- **Green** (#10b981): Work/active, success, start actions
- **Purple** (#8b5cf6): Focus, meditation
- **Indigo** (#4f46e5): **THE active/hover state color**

### Token Usage (No Hardcoding)
```css
/* ✅ CORRECT */
color: var(--color-work);
background: var(--state-active-bg);

/* ❌ WRONG */
color: #10b981;
background: #4f46e5;
```

---

## Component Adherence

### Base Components (THE foundation)
All components MUST use these - no custom implementations:

1. **BaseButton** - Outlined, dramatic hover
2. **BaseIconButton** - Icon-only version
3. **BaseNavItem** - Sidebar navigation
4. **BaseBadge** - Count badges, status
5. **BaseCard** - Card containers
6. **BaseInput** - Form inputs

### How They Work Together
```vue
<!-- Kanban Card -->
<BaseCard>
  <h3>{{ task.title }}</h3>
  <BaseBadge variant="info">2/4 subtasks</BaseBadge>
  <BaseIconButton variant="success">
    <Play />
  </BaseIconButton>
</BaseCard>

<!-- Hover: Entire card gets vibrant fill -->
<!-- All child elements automatically get white text -->
```

---

## THE Migration Pattern

### Before (Inconsistent)
```vue
<style>
.my-special-button {
  background: linear-gradient(...);
  backdrop-filter: blur(32px);
  /* 50 lines of custom styles */
}
</style>
```

### After (THE ONE system)
```vue
<BaseButton variant="secondary">
  Click Me
</BaseButton>

<!-- Automatically gets:
  - Outlined style at rest
  - Vibrant fill on hover
  - Dramatic shadow
  - Consistent with everything else
-->
```

---

## Verification Checklist

**Is your component cohesive?**

- [ ] Using BaseButton/BaseIconButton? (not custom buttons)
- [ ] Using design tokens? (not hardcoded colors)
- [ ] Hover state uses `var(--state-active-bg)`?
- [ ] Active state uses `var(--state-active-bg)`?
- [ ] Looks like it belongs with "Today" button?
- [ ] Looks like it belongs with kanban cards?
- [ ] Same dramatic personality throughout?

If yes to all → Cohesive ✅
If no to any → Fix it!

---

## Summary

**THE ONE Rule:**
> Outlined at rest, vibrant fill on hover/active, dramatic effects, everything uses tokens.

**No More:**
- Custom button styles
- Hardcoded colors
- Inconsistent hover states
- Different active state patterns

**Only:**
- BaseButton/BaseIconButton
- Design tokens
- Unified vibrant hover/active
- Consistent dramatic effects

---

*ONE system. ONE language. Cohesive.*
