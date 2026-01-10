# Scenario → Checklist Coverage Map

**Purpose**: Prove that every scenario in USER-SCENARIOS.md is covered by IMPLEMENTATION-CHECKLIST.md

---

## Complete Mapping (36 Scenarios → 6 Layers)

| Scenario # | Description | Checklist Layer | Checklist Item |
|------------|-------------|-----------------|----------------|
| **Basic (1-7)** | | | |
| 1 | Move task between groups | Layer 3 | 3.1, 3.2, 3.3 |
| 2 | Move group - tasks follow | Layer 2 | 2.1, 2.2 |
| 3 | Inbox → Canvas | Layer 5 | 5.2, 5.3 |
| 4 | Task out of group | Layer 3 | 3.3 |
| 5 | Collapse group | Layer 6 | 6.1 |
| 6 | Refresh page - everything persists | Layer 1 | **1.5, 1.9** (CRITICAL) |
| 7 | Delete group - tasks orphan | Layer 6 | 6.7 |
| **Nesting (8-10b)** | | | |
| 8 | Group inside group | Layer 2 | 2.1, 2.4 |
| 9 | Empty group in full group | Layer 3 | 3.4 |
| 10 | Full group in empty group | Layer 3 | 3.4 |
| 10a | Children visible during drag | Layer 2 | 2.3 |
| 10b | Task count with mixed nesting | Layer 2 | 2.5, 2.6 |
| **Multi-select (11-15)** | | | |
| 11 | Multi-select tasks, drag | Layer 6 | 6.3, 6.4 |
| 12 | Multi-select groups, drag | Layer 6 | 6.3, 6.4 |
| 13 | Move group after task left | Layer 2 | 2.1, 2.2 |
| 14 | Child group out of parent | Layer 3 | 3.5, 3.6 |
| 15 | Group + tasks selected, drag | Layer 6 | 6.3, 6.4 |
| **Past Bugs (16-25)** | | | |
| 16 | Edit task - position stays | Layer 1 | 1.8, 1.9 |
| 17 | Delete task - others stay | Layer 1 | 1.8, 1.9 |
| 18 | Smart group drop - instant update | Layer 6 | 6.8 |
| 19 | Nested task drag works | Layer 2 | 2.2 |
| 20 | Drop updates count immediately | Layer 5 | 5.4 |
| 21 | Unrelated groups don't move | Layer 1 | 1.3, 1.4 |
| 22 | Delete group - no zombies | Layer 6 | 6.7 |
| 23 | Login - tasks stay | Layer 1 | 1.6, 1.9 |
| 24 | Shift+drag inside group | Layer 6 | 6.3 |
| 25 | Multi-drag positions preserved | Layer 6 | 6.4 |
| **Smart Groups (26-34)** | | | |
| 26 | Drop in "Today" | Layer 6 | 6.8 |
| 27 | Drop in "This Week" | Layer 6 | 6.8 |
| 28 | Drop in "Later" | Layer 6 | 6.8 |
| 29 | Drop in "Monday" | Layer 6 | 6.8 |
| 30 | Drop in "Friday" | Layer 6 | 6.8 |
| 31 | Drop in "High Priority" | Layer 6 | 6.8 |
| 32 | Drop in "Quick" duration | Layer 6 | 6.8 |
| 33 | Nested smart groups | Layer 6 | 6.8 |
| 34 | Move OUT of smart group | Layer 6 | 6.8 |
| **Additional (35-36)** | | | |
| 35 | Resize group | Layer 6 | 6.2 |
| 36 | Group containment by size | Layer 3 | 3.4 |

---

## Layer Dependencies (Build Order)

```
Layer 1: Foundation
    └── MUST work before anything else
    └── Groups load, display, drag, persist, REFRESH
    └── Tasks load, display, drag, persist
    └── Covers: 6, 16, 17, 21, 23

Layer 2: Parent-Child Basics
    └── Requires Layer 1
    └── Children move with parent
    └── Task counting (recursive)
    └── Children visible during drag
    └── Covers: 2, 8, 10a, 10b, 13, 19

Layer 3: Containment Detection
    └── Requires Layer 2
    └── Drag task INTO group
    └── Drag task OUT of group
    └── Drag group INTO group (by size)
    └── Parent doesn't move when child exits
    └── Covers: 1, 4, 9, 10, 14, 36

Layer 4: Z-Index & Visual Layering
    └── Requires Layer 3
    └── Tasks above groups
    └── Child groups above parent groups
    └── No stacking context traps
    └── Covers: (visual quality, no specific scenario)

Layer 5: Inbox Integration
    └── Requires Layer 4
    └── Inbox panel shows inbox tasks
    └── Drag from inbox to canvas
    └── Drag from inbox to group
    └── Covers: 3, 20

Layer 6: Advanced Features
    └── Requires Layer 5
    └── Collapse/expand
    └── Resize
    └── Multi-select
    └── Context menus
    └── Smart groups
    └── Delete group (tasks orphan)
    └── Covers: 5, 7, 11, 12, 15, 18, 22, 24, 25, 26-34, 35
```

---

## Verification: No Scenario Left Behind

**All 36 scenarios are mapped:**
- Scenarios 1-7: ✅ Mapped
- Scenarios 8-10b: ✅ Mapped
- Scenarios 11-15: ✅ Mapped
- Scenarios 16-25: ✅ Mapped
- Scenarios 26-34: ✅ Mapped (all smart groups → 6.8)
- Scenarios 35-36: ✅ Mapped

**Coverage by Layer:**
| Layer | Scenario Count | Scenarios |
|-------|----------------|-----------|
| Layer 1 | 5 | 6, 16, 17, 21, 23 |
| Layer 2 | 6 | 2, 8, 10a, 10b, 13, 19 |
| Layer 3 | 6 | 1, 4, 9, 10, 14, 36 |
| Layer 4 | 0 | (visual quality layer) |
| Layer 5 | 2 | 3, 20 |
| Layer 6 | 17 | 5, 7, 11, 12, 15, 18, 22, 24, 25, 26-35 |
| **Total** | **36** | **All covered** |

---

## Why This Order?

Each layer builds on the previous:

1. **Can't do parent-child (Layer 2)** if groups don't load/persist (Layer 1)
2. **Can't do containment detection (Layer 3)** if parent-child doesn't work
3. **Can't fix z-index (Layer 4)** if containment doesn't work
4. **Can't do inbox integration (Layer 5)** if basic canvas doesn't work
5. **Can't do advanced features (Layer 6)** if basics are broken

---

## How To Use This Map

When implementing each checklist item:
1. Look up which scenarios it covers in this map
2. After implementing, verify those specific scenarios work
3. Mark checklist item as verified
4. Move to next item

When a scenario fails:
1. Look up which layer/item should handle it
2. Fix that specific item
3. Re-verify the scenario
4. Don't add patches elsewhere
