# Atomic Testing Checklist

## Why This Exists
Large testing tasks cause Claude to enter extended thinking loops. This breaks testing into **single-action items** that complete in <30 seconds each.

---

## How to Use
Run ONE item at a time. Copy-paste the exact command/instruction.

---

## Phase 5: Parent-Child (8 atomic tests)

### PC-1: Task count badge displays
```
Open http://localhost:5546/canvas
Screenshot the first group header
Report: Does it show a number in parentheses like "(2)"?
```

### PC-2: Drag task into group
```
1. Find a task outside any group
2. Drag it into a group
3. Screenshot after drop
Report: Is task visually inside the group boundary?
```

### PC-3: Group drag moves children
```
1. Find a group with tasks inside
2. Note task positions relative to group
3. Drag group 100px right
4. Screenshot
Report: Did tasks move WITH the group?
```

### PC-4: Drag task out of group
```
1. Find a task inside a group
2. Drag it outside the group boundary
3. Screenshot
Report: Is task now outside the group?
```

### PC-5: Nested group creation
```
1. Right-click inside a group
2. Select "New Group"
3. Screenshot
Report: Is new group visually inside parent group?
```

### PC-6: Nested movement
```
1. Find a group containing another group
2. Drag outer group
3. Screenshot
Report: Did inner group move with outer?
```

### PC-7: Position persistence
```
1. Note current positions of 2 groups
2. Refresh page (F5)
3. Screenshot
Report: Are groups in same positions?
```

### PC-8: Parent relationship persistence
```
1. Find a task inside a group
2. Refresh page (F5)
3. Screenshot
Report: Is task still inside the same group?
```

---

## Phase 6: Features (12 atomic tests)

### F-1: Task context menu
```
Right-click on a task
Screenshot the menu
Report: List menu options shown
```

### F-2: Group context menu
```
Right-click on a group header
Screenshot the menu
Report: List menu options shown
```

### F-3: Background context menu
```
Right-click on empty canvas area
Screenshot the menu
Report: List menu options shown
```

### F-4: Multi-select with shift
```
1. Click first task
2. Shift+click second task
3. Screenshot
Report: Are both tasks highlighted/selected?
```

### F-5: Delete selected
```
1. Select a task
2. Press Delete key
3. Screenshot
Report: Is task removed?
```

### F-6: Escape clears selection
```
1. Select multiple items
2. Press Escape
3. Screenshot
Report: Is selection cleared?
```

### F-7: Create group from menu
```
1. Right-click on background
2. Click "New Group"
3. Screenshot
Report: Did new group appear?
```

### F-8: Edit group name
```
1. Right-click group header
2. Select Edit/Rename
3. Type new name
4. Screenshot
Report: Did name change?
```

### F-9: Edit group color
```
1. Right-click group header
2. Select Edit
3. Change color
4. Screenshot
Report: Did color change?
```

### F-10: Delete group
```
1. Right-click group
2. Select Delete
3. Confirm if prompted
4. Screenshot
Report: Is group removed?
```

### F-11: Minimap click navigation
```
1. Click on a location in minimap
2. Screenshot main canvas
Report: Did viewport move to that location?
```

### F-12: Zoom controls
```
1. Click zoom in button
2. Screenshot
3. Click zoom out button
4. Screenshot
Report: Did zoom level change?
```

---

## Quick Console Check
```bash
# Run this in browser console after each test:
console.log('Errors:', performance.getEntriesByType('error').length)
```

---

## Results Template
Copy this for each test:

```
Test: [ID]
Result: PASS / FAIL
Screenshot: [path]
Notes: [any issues]
```
