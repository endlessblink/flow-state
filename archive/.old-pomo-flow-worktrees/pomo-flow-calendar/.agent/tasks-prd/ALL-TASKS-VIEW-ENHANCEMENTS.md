# All Tasks View - Future Enhancements

## Current Implementation Status

### ✅ Completed Features

**Table View (Spreadsheet Mode):**
- Grid layout with 7 columns (checkbox, title, status, priority, due date, progress, actions)
- Inline cell editing (double-click title to edit)
- Bulk selection with checkboxes (select all, individual select)
- Click priority badge to cycle through low/medium/high
- Status dropdown for quick status changes
- Density controls (compact/comfortable/spacious) affecting row height
- Hover-based quick actions (start timer, edit task)
- Empty state handling

**List View (Hierarchical Tree Mode):**
- Collapsible project headers with task counts and emojis
- Parent tasks with expand/collapse chevrons
- Recursive subtask rendering with 16px indentation per level
- Drag-and-drop tasks to re-parent as subtasks
- Expand All / Collapse All buttons
- Visual task hierarchy and structure
- Subtask count badges (completed/total)
- Strikethrough for completed tasks

**Shared Features:**
- ViewControls toolbar (view type toggle, density/expand controls, sort, filter)
- CustomSelect components for dropdowns (glass-morphism design)
- Sort by: Due Date, Priority, Title, Created
- Filter by: All Status, To Do, In Progress, Done
- Context menu support (right-click)
- Task edit modal integration
- Design system compliant styling

---

## 🔮 Future Enhancements

### High Priority

#### 1. **Sortable Table Headers**
- **Current**: Headers are static labels
- **Needed**: Click header to sort by that column
- **UX**: Show sort direction indicator (↑↓)
- **Implementation**: Add @click handlers to headers, track sort column + direction
- **Reference**: ClickUp table view, Notion database headers

#### 2. **Column Show/Hide Controls**
- **Current**: All 7 columns always visible
- **Needed**: Toggle which columns to display
- **UX**: Right-click header or settings menu
- **Implementation**: Column visibility state, dynamic grid-template-columns
- **Reference**: ClickUp column customization, Airtable hide fields

#### 3. **Virtual Scrolling for Lists 100+**
- **Current**: All rows rendered (performance issue at 500+ tasks)
- **Needed**: Virtual scrolling using @vueuse/core or vue-virtual-scroller
- **Threshold**: Implement when task count > 100
- **Implementation**: Wrap TaskTable/TaskList in virtual scroller
- **Reference**: Research document mentions vue-virtual-scroller patterns

#### 4. **Keyboard Navigation**
- **Current**: Basic tab navigation
- **Needed**:
  - Arrow keys to navigate cells (table) or rows (list)
  - Enter to edit/expand
  - Escape to cancel
  - Vim-style navigation (j/k for up/down)
- **Implementation**: Global keydown handler with focus management
- **Reference**: Linear keyboard shortcuts, Vim navigation patterns

#### 5. **Bulk Actions Toolbar**
- **Current**: Can select multiple but no bulk actions
- **Needed**: When tasks selected, show toolbar with:
  - Change status (bulk update)
  - Set priority (bulk update)
  - Move to project (bulk operation)
  - Delete (bulk delete with confirmation)
- **Implementation**: Conditional toolbar component when selection.length > 0
- **Reference**: ClickUp bulk editing, Gmail bulk actions pattern

### Medium Priority

#### 6. **Table Cell Inline Editing Enhancement**
- **Current**: Only title is inline editable
- **Needed**: All cells editable inline
  - Due date: date picker
  - Priority: dropdown or cycle
  - Status: dropdown
  - Progress: slider or input
- **Implementation**: Per-cell edit mode with appropriate input types
- **Reference**: Notion inline editing, Airtable cell editing

