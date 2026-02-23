## 2025-02-23 - Accessible Toggle Buttons
**Learning:** Adding `aria-pressed` to mutually exclusive toggle buttons (like priority or date shortcuts) is a safe, low-impact way to improve accessibility without refactoring to `role="radiogroup"` or `role="tablist"`.
**Action:** When working on existing UI components that use `.active` classes for state, always mirror this state to `aria-pressed` or `aria-selected`.
