# Data Safety Rules

> Google Antigravity workspace rules for Pomo-Flow

## NEVER Create Demo/Sample Data

**This is a CRITICAL requirement for Pomo-Flow (TASK-054):**

- **DO NOT** create functions that generate sample tasks or projects
- **DO NOT** add test data, demo content, or placeholder tasks
- **DO NOT** seed the database with example data
- **DO NOT** create fallback data when database is empty
- **DO NOT** add "Test Task", "Sample Project", or similar content

## Why This Rule Exists

1. Demo data pollutes real user data
2. Users cannot distinguish demo from real tasks
3. Causes data loss confusion when cleaning up
4. Previous incidents required manual database cleanup

## Correct Behavior

When database is empty:
- Show empty task list
- User creates their own tasks
- Never auto-generate content

```typescript
// CORRECT
if (tasks.value.length === 0) {
  console.log('Fresh start - no tasks')
}

// FORBIDDEN
if (tasks.value.length === 0) {
  tasks.value = createSampleTasks()  // NO!
}
```

## Protected Files

Do not modify these files to add demo data:
- `src/stores/tasks.ts`
- `src/stores/canvas.ts`

## See Also

- `CLAUDE.md` - Full development guidelines
- `AGENTS.md` - Universal AI agent rules
- `docs/MASTER_PLAN.md` - Project tracking
