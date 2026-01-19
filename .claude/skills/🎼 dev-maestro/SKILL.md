---
name: dev-maestro
description: Start Dev Maestro dashboard for MASTER_PLAN.md tasks. Use when user says "start maestro", "open kanban", or "show tasks".
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
