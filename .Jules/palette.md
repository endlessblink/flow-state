# Palette's Journal

## 2024-05-23 - Accessible Toggle Buttons
**Learning:** Toggle buttons (like priority selectors) often rely solely on visual cues (e.g., active class) for state. Screen readers need `aria-pressed` or `aria-selected` to understand the current selection.
**Action:** Always add `aria-pressed="condition"` to buttons that toggle a state or selection, even if they are part of a group acting as radio buttons.
