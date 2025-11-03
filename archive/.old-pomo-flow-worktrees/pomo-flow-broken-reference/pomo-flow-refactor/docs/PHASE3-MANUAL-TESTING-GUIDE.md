# Phase 3: Manual Side-by-Side Testing Guide

**Date**: 2025-10-27
**Purpose**: Comprehensive manual testing of refactored CanvasView.vue vs main branch
**Status**: ⏳ READY FOR TESTING

---

## Setup Instructions

### 1. Start Both Versions

**Terminal 1 - Main Branch (Port 5546):**
```bash
cd "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"
npm run dev
```
Access at: http://localhost:5546

**Terminal 2 - Refactored Branch (Port 5550):**
```bash
cd "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/pomo-flow-refactor"
npm run dev -- --port 5550
```
Access at: http://localhost:5550

### 2. Open Both in Browser
- Main: http://localhost:5546/#/canvas
- Refactored: http://localhost:5550/#/canvas

---

## Testing Checklist

### ✅ = Works Correctly | ❌ = Broken | ⚠️ = Partial/Different

## A. Basic Canvas Operations

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Canvas loads without errors | ☐ | ☐ | Check console for errors |
| Inbox panel visible | ☐ | ☐ | |
| Control buttons visible | ☐ | ☐ | Zoom, sections, etc. |
| Vue Flow canvas renders | ☐ | ☐ | |

---

## B. Task Creation & Management

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Create task in inbox | ☐ | ☐ | Use quick add input |
| Drag task from inbox to canvas | ☐ | ☐ | |
| Task appears on canvas | ☐ | ☐ | Visual confirmation |
| Task displays correct data | ☐ | ☐ | Title, status, priority |
| Double-click task to edit | ☐ | ☐ | Opens edit modal |
| Delete task from canvas | ☐ | ☐ | Right-click → Delete |

---

## C. Canvas Context Menu Operations

### Test Steps:
1. Create 4-5 tasks on canvas (drag from inbox)
2. Select multiple tasks (Shift+click or rectangle select)
3. Right-click on a selected task

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Context menu appears | ☐ | ☐ | |
| **arrangeInRow()** visible | ☐ | ☐ | NEW - Check exists |
| **arrangeInColumn()** visible | ☐ | ☐ | NEW - Check exists |
| **arrangeInGrid()** visible | ☐ | ☐ | NEW - Check exists |
| Align Left | ☐ | ☐ | |
| Align Right | ☐ | ☐ | |
| Align Top | ☐ | ☐ | |
| Align Bottom | ☐ | ☐ | |
| Align Center Horizontal | ☐ | ☐ | |
| Align Center Vertical | ☐ | ☐ | |
| Distribute Horizontal | ☐ | ☐ | |
| Distribute Vertical | ☐ | ☐ | |

---

## D. Arrange Functions (NEW - CRITICAL TO TEST)

### D.1 Arrange in Row
**Test Steps:**
1. Create 4 tasks at random positions on canvas
2. Select all 4 tasks (Shift+click)
3. Right-click → "Arrange in Row"
4. **Expected Result**: Tasks align horizontally with 240px spacing

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Option visible in menu | ☐ | ☐ | |
| Tasks align horizontally | ☐ | ☐ | Y positions same |
| Correct spacing (240px) | ☐ | ☐ | Measure with browser |
| Context menu closes | ☐ | ☐ | |
| Undo/redo works | ☐ | ☐ | Ctrl+Z / Ctrl+Y |

### D.2 Arrange in Column
**Test Steps:**
1. Create 4 tasks at random positions
2. Select all 4 tasks
3. Right-click → "Arrange in Column"
4. **Expected Result**: Tasks align vertically with 120px spacing

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Option visible in menu | ☐ | ☐ | |
| Tasks align vertically | ☐ | ☐ | X positions same |
| Correct spacing (120px) | ☐ | ☐ | Measure with browser |
| Context menu closes | ☐ | ☐ | |
| Undo/redo works | ☐ | ☐ | |

### D.3 Arrange in Grid
**Test Steps:**
1. Create 4 tasks at random positions
2. Select all 4 tasks
3. Right-click → "Arrange in Grid"
4. **Expected Result**: Tasks form 2x2 grid (or nearest square)

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Option visible in menu | ☐ | ☐ | |
| Tasks form grid pattern | ☐ | ☐ | |
| Horizontal spacing (240px) | ☐ | ☐ | |
| Vertical spacing (120px) | ☐ | ☐ | |
| Centered around selection | ☐ | ☐ | |
| Context menu closes | ☐ | ☐ | |
| Undo/redo works | ☐ | ☐ | |

### D.4 Minimum Task Requirement
**Test Steps:**
1. Select only 1 task
2. Right-click → "Arrange in Row"
3. **Expected Result**: Nothing should happen (requires 2+ tasks)

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Option grayed out or disabled | ☐ | ☐ | |
| No error if clicked | ☐ | ☐ | |
| Task position unchanged | ☐ | ☐ | |

---

