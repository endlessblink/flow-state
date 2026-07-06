## 2024-05-19 - ARIA Interaction States for Option Pickers
**Learning:** Custom UI components that function as radio groups or segmented controls often rely purely on visual cues (like an `active` CSS class) for state indication. These components are inaccessible to screen readers unless explicitly marked up.
**Action:** Always add `role="group"` and an appropriate `aria-label` to the container of such elements, and dynamically bind `:aria-pressed` (or `:aria-checked`/`:aria-selected` depending on the exact pattern) to each individual option button to reflect its active state.
