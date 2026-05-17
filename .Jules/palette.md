## 2024-05-17 - QuickTaskDropdown Trigger Accessibility
**Learning:** For custom popovers or dropdowns triggers (e.g., `QuickTaskDropdown`), default hover/opacity transitions are often insufficient for keyboard navigation visibility. Also, relying only on `title` attributes on icon-only buttons is not enough for screen readers.
**Action:** Explicitly add `aria-label`, `aria-haspopup` (e.g., 'dialog'), and bind `:aria-expanded` to their open state. Additionally, explicitly apply `:focus-visible` styles to any internal icon-only action buttons.
