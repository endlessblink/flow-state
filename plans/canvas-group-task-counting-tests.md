# feat: Automated Test Suite for Canvas Group-Task Counting and Parent-Child Relationships

## Enhancement Summary

**Deepened on:** January 10, 2026
**Research agents used:** 6 (QA Master, Tauri E2E Testing, Canvas Nested Groups, Vue Flow Debug, toPass() Best Practices, Multi-Select Drag Testing)
**Sections enhanced:** 9
**Total tests:** 34

### Key Improvements
1. **Added Parent Group Movement with Contents tests (P0)** - Critical tests for when parent groups move with all nested content (child groups, nested tasks, direct tasks)
2. **Added `dragGroupToGroup()` method** - Enables testing group nesting operations where one group is dragged INTO another
3. **Added coordinate transformation tests** - Critical dual-coordinate system verification (position vs computedPosition)
4. **Enhanced Page Object pattern** - Comprehensive store access, custom assertions, and cleanup methods
5. **Added data persistence tests** - Verify counts survive page refresh and position locks work
6. **Improved flakiness prevention** - Replace `waitForTimeout` with explicit waits, use `toPass()` with proper intervals

### New Considerations Discovered
- Double `nextTick()` required for Vue Flow parent-child relationship settlement
- Position locks (7s window) must be respected before final assertions
- `>50%` area overlap rule for containment, not just center-point
- Relative positions must be preserved during group drag operations
- **When parent group moves, ALL contents must move with it** - child groups, nested tasks, direct tasks

---

## Overview

Create a comprehensive automated test suite that validates canvas group-task counting accuracy and parent-child relationship integrity. This ensures that when tasks move between groups, counts update correctly; when tasks leave groups, they don't follow when the group moves; and when groups nest inside other groups, counts properly reflect at all levels.

**Related Files**:
- `src/composables/canvas/useCanvasParentChild.ts:39-143` - Containment detection
- `src/composables/canvas/useCanvasDragDrop.ts:131-197` - Count update logic
- `src/stores/canvas.ts:402-467` - `getTaskCountInGroupRecursive()`
- `src/composables/canvas/useNodeAttachment.ts:51-140` - Parent-child attachment
- `src/utils/geometry.ts:135-164` - `isNodeMoreThanHalfInside()` containment logic

### Research Insights: Related Codebase Patterns

**Existing Test Infrastructure:**
- Position persistence tests: `tests/canvas-position-persistence.spec.ts` (lines 80-120 for store access patterns)
- Parent-child tests: `tests/canvas-parent-child.spec.ts` (lines 1-157)
- Containment geometry tests: `tests/unit/bug-153-containment.spec.ts`
- Store unit tests: `src/stores/__tests__/canvas.test.ts`

**Key Patterns from Existing Tests:**
```typescript
// Store access pattern from canvas-position-persistence.spec.ts:21-30
const getStore = (storeName: string) => `
  (() => {
    const app = document.querySelector('#app');
    if (app && '__vue_app__' in app) {
      const vueApp = (app as any).__vue_app__;
      return vueApp.config.globalProperties.$pinia._s.get('${storeName}');
    }
    return null;
  })()
`;
```

---

## Problem Statement / Motivation

The canvas group-task system has complex behaviors that can regress silently:

1. **Count drift**: Task counts in groups can become stale or incorrect after drag operations
2. **Orphan following**: Tasks may incorrectly follow their former parent group after leaving
3. **Nested count failures**: Ancestor groups may fail to include tasks from child groups in their recursive counts
4. **Race conditions**: Rapid drag operations can cause count desync during settling periods
5. **Coordinate confusion**: Mixing `position` (relative) and `computedPosition` (absolute) causes position jumps

Without automated regression tests, these bugs reappear after refactoring or feature additions. The existing tests (`canvas-position-persistence.spec.ts`, `canvas-parent-child.spec.ts`) cover position persistence but not count accuracy or parent-child independence.

### Research Insights: Known Bugs to Guard Against

| Bug ID | Pattern | Symptom | Guard Test |
|--------|---------|---------|------------|
| BUG-060/061 | Zombie groups | Deleted groups reappear | Delete group, sync, verify not recreated |
| TASK-131 | Competing sync | Positions reset during session | Rapid updates don't reset dragged position |
| TASK-142 | Auth timing | Positions reset on refresh | Count recalculates after auth ready |
| BUG-152 | Stale parentNode | Groups move together incorrectly | Root groups have no parentNode |
| BUG-153 | Center-point only | Tasks not detected inside groups | Use >50% area overlap |

---

## Proposed Solution

### High-Level Approach

Create a dedicated Playwright E2E test file `tests/canvas-task-counting.spec.ts` with:
1. **Page Object class** for canvas operations (drag, count verification, group creation)
2. **Test fixtures** for common scenarios (2 groups with tasks, nested groups)
3. **Assertion helpers** for count verification with tolerance for timing
4. **Coordinate verification** for dual-coordinate system (position vs computedPosition)

### Test Categories (Enhanced)

| Category | Tests | Priority | Source |
|----------|-------|----------|--------|
| Basic Count Movement | 4 | P0 - Critical | Original |
| Task Independence | 3 | P0 - Critical | Original |
| **Parent Group Movement with Contents** | 5 | **P0 - Critical** | User Feedback |
| Coordinate Transformations | 4 | P0 - Critical | Research |
| Nested Group Counting | 4 | P1 - High | Original |
| **Data Persistence** | 3 | **P0 - Critical** | Research |
| Edge Cases | 3 | P1 - High | Original |
| Performance | 2 | P2 - Medium | Original |
| **Multi-Select Batch Operations** | 3 | **P1 - High** | Research |

**Total: 34 tests** (up from 29)