#### 7. **List View: Drag to Reorder**
- **Current**: Can drag to nest, but not reorder within same level
- **Needed**: Drag task above/below siblings to change order
- **UX**: Show insertion line between tasks
- **Implementation**: Drop zones between rows, track insertion point
- **Reference**: Todoist drag reordering, Things 3 list reordering

#### 8. **Smart Grouping in List View**
- **Current**: Only groups by project
- **Needed**: Group by:
  - Status (To Do, In Progress, Done sections)
  - Priority (High, Medium, Low sections)
  - Due Date (Overdue, Today, This Week, Later)
  - Custom (user-defined)
- **Implementation**: Dropdown to select grouping mode, compute groups dynamically
- **Reference**: ClickUp group by, Linear issue grouping

#### 9. **Search/Filter within View**
- **Current**: Global filter by status only
- **Needed**:
  - Search by text (title, description)
  - Filter by multiple criteria (tags, project, assignee)
  - Advanced filters (due this week, high priority AND overdue)
- **Implementation**: Search input + filter chip system
- **Reference**: Linear search, Notion database filters

#### 10. **Saved Views / Presets**
- **Current**: Settings reset on page reload
- **Needed**: Save view configurations as named presets
  - "High Priority Tasks" (filter: priority=high, sort: dueDate)
  - "This Week" (filter: due this week, group by: project)
  - "Overdue Items" (filter: overdue, sort: priority)
- **Implementation**: LocalStorage or database-backed view presets
- **Reference**: ClickUp saved views, Notion database views

### Low Priority (Nice to Have)

#### 11. **Row/Card Size Customization**
- **Current**: Fixed density options (compact/comfortable/spacious)
- **Needed**: Slider for custom row height (28-48px range)
- **Implementation**: Range input, dynamic CSS variable
- **Reference**: ClickUp row height customization

#### 12. **Column Resizing**
- **Current**: Fixed column widths
- **Needed**: Drag column borders to resize
- **Implementation**: Mouse events on column borders, dynamic grid-template-columns
- **Reference**: Airtable column resizing, Excel-style interaction

#### 13. **Multi-level Undo/Redo**
- **Current**: No undo for bulk operations
- **Needed**: Ctrl+Z to undo task moves, edits, bulk changes
- **Implementation**: Command pattern, history stack in store
- **Reference**: Linear undo system, Notion undo

#### 14. **Export Functionality**
- **Current**: No export
- **Needed**: Export visible tasks to:
  - CSV (for spreadsheet apps)
  - JSON (for backup)
  - Markdown (for documentation)
- **Implementation**: Export service, file download
- **Reference**: ClickUp export, Notion database export

#### 15. **Quick Filters (One-click)**
- **Current**: Must use dropdowns
- **Needed**: One-click filter chips:
  - "Overdue" badge (red)
  - "Due Today" badge (yellow)
  - "High Priority" badge (red)
  - "In Progress" badge (blue)
- **Implementation**: Badge components that toggle filters
- **Reference**: Linear quick filters, GitHub issue labels

---

## Performance Optimization Tasks

### 16. **Virtual Scrolling Implementation**
- Implement when task count exceeds 100 items
- Use @vueuse/core useVirtualList or vue-virtual-scroller
- Target: Smooth 60fps scrolling with 1000+ tasks
- **File**: src/components/TaskTable.vue, src/components/TaskList.vue

### 17. **Memoization for Computed Properties**
- Use `shallowRef` for large task arrays
- `computed` with dependency tracking for filtered/sorted lists
- Prevent unnecessary re-renders on task updates
- **File**: src/views/AllTasksView.vue

### 18. **Lazy Load Project Groups**
- Don't render collapsed project contents
- Only render expanded sections
- Reduces initial DOM size
- **File**: src/components/TaskList.vue

---

## UX/Accessibility Improvements

### 19. **Loading States**
- Show skeleton screens while loading tasks
- Spinner for async operations (bulk updates)
- **Implementation**: Loading prop, skeleton component

### 20. **Error Handling**
- Show error messages for failed operations
- Retry mechanism for failed updates
- Offline mode detection
- **Implementation**: Error boundary, toast notifications

