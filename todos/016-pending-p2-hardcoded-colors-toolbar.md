---
status: pending
priority: p2
issue_id: 016
tags: [code-review, design-system, code-quality]
dependencies: []
---

# Hardcoded Colors in CanvasToolbar and CanvasControls

## Problem Statement

The new `CanvasToolbar.vue` and `CanvasControls.vue` components contain hardcoded hex colors instead of using design tokens. This violates the project's design system guidelines.

**Why it matters:** From CLAUDE.md: "Never hardcode colors/spacing (see `docs/claude-md-extension/design-system.md`)". Hardcoded colors make theme changes difficult and create inconsistency.

## Findings

**Source:** Pattern Recognition Specialist Agent

**Affected Files:**
- `src/components/canvas/CanvasToolbar.vue` (lines 124, 129)
- `src/components/canvas/CanvasControls.vue` (lines 51-70)

**Hardcoded Colors in CanvasToolbar.vue:**
```css
.toolbar-toggle.active.overdue {
  color: #fb923c; /* Orange-400 */
  background: rgba(251, 146, 60, 0.15);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.toolbar-toggle.active.done {
  color: #a78bfa; /* Purple-400 */
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.2);
}
```

**Hardcoded Colors in CanvasControls.vue:**
```css
.control-btn {
  background: rgba(30, 30, 40, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary); /* Good - uses token */
}

.control-btn:hover {
  background: rgba(40, 40, 50, 0.95);
  border-color: rgba(255, 255, 255, 0.2);
}
```

## Proposed Solutions

### Solution 1: Use CSS Custom Properties (Recommended)

Replace hardcoded values with design tokens.

```css
/* CanvasToolbar.vue */
.toolbar-toggle.active.overdue {
  color: var(--color-warning-400);
  background: rgba(var(--color-warning-400-rgb), 0.15);
  border: 1px solid rgba(var(--color-warning-400-rgb), 0.2);
}

.toolbar-toggle.active.done {
  color: var(--color-accent-400);
  background: rgba(var(--color-accent-400-rgb), 0.15);
  border: 1px solid rgba(var(--color-accent-400-rgb), 0.2);
}

/* CanvasControls.vue */
.control-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
```

**Pros:** Consistent with design system, enables theming
**Cons:** May need to add missing tokens
**Effort:** Medium
**Risk:** Low

### Solution 2: Extract Glass Panel Utility Class

The glass panel styling is duplicated. Extract to shared utility.

```css
/* In tailwind.css or globals.css */
.glass-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-md);
}
```

**Pros:** DRY, reusable
**Cons:** Requires adding new utility
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/components/canvas/CanvasToolbar.vue
- src/components/canvas/CanvasControls.vue

**Components:** Canvas UI controls

**Database Changes:** None

## Acceptance Criteria

- [ ] No hardcoded hex colors in new components
- [ ] Colors use CSS custom properties from design system
- [ ] Components visually unchanged

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Pattern Recognition review |

## Resources

- Design System Docs: docs/claude-md-extension/design-system.md
- CLAUDE.md Rule: "Never hardcode colors/spacing"
