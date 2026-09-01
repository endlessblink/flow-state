## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.
## 2026-09-01 - Icon-Only Button ARIA Labels
**Learning:** Icon-only buttons using tooltips (`title`) in components like `TaskList.vue` (`.group-add-btn`, `.group-ai-btn`) often lack explicit `aria-label` attributes, causing accessibility gaps for screen readers.
**Action:** Always verify icon-only buttons have matching `aria-label`s alongside `title`s during UX reviews.
