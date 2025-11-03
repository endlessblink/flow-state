# Design Rules - Pomo-Flow Cohesive Design System

## Core Principle
**CONSTRAINT CREATES COHESION**

This design system creates visual cohesion through strict constraints and systematic application of design tokens. Every element should feel like it belongs to the same family.

---

## Visual Language (From Screenshots)

### Aesthetic: **Refined, Subtle, Professional**
- NOT flashy or over-designed
- Clean navy backgrounds
- Subtle shadows and borders
- Good breathing room
- Consistent visual rhythm

---

## Token Hierarchy

```
TIER 1: Base Palette (HSL values)
  ↓
TIER 2: Semantic Tokens (theme-aware)
  ↓
TIER 3: Component Tokens (component-specific)
```

**RULE:** Never skip levels. Components use Tier 3 or Tier 2, never Tier 1 directly.

---

## Component Usage Rules

### 🚫 NEVER Create Custom Styles For:

1. **Buttons** - ALWAYS use `BaseButton` or `BaseIconButton`
2. **Inputs** - ALWAYS use `BaseInput`
3. **Cards** - ALWAYS use `BaseCard`
4. **Badges** - ALWAYS use `BaseBadge`
5. **Navigation Items** - ALWAYS use `BaseNavItem`

### ✅ Base Component Variants

#### BaseButton
```vue
<BaseButton variant="primary">   <!-- Brand color, main actions -->
<BaseButton variant="secondary"> <!-- Default, most actions -->
<BaseButton variant="ghost">     <!-- Minimal, subtle actions -->
<BaseButton variant="danger">    <!-- Destructive actions -->

Sizes: sm | md | lg
```

#### BaseIconButton
```vue
<BaseIconButton variant="default">  <!-- Neutral actions -->
<BaseIconButton variant="success">  <!-- Start timer, positive -->
<BaseIconButton variant="warning">  <!-- Break, attention -->
<BaseIconButton variant="danger">   <!-- Delete, destructive -->

Sizes: sm (28px) | md (32px) | lg (40px)
```

#### BaseBadge
```vue
<BaseBadge variant="count">    <!-- Sidebar count badges -->
<BaseBadge variant="info">     <!-- Subtask counts -->
<BaseBadge variant="success">  <!-- Completed states -->
<BaseBadge variant="warning">  <!-- In-progress states -->
<BaseBadge variant="danger">   <!-- Urgent/high priority -->

Sizes: sm | md | lg
```

#### BaseNavItem
```vue
<BaseNavItem                    <!-- Sidebar navigation -->
  :active="boolean"
  :count="number"
  :color-dot="string"
  :has-children="boolean"
  :expanded="boolean"
  nested
>
  <template #icon>
    <IconComponent />
  </template>
  Label Text
</BaseNavItem>
```

---

## Spacing Rules

### ⚖️ 8px Grid System (Strict Enforcement)

**RULE:** Only use spacing tokens. Never hardcode rem/px values.

```css
/* ✅ CORRECT */
padding: var(--space-4);
gap: var(--space-3);
margin-bottom: var(--space-6);

/* ❌ INCORRECT */
padding: 1.2rem;
gap: 14px;
margin-bottom: 1.75rem;
```

### Spacing Scale
- `--space-1` (4px) - Micro spacing, tight gaps
- `--space-2` (8px) - Standard small gaps
- `--space-3` (12px) - Medium gaps
- `--space-4` (16px) - Standard padding
- `--space-6` (24px) - Section spacing
- `--space-8` (32px) - Large section breaks

### Common Patterns
- **Button padding**: `var(--space-3) var(--space-4)` (12px 16px)
- **Card padding**: `var(--space-4)` to `var(--space-6)` (16-24px)
- **Element gaps**: `var(--space-2)` to `var(--space-3)` (8-12px)
- **Section spacing**: `var(--space-8)` (32px)

---

## Typography Rules

### 📝 Type Scale (Strict Hierarchy)

**RULE:** Only use defined text sizes. Never use arbitrary font-size values.

```css
/* ✅ CORRECT */
font-size: var(--text-sm);
font-weight: var(--font-semibold);

/* ❌ INCORRECT */
font-size: 0.9375rem;
font-weight: 550;
```

