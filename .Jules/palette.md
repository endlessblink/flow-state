## 2024-06-09 - Accessible Icon-Only Buttons in Calendar Header
**Learning:** Icon-only buttons (like those for date navigation or view options) with only `title` attributes are not reliably exposed to screen readers in this application's custom components. Dropdown triggers also require `aria-expanded` to communicate their state.
**Action:** When creating or updating icon-only buttons, always ensure they have a descriptive `aria-label` (using localized strings when applicable) and bind `aria-expanded` when they act as popover triggers.
