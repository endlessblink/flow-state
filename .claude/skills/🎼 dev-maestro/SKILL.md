---
name: dev-maestro
description: Start and manage Dev Maestro - the AI agent orchestration platform for Kanban task management. Use when user says "start maestro", "open kanban", "show tasks", or needs to manage MASTER_PLAN.md tasks visually. Detects if running, starts if needed.
---

# Dev Maestro

## What is Dev Maestro?

**AI Agent Orchestration Platform** providing:
- Kanban board for MASTER_PLAN.md tasks
- Multi-agent orchestration workflows
- Health scanning (TypeScript, ESLint, Knip, npm audit)
- Skills visualization
- Documentation canvas
- Project timeline

## Quick Reference

| Item | Value |
|------|-------|
| URL | http://localhost:6010 |
| Install Dir | `~/.dev-maestro` |
| Port | 6010 |
| Status API | http://localhost:6010/api/status |

## Instructions

### Check if Dev Maestro is Running

```bash
# Quick check
curl -s http://localhost:6010/api/status 2>/dev/null | grep -q '"running":true' && echo "Running" || echo "Not running"

# Get full status
curl -s http://localhost:6010/api/status | jq .
```

### Start Dev Maestro

**Option 1: Use project launcher (if exists)**
```bash
./maestro.sh
```

**Option 2: Direct start**
```bash
cd ~/.dev-maestro && npm start
```

**Option 3: With custom MASTER_PLAN.md path**
```bash
cd ~/.dev-maestro
MASTER_PLAN_PATH=/path/to/project/docs/MASTER_PLAN.md npm start
```

### Install Dev Maestro (if not installed)

```bash
curl -sSL https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh | bash
```

**With project integration:**
```bash
PROJECT_ROOT=/path/to/project curl -sSL https://raw.githubusercontent.com/endlessblink/dev-maestro/main/install.sh | bash
```

### Detection Methods

1. **Marker file**: Check for `.dev-maestro.json` in project root
2. **Status API**: `curl localhost:6010/api/status`
3. **Launcher script**: Check for `./maestro.sh` in project root

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/status | Check if running, get version/config |
| GET /api/master-plan | Get MASTER_PLAN.md content |
| GET /api/health | Run full health scan |
| GET /api/health/quick | Quick cached health check |
| GET /api/skills | Get skills data |
| GET /api/docs | Get documentation graph |

### Dashboard Views

1. **Kanban** - Task management from MASTER_PLAN.md
2. **Orchestrator** - Multi-agent workflow UI
3. **Skills** - Claude skills dependency graph
4. **Docs** - Documentation canvas
5. **Stats** - Project metrics
6. **Timeline** - Locks and dependencies
7. **Health** - Code quality dashboard

### Common Tasks

**View tasks:**
- Open http://localhost:6010 in browser
- Or use API: `curl localhost:6010/api/master-plan`

**Update task status:**
- Drag cards in Kanban UI
- Changes sync to MASTER_PLAN.md

**Check project health:**
```bash
curl -s localhost:6010/api/health/quick | jq '.summary'
```

### Troubleshooting

**Port 6010 already in use:**
```bash
lsof -ti:6010 | xargs kill -9
cd ~/.dev-maestro && npm start
```

**Server not starting:**
```bash
cd ~/.dev-maestro
npm install
npm start
```

**MASTER_PLAN.md not found:**
```bash
# Check current path
curl -s localhost:6010/api/status | jq '.masterPlanPath'

# Set correct path in .env
echo "MASTER_PLAN_PATH=/path/to/docs/MASTER_PLAN.md" >> ~/.dev-maestro/.env
```
