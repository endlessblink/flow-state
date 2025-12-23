# Debugging Persistent UI/CSS Issues (Glassmorphism & Backgrounds)

## Context
When a UI element (like a glassmorphism panel) displays a background color or style that persists despite direct CSS changes to the component, it usually indicates **layering**, **inheritance**, or **global token overrides**.

## Issue Pattern
- **Symptom**: You set `background: transparent` on a component, but a color (e.g., `rgba(20, 20, 20, 0.31)`) remains visible.
- **Common Causes**:
    1.  **Wrapper Components**: A parent component (e.g., `UnifiedInboxPanel` wrapping `InboxPanel`) has its own background styling.
    2.  **Global Tokens**: Design tokens (e.g., `--overlay-component-bg`) carry large opacity values (0.95) that look solid even if the child is transparent.
    3.  **Default Browser/Framework Styles**: Some components come with pre-baked backgrounds (e.g., `dialog`, `select`, or library components).
    4.  **Deep Selectors**: A parent view (e.g., `CanvasView.vue`) using `:deep(.class)` to force styles that override component-scoped CSS.

## Debugging Procedure

### 1. Identify the Stack
Don't just look at the target file. Identify the full render stack.
- **Action**: Check where the component is imported and used.
- **Example**: `InboxPanel.vue` was clean, but it was wrapped by `UnifiedInboxPanel.vue`, which *did* have a background.

### 2. Search for the "Ghost" Color
If you see a specific color (e.g., a dark gray), search the entire codebase for that RGB value.
- **Command**: `grep_search` for `20, 20, 20` (or purely visual approximation).
- **Finding**: This often reveals global design tokens in `design-tokens.css` or one-off overrides.

### 3. Check for Wrapper "Leakage"
Wrappers often apply "container styles" like backgrounds, borders, or shadows.
- **Fix**: Move the styling responsibility to the *innermost* visible container or make the wrapper explicitly `transparent`.

### 4. Verify Z-Index and Stacking Contexts
Glassmorphism relies on `backdrop-filter`. This property creates a new stacking context.
- **Risk**: `z-index` on wrappers can cause dropdowns or menus to be clipped or covered if `overflow: hidden` is set.
- **Check**: Ensure wrappers with `z-index` or `backdrop-filter` have `overflow: visible` if they contain dropdowns.

## Solution Strategy (The "User Control" Fix)
Instead of hardcoding opacity, use semantic tokens that allow global adjustment.
1.  **Create a Token**: Define specific tokens for the problematic attribute (e.g., `--inbox-panel-opacity`).
2.  **Apply to Wrappers**: Ensure *all* variations (Canvas, Calendar, Mobile) use this single source of truth.
3.  **Validate**: Change the token value and verify it propagates to all instances.

---
*Reference Case: "Refining Glassmorphism Styles (Dec 2025)" - Fixed persistent gray overlay by removing background from `UnifiedInboxPanel` and `CalendarInboxPanel` and forcing transparency/controlled opacity tokens.*
