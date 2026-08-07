## 2024-05-24 - Accessible Segmented Controls
**Learning:** Custom segmented controls acting as view selectors (like day/week/month in calendar) were built with raw buttons and active classes, lacking semantic grouping and state exposure for screen readers.
**Action:** When implementing or updating custom segmented controls, always apply `role="radiogroup"` (or `group`) with an `aria-label` to the container, and use `:aria-pressed` dynamically bound to each option to convey the selected state rather than just relying on CSS classes.
