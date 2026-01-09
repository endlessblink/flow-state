# AGENTS.md - AI Coding Agent Instructions

> This file provides instructions for AI coding agents working on this project.
> See [agents.md](https://agents.md/) for the specification.

## Project: Pomo-Flow

A Vue 3 productivity application combining Pomodoro timer with task management across multiple views (Board, Calendar, Canvas).

---

## CRITICAL RULES

### NEVER Create Demo/Sample Data

**This is a STRICT REQUIREMENT for all AI coding agents (TASK-054):**

1. **DO NOT** create functions that generate sample tasks or projects
2. **DO NOT** add "Test Task", "Sample Project", "Demo" content
3. **DO NOT** seed the database with example data
4. **DO NOT** create fallback data when database is empty
5. **DO NOT** add placeholder content like "Lorem ipsum"

**Correct behavior:** Empty database = empty task list (user creates their own)

### Why This Rule Exists

- Demo data pollutes real user data
- Users cannot distinguish demo from real tasks
- Causes data loss confusion when "cleaning up" demo content
- Previous incidents required manual database cleanup

### Correct Pattern

```typescript
// CORRECT - Empty start
if (tasks.value.length === 0) {
  console.log('Fresh start - no tasks')
  // User creates their own via UI
}

// FORBIDDEN - Never do this
if (tasks.value.length === 0) {
  tasks.value = createSampleTasks()  // NO!
}
```

---

## Build Commands

```bash
npm run dev      # Start dev server (port 5546)
npm run build    # Production build
npm run test     # Run tests
npm run lint     # Lint code
npm run kill     # Kill all PomoFlow processes
```

## Code Style

- Vue 3 Composition API with `<script setup>`
- TypeScript required for all new code
- Pinia for state management
- Tailwind CSS with design tokens

## Testing

- Vitest for unit tests
- Playwright for E2E tests
- Always verify changes with `npm run test`

## See Also

- `CLAUDE.md` - Full development guidelines for Claude Code
- `docs/MASTER_PLAN.md` - Project roadmap and task tracking
