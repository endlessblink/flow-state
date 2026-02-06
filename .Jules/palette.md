## 2026-02-06 - Associate Helper Text with Inputs
**Learning:** Helper text rendered visually below inputs is often missed by screen reader users if not programmatically associated with the input field.
**Action:** When creating input components with helper text, generate a unique ID for the helper text element and link it to the input using `aria-describedby`. This ensures the hint is announced when the user focuses the input.
