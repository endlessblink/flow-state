# Design System Unification Plan

**Created:** 2025-10-26
**Status:** In Progress
**Approach:** Visual-First Analysis → Design Specification → Code Implementation

## Problem Statement

The PomoFlow application has severe design system fragmentation:
- **10 modals:** Only 3 use BaseModal, 7 have duplicate custom styles
- **2 context menus:** Completely different visual styles (one glass morphism, one solid)
- **Inconsistent styling:** Different opacity, blur amounts, shadow depths, border radii, and button styles throughout the app

This creates a disjointed user experience where popups and modals feel visually inconsistent.

## Solution Overview

Instead of code-first refactoring, we'll take a **visual-first approach**:

1. Capture screenshots of all UI components in their current state
2. Visually analyze inconsistencies side-by-side
3. Define the target visual design system based on what looks best
4. Document visual specifications (not just code tokens)
5. Implement code changes to achieve visual consistency
6. Verify with screenshots after each change

## Phase 1: Visual Audit & Analysis

### Components to Audit

**Modals (10 total):**
- ✅ BaseModal (reference implementation)
- ❌ SettingsModal
- ❌ TaskEditModal
- ❌ ProjectModal
- ❌ SearchModal
- ❌ GroupModal
- ❌ BatchEditModal
- ❌ canvas/GroupEditModal
- ✅ QuickTaskCreateModal (uses BaseModal)
- ✅ ConfirmationModal (uses BaseModal)

**Context Menus (2 total):**
- ContextMenu.vue (glass morphism style)
- CanvasContextMenu.vue (solid background style)

**Dropdowns & Popovers:**
- CustomSelect.vue
- ProjectFilterDropdown.vue

**Buttons:**
- BaseButton.vue (reference)
- Custom button styles in SettingsModal (.duration-btn, .close-btn)
- Custom button styles in other components

### Visual Properties to Compare

For each component, document:
- **Background:** Gradient vs solid, color values, opacity
- **Blur:** Backdrop filter blur amount (4px, 12px, 32px)
- **Border:** Color, thickness, radius
- **Shadow:** Depth, color, spread
- **Spacing:** Internal padding, margins
- **Animation:** Entrance/exit transitions
- **Typography:** Font size, weight, color
- **Interactive States:** Hover, focus, active, disabled

### Audit Method

Use `audit-ui-ux-consistency` skill to:
1. Navigate to each component's trigger in the app
2. Open/activate the component
3. Capture screenshot at default state
4. Capture screenshot at hover/focus states
5. Document computed CSS values from browser DevTools

## Phase 2: Visual Design Specification

Based on the audit screenshots, create a comprehensive visual design system document that defines:

### Target Glass Morphism System

**Modals & Large Overlays:**
- Background gradient specification
- Backdrop blur amount
- Border style and color
- Shadow depth (near, medium, far)
- Border radius standard
- Overlay opacity

**Context Menus & Popovers:**
- Same or lighter glass effect?
- Animation style (slide, fade, scale)
- Position-aware styling

**Buttons:**
- Primary, secondary, tertiary variants
- Size variants (small, medium, large)
- Icon-only buttons
- Danger states

### Design Token Mapping

Create complete mapping of visual properties to CSS custom properties:
- `--glass-bg-*` family
- `--glass-border-*` family
- `--shadow-*` family
- `--radius-*` family
- `--blur-*` family (may need to add)

## Phase 3: Base Component Creation

### 3.1 BasePopover Component

Create a unified base component for all popup-style UI:

**Features:**
- Position-aware (top, bottom, left, right, auto)
- Consistent glass morphism styling
- Built-in animation system
- Click-outside and escape key handling
- Accessibility (ARIA, focus trap)
- Keyboard navigation support

**Usage:**
```vue
<BasePopover
  :is-visible="showMenu"
  :x="menuX"
  :y="menuY"
  position="auto"
  variant="menu"
>
  <MenuItem>...</MenuItem>
</BasePopover>
```

### 3.2 BaseDropdown Component

Extends BasePopover for select-style dropdowns:

**Features:**
- Keyboard navigation (arrow keys, enter, escape)
- Single and multi-select
- Search/filter capability
- Option groups
- Custom option rendering

**Usage:**
```vue
<BaseDropdown
  v-model="selected"
  :options="options"
  placeholder="Select option"
/>
```

### 3.3 Enhanced BaseModal

Audit current BaseModal and ensure it matches the visual spec:
- May need adjustments to blur, shadow, or border
- Ensure all size variants are visually consistent
- Verify animation timing

## Phase 4: Component Migration

Migrate components one at a time with visual verification:

### 4.1 Modal Migrations (7 components)

**For each modal:**
1. Create migration branch
2. Refactor to use BaseModal
3. Move custom content to slots
4. Migrate custom buttons to BaseButton
5. Screenshot before/after comparison
6. Visual regression test
7. Commit if visuals match

