## 2025-05-27 - Standardizing Icon Buttons
**Learning:** Found multiple instances of raw `<button>` elements being used for icon-only toggles in `ViewControls.vue`, leading to inconsistent focus styles and missing ARIA attributes.
**Action:** Always reach for `BaseIconButton` for icon-only interactions. If a specific variant is missing (like "ghost" for transparent buttons), extend the base component rather than styling raw buttons. This ensures consistent focus states and accessibility features like `aria-pressed` across the app.
