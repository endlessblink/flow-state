## 2024-05-18 - Action Button Keyboard Accessibility
**Learning:** The `tabindex="-1"` attribute on action buttons within `TaskCardActions.vue` explicitly removes them from the tab order, preventing keyboard users from accessing core features like focus mode and timers via tabbing.
**Action:** Remove `tabindex="-1"` from interactive action buttons to ensure they remain keyboard navigable, and ensure `:focus-within` styling is active on the parent task card if hover is required to reveal them.
