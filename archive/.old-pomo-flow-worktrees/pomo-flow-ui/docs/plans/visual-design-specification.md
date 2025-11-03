# Visual Design Specification

**Created:** 2025-10-26
**Status:** In Progress
**Based On:** UI/UX Audit Report (docs/debug/UI-UX-AUDIT-REPORT.md)

---

## Overview

This specification defines the TARGET visual design system for PomoFlow, based on analysis of current screenshots and code. All decisions are documented with visual examples and will be implemented in Storybook for easy review and approval.

**Storybook Integration:**
- All design decisions visible at `localhost:6006`
- "Design System" category shows unified standards
- Component stories show before/after comparisons
- Interactive playground for testing variants

---

## 1. Color System

### 1.1 Primary Brand Color Decision

**Current State (INCONSISTENT):**
- Canvas/Board: TEAL (#4ECDC4)
- All Tasks: BLUE for selected states
- No unified var(--brand-primary)

**Options:**

#### Option A: TEAL as Primary (#4ECDC4)
**Pros:**
- Already dominant in Canvas view (most complex view)
- Used in theme toggle (visual identity)
- Modern, calm, productive feeling

**Cons:**
- Less common for productivity apps
- May need to verify color contrast

**Preview in Storybook:**
```
Design System > Colors > Brand Primary (TEAL)
- Shows TEAL used across all button states
- Interactive examples of hover/active/focus
```

#### Option B: BLUE as Primary (#4A90E2)
**Pros:**
- Traditional productivity app color
- Already used in some interfaces
- High trust/professionalism association

**Cons:**
- Less distinctive
- Less present in current design

**RECOMMENDATION: TEAL (#4ECDC4)**
- More distinctive
- Already established in Canvas
- Modern productivity aesthetic
- Will create consistent brand identity

### 1.2 Color Token System

**Design Tokens (design-tokens.css):**
```css
:root {
  /* Brand Colors - TEAL System */
  --brand-primary: #4ECDC4;
  --brand-primary-hover: #3db8af;
  --brand-primary-active: #2da39a;
  --brand-primary-alpha-10: rgba(78, 205, 196, 0.1);
  --brand-primary-alpha-20: rgba(78, 205, 196, 0.2);

  /* Semantic States */
  --state-selected-bg: var(--brand-primary-alpha-10);
  --state-selected-border: var(--brand-primary);
  --state-active-bg: var(--brand-primary);
  --state-hover-bg: var(--brand-primary-alpha-10);

  /* Danger/Warning (keep existing) */
  --brand-danger: #ef4444;
  --brand-warning: #f59e0b;
  --brand-success: #10b981;

  /* Theme-Aware Backgrounds */
  --surface-primary: hsl(var(--gray-900));
  --surface-secondary: hsl(var(--gray-800));
  --surface-tertiary: hsl(var(--gray-700));
  --surface-card: hsl(var(--gray-800));
  --surface-hover: hsl(var(--gray-700));

  /* Text (Theme-Aware) */
  --text-primary: hsl(var(--gray-50));
  --text-secondary: hsl(var(--gray-400));
  --text-muted: hsl(var(--gray-500));
  --text-disabled: hsl(var(--gray-600));

  /* Borders */
  --border-subtle: hsl(var(--gray-700) / 0.3);
  --border-medium: hsl(var(--gray-600) / 0.5);
  --border-strong: hsl(var(--gray-500) / 0.8);
}
```

**Storybook Story:**
```
Design System > Colors > Color Palette
- Shows all color tokens with hex values
- Interactive swatches
- Contrast ratio indicators
- Usage examples
```

### 1.3 Dark Theme Compliance

**Rule:** NO white backgrounds in dark theme

**Token Usage:**
```css
/* ❌ WRONG - Breaks dark theme */
.card {
  background: white;
  color: black;
}

/* ✅ CORRECT - Theme-aware */
.card {
  background: var(--surface-card);
  color: var(--text-primary);
}
```

**Affected Components:**
- All Tasks view (currently white)
- Board task cards (currently white)
- Modal backgrounds (verify)

**Storybook Story:**
```
Design System > Theme > Dark Mode Compliance
- Shows all components in dark theme
- Highlights any theme breaks
- Toggle between light/dark
```

---

## 2. Button System

### 2.1 Unified Button Variants

**Current State:** 6+ different button styles
**Target:** 3-5 intentional variants

**Proposed BaseButton Variants:**

#### Primary Button
```typescript
variant: 'primary'
// Use: Main actions (Create, Save, Confirm)
// Style: TEAL background, white text, rounded
// Example: "Create Task", "Save Settings"
```

**Visual:**
- Background: var(--brand-primary)
- Text: white
- Border: none
- Radius: var(--radius-md)
- Hover: var(--brand-primary-hover)

#### Secondary Button
```typescript
variant: 'secondary'
// Use: Alternative actions (Cancel, Close)
// Style: Transparent bg, TEAL border, TEAL text
```

**Visual:**
- Background: transparent
- Text: var(--brand-primary)
- Border: 1px solid var(--brand-primary)
- Radius: var(--radius-md)

#### Ghost Button
```typescript
variant: 'ghost'
// Use: Tertiary actions, minimal UI
// Style: Transparent, hover bg only
```

**Visual:**
- Background: transparent
- Text: var(--text-primary)
- Border: none
- Hover: var(--surface-hover)

#### Icon Button (Square)
```typescript
variant: 'icon-square'
// Use: Toolbar buttons, canvas controls
// Style: Square, TEAL bg, icon only
```

**Visual:**
- Background: var(--brand-primary)
- Size: 40x40px
- Border-radius: var(--radius-md)
- Icon: white, centered

#### Icon Button (Circle)
```typescript
variant: 'icon-circle'
// Use: Floating actions, prominent icons
// Style: Circular, TEAL bg
```

**Visual:**
- Background: var(--brand-primary)
- Size: 40x40px
- Border-radius: 50%

#### Option Button (Toggle)
```typescript
variant: 'option'
// Use: Toggle groups (List/Table, Pomodoro times)
// Style: Pill/rounded, TEAL when active
```

**Visual (Inactive):**
- Background: var(--surface-secondary)
- Text: var(--text-secondary)
- Border: none

**Visual (Active):**
- Background: var(--brand-primary)
- Text: white
- Border: none

**Storybook Story:**
```
Components > Base > BaseButton
- Shows all 6 variants
- Interactive playground
- All states: default, hover, active, disabled, loading
- Size variants: sm, md, lg
- Before/after comparison
```

### 2.2 Button Migration Plan

**Component Priority:**
1. **SettingsModal** - Custom .duration-btn → option variant
2. **Canvas Toolbar** - Custom square buttons → icon-square variant
3. **All Tasks** - Blue toggles → option variant (TEAL)
4. **Board Toolbar** - Circular icons → icon-circle variant
5. **Sidebar** - Various custom → appropriate variants

**Storybook Progress Tracking:**
```
Design System > Migration > Button Consolidation
- Checklist of components
- Before/after screenshots
- Progress percentage
- Visual diff comparisons
```

---

## 3. Glass Morphism System

### 3.1 Unified Glass Effect

**Analysis Needed:**
- Screenshot all modals
- Compare backdrop blur values
- Verify border styles
- Check shadow consistency

**Target Specification:**

#### Modal Glass Effect
```css
.glass-modal {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
}
```

#### Popover/Context Menu Glass
```css
.glass-popover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-xl);
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md),
    inset 0 1px 0 var(--glass-border-soft);
}
```

**Storybook Story:**
```
Design System > Glass Morphism > Standards
- Shows all glass variants
- Interactive blur/saturation controls
- Overlay on different backgrounds
- Performance impact notes
```

---

## 4. Typography System

### 4.1 Type Scale Verification

**Ensure all text uses design tokens:**
```css
/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

**Storybook Story:**
```
Design System > Typography > Type Scale
- Shows all font sizes in context
- Weight variations
- Line height examples
- Usage guidelines
```

---

## 5. Spacing System

### 5.1 8px Grid Compliance

**Spacing Scale:**
```css
--space-1: 0.25rem;  /* 4px  - Micro spacing */
--space-2: 0.5rem;   /* 8px  - Tight */
--space-3: 0.75rem;  /* 12px - Compact */
--space-4: 1rem;     /* 16px - Standard */
--space-5: 1.25rem;  /* 20px - Comfortable */
--space-6: 1.5rem;   /* 24px - Between groups */
--space-8: 2rem;     /* 32px - Between sections */
--space-10: 2.5rem;  /* 40px - Major breaks */
--space-12: 3rem;    /* 48px - Large gaps */
--space-16: 4rem;    /* 64px - Very large */
```

**Usage Rules:**
- Component padding: var(--space-4) or var(--space-6)
- Between related elements: var(--space-2) or var(--space-3)
- Between groups: var(--space-6) or var(--space-8)
- Section breaks: var(--space-8) or var(--space-10)

**Storybook Story:**
```
Design System > Spacing > Grid System
- Visual spacing scale
- Example layouts
- Dos and don'ts
```

---

## 6. Focus States (Accessibility)

### 6.1 Unified Focus System

**Standard Focus Indicator:**
```css
/* All interactive elements */
.interactive-element {
  outline: none; /* Remove default */
  transition: all 0.2s ease;
}

.interactive-element:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--brand-primary-alpha-20);
}

