# Tech Debt & Hidden Complexity Audit Prompt

Use this prompt in a separate Claude Code instance to audit other systems in the Pomo-Flow app for hidden complexity and technical debt.

---

## The Prompt

Copy everything below the line and paste it into a new Claude Code session:

---

# SYSTEM AUDIT REQUEST

You are conducting a comprehensive tech debt and hidden complexity audit of the Pomo-Flow application. This is a Vue 3 + TypeScript + Pinia + Supabase productivity app.

**Context**: The Canvas system was just identified as needing a complete rebuild due to accumulated tech debt (5,151 lines that could be 1,500, 22 competing watchers, 65+ TASK/BUG fix comments). We need to identify if other systems have similar problems BEFORE they become critical.

## Your Task

Analyze the following systems for hidden complexity and tech debt. For EACH system, provide:

1. **Health Score** (1-10): 10 = clean, 1 = needs rebuild
2. **Lines of Code**: Total and per-file breakdown
3. **Complexity Indicators**:
   - Number of watchers/computed properties
   - TASK-/BUG- comment count
   - Defensive guards and workarounds
   - Duplicate logic
4. **Architecture Issues**: Anti-patterns, god objects, circular deps
5. **Recommendation**: MAINTAIN / REFACTOR / REBUILD

## Systems to Audit

### 1. Board View System
Files to analyze:
- `src/views/BoardView.vue`
- `src/stores/tasks.ts`
- `src/components/board/*.vue`

### 2. Calendar View System
Files to analyze:
- `src/views/CalendarView.vue`
- `src/composables/calendar/*.ts`
- `src/components/calendar/*.vue`

### 3. Timer/Pomodoro System
Files to analyze:
- `src/stores/timer.ts`
- `src/components/timer/*.vue`
- `src/composables/usePomodoro.ts` (if exists)

### 4. Authentication System
Files to analyze:
- `src/stores/auth.ts`
- `src/services/auth/*.ts`
- `src/components/auth/*.vue`

### 5. Supabase Sync Layer
Files to analyze:
- `src/composables/useSupabaseDatabaseV2.ts`
- `src/utils/supabaseMappers.ts`
- `src/services/supabase.ts`

### 6. Project Management
Files to analyze:
- `src/stores/projects.ts`
- `src/components/projects/*.vue`

### 7. Settings & Preferences
Files to analyze:
- `src/stores/settings.ts`
- `src/components/layout/SettingsModal.vue`

## Output Format

For each system, provide a report card:

```
## [System Name] Audit

**Health Score**: X/10
**Total Lines**: XXXX
**Recommendation**: MAINTAIN / REFACTOR / REBUILD

### Metrics
| Metric | Count | Concern Level |
|--------|-------|---------------|
| Watchers | X | Low/Medium/High |
| TASK/BUG comments | X | Low/Medium/High |
| Defensive guards | X | Low/Medium/High |

### Key Issues Found
1. [Issue description with file:line reference]
2. [Issue description with file:line reference]

### Immediate Risks
- [Risk that could cause bugs soon]

### Recommendations
- [Specific action items if REFACTOR/REBUILD recommended]
```

## Final Summary

After analyzing all systems, provide:

1. **Priority Ranking**: Which systems need attention first?
2. **Dependency Map**: Which systems share code/state?
3. **Estimated Effort**: Hours to fix each system
4. **Safe vs Risky**: Which can be refactored safely vs need careful planning?

---

**Start by reading the MASTER_PLAN.md to understand current project status, then proceed with the audit.**
