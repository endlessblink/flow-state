
## 2024-06-25 - Custom Dropdown Combobox Accessibility
**Learning:** Custom dropdown components (like `BaseDropdown.vue`) must use `role='combobox'` on the trigger, along with `aria-haspopup='listbox'`, `:aria-expanded`, and `:aria-controls`. Focus must remain on the trigger for `aria-activedescendant` to work. Consequently, keyboard navigation listeners (e.g., `@keydown.down`) must be attached to the trigger button, not the listbox, especially if the listbox is teleported. Ensure unique IDs are generated for the listbox and its options.
**Action:** When creating custom dropdowns, always implement the full combobox ARIA pattern and ensure keyboard events are managed from the trigger button while it maintains focus.
