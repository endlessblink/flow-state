## 2024-05-22 - Custom Focus Styles for Interactive Elements
**Learning:** Custom interactive elements (e.g., stylized buttons in `QuickSortCard.vue`) often lack default browser focus indicators or have them suppressed by reset styles. This makes keyboard navigation impossible for users relying on visual cues.
**Action:** Always explicitly define `:focus-visible` styles (using `outline` and `box-shadow`) for custom interactive components to ensure they are accessible to keyboard users.
