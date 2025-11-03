import { test, expect } from '@playwright/test';

test.describe('Canvas Resize Debug Test', () => {
  test('should trigger updateSectionWithUndo debug logs', async ({ page }) => {
    // Navigate to the app (using actual port 5546)
    await page.goto('http://localhost:5546');

    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Set up console logging to capture debug messages
    const debugLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🔧 DEBUG:')) {
        debugLogs.push(text);
        console.log(`🔧 CAPTURED: ${text}`);
      }
    });

    // Wait for initial app rendering
    await page.waitForTimeout(2000);

    // Look for navigation elements to reach canvas view
    console.log('🔍 Looking for Canvas navigation...');

    // Try different selectors to find canvas navigation
    const canvasSelectors = [
      'button:has-text("Canvas")',
      'a:has-text("Canvas")',
      '[data-testid="canvas-tab"]',
      '[data-testid="canvas-view"]',
      'button[title*="Canvas"]',
      'a[href*="canvas"]',
      '.nav-canvas',
      '#canvas-nav'
    ];

    let canvasButton = null;
    for (const selector of canvasSelectors) {
      try {
        canvasButton = await page.locator(selector).first();
        if (await canvasButton.isVisible()) {
          console.log(`✅ Found canvas button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!canvasButton) {
      // Try to find any button that might lead to canvas
      const allButtons = await page.locator('button').all();
      for (const button of allButtons) {
        const text = await button.textContent();
        if (text && (text.toLowerCase().includes('canvas') || text.toLowerCase().includes('view'))) {
          canvasButton = button;
          console.log(`✅ Found potential canvas button: "${text}"`);
          break;
        }
      }
    }

    if (canvasButton) {
      await canvasButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ Canvas button not found, checking if we\'re already on canvas view...');
    }

    // Look for canvas elements
    console.log('🔍 Looking for canvas elements...');

    const canvasSelectors2 = [
      '.canvas-container',
      '[data-testid="canvas"]',
      '#canvas',
      '.vue-flow',
      '.react-flow',
      'canvas'
    ];

    let canvasElement = null;
    for (const selector of canvasSelectors2) {
      try {
        canvasElement = await page.locator(selector).first();
        if (await canvasElement.isVisible()) {
          console.log(`✅ Found canvas element with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!canvasElement) {
      // Try to find section elements that might be on canvas
      const sectionElements = await page.locator('[data-testid*="section"], .section, .task-node').all();
      if (sectionElements.length > 0) {
        console.log(`✅ Found ${sectionElements.length} section-like elements`);
        canvasElement = sectionElements[0];
      }
    }

    if (!canvasElement) {
      console.log('❌ No canvas elements found. Taking screenshot for debugging...');
      await page.screenshot({ path: 'canvas-not-found.png', fullPage: true });

      // Print page content for debugging
      const pageText = await page.textContent('body');
      console.log('Page content preview:', pageText?.substring(0, 500));

      throw new Error('Canvas elements not found - unable to test resize functionality');
    }

    // Look for resize handles
    console.log('🔍 Looking for resize handles...');

    const resizeHandleSelectors = [
      '.resize-handle',
      '.resize-handle-top',
      '.resize-handle-bottom',
      '.resize-handle-left',
      '.resize-handle-right',
      '.resize-handle-corner',
      '[data-testid*="resize"]',
      '.vue-flow__resize-handle',
      '.node-resizer'
    ];

    let resizeHandles = [];
    for (const selector of resizeHandleSelectors) {
      try {
        const handles = await page.locator(selector).all();
        if (handles.length > 0) {
          console.log(`✅ Found ${handles.length} resize handles with selector: ${selector}`);
          resizeHandles = handles;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (resizeHandles.length === 0) {
      // Look for elements that might be resizable (corners/edges of sections)
      const allElements = await page.locator('*').all();
      for (const element of allElements.slice(0, 100)) { // Check first 100 elements
        const styles = await element.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            cursor: computed.cursor,
            position: computed.position,
            zIndex: computed.zIndex
          };
        });

        if (styles.cursor && (styles.cursor.includes('resize') || styles.cursor.includes('ew-resize') || styles.cursor.includes('ns-resize'))) {
          resizeHandles.push(element);
          console.log(`✅ Found resizable element with cursor: ${styles.cursor}`);
        }
      }
    }

    if (resizeHandles.length === 0) {
      console.log('⚠️ No resize handles found. Trying to interact with section elements directly...');

      // Try to find and interact with section nodes directly
      const sectionNodes = await page.locator('.task-node, [data-testid*="node"], [data-testid*="section"]').all();
      if (sectionNodes.length > 0) {
        const firstNode = sectionNodes[0];

        // Try hovering and looking for resize handles that appear on hover
        await firstNode.hover();
        await page.waitForTimeout(1000);

        // Check again for resize handles
        for (const selector of resizeHandleSelectors) {
          try {
            const handles = await page.locator(selector).all();
            if (handles.length > 0) {
              console.log(`✅ Found ${handles.length} resize handles after hover with selector: ${selector}`);
              resizeHandles = handles;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        if (resizeHandles.length > 0) {
          // Try to drag the first resize handle
          const handle = resizeHandles[0];
          const box = await handle.boundingBox();

          if (box) {
            console.log(`🎯 Attempting to drag resize handle at position: ${box.x}, ${box.y}`);

            // Start drag
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(100);

            // Move to resize
            await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
            await page.waitForTimeout(100);

            // End drag
            await page.mouse.up();
            await page.waitForTimeout(2000);
          }
        }
      }
    } else {
      // Try to interact with found resize handles
      const handle = resizeHandles[0];
      const box = await handle.boundingBox();

      if (box) {
        console.log(`🎯 Found resize handle at position: ${box.x}, ${box.y}, size: ${box.width}x${box.height}`);

        // Drag the resize handle
        await handle.hover();
        await page.waitForTimeout(500);

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);

        // Drag to resize
        await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);
        await page.waitForTimeout(100);

        await page.mouse.up();
        await page.waitForTimeout(2000);
      }
    }

    // Check if any debug logs were captured
    console.log(`\n📊 Debug Log Summary:`);
    console.log(`Total debug logs captured: ${debugLogs.length}`);

    if (debugLogs.length > 0) {
      console.log('\n🔧 Debug Logs Found:');
      debugLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log}`);
      });

      // Take screenshot for visual confirmation
      await page.screenshot({ path: 'canvas-resize-test.png', fullPage: true });

    } else {
      console.log('\n❌ No debug logs captured. The updateSectionWithUndo function may not have been triggered.');

      // Try alternative approach - create a new section
      console.log('\n🔄 Trying alternative approach - looking for "Add Section" button...');

      const addSectionSelectors = [
        'button:has-text("Add Section")',
        'button:has-text("Add")',
        '[data-testid*="add-section"]',
        '.add-section-btn',
        '#add-section'
      ];

      for (const selector of addSectionSelectors) {
        try {
          const addBtn = await page.locator(selector).first();
          if (await addBtn.isVisible()) {
            console.log(`✅ Found add section button: ${selector}`);
            await addBtn.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      // Take final screenshot
      await page.screenshot({ path: 'canvas-final-state.png', fullPage: true });
    }

    // Report results
    expect(debugLogs.length, `Expected to find debug logs from updateSectionWithUndo function`).toBeGreaterThan(0);

    // Log specific debug messages we were looking for
    const expectedMessages = [
      '🔧 DEBUG: updateSectionWithUndo called',
      '🔧 DEBUG: Section data before update',
      '🔧 DEBUG: Undoable action created',
      '🔧 DEBUG: Section update completed'
    ];

    console.log('\n🎯 Expected Debug Messages Check:');
    expectedMessages.forEach(msg => {
      const found = debugLogs.some(log => log.includes(msg));
      console.log(`${found ? '✅' : '❌'} ${msg}`);
    });
  });
});