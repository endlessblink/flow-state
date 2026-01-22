# SOP-013: Teleported Menu Patterns for Tauri Compatibility

**Status**: Active
**Created**: 2026-01-21
**Related Task**: TASK-340

---

## Overview

This SOP documents the correct pattern for creating teleported menus (submenus, popovers, dropdowns) that work correctly in both browser and Tauri desktop environments.

## The Problem

Teleported content (using Vue's `<Teleport to="body">`) can have broken click handling in Tauri's WebView due to:
1. `pointer-events` not being properly inherited
2. Different event bubbling behavior in WebView vs browser
3. CSS styles not applying to teleported content (scoped styles don't work)

## The Solution: Extend Working Base Classes

**CRITICAL**: Never create new CSS classes for teleported content. Instead, extend the proven working classes.

### Working Base Classes

```css
/* These classes are proven to work in Tauri */
.submenu-teleported {
  pointer-events: auto;  /* CRITICAL */
  /* ... other styles */
}

.submenu-teleported .menu-item {
  /* Button styles with proper click handling */
  pointer-events: auto;  /* CRITICAL */
  cursor: pointer;
  /* ... other styles */
}
```

### Pattern for New Teleported Menus

#### 1. Template Structure

```vue
<Teleport to="body">
  <div
    v-if="showMenu"
    ref="menuRef"
    class="submenu submenu-teleported your-modifier-class"
    :style="positionStyle"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
  >
    <!-- Use menu-item class on ALL clickable elements -->
    <button class="menu-item your-visual-modifier" @click="handleAction">
      <Icon :size="16" />
      <span>Label</span>
    </button>
  </div>
</Teleport>
```

#### 2. CSS Structure (Global, NOT Scoped)

```css
/* Add to global <style> block (not scoped) */

/* Modifier for your specific layout */
.submenu-teleported.your-modifier-class {
  /* Layout-specific styles only */
  padding: 12px;
  min-width: 200px;
}

/* Visual modifiers for menu-item */
.submenu-teleported .menu-item.your-visual-modifier {
  /* Visual changes only - DO NOT override pointer-events or cursor */
  flex-direction: column;
  align-items: center;
}
```

### What NOT To Do

```vue
<!-- ❌ WRONG: New class without base -->
<div class="my-new-panel">
  <button class="my-button" @click="action">Click</button>
</div>

<!-- ✅ CORRECT: Extend working base -->
<div class="submenu submenu-teleported my-panel-modifier">
  <button class="menu-item my-button-modifier" @click="action">Click</button>
</div>
```

```css
/* ❌ WRONG: Creating new click handling */
.my-new-panel {
  pointer-events: auto;
}
.my-button {
  pointer-events: auto;
  cursor: pointer;
}

/* ✅ CORRECT: Only add visual modifiers */
.submenu-teleported.my-panel-modifier {
  /* Layout styles only */
}
.submenu-teleported .menu-item.my-button-modifier {
  /* Visual styles only */
}
```

## Real Example: Layout Icon Grid Panel (TASK-340)

### Template

```vue
<Teleport to="body">
  <div
    v-if="showLayoutSubmenu && selectedCount >= 2"
    ref="submenuRef"
    class="submenu submenu-teleported layout-grid-mode"
    :style="submenuStyle"
    @mouseenter="handleLayoutSubmenuEnter"
    @mouseleave="handleLayoutSubmenuLeave"
  >
    <div class="layout-section">
      <div class="layout-section-label">Align</div>
      <div class="layout-icon-row">
        <button class="menu-item menu-item-icon" @click="handleAlignLeft" title="Align Left">
          <AlignHorizontalJustifyStart :size="16" />
        </button>
        <!-- More buttons... -->
      </div>
    </div>
  </div>
</Teleport>
```

### CSS (Global)

```css
/* Extends submenu-teleported, adds grid layout */
.submenu-teleported.layout-grid-mode {
  padding: var(--space-3, 12px);
  min-width: 220px;
}

.submenu-teleported .layout-section {
  margin-bottom: var(--space-3, 12px);
}

.submenu-teleported .layout-icon-row {
  display: flex;
  gap: var(--space-2, 8px);
}

/* Icon button modifier - visual only */
.submenu-teleported .menu-item.menu-item-icon {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
  flex: 0 0 40px;
}
```

## Debugging Checklist

If clicks aren't working in Tauri:

1. ✅ Using `submenu submenu-teleported` as base classes?
2. ✅ Using `menu-item` class on all clickable buttons?
3. ✅ Styles are in global `<style>` block (not `<style scoped>`)?
4. ✅ Not overriding `pointer-events` or `cursor` properties?
5. ✅ Button has `@click` handler directly (not on parent)?

## Browser DevTools Debug Commands

```javascript
// Check pointer-events on all elements
document.querySelectorAll('.submenu-teleported *').forEach(el => {
  const pe = getComputedStyle(el).pointerEvents;
  if (pe !== 'auto') console.warn('pointer-events issue:', el, pe);
});

// Check if click handlers exist
document.querySelectorAll('.menu-item').forEach(b => {
  console.log(b, 'has click:', b.onclick !== null || b._vei?.onClick);
});
```

## Files Reference

- Base styles: `src/components/canvas/CanvasContextMenu.vue` (global `<style>` block)
- Layout grid example: Same file, search for `layout-grid-mode`

---

**Remember**: When in doubt, copy the exact pattern from working code. Don't innovate on teleported menu patterns.
