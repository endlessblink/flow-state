## 2024-05-18 - Missing ARIA Expansion States on Custom Dropdowns
**Learning:** Custom popovers and dropdown triggers throughout the app (like Quick Tasks and Calendar View Options) often lack `aria-expanded` and `aria-haspopup` attributes, leaving screen reader users unaware of the dropdown's current open/closed state.
**Action:** When implementing custom toggle buttons that reveal dropdowns or dialogs, always dynamically bind `:aria-expanded="isOpen"` and include `aria-haspopup="dialog"` (or `listbox`/`menu`) to ensure state is announced to assistive technologies.