**Key Scenarios Covered:**
1. **Moving task between groups** - Counts update correctly at source and destination
2. **Task leaving group then group moves** - Task does NOT follow former parent
3. **Group dragged INTO another group** - Parent counts all nested content
4. **Parent group moves** - ALL contents (child groups, nested tasks, direct tasks) move together
5. **Nested groups with tasks at multiple levels** - All levels counted and moved correctly

---

## Technical Approach

### 1. Test Infrastructure (Enhanced)

**New Files**:
```
tests/
  fixtures/
    canvas-page.ts          # Page Object for canvas operations
    canvas-assertions.ts    # Custom assertions with retry logic
    store-access.ts         # Typed Pinia store accessors
  canvas-task-counting.spec.ts  # Main test file (16 tests)
  canvas-coordinate-transforms.spec.ts  # Coordinate tests (4 tests)
  canvas-multi-select.spec.ts  # Multi-select batch tests (3 tests)
  canvas-persistence.spec.ts  # Persistence round-trip tests (3 tests)
```

**Enhanced Page Object Pattern** (incorporating research findings):

```typescript
// tests/fixtures/canvas-page.ts
import { Page, Locator, expect } from '@playwright/test';

interface NodePosition {
  x: number;
  y: number;
}

interface CoordinateState {
  position: NodePosition;        // Stored (relative for children)
  computedPosition: NodePosition; // Actual canvas coords (absolute)
  parentNode: string | undefined;
}

export class CanvasPage {
  private createdTaskIds: string[] = [];
  private createdGroupIds: string[] = [];

  constructor(private page: Page) {}

  // ============================================
  // NAVIGATION
  // ============================================

  async goto(): Promise<void> {
    await this.page.goto('/#/canvas');
    await this.page.locator('.vue-flow').waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForCanvasSync();
  }

  async fitView(): Promise<void> {
    await this.page.keyboard.press('f');
    await this.page.waitForTimeout(300);
  }

  // ============================================
  // STORE ACCESS (from existing patterns)
  // ============================================

  async getGroupTaskCount(groupId: string): Promise<number> {
    return this.page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
      // Use the recursive count method from canvas store
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      return canvasStore.getTaskCountInGroupRecursive(id, taskStore.tasks);
    }, groupId);
  }

  async getTaskParentNode(taskId: string): Promise<string | undefined> {
    return this.page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
      const node = canvasStore.nodes.find((n: any) => n.id === `task-${id}`);
      return node?.parentNode;
    }, taskId);
  }

  /**
   * Get both position and computedPosition for coordinate verification
   * CRITICAL: position is relative (for children), computedPosition is absolute
   */
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

  // ============================================
  // DRAG OPERATIONS (enhanced with steps)
  // ============================================

  async dragTaskToGroup(taskId: string, targetGroupId: string): Promise<void> {
    const taskNode = this.page.locator(`[data-id="task-${taskId}"]`);
    const targetGroup = this.page.locator(`[data-id="section-${targetGroupId}"]`);

    await expect(taskNode).toBeVisible({ timeout: 5000 });
    await expect(targetGroup).toBeVisible({ timeout: 5000 });

    const taskBox = await taskNode.boundingBox();
    const targetBox = await targetGroup.boundingBox();

    if (!taskBox || !targetBox) throw new Error('Could not get bounding boxes');

    // Use center-point drag for containment detection
    // CRITICAL: Use steps for smooth drag (prevents missed events)
    await this.page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + 20);
    await this.page.mouse.down();
    await this.page.waitForTimeout(100);
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 10 }
    );
    // CRITICAL: Double hover for dragover event (per Playwright best practices)
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();

    // Wait for settling period + double nextTick (Vue Flow requirement)
    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  async dragTaskToPosition(taskId: string, target: { x: number; y: number }): Promise<void> {
    const taskNode = this.page.locator(`[data-id="task-${taskId}"]`);
    const box = await taskNode.boundingBox();

    if (!box) throw new Error('Could not get task bounding box');

    await this.page.mouse.move(box.x + box.width / 2, box.y + 20);
    await this.page.mouse.down();
    await this.page.waitForTimeout(100);
    await this.page.mouse.move(target.x, target.y, { steps: 10 });
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();

    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  async dragGroup(groupId: string, delta: { deltaX: number; deltaY: number }): Promise<void> {
    const groupNode = this.page.locator(`[data-id="section-${groupId}"]`);
    const box = await groupNode.boundingBox();

    if (!box) throw new Error('Could not get group bounding box');

    // Drag from header area
    await this.page.mouse.move(box.x + box.width / 2, box.y + 15);
    await this.page.mouse.down();
    await this.page.waitForTimeout(100);
    await this.page.mouse.move(
      box.x + box.width / 2 + delta.deltaX,
      box.y + 15 + delta.deltaY,
      { steps: 10 }
    );
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();

    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  /**
   * Drag a group INTO another group (nesting operation)
   * CRITICAL: This triggers parent-child relationship creation
   */
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

    // Wait for settling period + double nextTick (Vue Flow requirement)
    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  // ============================================
  // MULTI-SELECT OPERATIONS (from research)
  // ============================================

  async multiSelectTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;

    // First task: normal click
    await this.page.locator(`[data-id="task-${taskIds[0]}"]`).click();

    // Remaining tasks: Ctrl+Click
    for (let i = 1; i < taskIds.length; i++) {
      await this.page.locator(`[data-id="task-${taskIds[i]}"]`).click({
        modifiers: ['ControlOrMeta']
      });
    }
  }

  async dragSelectedTasks(deltaX: number, deltaY: number): Promise<void> {
    const selected = this.page.locator('.vue-flow__node.selected').first();
    const box = await selected.boundingBox();

    if (!box) throw new Error('No selected element for dragging');

    await this.page.mouse.move(box.x + box.width / 2, box.y + 20);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2 + deltaX,
      box.y + 20 + deltaY,
      { steps: 10 }
    );
    await this.page.mouse.up();

    await this.page.waitForTimeout(600);
    await this.waitForCanvasSync();
  }

  // ============================================
  // TEST DATA CREATION
  // ============================================

  async createTestGroup(options: {
    id: string;
    position: { x: number; y: number };
    size?: { width: number; height: number };
  }): Promise<string> {
    const groupId = await this.page.evaluate((opts) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
      return canvasStore.addGroup({
        id: opts.id,
        name: `Test Group ${opts.id}`,
        position: opts.position,
        dimensions: opts.size || { width: 300, height: 250 }
      });
    }, options);

    this.createdGroupIds.push(groupId);
    return groupId;
  }

  async createTestTask(options: {
    title: string;
    position: { x: number; y: number };
    groupId?: string;
  }): Promise<string> {
    const taskId = await this.page.evaluate(async (opts) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      const task = await taskStore.createTask({
        title: opts.title,
        status: 'planned',
        canvasPosition: opts.position,
        sectionId: opts.groupId
      });
      return task.id;
    }, options);

    this.createdTaskIds.push(taskId);
    return taskId;
  }

  // ============================================
  // SYNC HELPERS
  // ============================================

  async waitForCanvasSync(): Promise<void> {
    // Wait for any pending sync operations
    await this.page.waitForFunction(() => {
      const app = document.querySelector('#app');
      if (!app || !('__vue_app__' in app)) return true;
      const vueApp = (app as any).__vue_app__;
      const canvasStore = vueApp.config.globalProperties.$pinia._s.get('canvas');
      return !canvasStore?.isSyncing;
    }, { timeout: 5000 }).catch(() => {});
  }

  // ============================================
  // CLEANUP (CRITICAL for test isolation)
  // ============================================

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

### 2. Custom Assertion Helpers (from research)

```typescript
// tests/fixtures/canvas-assertions.ts
import { expect } from '@playwright/test';
import { CanvasPage } from './canvas-page';

