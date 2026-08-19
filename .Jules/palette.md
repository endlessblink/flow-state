## 2024-07-27 - Dynamic ARIA labels for icon-only toggles
**Learning:** Icon-only toggle buttons (like show/hide password, show/hide API key) need dynamic `:aria-label` attributes that update based on their current state, so screen readers can announce the correct action rather than a static label.
**Action:** When adding `aria-label` to toggle buttons, use a ternary operator bound to the same state used for the icon (e.g., `:aria-label="showPassword ? 'Hide password' : 'Show password'"`).
