import { chromium } from 'playwright';

async function focusedUndoTest() {
  console.log('🎯 FOCUSED UNDO/REDO VISUAL RESTORATION TEST');

  const browser = await chromium.launch({
    headless: false,  // Keep visible for manual verification
    slowMo: 1000     // Slow down for visual verification
  });

  const page = await browser.newPage();
  const consoleMessages = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log(`[ERROR] ${msg.text()}`);
    }
  });

  try {
    // Navigate to app
    console.log('📍 Step 1: Loading Pomo-Flow...');
    await page.goto('http://localhost:5547', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('📍 Step 2: Looking for tasks...');
    // Look for any task-like elements
    const taskSelectors = [
      '[data-testid*="task"]',
      '.task',
      '[class*="task"]',
      '.task-card',
      '[class*="Task"]',
      'button:has-text("Test Task")',
      '*:has-text("Test Task")'
    ];

    let taskElement = null;
    for (const selector of taskSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent().catch(() => '');
        if (text && text.includes('Test Task') && text.length < 100) {
          taskElement = element;
          console.log(`✅ Found task with selector "${selector}": "${text.trim()}"`);
          break;
        }
      }
      if (taskElement) break;
    }

    if (!taskElement) {
      console.log('❌ No test tasks found, trying any task...');
      taskElement = await page.locator('[class*="task"], [data-testid*="task"]').first();
      if (await taskElement.count() === 0) {
        throw new Error('No tasks found at all');
      }
      const text = await taskElement.textContent();
      console.log(`✅ Found any task: "${text?.trim()}"`);
    }

    // Take screenshot before
    await page.screenshot({ path: 'focused-before-delete.png' });
    console.log('📸 Screenshot saved: focused-before-delete.png');

    console.log('📍 Step 3: Attempting to delete task...');

    // Try different ways to delete the task
    let deleteSuccess = false;

    // Method 1: Right-click context menu
    try {
      await taskElement.click({ button: 'right' });
      await page.waitForTimeout(1000);

      // Look for delete in context menu
      const deleteContext = await page.locator('text=Delete, text=Remove, [aria-label*="delete"], [aria-label*="remove"]').first();
      if (await deleteContext.isVisible()) {
        await deleteContext.click();
        deleteSuccess = true;
        console.log('✅ Used context menu to delete task');
      }
    } catch (error) {
      console.log('Context menu method failed:', error.message);
    }

    // Method 2: Look for delete button on/near task
    if (!deleteSuccess) {
      try {
        const deleteButton = await page.locator('button:has-text("Delete"), button:has-text("Remove"), button[title*="delete"], button[title*="remove"]').first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          deleteSuccess = true;
          console.log('✅ Used delete button to delete task');
        }
      } catch (error) {
        console.log('Delete button method failed:', error.message);
      }
    }

    // Method 3: Try keyboard deletion
    if (!deleteSuccess) {
      try {
        await taskElement.click();
        await page.keyboard.press('Delete');
        deleteSuccess = true;
        console.log('✅ Used Delete key to remove task');
      } catch (error) {
        console.log('Delete key method failed:', error.message);
      }
    }

    await page.waitForTimeout(2000);

    // Check if task is still visible
    const taskStillVisible = await taskElement.isVisible();
    console.log(`🔍 Task visible after deletion attempt: ${taskStillVisible}`);

    // Take screenshot after deletion
    await page.screenshot({ path: 'focused-after-delete.png' });
    console.log('📸 Screenshot saved: focused-after-delete.png');

    if (!taskStillVisible) {
      console.log('✅ SUCCESS: Task was deleted');

      console.log('📍 Step 4: CRITICAL TEST - Pressing Ctrl+Z for undo...');

      // Focus on page and press Ctrl+Z
      await page.keyboard.press('Control+KeyZ');
      await page.waitForTimeout(2000);

      // Take screenshot after undo
      await page.screenshot({ path: 'focused-after-undo.png' });
      console.log('📸 Screenshot saved: focused-after-undo.png');

      // Check if task is visible again - THIS IS THE CRITICAL TEST
      const taskVisibleAfterUndo = await taskElement.isVisible();
      console.log(`🎯 CRITICAL RESULT - Task visible after Ctrl+Z: ${taskVisibleAfterUndo}`);

      if (taskVisibleAfterUndo) {
        console.log('🎉 SUCCESS: VISUAL RESTORATION WORKING! Task reappeared after undo.');
        console.log('✅ The undo/redo visual restoration is FUNCTIONING');
      } else {
        console.log('❌ FAILURE: VISUAL RESTORATION NOT WORKING');
        console.log('❌ Task did not reappear after Ctrl+Z');

        // Try to find task by text in case DOM reference changed
        const originalText = await taskElement.textContent();
        const foundByText = await page.locator(`text="${originalText}"`).count();
        if (foundByText > 0) {
          console.log('⚠️ Task found by text search - DOM reference may have changed');
        }
      }
    } else {
      console.log('❌ Deletion failed - task is still visible');
    }

    // Error analysis
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    console.log(`\n📊 Error Analysis:`);
    console.log(`Console errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(err => console.log(`  - ${err.text}`));
    } else {
      console.log('✅ No console errors detected');
    }

    console.log('\n📋 Test Instructions:');
    console.log('1. Check screenshots: focused-before-delete.png, focused-after-delete.png, focused-after-undo.png');
    console.log('2. Verify that:');
    console.log('   - Task disappears in focused-after-delete.png');
    console.log('   - Task reappears in focused-after-undo.png');
    console.log('3. If task appears in after-undo screenshot, the test PASSED');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    console.log('\n⏳ Keeping browser open for 30 seconds for manual verification...');
    await page.waitForTimeout(30000);
    await browser.close();
  }

  console.log('🏁 Focused undo/redo test complete!');
}

focusedUndoTest().catch(console.error);