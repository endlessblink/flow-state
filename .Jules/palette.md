
## 2025-02-28 - Native Buttons as Tabs
**Learning:** In the Cyberflow Dashboard, native buttons were used as tabs but lacked standard ARIA relationships, leaving screen readers unaware of the "tabbed" interface state.
**Action:** Always apply `role="tablist"` to the container, `role="tab"` with `:aria-selected`, `:aria-controls`, and `:id` to the buttons, and `role="tabpanel"` with `:id` and `:aria-labelledby` to the content wrapper to establish a complete and accessible tab interface.
