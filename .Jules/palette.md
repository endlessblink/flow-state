## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-19 - Missing ARIA labels in Search Modal
**Learning:** Icon-only buttons used for secondary actions within lists or search results (like 'Reveal on Canvas') often lack ARIA labels, relying on title tooltips that are not always accessible.
**Action:** When adding secondary action buttons to list items, always include an explicit aria-label that clearly describes the action to screen readers.
