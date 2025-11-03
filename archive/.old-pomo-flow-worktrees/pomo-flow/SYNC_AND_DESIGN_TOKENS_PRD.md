# Pomo-Flow Sync & Design Tokens Implementation PRD

**Project**: Pomo-Flow Vue.js Productivity Application
**Version**: 2.0 Architecture Overhaul
**Date**: November 2025
**Author**: Claude Code Implementation Team
**Status**: Draft → Implementation

## 🎯 Executive Summary

This PRD outlines a comprehensive plan to fix critical sync drift issues and implement proper design token usage across the Pomo-Flow Vue.js application. The current two-layer architecture foundation exists but has widespread implementation gaps causing inconsistent task display and broken visual theming.

### **Problem Statement**
- **Sync Drift**: Tasks appear inconsistently across Board, Calendar, Canvas, and AllTasks views
- **Visual Inconsistency**: Components use hardcoded Tailwind classes instead of the established design token system
- **Core System Issues**: `getChildProjectIds` function errors break the unified filtering system
- **Technical Debt**: Legacy `taskFilteringService.ts` conflicts with new architecture

### **Solution Overview**
Sequential migration approach fixing core foundation first, then implementing each view completely with both sync functionality and proper design token integration.

---

## 📊 Current State Analysis

### **Existing Architecture Strengths**
✅ **Two-Layer Architecture**: Direct Pinia stores + Simple services already implemented
✅ **Unified Filtering System**: `filterTasksByView` function exists and is well-structured
✅ **Design Token System**: Comprehensive CSS custom properties defined in `/src/assets/design-tokens.css`
✅ **Simple Services**: All four services created with direct store access pattern

