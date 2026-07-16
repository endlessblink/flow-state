
## 2024-05-14 - Accessible segmented controls (View Selectors)
**Learning:** Segmented controls and custom toggle groups (like view mode selectors) can be ambiguous to screen readers if they lack structural grouping and active state communication. Relying only on visual active classes leaves assistive technologies guessing which option is currently selected.
**Action:** When implementing segmented controls or toggle groups, always apply `role="group"` and an appropriate `aria-label` to the container. Additionally, dynamically bind `:aria-pressed` (or `:aria-checked`/`:aria-selected`) to each option button to correctly expose the active/selected state to screen readers instead of relying solely on an active CSS class.
