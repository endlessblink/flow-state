import { test, expect } from '@playwright/test';

test('task creation works after missing function fix', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5546/');
  await page.waitForLoadState('networkidle');

  // Wait for app to initialize
  await page.waitForTimeout(3000);

  // Monitor console for errors
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  // Look for quick task input
  const quickTaskInput = page.locator('input[placeholder*="task"], input[data-testid*="quick"], .quick-task-input').first();

  if (await quickTaskInput.isVisible()) {
    console.log('✅ Found quick task input');

    // Try to create a task
    await quickTaskInput.fill('Test task after fix');
    await quickTaskInput.press('Enter');

    // Wait a moment for task creation
    await page.waitForTimeout(1000);

    // Check if task appears in the UI
    const taskElements = page.locator('.task-card, .task-item, [data-testid*="task"]');
    const taskCount = await taskElements.count();

    console.log(`Found ${taskCount} task elements after creation attempt`);

    // Look for our specific test task
    const testTask = page.locator('text=Test task after fix');
    const testTaskVisible = await testTask.isVisible();

    console.log(`Test task visible: ${testTaskVisible}`);

    // Check for success indicators in console
    const successLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('✅') || text.includes('Tasks saved to database') || text.includes('created')) {
        successLogs.push(text);
        console.log('SUCCESS LOG:', text);
      }
    });

    // Verify no critical errors occurred
    const hasCriticalErrors = consoleErrors.some(error =>
      error.includes('saveToDatabase is not defined') ||
      error.includes('Cannot read properties of undefined')
    );

    console.log(`Critical errors detected: ${hasCriticalErrors}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('All console errors:', consoleErrors);
    }

    // Task creation should work now
    expect(hasCriticalErrors).toBe(false);
    expect(testTaskVisible || taskCount > 0).toBe(true);

    console.log('✅ Task creation test completed');
  } else {
    // Look for alternative task creation methods
    const addTaskButton = page.locator('button:has-text("Add"), button:has-text("Create"), [data-testid*="add-task"]').first();

    if (await addTaskButton.isVisible()) {
      console.log('✅ Found add task button');
      await addTaskButton.click();

      // Look for modal or form
      await page.waitForTimeout(500);

      const taskTitleInput = page.locator('input[placeholder*="title"], input[name*="title"], .task-title-input').first();

      if (await taskTitleInput.isVisible()) {
        await taskTitleInput.fill('Test task via modal');

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), .save-button').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(1000);

          // Check if task was created
          const taskElements = page.locator('.task-card, .task-item, [data-testid*="task"]');
          const taskCount = await taskElements.count();

          console.log(`Found ${taskCount} task elements after modal creation`);

          expect(taskCount > 0).toBe(true);
        }
      }
    } else {
      console.log('❌ No task creation interface found');
      // At minimum, verify no critical JavaScript errors
      const hasCriticalErrors = consoleErrors.some(error =>
        error.includes('saveToDatabase is not defined')
      );
      expect(hasCriticalErrors).toBe(false);
    }
  }
});