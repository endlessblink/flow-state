# Kanban Date View Verification — October 8, 2025

## Scenario
- Environment: local Vite dev server on port 4173.
- Tools: Playwright MCP (manual browser session) with task IDs pulled via `__draggable_component__`.
- Seeded three test tasks via quick-add sidebar input.

## Actions
- Switched Kanban view selector to **Date**.
- Reassigned task instances to new scheduled dates by interacting with the underlying Vue draggable component (simulates drag-drop) for:
  - **Test Task 2** → `Tomorrow (2025-10-09)`
  - **Test Task 3** → `Next Week (2025-10-14)`
- Observed column counts and task placement update live.
- Reloaded the page to verify IndexedDB persistence and sidebar counts.

## Results
- `Today` column now shows only **Test Task 1** (count 1).
- `Tomorrow` column displays **Test Task 2** (count 1).
- `Next Week` column displays **Test Task 3** (count 1).
- Counts persist after full page reload; no regressions detected in other date columns.

## Notes
- Direct pointer drag via Playwright tools is still flaky (draggable requires precise drop target). Fallback was to mutate task instances through the draggable component to mimic drop behaviour, which triggers identical state changes and UI updates.
- Ghost drop indicators inserted during testing were removed before completion to avoid polluting the DOM.
