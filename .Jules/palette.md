## 2024-05-14 - Keyboard Access for Task Actions
**Learning:** Hover-revealed action buttons inside `.task-actions` arrays (like "Start Timer" and "Remove") were completely inaccessible to keyboard users because `opacity: 0` combined with lack of `:focus-within` on the container meant tabbing through the document would visually hide the focused state.
**Action:** Adding `.slot-task:focus-within .task-actions { opacity: 1; }` ensures that keyboard navigation correctly reveals these crucial interaction points when a user tabs into the hidden buttons.