/* Dark backgrounds */
.dark-bg .interactive-element:focus-visible {
  outline-color: var(--brand-primary);
  box-shadow: 0 0 0 4px var(--brand-primary-alpha-20);
}
```

**Requirements:**
- 3:1 contrast ratio minimum (WCAG 2.1)
- Visible on all backgrounds
- Smooth transition
- Consistent across all components

**Storybook Story:**
```
Design System > Accessibility > Focus States
- Shows focus on all interactive elements
- Keyboard navigation demo
- Contrast ratio verification
- Before/after examples
```

---

## 7. Storybook Organization

### 7.1 Story Structure

```
Storybook Categories:
├── Design System/
│   ├── Colors/
│   │   ├── Brand Primary
│   │   ├── Color Palette
│   │   ├── Semantic Colors
│   │   └── Theme Compliance
│   ├── Typography/
│   │   ├── Type Scale
│   │   ├── Font Weights
│   │   └── Line Heights
│   ├── Spacing/
│   │   ├── Grid System
│   │   └── Layout Examples
│   ├── Glass Morphism/
│   │   ├── Modal Standard
│   │   ├── Popover Standard
│   │   └── Comparison
│   ├── Accessibility/
│   │   ├── Focus States
│   │   └── Color Contrast
│   └── Migration/
│       ├── Button Consolidation Progress
│       ├── Before/After Gallery
│       └── Checklist
│
├── Components/
│   ├── Base/
│   │   ├── BaseButton (UPDATED with all variants)
│   │   ├── BaseModal (verified glass effect)
│   │   ├── BasePopover (NEW)
│   │   └── BaseDropdown (NEW)
│   ├── ... (existing categories)
│
└── Examples/
    ├── All Tasks View (before/after theme fix)
    ├── Canvas Toolbar (before/after button fix)
    └── Settings Modal (before/after button migration)
