# E2E Test Patterns for Canvas Nested Groups

Playwright test patterns for validating nested group behavior.

## Page Object for Canvas Operations

```typescript
export class CanvasPage {
  private createdTaskIds: string[] = [];
  private createdGroupIds: string[] = [];

  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/#/canvas');
    await this.page.locator('.vue-flow').waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForCanvasSync();
  }

  async getGroupTaskCount(groupId: string): Promise<number> {
    return this.page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      return canvasStore.getTaskCountInGroupRecursive(id, taskStore.tasks);
    }, groupId);
  }

  async dragGroupToGroup(sourceGroupId: string, targetGroupId: string): Promise<void> {
    const sourceGroup = this.page.locator(`[data-id="section-${sourceGroupId}"]`);
    const targetGroup = this.page.locator(`[data-id="section-${targetGroupId}"]`);

    await expect(sourceGroup).toBeVisible({ timeout: 5000 });
    await expect(targetGroup).toBeVisible({ timeout: 5000 });

    const sourceBox = await sourceGroup.boundingBox();
    const targetBox = await targetGroup.boundingBox();

    if (!sourceBox || !targetBox) throw new Error('Could not get bounding boxes');

    // Drag from source header to target center
    await this.page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 15);
    await this.page.mouse.down();
    await this.page.waitForTimeout(100);
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 10 }
    );
    // Double hover for containment detection
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();

    // Wait for settling period + double nextTick
    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  async cleanup(): Promise<void> {
    // Clean up in reverse order: tasks first, then groups
    for (const taskId of this.createdTaskIds) {
      await this.page.evaluate((id) => {
        const app = document.querySelector('#app');
        const vueApp = (app as any).__vue_app__;
        const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
        taskStore.deleteTask(id);
      }, taskId).catch(() => {});
    }

    for (const groupId of this.createdGroupIds) {
      await this.page.evaluate((id) => {
        const app = document.querySelector('#app');
        const vueApp = (app as any).__vue_app__;
        const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
        canvasStore.deleteGroup(id);
      }, groupId).catch(() => {});
    }

    this.createdTaskIds = [];
    this.createdGroupIds = [];
  }
}
```

## Parent Group Movement Tests

### Test: Parent Moves Everything Inside

```typescript
test('parent group moves everything inside - child groups, nested tasks, direct tasks', async ({ page }) => {
  // Setup: parent-group containing child-group with nested-task AND direct-task in parent
  await canvas.createTestGroup({
    id: 'parent-group',
    position: { x: 50, y: 50 },
    size: { width: 600, height: 500 }
  });
  await canvas.createTestGroup({
    id: 'child-group',
    position: { x: 100, y: 100 },
    size: { width: 250, height: 200 }
  });
  const nestedTask = await canvas.createTestTask({
    title: 'Nested Task (in child-group)',
    position: { x: 150, y: 150 }
  });
  const directTask = await canvas.createTestTask({
    title: 'Direct Task (in parent-group)',
    position: { x: 450, y: 350 }
  });

  await page.waitForTimeout(500);

  // Verify initial counts
  await assertGroupCount(canvas, 'child-group', 1);  // nested-task
  await assertGroupCount(canvas, 'parent-group', 2); // nested-task + direct-task

  // Record all positions before move
  const childGroupBefore = await canvas.getNodeCoordinateState('section-child-group');
  const nestedTaskBefore = await canvas.getNodeCoordinateState(`task-${nestedTask}`);
  const directTaskBefore = await canvas.getNodeCoordinateState(`task-${directTask}`);

  // Move parent group
  await canvas.dragGroup('parent-group', { deltaX: 200, deltaY: 150 });

  // ALL contents should have moved by (200, 150)
  const childGroupAfter = await canvas.getNodeCoordinateState('section-child-group');
  const nestedTaskAfter = await canvas.getNodeCoordinateState(`task-${nestedTask}`);
  const directTaskAfter = await canvas.getNodeCoordinateState(`task-${directTask}`);

  // Child group moved
  expect(childGroupAfter!.computedPosition.x).toBeCloseTo(childGroupBefore!.computedPosition.x + 200, -1);
  expect(childGroupAfter!.computedPosition.y).toBeCloseTo(childGroupBefore!.computedPosition.y + 150, -1);

  // Nested task moved (inside child-group)
  expect(nestedTaskAfter!.computedPosition.x).toBeCloseTo(nestedTaskBefore!.computedPosition.x + 200, -1);
  expect(nestedTaskAfter!.computedPosition.y).toBeCloseTo(nestedTaskBefore!.computedPosition.y + 150, -1);

  // Direct task moved (directly in parent-group)
  expect(directTaskAfter!.computedPosition.x).toBeCloseTo(directTaskBefore!.computedPosition.x + 200, -1);
  expect(directTaskAfter!.computedPosition.y).toBeCloseTo(directTaskBefore!.computedPosition.y + 150, -1);

  // Counts should remain unchanged after move
  await assertGroupCount(canvas, 'child-group', 1);
  await assertGroupCount(canvas, 'parent-group', 2);
});
```

