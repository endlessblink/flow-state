# Palette's Journal - UX & Accessibility

## 2025-02-18 - QuickSortCard Accessibility
**Learning:** Custom interactive components (like `QuickSortCard`) often bypass standard button components (`BaseButton`), leading to missing focus indicators and ARIA attributes. Design tokens like `--color-work` and `--color-success` are available but not consistently applied to custom CSS buttons.
**Action:** When auditing custom components, always check for `:focus-visible` states and manually apply the standard focus ring styles (`outline: var(--space-0_5) solid var(--color-work)`) to match the design system. Ensure groups of related buttons use `role="group"` and `aria-pressed` for toggle states.
