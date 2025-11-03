import { test, expect } from '@playwright/test';

test.describe('Debug Undo/Redo Errors - Console Monitoring', () => {
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

  test('comprehensive undo/redo functionality test with console monitoring', async ({ page }) => {
    console.log('🚀 Starting comprehensive undo/redo debug test...');

    // Navigate to the app (using current server port)
    await page.goto('http://localhost:5548');
    await page.waitForLoadState('networkidle');

    // Wait for the app to load - look for the app div
    await page.waitForSelector('.app', { timeout: 10000 });

    console.log('📱 App loaded, checking initial console errors...');

    // Report any initial errors
    if (consoleErrors.length > 0) {
      console.log('❌ Initial console errors found:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message} at ${error.location}`);
      });
    } else {
      console.log('✅ No initial console errors');
    }

    // Navigate to Canvas view - use a more robust approach
    console.log('🎯 Navigating to Canvas view...');

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
          console.log(`Found navigation with selector: ${selector}`);

          // Get all clickable elements in navigation
          const navLinks = await nav.locator('a, button, [role="button"]').all();
          console.log(`Found ${navLinks.length} navigation elements`);

          // Look for Canvas link
          for (let i = 0; i < navLinks.length; i++) {
            const link = navLinks[i];
            const text = await link.textContent();
            console.log(`Navigation element ${i}: "${text}"`);

            if (text && text.toLowerCase().includes('canvas')) {
              console.log(`🎯 Found Canvas link: "${text}"`);
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

    await page.waitForSelector('.view-wrapper', { timeout: 5000 });

    // Wait for canvas to initialize
    await page.waitForTimeout(2000);

    // Test 1: Try dragging canvas nodes
    console.log('🖱️ Testing canvas node dragging...');
    const canvasNodes = await page.locator('.task-node').all();

    if (canvasNodes.length > 0) {
      const firstNode = canvasNodes[0];

      // Get initial position
      const initialBox = await firstNode.boundingBox();
      if (initialBox) {
        console.log(`📍 Initial node position: ${initialBox.x}, ${initialBox.y}`);

        // Try to drag the node
        await firstNode.hover();
        await page.mouse.down();
        await page.mouse.move(initialBox.x + 100, initialBox.y + 50);
        await page.mouse.up();

        // Check for errors after drag
        await page.waitForTimeout(500);
        console.log('✅ Drag operation completed');
      }
    } else {
      console.log('⚠️ No canvas nodes found to drag');
    }

    // Test 2: Try right-clicking on canvas elements
    console.log('🖱️ Testing right-click context menus...');
    if (canvasNodes.length > 0) {
      await canvasNodes[0].click({ button: 'right' });
      await page.waitForTimeout(500);

      // Check if context menu appears (looking for any element that might be a context menu)
      const contextMenu = page.locator('.context-menu, [class*="context"], [role="menu"]').first();
      const isMenuVisible = await contextMenu.isVisible().catch(() => false);

      if (isMenuVisible) {
        console.log('✅ Context menu appeared');
        // Close the menu by clicking elsewhere
        await page.click('body', { position: { x: 100, y: 100 } });
      } else {
        console.log('⚠️ Context menu did not appear');
      }
    }

    // Test 3: Test keyboard shortcuts (Ctrl+Z, Ctrl+Y)
    console.log('⌨️ Testing undo/redo keyboard shortcuts...');

    // Try Ctrl+Z (undo)
    await page.keyboard.press('Control+KeyZ');
    await page.waitForTimeout(500);
    console.log('✅ Ctrl+Z pressed');

    // Try Ctrl+Y (redo)
    await page.keyboard.press('Control+KeyY');
    await page.waitForTimeout(500);
    console.log('✅ Ctrl+Y pressed');

    // Test 4: Look for and test "Start Now" functionality
    console.log('🚀 Testing "Start Now" functionality...');

    // Check both canvas and sidebar for "Start Now" buttons and task-related buttons
    const startNowButtons = page.locator('button:has-text("Start Now"), button:has-text("Start"), button:has-text("Play")');
    const buttonCount = await startNowButtons.count();

    if (buttonCount > 0) {
      console.log(`🎯 Found ${buttonCount} "Start Now" buttons`);

      // Click the first one
      await startNowButtons.first().click();
      await page.waitForTimeout(1000);
      console.log('✅ "Start Now" button clicked');
    } else {
      console.log('⚠️ No "Start Now" buttons found');

      // Try to find any task-related buttons
      const taskButtons = page.locator('[data-testid*="task"], button:has-text("Start"), button:has-text("Play")');
      const taskButtonCount = await taskButtons.count();

      if (taskButtonCount > 0) {
        console.log(`🎯 Found ${taskButtonCount} task-related buttons`);
        await taskButtons.first().click();
        await page.waitForTimeout(1000);
        console.log('✅ Task button clicked');
      }
    }

    // Test 5: Try creating a new task from canvas
    console.log('➕ Testing task creation...');

    // Try double-clicking on empty canvas space
    const canvasArea = page.locator('.view-wrapper, .canvas-container');
    await canvasArea.dblclick({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);

    // Check if any modal or form appeared
    const modalVisible = await page.locator('.modal, [role="dialog"], .popup').isVisible().catch(() => false);
    if (modalVisible) {
      console.log('✅ Task creation modal appeared');
      // Close it
      await page.keyboard.press('Escape');
    } else {
      console.log('⚠️ No task creation modal appeared');
    }

    // Test 6: Test resizing functionality
    console.log('📏 Testing resize functionality...');

    // Look for resize handles
    const resizeHandles = page.locator('.resize-handle, [class*="resize"], .handle');
    const handleCount = await resizeHandles.count();

    if (handleCount > 0) {
      console.log(`🎯 Found ${handleCount} resize handles`);
      await resizeHandles.first().hover();
      await page.waitForTimeout(500);
      console.log('✅ Resize handle interaction tested');
    } else {
      console.log('⚠️ No resize handles found');
    }

    // Final error report
    console.log('\n📋 FINAL ERROR REPORT:');
    console.log('========================');

    if (consoleErrors.length > 0) {
      console.log(`❌ Found ${consoleErrors.length} console errors/warnings:`);

      const specificErrors = consoleErrors.filter(error =>
        error.message.includes('actions.updateSection') ||
        error.message.includes('startTaskNowWithUndo') ||
        error.message.includes('undo') ||
        error.message.includes('redo') ||
        error.message.includes('function') ||
        error.message.includes('undefined')
      );

      if (specificErrors.length > 0) {
        console.log('\n🎯 SPECIFIC UNDO/REDO ERRORS:');
        specificErrors.forEach((error, index) => {
          console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
          console.log(`     Location: ${error.location}`);
        });
      }

      console.log('\n📊 ALL ERRORS:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
        console.log(`     Location: ${error.location}`);
      });

      // Fail the test if we found critical errors
      const criticalErrors = consoleErrors.filter(error =>
        error.type === 'error' &&
        (error.message.includes('actions.updateSection') ||
         error.message.includes('startTaskNowWithUndo') ||
         error.message.includes('is not a function'))
      );

      if (criticalErrors.length > 0) {
        console.log(`\n💥 CRITICAL ERRORS FOUND: ${criticalErrors.length}`);
        expect(criticalErrors.length).toBe(0);
      }

    } else {
      console.log('✅ No console errors found during testing');
    }

    // Take a screenshot for visual reference
    await page.screenshot({ path: 'debug-undo-redo-final-state.png', fullPage: true });
    console.log('📸 Final state screenshot saved');
  });

  test('check canvas store actions are available', async ({ page }) => {
    console.log('🔍 Checking if canvas store actions are properly defined...');

    await page.goto('http://localhost:5548');
    await page.waitForLoadState('networkidle');

    // Navigate to canvas - use a more robust approach
    console.log('🔍 Looking for Canvas navigation...');

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
          console.log(`Found navigation with selector: ${selector}`);

          // Get all clickable elements in navigation
          const navLinks = await nav.locator('a, button, [role="button"]').all();
          console.log(`Found ${navLinks.length} navigation elements`);

          // Look for Canvas link
          for (let i = 0; i < navLinks.length; i++) {
            const link = navLinks[i];
            const text = await link.textContent();
            console.log(`Navigation element ${i}: "${text}"`);

            if (text && text.toLowerCase().includes('canvas')) {
              console.log(`🎯 Found Canvas link: "${text}"`);
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

    await page.waitForSelector('.view-wrapper', { timeout: 5000 });

    // Inject script to check store actions
    const storeCheck = await page.evaluate(() => {
      try {
        // Try to access the store through Vue devtools or window
        const app = document.querySelector('#app');
        if (app && '__vue_app__' in app) {
          const vueApp = (app as any).__vue_app__;
          const store = vueApp.config.globalProperties.$pinia?._s.get('canvas');

          if (store) {
            return {
              hasStore: true,
              actions: Object.keys(store._actions || {}),
              hasUpdateSection: typeof store.updateSection === 'function',
              hasStartTaskNowWithUndo: typeof store.startTaskNowWithUndo === 'function'
            };
          }
        }

        return { hasStore: false, error: 'Store not accessible' };
      } catch (error) {
        return { hasStore: false, error: error.message };
      }
    });

    console.log('📊 Store check results:', storeCheck);

    if (storeCheck.hasStore) {
      console.log('✅ Canvas store found');
      console.log('📋 Available actions:', storeCheck.actions);
      console.log(`🔧 updateSection function: ${storeCheck.hasUpdateSection}`);
      console.log(`🔧 startTaskNowWithUndo function: ${storeCheck.hasStartTaskNowWithUndo}`);
    } else {
      console.log('❌ Canvas store not accessible:', storeCheck.error);
    }

    expect(storeCheck.hasStore).toBe(true);
  });
});