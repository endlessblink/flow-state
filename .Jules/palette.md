## 2026-06-19 - Keyboard Accessible Hover Actions
**Learning:** Hover-revealed actions on items like task cards must be natively focusable and utilize `:focus-within` on their parent container to ensure keyboard users can discover and interact with them. Removing `tabindex="-1"` and adding `:focus-within` solves this pattern gracefully.
**Action:** Always verify that elements revealed on hover are also revealed on `:focus-within` and are focusable via tab navigation.
