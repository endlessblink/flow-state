# Master Debugging Prompt

Copy and paste this template whenever encountering errors in your Vue 3 + TypeScript project.

---

I have a [ERROR TYPE] error in my Vue 3 + TypeScript project.

CONTEXT:
- Project: Pomo-Flow (Vue 3 + TypeScript + Vite + Pinia)
- Latest Working: [describe last working state - e.g., "Yesterday afternoon after task creation fix"]
- Current Error: [paste exact error message]
- Error Location: [file:line or component name]
- Recent Changes: [what changed since working state - e.g., "Updated Vue Flow dependency"]

DEBUGGING REQUIREMENTS:
1. Use production-debugging-framework skill
2. Follow 7-phase zero-error verification
3. Apply error-specific protocol for [ERROR TYPE]
4. Read full files for complete context
5. Document the fix and root cause
6. Verify fix with appropriate validation command
7. Confirm return to working state

ERROR DETAILS:
[Paste full error output with stack trace]

ADDITIONAL CONTEXT:
- Browser: [Chrome/Firefox/Safari version if relevant]
- Node.js version: [if relevant]
- Package.json changes: [if any dependencies were updated]
- Git commit: [current commit hash or branch]

EXPECTED OUTCOME:
- Single fix applied
- Zero errors remaining
- Core functionality working
- Build process successful

---

## Instructions for Use

1. **Replace bracketed placeholders** with actual information
2. **Be specific** about what changed since the last working state
3. **Include complete error output** with full stack traces
4. **Mention any recent updates** to dependencies or configuration
5. **Describe what functionality** should be working after the fix

## Example Filled Template

```
I have a TypeScript compilation error in my Vue 3 + TypeScript project.

CONTEXT:
- Project: Pomo-Flow (Vue 3 + TypeScript + Vite + Pinia)
- Latest Working: Yesterday afternoon after task creation fix
- Current Error: TS2339: Property 'tasks' does not exist on type 'TaskStore'
- Error Location: src/components/TaskManager.vue:45
- Recent Changes: Updated @vue-flow/core from 1.28.0 to 1.29.0

DEBUGGING REQUIREMENTS:
1. Use production-debugging-framework skill
2. Follow 7-phase zero-error verification
3. Apply error-specific protocol for TypeScript compilation errors
4. Read full files for complete context
5. Document the fix and root cause
6. Verify fix with appropriate validation command
7. Confirm return to working state

ERROR DETAILS:
src/components/TaskManager.vue:45:16 - error TS2339: Property 'tasks' does not exist on type 'TaskStore'.

   43 | const taskStore = useTaskStore()
   44 |
 > 45 | console.log(taskStore.tasks)
      |                ~~~~

   46 |

Found 1 error in src/components/TaskManager.vue:45

ADDITIONAL CONTEXT:
- Browser: Chrome 119.0.6045.123
- Node.js version: 18.17.0
- Package.json changes: Updated @vue-flow/core
- Git commit: a1b2c3d (main branch)

EXPECTED OUTCOME:
- Single fix applied
- Zero errors remaining
- Core functionality working
- Build process successful
```

## Quick Reference: Error Types

Use these specific terms for [ERROR TYPE]:
- "TypeScript compilation"
- "Vite build failure"
- "Import/module resolution"
- "Component reference"
- "Runtime browser"
- "Test failure"
- "Linting error"
- "Performance issue"