## 2024-05-24 - Keyboard Accessibility for Complex Rows
**Learning:** Complex interactive rows (like `HierarchicalTaskRow`) implemented as `div`s often lack default keyboard accessibility. Adding `tabindex="0"` and an `aria-label` to the container allows effective keyboard navigation without refactoring the internal structure.
**Action:** For list items that act as interactive rows, ensure they have `tabindex="0"`, a descriptive `aria-label`, and explicit `:focus-visible` styles (using `outline` or `box-shadow`) to support keyboard users.