### **Critical Issues Identified**
❌ **Core Filtering Broken**: `getChildProjectIds` function errors break filtering across all views
❌ **Design Token Non-Adoption**: Components use hardcoded Tailwind classes (`bg-gray-500`, `bg-blue-500`)
❌ **Inconsistent Migration**: Views use different patterns (some use unified filtering, some don't)
❌ **Legacy Conflicts**: `taskFilteringService.ts` causes runtime errors

### **Impact Assessment**
- **High Priority**: Core functionality broken - users can't rely on task consistency
- **Medium Priority**: Visual inconsistencies affect user experience and maintainability
- **Low Priority**: Performance optimization and cleanup tasks

---

## 🎯 Objectives & Success Metrics

### **Primary Objectives**
1. **Eliminate sync drift** across all views (Board, Calendar, Canvas, AllTasks)
2. **Implement design token system** consistently throughout the application
3. **Establish robust error handling** in the filtering system
4. **Create maintainable codebase** following established architectural patterns

### **Success Metrics**
- **Sync Success Rate**: 100% - tasks created/updated in any view appear instantly in all other views
- **Design Token Coverage**: 90%+ - all visual elements use CSS custom properties
- **Error Rate**: <1% - zero runtime errors from filtering system
- **Performance**: <100ms - filtering operations complete quickly
- **User Experience**: Consistent theming and smooth interactions

### **Acceptance Criteria**
- [ ] Tasks sync instantly across all four views without refresh
- [ ] Dark mode works correctly across entire application
- [ ] All kanban columns use proper design tokens
- [ ] Zero console errors from filtering system
- [ ] Undo/redo works consistently across all views
- [ ] Cross-view task creation/editing/deletion works seamlessly

---

## 🏗️ Technical Architecture

### **Current Architecture (Working)**
```
┌─────────────────┐
│  Vue 3 Components  │  ← Direct Store Access
├─────────────────┤
│  Simple Services   │  ← Business Logic Layer
├─────────────────┤
│  Pinia Stores      │  ← State Management Layer
└─────────────────┘
    ↑           ↓
┌───────────────────────────────┐
│    Unified Filtering System        │
│  filterTasksByView(task[], type, filters) │
│         ↓                           │
│  Consistent Results Across All Views   │
└───────────────────────────────┘
```

### **Design Token System**
```
┌─────────────────────────┐
│  Design Tokens (CSS Vars)   │
├─────────────────────────┤
│  --surface-primary      │  ← Main backgrounds
│  --surface-secondary     │  ← Card/panel backgrounds
│  --text-primary         │  ← Main content
│  --border-primary        │  ← Element borders
│  --state-hover-bg        │  ← Interactive states
└─────────────────────────┘
```

### **Target Architecture (Complete)**
```
┌─────────────────┐
│  Vue 3 Components  │  ← Uses filterTasksByView
│  - BoardView      │  ← Uses design tokens
│  - CalendarView   │  ← Uses design tokens
│  - CanvasView     │  ← Uses design tokens
│  - AllTasksView   │  ← Uses design tokens
├─────────────────┤
│  Simple Services   │  ← taskService.createTask()
│  - taskService    │  ← Direct store calls
│  - timerService   │  ← Direct store calls
│  - canvasService  │  ← Direct store calls
│  - projectService │  ← Direct store calls
├─────────────────┤
│  Pinia Stores      │  ← Reactive state
│  - tasks.ts        │  ← Unified computed properties
│  - projects.ts     │  ← Hierarchical data
│  - timer.ts        │  ← Session state
├─────────────────┤
│  Unified Filtering │  ← Single source of truth
│  filterTasksByView  │  ← Consistent across all views
└─────────────────┘
```

---

## 📋 Implementation Plan

### **Phase 0: Core System Foundation (TODAY - 2-3 hours)**
**Objective**: Fix the broken foundation before touching any views

#### **Task 0.1: Fix `getChildProjectIds` Function**
```typescript
// File: src/utils/taskFilters.ts
export function getChildProjectIds(
  projectId: string | null,
  projects: Project[]
): string[] {
  try {
    if (!projectId) return [];
    if (!projects || projects.length === 0) return projectId ? [projectId] : [];

    const ids = [projectId];
    const collectChildren = (parentId: string) => {
      const childProjects = projects.filter(p => p.parentId === parentId);
      childProjects.forEach(child => {
        ids.push(child.id);
        collectChildren(child.id);
      });
    };

    collectChildren(projectId);
    return ids;
  } catch (error) {
    console.error('getChildProjectIds error:', error, { projectId, projects });
    return projectId ? [projectId] : [];
  }
}
```

#### **Task 0.2: Add Edge Case Handling**
```typescript
// Add comprehensive null checks
// Handle missing projects array
// Handle circular references
// Add TypeScript strict typing
// Add unit tests for edge cases
```

#### **Task 0.3: Unit Tests**
```typescript
// File: tests/utils/taskFilters.test.ts
describe('getChildProjectIds', () => {
  it('handles null projectId', () => {
    expect(getChildProjectIds(null, [])).toEqual([]);
  });

  it('handles empty projects array', () => {
    expect(getChildProjectIds('1', [])).toEqual(['1']);
  });

  it('collects nested children correctly', () => {
    const projects = [
      { id: '1', parentId: null },
      { id: '2', parentId: '1' },
      { id: '3', parentId: '1' },
      { id: '4', parentId: '2' }
    ];
    expect(getChildProjectIds('1', projects)).toEqual(['1', '2', '3', '4']);
  });
});
```

#### **Task 0.4: Manual Validation**
```javascript
// Browser console testing
import { filterTasksByView } from '@/utils/taskFilters';
import { useTaskStore } from '@/stores/tasks';

const taskStore = useTaskStore();
const filtered = filterTasksByView(taskStore.tasks, 'board', {
  projectId: '1',
  statusFilter: 'planned',
  hideDoneTasks: false
});

console.log('✅ Filtered tasks count:', filtered.length);
// Should show 0+ tasks with zero errors
```

**Exit Criteria**: All unit tests pass and zero console errors when calling `filterTasksByView`.

---

### **Phase 1: BoardView Complete Migration (NEXT - 4-6 hours)**
**Objective**: End-to-end migration of BoardView as proof-of-concept template

#### **Task 1.1: Replace Custom Filtering Logic**
```vue
<!-- src/views/BoardView.vue -->
<script setup lang="ts">
import { filterTasksByView } from '@/utils/taskFilters';

// ❌ REMOVE: Local filtering logic
// const localFilteredTasks = ref([]);

// ✅ ADD: Unified filtering
const currentFilters = computed(() => ({
  projectId: taskStore.activeProjectId,
  activeProjectId: taskStore.activeProjectId,
  statusFilter: taskStore.activeStatusFilter,
  hideDoneTasks: taskStore.hideDoneTasks,
  smartView: null
}));

const filteredTasks = computed(() => {
  try {
    return filterTasksByView(
      taskStore.tasks,
      'board',
      currentFilters.value,
      taskStore.projects
    );
  } catch (error) {
    console.error('❌ BoardView filtering error:', error);
    return taskStore.tasks; // Graceful fallback
  }
});
</script>
```

#### **Task 1.2: Design Token Migration**
```vue
<!-- src/views/BoardView.vue -->
<style scoped>
/* ❌ REMOVE: Hardcoded colors */
.status-backlog { background-color: #6b7280; }
.status-planned { background-color: #3b82f6; }
.status-in-progress { background-color: #eab308; }
.status-done { background-color: #22c55e; }

/* ✅ ADD: Design tokens */
.status-backlog {
  background-color: var(--color-priority-low);
  border-color: var(--priority-low-border);
}

.status-planned {
  background-color: var(--brand-primary);
  border-color: var(--brand-primary-border);
}

.status-in-progress {
  background-color: var(--color-work);
  border-color: var(--work-border);
}

.status-done {
  background-color: var(--color-success);
  border-color: var(--success-border);
}

/* Hover states with design tokens */
.status-backlog:hover {
  background-color: var(--priority-low-bg);
  border-color: var(--priority-low-border-active);
}

.status-planned:hover {
  background-color: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}
</style>
```

#### **Task 1.3: Update Task Creation Methods**
```vue
<!-- src/views/BoardView.vue -->
<script setup lang="ts">
// ✅ Already implemented correctly
const handleQuickTaskCreate = async (title: string, description: string) => {
  try {
    const newTask = await taskService.createTask({
      title: title,
      description: description,
      status: pendingTaskStatus.value,
      projectId: taskStore.activeProjectId || '1'
    });

    console.log('✅ Task created:', newTask.title);
  } catch (error) {
    console.error('❌ Task creation failed:', error);
  }
};
</script>
```

#### **Task 1.4: Comprehensive Testing**
```markdown
## BoardView Migration Checklist

### Functionality Tests
- [ ] Create task → appears immediately in BoardView
- [ ] Update task → changes immediately in BoardView
- [ ] Delete task → removes immediately from BoardView
- [ ] Filter by project → shows correct tasks
- [ ] Filter by status → shows correct tasks
- [ ] Hide done tasks → removes done tasks
- [ ] Undo/redo works correctly

### Visual Tests
- [ ] Dark mode works correctly
- [ ] Hover states work on buttons
- [ ] Kanban columns use proper design tokens
- [ ] Task cards use proper design tokens
- [ ] Glass morphism effects work correctly

### Cross-View Tests
- [ ] Task created in BoardView appears in store immediately
- [ ] Store changes reflect in BoardView reactively
- [ ] Zero console errors during operations
```

**Exit Criteria**: BoardView syncs perfectly with taskStore and uses design tokens consistently.

---

### **Phase 2: Sequential View Migration (Days 3-4)**

#### **Day 3: CalendarView Migration (3-4 hours)**
**Objective**: Apply BoardView success pattern to CalendarView

```vue
<!-- src/views/CalendarView.vue -->
<script setup lang="ts">
import { filterTasksByView } from '@/utils/taskFilters';

const calendarFilters = computed(() => ({
  projectId: taskStore.activeProjectId,
  dateFilter: selectedDate.value,
  statusFilter: activeStatus.value,
  hideDoneTasks: hideDone.value
}));

const filteredTasks = computed(() => {
  return filterTasksByView(
    taskStore.tasks,
    'calendar',
    calendarFilters.value,
    taskStore.projects
  );
});
</script>
```

#### **Day 4: CanvasView Migration (4-5 hours)**
**Objective**: Handle most complex migration with positioning logic

```vue
<!-- src/views/CanvasView.vue -->
<script setup lang="typescript">
import { filterTasksByView } from '@/utils/taskFilters';

const canvasFilters = computed(() => ({
  projectId: taskStore.activeProjectId,
  showPositioned: true,
  showInInbox: false, // Canvas shows only positioned tasks
  statusFilter: activeStatus.value,
  hideDoneTasks: hideDone.value
}));

const filteredTasks = computed(() => {
  const baseFiltered = filterTasksByView(
    taskStore.tasks,
    'canvas',
    canvasFilters.value,
    taskStore.projects
  );

  // Canvas-specific: Filter tasks with canvas positions
  return baseFiltered.filter(task => task.canvasPosition && !task.isInInbox);
});
</script>
```

#### **Day 5: AllTasksView Migration (2-3 hours)**
**Objective**: Final migration and validation

```vue
<!-- src/views/AllTasksView.vue -->
<script setup lang="ts">
import { filterTasksByView } from '@/utils/taskFilters';

const allTasksFilters = computed(() => ({
  projectId: taskStore.activeProjectId,
  statusFilter: activeStatus.value,
  hideDoneTasks: hideDone.value,
  searchQuery: searchQuery.value
}));

const filteredTasks = computed(() => {
  return filterTasksByView(
    taskStore.tasks,
    'list',
    allTasksFilters.value,
    taskStore.projects
  );
});
</script>
```

---

### **Phase 3: Final Validation & Cleanup (Day 5)**

#### **Task 3.1: E2E Cross-View Testing**
```typescript
// tests/integration/cross-view-sync.test.ts
describe('Cross-View Sync E2E', () => {
  test('Task created in BoardView appears in all views', async () => {
    // Create task in BoardView
    await page.goto('http://localhost:5546/board');
    await page.fill('[data-testid="quick-task-input"]', 'E2E Test Task');
    await page.press('[data-testid="quick-task-input"]', 'Enter');

    // Navigate to each view
    await page.goto('http://localhost:5546/calendar');
    await expect(page.locator('.task-event')).toContainText('E2E Test Task');

    await page.goto('http://localhost:5546/canvas');
    await expect(page.locator('.task-node')).toContainText('E2E Test Task');

    await page.goto('http://localhost:5546/all-tasks');
    await expect(page.locator('.task-item')).toContainText('E2E Test Task');
  });
});
```

#### **Task 3.2: Performance Testing**
```bash
# Bundle analysis
npm run build -- --analyze

# Memory leak detection
npm run test:memory

# Console error audit
npm run test:errors
```

#### **Task 3.3: Legacy Code Cleanup**
```bash
# Remove conflicting service
rm -f src/services/taskFilteringService.ts

# Clean up store methods
# Remove duplicate filtering logic from taskStore.ts
```

---

## 📊 Timeline & Resource Allocation

### **Development Timeline**
| Phase | Duration | Success Criteria | Rollback Point |
|-------|-----------|----------------|-------------|
| **Phase 0** | 2-3 hours | Core filtering works | `v2.0.0-foundation-fix` |
| **Phase 1** | 4-6 hours | BoardView complete | `v2.0.0-boardview` |
| **Phase 2** | 9-12 hours | All views migrated | After each view |
| **Phase 3** | 2-3 hours | Production ready | `v2.0.0-complete` |
| **TOTAL** | **17-24 hours** | **3-4 days** | Multiple checkpoints |

### **Resource Requirements**
- **Developer**: 1 senior developer full-time
- **Testing**: 3-4 hours dedicated testing time
- **Review**: 1-2 hours peer review time
- **Documentation**: 2 hours documentation updates

### **Risk Assessment**
- **Low Risk**: Well-defined patterns and proven architecture
- **Medium Risk**: Complexity of CanvasView migration
- **High Risk**: Legacy code conflicts requiring careful navigation

### **Contingency Plans**
- **Best Case**: All phases complete on schedule
- **Likely Case**: 1-2 days buffer for unexpected issues
- **Worst Case**: Foundation issues require additional debugging time

---

## 📈 Acceptance Criteria

### **Functional Requirements**
- [ ] Tasks created in any view appear immediately in all other views
- [ ] Task updates (status, priority, description) sync instantly across views
- [ ] Task deletion removes from all views consistently
- [ ] Filtering operations (project, status, date) work consistently across views
- [ ] Undo/redo operations work correctly across all views

### **Technical Requirements**
- [ ] All views use `filterTasksByView` unified filtering system
- [ ] Zero console errors from filtering system
- [ ] All visual elements use design tokens (CSS custom properties)
- [ ] Dark mode works correctly across entire application
- [ ] Glass morphism effects work properly in dark mode

### **Performance Requirements**
- [ ] Filtering operations complete in <100ms
- [ ] No memory leaks during extended use
- [ ] Bundle size does not increase significantly
- [ ] Smooth transitions and animations

### **User Experience Requirements**
- [ ] Consistent visual styling across all views
- [ ] Smooth theme switching between light/dark modes
- [ ] Responsive design works correctly on all devices
- [ ] Error handling provides graceful fallbacks
- [ ] Loading states provide appropriate feedback

### **Code Quality Requirements**
- [ ] TypeScript types are comprehensive and accurate
- [ ] Code follows established architectural patterns
- [ ] No duplicate logic or code duplication
- [ ] Proper error handling and logging
- [ ] Comprehensive unit test coverage

---

## 🔄 Implementation Workflow

### **Development Process**
1. **Setup Development Environment**
   - Ensure dev server running on port 5546
   - Clear browser cache
   - Open browser developer tools

2. **Execute Phase Tasks**
   - Follow task checklist exactly as specified
   - Complete each task before marking as done
   - Test thoroughly before proceeding

3. **Validation After Each Phase**
   - Run functional tests
   - Perform visual validation
   - Check console for errors
   - Create git commit/tag checkpoint

4. **Rollback Strategy**
   - If phase fails, revert to previous git tag
   - Analyze failure and adjust approach
   - Reattempt with modified plan

### **Quality Assurance**
1. **Code Review**: Peer review after each phase
2. **Automated Testing**: Unit tests + integration tests
3. **Manual Testing**: Visual validation in browser
4. **Cross-Browser Testing**: Test in Chrome, Firefox, Safari
5. **Performance Testing**: Monitor bundle size and memory usage

### **Documentation Updates**
- Update README.md with new architecture
- Document design token usage patterns
- Update CLAUDE.md with implementation details
- Create migration guide for future developers

---

## 🎯 Success Metrics & KPIs

### **Primary Success Metrics**
- **Sync Success Rate**: 100% - tasks appear instantly across all views
- **Design Token Adoption**: 90%+ - components use CSS custom properties
- **Error Reduction**: 95%+ - runtime errors eliminated
- **Performance**: <100ms filtering response time

### **Secondary Metrics**
- **Code Maintainability**: Reduced complexity and duplication
- **Developer Experience**: Clearer patterns and better error messages
- **User Satisfaction**: Consistent experience across all views

### **Business Impact**
- **Productivity**: Users can trust task data consistency
- **Adoption**: Improved visual consistency increases user confidence
- **Maintenance**: Reduced support overhead for visual issues

---

## 📚 Documentation

### **Implementation Guide**
- Step-by-step migration instructions for each view
- Design token reference guide with examples
- Troubleshooting guide for common issues

### **Architecture Documentation**
- Updated system architecture diagrams
- Service layer patterns and examples
- Data flow diagrams showing sync process

### **Developer Onboarding**
- Updated CLAUDE.md with new patterns
- Component styling guidelines
- Design token usage examples

---

## 🚨 Risk Mitigation

### **Technical Risks**
- **Scope Creep**: Strict adherence to sequential phases
- **Complexity Management**: Break down complex migrations into smaller chunks
- **Testing Coverage**: Comprehensive testing after each phase

### **Timeline Risks**
- **Unforeseen Issues**: Allocate buffer time for unexpected problems
- **Dependencies**: Ensure all team members aligned on approach
- **Resource Availability**: Secure dedicated developer time

### **Quality Risks**
- **Testing Gaps**: Comprehensive testing checklist for each phase
- **Peer Review**: Required code review after each phase
- **User Acceptance**: Clear validation criteria before proceeding

---

## 📞 Conclusion

This PRD provides a structured, sequential approach to fixing the critical sync drift issues and implementing proper design token usage in the Pomo-Flow application. By addressing core foundation issues first and validating each component before proceeding, we ensure a high probability of success with minimal risk.

The focused, phase-based approach allows for:
- **Clear success criteria** after each phase
- **Immediate rollback capability** if issues arise
- **Steady progress tracking** with measurable outcomes
- **Risk minimization** through validation checkpoints

Following this plan will result in a robust, maintainable application with consistent user experience and reduced technical debt.

**Next Steps**: Begin Phase 0 execution to fix the core filtering system foundation.