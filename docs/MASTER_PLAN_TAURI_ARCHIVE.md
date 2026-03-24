# MASTER_PLAN — Tauri Task Archive

> **Archived**: 2026-03-24
> **Reason**: These tasks are deferred pending the Electron migration (TASK-1715). They are either Tauri/WebKitGTK-specific issues that will be resolved by switching rendering engines, or tasks that depend on fixing the Tauri environment before they can be addressed. They are preserved here for reference.
> **Source**: Extracted from `docs/MASTER_PLAN.md`

---

## Summary Table

| ID | Task | Priority | Status at Archive |
|----|------|----------|-------------------|
| BUG-1671 | Fix workspace migration — `workspace_id` column missing from tasks/projects/groups, `workspace_members` table missing. Migration fails due to `projects.id` type conflict (uuid vs text). | P0 | ⏸️ ARCHIVED (Tauri) |
| BUG-1675 | Fix Canvas view empty in E2E — Vue Flow nodes don't render for test user. Workspace query errors prevent task loading. | P0 | ⏸️ ARCHIVED (Tauri) |
| BUG-1676 | Fix Board view empty — kanban columns render but no task cards. Same workspace root cause. | P0 | ⏸️ ARCHIVED (Tauri) |
| BUG-1677 | Fix context menu positioning — right-click menu not appearing or appearing outside viewport bounds. | P2 | ⏸️ ARCHIVED (Tauri) |
| BUG-1678 | Fix tooltip z-index — tooltips render with z-index 'auto' instead of explicit value, may appear behind content. | P2 | ⏸️ ARCHIVED (Tauri) |
| BUG-1680 | Fix card border-radius not rendering — task cards missing rounded corners in some views. | P3 | ⏸️ ARCHIVED (Tauri) |
| BUG-1681 | Fix Inbox panel shows no content — inbox collapsed by default, badge/content not accessible. | P2 | ⏸️ ARCHIVED (Tauri) |
| BUG-1682 | Fix sidebar project names not loading — seeded project data not reaching sidebar due to workspace query errors. | P0 | ⏸️ ARCHIVED (Tauri) |
| BUG-1701 | E2E: Memory growth >20MB across create/delete cycles | P2 | ⏸️ ARCHIVED (Tauri) |
| BUG-1711 | Tauri: Task completion celebration overlay is see-through (should be opaque) | P2 | ⏸️ ARCHIVED (Tauri) |
| TASK-1712 | Tauri visual parity: task cards/UI degrade vs web app — need automated WebKitGTK visual regression | P1 | ⏸️ ARCHIVED (Tauri) |

---

## Detailed Sections

### BUG-1671: Workspace Migration Failure (⏸️ ARCHIVED)

- **Priority**: P0-CRITICAL
- **Root Cause**: `20260317000000_workspace_collaboration.sql` adds `workspace_id` to tasks/projects/groups and creates `workspace_members` table. Migration fails because `20260106000000_fix_id_types.sql` changes `projects.id` from uuid to text, but `pinned_tasks.project_id` FK still expects uuid. The FK constraint must be dropped/recreated first.
- **Impact**: ALL views fail to load data because every query now includes `.is('workspace_id', null)` which errors on missing column.
- **Fix**: Either fix the migration chain order, or manually drop the FK constraint before running migrations.

---

### BUG-1675 to BUG-1676: Empty Views (⏸️ ARCHIVED)

- **Priority**: P0-CRITICAL
- **Root Cause**: Caused by BUG-1671 (workspace migration). Fixing the migration fixes these.
- **Dependency**: BUG-1671

---

### BUG-1677: Context Menu Positioning (⏸️ ARCHIVED)

- **Priority**: P2
- **Symptom**: Right-click context menu not appearing or appearing outside viewport bounds.
- **Notes**: Likely a Tauri/WebKitGTK viewport coordinate issue. No detailed section was written before archival.

---

### BUG-1678: Tooltip Z-Index (⏸️ ARCHIVED)

- **Priority**: P2
- **Symptom**: Tooltips render with z-index `auto` instead of an explicit value, may appear behind content.
- **Notes**: Likely affects Tauri where stacking context behaves differently than in browser. No detailed section was written before archival.

---

### BUG-1680: Card Border-Radius Not Rendering (⏸️ ARCHIVED)

- **Priority**: P3
- **Symptom**: Task cards missing rounded corners in some views.
- **Notes**: Possible WebKitGTK CSS rendering quirk. No detailed section was written before archival.

---

### BUG-1681: Inbox Panel Shows No Content (⏸️ ARCHIVED)

- **Priority**: P2
- **Symptom**: Inbox collapsed by default, badge/content not accessible.
- **Notes**: No detailed section was written before archival.

---

### BUG-1682: Sidebar Project Names Not Loading (⏸️ ARCHIVED)

- **Priority**: P0
- **Symptom**: Seeded project data not reaching sidebar due to workspace query errors.
- **Dependency**: BUG-1671

---

### BUG-1701: Memory Growth >20MB (⏸️ ARCHIVED)

- **Priority**: P2 | **Confirmed by**: Playwright memory-perf test
- **Symptom**: Memory grows >20MB across create/delete cycles, suggesting leak in task store or Supabase subscriptions

---

### BUG-1711: Tauri Task Completion Celebration Overlay See-Through (⏸️ ARCHIVED)

- **Priority**: P2 | **Confirmed by**: User screenshot in Tauri production app
- **Symptom**: "Sweet!" celebration overlay with checkmark is transparent — background content visible through it. Should have opaque/glass background.
- **Root cause**: Likely same CSP issue as BUG-1674 — `backdrop-filter` or background styles not applying in Tauri production. Or `.tauri-app` override missing for this component.
- **Files**: `src/components/tasks/` (DoneToggle celebration overlay)

---

### TASK-1712: Tauri Visual Parity — Automated WebKitGTK Regression Testing (⏸️ ARCHIVED)

- **Priority**: P1 | **Type**: Infrastructure + Bug fixes
- **Problem**: Task cards, icons, overlays, and UI components look/work better in the web app than in Tauri. Multiple visual issues reported (BUG-1709 icons, BUG-1711 overlay, text overlap). No automated way to detect these before deploying.
- **Goal**: Build a testing pipeline that catches Tauri/WebKitGTK visual regressions BEFORE deployment, so Claude can fix them without the user manually testing each build.
- **Approach**:
  1. Extend `scripts/webkit-test.py` to run with `cargo tauri dev` (real Tauri IPC, not HTTP mock)
  2. Add screenshot comparison (baseline vs current) for each view
  3. Add checks for: element overlap, icon sizing, opacity, glass morphism, RTL text rendering
  4. Integrate into deploy pipeline (block deploy if visual regression detected)
- **Depends on**: Working `cargo tauri dev --no-dev-server-wait` workflow
- **Files**: `scripts/webkit-test.py`, `scripts/deploy-tauri-update.sh`, `tests/webdriver/`
