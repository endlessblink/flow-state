## 2024-07-04 - Accessible Action Buttons in Task Rows
**Learning:** Hidden quick-actions that appear only on `:hover` prevent keyboard-only users from discovering or using them.
**Action:** Always use `:focus-within` on the parent container alongside `:hover` to ensure keyboard navigation reveals inline interactive elements (and pair `opacity: 1` with `pointer-events: auto` to ensure they are clickable).
