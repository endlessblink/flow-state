# Accessibility Audit Guide (WCAG 2.1 Level AA)

## Overview

This document provides comprehensive guidelines for ensuring Pomo-Flow meets WCAG 2.1 Level AA accessibility standards, making the application usable by everyone, including people with disabilities.

## WCAG 2.1 Four Principles (POUR)

### 1. **Perceivable** - Information and UI must be presentable to users in ways they can perceive
### 2. **Operable** - UI and navigation must be operable
### 3. **Understandable** - Information and operation must be understandable
### 4. **Robust** - Content must be robust enough to be interpreted by assistive technologies

---

## Perceivable

### Color Contrast (WCAG 1.4.3 - Level AA)

**Requirements:**
- **Normal text** (< 18px): 4.5:1 contrast ratio minimum
- **Large text** (≥ 18px or ≥ 14px bold): 3:1 contrast ratio minimum
- **UI components and graphics**: 3:1 contrast ratio for boundaries
- **Focus indicators**: 3:1 contrast ratio against background

**Audit Checklist:**
- [ ] Primary text uses `--text-primary` on `--surface-secondary` (check ratio)
- [ ] Secondary text uses `--text-secondary` (verify meets 4.5:1)
- [ ] Muted text uses `--text-muted` (may only meet 3:1, use for non-critical info)
- [ ] Disabled text uses `--text-disabled` (exempt from contrast requirements)
- [ ] Button text has sufficient contrast (4.5:1 for normal, 3:1 for large)
- [ ] Link text distinguishable from body text (color + underline or sufficient contrast)
- [ ] Interactive borders meet 3:1 ratio (--border-interactive)
- [ ] Focus indicators visible at 3:1 ratio (--purple-glow-focus)

**Testing Tools:**
```bash
# Use browser DevTools or online tools
# - Chrome DevTools: Elements > Color picker shows contrast ratio
# - Firefox DevTools: Accessibility Inspector
# - Online: WebAIM Contrast Checker
```

**Common Pomo-Flow Color Combinations to Verify:**
```css
/* ✅ Good: High contrast combinations */
--text-primary (#f1f5f9) on --surface-secondary (#1e293b)  /* ~12:1 ratio */
--text-secondary (#cbd5e1) on --surface-secondary (#1e293b)  /* ~9:1 ratio */

/* ⚠️ Check: Medium contrast (ensure meets 4.5:1) */
--text-muted (#94a3b8) on --surface-secondary (#1e293b)  /* ~4.7:1 ratio */

/* ⚠️ Avoid for critical text: Low contrast */
--text-subtle on --surface-tertiary  /* May not meet 4.5:1 */
--text-disabled on any background  /* Explicitly low contrast for disabled state */
```

### Semantic HTML (WCAG 1.3.1 - Level A)

**Requirements:**
- Use proper HTML elements for their intended purpose
- Establish correct heading hierarchy
- Use lists for list content
- Use buttons for actions, links for navigation

**Audit Checklist:**
- [ ] Headings follow hierarchy (h1 → h2 → h3, no skipping levels)
- [ ] Only one h1 per page (usually page title)
- [ ] Lists use ul/ol, not div elements
- [ ] Tables use proper table markup with th and caption
- [ ] Buttons use `<button>` element, not `<div @click>`
- [ ] Links use `<a>` element for navigation
- [ ] Forms use `<form>`, `<label>`, `<input>` elements properly
- [ ] Regions use semantic landmarks (nav, main, aside, footer)

**Semantic HTML Patterns:**
```vue
<!-- ✅ Good: Proper semantic structure -->
<template>
  <article class="task-card">
    <h3>{{ task.title }}</h3>
    <p>{{ task.description }}</p>

    <ul class="subtasks-list">
      <li v-for="subtask in task.subtasks" :key="subtask.id">
        {{ subtask.title }}
      </li>
    </ul>

    <button @click="handleEdit" aria-label="Edit task">
      <EditIcon aria-hidden="true" />
    </button>
  </article>
</template>

<!-- ❌ Bad: Generic divs everywhere -->
<template>
  <div class="task-card">
    <div class="title">{{ task.title }}</div>
    <div>{{ task.description }}</div>

    <div>
      <div v-for="subtask in task.subtasks" :key="subtask.id">
        {{ subtask.title }}
      </div>
    </div>

    <div @click="handleEdit">
      <EditIcon />
    </div>
  </div>
</template>
```

