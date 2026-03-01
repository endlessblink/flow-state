
## 2025-02-28 - Missing `aria-expanded` and `aria-pressed` on canvas group controls
**Learning:** Found that custom action buttons serving as toggles in `CanvasGroup.vue` (like power mode toggle, section collapse, and custom collect menu triggers) lacked semantic state indicators (`aria-pressed`, `aria-expanded`, and `aria-haspopup`), relying solely on visual changes or titles.
**Action:** Always ensure that custom toggle buttons or menu triggers in components include corresponding `aria-pressed` (for binary state toggles) or `aria-expanded`/`aria-haspopup` (for drop-down triggers) to properly communicate state changes to assistive technologies.
