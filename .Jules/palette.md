## 2024-08-16 - Dynamic ARIA labels for Toggle Buttons
**Learning:** When a toggle button switches its icon based on state (e.g., Eye/EyeOff for passwords, or a generic toggle without text), a static `aria-label` is insufficient because the action the button performs changes depending on the current state.
**Action:** Use a dynamic Vue binding (`:aria-label="condition ? 'Action A' : 'Action B'"`) corresponding to the boolean state of the toggle, ensuring screen readers announce the exact action the user will perform by clicking the button.