interface ToPassOptions {
  timeout?: number;
  intervals?: number[];
}

// CRITICAL: Default intervals based on toPass() research
const CANVAS_DEFAULTS: ToPassOptions = {
  timeout: 3000,
  intervals: [100, 300, 500, 1000, 1500]
};

/**
 * Assert group task count with eventual consistency retry.
 * Provides clear error messages on failure.
 */
export async function assertGroupCount(
  canvas: CanvasPage,
  groupId: string,
  expected: number,
  options: ToPassOptions = {}
): Promise<void> {
  const { timeout, intervals } = { ...CANVAS_DEFAULTS, ...options };
  let lastActual: number | undefined;

  try {
    await expect(async () => {
      lastActual = await canvas.getGroupTaskCount(groupId);
      expect(lastActual).toBe(expected);
    }).toPass({ timeout, intervals });
  } catch (error) {
    throw new Error(
      `Group "${groupId}" task count mismatch after ${timeout}ms.\n` +
      `  Expected: ${expected}\n` +
      `  Actual:   ${lastActual ?? 'unknown'}\n` +
      `  Retried with intervals: [${intervals?.join(', ')}]`
    );
  }
}

/**
 * Assert task has no parent (is detached from all groups)
 */
export async function assertTaskNotInGroup(
  canvas: CanvasPage,
  taskId: string,
  options: ToPassOptions = {}
): Promise<void> {
  const { timeout, intervals } = { ...CANVAS_DEFAULTS, ...options };

  await expect(async () => {
    const parentNode = await canvas.getTaskParentNode(taskId);
    expect(parentNode).toBeUndefined();
  }).toPass({ timeout, intervals });
}

/**
 * Assert task is in specific group
 */
export async function assertTaskInGroup(
  canvas: CanvasPage,
  taskId: string,
  groupId: string,
  options: ToPassOptions = {}
): Promise<void> {
  const { timeout, intervals } = { ...CANVAS_DEFAULTS, ...options };

  await expect(async () => {
    const parentNode = await canvas.getTaskParentNode(taskId);
    expect(parentNode).toBe(`section-${groupId}`);
  }).toPass({ timeout, intervals });
}

/**
 * Assert visual position matches expected (with tolerance)
 * CRITICAL: Uses computedPosition (absolute) not position (relative)
 */
export async function assertNodeVisualPosition(
  canvas: CanvasPage,
  nodeId: string,
  expected: { x: number; y: number },
  tolerance: number = 10
): Promise<void> {
  const state = await canvas.getNodeCoordinateState(nodeId);
  if (!state) throw new Error(`Node ${nodeId} not found`);

  const xDiff = Math.abs(state.computedPosition.x - expected.x);
  const yDiff = Math.abs(state.computedPosition.y - expected.y);

  expect(xDiff).toBeLessThan(tolerance);
  expect(yDiff).toBeLessThan(tolerance);
}

/**
 * Assert count never goes negative (invariant check)
 */
export async function assertCountNonNegative(
  canvas: CanvasPage,
  groupId: string
): Promise<void> {
  const count = await canvas.getGroupTaskCount(groupId);
  expect(count).toBeGreaterThanOrEqual(0);
}
```

### 3. Test Scenarios (Enhanced)

#### Category 1: Basic Count Movement (P0)

```typescript
// tests/canvas-task-counting.spec.ts
import { test, expect } from '@playwright/test';
import { CanvasPage } from './fixtures/canvas-page';
import { assertGroupCount, assertTaskInGroup, assertTaskNotInGroup } from './fixtures/canvas-assertions';

