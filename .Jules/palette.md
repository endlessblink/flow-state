## 2026-02-07 - Linking Helper Text for Accessibility
**Learning:** Helper text in inputs is often visually associated but programmatically disconnected for screen readers. Simply rendering the text isn't enough; it must be linked via `aria-describedby`.
**Action:** When creating form components, always generate a unique ID for helper text and bind it to the input's `aria-describedby` attribute to ensure context is preserved for all users.
