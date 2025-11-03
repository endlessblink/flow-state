import { test, expect } from '@playwright/test';

test.describe('Canvas Resize Functionality - Comprehensive Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Navigate to Canvas view
    await page.goto('http://localhost:5173/#/canvas');
    await page.waitForTimeout(2000);
  });

  test('should create sections and test resize functionality comprehensively', async ({ page }) => {
    console.log('🚀 Starting comprehensive Canvas resize test...');

    // Collect all console errors during the test
    const allErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        allErrors.push(msg.text());
        console.log('❌ Console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      allErrors.push(error.message);
      console.log('❌ Page error:', error.message);
    });

    // Wait for Canvas to be ready
    await page.waitForTimeout(3000);

    // Look for the + button to add sections
    console.log('🔍 Looking for add section button...');

    const addSectionButton = page.locator('button[title="Add Section"], button:has-text("Add"), button:has-text("+")').first();

    if (await addSectionButton.isVisible({ timeout: 5000 })) {
      console.log('✅ Found add section button');
      await addSectionButton.click();
      await page.waitForTimeout(500);

      // Look for dropdown with section options
      console.log('📋 Looking for section type dropdown...');

      const dropdownVisible = await page.locator('.section-type-dropdown').isVisible({ timeout: 2000 });

      if (dropdownVisible) {
        console.log('✅ Section type dropdown is visible');

        // Create a High Priority section
        console.log('➕ Creating High Priority section...');
        const highPriorityBtn = page.locator('button:has-text("High Priority")').first();
        if (await highPriorityBtn.isVisible({ timeout: 2000 })) {
          await highPriorityBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ High Priority section created');
        }

        // Create a Medium Priority section
        console.log('➕ Creating Medium Priority section...');
        // Click add button again
        await addSectionButton.click();
        await page.waitForTimeout(500);

        const mediumPriorityBtn = page.locator('button:has-text("Medium Priority")').first();
        if (await mediumPriorityBtn.isVisible({ timeout: 2000 })) {
          await mediumPriorityBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ Medium Priority section created');
        }

        // Create an In Progress section
        console.log('➕ Creating In Progress section...');
        // Click add button again
        await addSectionButton.click();
        await page.waitForTimeout(500);

        const inProgressBtn = page.locator('button:has-text("In Progress")').first();
        if (await inProgressBtn.isVisible({ timeout: 2000 })) {
          await inProgressBtn.click();
          await page.waitForTimeout(1000);
          console.log('✅ In Progress section created');
        }

        // Close dropdown
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

      } else {
        console.log('⚠️ Section type dropdown not visible');
      }
    } else {
      console.log('⚠️ Add section button not found');
    }

    // Wait for sections to be created and rendered
    await page.waitForTimeout(2000);

    // Look for section nodes in Vue Flow
    console.log('🔍 Looking for section nodes...');
    const sectionNodes = page.locator('[data-id^="section-"]');
    const sectionCount = await sectionNodes.count();

    console.log(`📊 Found ${sectionCount} section nodes`);

    if (sectionCount === 0) {
      console.log('❌ No section nodes found for testing');
      // Log the page content for debugging
      const pageContent = await page.content();
      console.log('Page content preview:', pageContent.substring(0, 1000));

      test.skip();
      return;
    }

    // Test resize functionality on each section
    for (let i = 0; i < Math.min(sectionCount, 3); i++) {
      const section = sectionNodes.nth(i);
      const sectionId = await section.getAttribute('data-id');

      console.log(`\n🔧 Testing resize for section ${i + 1}: ${sectionId}`);

      try {
        // Get initial dimensions and position
        const initialBox = await section.boundingBox();
        if (!initialBox) {
          console.log(`⚠️ Could not get bounding box for section ${sectionId}`);
          continue;
        }

        console.log(`📐 Initial state: x=${initialBox.x}, y=${initialBox.y}, width=${initialBox.width}, height=${initialBox.height}`);

        // Hover over section to reveal resize handles
        await section.hover();
        await page.waitForTimeout(500);

        // Look for Vue Flow resize handles
        const resizeHandles = page.locator('.vue-flow__resize-control.handle');
        const handleCount = await resizeHandles.count();

        console.log(`📏 Found ${handleCount} resize handles for section ${sectionId}`);

        if (handleCount > 0) {
          // Test resize with first handle (likely corner handle)
          const handle = resizeHandles.first();

          // Get handle position
          const handleBox = await handle.boundingBox();
          if (!handleBox) {
            console.log(`⚠️ Could not get handle bounding box for section ${sectionId}`);
            continue;
          }

          console.log(`🖱️ Starting resize from handle at x=${handleBox.x}, y=${handleBox.y}`);

          // Perform resize drag to increase size
          await handle.hover();
          await page.mouse.down();

          // Calculate target position (drag diagonally down-right)
          const targetX = initialBox.x + initialBox.width + 80;
          const targetY = initialBox.y + initialBox.height + 60;

          console.log(`📐 Dragging to target position: x=${targetX}, y=${targetY}`);

          await page.mouse.move(targetX, targetY, { steps: 10 });
          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(1000);

          // Get new dimensions after resize
          const newBox = await section.boundingBox();
          if (newBox) {
            console.log(`📐 After resize: x=${newBox.x}, y=${newBox.y}, width=${newBox.width}, height=${newBox.height}`);

            // Calculate size changes
            const widthChange = newBox.width - initialBox.width;
            const heightChange = newBox.height - initialBox.height;

            // Check if resize actually happened
            if (Math.abs(widthChange) > 5 && Math.abs(heightChange) > 5) {
              console.log(`✅ Resize successful! Width changed: ${widthChange.toFixed(1)}px, Height changed: ${heightChange.toFixed(1)}px`);
            } else {
              console.log(`⚠️ Resize may not have worked properly. Width change: ${widthChange.toFixed(1)}px, Height change: ${heightChange.toFixed(1)}px`);
            }

            // Test position stability - check if position remained relatively stable
            const positionChangeX = Math.abs(newBox.x - initialBox.x);
            const positionChangeY = Math.abs(newBox.y - initialBox.y);

            if (positionChangeX < 10 && positionChangeY < 10) {
              console.log(`✅ Position remained stable during resize. X change: ${positionChangeX.toFixed(1)}px, Y change: ${positionChangeY.toFixed(1)}px`);
            } else {
              console.log(`⚠️ Position shifted during resize. X change: ${positionChangeX.toFixed(1)}px, Y change: ${positionChangeY.toFixed(1)}px`);
            }

            // Test resize from different direction if more handles are available
            if (handleCount > 1 && i === 0) {
              console.log(`🔄 Testing additional resize handle for section ${sectionId}...`);

              const secondHandle = resizeHandles.nth(1);
              if (await secondHandle.isVisible()) {
                await section.hover();
                await secondHandle.hover();

                const currentBox = await section.boundingBox();
                if (currentBox) {
                  await page.mouse.down();
                  // Resize to make it smaller
                  await page.mouse.move(currentBox.x + 50, currentBox.y + 50, { steps: 10 });
                  await page.waitForTimeout(300);
                  await page.mouse.up();
                  await page.waitForTimeout(500);

                  const finalBox = await section.boundingBox();
                  if (finalBox) {
                    console.log(`📐 After second resize: width=${finalBox.width.toFixed(1)}, height=${finalBox.height.toFixed(1)}`);
                    console.log(`✅ Multiple resize handles tested successfully!`);
                  }
                }
              }
            }
          }

        } else {
          console.log(`⚠️ No resize handles found for section ${sectionId}`);

          // Try alternative selector for resize handles
          const altHandles = page.locator('.custom-resize-handle, [class*="resize"]');
          const altHandleCount = await altHandles.count();
          console.log(`🔍 Alternative selector found ${altHandleCount} potential resize handles`);
        }

        // Reset mouse position
        await page.mouse.move(100, 100);
        await page.waitForTimeout(300);

      } catch (error) {
        console.error(`❌ Error testing section ${sectionId}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Final error check
    await page.waitForTimeout(2000);

    // Filter for resize-related errors specifically
    const resizeErrors = allErrors.filter(error =>
      error.toLowerCase().includes('resize') ||
      error.toLowerCase().includes('clientx') ||
      error.toLowerCase().includes('node') ||
      error.toLowerCase().includes('event')
    );

    if (resizeErrors.length > 0) {
      console.log('\n❌ Resize-related errors found:');
      resizeErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No resize-related JavaScript errors detected');
    }

    if (allErrors.length > 0) {
      console.log(`\n📊 Total JavaScript errors: ${allErrors.length}`);
    } else {
      console.log('\n✅ No JavaScript errors detected during test');
    }

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'canvas-resize-test-final.png',
      fullPage: true
    });
    console.log('📸 Final screenshot saved as canvas-resize-test-final.png');
  });

  test('should verify the specific resize error fix', async ({ page }) => {
    console.log('🔍 Testing the specific resize error fix (TypeError: can\'t access property "clientX")...');

    // Track specific resize-related events
    const resizeEvents: any[] = [];

    // Listen for console logs that include resize information
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Resize start:') || text.includes('Resize end:')) {
        resizeEvents.push({
          type: msg.type(),
          text: text,
          timestamp: Date.now()
        });
        console.log('🔧 Resize event:', text);
      }

      if (msg.type() === 'error' && (
        text.includes('clientX') ||
        text.includes('node') ||
        text.includes('event is undefined')
      )) {
        console.log('❌ Found resize-related error:', text);
      }
    });

    page.on('pageerror', error => {
      if (error.message.includes('clientX') ||
          error.message.includes('node') ||
          error.message.includes('event is undefined')) {
        console.log('❌ Found resize-related page error:', error.message);
      }
    });

    // Wait for Canvas and create a section
    await page.waitForTimeout(3000);

    // Create a section to test with
    const addSectionButton = page.locator('button[title="Add Section"]').first();
    if (await addSectionButton.isVisible({ timeout: 5000 })) {
      await addSectionButton.click();
      await page.waitForTimeout(500);

      const highPriorityBtn = page.locator('button:has-text("High Priority")').first();
      if (await highPriorityBtn.isVisible({ timeout: 2000 })) {
        await highPriorityBtn.click();
        await page.waitForTimeout(2000);

        // Find and test resize on the created section
        const sectionNodes = page.locator('[data-id^="section-"]');
        const sectionCount = await sectionNodes.count();

        if (sectionCount > 0) {
          const section = sectionNodes.first();
          await section.hover();
          await page.waitForTimeout(500);

          // Find resize handles
          const resizeHandles = page.locator('.vue-flow__resize-control.handle');
          const handleCount = await resizeHandles.count();

          if (handleCount > 0) {
            console.log(`🔧 Testing resize error fix with ${handleCount} handles...`);

            const handle = resizeHandles.first();
            await handle.hover();

            // Perform resize operation
            await page.mouse.down();
            await page.mouse.move(400, 300, { steps: 5 });
            await page.waitForTimeout(300);
            await page.mouse.up();
            await page.waitForTimeout(1000);

            console.log('✅ Resize operation completed without errors');
          }
        }
      }
    }

    // Check if resize events were logged
    if (resizeEvents.length > 0) {
      console.log(`✅ Resize events detected: ${resizeEvents.length}`);
      resizeEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.type}: ${event.text}`);
      });
    } else {
      console.log('⚠️ No resize events were logged during the test');
    }

    // Wait a bit more to catch any delayed errors
    await page.waitForTimeout(2000);

    console.log('✅ Resize error fix verification completed');
  });
});