---
id: mgt23700sntkueiz7f
timestamp: 2025-10-16T06:45:54.864Z
project: pomo-flow
category: bug-investigation
tags: ["today-filter","kanban-board","filtered-tasks","default-filter","smart-view","boardview","tasks-store"]
priority: medium
---

User reported that the Kanban board default filter "Today" issue is still persisting despite my investigation. 

**Current Issue Analysis:**
- User screenshot shows: Page title says "Today", sidebar shows "Today" as active, but Kanban board displays "My Tasks" project with 0 tasks instead of today's tasks
- Console logs show: "🎯 BoardView: Set default filter to Today for better productivity focus" 
- My testing showed: When I created a new task, it appeared correctly in the Today filter (count changed from 0 to 1, task appeared in Kanban)

**Key Technical Details:**
- BoardView.vue lines 136-140: Default filter initialization code
- tasks.ts lines 202-239: Today filter logic in filteredTasks computed property
- Filter criteria: tasks scheduled for today, due today, created today, or in progress
- 18 tasks loaded from IndexedDB but none meet today criteria

**User's Expectation vs Current Behavior:**
- User expects: Today filter should show relevant tasks for today
- Current behavior: Shows 0 tasks even when tasks should exist
- Discrepancy: Console confirms filter is set, but visual display doesn't match expected result

**Next Steps Required:**
1. Investigate why existing tasks don't appear in Today filter when they should
2. Check if there's a mismatch between filter logic and task data structure
3. Verify if tasks have proper dates/instances that should qualify for Today filter
4. Potentially examine the 18 existing tasks to understand why they're excluded
5. May need to adjust filter logic or task creation process

**Technical Context:**
- Vue 3 Composition API with Pinia store
- Tasks use instances array for scheduling (new format) or legacy scheduledDate
- Filtering happens in computed property based on activeSmartView === 'today'
- BoardView component properly sets activeSmartView to 'today' on mount