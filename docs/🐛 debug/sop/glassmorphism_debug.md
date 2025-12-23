# SOP: Debugging UI & Glassmorphism Issues

**Date Created**: 2025-12-23
**Context**: Fixing persistent gray backgrounds and layout inconsistencies in Pomo-Flow.

## 1. Problem Identification
When a UI element looks different in the App vs. Storybook, or has unwanted opaque backgrounds:

1.  **Check for "Smoking Guns"**: Look for parent containers with hardcoded backgrounds.
    *   *Example*: `CalendarView.vue` had a solid `background: var(--surface-primary)` on the layout wrapper, overriding the transparent glass effect of the child `UnifiedInboxPanel`.
2.  **Inspect the DOM Structure**: Use browser dev tools (or ask the user for a DOM snippet) to see the nesting.
    *   Is the "glass" element inside an opaque container?
    *   Is `z-index` causing stacking context issues?
3.  **Verify Tokens**: Are "transparent" colors actually transparent?
    *   Check `design-tokens.css`. Ensure `rgba` alpha values are low (e.g., 0.05 - 0.15 for glass).

## 2. Hardcoding & Tokenization Strategy
*   **Phase 1 (Debug)**: It is acceptable to use hardcoded `style="background: red"` or specific `rgba()` values to *prove* a fix works and isolate the variable (e.g., confirming a file is actually being rendered).
*   **Phase 2 (Cleanup)**: IMMEDIATE action required.
    *   **NEVER** leave `rgba()` or `#hex` values in component styles for structural elements.
    *   **Create Semantic Tokens**: If a specific transparency level is needed (e.g., "0.6" for a header so text remains readable while keeping the background visible), create a named token in `design-tokens.css`.
    *   *Naming Convention*: `--[component]-[part]-bg` or `--glass-[variant]-bg`.
    *   *Example*: `--glass-panel-bg: rgba(20, 20, 20, 0.6)` instead of hardcoding it in `CalendarView`.

## 3. Common Glassmorphism Pitfalls
*   **Double Glazing**: Applying `backdrop-filter: blur()` and `background: rgba(...)` on *both* a parent and a child. This creates a muddy, dark, or gray appearance.
    *   *Rule*: The floating panel should carry the glass effect. The underlying container should be the global gradient or transparent.
*   **Scrollbars**: `overflow: auto` on a glass panel can cut off dropdowns (like "Priority" or "Project" filters).
    *   *Fix*: Use `overflow: visible` on the panel if it contains absolute popup children, or use `teleport` for the dropdowns.

## 4. Verification Checklist
- [ ] **Storybook match**: Does the isolated component look identical to the App integration?
- [ ] **Background awareness**: Does the underlying global gradient show through?
- [ ] **No Inline Styles**: Are all `style="..."` attributes removed?
- [ ] **Token Usage**: Are all colors mapped to `var(--...)`?
