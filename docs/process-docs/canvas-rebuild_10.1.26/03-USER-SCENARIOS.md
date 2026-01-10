# Canvas - What Should Happen

Simple visual guide showing what users expect when they interact with the canvas.

---

## 1. Moving a Task to a Different Group

**I drag "Buy groceries" from the To-Do group to the Done group**

```
BEFORE:                          AFTER:
┌─────────────────┐              ┌─────────────────┐
│ To-Do      (2)  │              │ To-Do      (1)  │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │Buy groceries│─┼──DRAG───┐    │ │Call mom     │ │
│ └─────────────┘ │         │    │ └─────────────┘ │
│ ┌─────────────┐ │         │    └─────────────────┘
│ │Call mom     │ │         │
│ └─────────────┘ │         │    ┌─────────────────┐
└─────────────────┘         │    │ Done       (1)  │
                            │    │ ┌─────────────┐ │
┌─────────────────┐         └───>│ │Buy groceries│ │
│ Done       (0)  │              │ └─────────────┘ │
│                 │              └─────────────────┘
│   (empty)       │
└─────────────────┘

WHAT CHANGED:
- To-Do count: 2 → 1
- Done count: 0 → 1
- Task is now inside Done group
```

---

## 2. Moving a Group (Tasks Follow)

**I drag the whole "To-Do" group to a new spot**

```
BEFORE:                          AFTER:
┌─────────────────┐
│ To-Do      (2)  │
│ ┌─────────────┐ │                     ┌─────────────────┐
│ │Task A      │ │───DRAG──────────────>│ To-Do      (2)  │
│ └─────────────┘ │                     │ ┌─────────────┐ │
│ ┌─────────────┐ │                     │ │Task A      │ │
│ │Task B      │ │                     │ └─────────────┘ │
│ └─────────────┘ │                     │ ┌─────────────┐ │
└─────────────────┘                     │ │Task B      │ │
                                        │ └─────────────┘ │
                                        └─────────────────┘

WHAT HAPPENED:
- I only dragged the GROUP
- Both tasks moved WITH it automatically
- Tasks stay in the same spots INSIDE the group
```

---

## 3. Dragging Task from Inbox to Canvas

**I drag a task from my inbox onto a group on the canvas**

```
INBOX (left panel)              CANVAS
┌──────────────────┐            ┌─────────────────┐
│ New task         │───DRAG────>│ My Project (1)  │
│ Another task     │            │ ┌─────────────┐ │
│ One more         │            │ │New task     │ │
└──────────────────┘            │ └─────────────┘ │
                                └─────────────────┘

AFTER:
┌──────────────────┐            ┌─────────────────┐
│ Another task     │            │ My Project (1)  │
│ One more         │            │ ┌─────────────┐ │
└──────────────────┘            │ │New task     │ │
                                │ └─────────────┘ │
                                └─────────────────┘

WHAT HAPPENED:
- Task removed from inbox
- Task appears in the group
- Group count increased
```

---

## 4. Dragging Task OUT of a Group

**I drag a task out of its group onto empty canvas space**

```
BEFORE:                          AFTER:
┌─────────────────┐              ┌─────────────────┐
│ My Group   (2)  │              │ My Group   (1)  │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │Task A      │─┼──DRAG───┐    │ │Task B      │ │
│ └─────────────┘ │         │    │ └─────────────┘ │
│ ┌─────────────┐ │         │    └─────────────────┘
│ │Task B      │ │         │
│ └─────────────┘ │         │         ┌─────────────┐
└─────────────────┘         └────────>│Task A      │
                                      └─────────────┘
                                      (floating free)

WHAT HAPPENED:
- Task A is now floating on its own
- Moving "My Group" won't move Task A anymore
- Group count: 2 → 1
```

---

## 5. Collapsing a Group

**I click the collapse button on a group**

```
BEFORE (expanded):               AFTER (collapsed):
┌─────────────────┐              ┌─────────────────┐
│ ▼ My Group (3)  │   CLICK ▼    │ ▶ My Group (3)  │
│ ┌─────────────┐ │   ─────────> └─────────────────┘
│ │Task A      │ │
│ └─────────────┘ │              (tasks hidden but NOT deleted)
│ ┌─────────────┐ │
│ │Task B      │ │              Click ▶ to expand again
│ └─────────────┘ │              and see all 3 tasks
│ ┌─────────────┐ │
│ │Task C      │ │
│ └─────────────┘ │
└─────────────────┘

WHAT HAPPENED:
- Group shrinks to just the header
- Count "(3)" still shows
- Click again to see tasks
```

---

## 6. Refreshing the Page

**I press F5 or close and reopen the browser**

```
BEFORE REFRESH:                  AFTER REFRESH:
┌─────────────────┐              ┌─────────────────┐
│ To-Do      (2)  │              │ To-Do      (2)  │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │Task A      │ │   F5 ───>    │ │Task A      │ │
│ └─────────────┘ │              │ └─────────────┘ │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │Task B      │ │              │ │Task B      │ │
│ └─────────────┘ │              │ └─────────────┘ │
└─────────────────┘              └─────────────────┘

     ┌───────────┐                    ┌───────────┐
     │Floating   │                    │Floating   │
     └───────────┘                    └───────────┘

EVERYTHING STAYS EXACTLY THE SAME!
- Same positions
- Same groups
- Same task locations
- Nothing jumps or moves
```

