---
name: add-task-master-plan
description: Add a new task to MASTER_PLAN.md with auto-generated ID. This skill should be used when the user wants to track a new task, bug, or feature in the project's master plan. Triggers on "add task to master plan", "new master plan task", "track this task", "/add-task-master-plan".
---

# Add Task to Master Plan

Add a new task to `docs/MASTER_PLAN.md` with proper ID generation and formatting.

## Workflow

### Step 1: Generate Unique Task ID

Run the ID generator script to get the next available ID:

```bash
node ./scripts/utils/get-next-task-id.cjs
```

Extract the next available ID number from the output (e.g., if output shows "NEXT AVAILABLE ID: TASK-301", use 301).

### Step 2: Gather Task Information

Use `AskUserQuestion` tool to collect:

**Question 1 - Task Type:**
- Header: "Task type"
- Options:
  - `TASK` - New feature or improvement
  - `BUG` - Bug fix
  - `FEATURE` - Major new feature

**Question 2 - Priority:**
- Header: "Priority"
- Options:
  - `P0` - Critical/Blocker
  - `P1` - High priority
  - `P2` - Medium priority
  - `P3` - Low priority

**Question 3 - Task Title:**
- Ask: "What is the task title? (Brief, descriptive name)"

**Question 4 - Description (Optional):**
- Ask: "Brief description of what needs to be done (or skip for simple tasks)"

### Step 3: Add to MASTER_PLAN.md

Insert the new task in the Roadmap table in `docs/MASTER_PLAN.md` using this format:

```markdown
| **[TYPE]-[ID]** | **[Title]** | **[Priority]** | IN PROGRESS | [Dependencies or -] |
```

Example:
```markdown
| **TASK-301** | **Implement Dark Mode Toggle** | **P2** | IN PROGRESS | - |
```

### Step 4: Add Active Work Section (if needed)

For P0/P1 tasks, also add a detailed section under "## Active Work (Summary)":

```markdown
### [TYPE]-[ID]: [Title] (IN PROGRESS)
**Priority**: [Priority]-[LEVEL]
**Status**: IN PROGRESS (YYYY-MM-DD)

[Description from user]

**Tasks**:
- [ ] [First step]
- [ ] [Additional steps as needed]
```

### Step 5: Confirm and Report

After adding the task:

1. Read back the added entry to confirm formatting
2. Report to user:
   - Task ID assigned (e.g., "TASK-301")
   - Location in MASTER_PLAN.md
   - Status set to "IN PROGRESS"

## Output Format

```
Task added to MASTER_PLAN.md:
- ID: [TYPE]-[ID]
- Title: [Title]
- Priority: [Priority]
- Status: IN PROGRESS

Ready to begin work on this task.
```

## Important Notes

- NEVER reuse existing task IDs
- Always run the ID generator script first
- Use strikethrough (~~ID~~) only when marking tasks DONE
- Keep task titles concise (under 50 characters when possible)
- P0 tasks should always have an Active Work section
