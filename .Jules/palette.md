## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.
## 2024-03-24 - Accessibility pattern for icon-only dynamic utility buttons
**Learning:** Common icon-only clear/trigger buttons (like clear date, clear project) embedded within input groups often lack accessibility context despite having visual cues (like an X icon) or layout proximity.
**Action:** When auditing forms and complex inputs, systematically verify that utility buttons used for clearing state or opening popovers possess explicit text alternatives (like `aria-label`).