---

## 7. Deleting a Group

**I delete a group that has tasks in it**

```
BEFORE:                          AFTER:
┌─────────────────┐
│ Old Project (2) │              ┌─────────────┐
│ ┌─────────────┐ │   DELETE     │Task A      │ (now floating)
│ │Task A      │ │   ─────────> └─────────────┘
│ └─────────────┘ │
│ ┌─────────────┐ │              ┌─────────────┐
│ │Task B      │ │              │Task B      │ (now floating)
│ └─────────────┘ │              └─────────────┘
└─────────────────┘

WHAT HAPPENED:
- Group is gone
- Tasks are NOT deleted
- Tasks now float on canvas
- (or optionally: tasks go back to inbox)
```

---

## Summary: The Rules

| # | When I... | This happens... |
|---|-----------|-----------------|
| 1 | Move task to different group | Old group -1, new group +1 |
| 2 | Move a group | All tasks inside move with it |
| 3 | Drag from inbox to group | Task leaves inbox, appears in group |
| 4 | Drag task out of group | Task floats freely, group -1 |
| 5 | Collapse a group | Tasks hidden (not deleted), count shows |
| 6 | Refresh page | Everything stays exactly the same |
| 7 | Delete a group | Group gone, tasks become floating |
| 8 | Put group inside group | Child group moves with parent |
| 9 | Put empty group in full group | Empty group nests, counts unchanged |
| 10 | Put full group in empty group | Full group nests with its tasks |
| 11 | Select multiple tasks, drag | All move together, spacing preserved |
| 12 | Select multiple groups, drag | All move together with their tasks |
| 13 | Move group after task left | Only current contents move |
| 14 | Drag child group out of parent | Child becomes independent |
| 15 | Select group + its tasks, drag | Group moves (task selection redundant) |

---

## 8. Nested Groups - Put Group Inside Another Group

**I drag "Urgent" group into "Work" group**

```
BEFORE:                              AFTER:
┌─────────────────┐                  ┌─────────────────────────┐
│ Work       (0)  │                  │ Work              (0)   │
│                 │                  │ ┌───────────────────┐   │
│   (empty)       │                  │ │ Urgent       (2)  │   │
└─────────────────┘                  │ │ ┌─────────────┐   │   │
                                     │ │ │Task A      │   │   │
┌─────────────────┐                  │ │ └─────────────┘   │   │
│ Urgent     (2)  │───DRAG INTO──>   │ │ ┌─────────────┐   │   │
│ ┌─────────────┐ │                  │ │ │Task B      │   │   │
│ │Task A      │ │                  │ │ └─────────────┘   │   │
│ └─────────────┘ │                  │ └───────────────────┘   │
│ ┌─────────────┐ │                  └─────────────────────────┘
│ │Task B      │ │
│ └─────────────┘ │
└─────────────────┘

NOW WHEN I MOVE "WORK":
- Urgent group moves with it
- Task A and Task B also move (they're inside Urgent)
- Everything stays together like Russian nesting dolls
```

---

## 9. Nesting Empty Group into Another Group

**I drag an empty group into a group that has tasks**

```
BEFORE:                              AFTER:
┌─────────────────┐                  ┌─────────────────────────┐
│ Project    (2)  │                  │ Project           (2)   │
│ ┌─────────────┐ │                  │ ┌─────────────┐         │
│ │Task A      │ │                  │ │Task A      │         │
│ └─────────────┘ │                  │ └─────────────┘         │
│ ┌─────────────┐ │                  │ ┌─────────────┐         │
│ │Task B      │ │                  │ │Task B      │         │
│ └─────────────┘ │                  │ └─────────────┘         │
└─────────────────┘                  │ ┌───────────────────┐   │
                                     │ │ Empty Group  (0)  │   │
┌─────────────────┐───DRAG INTO──>   │ │                   │   │
│ Empty Group (0) │                  │ │   (empty)         │   │
│                 │                  │ └───────────────────┘   │
│   (empty)       │                  └─────────────────────────┘
└─────────────────┘

WHAT HAPPENED:
- Empty Group is now INSIDE Project
- Project still has 2 tasks (unchanged)
- Moving Project moves everything inside
```

---

## 10. Nesting Group-with-Tasks into Empty Group

**I drag a group containing tasks into an empty group**

