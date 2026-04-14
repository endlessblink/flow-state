## 2024-05-30 - QuickTaskDropdown Accessibility
**Learning:** Icon-only buttons inside dropdown menus (like QuickTaskDropdown) often lack proper accessible names (`aria-label`) and visible focus states (`:focus-visible`), and dropdown triggers often lack `aria-haspopup` and `aria-expanded`.
**Action:** When working on custom dropdowns or popovers, proactively add `aria-haspopup` and `:aria-expanded` to the trigger, provide `aria-label`s for any icon-only actions inside, and explicitly define `:focus-visible` outlines since default styles may not propagate well to custom scoped elements.
