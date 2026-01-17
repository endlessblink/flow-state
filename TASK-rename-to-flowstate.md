# TASK: Rename Project from Pomo-Flow to FlowState

## Context
The project has been moved from `/home/endlessblink/my-projects/ai-development/productivity/pomo-flow/` to `/home/endlessblink/my-projects/ai-development/productivity/flow-state/`

The app is being rebranded from **Pomo-Flow** to **FlowState**.

## Files That Need Updating

### Critical (Must Update)

1. **`package.json`**
   - Change `"name": "pomo-flow"` → `"name": "flow-state"`
   - Update any other references

2. **`CLAUDE.md`**
   - Line 19: Change "Pomo-Flow" → "FlowState"
   - Update project description to reflect new branding

3. **`vite.config.ts`**
   - Check for app name in build configuration

4. **`.claude/hooks/destructive-command-blocker.sh`**
   - Line 142: Update docker service name reference

5. **`index.html`**
   - Update `<title>` tag if it contains old name

### Test Files (Update References)
- `tests/e2e-task-linking-simple.spec.ts`
- `tests/e2e-basic-functionality.spec.ts`
- `tests/smoke/pwa-smoke.spec.ts`
- `tests/design-system.spec.ts`
- `tests/e2e-comprehensive-functionality.spec.ts`

### Investigate & Decide
- **`pomo-flow-restored/`** subdirectory - This appears to be a backup. Decide whether to:
  - Merge useful content back into main project
  - Delete if it's redundant

## Search Patterns
Use these to find all references:
```bash
# Find all occurrences
grep -r "pomo-flow\|pomoflow\|PomoFlow\|Pomo-Flow" --include="*.{json,ts,js,vue,md,sh,html,css}"
```

## Replacement Rules
| Old | New |
|-----|-----|
| `pomo-flow` | `flow-state` |
| `pomoflow` | `flowstate` |
| `PomoFlow` | `FlowState` |
| `Pomo-Flow` | `FlowState` |
| `POMO_FLOW` | `FLOW_STATE` |

## Verification Steps
After renaming:
1. `npm install` - Verify package.json is valid
2. `npm run dev` - Verify app starts
3. `npm run build` - Verify build succeeds
4. `npm run test` - Verify tests pass
5. Check browser title shows "FlowState"

## Notes
- The KDE widget in `kde-widget/` may also need updates
- Supabase project name may need updating separately (database-level)
- Git remote URLs don't need changing (they're GitHub URLs)
