# Implement UI/UX Fixes

**Version:** 1.0.0
**Category:** Implement
**Related Skills:** audit-ui-ux-consistency, vue-development, css-design-system

## Overview

Systematically implement UI/UX fixes identified in audits. This skill provides step-by-step implementation guidance for design system compliance, component consistency, accessibility improvements, and visual polish.

## When to Activate This Skill

Invoke this skill when:
- User requests UI/UX improvements based on audit findings
- Implementing design token migration
- Fixing component consistency issues
- Adding accessibility improvements (ARIA labels, focus indicators)
- Standardizing button/card/modal styles
- Implementing composition and alignment fixes
- User provides a reference design to match

## Core Principles

### 1. Always Create Feature Branch First

**CRITICAL:** Never implement UI changes on main branch.

```bash
# Create descriptive branch
git checkout -b ui/design-system-fixes
# or
git checkout -b ui/accessibility-improvements
# or
git checkout -b ui/button-consolidation
```

### 2. Implement in Priority Order

**Phase 1: Critical Fixes (Week 1)**
- Theme breaks (white cards in dark app)
- Accessibility violations (ARIA labels, focus indicators)
- Primary color standardization

**Phase 2: High Priority (Week 2)**
- Button consolidation (use BaseButton everywhere)
- Design token migration (colors, spacing, typography)
- Composition fixes (alignment, spacing rhythm)

**Phase 3: Medium Priority (Week 3-4)**
- Visual hierarchy improvements
- Typography system enforcement
- Grid system implementation

### 3. Test After Each Change

**Mandatory Testing:**
- Visual verification in browser
- Test both light and dark themes
- Test all component states (hover, focus, active, disabled)
- Verify accessibility with keyboard navigation
- Check responsive behavior

### 4. Document What Changed

**Create changelog:**
- List all files modified
- Note what was changed and why
- Reference audit report section
- Screenshot before/after if visual change

---

## Implementation Workflows

### Workflow 1: Design Token Migration

**Goal:** Replace hardcoded values with design tokens

**Process:**

1. **Identify Target Files**
   ```bash
   # Find hardcoded colors
   grep -rn "color: #\|background: #\|border.*#" src/components --include="*.vue"

   # Find hardcoded spacing
   grep -rn "padding: [0-9]\|margin: [0-9]" src/components --include="*.vue"

   # Find hardcoded font sizes
   grep -rn "font-size: [0-9]" src/components --include="*.vue"
   ```

2. **Create Mapping Spreadsheet**
   ```
   Hardcoded Value → Design Token
   #4ECDC4 → var(--brand-primary)
   #000 → var(--surface-elevated)
   padding: 12px 24px → padding: var(--space-3) var(--space-6)
   font-size: 14px → font-size: var(--font-size-sm)
   ```

3. **Implement Systematically**
   ```vue
   <!-- BEFORE -->
   <style scoped>
   .button {
     color: #4ECDC4;
     background: #000;
     padding: 12px 24px;
     font-size: 14px;
   }
   </style>

   <!-- AFTER -->
   <style scoped>
   .button {
     color: var(--brand-primary);
     background: var(--surface-elevated);
     padding: var(--space-3) var(--space-6);
     font-size: var(--font-size-sm);
   }
   </style>
   ```

4. **Verify in Browser**
   - Check color matches expected
   - Verify spacing looks correct
   - Test theme switching (if applicable)

---

### Workflow 2: Button Consolidation

**Goal:** Replace all button variants with BaseButton component

**Process:**

1. **Audit Current Button Usage**
   ```bash
   # Find all button implementations
   grep -rn "<button" src/components --include="*.vue" | wc -l

   # Find BaseButton usage
   grep -rn "BaseButton" src/components --include="*.vue" | wc -l
   ```

2. **Identify Button Patterns**
   - List all custom button classes
   - Document what each pattern does
   - Map to BaseButton variants

