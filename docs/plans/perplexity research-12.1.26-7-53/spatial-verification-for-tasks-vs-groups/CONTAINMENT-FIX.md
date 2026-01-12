# Fix: Only Group Tasks That Are Actually Inside Groups

**Your Problem:**
> Tasks that are NOT in groups are being counted and dragged by groups - but this needs to happen only when the tasks are physically inside the groups

**Root Cause:**
You're using `parentGroupId` field to determine parent-child relationships, but the `parentGroupId` doesn't match the actual spatial position.

**Solution:**
Use **spatial containment detection** - only treat a task as part of a group if it's physically inside the group's bounds.

---

## The Bug Explained

### Current (Wrong) Behavior
```typescript
// Database
{
  id: 'task-1',
  position: { x: 500, y: 500 },    // Way outside the group!
  parentGroupId: 'group-1'          // But still marked as child
}

// Vue Flow behavior
{
  id: 'section-task-1',
  parentNode: 'section-group-1',   // ← Will be dragged with group!
  position: { x: -200, y: -200 }   // Relative position (wrong!)
}
```

Task is 500 pixels away from group, but still moves with it!

### Correct (Fixed) Behavior
```typescript
// Database - after fix
{
  id: 'task-1',
  position: { x: 500, y: 500 },    // Outside group bounds
  parentGroupId: null                // NOT a child!
}

// Vue Flow behavior
{
  id: 'section-task-1',
  parentNode: undefined,             // No parent!
  position: { x: 500, y: 500 }      // Stays where it is
}
```

Task stays independent and doesn't move with group.

---

## Implementation Steps

### Step 1: Add Spatial Containment Utility

Copy `spatial-containment.ts` to `src/utils/`.

This gives you:
- `isNodeCompletelyInside()` - Check if task is physically inside group
- `getDeepestContainingGroup()` - Find correct parent based on position
- `fixContainmentIssues()` - Auto-correct bad parent assignments
- `validateContainment()` - Verify parent matches spatial reality

### Step 2: Update Drag Handler to Detect Containment

When user drops a task, check if it's actually inside a group:

```typescript
async function handleDragEnd(event: any) {
  const { node } = event;
  const nodeId = node.id.replace('section-', '');

  // Find current position
  const absolutePos = toAbsolutePosition(node, dbNodes.value);
  
  // Find which group this task is ACTUALLY in (spatial, not parentGroupId)
  const containingGroup = getDeepestContainingGroup(
    { ...dbNodes.value.find(n => n.id === nodeId)!, position: absolutePos },
    dbNodes.value
  );

  // The correct parent is what we found spatially, not what the DB said
  const correctParent = containingGroup?.id || null;
  const dbNode = dbNodes.value.find(n => n.id === nodeId);
  
  // If it moved to a different group, update the parent
  if (dbNode?.parentGroupId !== correctParent) {
    console.log(`Task moved from group ${dbNode?.parentGroupId} to ${correctParent}`);
    
    await supabase
      .from('nodes')
      .update({
        parent_group_id: correctParent,
        position: absolutePos,
        version: currentVersion + 1
      })
      .eq('id', nodeId)
      .eq('version', currentVersion);
  } else {
    // Same parent, just update position
    await supabase
      .from('nodes')
      .update({
        position: absolutePos,
        version: currentVersion + 1
      })
      .eq('id', nodeId)
      .eq('version', currentVersion);
  }
}
```

### Step 3: Fix Initial Load - Validate All Parents

When loading canvas, validate that all parentGroupId values match spatial reality:

