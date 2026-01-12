## Should Groups Store Position AND Size? (Absolute Coordinates)

**Short Answer:** YES. Store both position AND size for every node (including groups).

---

## The Complete Data Model

### What to Store in Database

For **EVERY node** (tasks AND groups), store:

```typescript
interface DbNode {
  // Identity
  id: string;
  type: 'task' | 'group';  // Important for rendering
  
  // Position (ABSOLUTE - world space)
  position: {
    x: number;  // Absolute X in world space
    y: number;  // Absolute Y in world space
  };
  
  // Size (ALWAYS store, never calculate)
  width: number;
  height: number;
  
  // Hierarchy
  parentGroupId?: string | null;  // null = root node
  
  // Sync Control
  version: number;     // For optimistic locking
  updatedAt: string;   // ISO timestamp
  
  // Optional Metadata
  label?: string;
  color?: string;
  collapsed?: boolean;  // For expandable groups
}
```

---

## Why Store Size for Groups?

### ❌ DON'T Calculate from Children
```typescript
// WRONG - fragile and error-prone:
const groupWidth = Math.max(...children.map(c => c.position.x + c.width));
```

**Problems:**
- Multiple ways to interpret "fit to children"
- Adds complexity to every resize/drag operation
- Children can move independently → size becomes inconsistent
- Mobile/touch edge cases break easily

### ✅ DO Store Explicitly
```typescript
// RIGHT - simple and reliable:
const group = {
  position: { x: 100, y: 100 },
  width: 400,
  height: 300
};
```

**Benefits:**
- Single source of truth
- User can manually resize groups
- Easier to detect conflicts (version tracks it)
- Works with any children arrangement

---

## Position: Always Absolute

### The Rule
**Every node's position is absolute in world space, regardless of parent.**

```typescript
// Parent group
{
  id: 'group-1',
  position: { x: 100, y: 100 },  // Absolute
  width: 300,
  height: 300,
  parentGroupId: null
}

// Task inside parent (still absolute!)
{
  id: 'task-1',
  position: { x: 200, y: 150 },  // ABSOLUTE, not relative!
  width: 50,
  height: 50,
  parentGroupId: 'group-1'
}

// Nested group inside parent
{
  id: 'group-2',
  position: { x: 150, y: 200 },  // ABSOLUTE, not relative!
  width: 150,
  height: 150,
  parentGroupId: 'group-1'
}
```

### Why Absolute Positions?
1. **Simplicity** - No coordinate conversion except at render time
2. **Conflict detection** - Version tracking works cleanly
3. **Queries** - Easy to find all nodes in a region
4. **Multi-level nesting** - Doesn't get complicated

### How Vue Flow Sees It (Relative at Render Time)
```typescript
// Database: absolute
{ position: { x: 200, y: 150 }, parentGroupId: 'group-1' }

// Vue Flow rendering: convert to relative
{
  position: {
    x: 200 - 100,  // = 100 (relative to parent at x: 100)
    y: 150 - 100   // = 50 (relative to parent at y: 100)
  },
  parentNode: 'group-1'
}
```

---

## Database Schema (Complete)

### Migration SQL
```sql
-- Add size columns (if not already present)
ALTER TABLE nodes ADD COLUMN width INTEGER DEFAULT 100;
ALTER TABLE nodes ADD COLUMN height INTEGER DEFAULT 100;

-- Add type column
ALTER TABLE nodes ADD COLUMN type VARCHAR(50) DEFAULT 'task';

-- Add expandable state
ALTER TABLE nodes ADD COLUMN collapsed BOOLEAN DEFAULT FALSE;

-- Verify structure
CREATE INDEX idx_nodes_parent_id ON nodes(parent_group_id);
CREATE INDEX idx_nodes_type ON nodes(type);
```

### What Your Table Looks Like
```
id | type | position | width | height | parent_group_id | version | updated_at
---|------|----------|-------|--------|-----------------|---------|------------
group-1 | group | {"x":100,"y":100} | 300 | 300 | NULL | 1 | 2026-01-12
task-1  | task  | {"x":200,"y":150} | 50  | 50  | group-1 | 1 | 2026-01-12
group-2 | group | {"x":150,"y":200} | 150 | 150 | group-1 | 1 | 2026-01-12
task-2  | task  | {"x":170,"y":220} | 50  | 50  | group-2 | 1 | 2026-01-12
```

---

## Sync: Position AND Size Together

### When User Drags a Group
```typescript
async function handleDragEnd(event) {
  const { node } = event;  // Vue Flow node with relative position
  
  // Get parent for calculation
  const parent = dbNodes.value.find(n => n.id === node.parentNode?.replace('section-', ''));
  
  // Convert position to absolute
  const absolutePosition = {
    x: node.position.x + (parent?.position.x || 0),
    y: node.position.y + (parent?.position.y || 0)
  };
  
  // Sync both position AND size (size may have changed during drag)
  const currentVersion = nodeVersionMap.get(node.id);
  const { error } = await supabase
    .from('nodes')
    .update({
      position: absolutePosition,
      width: node.width,          // ← Include size
      height: node.height,        // ← Include size
      version: currentVersion + 1
    })
    .eq('id', node.id)
    .eq('version', currentVersion);
    
  if (error?.code === 'PGRST116') {
    // Conflict: another user updated this
    showConflictNotice('This group was modified by another user');
  }
}
```