3. **Create Migration Plan**
   ```
   Custom Pattern → BaseButton Equivalent
   .menu-icon-button → <BaseIconButton variant="ghost" size="sm">
   .bulk-menu-item → <BaseButton variant="secondary" size="sm">
   .btn-secondary → <BaseButton variant="secondary">
   .cancel-btn → <BaseButton variant="ghost">
   ```

4. **Implement Component by Component**
   ```vue
   <!-- BEFORE -->
   <template>
     <button class="menu-icon-button" @click="handleClick">
       <TrashIcon />
     </button>
   </template>

   <!-- AFTER -->
   <template>
     <BaseIconButton
       variant="ghost"
       size="sm"
       aria-label="Delete item"
       @click="handleClick"
     >
       <TrashIcon />
     </BaseIconButton>
   </template>

   <script setup>
   import BaseIconButton from '@/components/base/BaseIconButton.vue'
   import TrashIcon from '@/components/icons/TrashIcon.vue'
   </script>
   ```

5. **Remove Old CSS**
   - Delete custom button classes after migration
   - Keep design tokens only

---

### Workflow 3: Accessibility Improvements

**Goal:** Add ARIA labels and focus indicators to all interactive elements

**Process:**

1. **Find Missing ARIA Labels**
   ```bash
   # Find buttons without aria-label
   grep -rn "<button" src/components --include="*.vue" | grep -v "aria-label"
   ```

2. **Create ARIA Label Mapping**
   ```
   Button Purpose → ARIA Label
   <TrashIcon /> → "Delete task"
   <EditIcon /> → "Edit task"
   <CloseIcon /> → "Close modal"
   <SettingsIcon /> → "Open settings"
   ```

3. **Add ARIA Labels Systematically**
   ```vue
   <!-- Icon-only buttons MUST have aria-label -->
   <BaseIconButton
     aria-label="Delete task"
     @click="deleteTask"
   >
     <TrashIcon />
   </BaseIconButton>

   <!-- Buttons with text don't need aria-label -->
   <BaseButton @click="save">
     Save Changes
   </BaseButton>

   <!-- Decorative icons should be aria-hidden -->
   <BaseButton @click="save">
     <CheckIcon aria-hidden="true" />
     Save Changes
   </BaseButton>
   ```

4. **Fix Focus Indicators**
   ```vue
   <!-- BEFORE: Removes focus outline -->
   <style>
   button:focus {
     outline: none;
   }
   </style>

   <!-- AFTER: Custom focus-visible indicator -->
   <style>
   button:focus-visible {
     outline: 2px solid var(--brand-primary);
     outline-offset: 2px;
     box-shadow: var(--purple-glow-focus);
   }
   </style>
   ```

5. **Test with Keyboard**
   - Tab through all interactive elements
   - Verify focus indicators are visible
   - Test Enter/Space activation
   - Verify screen reader announcements (if possible)

---

### Workflow 4: Visual Consistency (Reference Design)

**Goal:** Match a reference design across all views

**Process:**

1. **Analyze Reference Design**
   - Document colors used (exact hex values)
   - Measure spacing between elements
   - Note border radius, shadows, fonts
   - Identify button styles, card styles, modal styles

2. **Update Design Tokens to Match**
   ```css
   /* src/assets/design-tokens.css */

   /* Update colors to match reference */
   --brand-primary: #4ECDC4; /* Teal from reference */
   --surface-elevated: #252a3e; /* Dark background from reference */

   /* Update spacing to match reference */
   --space-3: 0.75rem; /* 12px - button padding */
   --space-6: 1.5rem; /* 24px - modal padding */

   /* Update border radius to match reference */
   --radius-md: 8px; /* Rounded corners from reference */
   ```

