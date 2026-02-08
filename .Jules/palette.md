## 2024-05-23 - Accessibility in Rapid Sorting UI
**Learning:** Short-text buttons like "+1" or "Med" are excellent for visual efficiency but fail for screen readers. Adding `aria-label` provides the necessary context ("Set due date to Tomorrow", "Set priority to Medium") without cluttering the UI. Explicit `:focus-visible` styles are also essential for keyboard users navigating these custom controls.
**Action:** Always audit "micro-copy" buttons for screen reader clarity and add `aria-label`s. Ensure all custom buttons have a visible focus state.
