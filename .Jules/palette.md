## 2024-07-28 - Vue Boolean Prop Shorthand ESLint Rules
**Learning:** Vue ESLint rules in this repository enforce the shorthand syntax for boolean props passed as `true` (e.g. `vue/prefer-true-attribute-shorthand`). Passing `:close-on-click-outside="true"` will cause CI linting to fail.
**Action:** When adding or modifying boolean props in Vue templates that are explicitly set to true, always use the implicit shorthand (e.g., `close-on-click-outside`) rather than explicitly binding `"true"`.