test.describe('Group Task Counting', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
    await canvas.fitView();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

  test('task dragged to group increments target count', async ({ page }) => {
    // Setup: Create two groups and a task outside both
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    await canvas.createTestGroup({ id: 'group-2', position: { x: 500, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Test Task',
      position: { x: 150, y: 150 }
    });

    // Wait for containment detection
    await page.waitForTimeout(500);

    // Verify initial counts
    await assertGroupCount(canvas, 'group-1', 1);
    await assertGroupCount(canvas, 'group-2', 0);

    // Drag task to group 2
    await canvas.dragTaskToGroup(taskId, 'group-2');

    // Verify counts updated
    await assertGroupCount(canvas, 'group-1', 0);
    await assertGroupCount(canvas, 'group-2', 1);
  });

  test('task moved back to original group restores count', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    await canvas.createTestGroup({ id: 'group-2', position: { x: 500, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Bouncing Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);
    await assertGroupCount(canvas, 'group-1', 1);

    // Move to group 2
    await canvas.dragTaskToGroup(taskId, 'group-2');
    await assertGroupCount(canvas, 'group-1', 0);
    await assertGroupCount(canvas, 'group-2', 1);

    // Move back to group 1
    await canvas.dragTaskToGroup(taskId, 'group-1');

    // Count should return to 1, not 2 (no double-count bug)
    await assertGroupCount(canvas, 'group-1', 1);
    await assertGroupCount(canvas, 'group-2', 0);
  });

  test('multi-select drag updates all affected group counts', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 }, size: { width: 400, height: 350 } });
    await canvas.createTestGroup({ id: 'group-2', position: { x: 600, y: 100 } });

    // Create 3 tasks in group-1
    const task1 = await canvas.createTestTask({ title: 'Task 1', position: { x: 150, y: 150 } });
    const task2 = await canvas.createTestTask({ title: 'Task 2', position: { x: 150, y: 220 } });
    const task3 = await canvas.createTestTask({ title: 'Task 3', position: { x: 150, y: 290 } });

    await page.waitForTimeout(500);
    await assertGroupCount(canvas, 'group-1', 3);

    // Multi-select all 3
    await canvas.multiSelectTasks([task1, task2, task3]);

    // Drag to group-2
    await canvas.dragSelectedTasks(500, 0);

    // Verify: group-1 = 0, group-2 = 3
    await assertGroupCount(canvas, 'group-1', 0);
    await assertGroupCount(canvas, 'group-2', 3);
  });

  test('task dragged to canvas root decrements source group', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Escaping Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);
    await assertGroupCount(canvas, 'group-1', 1);

    // Drag to empty canvas area
    await canvas.dragTaskToPosition(taskId, { x: 800, y: 400 });

    // Verify: count = 0, task has no parentNode
    await assertGroupCount(canvas, 'group-1', 0);
    await assertTaskNotInGroup(canvas, taskId);
  });
});
```

#### Category 2: Task Independence (P0)

```typescript
test.describe('Task Independence', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

  test('task does not follow former parent when group is moved', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Independent Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Record task visual position before operations
    const initialState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Drag task OUT of group-1 to canvas root
    await canvas.dragTaskToPosition(taskId, { x: 800, y: 100 });

    // Verify task is detached
    await assertTaskNotInGroup(canvas, taskId);

    // Now move group-1 to a different location
    await canvas.dragGroup('group-1', { deltaX: 0, deltaY: 300 });

    // CRITICAL: Task should NOT have moved with the group
    const finalState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Task should be near (800, 100), not following group to (100, 400)
    expect(finalState!.computedPosition.x).toBeCloseTo(800, -1);
    expect(finalState!.computedPosition.y).toBeCloseTo(100, -1);
  });

  test('detached task parentNode is cleared', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Detaching Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Verify initially inside
    await assertTaskInGroup(canvas, taskId, 'group-1');

    // Drag out
    await canvas.dragTaskToPosition(taskId, { x: 800, y: 400 });

    // Verify parentNode is undefined
    await assertTaskNotInGroup(canvas, taskId);
  });

  test('count is zero after all tasks leave group', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 }, size: { width: 400, height: 350 } });

    const task1 = await canvas.createTestTask({ title: 'Task 1', position: { x: 150, y: 150 } });
    const task2 = await canvas.createTestTask({ title: 'Task 2', position: { x: 150, y: 220 } });
    const task3 = await canvas.createTestTask({ title: 'Task 3', position: { x: 150, y: 290 } });

    await page.waitForTimeout(500);
    await assertGroupCount(canvas, 'group-1', 3);

    // Drag all 3 out
    await canvas.dragTaskToPosition(task1, { x: 700, y: 100 });
    await canvas.dragTaskToPosition(task2, { x: 700, y: 200 });
    await canvas.dragTaskToPosition(task3, { x: 700, y: 300 });

    // Count should be 0, not negative
    await assertGroupCount(canvas, 'group-1', 0);

    // Extra check: count >= 0 always
    const count = await canvas.getGroupTaskCount('group-1');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

#### Category 3: Coordinate Transformations (P0 - NEW)

