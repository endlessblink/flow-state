# Interaction Patterns Guide

## Overview

This document defines consistent interaction patterns for Pomo-Flow, ensuring users experience predictable, responsive, and delightful interactions throughout the application.

## Core Interaction Principles

1. **Immediate Feedback** - Users should see instant visual response to their actions
2. **Consistency** - Similar actions should have similar visual feedback
3. **Predictability** - Interactions should match user expectations
4. **Reversibility** - Users should be able to undo actions
5. **Accessibility** - All interactions work with keyboard and assistive tech

---

## Hover States

### Standard Hover Pattern

**When to Use:** All clickable/interactive elements (buttons, links, cards)

**Design Tokens:**
```css
/* Hover backgrounds */
--surface-hover: rgba(255, 255, 255, 0.03)

/* Hover borders */
--border-hover: rgba(255, 255, 255, 0.20)

/* Hover shadows */
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12)

/* Hover timing */
--duration-normal: 200ms
--spring-smooth: cubic-bezier(0.4, 0, 0.2, 1)
```

**Implementation:**
```vue
<template>
  <button class="hover-element">
    Click me
  </button>
</template>

<style scoped>
.hover-element {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.hover-element:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
</style>
```

### Card Hover Pattern

**When to Use:** Task cards, project cards, calendar events

```vue
<style scoped>
.card {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: pointer;
}

.card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

/* Lift effect for important cards */
.card.important:hover {
  transform: translateY(-4px) scale(1.005);
  box-shadow: var(--shadow-xl);
}
</style>
```

### Button Hover Patterns

**Primary Button:**
```vue
<style scoped>
.btn-primary {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-start),
    var(--purple-gradient-end)
  );
  color: var(--text-primary);
  border: none;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.btn-primary:hover {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-hover-start),
    var(--purple-gradient-hover-end)
  );
  box-shadow: var(--purple-shadow-medium);
  transform: translateY(-1px);
}
</style>
```

**Ghost Button (Outlined):**
```vue
<style scoped>
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.btn-ghost:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
</style>
```

**Danger Button:**
```vue
<style scoped>
.btn-danger {
  background: linear-gradient(
    135deg,
    var(--danger-gradient-start),
    var(--danger-gradient-end)
  );
  color: var(--text-primary);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.btn-danger:hover {
  background: linear-gradient(
    135deg,
    var(--danger-gradient-hover-start),
    var(--danger-gradient-hover-end)
  );
  box-shadow: 0 4px 12px var(--danger-shadow-strong);
  transform: translateY(-1px);
}
</style>
```

### Link Hover Pattern

```vue
<style scoped>
.link {
  color: var(--brand-primary);
  text-decoration: none;
  transition: color var(--duration-fast) var(--spring-smooth);
  position: relative;
}

.link:hover {
  color: var(--brand-hover);
}

/* Animated underline on hover */
.link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 0;
  height: 2px;
  background: var(--brand-primary);
  transition: width var(--duration-normal) var(--spring-smooth);
}

.link:hover::after {
  width: 100%;
}
</style>
```

---

## Focus States

### Keyboard Focus Indicator

**CRITICAL:** All interactive elements MUST have visible focus indicators for keyboard navigation.

**Design Tokens:**
```css
--purple-glow-focus: 0 0 0 3px rgba(59, 130, 246, 0.2)
--brand-primary: hsl(var(--blue-500))
```

**Standard Focus Pattern:**
```vue
<style scoped>
/* ✅ Use :focus-visible to show focus only for keyboard */
.interactive:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  box-shadow: var(--purple-glow-focus);
}

/* Remove focus ring for mouse clicks (still shows for keyboard) */
.interactive:focus:not(:focus-visible) {
  outline: none;
}
</style>
```

### Focus Within (Container Focus)

