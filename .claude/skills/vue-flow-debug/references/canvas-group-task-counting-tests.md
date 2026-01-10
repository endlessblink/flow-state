# Canvas Group-Task Counting E2E Test Patterns

Reference for testing Vue Flow parent-child relationships and group-task counting.

## Custom Assertions with toPass()

Use Playwright's `toPass()` for eventual consistency with Vue Flow:

```typescript
// Custom intervals for canvas settling
const CANVAS_DEFAULTS = {
  timeout: 3000,
  intervals: [100, 300, 500, 1000, 1500]
};

async function assertGroupCount(
  canvas: CanvasPage,
  groupId: string,
  expected: number
): Promise<void> {
  let lastActual: number | undefined;

  await expect(async () => {
    lastActual = await canvas.getGroupTaskCount(groupId);
    expect(lastActual).toBe(expected);
  }).toPass({ timeout: 3000, intervals: [100, 300, 500, 1000, 1500] });
}
```

## Store Access Pattern

Access Pinia stores from Playwright:

```typescript
async getGroupTaskCount(groupId: string): Promise<number> {
  return this.page.evaluate((id) => {
    const app = document.querySelector('#app');
    const vueApp = (app as any).__vue_app__;
    const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
    const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
    return canvasStore.getTaskCountInGroupRecursive(id, taskStore.tasks);
  }, groupId);
}
```

## Coordinate State Verification

Verify both position (relative) and computedPosition (absolute):

```typescript
interface CoordinateState {
  position: { x: number; y: number };        // Stored (relative for children)
  computedPosition: { x: number; y: number }; // Actual canvas coords (absolute)
  parentNode: string | undefined;
}

async getNodeCoordinateState(nodeId: string): Promise<CoordinateState | null> {
  return this.page.evaluate((id) => {
    const app = document.querySelector('#app');
    const vueApp = (app as any).__vue_app__;
    const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
    const node = canvasStore.nodes.find((n: any) => n.id === id);
    if (!node) return null;
    return {
      position: { ...node.position },
      computedPosition: { ...node.computedPosition },
      parentNode: node.parentNode
    };
  }, nodeId);
}
```

## Key Test: Children Follow Parent During Drag

```typescript
test('children follow parent during drag - relative positions preserved', async ({ page }) => {
  // Create group with tasks
  await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
  const task1 = await canvas.createTestTask({ title: 'Child 1', position: { x: 120, y: 130 } });

  await page.waitForTimeout(500);

  // Record relative offset before drag
  const taskBefore = await canvas.getNodeCoordinateState(`task-${task1}`);
  const groupBefore = await canvas.getNodeCoordinateState('section-group-1');

  const relativeOffset = {
    x: taskBefore!.computedPosition.x - groupBefore!.computedPosition.x,
    y: taskBefore!.computedPosition.y - groupBefore!.computedPosition.y
  };

  // Drag group
  await canvas.dragGroup('group-1', { deltaX: 150, deltaY: 100 });

  // Verify relative offset is preserved
  const taskAfter = await canvas.getNodeCoordinateState(`task-${task1}`);
  const groupAfter = await canvas.getNodeCoordinateState('section-group-1');

  const newRelativeOffset = {
    x: taskAfter!.computedPosition.x - groupAfter!.computedPosition.x,
    y: taskAfter!.computedPosition.y - groupAfter!.computedPosition.y
  };

  // CRITICAL: Relative offsets should be preserved
  expect(newRelativeOffset.x).toBeCloseTo(relativeOffset.x, 0);
  expect(newRelativeOffset.y).toBeCloseTo(relativeOffset.y, 0);

  // Task's stored position (relative) should be UNCHANGED
  expect(taskAfter!.position.x).toBeCloseTo(taskBefore!.position.x, 0);
  expect(taskAfter!.position.y).toBeCloseTo(taskBefore!.position.y, 0);
});
```

## Key Test: Task Independence After Leaving Group

```typescript
test('task does not follow former parent when group is moved', async ({ page }) => {
  await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
  const taskId = await canvas.createTestTask({
    title: 'Independent Task',
    position: { x: 150, y: 150 }
  });

  await page.waitForTimeout(500);

  // Drag task OUT of group-1 to canvas root
  await canvas.dragTaskToPosition(taskId, { x: 800, y: 100 });

  // Verify task is detached (no parentNode)
  const parentNode = await canvas.getTaskParentNode(taskId);
  expect(parentNode).toBeUndefined();

  // Move group-1 to new location
  await canvas.dragGroup('group-1', { deltaX: 0, deltaY: 300 });

  // CRITICAL: Task should NOT have moved with the group
  const finalState = await canvas.getNodeCoordinateState(`task-${taskId}`);
  expect(finalState!.computedPosition.x).toBeCloseTo(800, -1);
  expect(finalState!.computedPosition.y).toBeCloseTo(100, -1);
});
```

## Double nextTick Pattern for Settling

After drag operations, use settling period + double nextTick:

```typescript
async dragTaskToGroup(taskId: string, targetGroupId: string): Promise<void> {
  // ... drag operation ...

  // Wait for settling period + double nextTick (Vue Flow requirement)
  await this.page.waitForTimeout(600);
  await this.waitForCanvasSync();
}
```

## Verification Checklist

After implementing canvas counting tests, verify:
- [ ] Drag task to group -> count increments immediately
- [ ] Drag task out of group -> count decrements to 0
- [ ] Drag group with tasks -> all tasks move together
- [ ] Nested groups -> parent counts all nested tasks recursively
- [ ] Task leaves group then group moves -> task stays in place
- [ ] Refresh page -> counts persist correctly
