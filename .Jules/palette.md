## 2024-06-05 - Added ARIA attributes to Calendar Controls
**Learning:** The calendar view navigation controls lacked robust screen reader support. Toggle groups (like Day/Week/Month views) were rendered without semantics.
**Action:** Added `role="group"` and `aria-label` to the view selector container, alongside `aria-pressed` for the individual buttons to announce their active state. Also applied `aria-label` to icon-only date navigation and task overlay buttons to improve non-visual access to daily workflow management.
