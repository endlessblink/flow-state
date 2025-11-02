# POMO-FLOW PROJECT REFERENCE
**Live document to maintain alignment during surgical fixes**

---

## CURRENT STATE (TRUTH)

### PORT 5546 - BROKEN VERSION
**Location:** `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow`
**Status:** ❌ BROKEN
**Issues:**
- Broken system with broken design in canvas
- Broken sync system
- Counter doesn't match display
- Tasks.ts: 1,851 lines

### PORT 5547 - WORKING VERSION
**Location:** `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-board`
**Status:** ✅ WORKING
**Characteristics:**
- Working version with old code
- Counter matches display
- Tasks.ts: 2,816 lines

---

## SURGICAL FIX DIRECTION

**COPY FROM:** Port 5547 (working version - pomo-flow-board)
**COPY TO:** Port 5546 (broken version - pomo-flow)

**PRESERVE:** Any design improvements that exist in port 5546

---

## KEY ISSUES TO FIX IN PORT 5546

Based on original problem description:

1. **Excessive console.log statements** (200+ in filteredTasks computed property)
2. **Vue reactivity broken** due to logging
3. **Dependency conflict:** vue-draggable-next@2.3.0 breaks drag-and-drop
4. **CSS issue:** transform-gpu class causes rendering errors
5. **Missing UI controls:** Status filter buttons not rendered
6. **Over-engineering:** Service layers broke working logic

---

## CURRENT SYMPTOMS IN PORT 5546

- Kanban counter shows 2 tasks
- Kanban board displays 0 tasks
- Drag-and-drop doesn't work
- Console has excessive logging noise

---

## SUCCESS CRITERIA FOR PORT 5546 FIXES

✅ Kanban counter matches kanban display
✅ Drag-and-drop works smoothly
✅ Status filters work and update display
✅ Console is clean (no errors or excessive logging)
✅ Any design improvements from 5546 are preserved
✅ All UI elements are visible and functional
✅ Performance is responsive (no lag)

---

## FILE LOCATIONS

### PORT 5546 (BROKEN - TO BE FIXED)
- Main store: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/src/stores/tasks.ts`
- Board view: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/src/views/BoardView.vue`
- Package: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/package.json`

### PORT 5547 (WORKING - REFERENCE)
- Main store: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-board/src/stores/tasks.ts`
- Board view: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-board/src/views/BoardView.vue`
- Package: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-board/package.json`

---

## NOTES
- Never edit the working version (port 5547)
- Always test fixes on port 5546 only
- Keep this document updated with any findings
- Reference this when confusion arises about direction