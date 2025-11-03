import { test, expect } from '@playwright/test';

test.describe('Reproduce User-Specific Errors', () => {
  let consoleErrors: Array<{ message: string; type: string; location: string }> = [];

  test.beforeEach(async ({ page }) => {
    // Clear console errors array
    consoleErrors = [];

    // Set up console error listener
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const location = msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : 'unknown';
        consoleErrors.push({
          message: msg.text(),
          type: type,
          location: location
        });
        console.log(`[${type.toUpperCase()}] ${msg.text()} at ${location}`);
      }
    });

    // Set up page error listener
    page.on('pageerror', error => {
      consoleErrors.push({
        message: error.message,
        type: 'pageerror',
        location: error.stack?.split('\n')[1] || 'unknown'
      });
      console.log(`[PAGE ERROR] ${error.message}`);
    });
  });

  test('reproduce actions.updateSection error', async ({ page }) => {
    console.log('🔧 Testing actions.updateSection error reproduction...');

    await page.goto('http://localhost:5548');
    await page.waitForLoadState('networkidle');

    // Navigate to canvas - use robust navigation
    console.log('🎯 Navigating to canvas view...');

    // Look for navigation elements and find Canvas link
    const navSelectors = [
      'nav',
      '[role="navigation"]',
      '.navbar',
      '.nav',
      '[class*="nav"]',
      '.content-header',
      '.view-tabs'
    ];

    let canvasFound = false;
    for (const selector of navSelectors) {
      try {
        const nav = await page.locator(selector).first();
        if (await nav.isVisible()) {
          // Get all clickable elements in navigation
          const navLinks = await nav.locator('a, button, [role="button"]').all();

          // Look for Canvas link
          for (let i = 0; i < navLinks.length; i++) {
            const link = navLinks[i];
            const text = await link.textContent();
            if (text && text.toLowerCase().includes('canvas')) {
              await link.click();
              await page.waitForTimeout(2000);
              canvasFound = true;
              break;
            }
          }
          if (canvasFound) break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!canvasFound) {
      console.log('⚠️ Canvas navigation not found, trying direct navigation');
      await page.goto('http://localhost:5548/canvas');
      await page.waitForTimeout(2000);
    }

    console.log('📱 On canvas view, looking for canvas sections...');

    // Wait for canvas to be fully loaded
    await page.waitForSelector('.view-wrapper', { timeout: 5000 });

    // Try to trigger canvas section operations that would call updateSectionWithUndo
    console.log('🎯 Attempting to trigger canvas section operations...');

    // Method 1: Try to create a new section by right-clicking on canvas
    const canvasArea = page.locator('.view-wrapper').first();
    await canvasArea.click({ button: 'right', position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);

    // Look for context menu items related to sections
    const contextMenuItems = page.locator('.context-menu, [class*="context"], [role="menu"] button, .menu-item').all();
    console.log(`Found ${await contextMenuItems.length} context menu items`);

    // Click on any items that might be section-related
    for (let i = 0; i < Math.min(5, await contextMenuItems.length); i++) {
      const item = contextMenuItems[i];
      const text = await item.textContent();
      if (text && (text.toLowerCase().includes('section') || text.toLowerCase().includes('create') || text.toLowerCase().includes('add'))) {
        console.log(`Clicking context menu item: "${text}"`);
        await item.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Method 2: Try to directly trigger section operations via console
    console.log('🔧 Attempting to trigger canvas operations via console injection...');

    const errorResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          // Try to access canvas store and trigger operations
          const app = document.querySelector('#app');
          if (app && '__vue_app__' in app) {
            const vueApp = (app as any).__vue_app__;

            // Try different ways to access the store
            const possibleStoreAccessors = [
              () => vueApp.config.globalProperties.$pinia._s.get('canvas'),
              () => vueApp.config.globalProperties.$pinia?._s?.get('canvas'),
              () => window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps.find(a => a.appContext.app?.config?.globalProperties?.$pinia)?._s?.get('canvas')
            ];

            let canvasStore = null;
            for (const accessor of possibleStoreAccessors) {
              try {
                canvasStore = accessor();
                if (canvasStore) break;
              } catch (e) {
                continue;
              }
            }

            if (canvasStore && canvasStore.updateSectionWithUndo) {
              console.log('🎯 Found canvas store and updateSectionWithUndo method');

              // Try to call updateSectionWithUndo with dummy data to trigger the error
              canvasStore.updateSectionWithUndo('test-section-id', {
                name: 'Test Section Update',
                position: { x: 100, y: 100, width: 200, height: 150 }
              }).catch(error => {
                console.log('🔥 ERROR from updateSectionWithUndo:', error.message);
                resolve({ error: error.message, stack: error.stack });
              });
            } else {
              console.log('❌ Could not find canvas store or updateSectionWithUndo method');
              resolve({ error: 'Canvas store not accessible' });
            }
          } else {
            resolve({ error: 'Vue app not accessible' });
          }
        } catch (error) {
          console.log('🔥 ERROR during evaluation:', error.message);
          resolve({ error: error.message, stack: error.stack });
        }

        // Fallback timeout
        setTimeout(() => resolve({ error: 'Timeout during evaluation' }), 3000);
      });
    });

    if (errorResult && errorResult.error) {
      console.log('🎯 Successfully triggered error:', errorResult.error);
    }

    await page.waitForTimeout(2000);

    // Check for specific errors
    const updateSectionErrors = consoleErrors.filter(error =>
      error.message.includes('actions.updateSection') ||
      error.message.includes('updateSection is not a function') ||
      error.message.includes('is missing')
    );

    console.log('\n📋 UPDATESECTION ERROR REPORT:');
    console.log('===============================');

    if (updateSectionErrors.length > 0) {
      console.log(`❌ Found ${updateSectionErrors.length} updateSection-related errors:`);
      updateSectionErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
        console.log(`     Location: ${error.location}`);
      });
    } else {
      console.log('ℹ️ No updateSection errors found in this test');
    }

    // Report all errors found
    if (consoleErrors.length > 0) {
      console.log('\n📊 ALL ERRORS FOUND:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
        console.log(`     Location: ${error.location}`);
      });
    }

    // Take screenshot
    await page.screenshot({ path: 'reproduce-update-section-error.png', fullPage: true });
    console.log('📸 Screenshot saved: reproduce-update-section-error.png');
  });

  test('reproduce startTaskNowWithUndo error', async ({ page }) => {
    console.log('🚀 Testing startTaskNowWithUndo error reproduction...');

    await page.goto('http://localhost:5548');
    await page.waitForLoadState('networkidle');

    // Navigate to Board view to find tasks - use robust navigation
    console.log('🎯 Navigating to board view...');

    // Look for Board navigation link
    const navSelectors = [
      'nav',
      '[role="navigation"]',
      '.navbar',
      '.nav',
      '[class*="nav"]',
      '.content-header',
      '.view-tabs'
    ];

    let boardFound = false;
    for (const selector of navSelectors) {
      try {
        const nav = await page.locator(selector).first();
        if (await nav.isVisible()) {
          // Get all clickable elements in navigation
          const navLinks = await nav.locator('a, button, [role="button"]').all();

          // Look for Board link
          for (let i = 0; i < navLinks.length; i++) {
            const link = navLinks[i];
            const text = await link.textContent();
            if (text && text.toLowerCase().includes('board')) {
              await link.click();
              await page.waitForTimeout(2000);
              boardFound = true;
              break;
            }
          }
          if (boardFound) break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!boardFound) {
      console.log('⚠️ Board navigation not found, trying direct navigation');
      await page.goto('http://localhost:5548/');
      await page.waitForTimeout(2000);
    }

    console.log('📱 On board view, looking for tasks...');

    // Look for task cards or any task elements
    const taskElements = page.locator('.task-card, [class*="task"], .task').all();
    const taskCount = await taskElements.length;

    console.log(`Found ${taskCount} task elements`);

    if (taskCount > 0) {
      // Try to right-click on the first task to get context menu
      const firstTask = taskElements[0];
      await firstTask.click({ button: 'right' });
      await page.waitForTimeout(1000);

      // Look for context menu
      const contextMenu = page.locator('.context-menu, [class*="context"], [role="menu"]').first();
      const isMenuVisible = await contextMenu.isVisible().catch(() => false);

      if (isMenuVisible) {
        console.log('🎯 Context menu opened, looking for "Start Now" option...');

        // Look for "Start Now" or similar options in the context menu
        const startNowOptions = contextMenu.locator('button, [role="menuitem"], .menu-item').filter({ hasText: /start|now|play/i }).all();
        const startNowCount = await startNowOptions.length;

        console.log(`Found ${startNowCount} "Start Now" type options`);

        if (startNowCount > 0) {
          console.log('🎯 Clicking "Start Now" option to trigger startTaskNowWithUndo...');
          await startNowOptions.first().click();
          await page.waitForTimeout(2000);
        } else {
          console.log('⚠️ No "Start Now" options found in context menu');
        }
      } else {
        console.log('⚠️ Context menu did not appear');
      }
    }

    // Method 2: Try to trigger startTaskNowWithUndo via console
    console.log('🔧 Attempting to trigger startTaskNowWithUndo via console injection...');

    const taskErrorResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          // Try to access task store and trigger startTaskNowWithUndo
          const app = document.querySelector('#app');
          if (app && '__vue_app__' in app) {
            const vueApp = (app as any).__vue_app__;

            // Try different ways to access the task store
            const possibleStoreAccessors = [
              () => vueApp.config.globalProperties.$pinia._s.get('tasks'),
              () => vueApp.config.globalProperties.$pinia?._s?.get('tasks'),
              () => window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps.find(a => a.appContext.app?.config?.globalProperties?.$pinia)?._s?.get('tasks')
            ];

            let taskStore = null;
            for (const accessor of possibleStoreAccessors) {
              try {
                taskStore = accessor();
                if (taskStore) break;
              } catch (e) {
                continue;
              }
            }

            if (taskStore && taskStore.startTaskNowWithUndo) {
              console.log('🎯 Found task store and startTaskNowWithUndo method');

              // Create a dummy task ID to test with
              const dummyTaskId = 'test-task-id';

              // Try to call startTaskNowWithUndo to trigger the error
              taskStore.startTaskNowWithUndo(dummyTaskId).catch(error => {
                console.log('🔥 ERROR from startTaskNowWithUndo:', error.message);
                resolve({ error: error.message, stack: error.stack });
              });
            } else {
              console.log('❌ Could not find task store or startTaskNowWithUndo method');
              resolve({ error: 'Task store not accessible' });
            }
          } else {
            resolve({ error: 'Vue app not accessible' });
          }
        } catch (error) {
          console.log('🔥 ERROR during evaluation:', error.message);
          resolve({ error: error.message, stack: error.stack });
        }

        // Fallback timeout
        setTimeout(() => resolve({ error: 'Timeout during evaluation' }), 3000);
      });
    });

    if (taskErrorResult && taskErrorResult.error) {
      console.log('🎯 Successfully triggered task error:', taskErrorResult.error);
    }

    await page.waitForTimeout(2000);

    // Check for specific errors
    const startTaskNowErrors = consoleErrors.filter(error =>
      error.message.includes('startTaskNowWithUndo') ||
      error.message.includes('startTaskNow is not a function') ||
      error.message.includes('actions.startTaskNow')
    );

    console.log('\n📋 STARTTASKNOW ERROR REPORT:');
    console.log('==============================');

    if (startTaskNowErrors.length > 0) {
      console.log(`❌ Found ${startTaskNowErrors.length} startTaskNowWithUndo-related errors:`);
      startTaskNowErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
        console.log(`     Location: ${error.location}`);
      });
    } else {
      console.log('ℹ️ No startTaskNowWithUndo errors found in this test');
    }

    // Report all errors found
    if (consoleErrors.length > 0) {
      console.log('\n📊 ALL ERRORS FOUND:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
        console.log(`     Location: ${error.location}`);
      });
    }

    // Take screenshot
    await page.screenshot({ path: 'reproduce-start-task-now-error.png', fullPage: true });
    console.log('📸 Screenshot saved: reproduce-start-task-now-error.png');
  });
});