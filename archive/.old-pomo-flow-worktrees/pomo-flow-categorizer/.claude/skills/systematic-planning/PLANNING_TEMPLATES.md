# Planning Templates & Examples

## Quick Reference Templates

### Simple Feature Template
Use for straightforward features (1-2 days of work):

```markdown
## Feature: [Name]

### What
[One sentence description]

### Why
[Value proposition]

### How
1. [Step 1 with file path]
2. [Step 2 with file path]
3. [Step 3 with file path]

### Testing
- [ ] [Critical test case]

### Done When
- [ ] [Success criterion 1]
- [ ] [Success criterion 2]
```

### Complex Feature Template
Use for multi-phase projects (3+ days of work):

```markdown
## Project: [Name]

### Executive Summary
[Problem statement and proposed solution in 2-3 sentences]

### Success Metrics
- [ ] Measurable outcome 1
- [ ] Measurable outcome 2
- [ ] Measurable outcome 3

### Technical Scope
**In Scope:**
- Feature A
- Feature B

**Out of Scope:**
- Feature C (future work)

### Architecture
[Diagram or description of component/data flow]

**New Files:**
- `src/stores/newStore.ts` - [Purpose]
- `src/components/NewComponent.vue` - [Purpose]

**Modified Files:**
- `src/stores/tasks.ts` - [Changes]
- `src/views/BoardView.vue` - [Changes]

### Phase 1: Foundation (Est: X hours)
**Goal**: [What foundation this creates]

1. **Setup data model** (Low complexity)
   - File: `src/types/index.ts`
   - Add new TypeScript interfaces
   - Dependencies: None
   - Validation: Types compile without errors

2. **Create store** (Medium complexity)
   - File: `src/stores/newStore.ts`
   - Implement Pinia store with reactive state
   - Dependencies: Task 1 complete
   - Validation: Store tests pass

### Phase 2: Implementation (Est: Y hours)
...

### Phase 3: Integration (Est: Z hours)
...

### Testing Strategy
**Unit Tests:**
- [ ] Store actions and getters
- [ ] Utility functions
- [ ] Data transformations

**Component Tests:**
- [ ] Component renders correctly
- [ ] User interactions work
- [ ] Edge cases handled

**E2E Tests (Playwright):**
- [ ] Happy path workflow
- [ ] Error scenarios
- [ ] Cross-view synchronization

### Rollout Plan
1. Feature flag (if needed)
2. Soft launch to subset of users
3. Monitor for issues
4. Full deployment

### Rollback Plan
[How to safely revert if issues occur]
```

## Task Complexity Guidelines

### Low Complexity (30-60 min)
- Add new CSS class
- Update TypeScript types
- Simple computed property
- Basic UI text changes
- Add/update unit test

**Example:**
```markdown
**Add priority badge colors** (Low)
- File: `src/assets/design-tokens.css`
- Add CSS custom properties for priority colors
- Update `src/components/TaskCard.vue` to use new tokens
- Acceptance: Badge colors match design specs
```

### Medium Complexity (1-3 hours)
- New Vue component
- Pinia store method
- Composable function
- Integration between two components
- Complex computed property

**Example:**
```markdown
**Create task priority picker** (Medium)
- File: `src/components/TaskPriorityPicker.vue`
- Build reusable picker with high/medium/low options
- Integrate with task creation/edit forms
- Dependencies: Priority badge colors (Low task)
- Acceptance: Picker updates task priority in store
```

### High Complexity (3-6 hours)
- New feature with multiple components
- Store refactoring
- Database schema migration
- Performance optimization
- Complex algorithm implementation

**Example:**
```markdown
**Implement drag-and-drop task reordering** (High)
- Files: `src/views/BoardView.vue`, `src/stores/tasks.ts`
- Integrate vuedraggable library
- Update store to persist new order
- Handle undo/redo for reorder operations
- Dependencies: Task store must support position field
- Acceptance: Tasks can be dragged, order persists, undo works
```

