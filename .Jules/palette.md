## 2024-05-23 - Dynamic ARIA Labels in Lists
**Learning:** Repetitive action buttons (like "Edit", "Delete") in lists or tables are inaccessible if they all have the same static ARIA label. Screen reader users cannot distinguish which item the action applies to.
**Action:** Always include the item's unique identifier (like title or name) in the `aria-label` (e.g., "Edit [Task Title]") to provide context.
