## 2024-05-23 - Accessibility in Quick Action Cards
**Learning:** Short-text buttons like "+1" or "+7" in quick action cards provide poor context for screen readers.
**Action:** Always add descriptive `aria-label` attributes (e.g., "Set due date to Tomorrow") to buttons that rely on visual context or shorthand text. Also, group related action buttons with `role="group"` and a label for better navigation context.
