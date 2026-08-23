## 2024-05-17 - Dynamic ARIA Labels for Toggles
**Learning:** Icon-only buttons used for state toggling (like "Show/Hide Password" or API keys) lose context for screen readers when their visual state changes. A static `aria-label` or `title` is insufficient because the button's action changes based on state.
**Action:** Always dynamically bind `:aria-label` using a ternary operator reflecting the *next* action (e.g., `:aria-label="showPassword ? 'Hide password' : 'Show password'"`) rather than a static description of the component.