```
BEFORE:                              AFTER:
┌─────────────────┐                  ┌─────────────────────────┐
│ Container  (0)  │                  │ Container         (2)   │  <-- Shows 2!
│                 │                  │ ┌───────────────────┐   │
│   (empty)       │                  │ │ Filled       (2)  │   │
└─────────────────┘                  │ │ ┌─────────────┐   │   │
                                     │ │ │Task A      │   │   │
┌─────────────────┐───DRAG INTO──>   │ │ └─────────────┘   │   │
│ Filled     (2)  │                  │ │ ┌─────────────┐   │   │
│ ┌─────────────┐ │                  │ │ │Task B      │   │   │
│ │Task A      │ │                  │ │ └─────────────┘   │   │
│ └─────────────┘ │                  │ └───────────────────┘   │
│ ┌─────────────┐ │                  └─────────────────────────┘
│ │Task B      │ │
│ └─────────────┘ │
└─────────────────┘

WHAT HAPPENED:
- Filled group (with tasks) is now inside Container
- Container count = 2 (counts ALL tasks inside, including nested)
- Filled group count = 2 (its own direct tasks)
- Moving Container moves Filled and both tasks
```

---

## 10b. Task Count with Mixed Nesting

**Container has 1 direct task + a child group with 2 tasks**

```
┌─────────────────────────────────┐
│ Container                  (3)  │  <-- Total: 1 direct + 2 nested
│                                 │
│  ┌───────────┐                  │
│  │Task C    │  <-- Direct task │
│  └───────────┘                  │
│                                 │
│  ┌───────────────────┐          │
│  │ Child        (2)  │          │  <-- Child's own count
│  │ ┌─────────────┐   │          │
│  │ │Task A      │   │          │
│  │ └─────────────┘   │          │
│  │ ┌─────────────┐   │          │
│  │ │Task B      │   │          │
│  │ └─────────────┘   │          │
│  └───────────────────┘          │
└─────────────────────────────────┘

COUNT LOGIC:
- Container shows (3) = Task C (direct) + Task A + Task B (nested)
- Child shows (2) = Task A + Task B (its direct tasks only)
- NO double counting - each task counted once at each level
```

---

## 11. Multi-Select: Move Multiple Tasks Together

**I Ctrl+click to select 3 tasks, then drag them to a group**

```
BEFORE:
┌─────────────────┐    ┌───────────┐  ┌───────────┐  ┌───────────┐
│ Target     (0)  │    │Task 1 ✓  │  │Task 2 ✓  │  │Task 3 ✓  │
│                 │    └───────────┘  └───────────┘  └───────────┘
│   (empty)       │    (selected)     (selected)     (selected)
└─────────────────┘


                  ┌──────DRAG ALL──────┐
                  │                    │
                  ▼                    │

AFTER:
┌─────────────────┐
│ Target     (3)  │   All 3 tasks now in Target
│ ┌─────────────┐ │
│ │Task 1      │ │   Their spacing relative to each
│ └─────────────┘ │   other is PRESERVED
│ ┌─────────────┐ │
│ │Task 2      │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Task 3      │ │
│ └─────────────┘ │
└─────────────────┘
```

---

## 12. Multi-Select: Move Multiple Groups Together

**I select 2 groups (each with tasks) and drag them**

```
BEFORE:
┌─────────────────┐ ✓     ┌─────────────────┐ ✓
│ Group A    (1)  │       │ Group B    (1)  │
│ ┌─────────────┐ │       │ ┌─────────────┐ │
│ │Task 1      │ │       │ │Task 2      │ │
│ └─────────────┘ │       │ └─────────────┘ │
└─────────────────┘       └─────────────────┘
(selected)                (selected)

             ┌──DRAG BOTH──┐
             ▼             ▼

AFTER (moved to new location):
                    ┌─────────────────┐
                    │ Group A    (1)  │
                    │ ┌─────────────┐ │
                    │ │Task 1      │ │
                    │ └─────────────┘ │
                    └─────────────────┘
                    ┌─────────────────┐
                    │ Group B    (1)  │
                    │ ┌─────────────┐ │
                    │ │Task 2      │ │
                    │ └─────────────┘ │
                    └─────────────────┘

WHAT HAPPENED:
- Both groups moved together
- Their tasks moved with them
- Spacing between groups preserved
```

---

## 13. Task Moved Away - What Happens to Old Group?

**A task WAS in Group A, but user moved it to Group B. Now user moves Group A.**

```
STEP 1 - Initial:
┌─────────────────┐
│ Group A    (2)  │
│ ┌─────────────┐ │
│ │Task 1      │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Task 2      │ │
│ └─────────────┘ │
└─────────────────┘

STEP 2 - User moves Task 1 to Group B:
┌─────────────────┐        ┌─────────────────┐
│ Group A    (1)  │        │ Group B    (1)  │
│ ┌─────────────┐ │        │ ┌─────────────┐ │
│ │Task 2      │ │        │ │Task 1      │ │
│ └─────────────┘ │        │ └─────────────┘ │
└─────────────────┘        └─────────────────┘

STEP 3 - User moves Group A to new spot:
           ┌─────────────────┐        ┌─────────────────┐
           │ Group A    (1)  │        │ Group B    (1)  │
           │ ┌─────────────┐ │        │ ┌─────────────┐ │
           │ │Task 2      │ │        │ │Task 1      │ │
           │ └─────────────┘ │        │ └─────────────┘ │
           └─────────────────┘        └─────────────────┘
           (moved)                    (stayed put)

WHAT HAPPENED:
- Task 2 moved with Group A (it's still inside)
- Task 1 did NOT move (it belongs to Group B now)
- Group B stayed where it was
```

---