### Text Alternatives (WCAG 1.1.1 - Level A)

**Requirements:**
- All non-text content has text alternative
- Decorative images marked as such
- Icon buttons have accessible names
- Images of text avoided when possible

**Audit Checklist:**
- [ ] Icon-only buttons have `aria-label` or visually hidden text
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Informative images have alt text
- [ ] Decorative images have `alt=""` or `aria-hidden="true"`
- [ ] Charts/graphs have text descriptions
- [ ] CAPTCHAs have alternative methods

**Icon Button Patterns:**
```vue
<!-- ✅ Good: Icon button with accessible name -->
<button aria-label="Delete task: Buy groceries">
  <TrashIcon aria-hidden="true" />
</button>

<!-- ✅ Good: Icon with visually hidden text -->
<button>
  <EditIcon aria-hidden="true" />
  <span class="sr-only">Edit task</span>
</button>

<!-- ❌ Bad: Icon button with no accessible name -->
<button @click="deleteTask">
  <TrashIcon />
</button>
```

**Screen Reader Only Class:**
```css
/* Add to design-tokens.css */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Operable

### Keyboard Navigation (WCAG 2.1.1 - Level A)

**Requirements:**
- All functionality available via keyboard
- No keyboard traps (can navigate away with keyboard alone)
- Tab order is logical and intuitive
- Skip links provided for repetitive content

**Audit Checklist:**
- [ ] All interactive elements reachable with Tab key
- [ ] Tab order follows visual order
- [ ] Modal focus trapped within modal (Tab loops through modal only)
- [ ] Escape key closes modals/dropdowns
- [ ] Arrow keys navigate menus and lists
- [ ] Enter/Space activates buttons
- [ ] Custom components have tabindex="0" if interactive
- [ ] Non-interactive elements don't have tabindex (or tabindex="-1")

**Keyboard Navigation Patterns:**
```vue
<!-- ✅ Good: Keyboard-accessible modal -->
<template>
  <div
    v-if="show"
    class="modal-overlay"
    @keydown.esc="handleClose"
    @keydown.tab="handleTabTrap"
  >
    <div
      ref="modalRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">{{ title }}</h2>
      <!-- Modal content -->
      <button ref="firstFocusable" @click="handleSave">Save</button>
      <button ref="lastFocusable" @click="handleClose">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const modalRef = ref<HTMLElement>()
const firstFocusable = ref<HTMLElement>()
const lastFocusable = ref<HTMLElement>()

// Focus trap implementation
const handleTabTrap = (event: KeyboardEvent) => {
  const isTabPressed = event.key === 'Tab'
  if (!isTabPressed) return

  const activeElement = document.activeElement

  if (event.shiftKey) { // Shift + Tab
    if (activeElement === firstFocusable.value) {
      lastFocusable.value?.focus()
      event.preventDefault()
    }
  } else { // Tab
    if (activeElement === lastFocusable.value) {
      firstFocusable.value?.focus()
      event.preventDefault()
    }
  }
}

// Auto-focus first element when modal opens
watch(() => props.show, (isShowing) => {
  if (isShowing) {
    nextTick(() => firstFocusable.value?.focus())
  }
})
</script>
```

### Focus Visible (WCAG 2.4.7 - Level AA)

**Requirements:**
- Keyboard focus indicator always visible
- Focus indicator has sufficient contrast (3:1)
- Focus indicator isn't hidden by CSS

**Audit Checklist:**
- [ ] All interactive elements have visible focus indicator
- [ ] `:focus-visible` used instead of `:focus` (prevents mouse focus ring)
- [ ] `outline: none` never used without alternative focus style
- [ ] Focus indicators meet 3:1 contrast ratio
- [ ] Focus indicators use design tokens (--purple-glow-focus)

**Focus Indicator Patterns:**
```vue
<style scoped>
/* ✅ Good: Visible focus indicator with design tokens */
.button:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  box-shadow: var(--purple-glow-focus);
}

