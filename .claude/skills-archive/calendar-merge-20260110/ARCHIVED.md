# Calendar Skills Merge - Archived 2026-01-10

## Summary

Three calendar-related skills were consolidated into a single comprehensive skill to eliminate redundancy and provide unified calendar system support.

## Merged Skills

### 1. calendar-inbox-sync (343 lines)
**Archived from**: `.claude/skills/calendar-inbox-sync/`
**Primary capability**: Debug calendar inbox showing 0 tasks when inbox has tasks
**Key features**:
- Diagnostic protocol for calendar-inbox discrepancy
- Fix for calendar using `filteredTasks` instead of independent data source
- Calendar inbox panel filtering fixes
- Prevention strategies for filter separation

### 2. calendar-scheduling-fixer (208 lines)
**Archived from**: `.claude/skills/calendar-scheduling-fixer/`
**Primary capability**: Fix tasks with due dates incorrectly appearing in calendar grid instead of inbox
**Key features**:
- Data model separation (dueDate vs instances)
- Visual separation patterns
- Workflow separation (Smart Groups -> Inbox -> Calendar)
- Reference documentation for task-calendar separation
- Mandatory Playwright testing requirements

## Target Skill

**Merged into**: `calendar-interface-architect`
**Location**: `.claude/skills/calendar-interface-architect/`
**New version**: 2.0
**New line count**: ~780 lines

## Capabilities in Merged Skill

The consolidated `calendar-interface-architect` skill now provides:

1. **TypeScript Calendar Interface Architecture** (from original skill)
   - CalendarEvent interface fixes
   - TaskInstance type system
   - Calendar state management
   - Temporal type safety

2. **Calendar Inbox Synchronization** (from calendar-inbox-sync)
   - Diagnostic protocol for 0 tasks issue
   - Calendar data source independence
   - Filter separation between sidebar and calendar

3. **Calendar Scheduling Fixes** (from calendar-scheduling-fixer)
   - Task-calendar separation principles
   - Smart group behavior (dueDate only, no instances)
   - Inbox to calendar flow patterns
   - Common violation detection and solutions

## Reference Materials Preserved

The following reference files were copied to the merged skill:
- `references/task-calendar-separation.md`
- `references/vue-calendar-best-practices.md`

## Reason for Merge

All three skills addressed different aspects of the same calendar system:
- Interface types (original)
- Inbox sync issues (calendar-inbox-sync)
- Scheduling/filtering issues (calendar-scheduling-fixer)

Consolidating them:
1. Reduces skill discovery overhead
2. Provides comprehensive context in a single skill
3. Eliminates duplicate testing requirements
4. Creates a single source of truth for calendar fixes

## Rollback Instructions

If the merged skill needs to be split again:
1. Skills are preserved intact in this archive directory
2. Move directories back to `.claude/skills/`
3. Revert `calendar-interface-architect/SKILL.md` to version 1.0

## Archive Date

2026-01-10
