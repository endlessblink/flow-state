
## 2024-05-30 - Added ARIA labels to QuickTaskDropdown buttons
**Learning:** Found several icon-only buttons in the `QuickTaskDropdown.vue` component that relied solely on `title` attributes for accessibility. While `title` provides visual hover tooltips, it is not consistently announced by screen readers, making these critical actions (like Quick Pin, Start Timer, Unpin) inaccessible.
**Action:** When creating or reviewing UI components with icon-only actions, always ensure an explicit `aria-label` is provided alongside or instead of a `title` attribute. If preserving the visual tooltip is desired, duplicate the text into `aria-label` to ensure both visual and screen reader users receive the context.
