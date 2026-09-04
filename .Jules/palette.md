## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-18 - Missing ARIA labels in view controls
**Learning:** View control toggles for filtering and showing/hiding done tasks frequently rely on `title` attributes instead of robust `aria-label` implementations.
**Action:** Ensure all view control icon-only toggles have dynamically bound `:aria-label` attributes that match the toggle state for proper screen reader announcement.