.input:focus-visible {
  border-color: var(--brand-primary);
  box-shadow: var(--purple-glow-focus);
}

/* ❌ Bad: No focus indicator */
button:focus {
  outline: none;  /* DON'T DO THIS without alternative */
}

/* ❌ Bad: Insufficient contrast */
.button:focus {
  outline: 1px solid rgba(255, 255, 255, 0.1);  /* Too subtle */
}
</style>
```

### No Keyboard Traps (WCAG 2.1.2 - Level A)

**Requirements:**
- User can navigate away from any component using keyboard
- If keyboard trap is necessary (modal), Escape key exits
- Custom components don't trap focus unintentionally

**Testing:**
```
1. Tab through entire page - verify can reach all elements
2. Shift+Tab backward - verify can navigate backward
3. Open modal - verify Tab loops within modal
4. Press Escape - verify modal closes and focus returns
5. Test dropdowns - verify can close with Escape
6. Test custom components - verify no unexpected focus traps
```

---

## Understandable

### Labels and Instructions (WCAG 3.3.2 - Level A)

**Requirements:**
- Form inputs have associated labels
- Purpose of inputs is clear
- Instructions provided for complex inputs
- Error messages are specific and helpful

**Audit Checklist:**
- [ ] All inputs have `<label>` elements
- [ ] Labels associated with inputs (for/id or wrapping)
- [ ] Placeholder text not used as sole label
- [ ] Complex inputs have instructions (aria-describedby)
- [ ] Required fields clearly marked
- [ ] Error messages specific to the field

**Form Patterns:**
```vue
<!-- ✅ Good: Proper labels and instructions -->
<template>
  <div class="form-group">
    <label for="task-title" class="required">
      Task Title
    </label>
    <input
      id="task-title"
      v-model="title"
      type="text"
      aria-required="true"
      aria-invalid="hasError"
      aria-describedby="title-error title-help"
      required
    />
    <span id="title-help" class="help-text">
      Choose a clear, descriptive title
    </span>
    <span v-if="hasError" id="title-error" class="error-text" role="alert">
      Title must be at least 3 characters
    </span>
  </div>
</template>

<!-- ❌ Bad: No label, placeholder as label -->
<template>
  <input
    v-model="title"
    placeholder="Task Title"
  />
</template>
```

### Consistent Navigation (WCAG 3.2.3 - Level AA)

**Requirements:**
- Navigation components in same order across pages
- Same actions produce same results
- Icons and buttons consistent across views

**Audit Checklist:**
- [ ] Sidebar navigation consistent across all views
- [ ] Top toolbar buttons in same order
- [ ] Action buttons (save, cancel) in consistent positions
- [ ] Icon meanings consistent (trash = delete everywhere)
- [ ] Confirmation patterns consistent

### Error Identification (WCAG 3.3.1 - Level A)

**Requirements:**
- Errors clearly identified
- Error messages describe the problem
- Errors don't rely on color alone
- Suggestions provided for fixing errors

**Error Patterns:**
```vue
<!-- ✅ Good: Clear error identification -->
<template>
  <div class="form-group" :class="{ 'has-error': errors.email }">
    <label for="email">Email</label>
    <input
      id="email"
      v-model="email"
      type="email"
      aria-invalid="!!errors.email"
      aria-describedby="email-error"
    />
    <div v-if="errors.email" id="email-error" class="error-message" role="alert">
      <AlertIcon aria-hidden="true" />
      {{ errors.email }}
    </div>
  </div>
</template>

