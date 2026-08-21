## 2024-08-21 - Account Settings Accessbility
**Learning:** Found instances where toggle buttons (e.g. show/hide password, copy token) lacked ARIA labels to describe their dynamically changing state, impacting screen reader capability.
**Action:** Always dynamically bind `:aria-label` based on state in toggle buttons rather than static strings if the action/purpose changes (e.g., `showPassword ? 'Hide password' : 'Show password'`).