### Typography Hierarchy
- **Page Titles**: `var(--text-xl)` + `var(--font-semibold)`
- **Section Headers**: `var(--text-lg)` + `var(--font-semibold)`
- **Body Text**: `var(--text-base)` + `var(--font-medium)`
- **UI Elements**: `var(--text-sm)` + `var(--font-medium)`
- **Metadata/Labels**: `var(--text-xs)` + `var(--font-medium)`

### Font Weight Scale
- `--font-normal` (400) - Body text, descriptions
- `--font-medium` (500) - UI elements, labels
- `--font-semibold` (600) - Headers, emphasis
- `--font-bold` (700) - Rare, special emphasis

---

## Color Rules

### 🎨 Semantic Color Application

**RULE:** Colors have meaning. Use them consistently.

#### Functional Colors
- **Green** (`--color-work`): Active work, productivity, start actions
- **Orange** (`--color-break`): Breaks, warnings, attention needed
- **Purple** (`--color-focus`): Deep work, meditation, focus mode
- **Blue** (`--color-navigation`): Links, navigation, information
- **Red** (`--color-danger`): Delete, urgent, destructive actions

#### Priority System
- **High Priority**: Red (`--color-priority-high`)
- **Medium Priority**: Orange (`--color-priority-medium`)
- **Low Priority**: Blue (`--color-priority-low`)

#### Text Colors (Follow Hierarchy)
```css
/* Most important */
color: var(--text-primary);

/* Important */
color: var(--text-secondary);

/* Less important */
color: var(--text-muted);

/* Least important, metadata */
color: var(--text-subtle);
```

### 🚫 Color Anti-Patterns

