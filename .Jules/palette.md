## 2024-05-18 - Missing Aria Labels on Icon-only Buttons
**Learning:** Found several components with icon-only buttons missing aria-labels (only using title attributes). Title attributes are not reliably exposed to screen readers for accessibility.
**Action:** Always add aria-labels using translation strings (e.g. `$t('calendar.previous_day')`) or literal strings matching the title attribute for icon-only buttons. Tested in `CalendarHeader.vue`, `CalendarDayView.vue`, `CalendarStatusOverlays.vue`, and `QuickTaskDropdown.vue`.
