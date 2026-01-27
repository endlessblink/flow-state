## 2024-05-23 - Accessible Toggle Buttons
**Learning:** Icon-only toggle buttons often rely on `title` for context and `.active` classes for state, missing `aria-label` and `aria-pressed`. This confuses screen reader users about the button's purpose and current state.
**Action:** Always add `aria-label` (or `aria-labelledby`) to define the action, and use `aria-pressed="true/false"` to communicate the toggle state programmatically, independent of visual styles.
