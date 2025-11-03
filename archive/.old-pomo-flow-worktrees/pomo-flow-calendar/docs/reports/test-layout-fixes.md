# Layout Testing Guide for Vue 3 Productivity App

## Testing URL
http://localhost:5546/

## Layout Fixes to Test

### 1. Action Button Visibility Test
**What to check:**
- Right-side action buttons (timer, edit, duplicate) should be visible at all times
- No hover-to-reveal behavior - buttons should have `opacity: 1` permanently
- Buttons should not fade in/out on hover

**How to test:**
1. Navigate to any task view
2. Look at task rows without hovering over them
3. Verify timer, edit, and duplicate buttons are visible
4. Move mouse away and confirm buttons remain visible

### 2. Text Vertical Alignment Test
**What to check:**
- Task titles should be vertically centered in their containers
- No text floating to top or bottom of row
- All elements in a row should align to the same vertical center line

**How to test:**
1. Look at task rows with different length titles
2. Compare alignment of title text with other elements (checkboxes, buttons)
3. Check due dates and priority badges are also vertically centered
4. Verify consistency across multiple rows

### 3. Grid Layout Proportions Test
**What to check:**
- Proper spacing between columns
- No overlapping elements
- Consistent column widths across rows
- Appropriate space allocation for each content type

**How to test:**
1. Examine the spacing between drag handle, checkbox, title, due date, priority, status, and actions
2. Check that long titles don't push into other columns
3. Verify action buttons have sufficient space and don't get cut off
4. Look for any text overflow or layout breaking

### 4. Overall Layout Consistency Test
**What to check:**
- Consistent row heights (44px as specified in CSS)
- Uniform padding and margins
- Proper visual hierarchy
- No layout shifts when hovering or interacting

**How to test:**
1. Compare multiple task rows for consistent height
2. Check that hover states don't cause layout shifts
3. Verify selected state highlighting doesn't affect alignment
4. Test with tasks of varying content lengths

### 5. Action Button Clickability Test
**What to check:**
- All action buttons are clickable and responsive
- Visual feedback on hover/click
- No dead zones or overlapping click areas
- Proper event handling

**How to test:**
1. Click the timer button - should trigger timer functionality
2. Click the edit button - should open edit modal/interface
3. Click the duplicate button - should create task duplicate
4. Verify hover states provide visual feedback

### 6. Responsive Behavior Test
**What to check:**
- Layout adapts to different screen sizes
- Mobile optimization works correctly
- No horizontal scrolling on narrow screens
- Touch targets remain accessible

**How to test:**
1. Resize browser window to different widths
2. Test mobile view (< 768px)
3. Verify grid layout switches to mobile-friendly format
4. Check that less critical columns are hidden on mobile

## Expected Results Based on Code Analysis

### HierarchicalTaskRow.vue Improvements:
- ✅ **Action buttons always visible**: `opacity: 1` set permanently
- ✅ **Better grid layout**: `grid-template-columns: 20px 24px 1fr 100px 70px 80px`
- ✅ **Vertical centering**: `align-items: center` on main container
- ✅ **Consistent heights**: `height: 100%` on individual elements

### TaskRow.vue Status:
- ⚠️ **Still has hover-based action buttons**: `opacity: 0` → `opacity: 1` on hover
- ✅ **Good grid layout**: Well-structured CSS grid
- ✅ **Proper alignment**: Uses `align-items: center`

## Test Data Creation

If no tasks are visible, create test tasks with:
1. Varying title lengths (short, medium, long)
2. Different priority levels (high, medium, low)
3. Various statuses (todo, in-progress, done)
4. Due dates (today, tomorrow, overdue)
5. Subtasks (to test hierarchical display)

## Screenshot Documentation

Take screenshots showing:
1. Overall task list view
2. Close-up of individual task rows
3. Before/after hover states for action buttons
4. Different content types (long titles, various priorities)
5. Mobile vs desktop layouts

## Browser DevTools Checks

Use Chrome DevTools to:
1. Inspect the CSS applied to task elements
2. Verify `opacity: 1` on action buttons
3. Check grid layout properties
4. Test responsive breakpoints
5. Look for console errors or warnings