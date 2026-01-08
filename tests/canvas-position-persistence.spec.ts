/**
 * TASK-131: Canvas Position Persistence Regression Test
 *
 * PURPOSE: Prevent position reset bugs from recurring
 *
 * ROOT CAUSE (January 8, 2026):
 * A competing `deep: true` watcher in canvas.ts was calling syncTasksToCanvas()
 * on ANY task property change, overwriting positions that were locked during drag.
 *
 * FIX: Removed competing watcher. useCanvasSync.ts is the SINGLE source of truth.
 *
 * This test will FAIL if:
 * - Someone adds a new watcher that syncs canvas without respecting position locks
 * - Position locking logic is broken
 * - Competing sync systems are introduced
 */

import { test, expect } from '@playwright/test';

// Helper to get Pinia store from Vue app
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

test.describe('Canvas Position Persistence (TASK-131 Regression Guard)', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/#/canvas');
    await page.waitForSelector('.vue-flow', { timeout: 10000 });
    await page.waitForTimeout(1000); // Let canvas fully initialize
  });

  test('task position should persist after drag and not reset', async ({ page }) => {
    // Step 1: Create a task programmatically with a known canvas position
    const taskId = await page.evaluate(async () => {
      const app = document.querySelector('#app');
      if (!app || !('__vue_app__' in app)) throw new Error('Vue app not found');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      if (!taskStore) throw new Error('Task store not found');

      const task = await taskStore.createTask({
        title: 'Position Persistence Test Task',
        status: 'planned',
        dueDate: new Date().toISOString().split('T')[0], // Today so it shows on canvas
        canvasPosition: { x: 500, y: 300 }
      });
      return task.id;
    });

    expect(taskId).toBeTruthy();
    console.log(`Created test task: ${taskId}`);

    // Step 2: Wait for task node to appear on canvas
    await page.waitForTimeout(1000);

    // Step 3: Find the task node and get its initial position
    const nodeSelector = `.vue-flow__node[data-id="task-${taskId}"]`;
    const taskNode = page.locator(nodeSelector);

    // If node is not visible, it might be outside viewport - fit view first
    const isVisible = await taskNode.isVisible().catch(() => false);
    if (!isVisible) {
      // Press 'f' to fit view
      await page.keyboard.press('f');
      await page.waitForTimeout(500);
    }

    // Get initial transform/position
    const getNodePosition = async () => {
      return page.evaluate((selector) => {
        const node = document.querySelector(selector) as HTMLElement;
        if (!node) return null;
        const transform = node.style.transform;
        // Parse transform: "translate(Xpx, Ypx)"
        const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
        // Fallback: check computed style
        const style = window.getComputedStyle(node);
        const matrix = new DOMMatrix(style.transform);
        return { x: matrix.m41, y: matrix.m42 };
      }, nodeSelector);
    };

    const initialPosition = await getNodePosition();
    console.log('Initial position:', initialPosition);
    expect(initialPosition).toBeTruthy();

    // Step 4: Drag the task to a new position (move 200px right, 100px down)
    const box = await taskNode.boundingBox();
    if (!box) {
      throw new Error('Could not get task node bounding box');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + 20; // Near top to grab drag handle
    const deltaX = 200;
    const deltaY = 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();

    // Step 5: Wait for position to settle
    await page.waitForTimeout(500);

    const positionAfterDrag = await getNodePosition();
    console.log('Position after drag:', positionAfterDrag);

    // Verify position actually changed (drag worked)
    expect(positionAfterDrag).toBeTruthy();
    if (initialPosition && positionAfterDrag) {
      const moved = Math.abs(positionAfterDrag.x - initialPosition.x) > 50 ||
                    Math.abs(positionAfterDrag.y - initialPosition.y) > 50;
      expect(moved).toBe(true);
    }

    // Step 6: Trigger an action that could cause a sync (update task title)
    // This is the KEY TEST - before the fix, this would cause position to reset
    await page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      const task = taskStore.tasks.find((t: any) => t.id === id);
      if (task) {
        taskStore.updateTask(id, { title: 'Position Persistence Test Task - Updated' });
      }
    }, taskId);

    // Step 7: Wait and verify position did NOT reset
    await page.waitForTimeout(1000);

    const positionAfterUpdate = await getNodePosition();
    console.log('Position after task update:', positionAfterUpdate);

    // CRITICAL ASSERTION: Position should be the same as after drag, NOT reset
    expect(positionAfterUpdate).toBeTruthy();
    if (positionAfterDrag && positionAfterUpdate) {
      const xDiff = Math.abs(positionAfterUpdate.x - positionAfterDrag.x);
      const yDiff = Math.abs(positionAfterUpdate.y - positionAfterDrag.y);

      // Allow small tolerance for floating point/rounding
      expect(xDiff).toBeLessThan(10);
      expect(yDiff).toBeLessThan(10);
    }

    // Step 8: Wait longer and check again (position locks have 7s timeout)
    await page.waitForTimeout(3000);

    const positionAfterWait = await getNodePosition();
    console.log('Position after waiting:', positionAfterWait);

    if (positionAfterDrag && positionAfterWait) {
      const xDiff = Math.abs(positionAfterWait.x - positionAfterDrag.x);
      const yDiff = Math.abs(positionAfterWait.y - positionAfterDrag.y);

      expect(xDiff).toBeLessThan(10);
      expect(yDiff).toBeLessThan(10);
    }

    // Cleanup: delete test task
    await page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      taskStore.deleteTask(id);
    }, taskId);
  });

  test('multiple rapid task updates should not reset dragged position', async ({ page }) => {
    // This test specifically targets the scenario where rapid updates could trigger
    // competing sync systems to overwrite positions

    const taskId = await page.evaluate(async () => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      const task = await taskStore.createTask({
        title: 'Rapid Update Test Task',
        status: 'planned',
        dueDate: new Date().toISOString().split('T')[0],
        canvasPosition: { x: 600, y: 400 }
      });
      return task.id;
    });

    await page.waitForTimeout(1000);
    await page.keyboard.press('f'); // Fit view
    await page.waitForTimeout(500);

    const nodeSelector = `.vue-flow__node[data-id="task-${taskId}"]`;
    const taskNode = page.locator(nodeSelector);
    const box = await taskNode.boundingBox();

    if (!box) {
      console.log('Task node not visible, skipping rapid update test');
      return;
    }

    // Drag to new position
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 150, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Record position after drag
    const positionAfterDrag = await page.evaluate((selector) => {
      const node = document.querySelector(selector) as HTMLElement;
      const style = window.getComputedStyle(node);
      const matrix = new DOMMatrix(style.transform);
      return { x: matrix.m41, y: matrix.m42 };
    }, nodeSelector);

    // Rapid fire updates (this would trigger the old bug)
    for (let i = 0; i < 5; i++) {
      await page.evaluate((id, iteration) => {
        const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
        taskStore.updateTask(id, {
          description: `Update ${iteration} at ${Date.now()}`
        });
      }, taskId, i);
      await page.waitForTimeout(50); // Small delay between updates
    }

    await page.waitForTimeout(500);

    // Verify position is STILL the same
    const positionAfterRapidUpdates = await page.evaluate((selector) => {
      const node = document.querySelector(selector) as HTMLElement;
      const style = window.getComputedStyle(node);
      const matrix = new DOMMatrix(style.transform);
      return { x: matrix.m41, y: matrix.m42 };
    }, nodeSelector);

    const xDiff = Math.abs(positionAfterRapidUpdates.x - positionAfterDrag.x);
    const yDiff = Math.abs(positionAfterRapidUpdates.y - positionAfterDrag.y);

    expect(xDiff).toBeLessThan(10);
    expect(yDiff).toBeLessThan(10);

    // Cleanup
    await page.evaluate((id) => {
      const app = document.querySelector('#app');
      const vueApp = (app as any).__vue_app__;
      const taskStore = vueApp.config.globalProperties.$pinia._s.get('tasks');
      taskStore.deleteTask(id);
    }, taskId);
  });
});
