## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-20 - Ensure icon-only buttons have accessible names
**Learning:** Icon-only toggle buttons often rely on `title` attributes for tooltips, which are poorly supported by screen readers. A missing `aria-label` causes these interactive elements to lack a programmatic accessible name, leaving visually impaired users unable to understand their function.
**Action:** Always verify that icon-only buttons explicitly define an `aria-label` (or a dynamically bound `:aria-label` mirroring the `title`), even if a tooltip is present visually.
