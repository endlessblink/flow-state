# Palette's Journal 🎨

## 2025-02-23 - BaseCard Interactive Accessibility
**Learning:** The `BaseCard` component is often used as an interactive element (with `hoverable` prop) but lacked proper semantics. It was just a `div` with a click handler, making it inaccessible to keyboard and screen reader users.
**Action:** When creating generic container components that can be interactive, always conditionally apply `role="button"`, `tabindex="0"`, and keyboard handlers (Enter/Space) to ensure they function as buttons for all users. Ensure synthetic MouseEvents are created for keyboard handlers if the emit signature strictly expects MouseEvents. Also ensure distinct focus styles (e.g., `:focus-visible`) are present using existing design tokens.
