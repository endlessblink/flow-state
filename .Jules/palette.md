
## 2024-05-18 - Widespread Missing aria-labels on Icon-only Buttons
**Learning:** Found a recurring accessibility issue where several interactive icon-only buttons across multiple domain components (`CalendarDayView`, `QuickTaskDropdown`, `CalendarStatusOverlays`, and `NannyReminder`) relied solely on the HTML `title` attribute for context. `title` attributes are inconsistently read by screen readers depending on user settings and platform.
**Action:** Applied `aria-label`s to all identified interactive icon buttons alongside existing `title` attributes. Moving forward, always review Vue component templates (especially custom toolbars and dropdowns) for raw SVG icon wrappers (`<button><Icon /></button>`) to ensure explicit ARIA labeling is included from the start.