```vue
<style scoped>
/* Container highlights when child is focused */
.form-group:focus-within {
  border-color: var(--brand-primary);
  box-shadow: var(--purple-glow-medium);
}

/* Input within form group */
.form-group input:focus {
  outline: none; /* Handled by :focus-within on container */
  border-color: var(--brand-primary);
}
</style>
```

### Custom Components Focus

```vue
<template>
  <div
    tabindex="0"
    role="button"
    class="custom-interactive"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    Custom Component
  </div>
</template>

<style scoped>
.custom-interactive:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  box-shadow: var(--purple-glow-focus);
}
</style>
```

---

## Active/Pressed States

### Button Press Effect

```vue
<style scoped>
.button {
  transition: transform var(--duration-fast) var(--spring-bounce);
}

/* Slight scale down when pressed */
.button:active {
  transform: scale(0.98);
}

/* Or push down effect */
.button:active {
  transform: translateY(1px);
}
</style>
```

### Toggle Button (Active State)

```vue
<template>
  <button
    class="toggle-btn"
    :class="{ 'is-active': isActive }"
    :aria-pressed="isActive"
    @click="toggle"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.toggle-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.toggle-btn.is-active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-glow);
}

.toggle-btn:hover:not(.is-active) {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}
</style>
```

### Selected State (Cards, List Items)

```vue
<template>
  <div
    class="selectable-item"
    :class="{ 'is-selected': isSelected }"
    @click="handleSelect"
  >
    Content
  </div>
</template>

<style scoped>
.selectable-item {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: pointer;
}

.selectable-item:hover {
  border-color: var(--border-medium);
}

.selectable-item.is-selected {
  background: var(--state-selected-bg);
  border-color: var(--state-selected-border);
  box-shadow: var(--state-selected-shadow);
}
</style>
```

---

## Loading States

### Button Loading State

```vue
<template>
  <button
    class="btn-primary"
    :class="{ 'is-loading': isLoading }"
    :disabled="isLoading"
    @click="handleClick"
  >
    <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
    <span :class="{ 'opacity-0': isLoading }">{{ label }}</span>
  </button>
</template>

<style scoped>
.btn-primary {
  position: relative;
  transition: opacity var(--duration-normal);
}

.btn-primary.is-loading {
  opacity: 0.6;
  cursor: wait;
  pointer-events: none;
}

.spinner {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
</style>
```

### Content Loading (Skeleton)

```vue
<template>
  <div v-if="isLoading" class="skeleton-card">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
  </div>
  <div v-else class="content-card">
    <!-- Actual content -->
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-tertiary) 25%,
    var(--surface-elevated) 50%,
    var(--surface-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-title {
  height: 24px;
  width: 60%;
  margin-bottom: var(--space-3);
}

.skeleton-text {
  height: 16px;
  width: 100%;
  margin-bottom: var(--space-2);
}

.skeleton-text:last-child {
  width: 80%;
}
</style>
```

---

## Disabled States

### Disabled Button

```vue
<style scoped>
.button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  color: var(--text-disabled);
}

/* Don't show hover state when disabled */
.button:disabled:hover {
  transform: none;
  box-shadow: none;
}
</style>
```

### Disabled Form Input

```vue
<style scoped>
.input:disabled {
  background: var(--surface-primary);
  color: var(--text-disabled);
  border-color: var(--border-subtle);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Visual indicator: diagonal lines pattern */
.input:disabled {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.02) 10px,
    rgba(255, 255, 255, 0.02) 20px
  );
}
</style>
```

---

## Drag and Drop States

### Draggable Item

```vue
<template>
  <div
    draggable="true"
    class="draggable-item"
    :class="{ 'is-dragging': isDragging }"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    Drag me
  </div>
</template>

<style scoped>
.draggable-item {
  cursor: grab;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.draggable-item:hover {
  box-shadow: var(--shadow-md);
}

.draggable-item:active {
  cursor: grabbing;
}

.draggable-item.is-dragging {
  opacity: 0.5;
  transform: rotate(2deg);
  cursor: grabbing;
}
</style>
```