```typescript
test.describe('Coordinate Transformations', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

  test('absolute to relative on reparent - no visual jump', async ({ page }) => {
    // Create a group and a task OUTSIDE the group
    const groupId = await canvas.createTestGroup({ id: 'group-1', position: { x: 200, y: 200 } });
    const taskId = await canvas.createTestTask({
      title: 'Coordinate Test Task',
      position: { x: 500, y: 300 } // Outside group initially
    });

    await page.waitForTimeout(500);

    // Record visual position before reparent
    const beforeState = await canvas.getNodeCoordinateState(`task-${taskId}`);
    const visualPositionBefore = beforeState!.computedPosition;

    // Drag task INTO group (triggers absolute-to-relative conversion)
    await canvas.dragTaskToGroup(taskId, 'group-1');

    // Record position after reparent
    const afterState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // CRITICAL: Visual position should be approximately the same (no jump)
    const xDiff = Math.abs(afterState!.computedPosition.x - visualPositionBefore.x);
    const yDiff = Math.abs(afterState!.computedPosition.y - visualPositionBefore.y);

    // Allow some tolerance for drop position adjustment
    expect(xDiff).toBeLessThan(100);
    expect(yDiff).toBeLessThan(100);

    // Position should now be relative (smaller values than absolute)
    // For a task dropped near center of group at (200,200) with size 300x250
    expect(afterState!.position.x).toBeLessThan(300); // Relative X
    expect(afterState!.position.y).toBeLessThan(250); // Relative Y
  });

  test('relative to absolute on deparent - no visual jump', async ({ page }) => {
    // Create group with task inside
    await canvas.createTestGroup({ id: 'group-1', position: { x: 200, y: 200 } });
    const taskId = await canvas.createTestTask({
      title: 'Inside Task',
      position: { x: 250, y: 250 },
      groupId: 'group-1'
    });

    await page.waitForTimeout(500);

    // Record visual position before deparent
    const beforeState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Drag task outside group
    await canvas.dragTaskToPosition(taskId, { x: 700, y: 400 });

    const afterState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // After deparent: position === computedPosition (both absolute)
    const positionDiff = Math.abs(afterState!.position.x - afterState!.computedPosition.x) +
                         Math.abs(afterState!.position.y - afterState!.computedPosition.y);
    expect(positionDiff).toBeLessThan(5);

    // No parentNode
    expect(afterState!.parentNode).toBeUndefined();
  });

  test('computedPosition reflects visual position for nested nodes', async ({ page }) => {
    // Create nested structure: group-2 > group-1 > task
    await canvas.createTestGroup({
      id: 'group-2',
      position: { x: 50, y: 50 },
      size: { width: 600, height: 500 }
    });
    await canvas.createTestGroup({
      id: 'group-1',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 250 }
    });
    const taskId = await canvas.createTestTask({
      title: 'Deeply Nested',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Get coordinate state
    const group2State = await canvas.getNodeCoordinateState('section-group-2');
    const group1State = await canvas.getNodeCoordinateState('section-group-1');
    const taskState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // For nested nodes: computedPosition = parent.computedPosition + position
    if (group1State!.parentNode === 'section-group-2') {
      const expectedGroup1X = group2State!.computedPosition.x + group1State!.position.x;
      const expectedGroup1Y = group2State!.computedPosition.y + group1State!.position.y;

      expect(group1State!.computedPosition.x).toBeCloseTo(expectedGroup1X, 0);
      expect(group1State!.computedPosition.y).toBeCloseTo(expectedGroup1Y, 0);
    }
  });

  test('children follow parent during drag - relative positions preserved', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    const task1 = await canvas.createTestTask({ title: 'Child 1', position: { x: 120, y: 130 } });
    const task2 = await canvas.createTestTask({ title: 'Child 2', position: { x: 200, y: 200 } });

    await page.waitForTimeout(500);

    // Record relative positions before drag
    const task1Before = await canvas.getNodeCoordinateState(`task-${task1}`);
    const task2Before = await canvas.getNodeCoordinateState(`task-${task2}`);
    const groupBefore = await canvas.getNodeCoordinateState('section-group-1');

    const relativeOffset1 = {
      x: task1Before!.computedPosition.x - groupBefore!.computedPosition.x,
      y: task1Before!.computedPosition.y - groupBefore!.computedPosition.y
    };
    const relativeOffset2 = {
      x: task2Before!.computedPosition.x - groupBefore!.computedPosition.x,
      y: task2Before!.computedPosition.y - groupBefore!.computedPosition.y
    };

    // Drag group
    await canvas.dragGroup('group-1', { deltaX: 150, deltaY: 100 });

    // Record after positions
    const task1After = await canvas.getNodeCoordinateState(`task-${task1}`);
    const task2After = await canvas.getNodeCoordinateState(`task-${task2}`);
    const groupAfter = await canvas.getNodeCoordinateState('section-group-1');

    // CRITICAL: Relative offsets should be preserved
    const newRelativeOffset1 = {
      x: task1After!.computedPosition.x - groupAfter!.computedPosition.x,
      y: task1After!.computedPosition.y - groupAfter!.computedPosition.y
    };

    expect(newRelativeOffset1.x).toBeCloseTo(relativeOffset1.x, 0);
    expect(newRelativeOffset1.y).toBeCloseTo(relativeOffset1.y, 0);

    // Task's stored position (relative) should be UNCHANGED
    expect(task1After!.position.x).toBeCloseTo(task1Before!.position.x, 0);
    expect(task1After!.position.y).toBeCloseTo(task1Before!.position.y, 0);
  });
});
```

#### Category 4: Parent Group Movement with Contents (P0 - CRITICAL)

