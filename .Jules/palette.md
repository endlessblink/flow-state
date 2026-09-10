## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-18 - Missing ARIA labels in canvas context menu
**Learning:** Icon-only and minimally-labeled buttons in complex components like the canvas context menu (e.g. alignment grids) often rely solely on title attributes for description, which are inconsistently read by screen readers.
**Action:** Ensure all icon-heavy submenus explicitly duplicate title text into aria-label attributes to guarantee robust screen reader support.

## 2024-05-18 - Missing ARIA labels on Unified Inbox action buttons
**Learning:** Icon-only buttons or buttons that contain mostly icons within selection bars (e.g., UnifiedInboxList) often lack `aria-label`s, causing screen readers to read confusing or unhelpful context, relying on inconsistent `title` attribute support.
**Action:** When creating utility buttons that utilize an icon and brief text or just an icon, consistently duplicate the `title` attribute string into the `aria-label` attribute to ensure screen reader compatibility.
