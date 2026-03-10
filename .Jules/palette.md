# Palette UX Guidelines

## 2025-03-10 - [Semantic ARIA roles and Focus States for Custom Tab Navigations]
**Learning:** Custom tabbed navigation interfaces built with native `<button>` elements require complete ARIA relationships (`role='tablist'`, `role='tab'`, `aria-selected`, `aria-controls`, `id`) and explicit `:focus-visible` styling to be fully accessible and usable for keyboard/screen reader users.
**Action:** When implementing or reviewing custom tabbed interfaces (like `CyberSectionNav.vue`), always ensure the container has `role="tablist"` and tabs have `role="tab"` with `aria-selected` tracking the active state, and verify that keyboard focus is visually apparent using existing design tokens.
