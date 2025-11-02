---
name: Systematic Project Planning
description: PLAN complex features and projects systematically. Use when user requests task breakdown, project planning, feature implementation strategy, or needs multi-step development approach. Break down work into phases, tasks, and dependencies.
---

# Systematic Project Planning

## Instructions

### When to Use This Skill
Invoke this skill when the user:
- Requests "plan this feature" or "break down this task"
- Asks "how should I implement..." or "what's the approach for..."
- Needs a roadmap, architecture plan, or implementation strategy
- Mentions "complex feature", "large project", or "multi-step work"
- Wants to understand dependencies and implementation order

### Planning Protocol

#### Phase 1: Analysis & Discovery
**Understand the current state:**

1. **Codebase Context**
   - Read relevant files to understand current architecture
   - Identify existing patterns and conventions
   - Check project guidelines (.claude/CLAUDE.md, README.md)
   - Review related components and stores

2. **Requirements Analysis**
   - Extract explicit requirements from user request
   - Identify implicit requirements (performance, UX, testing)
   - Consider edge cases and error scenarios
   - Note constraints (technical, time, compatibility)

3. **Dependency Mapping**
   - Identify affected files and components
   - Map data flow and state management needs
   - Note integration points with existing features
   - Check for breaking changes or migrations needed

#### Phase 2: Strategic Breakdown
**Create a Work Breakdown Structure (WBS):**

1. **High-Level Phases**
   Break the project into 3-5 major phases:
   ```
   Example:
   Phase 1: Data Model & Store Setup
   Phase 2: UI Components & Views
   Phase 3: Integration & State Management
   Phase 4: Testing & Polish
   Phase 5: Documentation & Deployment
   ```

2. **Task Decomposition**
   For each phase, create specific, actionable tasks:
   - Each task should be completable in 30-90 minutes
   - Include acceptance criteria
   - Note any blockers or prerequisites
   - Estimate complexity (Low/Medium/High/Critical)

3. **Dependency Graph**
   Document task relationships:
   - Which tasks must be completed first?
   - Which tasks can be done in parallel?
   - Which tasks have circular dependencies (resolve these)?
   - What are the critical path items?

#### Phase 3: Implementation Strategy

1. **Priority & Sequencing**
   Order tasks by:
   - **Priority 1 (Critical Path)**: Must be done first, blocks other work
   - **Priority 2 (Foundation)**: Core functionality, enables other features
   - **Priority 3 (Enhancement)**: Improves UX but not blocking
   - **Priority 4 (Polish)**: Nice-to-have, can be deferred

2. **Risk Assessment**
   For each high-complexity task:
   - What could go wrong?
   - What are the alternatives?
   - What validation is needed?
   - Are there performance concerns?

3. **Testing Strategy**
   Define testing approach:
   - Unit tests for stores and utilities
   - Component tests for UI elements
   - Integration tests for workflows
   - Playwright tests for critical user paths

#### Phase 4: Deliverable Format

Present the plan in this structure:

```markdown
## Project Plan: [Feature Name]

### Overview
[Brief description of what we're building and why]

### Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Architecture Changes
[What architectural changes are needed? New stores, composables, components?]

### Implementation Phases

#### Phase 1: [Phase Name]
**Goal**: [What this phase accomplishes]
**Duration**: [Estimated time]

**Tasks:**
1. **[Task Name]** (Complexity: Low/Medium/High)
   - File: `src/path/to/file.ts`
   - Description: [What to do]
   - Acceptance: [How to verify it works]
   - Dependencies: [Other tasks needed first]

2. **[Next Task]** (Complexity: Medium)
   - ...

#### Phase 2: [Phase Name]
...

### Critical Path
1. Task A → Task B → Task C
2. Task D can run parallel to Task B

### Risk Mitigation
- **Risk**: [What could go wrong]
  **Mitigation**: [How to prevent/handle it]

### Testing Plan
- [ ] Unit tests: [What to test]
- [ ] Component tests: [What to test]
- [ ] Integration tests: [What to test]
- [ ] Playwright E2E: [Critical user flows]

### Open Questions
- Question 1?
- Question 2?

### Next Steps
1. [First concrete action to take]
2. [Second action]
```

### Quality Standards

**Every plan must include:**
- ✅ Clear phases with specific goals
- ✅ Actionable tasks with file paths
- ✅ Complexity estimates for each task
- ✅ Dependency relationships documented
- ✅ Testing strategy defined
- ✅ Risk assessment for complex tasks
- ✅ Success criteria that can be validated

**Avoid:**
- ❌ Vague tasks like "improve performance"
- ❌ Missing dependencies or assumptions
- ❌ No testing strategy
- ❌ No file/component references
- ❌ Unrealistic time estimates
- ❌ Ignoring existing code patterns

### Special Considerations for Pomo-Flow

**When planning for this project, always:**

1. **Check Existing Patterns**
   - Review how similar features are implemented
   - Use VueUse composables where possible
   - Follow Pinia store patterns (tasks.ts as reference)
   - Use design tokens from assets/design-tokens.css

2. **State Management**
   - Consider undo/redo implications
   - Plan IndexedDB persistence strategy
   - Think about cross-view synchronization

3. **Performance**
   - Large task lists require virtual scrolling
   - Debounce expensive operations
   - Use computed properties for filtering

4. **Testing Requirements**
   - Playwright tests are MANDATORY for user-facing changes
   - Visual confirmation required before claiming completion
   - Test across all views (Board, Calendar, Canvas)

### Example Usage

**User request**: "I want to add recurring tasks to Pomo-Flow"

**Planning output would include:**
- Phase 1: Data model changes (Task interface, RecurrenceRule type)
- Phase 2: Store logic (recurrence calculation, instance generation)
- Phase 3: UI components (recurrence picker, visual indicators)
- Phase 4: Calendar integration (show all instances)
- Phase 5: Testing (edge cases, DST handling, performance)

Each phase broken into specific tasks with files, complexity, dependencies, and acceptance criteria.

---

This skill ensures systematic, thoughtful planning that prevents scope creep, identifies risks early, and creates clear roadmaps for complex development work.