## E. Section Operations

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Create section via button | ☐ | ☐ | |
| Create smart section (priority) | ☐ | ☐ | |
| Create smart section (status) | ☐ | ☐ | |
| Create smart section (project) | ☐ | ☐ | |
| Drag task into section | ☐ | ☐ | Auto-apply properties |
| Drag task out of section | ☐ | ☐ | |
| Resize section (NodeResizer) | ☐ | ☐ | **CRITICAL** |
| Collapse section | ☐ | ☐ | |
| Expand section | ☐ | ☐ | Height restored |
| Delete section | ☐ | ☐ | Right-click → Delete |

---

## F. Zoom & View Controls

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Zoom in (+) | ☐ | ☐ | Button & keyboard |
| Zoom out (-) | ☐ | ☐ | Button & keyboard |
| Reset zoom | ☐ | ☐ | |
| Fit to content (F) | ☐ | ☐ | Keyboard shortcut |
| Fit all tasks | ☐ | ☐ | |
| Center on selected | ☐ | ☐ | |
| Zoom dropdown visible | ☐ | ☐ | Shows %age |
| Apply zoom preset | ☐ | ☐ | 50%, 100%, 150% |

---

## G. Multi-Selection

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Rectangle select | ☐ | ☐ | Drag on canvas |
| Shift+click multi-select | ☐ | ☐ | |
| Select all (Ctrl+A) | ☐ | ☐ | |
| Clear selection (Esc) | ☐ | ☐ | |
| Selected tasks highlighted | ☐ | ☐ | Visual feedback |

---

## H. Edge/Connection Management

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Create edge (drag handle) | ☐ | ☐ | Task → Task |
| Edge renders correctly | ☐ | ☐ | |
| Right-click edge | ☐ | ☐ | Context menu |
| Delete edge | ☐ | ☐ | |
| Edge persists after refresh | ☐ | ☐ | |

---

## I. Modals & Wizards

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Group/section wizard | ☐ | ☐ | Create group |
| Section edit modal | ☐ | ☐ | |
| Task edit modal | ☐ | ☐ | Double-click task |
| Quick task create at position | ☐ | ☐ | Right-click canvas |
| Batch edit modal | ☐ | ☐ | Multi-select → Edit |

---

## J. Display Toggles

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Hide/show completed tasks | ☐ | ☐ | |
| Toggle sections visibility | ☐ | ☐ | |
| Section type dropdown | ☐ | ☐ | |

---

## K. Auto-Arrange

| Feature | Main (5546) | Refactored (5550) | Notes |
|---------|-------------|-------------------|-------|
| Auto-arrange button visible | ☐ | ☐ | |
| Auto-arrange executes | ☐ | ☐ | |
| Tasks organized logically | ☐ | ☐ | |

---

## L. Performance & Polish

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Smooth 60fps interactions | ☐ | ☐ | |
| No console errors | ☐ | ☐ | **CRITICAL** |
| No console warnings | ☐ | ☐ | |
| Canvas state persists | ☐ | ☐ | Refresh page |
| Undo/redo history works | ☐ | ☐ | All operations |

---

## M. Visual Appearance

| Check | Main (5546) | Refactored (5550) | Notes |
|-------|-------------|-------------------|-------|
| Task cards look identical | ☐ | ☐ | Colors, spacing |
| Sections look identical | ☐ | ☐ | |
| Controls positioned correctly | ☐ | ☐ | |
| Inbox panel matches | ☐ | ☐ | |
| Context menus match | ☐ | ☐ | |

---

## Testing Protocol

### For Each Feature:
1. **Test in Main First** (port 5546)
   - Perform action
   - Note behavior
   - Take screenshot if needed

2. **Test in Refactored** (port 5550)
   - Perform exact same action
   - Compare behavior
   - Note any differences

3. **Document Results**
   - ✅ = Identical behavior
   - ⚠️ = Different but acceptable
   - ❌ = Broken or missing

### Critical Issues (Must Block Merge):
- Console errors
- Missing functionality
- Data loss or corruption
- Broken undo/redo
- Visual glitches preventing use

### Minor Issues (Can merge with notes):
- Minor visual differences
- Different animations/timing
- Non-critical performance differences

---

## Post-Testing Report

### Summary
- Total features tested: ____ / 100
- Passed (✅): ____
- Failed (❌): ____
- Partial (⚠️): ____

### Critical Issues Found:
1.
2.
3.

### Minor Issues Found:
1.
2.
3.

### Regression Analysis:
- Features working in main but broken in refactored: ____
- New bugs introduced: ____
- Performance regressions: ____

### Recommendation:
☐ **SAFE TO MERGE** - All critical functionality verified
☐ **MERGE WITH FIXES** - Minor issues need addressing
☐ **DO NOT MERGE** - Critical regressions found

---

## Next Steps After Testing

### If Safe to Merge:
1. Create pull request
2. Document any known minor issues
3. Merge to main branch
4. Deploy to production

### If Issues Found:
1. Document all issues in detail
2. Prioritize by severity
3. Create GitHub issues for each
4. Fix critical issues before merge
5. Re-test after fixes

---

**Last Updated**: 2025-10-27
**Tester**: _________________
**Testing Date**: _________________
**Testing Duration**: _______ hours
