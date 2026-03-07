# SOP-031: Dev-Maestro MASTER_PLAN.md Parser Rules

## Parser Location
`~/.dev-maestro/kanban/index.html` - `parseMasterPlan()` function (line ~5955)

## Critical Rules

### 1. Section Detection
The parser recognizes these `##` sections:
- `## Ideas` → ideas section
- `## Roadmap` → roadmap section  
- `## Current Status` → activeWork
- `## Active Work` → activeWork
- `## Known Issues` → issues
- `## Archive` / `## Technical Debt` → archive
- **Any other `##` header** → resets to 'other' (not parsed)

**⚠️ Tasks in unrecognized sections (like "## Code Review Findings") are NOT parsed.**

### 2. Status Detection in Tables
Table rows detect status from cell text:
- **DONE**: `~~strikethrough~~`, "DONE", "FIXED", "✅"
- **IN PROGRESS**: "IN PROGRESS", "IN-PROGRESS", "🔄"
- **PAUSED**: "PAUSED", "⏸️", "ON HOLD"
- **REVIEW**: "REVIEW", "👀", "MONITORING"

### 3. Status Priority
When both `###` header and table row exist for a task:
- Table status is **authoritative** for DONE detection
- `###` header status is used for detailed section tasks

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Done task shows as IN PROGRESS | Task in unrecognized `##` section | Move to `## Archive` or add section to parser |
| Table task status wrong | Status emoji/text not in cell | Ensure status column has 🔄, ✅, etc. |
| Task not appearing | Not in recognized section | Check `##` header is recognized |

## Testing
After parser changes, restart Dev-Maestro:
```bash
lsof -ti :6010 | xargs -r kill -9
cd ~/.dev-maestro && npm start
```

Then hard-refresh browser (`Ctrl+Shift+R`).

---
Created: 2026-01-24