**NEVER:**
- Use hardcoded hex colors (`#ffffff`, `#6b7280`)
- Mix semantic meanings (don't use green for danger)
- Use colors without purpose
- Create custom color values

**ALWAYS:**
- Use design tokens
- Respect semantic meanings
- Apply colors systematically

---

## Shadow & Elevation Rules

### 📐 3-Level Elevation System

**RULE:** Keep depth simple. Only 3 levels.

1. **Subtle** - `var(--shadow-sm)` - Cards at rest
2. **Medium** - `var(--shadow-md)` - Hover states, modals
3. **Elevated** - `var(--shadow-lg)` - Dropdowns, popovers

### Shadow Application
```css
/* ✅ CORRECT - Using token */
box-shadow: var(--shadow-md);

/* ❌ INCORRECT - Custom shadow */
box-shadow: 0 15px 30px rgba(0, 0, 0, 0.18);
```

---

## Glass Effect Rules

### 💎 Use Glass Effects SPARINGLY

**RULE:** Glass is accent, not the foundation.

**Where to use glass:**
- Special emphasis cards (use `<BaseCard glass>`)
- Floating elements over complex backgrounds
- Optional visual enhancement

**Where NOT to use glass:**
- Main backgrounds
- Standard buttons
- Regular navigation items
- Most UI elements

### Glass Application
```vue
<!-- ✅ Special emphasis -->
<BaseCard glass hoverable>
  Featured content
</BaseCard>

<!-- ❌ Overuse -->
<div class="everything-is-glass">...</div>
```

---

## Border Radius Rules

### 🔲 Consistent Corners

**RULE:** Use defined radius values only.

```css
/* Interface elements */
border-radius: var(--radius-md);  /* 6px - buttons, inputs */
border-radius: var(--radius-lg);  /* 8px - cards, larger elements */
border-radius: var(--radius-xl);  /* 12px - modals, special elements */

/* Small elements */
border-radius: var(--radius-sm);  /* 4px - badges, chips */

/* Pills/circular */
border-radius: var(--radius-full); /* Fully rounded */
```

---

## Animation Rules

### ⚡ Motion Consistency

**RULE:** Use defined easing curves and durations.

```css
/* ✅ CORRECT */
transition: all var(--duration-fast) var(--spring-smooth);

/* ❌ INCORRECT */
transition: all 250ms cubic-bezier(0.3, 0.2, 0.1, 0.9);
```

### Easing Curves
- `--spring-smooth` - Default for most interactions
- `--spring-bounce` - Playful, expandable elements
- `--spring-swift` - Quick, decisive actions
- `--spring-gentle` - Smooth, elegant transitions

### Durations
- `--duration-fast` (150ms) - Quick interactions, hovers
- `--duration-normal` (200ms) - Standard transitions
- `--duration-slow` (300ms) - Emphasis, important changes

---

## Layout Rules

### 📏 Consistent Patterns

**Flex Gap Usage:**
```css
/* ✅ Consistent gaps */
gap: var(--space-2);  /* Tight - 8px */
gap: var(--space-3);  /* Normal - 12px */
gap: var(--space-4);  /* Loose - 16px */
```

**Grid Gaps:**
```css
/* Kanban columns */
grid-template-columns: repeat(4, 1fr);
gap: var(--space-4); /* 16px between columns */
```

---

## Migration Checklist

When refactoring a component:

- [ ] Replace all hardcoded colors with tokens
- [ ] Replace all hardcoded spacing with `--space-*` tokens
- [ ] Replace all hardcoded font sizes with `--text-*` tokens
- [ ] Replace all hardcoded shadows with `--shadow-*` tokens
- [ ] Replace all custom buttons with `BaseButton` or `BaseIconButton`
- [ ] Replace all custom inputs with `BaseInput`
- [ ] Replace all custom badges with `BaseBadge`
- [ ] Remove glass effects unless specifically needed
- [ ] Simplify hover states (subtle, not dramatic)
- [ ] Ensure 8px grid alignment

---

## Examples

### ❌ Before (Inconsistent)
```vue
<style scoped>
.my-button {
  background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08));
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255,255,255,0.20);
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  box-shadow: 0 28px 56px rgba(0,0,0,0.32);
}
</style>
```

### ✅ After (Cohesive)
```vue
<template>
  <BaseButton variant="secondary" size="md">
    My Action
  </BaseButton>
</template>
```

---

## Component Composition

### Atomic Design Hierarchy

```
ATOMS (Base Components)
├── BaseButton
├── BaseIconButton
├── BaseInput
├── BaseCard
├── BaseBadge
└── BaseNavItem

MOLECULES (Combine Atoms)
├── SearchBar (BaseInput + BaseIconButton)
├── PriorityIndicator (BaseBadge + Icon)
└── MetadataRow (Icon + Text + BaseBadge)

ORGANISMS (Combine Molecules)
├── Sidebar (Multiple BaseNavItems)
├── TaskCard (Multiple badges, buttons)
└── ContextMenu (Multiple menu items)
```

**RULE:** Each level only uses components from lower levels. Never create parallel implementations.

---

## Testing Cohesion

### Visual Consistency Checklist

1. **Hover all interactive elements** - Do they feel related?
2. **Check all shadows** - Are depths consistent?
3. **Measure spacing** - Is it on the 8px grid?
4. **Toggle theme** - Does everything update correctly?
5. **Compare components** - Do similar elements look similar?

### Token Propagation Test

Change a token and verify it affects everywhere:

```typescript
// In browser console or DesignSystemView
updateToken('surface-primary', '#0f1419')
// Watch ENTIRE app update instantly
```

---

## Quick Reference

### Most Common Tokens

```css
/* Backgrounds */
background: var(--surface-secondary);

/* Text */
color: var(--text-primary);

/* Borders */
border: 1px solid var(--border-subtle);

/* Spacing */
padding: var(--space-4);
gap: var(--space-3);

/* Typography */
font-size: var(--text-sm);
font-weight: var(--font-medium);

/* Shadows */
box-shadow: var(--shadow-md);

/* Transitions */
transition: all var(--duration-fast) var(--spring-smooth);
```

---

## Enforcement

### Code Review Checklist

- [ ] No hardcoded colors?
- [ ] No hardcoded spacing?
- [ ] No hardcoded typography?
- [ ] Using base components?
- [ ] Following semantic color meanings?
- [ ] Shadows from elevation system?
- [ ] 8px grid alignment?
- [ ] Glass effects used sparingly?

### Auto-Enforceable (Future)

Consider adding ESLint rules to prevent:
- Hardcoded color values
- Hardcoded spacing values
- Custom button implementations
- Token tier violations

---

## Summary

**The Golden Rule:**
> If you're writing custom styles, you're probably doing it wrong. Use base components and design tokens.

**The Cohesion Test:**
> Can you change one token and have it propagate throughout the entire app? If yes, you have cohesion.

**The Consistency Test:**
> Do all buttons look related? All inputs? All cards? All navigation items? If yes, you have a cohesive design system.

---

*Refined, professional, cohesive. Like the screenshots you love.*