### Critical Complexity (6+ hours)
- Major architectural change
- New view or major feature
- Complex state management
- Performance-critical implementation
- Integration with external system

**Example:**
```markdown
**Add collaborative editing with WebSocket** (Critical)
- Files: Multiple (new WebSocket service, store updates, conflict resolution)
- Design real-time sync architecture
- Implement operational transformation or CRDT
- Handle offline/online transitions
- Test conflict resolution scenarios
- Dependencies: Requires backend WebSocket server
- Acceptance: Multiple users can edit simultaneously without data loss
```

## Dependency Notation

### Dependency Types
- **Blocks**: Task A must finish before Task B starts
- **Parallel**: Tasks can be done simultaneously
- **Soft dependency**: Helpful to do first but not strictly required

### Notation Examples
```
Task A → Task B → Task C  (Sequential, blocking)
Task D ⫿ Task E          (Parallel, independent)
Task F ↝ Task G          (Soft dependency)
```

### Critical Path Identification
The critical path is the longest sequence of dependent tasks:

```
Example:
A (2h) → B (3h) → C (1h) = 6 hours (critical path)
D (2h) → E (2h) = 4 hours (parallel)

Critical path: A → B → C (6 hours minimum project duration)
```

## Risk Assessment Matrix

### Risk Levels
- **Low**: Minor issue, easy fix
- **Medium**: Could delay by days, requires rework
- **High**: Could block project, needs alternative approach
- **Critical**: Could kill project, need prototype/spike first

### Risk Template
```markdown
**Risk**: [What could go wrong]
**Impact**: [How bad would it be?]
**Probability**: [How likely?]
**Mitigation**: [How to prevent]
**Contingency**: [What if it happens anyway]
```

### Example Risks
```markdown
**Risk**: Vue Flow performance degrades with 100+ nodes
**Impact**: High - unusable canvas for power users
**Probability**: Medium - depends on user data
**Mitigation**: Implement virtual viewport, lazy render off-screen nodes
**Contingency**: Add node limit warning, suggest archiving old tasks

**Risk**: IndexedDB quota exceeded on large task lists
**Impact**: High - data loss possible
**Probability**: Low - typical users have <1000 tasks
**Mitigation**: Monitor storage usage, warn at 80% capacity
**Contingency**: Implement data export, cloud backup option
```

## Testing Checklists

### Unit Test Checklist
- [ ] Happy path works
- [ ] Edge cases handled (null, undefined, empty)
- [ ] Error cases throw/return appropriately
- [ ] Async operations complete
- [ ] State changes are reactive

### Component Test Checklist
- [ ] Component renders without errors
- [ ] Props validated and used correctly
- [ ] Events emitted with correct data
- [ ] Conditional rendering works
- [ ] Slots used correctly
- [ ] Accessibility attributes present

### Integration Test Checklist
- [ ] Data flows between components
- [ ] Store updates reflected in UI
- [ ] Side effects trigger correctly
- [ ] Error boundaries catch issues
- [ ] Loading states display

### E2E Test Checklist (Playwright)
- [ ] User can complete primary workflow
- [ ] Error messages display when appropriate
- [ ] Data persists across page reloads
- [ ] Cross-view synchronization works
- [ ] No console errors during test
- [ ] Performance is acceptable

## Real-World Planning Example

### Example: "Add task templates feature"

