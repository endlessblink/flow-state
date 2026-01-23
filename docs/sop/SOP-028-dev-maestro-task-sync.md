# SOP-028: Dev Maestro Task Status Sync Issues

## Problem
Tasks in Dev Maestro kanban show wrong status (e.g., "IN PROGRESS" when MASTER_PLAN.md says "DONE").

## Root Cause
MASTER_PLAN.md has tasks in **multiple locations**:
1. **Summary table** (~lines 25-200) - Quick reference with `| ID | Title | Status |`
2. **Detailed sections** - Full task details with `### TASK-XXX: Title (STATUS)`

Dev Maestro parses BOTH locations and can get confused when:
- Detailed section is under an unrecognized `## Section` header
- Status format doesn't match expected patterns
- Browser caches stale parsed data

## Fix Checklist

### Step 1: Update ALL occurrences in MASTER_PLAN.md
```bash
# Find all occurrences of the task
grep -n "TASK-XXX" docs/MASTER_PLAN.md
```

Update EACH location:
- **Summary table row**: Add `~~` strikethrough to ID, change status column to `✅ **DONE**`
- **Detailed section header**: Change `(📋 PLANNED)` to `(✅ DONE)`, add `~~` to ID

### Step 2: Restart Dev Maestro
```bash
# Kill and restart
lsof -i :6010 -t | xargs kill 2>/dev/null
cd ~/.dev-maestro && nohup npm start > /tmp/dev-maestro.log 2>&1 &
```

### Step 3: Hard refresh browser
- Press `Ctrl+Shift+R` (not just F5)
- Or clear localStorage for `localhost:6010`

### Step 4: Verify via browser console
Open DevTools (F12) → Console → Look for:
```
[DEBUG] TASK-XXX: { status: 'done', progress: 100, title: '...' }
```

## Dev Maestro Parser Logic

The parser determines status from:
1. **Strikethrough on ID**: `~~TASK-XXX~~` → done
2. **Status keywords in any cell**: `DONE`, `FIXED`, `✅` → done
3. **Parentheses in header**: `(✅ DONE)` → done
4. **`**Status**:` line** in detailed section → overrides header

Priority order: `**Status**:` line > header parentheses > table row

## Key Files
- Parser: `~/.dev-maestro/kanban/index.html` (lines 5700-5800)
- API: `~/.dev-maestro/server.js`
- Data source: `docs/MASTER_PLAN.md`

## Prevention
When marking tasks done, ALWAYS:
1. Run `grep "TASK-XXX" docs/MASTER_PLAN.md` to find ALL occurrences
2. Update each location with consistent status
3. Restart Dev Maestro if status doesn't update

---
**Created**: 2026-01-23
**Related**: TASK-260, BUG-342 debugging session
