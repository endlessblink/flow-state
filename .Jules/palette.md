# Palette's Journal

## 2025-05-18 - Accessibility in Task Management
**Learning:** Many interactive elements like icon-only buttons often lack ARIA labels, making them invisible to screen readers.
**Action:** Systematically check for and add `aria-label` to all icon-only buttons encountered.

## 2025-05-21 - Making Interactive Divs Accessible
**Learning:** Found a `div` used as a clickable date picker trigger. This is inaccessible to keyboard users.
**Action:** When using non-button elements for interaction, always add `role="button"`, `tabindex="0"`, and `keydown` handlers (Enter/Space) to mimic native button behavior. Better yet, use `<button>` where possible, but if styling constraints require a `div`, ensure full ARIA support.