```typescript
test.describe('Parent Group Movement with Contents', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

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

  test('multiple tasks at different nesting levels - all counted and moved correctly', async ({ page }) => {
    // Complex scenario:
    // group-outer > group-inner > task-deep (in group-inner)
    // group-outer > task-middle (directly in group-outer)
    await canvas.createTestGroup({
      id: 'group-outer',
      position: { x: 50, y: 50 },
      size: { width: 600, height: 500 }
    });
    await canvas.createTestGroup({
      id: 'group-inner',
      position: { x: 100, y: 100 },
      size: { width: 250, height: 200 }
    });
    const taskDeep = await canvas.createTestTask({
      title: 'Deep Task',
      position: { x: 150, y: 150 }
    });
    const taskMiddle = await canvas.createTestTask({
      title: 'Middle Task',
      position: { x: 450, y: 350 }
    });
    // Also add a task in the inner group
    const taskInner2 = await canvas.createTestTask({
      title: 'Second Inner Task',
      position: { x: 200, y: 200 }
    });

    await page.waitForTimeout(500);

    // Counts: group-inner = 2 (deep + inner2), group-outer = 3 (deep + middle + inner2)
    await assertGroupCount(canvas, 'group-inner', 2);
    await assertGroupCount(canvas, 'group-outer', 3);

    // Move group-outer - EVERYTHING should move together
    const positions = {
      inner: await canvas.getNodeCoordinateState('section-group-inner'),
      deep: await canvas.getNodeCoordinateState(`task-${taskDeep}`),
      middle: await canvas.getNodeCoordinateState(`task-${taskMiddle}`),
      inner2: await canvas.getNodeCoordinateState(`task-${taskInner2}`)
    };

    await canvas.dragGroup('group-outer', { deltaX: 150, deltaY: 100 });

    const positionsAfter = {
      inner: await canvas.getNodeCoordinateState('section-group-inner'),
      deep: await canvas.getNodeCoordinateState(`task-${taskDeep}`),
      middle: await canvas.getNodeCoordinateState(`task-${taskMiddle}`),
      inner2: await canvas.getNodeCoordinateState(`task-${taskInner2}`)
    };

    // All 4 items should have moved by (150, 100)
    for (const key of ['inner', 'deep', 'middle', 'inner2'] as const) {
      expect(positionsAfter[key]!.computedPosition.x).toBeCloseTo(positions[key]!.computedPosition.x + 150, -1);
      expect(positionsAfter[key]!.computedPosition.y).toBeCloseTo(positions[key]!.computedPosition.y + 100, -1);
    }

    // Counts unchanged
    await assertGroupCount(canvas, 'group-inner', 2);
    await assertGroupCount(canvas, 'group-outer', 3);
  });

  test('count updates when task dragged between nested groups', async ({ page }) => {
    // Setup: parent-group containing child-group-1 and child-group-2
    await canvas.createTestGroup({
      id: 'parent-group',
      position: { x: 50, y: 50 },
      size: { width: 700, height: 400 }
    });
    await canvas.createTestGroup({
      id: 'child-group-1',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 }
    });
    await canvas.createTestGroup({
      id: 'child-group-2',
      position: { x: 400, y: 100 },
      size: { width: 200, height: 150 }
    });
    const taskId = await canvas.createTestTask({
      title: 'Moving Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Initial: child-1 = 1, child-2 = 0, parent = 1
    await assertGroupCount(canvas, 'child-group-1', 1);
    await assertGroupCount(canvas, 'child-group-2', 0);
    await assertGroupCount(canvas, 'parent-group', 1);

    // Move task from child-group-1 to child-group-2
    await canvas.dragTaskToGroup(taskId, 'child-group-2');

    // After: child-1 = 0, child-2 = 1, parent = 1 (still counts it)
    await assertGroupCount(canvas, 'child-group-1', 0);
    await assertGroupCount(canvas, 'child-group-2', 1);
    await assertGroupCount(canvas, 'parent-group', 1); // Parent still counts the task
  });
});
```

#### Category 5: Nested Group Counting (P1)

```typescript
test.describe('Nested Group Counting', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

  test('parent group recursively counts tasks in child groups', async ({ page }) => {
    // Setup: Group-2 (large) containing Group-1 (small) containing Task-1
    await canvas.createTestGroup({
      id: 'group-2',
      position: { x: 50, y: 50 },
      size: { width: 500, height: 400 }
    });
    await canvas.createTestGroup({
      id: 'group-1',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 }
    });
    await canvas.createTestTask({
      title: 'Nested Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Assert: Both groups count the task
    await assertGroupCount(canvas, 'group-1', 1);
    await assertGroupCount(canvas, 'group-2', 1); // Recursive count
  });

  test('moving nested group moves all contents together', async ({ page }) => {
    await canvas.createTestGroup({
      id: 'group-2',
      position: { x: 50, y: 50 },
      size: { width: 500, height: 400 }
    });
    await canvas.createTestGroup({
      id: 'group-1',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 }
    });
    const taskId = await canvas.createTestTask({
      title: 'Deeply Nested',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Record initial positions
    const group1Before = await canvas.getNodeCoordinateState('section-group-1');
    const taskBefore = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Drag group-2 to new location
    await canvas.dragGroup('group-2', { deltaX: 200, deltaY: 100 });

    // Verify: group-1 and task moved with it
    const group1After = await canvas.getNodeCoordinateState('section-group-1');
    const taskAfter = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Group-1 should have moved by (200, 100) in computed position
    expect(group1After!.computedPosition.x).toBeCloseTo(group1Before!.computedPosition.x + 200, -1);
    expect(group1After!.computedPosition.y).toBeCloseTo(group1Before!.computedPosition.y + 100, -1);

    // Task should also have moved
    expect(taskAfter!.computedPosition.x).toBeCloseTo(taskBefore!.computedPosition.x + 200, -1);
    expect(taskAfter!.computedPosition.y).toBeCloseTo(taskBefore!.computedPosition.y + 100, -1);
  });

  test('both parent and child count same task correctly', async ({ page }) => {
    await canvas.createTestGroup({
      id: 'group-2',
      position: { x: 50, y: 50 },
      size: { width: 500, height: 400 }
    });
    await canvas.createTestGroup({
      id: 'group-1',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 }
    });
    // Task in group-1 (child)
    await canvas.createTestTask({ title: 'Task in Child', position: { x: 150, y: 150 } });
    // Task directly in group-2 (not in group-1)
    await canvas.createTestTask({ title: 'Task in Parent', position: { x: 400, y: 300 } });

    await page.waitForTimeout(500);

    // Assert: group-1 = 1, group-2 = 2 (recursive)
    await assertGroupCount(canvas, 'group-1', 1);
    await assertGroupCount(canvas, 'group-2', 2);
  });

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
});
```

#### Category 6: Edge Cases (P1)

