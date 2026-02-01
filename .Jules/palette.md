## 2024-05-24 - Task Row Accessibility
**Learning:** Custom interactive rows (like `HierarchicalTaskRow`) often lack `tabindex="0"` and `role="button"`, making them inaccessible to keyboard users.
**Action:** When creating clickable list items, always ensure they are focusable and have appropriate roles and aria-labels, especially if they contain nested interactive elements.