## 14. Select Child Group Inside Parent - What Happens to Parent?

**Parent contains a child group. I select ONLY the child and move it OUT.**

```
BEFORE:
┌─────────────────────────┐
│ Parent                  │
│ ┌───────────────────┐   │
│ │ Child ✓      (1)  │   │ <-- I select only Child
│ │ ┌─────────────┐   │   │
│ │ │Task        │   │   │
│ │ └─────────────┘   │   │
│ └───────────────────┘   │
└─────────────────────────┘

         ┌──DRAG OUT──┐
         ▼

AFTER:
┌─────────────────────────┐     ┌───────────────────┐
│ Parent                  │     │ Child        (1)  │
│                         │     │ ┌─────────────┐   │
│   (now empty)           │     │ │Task        │   │
│                         │     │ └─────────────┘   │
└─────────────────────────┘     └───────────────────┘
                                (now independent)

WHAT HAPPENED:
- Child group is now outside Parent
- Task is still inside Child
- Parent is now empty
- Moving Parent won't move Child anymore
```

---

## 15. Select Tasks AND Their Parent Group - Move Everything

**I select both a task AND the group it's in, then drag**

```
BEFORE:
┌─────────────────┐ ✓
│ My Group   (2)  │      <-- Selected
│ ┌─────────────┐ │
│ │Task A ✓    │ │      <-- Also selected
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Task B      │ │      <-- NOT selected
│ └─────────────┘ │
└─────────────────┘

         ┌──DRAG──┐
         ▼

AFTER (everything moves as a unit):
                    ┌─────────────────┐
                    │ My Group   (2)  │
                    │ ┌─────────────┐ │
                    │ │Task A      │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │Task B      │ │
                    │ └─────────────┘ │
                    └─────────────────┘

WHAT HAPPENED:
- Whole group moved (including Task B which wasn't selected)
- When you select a group, its contents come along
- Selecting Task A was redundant (it would move anyway)
```

---

---

## 16. Edit a Task - Position Must Not Change

**I click a task, edit its title, save**

```
BEFORE EDIT:
┌─────────────────┐
│ My Group        │
│                 │
│      ┌──────┐   │
│      │Task A│   │  <-- In this exact spot
│      └──────┘   │
└─────────────────┘

AFTER EDIT (title changed to "Task A - updated"):
┌─────────────────┐
│ My Group        │
│                 │
│      ┌────────────┐
│      │Task A -    │  <-- SAME exact spot!
│      │updated     │
│      └────────────┘
└─────────────────┘

⚠️ PAST BUG (BUG-003): Task jumped to wrong location after edit
```

---

## 17. Delete a Task - Other Tasks Don't Move

**I delete one task, other tasks stay put**

```
BEFORE DELETE:
┌─────────────────┐      ┌───────────┐
│ My Group   (2)  │      │Task C    │
│ ┌─────────────┐ │      └───────────┘
│ │Task A      │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Task B      │ │  <-- DELETE THIS
│ └─────────────┘ │
└─────────────────┘

AFTER DELETE:
┌─────────────────┐      ┌───────────┐
│ My Group   (1)  │      │Task C    │  <-- Same spot!
│ ┌─────────────┐ │      └───────────┘
│ │Task A      │ │  <-- Same spot!
│ └─────────────┘ │
│                 │
│                 │
└─────────────────┘

⚠️ PAST BUG (BUG-020): Deleting task reset OTHER task positions
```

---

## 18. Drop Task in Smart Group - Due Date Updates Instantly

**I drop a task into "Tomorrow" group**

```
BEFORE:
┌─────────────────┐      ┌───────────┐
│ Tomorrow        │      │My Task   │
│                 │      │Due: none │
│   (empty)       │      └───────────┘
└─────────────────┘

         ┌──DRAG──┐
         ▼

AFTER:
┌─────────────────┐
│ Tomorrow   (1)  │
│ ┌─────────────┐ │
│ │My Task     │ │  Due date is NOW tomorrow!
│ │Due: Jan 11 │ │  (visible immediately)
│ └─────────────┘ │
└─────────────────┘

⚠️ PAST BUG (TASK-116): Due date didn't update until page refresh
```

---

## 19. Can't Drag Tasks Inside Nested Group

**Nested group tasks must still be draggable**

```
┌─────────────────────────┐
│ Parent                  │
│ ┌───────────────────┐   │
│ │ Child             │   │
│ │ ┌─────────────┐   │   │
│ │ │Task A      │─┼─┼── MUST be able to drag this!
│ │ └─────────────┘   │   │
│ └───────────────────┘   │
└─────────────────────────┘

⚠️ PAST BUG (BUG-153): Tasks in nested groups couldn't be dragged
```

---

## 20. Count Badge Must Update Immediately After Drop

**Drop task in group, count updates RIGHT AWAY**

```
BEFORE:                    AFTER DROP:
┌─────────────────┐        ┌─────────────────┐
│ My Group   (0)  │   →    │ My Group   (1)  │  <-- Instantly!
│                 │        │ ┌─────────────┐ │
│   (empty)       │        │ │New Task    │ │
└─────────────────┘        │ └─────────────┘ │
                           └─────────────────┘

⚠️ PAST BUG (BUG-152): Count didn't update until page refresh
```

