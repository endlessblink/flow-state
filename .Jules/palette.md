## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.
## 2024-09-06 - Missing aria-label and aria-pressed attributes in icon-only submenus
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu and filters (e.g., `InboxTimeFilters.vue`) often rely solely on title attributes for description, which are inconsistently read by screen readers. Furthermore, toggle buttons lack the `aria-pressed` state.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes and bind `aria-pressed` to the active state to guarantee robust screen reader support.
