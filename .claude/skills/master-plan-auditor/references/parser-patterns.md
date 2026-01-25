# Parser Patterns Reference

Reusable patterns for parsing MASTER_PLAN.md task status. Aligned with dev-maestro parser.

---

## Task ID Patterns

### Supported Prefixes

| Prefix | Usage |
|--------|-------|
| `TASK-` | Active work features/tasks |
| `BUG-` | Bug fixes |
| `ROAD-` | Roadmap items |
| `IDEA-` | Ideas |
| `ISSUE-` | Known issues |

### ID Regex

```regex
(TASK|BUG|ROAD|IDEA|ISSUE)-\d+
```

---

## Location Patterns

### Location 1: Summary Table

**Pattern:**
```markdown
| **TASK-123** | Feature Name | P2 | 🔄 **IN PROGRESS** | deps |
| ~~**TASK-123**~~ | ✅ **DONE** Feature Name | P2 | ✅ **DONE** (2026-01-25) | deps |
```

**Extraction regex:**
```regex
^\| \*\*(?<strikethrough>~~)?(?<id>(?:TASK|BUG|ROAD|IDEA|ISSUE)-\d+)(?:~~)?\*\* \|(?<rest>.+)$
```

**Key indicators:**
- `~~` around ID = done
- Status column (4th) contains status text/emoji

---

### Location 2: Bullet/Subtask Lists

**Pattern:**
```markdown
- TASK-123: Description
- ~~TASK-123~~: ✅ Description (done)
```

**Extraction regex:**
```regex
^[-*]\s+(?<strikethrough>~~)?(?<id>(?:TASK|BUG|ROAD|IDEA|ISSUE)-\d+)(?:~~)?:\s*(?<rest>.+)$
```

**Key indicators:**
- `~~` around ID = done
- `✅` after colon = done

---

### Location 3: Detailed Section Headers

**Pattern:**
```markdown
#### TASK-123: Title (🔄 IN PROGRESS)
#### ~~TASK-123~~: Title (✅ DONE)
### TASK-123: Title (📋 PLANNED)
```

**Extraction regex:**
```regex
^#{3,4}\s+(?<strikethrough>~~)?(?<id>(?:TASK|BUG|ROAD|IDEA|ISSUE)-\d+)(?:~~)?:\s*(?<title>[^(]+)\((?<status>[^)]+)\)
```

**Key indicators:**
- `~~` around ID = done
- Status in parentheses at end

---

## Status Detection Priority

Parse in this order (first match wins):

| Priority | Pattern | Status |
|----------|---------|--------|
| 1 | `~~` wrapping ID | `done` |
| 2 | `/DONE\|FIXED\|COMPLETE/i` | `done` |
| 3 | `✅` emoji | `done` |
| 4 | `/REVIEW\|MONITORING/i` | `review` |
| 5 | `👀` emoji | `review` |
| 6 | `/IN.?PROGRESS/i` | `in_progress` |
| 7 | `🔄` emoji | `in_progress` |
| 8 | `/PAUSED/i` | `paused` |
| 9 | `⏸️` emoji | `paused` |
| 10 | `/PLANNED/i` | `planned` |
| 11 | `📋` emoji | `planned` |
| 12 | Default | `planned` |

---

## Status Normalization

Map detected status to canonical form:

```javascript
const STATUS_MAP = {
  // Done variants
  'done': 'done',
  'fixed': 'done',
  'complete': 'done',
  'completed': 'done',
  'finished': 'done',

  // Review variants
  'review': 'review',
  'monitoring': 'review',
  'testing': 'review',

  // In progress variants
  'in_progress': 'in_progress',
  'in progress': 'in_progress',
  'in-progress': 'in_progress',
  'wip': 'in_progress',
  'active': 'in_progress',

  // Paused variants
  'paused': 'paused',
  'blocked': 'paused',
  'on_hold': 'paused',

  // Planned variants
  'planned': 'planned',
  'todo': 'planned',
  'backlog': 'planned',
};
```

---

## Recognized Sections

MASTER_PLAN.md sections that the parser processes:

| Section | Header Pattern |
|---------|----------------|
| Current Status | `## Current Status` |
| Roadmap | `## Roadmap` |
| Active Work | `## Active Work` |
| Ideas | `## Ideas` |
| Known Issues | `## Known Issues` |
| Archive | `## Archive` |
| Technical Debt | `## Technical Debt` |

**Note:** Tasks under unrecognized section headers may not be parsed correctly.

---

## Consistency Checking

### What to Compare

For each task ID, extract status from all 3 locations and compare:

```
TASK-123:
  - Table (line 45): in_progress
  - Bullet (line 89): done  <- MISMATCH
  - Header (line 312): done
```

### Mismatch Resolution

| Locations Agree | Resolution |
|-----------------|------------|
| 2 of 3 agree | Update the 1 that differs |
| All 3 differ | Manual review needed |
| Only 1 found | Check if task has all locations |

---

## Edge Cases

### Strikethrough Without Done Status

```markdown
| ~~**TASK-123**~~ | Feature | P2 | 🔄 **IN PROGRESS** |
```

**Interpretation:** Treat as done (strikethrough takes precedence)
**Flag:** Inconsistency - status column should also say DONE

### Done Status Without Strikethrough

```markdown
| **TASK-123** | Feature | P2 | ✅ **DONE** |
```

**Interpretation:** Treat as done (explicit status)
**Flag:** Inconsistency - ID should have strikethrough

### Missing Parentheses on Header

```markdown
#### TASK-123: Title
```

**Interpretation:** Status = planned (default)
**Flag:** Missing status indicator

---

## Bash One-Liners

### Find All IN_PROGRESS Tasks

```bash
grep -nE "(🔄|IN.?PROGRESS)" docs/MASTER_PLAN.md | grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+" | sort -u
```

### Find All DONE Tasks

```bash
grep -nE "(✅|DONE|~~.*~~)" docs/MASTER_PLAN.md | grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+" | sort -u
```

### Find Tasks Missing Strikethrough

```bash
grep -nE "✅.*DONE" docs/MASTER_PLAN.md | grep -v "~~" | grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+"
```

### Find All Occurrences of a Task

```bash
grep -n "TASK-123" docs/MASTER_PLAN.md
```

### Count Occurrences Per Task

```bash
grep -oE "(TASK|BUG|ISSUE|ROAD|IDEA)-[0-9]+" docs/MASTER_PLAN.md | sort | uniq -c | sort -rn | head -20
```
