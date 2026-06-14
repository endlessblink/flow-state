## 2023-10-27 - ViewControls icon-only accessibility
**Learning:** Icon-only toggle buttons with multiple active states (like 'Filter' or 'Done Tasks' toggles) often only use `title` attributes for tooltips but lack semantic ARIA states. Screen reader users need both an `aria-label` to identify the control and `aria-expanded`/`aria-pressed` to understand its active boolean state.
**Action:** When implementing icon-only filter or toggle buttons, bind the active boolean state to `:aria-expanded` or `:aria-pressed` and ensure `aria-label` is present alongside `title`.