---

## 21. Unrelated Groups Must NOT Move Together

**Dragging one group should not move unrelated groups**

```
BEFORE:
┌─────────────────┐        ┌─────────────────┐
│ Work            │        │ Personal        │
│                 │        │                 │
└─────────────────┘        └─────────────────┘

I DRAG "Work" to the right:

CORRECT:
         ┌─────────────────┐   ┌─────────────────┐
         │ Work            │   │ Personal        │
         │                 │   │                 │
         └─────────────────┘   └─────────────────┘
         (moved)               (stayed put!)

WRONG (BUG-025):
         ┌─────────────────┐            ┌─────────────────┐
         │ Work            │            │ Personal        │
         │                 │            │                 │
         └─────────────────┘            └─────────────────┘
         (moved)                        (also moved - BAD!)
```

---

## 22. Deleted Groups Must Not Reappear (No Zombies)

**I delete a group, it stays deleted after refresh**

```
STEP 1 - Delete "Old Project":
┌─────────────────┐
│ Old Project     │  DELETE →  (gone)
└─────────────────┘

STEP 2 - Refresh page (F5):

CORRECT:
(group stays gone - it was deleted)

WRONG (BUG-060/061):
┌─────────────────┐
│ Old Project     │  <-- ZOMBIE! It came back!
└─────────────────┘
```

---

## 23. Login Should Not Remove Tasks

**I log in, my tasks are still there**

```
BEFORE LOGIN:
┌─────────────────┐
│ My Group   (3)  │
│ Task A, B, C    │
└─────────────────┘

AFTER LOGIN:
┌─────────────────┐
│ My Group   (3)  │  <-- Same tasks!
│ Task A, B, C    │
└─────────────────┘

⚠️ PAST BUG (BUG-169): Tasks disappeared after logging in
```

---

## 24. Shift+Drag Selection Works Inside Groups

**I hold Shift and drag to select multiple tasks inside a group**

```
┌─────────────────────────┐
│ My Group                │
│                         │
│  ┌───────────────────┐  │
│  │ Selection Box     │  │  <-- Shift+drag creates this
│  │  ┌──────┐ ┌──────┐│  │
│  │  │Task A│ │Task B││  │  <-- Both get selected
│  │  └──────┘ └──────┘│  │
│  └───────────────────┘  │
└─────────────────────────┘

⚠️ PAST BUG (BUG-001): Selection only worked outside groups
```

---

## 25. Multi-Drag: Positions Preserved After Click

**I multi-select, drag, then click to deselect - positions stay**

```
STEP 1 - Select 3 tasks (Ctrl+click):
┌───────────┐  ┌───────────┐  ┌───────────┐
│Task A ✓  │  │Task B ✓  │  │Task C ✓  │
└───────────┘  └───────────┘  └───────────┘

STEP 2 - Drag them all to new position:
              ┌───────────┐  ┌───────────┐  ┌───────────┐
              │Task A ✓  │  │Task B ✓  │  │Task C ✓  │
              └───────────┘  └───────────┘  └───────────┘

STEP 3 - Click anywhere to deselect:
              ┌───────────┐  ┌───────────┐  ┌───────────┐
              │Task A    │  │Task B    │  │Task C    │
              └───────────┘  └───────────┘  └───────────┘
              (all stay in new position!)

⚠️ PAST BUG (BUG-004): Tasks jumped back to old positions after deselect
```

---

---

## 26. Smart Group: "Today" Sets Due Date to Today

**I drop a task into the "Today" group**

```
BEFORE:                          AFTER:
┌───────────┐                    ┌─────────────────┐
│My Task   │                    │ Today      (1)  │
│Due: none │───DRAG TO TODAY──> │ ┌─────────────┐ │
└───────────┘                    │ │My Task     │ │
                                 │ │Due: Jan 10 │ │  <-- Today's date!
                                 │ └─────────────┘ │
                                 └─────────────────┘
```

---

## 27. Smart Group: "This Week" Sets Due Date to End of Week

**I drop a task into "This Week" group**

```
BEFORE:                          AFTER:
┌───────────┐                    ┌─────────────────┐
│My Task   │                    │ This Week  (1)  │
│Due: none │───DRAG──────────>  │ ┌─────────────┐ │
└───────────┘                    │ │My Task     │ │
                                 │ │Due: Jan 12 │ │  <-- End of this week!
                                 │ └─────────────┘ │
                                 └─────────────────┘
```

---

## 28. Smart Group: "Later" Clears Due Date

**I drop a task into "Later" group**

```
BEFORE:                          AFTER:
┌───────────┐                    ┌─────────────────┐
│My Task   │                    │ Later      (1)  │
│Due: Jan 5│───DRAG──────────>  │ ┌─────────────┐ │
└───────────┘                    │ │My Task     │ │
                                 │ │Due: none   │ │  <-- Due date cleared!
                                 │ └─────────────┘ │
                                 └─────────────────┘
```

---

## 29. Smart Group: "Monday" Sets Due Date to Next Monday

