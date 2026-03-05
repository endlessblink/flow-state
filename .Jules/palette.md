## 2025-03-05 - Missing aria-haspopup and aria-expanded on dropdown triggers
**Learning:** Found that custom dropdown components missing `aria-haspopup` and `aria-expanded` attributes on trigger buttons hinder screen reader accessibility. Users won't know clicking opens a popup menu or what its current state is.
**Action:** When creating custom dropdown or popover elements using trigger buttons, always include `aria-haspopup="listbox"` (or appropriate role) and dynamically bind `:aria-expanded="isOpen"` on the trigger.
