## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-18 - Missing focus-visible states on custom toggles
**Learning:** Custom UI elements like toggles that hide the native `<input type="checkbox">` visually often forget to provide a `:focus-visible` state, leading to broken keyboard navigation for accessibility users as they cannot see when the toggle is focused.
**Action:** When designing custom form controls, always ensure a `input:focus-visible + .custom-element` rule exists to provide a clear, visible focus outline.
