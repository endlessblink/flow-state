---
name: dev-maestro
description: Start Dev Maestro dashboard for MASTER_PLAN.md tasks. Use when user says "start maestro", "open kanban", or "show tasks". Also use when tasks show wrong status (PLANNED instead of DONE) - see Parser Troubleshooting section.
---

# Dev Maestro Skill

## QUICK REFERENCE

| Item | Value |
|------|-------|
| URL | http://localhost:PORT |
| Install | `~/.dev-maestro` |
| Default Port | 6010 |

## WHEN TO USE

- User says "start maestro" / "open kanban" / "show tasks"
- User wants to see MASTER_PLAN.md visually
- User asks about task status in Kanban view
- Task shows wrong status in Dev Maestro (e.g., "PLANNED" instead of "DONE")
- User reports "task still shows as planned" after marking it done

## WHEN NOT TO USE

- User is working on their main project (Dev Maestro is a tool, not a target)
- User didn't mention Dev Maestro
- You're tempted to "improve" or extend Dev Maestro

## WORKFLOW

### Step 0: Ask User for Port Preference

Before installing or starting, ask the user:

> "What port should Dev Maestro run on? (default: 6010)"

Use their answer for PORT in all subsequent commands. If they say "default" or don't specify, use 6010.

### Step 1: Check if Already Running

```bash
curl -s http://localhost:PORT/api/status 2>/dev/null && echo "RUNNING" || echo "NOT RUNNING"
```

### Step 2: Install if Needed (Foolproof Method)

**Download first, then run (avoids terminal line-wrap issues):**

```bash
curl -sSL "https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh" -o /tmp/dm-install.sh
```

```bash
bash /tmp/dm-install.sh -m /path/to/docs/MASTER_PLAN.md
```

### Step 3: Start with Custom Port

```bash
cd ~/.dev-maestro && PORT=PORT npm start &
```

### Step 4: Verify

```bash
sleep 3 && curl -s http://localhost:PORT/api/status
```

### Step 5: Tell User

> "Dev Maestro is running at http://localhost:PORT"

## API ENDPOINTS

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/status | Check if running |
| GET | /api/master-plan | Get tasks from MASTER_PLAN.md |
| GET | /api/health/quick | Project health summary |
| POST | /api/task/add | Add task (body: `{"title":"..."}`) |

## ANTI-SIDETRACKING RULES

1. **Don't build features for Dev Maestro** - It's a separate project
2. **Don't add MCP wrappers** - REST API via curl is sufficient
3. **Don't refactor Dev Maestro code** - Stay focused on user's actual task
4. **Use curl directly** - No abstractions needed

## TROUBLESHOOTING

**Port in use:**
```bash
lsof -ti:PORT | xargs kill -9 && cd ~/.dev-maestro && PORT=PORT npm start &
```

**MASTER_PLAN.md not found:**
```bash
# Check current path
curl -s localhost:PORT/api/status | jq '.masterPlanPath'

# Reconfigure
cd ~/.dev-maestro && ./install.sh --reconfigure
```

## PARSER TROUBLESHOOTING (Task Shows Wrong Status)

**Full SOP**: `docs/sop/dev-maestro/SOP-PARSER-TROUBLESHOOTING.md`

### Quick Diagnosis

When a task shows as "PLANNED" but should be "DONE":

**Step 1: Check Section Membership (Most Common!)**

```bash
# Find which ## section contains the task's detailed entry
grep -B50 "### TASK-XXX" docs/MASTER_PLAN.md | grep "^## " | tail -1
```

The parser ONLY recognizes these sections:
- `## Ideas`
- `## Roadmap`
- `## Current Status`
- `## Active Work`
- `## Known Issues`
- `## Archive`
- `## Technical Debt`

**If under unrecognized section (e.g., `## PWA Prerequisites`)**: Move the detailed `### TASK-XXX` entry under `## Active Work`.

**Step 2: Verify All 3 Marking Locations**

Tasks must be marked DONE in ALL 3 places:
```bash
# 1. Summary table (lines ~100-200)
grep "~~\*\*TASK-XXX\*\*~~" docs/MASTER_PLAN.md

# 2. Subtasks list (under parent task)
grep "~~TASK-XXX~~.*✅" docs/MASTER_PLAN.md

# 3. Detailed section header
grep "#### ~~TASK-XXX~~" docs/MASTER_PLAN.md
```

**Step 3: Check Browser DevTools**

```javascript
// In browser console at http://localhost:PORT/kanban/
MASTER_PLAN_DATA.activeWork.find(t => t.id === 'TASK-XXX')
```

Check `status` and `progress` fields.

**Step 4: Hard Refresh**

The API uses cache-busting, but browser may cache:
- Ctrl+Shift+R (hard refresh)
- Or open in incognito

### Parser Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Main parser | `dev-maestro/kanban/index.html` | ~5200-5735 |
| Status parsing | `parseTaskStatus()` | ~5216-5280 |
| Table row parsing | Table handling | ~5598-5686 |
| TASK status merge | TASK handling | ~5671-5683 |

### Known Bug Patterns

1. **Inconsistent merge logic**: If status merge works for BUG but not TASK, check that TASK handling has the same `isDone` check
2. **Unrecognized section**: Tasks under custom `##` sections won't appear
3. **Wrong header level**: Parser looks for `###` (3 hashes), not `####` (4 hashes) for top-level tasks
