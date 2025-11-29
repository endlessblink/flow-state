# View-by-View Filter Analyzer

**Systematic analysis and fixing of duplicate filter controls across ALL views**

## Purpose

This skill performs comprehensive, view-by-view analysis of filter controls to identify and eliminate duplicates with visual proof. It goes through every single view in the application to ensure no duplicate filter controls exist.

## Methodology

### Phase 1: View Enumeration
- Identify all views in the application
- Map each view to its route and component
- Create systematic testing plan

### Phase 2: Individual View Analysis
For each view:
1. **Navigate to view** - Load the specific route
2. **Identify filter controls** - Find all filter-related elements
3. **Analyze duplicates** - Check for multiple filter instances
4. **Take screenshots** - Visual evidence before/after
5. **Fix duplicates** - Remove redundant filter controls
6. **Validate fix** - Confirm only single filter control remains

### Phase 3: Cross-View Validation
- Ensure consistency across all views
- Verify no view has duplicate filter controls
- Generate comprehensive visual report

## Views Analyzed

- **Board View** (`/`) - Kanban board
- **Calendar View** (`/calendar`) - Calendar scheduling
- **Canvas View** (`/canvas`) - Free-form canvas
- **All Tasks View** (`/tasks`) - Master task list
- **Catalog View** (`/catalog`) - Task catalog
- **Today View** (`/today`) - Mobile today view
- **Quick Sort View** (`/quick-sort`) - Task sorting
- **Focus View** (`/focus/:taskId`) - Focused task view

## Duplicate Filter Patterns Detected

### FilterControls Component Duplicates
- Multiple `<FilterControls>` components in same view
- FilterControls + TaskManagerSidebar filters
- FilterControls + inline view filters

### Inline Filter Duplicates
- View-specific filter buttons/toggles
- Status filter tabs
- Project filter dropdowns
- Hide done toggles
- Density selectors

## Fix Strategy

### 1. Unified Filter Architecture
- Single FilterControls component per view
- Remove all inline filter implementations
- Standardize filter behavior

### 2. Context-Aware Rendering
- Different filter configurations per view context
- Conditional filter visibility based on view needs
- Preserve essential view-specific controls

### 3. Visual Validation
- Before/after screenshots for each view
- Highlight duplicate filter controls in red
- Generate comprehensive HTML report

## Success Criteria

- ✅ Each view has exactly one filter control implementation
- ✅ No duplicate filter buttons, toggles, or dropdowns
- ✅ Consistent filter behavior across all views
- ✅ Visual proof via screenshots for every view
- ✅ Comprehensive HTML report showing all fixes

## Technical Implementation

- Uses Playwright for browser automation
- Takes full-page screenshots of each view
- Highlights duplicate filter elements
- Generates detailed visual reports
- Performs surgical code changes to fix duplicates

## Expected Outcome

**Before Fix**: Multiple filter controls per view (confusing UX)
**After Fix**: Single, unified filter control per view (clean UX)

All views will have consistent, non-duplicated filter interfaces with visual proof of the fixes.

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
