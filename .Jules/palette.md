## 2024-06-28 - Icon-only toggles need interaction state bindings
**Learning:** Adding `aria-expanded` and `aria-pressed` dynamically bound to boolean properties on icon-only toggle buttons significantly improves screen reader comprehension of UI state compared to just relying on visual active classes.
**Action:** Always ensure that toggle buttons manipulating UI or state include appropriate ARIA interaction states (`aria-expanded`, `aria-pressed`, `aria-controls`) alongside descriptive labels.