### Drop Zone

```vue
<template>
  <div
    class="drop-zone"
    :class="{ 'is-over': isDragOver, 'can-drop': canDrop }"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    Drop here
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed var(--border-subtle);
  background: var(--surface-secondary);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.drop-zone.is-over {
  border-color: var(--brand-primary);
  background: var(--state-hover-bg);
  box-shadow: var(--purple-glow-medium);
}

.drop-zone.can-drop {
  border-style: solid;
  border-color: var(--success-border);
}
</style>
```

---

## Transition Patterns

### Page Transitions

```vue
<template>
  <Transition name="page" mode="out-in">
    <component :is="currentView" />
  </Transition>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity var(--duration-normal) var(--spring-smooth),
              transform var(--duration-normal) var(--spring-smooth);
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
```

### Modal Transitions

```vue
<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay">
      <div class="modal-content">
        Content
      </div>
    </div>
  </Transition>
</template>

<style>
/* Overlay fade */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal) var(--spring-smooth);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Content scale + fade */
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition:
    opacity var(--duration-normal) var(--spring-smooth),
    transform var(--duration-normal) var(--spring-bounce);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.95);
}
</style>
```

### List Transitions

```vue
<template>
  <TransitionGroup name="list" tag="ul">
    <li v-for="item in items" :key="item.id">
      {{ item.title }}
    </li>
  </TransitionGroup>
</template>

<style>
.list-enter-active,
.list-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Smooth reordering */
.list-move {
  transition: transform var(--duration-slow) var(--spring-smooth);
}
</style>
```

---

## Micro-Interactions

### Checkbox Check Animation

```vue
<style scoped>
.checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-sm);
  position: relative;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.checkbox:checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

/* Checkmark */
.checkbox:checked::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  animation: checkmark 0.2s var(--spring-bounce);
}

@keyframes checkmark {
  0% {
    height: 0;
  }
  100% {
    height: 10px;
  }
}
</style>
```

### Success Feedback (Pulse)

```vue
<style scoped>
.success-icon {
  animation: successPulse 0.6s var(--spring-bounce);
}

@keyframes successPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}
</style>
```

### Delete Confirmation (Shake)

```vue
<style scoped>
.shake {
  animation: shake 0.4s var(--spring-bounce);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
</style>
```

---

## Accessibility Considerations

### Motion Preferences

```vue
<style>
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Disable hover transforms */
  .hover-lift:hover {
    transform: none;
  }

  /* Disable page transitions */
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.01ms;
  }
}
</style>
```

### Focus Indicator Requirements

- [ ] All interactive elements have visible focus indicator
- [ ] Focus indicator has 3:1 contrast ratio minimum
- [ ] Focus indicator visible when using keyboard (`:focus-visible`)
- [ ] Focus indicator not visible when clicking with mouse

---

## Interaction Patterns Checklist

### For Every Interactive Element:

- [ ] **Hover State**
  - [ ] Background changes on hover
  - [ ] Cursor changes to pointer
  - [ ] Transition smooth (--duration-normal)
  - [ ] Optional: lift or scale effect

- [ ] **Focus State**
  - [ ] Visible outline or glow (`:focus-visible`)
  - [ ] 3:1 contrast ratio for focus indicator
  - [ ] Works with keyboard navigation

- [ ] **Active/Pressed State**
  - [ ] Slight scale or position shift
  - [ ] Instant feedback (--duration-fast)
  - [ ] Visual confirmation of action

- [ ] **Disabled State**
  - [ ] Reduced opacity (0.4-0.6)
  - [ ] Cursor: not-allowed
  - [ ] No hover effects
  - [ ] Clear visual distinction

- [ ] **Loading State**
  - [ ] Spinner or skeleton shown
  - [ ] Element disabled during loading
  - [ ] Loading indicator accessible (aria-busy)

---

**Last Updated:** October 23, 2025
**Interaction Design Version:** 1.0.0
