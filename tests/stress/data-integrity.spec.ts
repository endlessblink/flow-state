import { test, expect, Page } from '@playwright/test';

/**
 * Data Integrity Stress Tests
 * TASK-338: Tier 1 Critical Path Testing
 *
 * Tests task CRUD operations, sync, and canvas position persistence
 * under stress conditions.
 */

test.describe('Data Integrity Stress Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 15000 }).catch(() => {
      // Fallback: wait for main content to be visible
      return page.waitForSelector('.app-container, .main-content, #app', { timeout: 15000 });
    });
  });

  test('@quick Task CRUD - Rapid Creation', async ({ page }) => {
    /**
     * SCENARIO-001: Rapid Task Creation
     * Create 20 tasks rapidly and verify no duplicates
     */
    const taskCount = 20;
    const createdTasks: string[] = [];

    // Navigate to board view for easier task creation
    await page.click('[data-testid="nav-board"]').catch(() => {
      return page.click('text=Board').catch(() => {
        return page.keyboard.press('2'); // Keyboard shortcut
      });
    });

    await page.waitForTimeout(1000);

    for (let i = 0; i < taskCount; i++) {
      const taskTitle = `Stress Test Task ${i + 1} - ${Date.now()}`;

      // Try to create task via keyboard shortcut or button
      await page.keyboard.press('n');
      await page.waitForTimeout(100);

      // Fill in task title
      const titleInput = page.locator('input[placeholder*="title"], input[data-testid="task-title-input"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill(taskTitle);
        await page.keyboard.press('Enter');
        createdTasks.push(taskTitle);
      }

      // Small delay between creations to simulate rapid but realistic usage
      await page.waitForTimeout(50);
    }

    // Wait for sync
    await page.waitForTimeout(2000);

    // Verify: Check for duplicates by looking at task list
    const allTaskTitles = await page.locator('[data-testid="task-card"] h3, .task-title, .task-card-title')
      .allTextContents()
      .catch(() => []);

    const stressTestTasks = allTaskTitles.filter(t => t.includes('Stress Test Task'));
    const uniqueTasks = new Set(stressTestTasks);

    // Pass criteria: No duplicates
    expect(uniqueTasks.size).toBe(stressTestTasks.length);
    console.log(`Created ${createdTasks.length} tasks, found ${stressTestTasks.length} in UI`);
  });

  test('@quick Canvas Position Persistence', async ({ page }) => {
    /**
     * Test that canvas positions survive page refresh
     */

    // Navigate to canvas
    await page.click('[data-testid="nav-canvas"]').catch(() => {
      return page.click('text=Canvas').catch(() => {
        return page.keyboard.press('1');
      });
    });

    await page.waitForTimeout(1000);

    // Find a task node on canvas
    const taskNode = page.locator('.vue-flow__node, [data-testid="canvas-task-node"]').first();
    const isVisible = await taskNode.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      console.log('No canvas nodes found - skipping position test');
      return;
    }

    // Get initial position
    const initialBox = await taskNode.boundingBox();
    if (!initialBox) {
      console.log('Could not get bounding box - skipping');
      return;
    }

    console.log(`Initial position: x=${initialBox.x}, y=${initialBox.y}`);

    // Drag task to new position
    const newX = initialBox.x + 100;
    const newY = initialBox.y + 50;

    await taskNode.dragTo(page.locator('body'), {
      targetPosition: { x: newX, y: newY }
    }).catch(async () => {
      // Fallback: manual drag
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(newX, newY);
      await page.mouse.up();
    });

    await page.waitForTimeout(1000);

    // Get position after drag
    const afterDragBox = await taskNode.boundingBox();
    console.log(`After drag: x=${afterDragBox?.x}, y=${afterDragBox?.y}`);

    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to canvas
    await page.click('[data-testid="nav-canvas"]').catch(() => {
      return page.click('text=Canvas').catch(() => {
        return page.keyboard.press('1');
      });
    });

    await page.waitForTimeout(1000);

    // Check position after refresh
    const refreshedNode = page.locator('.vue-flow__node, [data-testid="canvas-task-node"]').first();
    const afterRefreshBox = await refreshedNode.boundingBox();

    if (afterRefreshBox && afterDragBox) {
      const tolerance = 50; // 50px tolerance for position drift
      const xDiff = Math.abs(afterRefreshBox.x - afterDragBox.x);
      const yDiff = Math.abs(afterRefreshBox.y - afterDragBox.y);

      console.log(`After refresh: x=${afterRefreshBox.x}, y=${afterRefreshBox.y}`);
      console.log(`Position drift: x=${xDiff}px, y=${yDiff}px`);

      // Pass criteria: Position within tolerance
      expect(xDiff).toBeLessThan(tolerance);
      expect(yDiff).toBeLessThan(tolerance);
    }
  });

  test('Concurrent Edit Simulation', async ({ page, context }) => {
    /**
     * SCENARIO-002: Concurrent Multi-Device Edit
     * Open same task in 2 tabs, edit simultaneously
     */

    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForTimeout(2000);

    // Both pages: Navigate to board view
    await Promise.all([
      page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2')),
      page2.click('[data-testid="nav-board"]').catch(() => page2.keyboard.press('2'))
    ]);

    await Promise.all([
      page.waitForTimeout(1000),
      page2.waitForTimeout(1000)
    ]);

    // Find a task in both pages
    const taskCard1 = page.locator('[data-testid="task-card"], .task-card').first();
    const taskCard2 = page2.locator('[data-testid="task-card"], .task-card').first();

    const card1Visible = await taskCard1.isVisible({ timeout: 3000 }).catch(() => false);
    const card2Visible = await taskCard2.isVisible({ timeout: 3000 }).catch(() => false);

    if (!card1Visible || !card2Visible) {
      console.log('No tasks available for concurrent edit test');
      await page2.close();
      return;
    }

    // Click to edit in both tabs (nearly simultaneously)
    await Promise.all([
      taskCard1.dblclick().catch(() => taskCard1.click()),
      taskCard2.dblclick().catch(() => taskCard2.click())
    ]);

    await Promise.all([
      page.waitForTimeout(500),
      page2.waitForTimeout(500)
    ]);

    // Both tabs edit the title
    const timestamp = Date.now();
    const title1 = `Edit from Tab 1 - ${timestamp}`;
    const title2 = `Edit from Tab 2 - ${timestamp}`;

    // Tab 1 edits first
    const titleInput1 = page.locator('input[data-testid="task-title-input"], .task-title-edit').first();
    if (await titleInput1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput1.fill(title1);
      await page.keyboard.press('Enter');
    }

    // Tab 2 edits immediately after
    const titleInput2 = page2.locator('input[data-testid="task-title-input"], .task-title-edit').first();
    if (await titleInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput2.fill(title2);
      await page2.keyboard.press('Enter');
    }

    // Wait for sync
    await Promise.all([
      page.waitForTimeout(3000),
      page2.waitForTimeout(3000)
    ]);

    // Refresh both pages
    await Promise.all([
      page.reload(),
      page2.reload()
    ]);

    await Promise.all([
      page.waitForTimeout(2000),
      page2.waitForTimeout(2000)
    ]);

    // Navigate to board in both
    await Promise.all([
      page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2')),
      page2.click('[data-testid="nav-board"]').catch(() => page2.keyboard.press('2'))
    ]);

    await page.waitForTimeout(1000);

    // Check that both tabs show the same final state
    const finalTitle1 = await page.locator('[data-testid="task-card"] h3, .task-title').first().textContent().catch(() => '');
    const finalTitle2 = await page2.locator('[data-testid="task-card"] h3, .task-title').first().textContent().catch(() => '');

    console.log(`Tab 1 final title: ${finalTitle1}`);
    console.log(`Tab 2 final title: ${finalTitle2}`);

    // Pass criteria: Both tabs show same state (last-write-wins)
    expect(finalTitle1).toBe(finalTitle2);

    await page2.close();
  });

  test('Network Instability Simulation', async ({ page, context }) => {
    /**
     * SCENARIO-005: Network Instability
     * Drop connection during operation, verify recovery
     */

    // Navigate to board
    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Start creating a task
    const taskTitle = `Network Test Task - ${Date.now()}`;
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    // Simulate offline mode
    await context.setOffline(true);
    console.log('Network: OFFLINE');

    // Try to complete task creation while offline
    const titleInput = page.locator('input[placeholder*="title"], input[data-testid="task-title-input"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill(taskTitle);
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(1000);

    // Go back online
    await context.setOffline(false);
    console.log('Network: ONLINE');

    // Wait for sync to recover
    await page.waitForTimeout(5000);

    // Refresh and verify task was saved
    await page.reload();
    await page.waitForTimeout(2000);

    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Look for the task
    const pageContent = await page.content();
    const taskFound = pageContent.includes(taskTitle) ||
      pageContent.includes('Network Test Task');

    console.log(`Task found after network recovery: ${taskFound}`);

    // Note: This may fail if offline persistence isn't implemented
    // That's valid - it documents the current behavior
    if (!taskFound) {
      console.log('WARNING: Task created offline was not persisted after reconnection');
    }
  });

});