```markdown
## Project: Task Templates

### Overview
Allow users to create reusable task templates with predefined title, description, subtasks, and tags. Users can quickly create tasks from templates.

### Success Criteria
- [ ] Users can create templates from existing tasks
- [ ] Users can create tasks from templates in <3 clicks
- [ ] Templates persist across sessions
- [ ] Templates work across all views (Board, Calendar, Canvas)

### Architecture Changes
**New Files:**
- `src/types/template.ts` - Template interface
- `src/stores/templates.ts` - Template management store
- `src/components/TemplateManager.vue` - Template CRUD UI
- `src/components/TaskTemplateButton.vue` - Quick create button
- `src/composables/useTemplates.ts` - Template utilities

**Modified Files:**
- `src/stores/tasks.ts` - Add `createFromTemplate()` method
- `src/components/TaskQuickAdd.vue` - Add template picker
- `src/views/BoardView.vue` - Integrate template button

### Phase 1: Data Layer (Est: 2 hours)

1. **Define Template interface** (Low - 30 min)
   - File: `src/types/template.ts`
   - Create TypeScript types for Template
   - Dependencies: None
   - Acceptance: Types compile, follow Task structure

2. **Create templates store** (Medium - 1.5 hours)
   - File: `src/stores/templates.ts`
   - Implement Pinia store with CRUD operations
   - Add IndexedDB persistence
   - Dependencies: Template types complete
   - Acceptance: Can create/read/update/delete templates

### Phase 2: Core UI (Est: 3 hours)

3. **Build TemplateManager component** (High - 2 hours)
   - File: `src/components/TemplateManager.vue`
   - List templates with edit/delete
   - Form to create new template
   - Dependencies: Templates store ready
   - Acceptance: Can manage templates in UI

4. **Create quick-create button** (Low - 1 hour)
   - File: `src/components/TaskTemplateButton.vue`
   - Dropdown with template list
   - Click creates task from template
   - Dependencies: Templates store, TaskStore.createFromTemplate()
   - Acceptance: Creates task in current view

### Phase 3: Integration (Est: 2 hours)

5. **Add "Save as Template" to TaskCard** (Medium - 1 hour)
   - File: `src/components/TaskCard.vue`
   - Add menu option to save current task as template
   - Dependencies: TemplateManager complete
   - Acceptance: Can create template from existing task

6. **Integrate with quick-add** (Medium - 1 hour)
   - File: `src/components/TaskQuickAdd.vue`
   - Add template picker to quick-add flow
   - Dependencies: TaskTemplateButton complete
   - Acceptance: Can create from template via quick-add

### Phase 4: Polish & Testing (Est: 2 hours)

7. **Add template icons and styling** (Low - 30 min)
   - Follow design system tokens
   - Visual distinction for template-created tasks
   - Acceptance: UI matches design standards

8. **Write comprehensive tests** (Medium - 1.5 hours)
   - Unit tests for templates store
   - Component tests for TemplateManager
   - Playwright test for end-to-end workflow
   - Acceptance: All tests pass, no console errors

### Critical Path
1. Template types → Templates store → TemplateManager
2. Templates store → TaskTemplateButton → Integration (phases 2-3 parallel)
3. Integration → Testing

**Total Duration**: 9 hours (sequential) or 7 hours (with parallelization)

### Risks
**Risk**: Template format incompatible with future Task changes
**Mitigation**: Use subset of Task fields, version templates
**Contingency**: Auto-migrate templates on schema change

**Risk**: Users create too many templates, UI cluttered
**Mitigation**: Add categories/folders, search, favorites
**Contingency**: Limit to 20 templates initially

### Testing Plan
**Unit:**
- [ ] Templates store CRUD operations
- [ ] Template → Task conversion
- [ ] IndexedDB persistence

**Component:**
- [ ] TemplateManager renders template list
- [ ] Can edit template properties
- [ ] Can delete templates

**E2E (Playwright):**
- [ ] Create template from task
- [ ] Create task from template
- [ ] Template persists after refresh
- [ ] Works in Board, Calendar, Canvas views

### Open Questions
1. Should templates support project assignment?
2. Do templates need version history?
3. Can templates be shared across users (future)?

### Next Steps
1. Create `template.ts` types file
2. Implement templates Pinia store
3. Add IndexedDB persistence tests
```

This example shows a complete, actionable plan with:
- Clear phases and dependencies
- Specific file paths
- Realistic time estimates
- Risk mitigation
- Comprehensive testing strategy
- Open questions for discussion

---

Use these templates as starting points and adapt them to the specific feature or project being planned.