### When User Resizes a Group
```typescript
async function handleGroupResize(groupId: string, newWidth: number, newHeight: number) {
  const group = dbNodes.value.find(n => n.id === groupId);
  const currentVersion = nodeVersionMap.get(groupId);
  
  const { error } = await supabase
    .from('nodes')
    .update({
      width: newWidth,
      height: newHeight,
      version: currentVersion + 1
    })
    .eq('id', groupId)
    .eq('version', currentVersion);
    
  if (error?.code === 'PGRST116') {
    showConflictNotice('Group size was changed by another user');
  }
}
```

---

## Children Don't Need to Update When Parent Moves

### Key Insight
**When you move a parent group, children DON'T need to be updated in the database.**

Why? Because:
1. Children's absolute positions don't change
2. Vue Flow renders relative positions (child.position - parent.position)
3. Parent's position changed → relative positions are recalculated automatically

```typescript
// Parent moves from (100, 100) to (200, 200)
// Database: only parent updated
{ id: 'group-1', position: { x: 200, y: 200 }, ... }

// Children NOT updated in database:
{ id: 'task-1', position: { x: 200, y: 150 }, parentGroupId: 'group-1' }

// But Vue Flow recalculates:
// Relative position = { x: 200 - 200, y: 150 - 200 } = { x: 0, y: -50 }
// So visually they stay inside the parent
```

---

## Checking for Invalid States

### Queries You Can Now Run

**Find all nodes in a region (world space):**
```sql
SELECT * FROM nodes 
WHERE position->>'x'::float BETWEEN 100 AND 500
  AND position->>'y'::float BETWEEN 100 AND 500;
```

**Find all children of a group:**
```sql
SELECT * FROM nodes WHERE parent_group_id = 'group-1';
```

**Find groups that exceed size:**
```sql
SELECT * FROM nodes 
WHERE type = 'group' AND (width > 1000 OR height > 1000);
```

**Check for orphaned children:**
```sql
SELECT * FROM nodes n
WHERE n.parent_group_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM nodes p WHERE p.id = n.parent_group_id);
```

---

## Size Management: Expanded vs Auto-fit

### Option A: User Controls Size (Recommended)
```typescript
// User manually resizes group
// Database stores their size
{ id: 'group-1', width: 300, height: 300 }

// Works great for: organizational groups, visual structure
```

### Option B: Auto-fit to Children
```typescript
// After child moves, recalculate group bounds
function recalculateGroupBounds(groupId: string) {
  const group = dbNodes.value.find(n => n.id === groupId);
  const children = dbNodes.value.filter(n => n.parentGroupId === groupId);
  
  if (children.length === 0) return; // Empty group
  
  // Find bounding box
  const bounds = {
    minX: Math.min(...children.map(c => c.position.x)),
    minY: Math.min(...children.map(c => c.position.y)),
    maxX: Math.max(...children.map(c => c.position.x + c.width)),
    maxY: Math.max(...children.map(c => c.position.y + c.height))
  };
  
  const newWidth = bounds.maxX - bounds.minX + 20; // padding
  const newHeight = bounds.maxY - bounds.minY + 20;
  
  // Sync to database
  syncGroupSize(groupId, newWidth, newHeight);
}

// Call this after ANY child move
```

**Recommendation:** Use Option A (user controls) for simplicity. Only use Option B if you have a specific UX requirement.

---

## Coordinate Conversion: Updated

```typescript
// Database node
{
  id: 'group-1',
  position: { x: 100, y: 100 },  // Absolute
  width: 300,
  height: 300,
  parentGroupId: null
}

// Convert to Vue Flow (for render)
{
  id: 'section-group-1',
  position: { x: 100, y: 100 },  // No parent → stays absolute
  width: 300,
  height: 300,
  draggable: true,
  style: {
    border: '2px solid #4a90e2'
  }
}

// If it had a parent:
{
  id: 'section-group-2',
  position: { x: 50, y: 100 },   // Converted to relative
  width: 150,
  height: 150,
  parentNode: 'section-group-1',
  draggable: true
}
```

---

## Summary: The Complete Model

| What | Store? | Absolute? | Why |
|------|--------|-----------|-----|
| Task position | ✅ YES | ✅ YES | Single source of truth |
| Task size | ✅ YES | N/A | For rendering, hit detection |
| Group position | ✅ YES | ✅ YES | Hierarchies don't change it |
| Group size | ✅ YES | N/A | User resizes, don't calculate |
| Parent ID | ✅ YES | N/A | Defines hierarchy |
| Version | ✅ YES | N/A | Prevent conflicts |
| Bounding box from children | ❌ NO | N/A | Too fragile, calculate if needed |
| Relative position | ❌ NO | N/A | Calculate at render time only |

---

## Example: Complete Node with Group

```typescript
// In your database:
const completeNode: DbNode = {
  id: 'group-quarterly-planning',
  type: 'group',
  position: { x: 150, y: 200 },    // Absolute
  width: 500,
  height: 600,
  parentGroupId: null,              // Root level
  version: 5,
  updatedAt: '2026-01-12T08:00:00Z',
  label: 'Q1 Planning',
  color: '#3498db',
  collapsed: false
};

// Child inside:
const childTask: DbNode = {
  id: 'task-planning-meeting',
  type: 'task',
  position: { x: 200, y: 250 },    // Still absolute!
  width: 100,
  height: 80,
  parentGroupId: 'group-quarterly-planning',
  version: 3,
  updatedAt: '2026-01-12T07:30:00Z',
  label: 'Planning Meeting',
  collapsed: false
};
```

Done! Store position AND size for everything. Always absolute in the database. 🎯