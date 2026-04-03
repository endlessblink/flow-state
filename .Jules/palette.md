## 2024-04-03 - Added ARIA labels to calendar buttons

## 2024-04-03 - Accessible Dropdown Triggers and Icon-Only Button Focus
**Learning:** Custom dropdown triggers (like `.quick-task-trigger`) often lack implicit semantic roles; they need `aria-haspopup="dialog"` (or `menu`/`listbox`) and `:aria-expanded="state"` to communicate effectively with screen readers. Additionally, icon-only action buttons within popovers or dropdowns frequently miss explicit `:focus-visible` styles, rendering them inaccessible to keyboard users navigating through the popup's items. Setting opacity on hover is not enough; we must also set opacity to 1 on `:focus-visible`.
**Action:** Whenever creating a custom dropdown/popover, explicitly add `aria-haspopup` and `aria-expanded` to the trigger. For any icon-only action buttons inside, apply `aria-label` and the standard `:focus-visible` outline (`outline: 2px solid var(--brand-primary); outline-offset: 2px;`), ensuring they have `opacity: 1` when focused.