### 21. **Mobile Responsiveness**
- Table: Collapse to 4 columns on mobile (checkbox, title, due date, actions)
- List: Reduce indent from 16px to 8px on mobile
- Touch-friendly hit targets (44px minimum)
- **Implementation**: Media queries, responsive grid columns

### 22. **WCAG Compliance Audit**
- Screen reader testing (NVDA, JAWS)
- Keyboard-only navigation testing
- Color contrast verification (AAA standard)
- Focus indicator visibility
- **Tools**: axe DevTools, WAVE, Lighthouse accessibility

---

## Component Architecture Improvements

### 23. **Extract Reusable Subcomponents**
- TaskRowCheckbox.vue (shared by table and list)
- TaskRowActions.vue (start timer, edit buttons)
- PriorityBadge.vue (reusable badge with cycle logic)
- StatusBadge.vue (reusable status indicator)
- **Benefit**: DRY, easier testing, smaller bundle size

### 24. **Composable Extraction**
- useTaskSelection (multi-select logic)
- useTaskDragDrop (drag-and-drop logic)
- useTaskSorting (sort logic)
- useTaskFiltering (filter logic)
- **Benefit**: Testable, reusable, cleaner components

---

## Testing Tasks

### 25. **Unit Tests**
- TaskTable.vue: sorting, filtering, selection, editing
- TaskList.vue: expand/collapse, grouping, drag-drop
- HierarchicalTaskRow.vue: nesting, recursion, events
- ViewControls.vue: view type toggle, density, filters

### 26. **Integration Tests**
- End-to-end workflow: create → edit → complete → delete
- Drag-drop nesting workflow
- Bulk selection and actions workflow
- View switching (table ↔ list) state preservation

### 27. **Performance Tests**
- Render time with 100, 500, 1000 tasks
- Scroll performance measurement
- Memory usage profiling
- Virtual scrolling validation

### 28. **Accessibility Tests**
- Keyboard navigation full flow
- Screen reader announcement verification
- Focus trap testing in modals
- Touch target size verification (mobile)

---

## Documentation Tasks

### 29. **Design System Documentation**
- Add TaskTable to design system
- Add TaskList + HierarchicalTaskRow to design system
- Document ViewControls component
- Show all density variants
- **File**: design-system/src/pages/

### 30. **User Guide**
- How to use Table view (bulk operations)
- How to use List view (hierarchical structure)
- Keyboard shortcuts reference
- Tips for organizing with nested tasks

---

## Implementation Notes

**Current Files:**
- `src/views/AllTasksView.vue` - Main orchestration (229 lines)
- `src/components/ViewControls.vue` - Toolbar controls (169 lines)
- `src/components/TaskTable.vue` - Spreadsheet table (350 lines)
- `src/components/TaskList.vue` - Hierarchical tree container (240 lines)
- `src/components/HierarchicalTaskRow.vue` - Recursive tree node (503 lines)
- `src/components/TaskRow.vue` - Simple row (archived, replaced by HierarchicalTaskRow)

**Design Principles:**
- Component reuse over duplication
- Design system CSS variables exclusively
- Local component state over global stores
- Clean orchestration pattern (like BoardView)
- Specialized components (TaskRow for table, HierarchicalTaskRow for list)

**Research References:**
- Todoist: Hierarchical list with subtasks, keyboard shortcuts
- Linear: Dense rows (28-36px), keyboard-first navigation
- ClickUp: Table vs List distinction, density controls, bulk operations
- Things 3: Shallow nesting, focus on simplicity
- Height: Balanced density, side panels for details

**Performance Thresholds:**
- 0-100 tasks: Standard rendering
- 100-500 tasks: Virtual scrolling recommended
- 500+ tasks: Virtual scrolling essential

**Accessibility Standards:**
- 44px minimum touch targets (achieved via hover expansion)
- Full keyboard navigation
- ARIA labels and roles
- Reduced motion support
- High contrast mode support
