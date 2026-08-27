## 2024-05-19 - Adding Tooltip and ARIA Label to Hidden Text Button
**Learning:** When using CSS (`display: none`) to hide text inside a button on mobile screens (creating an icon-only button), the button loses its accessible name for screen readers and doesn't provide a tooltip.
**Action:** Always add `aria-label` or `:aria-label` and `title` or `:title` attributes to the button itself, or bind them dynamically based on the hidden text's content, to maintain accessibility across all screen sizes.