**I drop a task into "Monday" group (today is Saturday)**

```
BEFORE:                          AFTER:
┌───────────┐                    ┌──────────────────────┐
│My Task   │                    │ Monday / 12.1.26 (1) │
│Due: none │───DRAG──────────>  │ ┌─────────────┐      │
└───────────┘                    │ │My Task     │      │
                                 │ │Due: Jan 12 │      │  <-- Next Monday!
                                 │ └─────────────┘      │
                                 └──────────────────────┘

If today IS Monday, sets to TODAY (not next week)
```

---

## 30. Smart Group: "Friday" Sets Due Date to Next Friday

**I drop a task into "Friday" group**

```
BEFORE:                          AFTER:
┌───────────┐                    ┌──────────────────────┐
│My Task   │                    │ Friday / 16.1.26 (1) │
│Due: none │───DRAG──────────>  │ ┌─────────────┐      │
└───────────┘                    │ │My Task     │      │
                                 │ │Due: Jan 16 │      │  <-- Next Friday!
                                 │ └─────────────┘      │
                                 └──────────────────────┘
```

---

## 31. Smart Group: "High Priority" Sets Priority

**I drop a task into "High Priority" group**

```
BEFORE:                          AFTER:
┌────────────┐                   ┌─────────────────────┐
│My Task    │                   │ High Priority  (1)  │
│Priority: -│───DRAG─────────>  │ ┌─────────────────┐ │
└────────────┘                   │ │My Task         │ │
                                 │ │Priority: HIGH  │ │  <-- Priority set!
                                 │ └─────────────────┘ │
                                 └─────────────────────┘

Same for "Medium Priority" and "Low Priority" groups
```

---

## 32. Smart Group: Duration Groups Set Estimate

**I drop a task into "Quick (15m)" group**

```
BEFORE:                          AFTER:
┌─────────────┐                  ┌─────────────────────┐
│My Task     │                  │ Quick         (1)   │
│Duration: - │───DRAG─────────> │ ┌─────────────────┐ │
└─────────────┘                  │ │My Task         │ │
                                 │ │Duration: 15min │ │  <-- Estimate set!
                                 │ └─────────────────┘ │
                                 └─────────────────────┘

Duration groups:
- Quick = 15 minutes
- Short = 30 minutes
- Medium = 60 minutes
- Long = 120 minutes
```

---

## 33. Nested Smart Groups: Inherit Multiple Properties

**"High Priority" group is inside "Today" group. I drop a task into "High Priority".**

```
┌─────────────────────────────┐
│ Today                       │
│ ┌─────────────────────────┐ │
│ │ High Priority           │ │
│ │                         │ │  <-- I drop task HERE
│ └─────────────────────────┘ │
└─────────────────────────────┘

RESULT - Task gets BOTH properties:
┌─────────────────┐
│My Task         │
│Due: TODAY      │  <-- From "Today" (parent)
│Priority: HIGH  │  <-- From "High Priority" (target)
└─────────────────┘

Task inherits from ALL containing groups!
```

---

## 34. Move Task OUT of Smart Group - Properties Stay

**I move a task OUT of "Today" group to empty canvas**

```
BEFORE:                          AFTER:
┌─────────────────┐              ┌─────────────────┐
│ Today      (1)  │              │ Today      (0)  │
│ ┌─────────────┐ │              │                 │
│ │My Task     │─┼──DRAG OUT──> │   (empty)       │
│ │Due: Jan 10 │ │              └─────────────────┘
│ └─────────────┘ │
└─────────────────┘              ┌─────────────────┐
                                 │My Task         │
                                 │Due: Jan 10     │  <-- Due date STAYS!
                                 └─────────────────┘

Moving OUT does NOT clear the property!
(User must explicitly change due date if they want)
```

---

## Smart Group Reference Table

| Group Name | What It Sets | Value |
|------------|--------------|-------|
| **Today** | dueDate | Today's date |
| **Tomorrow** | dueDate | Tomorrow's date |
| **This Week** | dueDate | End of current week |
| **Later** | dueDate | Clears (null) |
| **Monday** | dueDate | Next Monday (or today if Monday) |
| **Tuesday** | dueDate | Next Tuesday |
| **Wednesday** | dueDate | Next Wednesday |
| **Thursday** | dueDate | Next Thursday |
| **Friday** | dueDate | Next Friday |
| **Saturday** | dueDate | Next Saturday |
| **Sunday** | dueDate | Next Sunday |
| **High Priority** | priority | "high" |
| **Medium Priority** | priority | "medium" |
| **Low Priority** | priority | "low" |
| **Quick** | estimatedDuration | 15 |
| **Short** | estimatedDuration | 30 |
| **Medium** | estimatedDuration | 60 |
| **Long** | estimatedDuration | 120 |

---

## Summary: All 34 Scenarios