### Test: Dragging Group INTO Another Group

```typescript
test('dragging group INTO another group - both groups count correctly', async ({ page }) => {
  // Setup: group-1 with task-1 OUTSIDE group-2 initially
  await canvas.createTestGroup({
    id: 'group-2',
    position: { x: 400, y: 50 },
    size: { width: 500, height: 400 }
  });
  await canvas.createTestGroup({
    id: 'group-1',
    position: { x: 50, y: 50 },
    size: { width: 200, height: 150 }
  });
  const taskId = await canvas.createTestTask({
    title: 'Task 1',
    position: { x: 100, y: 100 }
  });

  await page.waitForTimeout(500);

  // Initial: group-1 = 1, group-2 = 0
  await assertGroupCount(canvas, 'group-1', 1);
  await assertGroupCount(canvas, 'group-2', 0);

  // Drag group-1 (with task inside) INTO group-2
  await canvas.dragGroupToGroup('group-1', 'group-2');

  // NOW: group-2 should count task-1 (recursive)
  // group-1 still counts task-1 directly
  await assertGroupCount(canvas, 'group-1', 1);
  await assertGroupCount(canvas, 'group-2', 1); // Recursive count includes task-1
});
```

### Test: After Nesting, Parent Moves Everything

```typescript
test('after nesting group - parent moves everything together', async ({ page }) => {
  // Setup: Nest group-1 (with task) into group-2, then move group-2
  await canvas.createTestGroup({
    id: 'group-2',
    position: { x: 400, y: 50 },
    size: { width: 500, height: 400 }
  });
  await canvas.createTestGroup({
    id: 'group-1',
    position: { x: 50, y: 50 },
    size: { width: 200, height: 150 }
  });
  const taskId = await canvas.createTestTask({
    title: 'Task to move',
    position: { x: 100, y: 100 }
  });

  await page.waitForTimeout(500);

  // Drag group-1 INTO group-2
  await canvas.dragGroupToGroup('group-1', 'group-2');

  // Record positions after nesting
  const group1Before = await canvas.getNodeCoordinateState('section-group-1');
  const taskBefore = await canvas.getNodeCoordinateState(`task-${taskId}`);

  // Now move group-2 (should move group-1 AND task with it)
  await canvas.dragGroup('group-2', { deltaX: 100, deltaY: 200 });

  const group1After = await canvas.getNodeCoordinateState('section-group-1');
  const taskAfter = await canvas.getNodeCoordinateState(`task-${taskId}`);

  // Both group-1 and task should have moved by (100, 200)
  expect(group1After!.computedPosition.x).toBeCloseTo(group1Before!.computedPosition.x + 100, -1);
  expect(group1After!.computedPosition.y).toBeCloseTo(group1Before!.computedPosition.y + 200, -1);
  expect(taskAfter!.computedPosition.x).toBeCloseTo(taskBefore!.computedPosition.x + 100, -1);
  expect(taskAfter!.computedPosition.y).toBeCloseTo(taskBefore!.computedPosition.y + 200, -1);

  // Counts should remain correct
  await assertGroupCount(canvas, 'group-1', 1);
  await assertGroupCount(canvas, 'group-2', 1);
});
```

## Recursive Counting Tests

### Test: 3 Levels Deep

```typescript
test('deeply nested groups maintain accurate counts (3 levels)', async ({ page }) => {
  // group-3 > group-2 > group-1 > task
  await canvas.createTestGroup({
    id: 'group-3',
    position: { x: 50, y: 50 },
    size: { width: 700, height: 600 }
  });
  await canvas.createTestGroup({
    id: 'group-2',
    position: { x: 100, y: 100 },
    size: { width: 500, height: 400 }
  });
  await canvas.createTestGroup({
    id: 'group-1',
    position: { x: 150, y: 150 },
    size: { width: 200, height: 150 }
  });
  await canvas.createTestTask({ title: 'Deep Task', position: { x: 200, y: 200 } });

  await page.waitForTimeout(500);

  // All 3 groups should count = 1
  await assertGroupCount(canvas, 'group-1', 1);
  await assertGroupCount(canvas, 'group-2', 1);
  await assertGroupCount(canvas, 'group-3', 1);
});
```

## Verification Checklist

- [ ] Parent group moves all nested contents together
- [ ] Dragging group INTO another triggers recursive count update
- [ ] Moving task between sibling groups updates counts correctly
- [ ] 3-level deep nesting maintains accurate counts
- [ ] Tasks at different nesting levels all counted correctly
- [ ] Counts unchanged after moving parent group