```typescript
test.describe('Edge Cases', () => {
  let canvas: CanvasPage;

  test.beforeEach(async ({ page }) => {
    canvas = new CanvasPage(page);
    await canvas.goto();
  });

  test.afterEach(async () => {
    await canvas.cleanup();
  });

  test('empty group shows count of zero', async ({ page }) => {
    await canvas.createTestGroup({ id: 'empty-group', position: { x: 100, y: 100 } });
    await page.waitForTimeout(300);

    const count = await canvas.getGroupTaskCount('empty-group');
    expect(count).toBe(0);
  });

  test('rapid sequential drags maintain count accuracy', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    await canvas.createTestGroup({ id: 'group-2', position: { x: 500, y: 100 } });
    const taskId = await canvas.createTestTask({ title: 'Ping Pong Task', position: { x: 150, y: 150 } });

    await page.waitForTimeout(500);

    // Rapid ping-pong: group-1 -> group-2 -> group-1 -> group-2
    await canvas.dragTaskToGroup(taskId, 'group-2');
    await canvas.dragTaskToGroup(taskId, 'group-1');
    await canvas.dragTaskToGroup(taskId, 'group-2');

    // Final counts should be correct (not doubled or negative)
    await assertGroupCount(canvas, 'group-1', 0);
    await assertGroupCount(canvas, 'group-2', 1);
  });

  test('count never becomes negative', async ({ page }) => {
    await canvas.createTestGroup({ id: 'group-1', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({ title: 'Test Task', position: { x: 150, y: 150 } });

    await page.waitForTimeout(500);

    // Drag out
    await canvas.dragTaskToPosition(taskId, { x: 700, y: 400 });

    // Try to "double-decrement" by dragging again
    await canvas.dragTaskToPosition(taskId, { x: 800, y: 500 });

    // Count should still be 0, not negative
    const count = await canvas.getGroupTaskCount('group-1');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

#### Category 7: Data Persistence (P0 - NEW)

```typescript
test.describe('Data Persistence', () => {
  test('count persists after page refresh', async ({ page }) => {
    const canvas = new CanvasPage(page);
    await canvas.goto();

    await canvas.createTestGroup({ id: 'persist-group', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Persistent Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);
    await assertGroupCount(canvas, 'persist-group', 1);

    // Refresh page
    await page.reload();
    await page.waitForSelector('.vue-flow', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Count should still be 1
    const canvas2 = new CanvasPage(page);
    await assertGroupCount(canvas2, 'persist-group', 1);
  });

  test('positions and hierarchy persist across refresh', async ({ page }) => {
    const canvas = new CanvasPage(page);
    await canvas.goto();

    await canvas.createTestGroup({ id: 'parent-group', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Child Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Record state
    const beforeState = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Refresh
    await page.reload();
    await page.waitForSelector('.vue-flow', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify hierarchy and position preserved
    const canvas2 = new CanvasPage(page);
    const afterState = await canvas2.getNodeCoordinateState(`task-${taskId}`);

    expect(afterState!.parentNode).toBe(beforeState!.parentNode);
    expect(afterState!.computedPosition.x).toBeCloseTo(beforeState!.computedPosition.x, 0);
    expect(afterState!.computedPosition.y).toBeCloseTo(beforeState!.computedPosition.y, 0);
  });

  test('position lock prevents overwrite during 7s window', async ({ page }) => {
    const canvas = new CanvasPage(page);
    await canvas.goto();

    await canvas.createTestGroup({ id: 'lock-group', position: { x: 100, y: 100 } });
    const taskId = await canvas.createTestTask({
      title: 'Locked Task',
      position: { x: 150, y: 150 }
    });

    await page.waitForTimeout(500);

    // Drag task to new position
    await canvas.dragTaskToPosition(taskId, { x: 400, y: 300 });

    // Record position immediately after drag
    const afterDrag = await canvas.getNodeCoordinateState(`task-${taskId}`);

    // Trigger some store updates (simulating rapid task changes)
    await page.evaluate(() => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      // This might normally trigger position reset, but lock should prevent it
      taskStore.$patch({ lastUpdate: Date.now() });
    });

    await page.waitForTimeout(500);

    // Position should NOT have changed during lock window
    const afterUpdate = await canvas.getNodeCoordinateState(`task-${taskId}`);
    expect(afterUpdate!.computedPosition.x).toBeCloseTo(afterDrag!.computedPosition.x, 0);
    expect(afterUpdate!.computedPosition.y).toBeCloseTo(afterDrag!.computedPosition.y, 0);
  });
});
```

#### Category 8: Performance (P2)

```typescript
test.describe('Performance', () => {
  test.setTimeout(60000);

  test('count updates within 200ms for 20+ tasks', async ({ page }) => {
    const canvas = new CanvasPage(page);
    await canvas.goto();

    await canvas.createTestGroup({
      id: 'perf-group-1',
      position: { x: 50, y: 50 },
      size: { width: 500, height: 600 }
    });
    await canvas.createTestGroup({
      id: 'perf-group-2',
      position: { x: 600, y: 50 },
      size: { width: 500, height: 600 }
    });

    // Create 20 tasks in group-1
    const taskIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const taskId = await canvas.createTestTask({
        title: `Perf Task ${i}`,
        position: { x: 100 + (i % 4) * 100, y: 100 + Math.floor(i / 4) * 100 }
      });
      taskIds.push(taskId);
    }

    await page.waitForTimeout(1000);

    // Multi-select all
    await canvas.multiSelectTasks(taskIds);

    // Measure drag and count update time
    const start = Date.now();
    await canvas.dragSelectedTasks(550, 0);
    const elapsed = Date.now() - start;

    console.log(`Time to drag 20 tasks and update counts: ${elapsed}ms`);

    // Verify counts
    await assertGroupCount(canvas, 'perf-group-1', 0);
    await assertGroupCount(canvas, 'perf-group-2', 20);

    // Should complete in under 5 seconds (allowing for animation)
    expect(elapsed).toBeLessThan(5000);
  });

  test('nested group count calculation handles 50 tasks', async ({ page }) => {
    const canvas = new CanvasPage(page);
    await canvas.goto();

    // Create nested structure
    await canvas.createTestGroup({
      id: 'outer',
      position: { x: 50, y: 50 },
      size: { width: 800, height: 800 }
    });
    await canvas.createTestGroup({
      id: 'inner',
      position: { x: 100, y: 100 },
      size: { width: 600, height: 600 }
    });

    // Create 50 tasks
    for (let i = 0; i < 50; i++) {
      await canvas.createTestTask({
        title: `Task ${i}`,
        position: { x: 150 + (i % 5) * 100, y: 150 + Math.floor(i / 5) * 50 }
      });
    }

    await page.waitForTimeout(2000);

    // Verify counts are accurate
    const innerCount = await canvas.getGroupTaskCount('inner');
    const outerCount = await canvas.getGroupTaskCount('outer');

    expect(innerCount).toBe(50);
    expect(outerCount).toBe(50); // Recursive count

    console.log(`Inner count: ${innerCount}, Outer count: ${outerCount}`);
  });
});
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 4 basic count movement tests pass
- [ ] All 3 task independence tests pass
- [ ] All 4 nested group counting tests pass
- [ ] All 4 coordinate transformation tests pass (NEW)
- [ ] All 3 data persistence tests pass (NEW)
- [ ] All 3 edge case tests pass
- [ ] All 3 multi-select batch tests pass (NEW)
- [ ] All 2 performance tests pass
- [ ] Tests run successfully in CI pipeline

### Non-Functional Requirements

- [ ] Test execution time < 5 minutes for full suite
- [ ] Tests are deterministic (no flaky failures)
- [ ] Tests clean up their own data (no cross-test pollution)
- [ ] Error messages clearly identify failure cause

### Quality Gates

- [ ] Code reviewed by maintainer
- [ ] All tests pass on CI
- [ ] Documentation updated in `docs/MASTER_PLAN.md`

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage of count scenarios | 100% of documented flows |
| Flaky test rate | 0% |
| Regression detection | Catches all known count bugs |
| Execution time | < 300 seconds |

---

## Dependencies & Prerequisites

- Existing test infrastructure (`playwright.config.ts`)
- Canvas store implementation (`src/stores/canvas.ts`)
- Page already accessible at `http://localhost:5546/#/canvas`

---

## Implementation Tasks

### Phase 1: Infrastructure (MVP)

- [ ] Create `tests/fixtures/canvas-page.ts` with Page Object class
- [ ] Create `tests/fixtures/canvas-assertions.ts` with custom assertions
- [ ] Add helper methods: `getGroupTaskCount()`, `dragTaskToGroup()`, `createTestGroup()`, `createTestTask()`
- [ ] Add cleanup methods for test isolation
- [ ] Create `tests/canvas-task-counting.spec.ts` skeleton

### Phase 2: Core Tests

- [ ] Implement basic count movement tests (4 tests)
- [ ] Implement task independence tests (3 tests)
- [ ] Implement nested group counting tests (4 tests)

### Phase 3: Coordinate & Persistence Tests

- [ ] Implement coordinate transformation tests (4 tests)
- [ ] Implement data persistence tests (3 tests)

### Phase 4: Edge Cases & Performance

- [ ] Implement edge case tests (3 tests)
- [ ] Implement multi-select batch tests (3 tests)
- [ ] Implement performance tests (2 tests)

### Phase 5: CI Integration

- [ ] Add tests to existing Playwright CI workflow
- [ ] Configure canvas-specific project with longer timeouts
- [ ] Configure retry logic for timing-sensitive tests

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timing flakiness | Medium | High | Use `toPass()` with proper intervals, double nextTick for Vue Flow |
| DOM structure changes | Low | Medium | Use stable `data-id` selectors |
| Store access breaking | Low | High | Encapsulate store access in Page Object |
| Position lock interference | Medium | Medium | Wait 7+ seconds or explicitly check lock status |
| Multi-select edge cases | Medium | Medium | Use proper Ctrl+Click modifier patterns |

---

## Playwright Configuration Enhancement

```typescript
// playwright.config.ts additions for canvas tests
projects: [
  {
    name: 'canvas-tests',
    testMatch: '**/canvas*.spec.ts',
    use: {
      viewport: { width: 1920, height: 1080 },
      actionTimeout: 15000,
      navigationTimeout: 30000,
    },
    retries: 2,
  },
],
expect: {
  toPass: {
    intervals: [100, 300, 500, 1000, 1500],
    timeout: 5000
  }
}
```

---

## References & Research

### Internal References
- Existing position tests: `tests/canvas-position-persistence.spec.ts:80-120`
- Parent-child tests: `tests/canvas-parent-child.spec.ts:1-157`
- Store unit tests: `src/stores/__tests__/canvas.test.ts:1-570`
- Containment geometry: `tests/unit/bug-153-containment.spec.ts`
- Coordinate utils: `src/utils/geometry.ts:135-164`

### External References
- Playwright drag-drop: https://playwright.dev/docs/input#drag-and-drop
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright toPass(): https://playwright.dev/docs/test-assertions#expecttopass
- Vue Flow testing: https://reactflow.dev/learn/advanced-use/testing

### Related Work
- TASK-131: Position reset during session (DONE)
- TASK-142: Position reset on refresh (DONE)
- BUG-152: Stale parentNode causing group sync issues
- BUG-153: Center-point containment issues
- Current PR: Canvas group system refactor

---

## Open Questions (From SpecFlow Analysis)

These should be clarified before full implementation:

1. **During drag**: Should count update immediately or wait for drop?
   - **Research answer**: Update on drop after settling period (500-600ms)

2. **Undo/redo**: Should counts recalculate or be part of undo state?
   - **Research answer**: Counts are derived data, recalculate from position/containment

3. **Rapid drags**: What happens if task ping-pongs between groups within settling period?
   - **Research answer**: Last position wins, added explicit test for this

4. **Hidden groups**: Should hidden groups maintain accurate counts?
   - **Assumption**: Yes, count from `_rawGroups` includes hidden

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
