---
name: master-plan-auditor
description: Audit task status in MASTER_PLAN.md. Finds stale tasks, status mismatches, and likely-done tasks. NEVER auto-marks tasks - only recommends. User confirmation is the only valid evidence of completion.
---

# Master Plan Auditor

Read-only analysis of MASTER_PLAN.md. Provides recommendations with confidence scores.

**Philosophy**: User confirmation = done. Tests passing and commits existing are *evidence*, not *proof*.

## Quick Start

```
/audit-tasks
```

## Features

| Feature | Description |
|---------|-------------|
| **IN_PROGRESS Analysis** | Parse all IN_PROGRESS tasks, gather git/test evidence, calculate confidence score |
| **Status Sync Checker** | Verify all 3 MASTER_PLAN.md locations match (table, header, status line) |
| **Stale Task Detector** | Flag tasks with no git activity for 7+ days |
| **Orphan Finder** | Task IDs in git/code but not in MASTER_PLAN.md |

---

## Workflow

### Step 1: Parse MASTER_PLAN.md

Read `docs/MASTER_PLAN.md` and extract all tasks with their statuses from all 3 locations.

#### Location Detection Patterns

**Location 1: Summary Table**
```markdown
| **TASK-XXX** | Feature Name | Priority | 🔄 **IN PROGRESS** | ... |
| ~~**TASK-XXX**~~ | ✅ **DONE** Feature Name | Priority | ✅ **DONE** (date) | ... |
```

Regex pattern:
```
\| \*\*(?:~~)?(?<id>TASK-\d+|BUG-\d+|ISSUE-\d+|ROAD-\d+|IDEA-\d+)(?:~~)?\*\* \|
```

**Location 2: Subtasks/Bullet Lists**
```markdown
- TASK-XXX: Description
- ~~TASK-XXX~~: ✅ Description (completed)
```

Regex pattern:
```
^[-*] (?:~~)?(?<id>TASK-\d+|BUG-\d+|ISSUE-\d+|ROAD-\d+|IDEA-\d+)(?:~~)?:
```

**Location 3: Detailed Section Headers**
```markdown
#### TASK-XXX: Title (🔄 IN PROGRESS)
#### ~~TASK-XXX~~: Title (✅ DONE)
```

Regex pattern:
```
^#{3,4} (?:~~)?(?<id>TASK-\d+|BUG-\d+|ISSUE-\d+|ROAD-\d+|IDEA-\d+)(?:~~)?:.*\((?<status>[^)]+)\)
```

#### Status Detection (Priority Order)

| Pattern | Detected Status |
|---------|-----------------|
| `~~` wrapping ID | done |
| `DONE`, `FIXED`, `COMPLETE`, `✅` | done |
| `REVIEW`, `MONITORING`, `👀` | review |
| `IN PROGRESS`, `IN_PROGRESS`, `🔄` | in_progress |
| `PAUSED`, `⏸️` | paused |
| `PLANNED`, `📋` | planned |
| Default | planned |

### Step 2: Gather Evidence for IN_PROGRESS Tasks

For each task that is NOT done:

```bash
# Count commits mentioning task
git log --oneline --all --grep="TASK-XXX" | wc -l

# Get last activity date
git log -1 --format=%ci --all --grep="TASK-XXX" 2>/dev/null || echo "never"

# Check for completion keywords in recent commits
git log --oneline --all --grep="TASK-XXX" | head -5 | grep -iE "(fix|implement|complete|done|finish|close)" || true

# Check if related tests exist
grep -r "TASK-XXX\|$(echo 'Feature keywords')" tests/ src/ --include="*.spec.ts" --include="*.test.ts" -l 2>/dev/null | head -3
```

### Step 3: Calculate Confidence Scores

**Confidence Score (0-100)** - Higher = more likely done:

| Evidence | Points |
|----------|--------|
| Commit message contains "fix/implement/complete/done" | +30 |
| 3+ commits mentioning task | +20 |
| Related tests exist | +15 |
| Activity within last 2 days | +10 |

**Interpretation:**
- 70-100: Likely done (recommend verification)
- 40-69: Possibly done (needs investigation)
- 0-39: Still in progress

### Step 4: Check Status Sync Across Locations

Compare status in all 3 locations for each task:

```bash
# Get all occurrences of a task ID
grep -n "TASK-XXX" docs/MASTER_PLAN.md
```

**Mismatch examples:**
- Table says `🔄 IN PROGRESS` but header says `(✅ DONE)`
- ID has `~~strikethrough~~` but status column says `PLANNED`
- Bullet says `✅` but detailed section says `PAUSED`

### Step 5: Detect Stale Tasks

Tasks with no git activity for 7+ days:

