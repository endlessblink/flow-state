## 2024-05-22 - Icon-Only Buttons and ARIA Labels
**Learning:** Many interactive controls (like toggle buttons in `BoardView`) use `icon-only` classes and `title` attributes but lack `aria-label` or `aria-pressed`. This makes them inaccessible to screen reader users who can't see the icon or the visual "active" state.
**Action:** When auditing `icon-only` buttons, always ensure they have a static or dynamic `aria-label` and, if they toggle state, an `aria-pressed` attribute.