```typescript
async function loadNodesAndFixContainment(supabaseClient: any) {
  // Load all nodes
  const { data } = await supabaseClient.from('nodes').select('*');
  dbNodes.value = data;

  // Use the spatial containment composable
  const { validateAllNodes, autoCorrectParents, getContainmentMismatches } = 
    useSpatialContainment(dbNodes, nodeVersionMap);

  // Check for problems
  const mismatches = getContainmentMismatches.value;
  
  if (mismatches.length > 0) {
    console.warn(`Found ${mismatches.length} containment mismatches:`);
    mismatches.forEach(m => {
      console.log(`  ${m.nodeId}: claims ${m.claimedParent}, actually in ${m.visualParent}`);
    });

    // Auto-correct in database
    await autoCorrectParents(supabaseClient);
  }
}
```

### Step 4: Only Use Vue Flow's ParentNode if Spatial Containment Matches

Update `dbNodesToVueFlowNodes()` to check spatial containment:

```typescript
export function dbNodesToVueFlowNodesWithSpatialCheck(
  dbNodes: DbNode[]
): VueFlowNode[] {
  return dbNodes.map(dbNode => {
    // Get parent from parentGroupId
    let parent = dbNode.parentGroupId
      ? dbNodes.find(n => n.id === dbNode.parentGroupId)
      : null;

    // CRITICAL: Verify parent is actually containing this node spatially
    if (parent && !isNodeCompletelyInside(dbNode, parent)) {
      console.warn(
        `Node ${dbNode.id} claims parent ${parent.id} but is not spatially contained. ` +
        `Removing parent relationship.`
      );
      parent = null; // Ignore the claimed parent!
    }

    // Convert to Vue Flow
    const position = parent
      ? {
          x: dbNode.position.x - parent.position.x,
          y: dbNode.position.y - parent.position.y
        }
      : dbNode.position;

    return {
      id: `section-${dbNode.id}`,
      position,
      parentNode: parent ? `section-${parent.id}` : undefined,
      width: dbNode.width,
      height: dbNode.height,
      draggable: true
    };
  });
}
```

---

## Quick Summary

| Check | Function | Purpose |
|-------|----------|---------|
| **Detection** | `isNodeCompletelyInside()` | Is task physically inside group bounds? |
| **Finding** | `getDeepestContainingGroup()` | Which group should be the parent? |
| **Validation** | `validateContainment()` | Does parentGroupId match spatial position? |
| **Fixing** | `fixContainmentIssues()` | Auto-correct all bad parents |
| **Rendering** | Check spatial containment before setting `parentNode` | Don't let Vue Flow use bad parent |

---

## Debug: See What's Wrong

```typescript
// In browser console:
import { logContainmentDebug } from '@/utils/spatial-containment';
logContainmentDebug(dbNodes.value);

// Output:
// ✗ task-1 (task)
//    Position: (500, 500)
//    Claimed Parent: group-1
//    Visual Parent: null
//    Issues: Node is physically inside group-1 but is not spatially contained

// ✓ task-2 (task)
//    Position: (150, 150)
//    Claimed Parent: group-1
//    Visual Parent: group-1
//    Issues: (none)
```

---

## What Changed

### Before
```typescript
// Database said parent = group-1
// Vue Flow rendered with parentNode = group-1
// Task dragged with group even though it was 500px away ❌
```

### After
```typescript
// Database says parent = group-1
// But spatial check: task is NOT inside group bounds
// Vue Flow ignores the parent relationship ✅
// Task stays independent
```

---

## Integration Checklist

- [ ] Copy `spatial-containment.ts` to `src/utils/`
- [ ] Update drag end handler to use `getDeepestContainingGroup()`
- [ ] Update canvas load to run `autoCorrectParents()`
- [ ] Update `dbNodesToVueFlowNodes()` to check spatial containment
- [ ] Test: Load canvas, check browser console for mismatches
- [ ] Test: Drag task around, check parent updates correctly
- [ ] Test: Move group, verify only tasks INSIDE move with it

---

## Key Insight

**The database parentGroupId field is now a SUGGESTION, not a rule.**

Vue Flow only respects the parent relationship if:
1. `parentGroupId` field is set, AND
2. Task is ACTUALLY INSIDE the group bounds spatially

This fixes the bug completely. 🎯