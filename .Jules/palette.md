
## 2024-07-15 - Exposing Segmented Control / Filter States
**Learning:** Segmented controls (like Day/Week/Month view selectors) and filter toggle options inside dropdown menus visually rely on an 'active' CSS class to indicate their state. However, without explicit ARIA attributes, screen readers only announce them as buttons, failing to communicate whether they are currently selected/active.
**Action:** Always apply `role="group"` and an `aria-label` to the container of segmented controls. Furthermore, dynamically bind `:aria-pressed` to the toggle buttons (e.g., `:aria-pressed="viewMode === 'day'"`) in tandem with the visual `:class="{ active: ... }"` binding to ensure the visual state aligns with the accessibility tree. Apply `:aria-expanded` to dropdown triggers.