| # | Scenario | What Must Work |
|---|----------|----------------|
| **Basic** | | |
| 1 | Move task between groups | Counts update, parent changes |
| 2 | Move group | All tasks inside follow |
| 3 | Inbox → Canvas | Task leaves inbox, joins group |
| 4 | Task out of group | Task floats, count decreases |
| 5 | Collapse group | Tasks hidden, count shows |
| 6 | Refresh page | Everything identical |
| 7 | Delete group | Tasks orphaned, not deleted |
| **Nesting** | | |
| 8 | Group inside group | Child moves with parent |
| 9 | Empty group in full | Nests, counts unchanged |
| 10 | Full group in empty | Nests with tasks |
| **Multi-select** | | |
| 11 | Multi-select tasks | All move together |
| 12 | Multi-select groups | All move with tasks |
| 13 | Move after task left | Only current contents move |
| 14 | Child out of parent | Child independent |
| 15 | Group + tasks selected | Group wins (redundant) |
| **Past Bugs** | | |
| 16 | Edit task | Position unchanged |
| 17 | Delete task | Other positions unchanged |
| 18 | Smart group drop | Due date updates instantly |
| 19 | Nested task drag | Still draggable |
| 20 | Drop updates count | Immediately, not on refresh |
| 21 | Drag group | Unrelated groups don't move |
| 22 | Delete group | Stays deleted (no zombies) |
| 23 | Login | Tasks don't disappear |
| 24 | Shift+drag inside group | Selection works |
| 25 | Multi-drag + click | Positions preserved |
| **Smart Groups** | | |
| 26 | Drop in "Today" | dueDate = today |
| 27 | Drop in "This Week" | dueDate = end of week |
| 28 | Drop in "Later" | dueDate = cleared |
| 29 | Drop in "Monday" | dueDate = next Monday |
| 30 | Drop in "Friday" | dueDate = next Friday |
| 31 | Drop in "High Priority" | priority = high |
| 32 | Drop in "Quick" | duration = 15 min |
| 33 | Nested smart groups | Inherit from ALL parents |
| 34 | Move OUT of smart group | Properties stay set |
| 35 | Resize group | Only resized group changes, contents unchanged |
| 36 | Group containment by size | Smaller group in larger becomes child |

---

## 36. Group Containment - Size Determines Parent-Child

**When a smaller group is placed inside a larger group, the smaller one becomes a CHILD**

This is automatic - the canvas detects containment based on size and position.

```
EXAMPLE 1: Place small group inside large group
─────────────────────────────────────────────────
BEFORE (two separate groups):
┌─────────────────────────────┐        ┌───────────────┐
│ Large Group                 │        │ Small Group   │
│                             │        │               │
│                             │        └───────────────┘
│                             │
└─────────────────────────────┘

I DRAG Small Group INTO Large Group:

AFTER (Small is now CHILD of Large):
┌─────────────────────────────┐
│ Large Group            (0)  │  <-- Container/Parent
│                             │
│   ┌───────────────┐         │
│   │ Small Group   │         │  <-- Child (appears ABOVE parent)
│   │               │         │
│   └───────────────┘         │
│                             │
└─────────────────────────────┘


EXAMPLE 2: Two groups overlapping - size determines parent
─────────────────────────────────────────────────
SCENARIO: A small 200x200 group overlaps with a large 500x400 group

RESULT:
- The LARGER group (500x400) becomes the CONTAINER
- The SMALLER group (200x200) becomes the CHILD
- If the small group is fully inside the large one → automatic nesting

┌─────────────────────────────────────┐
│ Large (500x400)                     │
│                                     │
│    ┌──────────────┐                 │
│    │ Small        │                 │
│    │ (200x200)    │                 │
│    │              │                 │
│    └──────────────┘                 │
│                                     │
└─────────────────────────────────────┘


EXAMPLE 3: Multiple levels of nesting
─────────────────────────────────────────────────
- Biggest group (600x500) = root container
- Medium group (300x250) inside it = child of biggest
- Smallest group (150x100) inside medium = child of medium

┌─────────────────────────────────────────┐
│ Big Container                           │
│                                         │
│   ┌─────────────────────────┐           │
│   │ Medium                  │           │
│   │                         │           │
│   │   ┌───────────────┐     │           │
│   │   │ Small         │     │           │
│   │   │               │     │           │
│   │   └───────────────┘     │           │
│   │                         │           │
│   └─────────────────────────┘           │
│                                         │
└─────────────────────────────────────────┘


Z-INDEX RULES:
- Smaller/nested groups ALWAYS appear ABOVE their parent groups
- Tasks ALWAYS appear above ALL groups (100+)
- Deepest nested group has highest z-index among groups


WHAT MUST HAPPEN:
- Containment detected by: smaller group's bounds INSIDE larger group's bounds
- Automatic parent-child assignment when positions overlap
- Child groups move with parent when parent is dragged
- Child groups appear ABOVE parent (visible, not hidden behind)
- Task counts on parent include tasks in ALL nested children
```

---

## 35. Resize Group - Only Resized Group Changes

**I resize ANY group by dragging its corner handle**

This applies to ALL groups - parent groups, child groups, standalone groups, nested groups at any level.