3. **Update BaseButton to Match Reference**
   ```vue
   <style scoped>
   .base-button {
     /* Match reference design */
     padding: var(--space-3) var(--space-6);
     border-radius: var(--radius-md);
     background: var(--brand-primary);
     color: white;
     font-size: var(--font-size-sm);
     font-weight: 500;

     /* Match hover state from reference */
     transition: all 0.2s ease;
   }

   .base-button:hover {
     background: var(--brand-primary-hover);
     transform: translateY(-1px);
     box-shadow: var(--shadow-md);
   }
   </style>
   ```

4. **Apply to All Components**
   - Update modals to match reference
   - Update cards to match reference
   - Update form inputs to match reference
   - Verify consistency across all views

5. **Screenshot Comparison**
   - Take screenshots of each view
   - Compare side-by-side with reference
   - Adjust until match is exact

---

### Workflow 5: Composition & Alignment Fixes

**Goal:** Align elements to grid, fix spacing rhythm, improve visual balance

**Process:**

1. **Fix Toolbar Button Alignment**
   ```vue
   <!-- BEFORE: Inconsistent button sizes -->
   <style>
   .toolbar-button {
     width: 32px; /* Some 32px */
     height: 32px;
   }
   .toolbar-button-large {
     width: 40px; /* Some 40px */
     height: 40px;
   }
   </style>

   <!-- AFTER: Consistent sizing -->
   <style>
   .toolbar-button {
     width: 40px; /* All same size */
     height: 40px;
     padding: var(--space-2);
   }
   </style>
   ```

2. **Fix Spacing Rhythm**
   ```vue
   <!-- BEFORE: Random spacing -->
   <style>
   .section-header {
     margin-bottom: 13px; /* Not on 8px grid */
   }
   .card-content {
     padding: 15px; /* Not on 8px grid */
   }
   </style>

   <!-- AFTER: 8px grid alignment -->
   <style>
   .section-header {
     margin-bottom: var(--space-4); /* 16px */
   }
   .card-content {
     padding: var(--space-4); /* 16px */
   }
   </style>
   ```

3. **Fix Modal Centering**
   ```vue
   <!-- BEFORE: Centered by eye -->
   <style>
   .modal {
     position: fixed;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
   }
   </style>

   <!-- AFTER: Grid-based centering -->
   <style>
   .modal {
     position: fixed;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
     max-width: calc(100% - var(--space-8) * 2); /* 32px margin */
     width: 600px; /* Standard modal width */
   }
   </style>
   ```

4. **Verify with Grid Overlay**
   - Add grid overlay in development
   - Check elements snap to grid lines
   - Adjust until properly aligned

---

### Workflow 6: Theme Consistency Fix

**Goal:** Ensure all components respect theme (dark/light)

**Process:**

1. **Identify Theme Breaks**
   ```bash
   # Find hardcoded white backgrounds
   grep -rn "background.*white\|background.*#fff" src/components --include="*.vue"

   # Find hardcoded black text
   grep -rn "color.*black\|color.*#000" src/components --include="*.vue"
   ```

2. **Replace with Theme Tokens**
   ```vue
   <!-- BEFORE: Breaks in dark theme -->
   <style>
   .card {
     background: white;
     color: black;
   }
   </style>

   <!-- AFTER: Respects theme -->
   <style>
   .card {
     background: var(--surface-elevated);
     color: var(--text-primary);
   }
   </style>
   ```

3. **Test Both Themes**
   - Switch to light theme → verify readability
   - Switch to dark theme → verify no white cards
   - Check all states (hover, active, disabled)

---

## Common Implementation Patterns

### Pattern 1: Standardize Button Styles

```vue
<template>
  <!-- Primary action -->
  <BaseButton variant="primary" size="lg" @click="submit">
    Create Task
  </BaseButton>

  <!-- Secondary action -->
  <BaseButton variant="secondary" size="md" @click="cancel">
    Cancel
  </BaseButton>

  <!-- Tertiary action -->
  <BaseButton variant="ghost" size="sm" @click="reset">
    Reset
  </BaseButton>

  <!-- Danger action -->
  <BaseButton variant="danger" size="md" @click="deleteTask">
    Delete
  </BaseButton>

  <!-- Icon-only button -->
  <BaseIconButton variant="ghost" size="sm" aria-label="Close modal" @click="close">
    <XIcon />
  </BaseIconButton>
</template>
```