<style scoped>
/* Error indication doesn't rely on color alone */
.has-error input {
  border-color: var(--danger-border-medium);
  border-width: 2px;  /* Also visual indicator beyond color */
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--danger-text);
}
</style>
```

---

## Robust

### Valid HTML (WCAG 4.1.1 - Level A)

**Requirements:**
- HTML is well-formed and valid
- Elements have complete start/end tags
- No duplicate IDs
- Proper nesting of elements

**Audit Checklist:**
- [ ] Run HTML validator (https://validator.w3.org/)
- [ ] No duplicate `id` attributes
- [ ] All tags properly closed
- [ ] Proper nesting (no `<button>` inside `<button>`)
- [ ] Attributes properly quoted

### Name, Role, Value (WCAG 4.1.2 - Level A)

**Requirements:**
- All UI components have accessible name
- Components have proper ARIA roles
- State changes are programmatically determinable
- Custom components expose proper accessibility properties

**ARIA Roles and Properties:**
```vue
<!-- ✅ Good: Proper ARIA usage -->
<template>
  <!-- Button with toggle state -->
  <button
    :aria-pressed="isActive"
    aria-label="Toggle timer"
  >
    <PlayIcon v-if="!isActive" aria-hidden="true" />
    <PauseIcon v-else aria-hidden="true" />
  </button>

  <!-- Disclosure widget -->
  <div>
    <button
      :aria-expanded="isExpanded"
      aria-controls="section-content"
      @click="toggleExpand"
    >
      {{ sectionTitle }}
    </button>
    <div
      id="section-content"
      v-show="isExpanded"
      role="region"
      :aria-labelledby="sectionTitle"
    >
      <!-- Section content -->
    </div>
  </div>

  <!-- Tab panel -->
  <div role="tablist" aria-label="Task views">
    <button
      role="tab"
      :aria-selected="activeTab === 'board'"
      :aria-controls="'panel-board'"
      :tabindex="activeTab === 'board' ? 0 : -1"
      @click="activeTab = 'board'"
    >
      Board
    </button>
    <!-- More tabs -->
  </div>
  <div
    id="panel-board"
    role="tabpanel"
    :aria-labelledby="'tab-board'"
    :hidden="activeTab !== 'board'"
  >
    <!-- Board view -->
  </div>
</template>
```

**Common ARIA Patterns:**

**Progress Indicators:**
```vue
<div
  role="progressbar"
  :aria-valuenow="completionPercentage"
  aria-valuemin="0"
  aria-valuemax="100"
  :aria-label="`Task ${completionPercentage}% complete`"
>
  <div class="progress-bar" :style="{ width: `${completionPercentage}%` }" />
</div>
```

**Live Regions (Dynamic Content):**
```vue
<!-- Status updates announced to screen readers -->
<div
  aria-live="polite"
  aria-atomic="true"
  class="status-message"
>
  {{ statusMessage }}
</div>

<!-- Urgent alerts -->
<div
  role="alert"
  aria-live="assertive"
>
  {{ errorMessage }}
</div>
```

**Menus:**
```vue
<div>
  <button
    :aria-expanded="isMenuOpen"
    aria-haspopup="true"
    aria-controls="context-menu"
    @click="toggleMenu"
  >
    More Actions
  </button>

  <div
    v-show="isMenuOpen"
    id="context-menu"
    role="menu"
    @keydown="handleMenuKeydown"
  >
    <button role="menuitem" @click="handleEdit">
      Edit
    </button>
    <button role="menuitem" @click="handleDelete">
      Delete
    </button>
  </div>
</div>
```

---

## Testing Checklist

### Manual Testing

**Keyboard Navigation:**
- [ ] Tab through entire application
- [ ] Verify all interactive elements reachable
- [ ] Test modals with Tab and Escape
- [ ] Navigate menus with Arrow keys
- [ ] Activate buttons with Enter/Space

**Screen Reader Testing:**
- [ ] Install NVDA (Windows) or VoiceOver (Mac)
- [ ] Navigate page with screen reader on
- [ ] Verify all content announced correctly
- [ ] Test forms and error messages
- [ ] Verify buttons have clear names
- [ ] Check heading navigation (H key)
- [ ] Test landmark navigation (D key)

**Visual Testing:**
- [ ] Verify color contrast with DevTools
- [ ] Check focus indicators visible
- [ ] Test at 200% zoom
- [ ] Test text spacing increased (150%)
- [ ] Verify no horizontal scrolling at mobile sizes

### Automated Testing

**Browser Extensions:**
```bash
# Install accessibility extensions
- axe DevTools (Chrome/Firefox)
- WAVE (Chrome/Firefox)
- Lighthouse (Chrome DevTools)