```
EXAMPLE 1: Resize a parent group (has children)
─────────────────────────────────────────────────
BEFORE:
┌─────────────────────────────────┐
│ Parent Group                    │
│                                 │
│  ┌─────────────────┐            │
│  │ Child      (2)  │            │
│  │ ┌───────────┐   │            │
│  │ │Task A    │   │            │
│  │ └───────────┘   │            │
│  └─────────────────┘            │
└─────────────────────────────────┘

I RESIZE Parent Group (make it wider):

AFTER:
┌─────────────────────────────────────────────────┐
│ Parent Group                                     │
│                                                  │
│  ┌─────────────────┐                             │
│  │ Child      (2)  │  <-- SAME size!             │
│  │ ┌───────────┐   │  <-- SAME position!         │
│  │ │Task A    │   │                             │
│  │ └───────────┘   │                             │
│  └─────────────────┘                             │
└─────────────────────────────────────────────────┘


EXAMPLE 2: Resize a child group (inside a parent)
─────────────────────────────────────────────────
BEFORE:
┌─────────────────────────────────┐
│ Parent                          │
│  ┌─────────────────┐            │
│  │ Child      (1)  │            │
│  │ ┌───────────┐   │            │
│  │ │Task      │   │            │
│  │ └───────────┘   │            │
│  └─────────────────┘            │
└─────────────────────────────────┘

I RESIZE Child group (make it taller):

AFTER:
┌─────────────────────────────────┐
│ Parent                          │  <-- SAME size!
│  ┌─────────────────┐            │
│  │ Child      (1)  │            │
│  │ ┌───────────┐   │            │
│  │ │Task      │   │  <-- Task unchanged!
│  │ └───────────┘   │            │
│  │                 │            │
│  │                 │            │  <-- Child is now taller
│  └─────────────────┘            │
└─────────────────────────────────┘


EXAMPLE 3: Resize a standalone group (no parent, no children)
─────────────────────────────────────────────────
BEFORE:
┌─────────────────┐
│ My Group   (2)  │
│ ┌─────────────┐ │
│ │Task A      │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Task B      │ │
│ └─────────────┘ │
└─────────────────┘

I RESIZE My Group:

AFTER:
┌─────────────────────────────┐
│ My Group               (2)  │
│ ┌─────────────┐             │
│ │Task A      │             │  <-- SAME position!
│ └─────────────┘             │
│ ┌─────────────┐             │
│ │Task B      │             │  <-- SAME position!
│ └─────────────┘             │
│                             │
└─────────────────────────────┘


WHAT MUST HAPPEN (for ANY group):
- ONLY the resized group's dimensions change
- Parent groups (if any) stay same size and position
- Child groups (if any) stay same size and position
- Tasks inside stay same size and position
- Sibling groups stay same size and position
- NO cascade resize to children
- NO cascade resize to parent
- NO position adjustments to anything
```

---

## The Bugs We're Fixing

| Bug ID | What Went Wrong | Fixed In Rebuild |
|--------|-----------------|------------------|
| BUG-003 | Task jumped after edit | Phase 4 |
| BUG-004 | Multi-drag reset on deselect | Phase 4 |
| BUG-020 | Delete reset other positions | Phase 4 |
| BUG-025 | Unrelated groups moved together | Phase 5 |
| BUG-060/061 | Deleted groups reappeared | Phase 2 |
| BUG-151 | Tasks empty on first load | Phase 3 |
| BUG-152 | Count didn't update after drop | Phase 5 |
| BUG-153 | Nested groups completely broken | Phase 5 |
| BUG-169 | Tasks disappeared on login | Phase 3 |
| TASK-116 | Smart group due date not instant | Phase 5 |

---

## Testing Checklist by Phase

### Phase 2: Groups Load
- [ ] Groups appear on canvas from Supabase
- [ ] Group positions are correct
- [ ] Deleted groups stay deleted (no zombies) → Scenario 22

### Phase 3: Tasks Load
- [ ] Tasks appear in inbox
- [ ] Tasks with positions appear on canvas
- [ ] Tasks don't disappear on login → Scenario 23

### Phase 4: Drag/Drop Basic
- [ ] Move task between groups → Scenario 1
- [ ] Drag from inbox to canvas → Scenario 3
- [ ] Drag task out of group → Scenario 4
- [ ] Edit task - position stays → Scenario 16
- [ ] Delete task - others stay → Scenario 17
- [ ] Count updates immediately → Scenario 20

### Phase 5: Parent-Child (MOST TESTS HERE)
- [ ] Move group - tasks follow → Scenario 2
- [ ] Collapse group → Scenario 5
- [ ] Refresh - everything persists → Scenario 6
- [ ] Delete group - tasks orphan → Scenario 7
- [ ] Group inside group → Scenarios 8-10b
- [ ] Multi-select operations → Scenarios 11-15
- [ ] Smart group drops → Scenarios 18, 26-34
- [ ] Nested task draggable → Scenario 19
- [ ] Unrelated groups don't move → Scenario 21
- [ ] Shift+drag inside groups → Scenario 24
- [ ] Multi-drag positions preserved → Scenario 25

### Phase 6: Feature Parity
- [ ] Resize group - only resized group changes → Scenario 35
- [ ] All 35 scenarios pass
- [ ] All past bugs prevented
- [ ] Performance acceptable (50+ groups/tasks)
