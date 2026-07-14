## 2024-05-24 - Initial creation

## 2025-02-12 - ARIA Toggle Button States
**Learning:** For custom UI components that toggle a specific state (like "Show Completed" or "Show Filters") or function as a segmented control (like a view selector), CSS active classes (`.active`) only provide visual feedback. Without matching ARIA attributes, screen readers only announce them as generic buttons, making it impossible for visually impaired users to know their current state.
**Action:** When implementing custom toggle buttons or grouped view selectors, always include `role="group"` (or `radiogroup`) and an appropriate `aria-label` on the container, and bind `:aria-pressed` (or `:aria-checked`/`:aria-selected`) to each option button alongside the active CSS class. Also, ensure dropdown triggers properly utilize `:aria-expanded`.
