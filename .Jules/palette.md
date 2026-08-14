## 2024-05-18 - Missing ARIA Expanded States on Custom Dropdown Triggers
**Learning:** Found that several custom popover triggers (like Calendar View Options and Quick Tasks) lacked `aria-expanded` attributes. When building custom popovers instead of native `<select>` or `<details>` elements, screen readers need this attribute to announce the open/closed state.
**Action:** Always dynamically bind `:aria-expanded="isOpen"` to trigger buttons for custom dropdowns and popovers across the application.