**Migration Order (by complexity):**
1. SettingsModal (most complex, most custom styles)
2. TaskEditModal
3. ProjectModal
4. SearchModal
5. GroupModal
6. BatchEditModal
7. canvas/GroupEditModal

### 4.2 Context Menu Unification

**CanvasContextMenu → BasePopover:**
1. Replace solid background with glass morphism
2. Unify menu item styles
3. Maintain icon grid layout for alignment tools
4. Test canvas interactions

**ContextMenu → BasePopover:**
1. Verify glass morphism matches new standard
2. Standardize menu item spacing
3. Unify shortcut display style

### 4.3 Dropdown Migration

**CustomSelect → BaseDropdown:**
- Replace in all usage locations
- Verify keyboard navigation works
- Test in forms and filters

**ProjectFilterDropdown → BaseDropdown:**
- Migrate project selection logic
- Maintain search functionality
- Verify performance with large lists

### 4.4 Button Consolidation

**Audit all button usage:**
```bash
grep -r "class=\".*btn\"" src/components
```

**Replace with BaseButton:**
- `.duration-btn` → `<BaseButton variant="option" />`
- `.close-btn` → `<BaseButton variant="ghost" icon-only />`
- `.test-sound-btn` → `<BaseButton variant="secondary" />`

**Add missing BaseButton variants if needed:**
- `option` - For toggle-style option buttons
- `ghost` - For minimal visual weight
- Consider size variants

## Phase 5: Design Token Audit

### 5.1 Token Coverage

Ensure all visual properties use design tokens:

**Audit process:**
```bash
# Find hardcoded colors
grep -r "rgba(" src/components --include="*.vue"
grep -r "#[0-9a-f]{3,6}" src/components --include="*.vue"

# Find hardcoded spacing
grep -r "[0-9]+px" src/components --include="*.vue" | grep -v "var(--"
```

**Fix:**
- Replace hardcoded values with appropriate tokens
- Add new tokens to `design-tokens.css` if needed
- Document token usage in component comments

### 5.2 Spacing Grid Compliance

Enforce 8px grid system:

**Audit:**
- Check all padding, margin, gap values
- Verify they're multiples of 8 (or 4 for micro-spacing)

**Fix:**
- Adjust to nearest grid value
- Use `var(--space-*)` tokens exclusively

## Phase 6: Visual Verification

### 6.1 Screenshot Comparison

For each migrated component:
1. Capture "before" screenshot (from Phase 1 audit)
2. Capture "after" screenshot (post-migration)
3. Side-by-side comparison
4. Document any intentional visual changes
5. Get user approval if visuals differ

### 6.2 Playwright Visual Tests

Create visual regression tests:

```typescript
// tests/visual-design-system.spec.ts
test.describe('Design System Consistency', () => {
  test('all modals match glass morphism spec', async ({ page }) => {
    // Test each modal type
  })

  test('all context menus match popover spec', async ({ page }) => {
    // Test each context menu
  })

  test('all buttons match BaseButton variants', async ({ page }) => {
    // Test button consistency
  })
})
```

### 6.3 Accessibility Audit

Verify ARIA compliance:
- All modals have proper `role="dialog"`
- Focus trap works in all modals
- Keyboard navigation in all dropdowns
- Screen reader announcements
- Focus indicators visible

## Success Metrics

- ✅ All 10 modals use BaseModal (0 custom modal implementations)
- ✅ All context menus use BasePopover
- ✅ All dropdowns use BaseDropdown
- ✅ All buttons use BaseButton
- ✅ Zero hardcoded colors/spacing
- ✅ 8px spacing grid compliance
- ✅ Visual regression tests passing
- ✅ Accessibility audit passing
- ✅ User approval of unified visual design

## Timeline Estimate

- **Phase 1 (Visual Audit):** 1-2 hours
- **Phase 2 (Design Spec):** 1 hour
- **Phase 3 (Base Components):** 2-3 hours
- **Phase 4 (Migrations):** 4-6 hours
- **Phase 5 (Token Audit):** 2 hours
- **Phase 6 (Verification):** 1-2 hours

**Total:** 11-16 hours of focused work

## Current Status

- [x] Problem identified
- [x] Plan created
- [ ] Phase 1: Visual audit in progress
- [ ] Phase 2: Design spec
- [ ] Phase 3: Base components
- [ ] Phase 4: Migrations
- [ ] Phase 5: Token audit
- [ ] Phase 6: Verification

## Notes

- This is a **visual-first** approach - code changes serve the visual goal
- Screenshots and visual verification are mandatory at each step
- User approval required before considering any phase complete
- No "working" claims without visual proof

---

**Last Updated:** 2025-10-26