```bash
# Get days since last activity
last_commit=$(git log -1 --format=%ct --all --grep="TASK-XXX" 2>/dev/null)
now=$(date +%s)
days_ago=$(( (now - last_commit) / 86400 ))

if [ $days_ago -gt 7 ]; then
  echo "STALE: TASK-XXX - $days_ago days since last activity"
fi
```

### Step 6: Find Orphan Task IDs

Task IDs mentioned in git but not in MASTER_PLAN.md:

```bash
# Get all task IDs from git history
git log --oneline --all | grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+" | sort -u > /tmp/git-tasks.txt

# Get all task IDs from MASTER_PLAN.md
grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+" docs/MASTER_PLAN.md | sort -u > /tmp/plan-tasks.txt

# Find orphans (in git but not in plan)
comm -23 /tmp/git-tasks.txt /tmp/plan-tasks.txt
```

---

## Output Report Format

```markdown
# Task Audit Report

**Generated**: [timestamp]
**MASTER_PLAN.md**: docs/MASTER_PLAN.md

## Summary

| Category | Count |
|----------|-------|
| Likely Done (needs verification) | X |
| Still In Progress | X |
| Stale (>7 days) | X |
| Status Inconsistencies | X |
| Orphan IDs | X |

---

## Likely Done (Confidence ≥70)

These tasks have strong evidence of completion. **User verification required.**

### TASK-XXX: [Title]

| Metric | Value |
|--------|-------|
| Confidence | 85/100 |
| Last Activity | 2 days ago |
| Commits | 5 |

**Evidence:**
- Commit `abc123`: "fix: implement TASK-XXX feature complete"
- Tests exist: `tests/feature.spec.ts`
**To mark done:**
```bash
# Update all 3 locations in MASTER_PLAN.md:
# 1. Table: | ~~**TASK-XXX**~~ | ✅ **DONE** ... |
# 2. Bullet: - ~~TASK-XXX~~: ✅ ...
# 3. Header: #### ~~TASK-XXX~~: ... (✅ DONE)
```

---

## Still In Progress

These tasks show ongoing work.

### TASK-YYY: [Title]

| Metric | Value |
|--------|-------|
| Confidence | 35/100 |
| Last Activity | Today |
| Commits | 2 |

**Recent commits:**
- `def456`: "wip: TASK-YYY initial setup"

---

## Stale Tasks (>7 Days)

No git activity detected. Consider: resume, pause, or mark done.

| Task | Days Stale | Last Activity |
|------|------------|---------------|
| TASK-ZZZ | 14 days | 2026-01-11 |

**Recommendations:**
- Resume work → update status to `🔄 IN PROGRESS`
- Pause → update status to `⏸️ PAUSED`
- Already done → verify with user, then mark `✅ DONE`

---

## Status Inconsistencies

These tasks have different statuses in different locations.

### TASK-AAA

| Location | Line | Status Found |
|----------|------|--------------|
| Table | 45 | `🔄 IN PROGRESS` |
| Header | 312 | `(✅ DONE)` |

**Fix:** Update line 45 to match line 312 (or vice versa).

---

## Orphan Task IDs

Found in git history but not in MASTER_PLAN.md.

| Task ID | Commit | Suggestion |
|---------|--------|------------|
| TASK-999 | `abc123` | Add to MASTER_PLAN.md or archive |

---

## Next Steps

1. **Verify likely-done tasks** with user, then run `/done TASK-XXX`
2. **Fix inconsistencies** by updating all 3 locations
3. **Resume or close stale tasks** based on project priorities
```

---

## Important Rules

1. **NEVER auto-mark tasks as done** - Only provide recommendations
2. **User confirmation is required** - Tests/commits are evidence, not proof
3. **Check all 3 locations** - Table, bullets, detailed headers
5. **Confidence scores guide priority** - High confidence = verify first

---

## Stale Threshold Configuration

Default: 7 days

The stale threshold can be mentioned in the audit request:
```
/audit-tasks --stale-days=14
```

---

## Integration with Other Skills

| Skill | How Auditor Relates |
|-------|---------------------|
| `/done` | Auditor recommends, `/done` executes the marking |
| `/dev-maestro` | Both parse MASTER_PLAN.md, use same patterns |
| `/smart-doc-manager` | For MASTER_PLAN.md structural updates |

---

## Troubleshooting

### No Git History for Task

If a task has no commits mentioning it:
- Confidence: 0
- Status: Based on MASTER_PLAN.md text only
- Recommendation: Verify manually

### Parser Missed a Task

If a task exists but wasn't found:
- Check the section header format
- Ensure task ID format matches: `TASK-XXX`, `BUG-XXX`, etc.
- Verify the section is a recognized type (Roadmap, Active Work, etc.)
