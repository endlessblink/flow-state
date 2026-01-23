# SOP: Dev Maestro MASTER_PLAN.md Parser Troubleshooting

**Created**: January 23, 2026
**Last Updated**: January 23, 2026
**Related Bug**: TASK-323 parsing fix

## Overview

Dev Maestro parses `docs/MASTER_PLAN.md` to display tasks in the Kanban view. When tasks show incorrect status (e.g., "PLANNED" instead of "DONE"), the issue is usually in the parser logic in `dev-maestro/kanban/index.html`.

## Parser Architecture

### Parsing Order (Important!)

The parser processes MASTER_PLAN.md in this order:

1. **Section Headers** (`## Active Work`, `## Roadmap`, etc.) - Sets `currentSection`
2. **Task Headers** (`### TASK-XXX: Title (STATUS)`) - Creates initial task entry
3. **Summary Table Rows** (`| TASK-XXX | Title | Priority | Status |`) - Merges into existing tasks
4. **Metadata Lines** (`**Status**:`, `**Priority**:`) - Overrides task properties
5. **Subtask Lines** (`- [ ] item` or `- [x] item`) - Updates progress

### Recognized Sections (Critical!)

The parser ONLY processes tasks under these `##` sections:

| Section | Variable | Tasks Go To |
|---------|----------|-------------|
| `## Ideas` | `ideas` | Idea pool |
| `## Roadmap` | `roadmap` | Roadmap (near-term/later) |
| `## Current Status` | `activeWork` | Kanban board |
| `## Active Work` | `activeWork` | Kanban board |
| `## Known Issues` | `issues` | Issues list |
| `## Archive` | `archive` | Archive |
| `## Technical Debt` | `activeWork` | Kanban board |

**Tasks under unrecognized sections (e.g., `## PWA Prerequisites`) will NOT appear in the Kanban!**

### Common Bug: Task Under Wrong Section

If a task shows as "PLANNED" or doesn't appear at all:

1. Check which `##` section it's under in MASTER_PLAN.md
2. If under an unrecognized section, move the detailed entry to `## Active Work`
3. Or add the section to the parser's recognized sections list

### Key Insight: Merge Logic Must Be Consistent

When a task appears in BOTH a `###` header AND a summary table row, the parser must **merge** properties correctly. This is where bugs hide.

## Common Bug Pattern: Inconsistent Property Merging

### The Bug (TASK-323 Fix)

```javascript
// BUG items had this logic:
if (id.startsWith('BUG-')) {
  if (existingInActiveWork) {
    // ✅ Status WAS being merged
    if (isDone && existingInActiveWork.status !== 'done') {
      existingInActiveWork.status = 'done';
      existingInActiveWork.progress = 100;
    }
  }
}

// TASK items were MISSING this logic:
if (id.startsWith('TASK-')) {
  if (existingTask) {
    // ❌ Only priority and notes were merged
    // ❌ Status was NOT merged - BUG!
  }
}
```

### The Fix

Always ensure ALL entity types (TASK, BUG, ISSUE, ROAD, FEATURE) have consistent merge logic:

```javascript
// For EVERY entity type, merge status:
if (isDone && existingTask.status !== 'done') {
  existingTask.status = 'done';
  existingTask.progress = 100;
}
```

## Debugging Checklist

When a task shows wrong status in Dev Maestro:

### 0. Check Section Membership (Most Common Issue!)

```bash
# Find which ## section contains the task's detailed entry
grep -B50 "### TASK-XXX" docs/MASTER_PLAN.md | grep "^## " | tail -1
```

If the section is NOT one of the recognized sections (see table above), the task won't be parsed correctly!

**Fix**: Move the detailed `### TASK-XXX` entry under `## Active Work` or add the section to the parser.

### 1. Verify MASTER_PLAN.md Content

```bash
# Check how many times the task ID appears
grep -n "TASK-XXX" docs/MASTER_PLAN.md

# Look for strikethrough and DONE markers
grep "~~TASK-XXX~~" docs/MASTER_PLAN.md
grep "TASK-XXX.*DONE" docs/MASTER_PLAN.md
```

**Expected**: Task should be marked in ALL 3 locations:
- Summary table (~lines 100-200): `| ~~**TASK-XXX**~~ | ✅ **DONE** ...`
- Subtasks list: `- ~~TASK-XXX~~: Description ✅`
- Detailed section: `#### ~~TASK-XXX~~: Title (✅ DONE)`

### 2. Check Parser Logic in kanban/index.html

Search for the entity prefix handling:

```bash
grep -n "startsWith('TASK-')" dev-maestro/kanban/index.html
grep -n "startsWith('BUG-')" dev-maestro/kanban/index.html
```

Compare the merge logic for each entity type. They should be consistent.

### 3. Check Browser DevTools

1. Open Dev Maestro Kanban: `http://localhost:6010/kanban/`
2. Open DevTools Console (F12)
3. Type: `MASTER_PLAN_DATA.activeWork.find(t => t.id === 'TASK-XXX')`
4. Check the `status` and `progress` fields

### 4. Check API Response

```bash
curl -s http://localhost:6010/api/master-plan | jq '.content' | grep -A5 "TASK-XXX"
```

This shows what the server is sending - should match the file content.

### 5. Clear Browser Cache

The API uses cache-busting (`?t=Date.now()`), but the browser may cache aggressively:
- Hard refresh: Ctrl+Shift+R
- Or open in incognito mode

## Parser Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Main parser function | `dev-maestro/kanban/index.html` | ~5200-5735 |
| Status parsing | `parseTaskStatus()` | ~5216-5280 |
| Table row parsing | Table handling block | ~5598-5686 |
| Header parsing | `### TASK-XXX` regex | ~5411-5450 |
| Status merge (BUG) | BUG handling | ~5640-5656 |
| Status merge (TASK) | TASK handling | ~5671-5683 |
| Status merge (ISSUE) | ISSUE handling | ~5657-5670 |

## Prevention Checklist

When modifying the parser:

- [ ] If adding merge logic for one entity type, add it for ALL entity types
- [ ] Test with tasks that appear in both table AND detailed section
- [ ] Verify strikethrough (`~~`) detection works for the entity type
- [ ] Check both `isDone` detection and status merge code paths
- [ ] Test with a hard browser refresh after changes

## Test Cases

Create test entries in MASTER_PLAN.md to verify parser:

```markdown
<!-- In summary table -->
| ~~**TASK-TEST**~~ | ✅ **DONE** Test Task | P2 | ✅ **DONE** |

<!-- In detailed section -->
### ~~TASK-TEST~~: Test Task (✅ DONE)
```

The task should appear as "done" in the Kanban view, not "todo" or "planned".

## Related Files

- `dev-maestro/kanban/index.html` - Main Kanban UI and parser
- `dev-maestro/server.js` - API server (serves MASTER_PLAN.md)
- `docs/MASTER_PLAN.md` - Source of truth for tasks
- `CLAUDE.md` - Documents 3-location marking requirement

## Contact

For parser issues, check:
1. This SOP first
2. Git history: `git log --oneline dev-maestro/kanban/index.html`
3. Search for "parser" or "parseTask" in codebase