```

### 7.2 Story Templates

**Design System Color Story:**
```typescript
// src/stories/design-system/Colors.stories.ts
export default {
  title: 'Design System/Colors/Brand Primary',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export const TealPrimary: Story = {
  render: () => ({
    template: `
      <div class="space-y-4 p-8">
        <div class="flex items-center gap-4">
          <div class="w-24 h-24 rounded-lg"
               style="background: var(--brand-primary)">
          </div>
          <div>
            <h3 class="font-semibold">Primary Brand Color</h3>
            <p class="text-sm text-gray-500">TEAL #4ECDC4</p>
            <p class="text-xs text-gray-400">var(--brand-primary)</p>
          </div>
        </div>

        <!-- Show usage in buttons, borders, icons -->
        <div class="space-y-2">
          <button class="px-4 py-2 rounded-md"
                  style="background: var(--brand-primary); color: white">
            Primary Button
          </button>
          <button class="px-4 py-2 rounded-md"
                  style="border: 1px solid var(--brand-primary); color: var(--brand-primary)">
            Secondary Button
          </button>
        </div>
      </div>
    `
  })
}
```

**Before/After Comparison Story:**
```typescript
// src/stories/examples/SettingsModalButtons.stories.ts
export default {
  title: 'Examples/Settings Modal - Button Migration',
}

export const Before: Story = {
  render: () => ({
    template: `
      <div class="p-4">
        <h3 class="mb-4">Before: Custom .duration-btn</h3>
        <!-- Screenshot or mockup of old buttons -->
        <div class="duration-options">
          <button class="duration-btn active">15m</button>
          <button class="duration-btn">20m</button>
          <button class="duration-btn">25m</button>
        </div>
        <p class="text-sm text-red-500 mt-2">
          ❌ Custom styles, inconsistent with rest of app
        </p>
      </div>
    `
  })
}

export const After: Story = {
  render: () => ({
    components: { BaseButton },
    template: `
      <div class="p-4">
        <h3 class="mb-4">After: BaseButton variant="option"</h3>
        <div class="flex gap-2">
          <BaseButton variant="option" :active="true">15m</BaseButton>
          <BaseButton variant="option">20m</BaseButton>
          <BaseButton variant="option">25m</BaseButton>
        </div>
        <p class="text-sm text-green-500 mt-2">
          ✅ Unified system, TEAL color, consistent
        </p>
      </div>
    `
  })
}
```

### 7.3 Interactive Approval Process

**Workflow:**
1. Make design change in code
2. Create/update Storybook story
3. User reviews at localhost:6006
4. User provides feedback via screenshots or descriptions
5. Iterate until approved
6. Mark as complete

**Checklist Story:**
```typescript
// src/stories/design-system/MigrationChecklist.stories.ts
export const ButtonMigrationProgress: Story = {
  render: () => ({
    template: `
      <div class="p-8">
        <h2 class="text-2xl font-bold mb-4">Button Migration Progress</h2>

        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input type="checkbox" checked disabled />
            <span>✅ BaseButton - Added all variants</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" disabled />
            <span>⏳ SettingsModal - Migration in progress</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" disabled />
            <span>⏳ Canvas Toolbar - Pending</span>
          </div>
          <!-- ... more items -->
        </div>

        <div class="mt-4 text-sm text-gray-500">
          Progress: 1/7 components migrated (14%)
        </div>
      </div>
    `
  })
}
```

---

## 8. Implementation Workflow

**For Each Component Change:**

1. **Update Component Code**
   ```bash
   # Example: Migrate SettingsModal buttons
   Edit: src/components/SettingsModal.vue
   ```

2. **Create/Update Storybook Story**
   ```bash
   # Create before/after story
   Create: src/stories/examples/SettingsModalButtons.stories.ts
   ```

3. **Visual Verification**
   ```bash
   # Open Storybook
   npm run storybook
   # Navigate to: Examples > Settings Modal - Button Migration
   # Compare Before vs After
   ```

4. **User Review**
   - User opens Storybook
   - Reviews visual changes
   - Provides approval or feedback
   - Screenshot any issues

5. **Iterate or Approve**
   - Fix based on feedback, OR
   - Mark complete and move to next

---

## 9. Decision Points

**Requires User Approval:**

### Decision 1: Primary Brand Color
- [ ] **TEAL (#4ECDC4)** - Recommended
- [ ] **BLUE (#4A90E2)** - Alternative
- [ ] **Other color** - Specify: _______

**How to decide:** Review in Storybook
- `Design System > Colors > Brand Primary (TEAL)`
- `Design System > Colors > Brand Primary (BLUE)`
- See both options applied to all components

### Decision 2: Button Variants
Current proposal: 6 variants (primary, secondary, ghost, icon-square, icon-circle, option)

- [ ] **Approve 6 variants**
- [ ] **Reduce to fewer** - Which to remove: _______
- [ ] **Add more** - Specify need: _______

**How to decide:** Review in Storybook
- `Components > Base > BaseButton`
- Interactive playground to test all variants

### Decision 3: Glass Morphism Strength
- [ ] **Current blur (32px)** - Keep as-is
- [ ] **Lighter blur (24px)** - More subtle
- [ ] **Heavier blur (40px)** - More pronounced

**How to decide:** Review in Storybook
- `Design System > Glass Morphism > Standards`
- Toggle between blur amounts

---

## 10. Success Criteria

**Visual design system is complete when:**

- ✅ User approves primary color in Storybook
- ✅ All buttons consolidated (visible in Storybook progress tracker)
- ✅ No theme breaks (verified in "Theme Compliance" story)
- ✅ Glass morphism standardized (verified in glass stories)
- ✅ Focus states visible (verified in accessibility stories)
- ✅ All design tokens documented in Storybook
- ✅ Before/after comparisons show clear improvement
- ✅ User confirms unified feel across all views

---

**Status:** Ready for user review
**Next Step:** User decides on primary color via Storybook
**Storybook URL:** http://localhost:6006
