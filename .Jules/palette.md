# Palette UX Journal

## 2024-05-18 - Missing aria-label on icon-only buttons
**Learning:** Icon-only buttons often rely only on the `title` attribute for screen readers. However, `title` handling is inconsistent across screen readers, leading to poor accessibility for visually impaired users.
**Action:** When adding or reviewing icon-only buttons, always explicitly set the `aria-label` attribute (or dynamically bind `:aria-label`) to match the `title` text.