### Pattern 2: Standardize Card Styles

```vue
<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">Card Title</h3>
    </div>
    <div class="card-content">
      <!-- Content here -->
    </div>
    <div class="card-actions">
      <BaseButton variant="primary">Action</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.card-header {
  margin-bottom: var(--space-4);
}

.card-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-content {
  margin-bottom: var(--space-6);
}

.card-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
```

### Pattern 3: Standardize Modal Styles

```vue
<template>
  <BaseModal :show="isOpen" @close="close">
    <template #header>
      <h2 class="modal-title">Modal Title</h2>
    </template>

    <template #default>
      <div class="modal-content">
        <!-- Content here -->
      </div>
    </template>

    <template #footer>
      <div class="modal-actions">
        <BaseButton variant="ghost" @click="close">
          Cancel
        </BaseButton>
        <BaseButton variant="primary" @click="submit">
          Confirm
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-title {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-content {
  padding: var(--space-6) 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
```

### Pattern 4: Standardize Form Input Styles

```vue
<template>
  <div class="form-field">
    <label class="form-label" :for="inputId">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>
    <BaseInput
      :id="inputId"
      v-model="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-required="required"
      :aria-describedby="errorId"
    />
    <span v-if="error" :id="errorId" class="form-error">
      {{ error }}
    </span>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.required-indicator {
  color: var(--status-error);
}

.form-error {
  font-size: var(--font-size-xs);
  color: var(--status-error);
}
</style>
```

---

## Quality Checklist

Before marking implementation complete, verify:

### Design Token Compliance
- [ ] No hardcoded colors (all use var(--*))
- [ ] No hardcoded spacing (all use var(--space-*))
- [ ] No hardcoded font sizes (all use var(--font-size-*))
- [ ] All border radius uses var(--radius-*)
- [ ] All shadows use var(--shadow-*)

### Component Consistency
- [ ] All buttons use BaseButton or BaseIconButton
- [ ] All modals use BaseModal
- [ ] All inputs use BaseInput
- [ ] No duplicate component implementations
- [ ] Consistent prop naming across components

### Accessibility
- [ ] All icon-only buttons have aria-label
- [ ] All form inputs have associated labels
- [ ] All interactive elements show focus indicators
- [ ] No outline: none without replacement
- [ ] Keyboard navigation works everywhere
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1)

### Visual Consistency
- [ ] Same button styles across all views
- [ ] Same card styles across all views
- [ ] Same modal styles across all views
- [ ] Consistent spacing rhythm (8px grid)
- [ ] Consistent typography hierarchy

### Theme Support
- [ ] Works in dark theme
- [ ] Works in light theme
- [ ] No hardcoded black or white
- [ ] Theme switching doesn't break layout

### Composition & Alignment
- [ ] Elements align to grid
- [ ] Spacing uses 8px multiples
- [ ] Visual balance is good
- [ ] No ragged edges on button groups
- [ ] Modals are properly centered

---

## Testing Workflow

### 1. Visual Testing

```bash
# Start dev server
npm run dev

# Open browser to localhost:5546
# Test each view:
# - Board view
# - Calendar view
# - Canvas view
# - All Tasks view
```

**Check:**
- Does it match reference design?
- Are all buttons consistent?
- Is spacing rhythm consistent?
- Do colors match design tokens?

### 2. Theme Testing

```bash
# Toggle theme in app
# Verify:
# - No white cards in dark theme
# - No black text in light theme
# - All elements respect theme
# - Contrast is good in both themes
```

### 3. Accessibility Testing

