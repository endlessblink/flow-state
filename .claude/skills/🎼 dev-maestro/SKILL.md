---
name: dev-maestro
description: Start Dev Maestro dashboard for MASTER_PLAN.md tasks. Use when user says "start maestro", "open kanban", or "show tasks".
---

# Dev Maestro Skill

## QUICK REFERENCE

| Item | Value |
|------|-------|
| URL | http://localhost:6010 |
| Install | `~/.dev-maestro` |
| Port | 6010 |

## WHEN TO USE

- User says "start maestro" / "open kanban" / "show tasks"
- User wants to see MASTER_PLAN.md visually
- User asks about task status in Kanban view

## WHEN NOT TO USE

- User is working on their main project (Dev Maestro is a tool, not a target)
- User didn't mention Dev Maestro
- You're tempted to "improve" or extend Dev Maestro

## WORKFLOW

### Step 1: Check if Running
```bash
curl -s http://localhost:6010/api/status 2>/dev/null && echo "RUNNING" || echo "NOT RUNNING"
```

### Step 2: Start if Needed

**Option A - Project has launcher:**
```bash
./maestro.sh
```

**Option B - Direct start:**
```bash
cd ~/.dev-maestro && npm start &
```

**Option C - Not installed:**
```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh | bash
```

### Step 3: Tell User
> "Dev Maestro is running at http://localhost:6010"

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

**Port 6010 in use:**
```bash
lsof -ti:6010 | xargs kill -9 && cd ~/.dev-maestro && npm start &
```

**MASTER_PLAN.md not found:**
```bash
# Check current path
curl -s localhost:6010/api/status | jq '.masterPlanPath'

# Reconfigure
cd ~/.dev-maestro && ./install.sh --reconfigure
```
