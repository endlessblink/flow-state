## Palette's Journal

## 2024-05-18 - Missing ARIA Labels on Navigation Buttons
**Learning:** Icon-only navigation buttons in components like `CalendarHeader.vue` (e.g. "previous_day", "next_day") may rely exclusively on the `title` attribute for text descriptions. While `title` provides tooltips for mouse users, it is not reliably exposed by all screen readers.
**Action:** Always add explicit `aria-label` attributes to icon-only buttons to ensure they are accessible to screen reader users, using the existing localization strings or title text.
