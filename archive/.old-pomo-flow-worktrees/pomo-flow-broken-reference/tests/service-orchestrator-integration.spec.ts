import { test, expect } from '@playwright/test';

test.describe('ServiceOrchestrator Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for app to fully load
  });

  test('Board view shows ServiceOrchestrator validation logs', async ({ page }) => {
    // Navigate to Board view
    await page.click('a[href="/"]');
    await page.waitForTimeout(1000);

    // Monitor console for ServiceOrchestrator validation logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('ServiceOrchestrator') ||
          msg.text().includes('Filter validation') ||
          msg.text().includes('BOARD]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Toggle Today filter to trigger validation
    const todayFilterButton = page.locator('button[title*="Today"]');
    if (await todayFilterButton.isVisible()) {
      await todayFilterButton.click();
      await page.waitForTimeout(1000);
    }

    // Check for validation logs
    const hasValidationLogs = consoleMessages.some(msg =>
      msg.includes('Filter validation') ||
      msg.includes('ServiceOrchestrator validation')
    );

    console.log('Board view console messages:', consoleMessages);
    expect(hasValidationLogs).toBeTruthy();
  });

  test('Calendar view shows ServiceOrchestrator validation logs', async ({ page }) => {
    // Navigate to Calendar view
    await page.click('a[href="/calendar"]');
    await page.waitForTimeout(1000);

    // Monitor console for ServiceOrchestrator validation logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('ServiceOrchestrator') ||
          msg.text().includes('Filter validation') ||
          msg.text().includes('CALENDAR]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Toggle status filter to trigger validation
    const statusFilterButton = page.locator('button[title*="Planned Tasks"]');
    if (await statusFilterButton.isVisible()) {
      await statusFilterButton.click();
      await page.waitForTimeout(1000);
    }

    // Check for validation logs
    const hasValidationLogs = consoleMessages.some(msg =>
      msg.includes('Filter validation') ||
      msg.includes('ServiceOrchestrator validation')
    );

    console.log('Calendar view console messages:', consoleMessages);
    expect(hasValidationLogs).toBeTruthy();
  });

  test('Canvas view shows ServiceOrchestrator validation logs', async ({ page }) => {
    // Navigate to Canvas view
    await page.click('a[href="/canvas"]');
    await page.waitForTimeout(2000); // Canvas takes longer to load

    // Monitor console for ServiceOrchestrator validation logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('ServiceOrchestrator') ||
          msg.text().includes('Filter validation') ||
          msg.text().includes('CANVAS]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Toggle hide done tasks to trigger validation
    const hideDoneButton = page.locator('button[title*="Hide completed tasks"], button[title*="Show completed tasks"]');
    if (await hideDoneButton.isVisible()) {
      await hideDoneButton.click();
      await page.waitForTimeout(1000);
    }

    // Check for validation logs
    const hasValidationLogs = consoleMessages.some(msg =>
      msg.includes('Filter validation') ||
      msg.includes('ServiceOrchestrator validation')
    );

    console.log('Canvas view console messages:', consoleMessages);
    expect(hasValidationLogs).toBeTruthy();
  });

  test('All Tasks view shows ServiceOrchestrator validation logs', async ({ page }) => {
    // Navigate to All Tasks view
    await page.click('a[href="/tasks"]');
    await page.waitForTimeout(1000);

    // Monitor console for ServiceOrchestrator validation logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('ServiceOrchestrator') ||
          msg.text().includes('Filter validation') ||
          msg.text().includes('ALL_TASKS]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Toggle hide done tasks to trigger validation
    const hideDoneButton = page.locator('button[title*="Hide completed tasks"], button[title*="Show completed tasks"]');
    if (await hideDoneButton.isVisible()) {
      await hideDoneButton.click();
      await page.waitForTimeout(1000);
    }

    // Check for validation logs
    const hasValidationLogs = consoleMessages.some(msg =>
      msg.includes('Filter validation') ||
      msg.includes('ServiceOrchestrator validation')
    );

    console.log('All Tasks view console messages:', consoleMessages);
    expect(hasValidationLogs).toBeTruthy();
  });

  test('Quick Sort view shows ServiceOrchestrator validation logs', async ({ page }) => {
    // Navigate to Quick Sort view
    await page.click('a[href="/quick-sort"]');
    await page.waitForTimeout(1000);

    // Monitor console for ServiceOrchestrator validation logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('ServiceOrchestrator') ||
          msg.text().includes('Filter validation') ||
          msg.text().includes('QUICK_SORT]')) {
        consoleMessages.push(msg.text());
      }
    });

    // Wait a bit for validation logs to appear
    await page.waitForTimeout(2000);

    // Check for validation logs
    const hasValidationLogs = consoleMessages.some(msg =>
      msg.includes('ServiceOrchestrator validation')
    );

    console.log('Quick Sort view console messages:', consoleMessages);
    expect(hasValidationLogs).toBeTruthy();
  });

  test('Today filter consistency across views', async ({ page }) => {
    const taskCounts: { [key: string]: number } = {};

    // Test Board view Today filter
    await page.click('a[href="/"]');
    await page.waitForTimeout(1000);

    const boardMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('BOARD]') && msg.text().includes('Today tasks:')) {
        boardMessages.push(msg.text());
      }
    });

    const todayFilterButton = page.locator('button[title*="Today"]');
    if (await todayFilterButton.isVisible()) {
      await todayFilterButton.click();
      await page.waitForTimeout(1000);
    }

    // Extract task count from board messages
    const boardCountMatch = boardMessages.find(msg => msg.includes('ServiceOrchestrator Today tasks:'));
    if (boardCountMatch) {
      const count = parseInt(boardCountMatch.split('ServiceOrchestrator Today tasks:')[1].trim());
      taskCounts.board = count;
    }

    // Test Calendar view Today filter (simulate via URL or navigation)
    await page.click('a[href="/calendar"]');
    await page.waitForTimeout(1000);

    const calendarMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('CALENDAR]') && msg.text().includes('ServiceOrchestrator Today tasks:')) {
        calendarMessages.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    const calendarCountMatch = calendarMessages.find(msg => msg.includes('ServiceOrchestrator Today tasks:'));
    if (calendarCountMatch) {
      const count = parseInt(calendarCountMatch.split('ServiceOrchestrator Today tasks:')[1].trim());
      taskCounts.calendar = count;
    }

    console.log('Task counts across views:', taskCounts);

    // Verify counts are consistent (allowing for slight differences in timing)
    if (taskCounts.board && taskCounts.calendar) {
      expect(Math.abs(taskCounts.board - taskCounts.calendar)).toBeLessThanOrEqual(1);
    }
  });
});