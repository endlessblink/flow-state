## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.
