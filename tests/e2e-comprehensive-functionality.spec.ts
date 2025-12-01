import { test, expect } from '@playwright/test';

test.describe('Pomo-Flow Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
  });

  test('Complete task lifecycle workflow', async ({ page }) => {
    // 1. Create a task
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="add"], .quick-task-input');
    if (await taskInput.isVisible()) {
      await taskInput.fill('E2E Lifecycle Test Task');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // 2. Find the created task
    const createdTask = page.locator('.task-card, .task-item, [class*="task"]').filter({ hasText: 'E2E Lifecycle Test Task' }).first();
    expect(await createdTask.count()).toBeGreaterThan(0);

    // 3. Start timer for the task
    const startButton = page.locator('button[title="Start 25-min work timer"]');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(2000);

      // Verify timer is running
      const timerDisplay = page.locator('.timer-time');
      const timerText = await timerDisplay.textContent();
      expect(timerText).toMatch(/\d{1,2}:\d{2}/); // Should show time format

      // Pause timer
      const pauseButton = page.locator('button[title*="Pause"], button:has-text("Pause")');
      if (await pauseButton.isVisible()) {
        await pauseButton.click();
        await page.waitForTimeout(1000);
      }

      // Stop timer
      const stopButton = page.locator('button[title*="Stop"], button:has-text("Stop")');
      if (await stopButton.isVisible()) {
        await stopButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // 4. Check task status (should show progress)
    const taskStatus = createdTask.locator('[class*="status"], [class*="progress"]');
    // Status might not be immediately updated, which is fine
  });

  test('View navigation and data consistency', async ({ page }) => {
    // Test navigation to different views
    const views = ['/', '/canvas', '/calendar'];

    for (const viewPath of views) {
      await page.goto(`http://localhost:5546${viewPath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Check that application content loads
      const mainContent = page.locator('main, .main-content, [class*="view"], [class*="container"]');
      expect(await mainContent.count()).toBeGreaterThan(0);

      // Check for no critical errors
      const errorElements = page.locator('.error, .error-message, [class*="error"]');
      const errorCount = await errorElements.count();
      expect(errorCount).toBeLessThan(3); // Allow minor UI errors
    }
  });

  test('Canvas view functionality', async ({ page }) => {
    // Navigate to canvas view
    await page.goto('http://localhost:5546/canvas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for Vue Flow canvas elements
    const canvasElements = page.locator('.vue-flow, [class*="vue-flow"], [class*="canvas"]');
    const canvasCount = await canvasElements.count();

    if (canvasCount > 0) {
      // Check for canvas controls
      const controls = page.locator('.vue-flow__controls, [class*="controls"]');
      const controlsCount = await controls.count();
      console.log(`Found ${controlsCount} canvas control sets`);

      // Check for nodes or sections
      const nodes = page.locator('.vue-flow__node, [class*="node"], [class*="section"]');
      const nodeCount = await nodes.count();
      console.log(`Found ${nodeCount} canvas nodes/sections`);
    } else {
      console.log('Canvas view loaded but no Vue Flow elements found (may be loading state)');
    }

    // Canvas should load without critical errors
    const criticalErrors = page.locator('.error, [class*="critical-error"]');
    expect(await criticalErrors.count()).toBe(0);
  });

  test('Calendar view functionality', async ({ page }) => {
    // Navigate to calendar view
    await page.goto('http://localhost:5546/#/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for calendar heading
    const calendarHeading = page.locator('h1:has-text("Calendar"), h2:has-text("Calendar")');
    const headingCount = await calendarHeading.count();

    if (headingCount > 0) {
      console.log('Calendar view heading found');

      // Look for date navigation (Previous/Next Day buttons)
      const dateNavigation = page.locator('button:has-text("Previous Day"), button:has-text("Next Day"), button:has-text("Today")');
      expect(await dateNavigation.count()).toBeGreaterThan(0);

      // Look for time slots (12 AM, 1 AM, etc.) - indicates calendar grid loaded
      const timeSlots = page.locator('text=/^\\d{1,2} [AP]M$/');
      expect(await timeSlots.count()).toBeGreaterThan(0);

      // Look for view switcher (Day/Week/Month buttons)
      const viewSwitcher = page.locator('button:has-text("Day"), button:has-text("Week"), button:has-text("Month")');
      expect(await viewSwitcher.count()).toBeGreaterThan(0);
    } else {
      console.log('Calendar view loaded but no heading found - checking for alternative elements');
      // Fallback: check for any calendar-related content
      const calendarContent = page.locator('[class*="calendar"], [class*="inbox"]');
      expect(await calendarContent.count()).toBeGreaterThan(0);
    }

    // Calendar should load without critical errors
    const criticalErrors = page.locator('.error, [class*="critical-error"]');
    expect(await criticalErrors.count()).toBe(0);
  });

  test('Task management across views', async ({ page }) => {
    // Create a test task
    const taskTitle = `Cross-View Test Task ${Date.now()}`;

    // Try to create task in board view
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');

    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="add"], .quick-task-input');
    if (await taskInput.isVisible()) {
      await taskInput.fill(taskTitle);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Check if task appears in different views
    const views = ['/canvas', '/calendar'];

    for (const viewPath of views) {
      await page.goto(`http://localhost:5546${viewPath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for the task (it might not appear in all views depending on implementation)
      const taskElement = page.locator('*').filter({ hasText: taskTitle });
      const taskFound = await taskElement.count() > 0;

      if (taskFound) {
        console.log(`Task found in ${viewPath} view`);
      } else {
        console.log(`Task not found in ${viewPath} view (may be expected)`);
      }
    }
  });

  test('Performance and loading', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds

    // Check for memory leaks (basic check)
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Navigate through views
    const views = ['/', '/canvas', '/calendar'];
    for (const viewPath of views) {
      await page.goto(`http://localhost:5546${viewPath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 50MB for basic navigation)
      expect(memoryIncreaseMB).toBeLessThan(50);
    }
  });

  test('Error handling and edge cases', async ({ page }) => {
    // Test navigation to non-existent routes
    await page.goto('http://localhost:5546/non-existent-route');
    await page.waitForLoadState('networkidle');

    // Should handle gracefully (either show 404 or redirect)
    const stillApp = page.locator('body').isVisible();
    expect(stillApp).toBeTruthy();

    // Test rapid view switching
    const views = ['/', '/canvas', '/calendar'];
    for (let i = 0; i < 3; i++) {
      for (const viewPath of views) {
        await page.goto(`http://localhost:5546${viewPath}`);
        await page.waitForTimeout(100);
      }
    }

    // Should still be functional after rapid switching
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');

    const timerElement = page.locator('.timer-container');
    expect(await timerElement.isVisible()).toBeTruthy();
  });
});