# Run automated scans
1. Open DevTools → Lighthouse
2. Run Accessibility audit
3. Fix reported issues
4. Re-scan to verify fixes
```

**Code-Level Testing:**
```bash
# Install axe-core for Vue
npm install --save-dev @axe-core/vue

# Add to main.ts (development only)
import axe from '@axe-core/vue'

if (import.meta.env.DEV) {
  axe(app, {
    config: {
      rules: [
        { id: 'color-contrast', enabled: true },
        { id: 'label', enabled: true },
        { id: 'button-name', enabled: true }
      ]
    }
  })
}
```

---

## Common Accessibility Issues in Pomo-Flow

### Issue #1: Icon Buttons Without Labels
```vue
<!-- ❌ Current issue in some components -->
<button @click="deleteTask">
  <TrashIcon />
</button>

<!-- ✅ Fix -->
<button @click="deleteTask" aria-label="Delete task">
  <TrashIcon aria-hidden="true" />
</button>
```

### Issue #2: Color-Only Status Indicators
```vue
<!-- ❌ Bad: Relying on color alone -->
<div :class="`priority-${priority}`">
  {{ task.title }}
</div>

<!-- ✅ Good: Text label + color -->
<div :class="`priority-${priority}`">
  <span class="priority-label sr-only">{{ priority }} priority:</span>
  {{ task.title }}
</div>
```

### Issue #3: Missing Form Labels
```vue
<!-- ❌ Bad: Placeholder as label -->
<input v-model="search" placeholder="Search tasks..." />

<!-- ✅ Good: Proper label -->
<label for="task-search">Search tasks</label>
<input id="task-search" v-model="search" placeholder="e.g., buy groceries" />

<!-- ✅ Alternative: Visually hidden label -->
<label for="task-search" class="sr-only">Search tasks</label>
<input
  id="task-search"
  v-model="search"
  placeholder="Search tasks..."
  aria-label="Search tasks"
/>
```

### Issue #4: Focus Not Visible
```vue
<!-- ❌ Bad: Focus outline removed -->
<style>
button:focus {
  outline: none;
}
</style>

<!-- ✅ Good: Custom focus indicator -->
<style>
button:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  box-shadow: var(--purple-glow-focus);
}
</style>
```

---

## Accessibility Report Template

```markdown
# Accessibility Audit Report
**Date:** [Date]
**Standard:** WCAG 2.1 Level AA
**Scope:** [Pages/Components audited]

## Summary
- **Total Issues Found:** X
  - Critical (Level A): X
  - Important (Level AA): X
  - Enhancement (Level AAA): X

## Critical Issues (Must Fix)

### 1. Icon Buttons Missing Labels
**WCAG:** 4.1.2 Name, Role, Value (Level A)
**Impact:** Screen reader users cannot understand button purpose
**Locations:**
- src/components/TaskCard.vue:45
- src/components/KanbanColumn.vue:78

**Fix:**
```vue
<button aria-label="Delete task: {{ task.title }}">
  <TrashIcon aria-hidden="true" />
</button>
```

## Automated Test Results

**Lighthouse Score:** X/100
**axe DevTools:** X issues found
**WAVE:** X errors, X warnings

## Recommendations

1. **Immediate:** Fix all Level A issues
2. **Short-term:** Address Level AA issues
3. **Long-term:** Consider Level AAA enhancements
```

---

**Last Updated:** October 23, 2025
**WCAG Version:** 2.1 Level AA
