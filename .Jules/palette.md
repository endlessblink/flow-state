## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.
## 2024-05-19 - Vue defineEmits ordering
**Learning:** In Vue 3 `<script setup>` contexts, compiler macros like `defineEmits` and `defineProps` must be declared as the very first statements (immediately after any imports or type definitions) to satisfy the `vue/define-macros-order` ESLint rule.
**Action:** When modifying Vue components, always ensure `defineEmits` and `defineProps` remain at the top of the script block to prevent linting failures.
