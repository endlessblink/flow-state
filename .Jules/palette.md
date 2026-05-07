## 2024-05-18 - Missing ARIA combobox role on BaseDropdown
**Learning:** Found that `BaseDropdown.vue` was missing the `role="combobox"` and `aria-expanded` and `aria-haspopup="listbox"` attributes for screen reader accessibility, even though it used `role="listbox"` for its child list.
**Action:** Always verify combobox patterns have the proper trigger roles and expanded state mappings.
