## 2024-05-27 - [BaseDropdown ARIA roles missing]
**Learning:** The custom `<BaseDropdown>` component is missing necessary `role="combobox"` on the trigger, as well as `aria-expanded`, `aria-controls` and `aria-haspopup`. These properties are explicitly required per the custom dropdown component guidelines from memory (and general WAI-ARIA authoring practices).
**Action:** Ensure custom dropdowns implement the combobox pattern correctly with focus managed on the trigger.