```bash
# Keyboard test:
# - Tab through all interactive elements
# - Verify focus indicators visible
# - Test Enter/Space activation

# Screen reader test (if possible):
# - Verify ARIA labels are announced
# - Check form input labels
# - Verify button purposes clear
```

### 4. Responsive Testing

```bash
# Test at different screen sizes:
# - 1920x1080 (desktop)
# - 1366x768 (laptop)
# - 768x1024 (tablet)
# - 375x667 (mobile)
```

### 5. Component State Testing

**Test all states:**
- Default
- Hover
- Focus
- Active
- Disabled
- Loading (if applicable)
- Error (if applicable)

---

## Rollback Strategy

If implementation doesn't look right:

```bash
# See what changed
git diff main

# If need to revert
git checkout main
git branch -D ui/design-system-fixes

# Start over with different approach
git checkout -b ui/design-system-fixes-v2
```

**Always save screenshots before major changes:**

```bash
# Create screenshots directory
mkdir -p docs/screenshots/before
mkdir -p docs/screenshots/after

# Document what you're changing
# Take before screenshots
# Implement changes
# Take after screenshots
# Compare side-by-side
```

---

## Implementation Time Estimates

### Quick Fixes (< 1 hour)
- Fix single component theme break
- Add ARIA labels to one view
- Standardize button sizing in one component

### Small Tasks (1-3 hours)
- Migrate one component to design tokens
- Consolidate buttons in one view
- Fix spacing rhythm in one section

### Medium Tasks (3-8 hours)
- Migrate all components in one view to design tokens
- Consolidate all buttons across app
- Fix composition issues across all views

### Large Tasks (8-20 hours)
- Complete design token migration (all components)
- Complete button consolidation (all views)
- Complete accessibility overhaul

---

## Success Metrics

**Implementation is successful when:**

1. **Visual Consistency Score** increases to 90%+
2. **Design Token Adoption** increases to 90%+
3. **Accessibility Score** reaches 100% (WCAG 2.1 AA)
4. **Component Consistency** reaches 95%+
5. **User feedback** confirms improved UX

**Measure with:**
- Re-run UI/UX audit
- Compare before/after scores
- Visual regression tests
- User testing feedback

---

## Example Implementation Session

**Goal:** Fix Settings Modal to match reference design

**Reference:** image copy 9.png (teal buttons, glass morphism, dark theme)

**Steps:**

1. **Create branch**
   ```bash
   git checkout -b ui/settings-modal-redesign
   ```

2. **Analyze reference**
   - Teal buttons (#4ECDC4)
   - 8px border radius
   - 12px 24px button padding
   - Glass morphism background
   - 24px modal padding

3. **Update design tokens** (if needed)
   ```css
   --brand-primary: #4ECDC4;
   --radius-md: 8px;
   ```

4. **Update SettingsModal.vue**
   - Replace custom buttons with BaseButton
   - Add variant="primary" for action buttons
   - Use design tokens for spacing
   - Ensure glass morphism background

5. **Test**
   - Visual check in browser
   - Compare with reference
   - Test theme switching
   - Test keyboard navigation

6. **Commit**
   ```bash
   git add src/components/SettingsModal.vue
   git commit -m "feat(ui): redesign Settings modal to match reference design

   - Replace custom buttons with BaseButton
   - Use teal primary color consistently
   - Apply glass morphism background
   - Standardize spacing with design tokens
   - Add ARIA labels to all buttons"
   ```

7. **Screenshot comparison**
   - Save before/after screenshots
   - Document in PR

---

**Skill Activation Keywords:**
- implement UI fixes, apply design system, fix accessibility
- consolidate buttons, migrate to design tokens
- match reference design, standardize components
- fix theme break, improve visual consistency
- align to grid, fix spacing rhythm

**Skill Context:**
- Vue 3 components
- Design system implementation
- CSS/styling improvements
- Accessibility compliance
- Component refactoring
