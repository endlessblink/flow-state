## 2024-11-20 - Adding Accessibility Attributes to Custom Popovers/Dropdowns
**Learning:** Custom popovers or dropdown triggers (e.g., `QuickTaskDropdown`, `view-options-trigger`) need explicit `aria-haspopup` and `aria-expanded` attributes to communicate their state to screen readers.
**Action:** When creating or modifying dropdown triggers, ensure they have `aria-haspopup="dialog"` (or `menu`/`listbox` as appropriate) and `:aria-expanded="isOpen"` bound to their state. Additionally, `aria-label` should be used for icon-only buttons.
