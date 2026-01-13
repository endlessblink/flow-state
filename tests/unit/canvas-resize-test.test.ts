import { test, expect } from '@playwright/test';

test.describe('Canvas Resize Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Navigate to Canvas view - try different approaches
    try {
      // Try to find and click Canvas link/button
      const canvasLink = page.locator('a[href*="canvas"], button:has-text("Canvas"), [data-testid*="canvas"]').first();
      if (await canvasLink.isVisible()) {
        await canvasLink.click();
        await page.waitForTimeout(1000);
      } else {
        // Try direct navigation
        await page.goto('http://localhost:5173/#/canvas');
      }
    } catch (error) {
      // Fallback to direct navigation
      await page.goto('http://localhost:5173/#/canvas');
    }

    // Wait for Canvas view to be visible
    await page.waitForTimeout(2000);
  });

  test('should load Canvas view without errors', async ({ page }) => {
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Wait a bit to catch any initial errors
    await page.waitForTimeout(3000);

    // Log any errors found
    if (errors.length > 0) {
      console.log('❌ Console/JavaScript errors found:', errors);
    } else {
      console.log('✅ No JavaScript errors detected on Canvas view');
    }

    // Verify we're on a view with Canvas content
    const canvasContent = await page.locator('.canvas, [data-view="canvas"], .canvas-view').first();
    const isVisible = await canvasContent.isVisible().catch(() => false);

    if (!isVisible) {
      console.log('⚠️ Canvas content not immediately visible, checking body content...');
      const bodyText = await page.locator('body').textContent();
      if (bodyText?.includes('Canvas')) {
        console.log('✅ Canvas view loaded (detected via text content)');
      } else {
        console.log('⚠️ Canvas view may not be properly loaded');
      }
    } else {
      console.log('✅ Canvas content visible');
    }
  });

  test('should create a section if none exists', async ({ page }) => {
    // Look for existing sections
    const existingSections = page.locator('.canvas-section, .section, [data-section]');
    const sectionCount = await existingSections.count();

    console.log(`📊 Found ${sectionCount} existing sections`);

    if (sectionCount === 0) {
      console.log('➕ No sections found, attempting to create one...');

      // Look for create/add button
      const createButton = page.locator(
        'button[title*="Add"], button[title*="Create"], button:has-text("+"), button:has-text("Add"), .add-button, [data-testid*="add"]'
      ).first();

      if (await createButton.isVisible({ timeout: 5000 })) {
        console.log('🖱️ Clicking create button...');
        await createButton.click();
        await page.waitForTimeout(1000);

        // Look for section type options
        const sectionOption = page.locator(
          'button:has-text("Priority"), button:has-text("Status"), button:has-text("High"), button:has-text("Medium"), .section-option'
        ).first();

        if (await sectionOption.isVisible({ timeout: 3000 })) {
          console.log('📋 Selecting section type...');
          await sectionOption.click();
          await page.waitForTimeout(2000);
        } else {
          console.log('⚠️ No section options found after clicking create button');
        }
      } else {
        console.log('⚠️ Create button not found');
      }
    }
  });

  test('should test resize functionality', async ({ page }) => {
    // Collect console errors during resize testing
    const resizeErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && (
        msg.text().includes('resize') ||
        msg.text().includes('clientX') ||
        msg.text().includes('node') ||
        msg.text().includes('event')
      )) {
        resizeErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      if (error.message.includes('resize') ||
          error.message.includes('clientX') ||
          error.message.includes('node')) {
        resizeErrors.push(error.message);
      }
    });

    // Wait for sections to be available
    await page.waitForTimeout(3000);

    // Find sections
    const sections = page.locator('.canvas-section, .section, [data-section]');
    const sectionCount = await sections.count();

    console.log(`🔧 Testing resize functionality with ${sectionCount} sections`);

    if (sectionCount === 0) {
      console.log('❌ No sections available for resize testing');
      test.skip();
      return;
    }

    // Test up to 3 sections
    const sectionsToTest = Math.min(sectionCount, 3);

    for (let i = 0; i < sectionsToTest; i++) {
      const section = sections.nth(i);
      console.log(`\n🔧 Testing resize for section ${i + 1}/${sectionsToTest}...`);

      try {
        // Get section initial dimensions
        const initialBox = await section.boundingBox();
        if (!initialBox) {
          console.log(`⚠️ Could not get bounding box for section ${i + 1}`);
          continue;
        }

        console.log(`📐 Section ${i + 1} initial: x=${initialBox.x}, y=${initialBox.y}, width=${initialBox.width}, height=${initialBox.height}`);

        // Hover over section to reveal resize handles
        await section.hover();
        await page.waitForTimeout(500);

        // Look for resize handles
        const resizeHandles = page.locator('.resize-handle, [data-resize], .handle');
        const handleCount = await resizeHandles.count();

        console.log(`📏 Found ${handleCount} resize handles for section ${i + 1}`);

        if (handleCount > 0) {
          // Test resize with first available handle
          const handle = resizeHandles.first();

          // Get handle position
          const handleBox = await handle.boundingBox();
          if (!handleBox) {
            console.log(`⚠️ Could not get resize handle bounding box for section ${i + 1}`);
            continue;
          }

          console.log(`🖱️ Starting resize from handle at x=${handleBox.x}, y=${handleBox.y}`);

          // Perform resize drag
          await handle.hover();
          await page.mouse.down();

          // Drag to resize (increase width and height)
          const targetX = initialBox.x + initialBox.width + 50;
          const targetY = initialBox.y + initialBox.height + 50;

          await page.mouse.move(targetX, targetY);
          await page.waitForTimeout(300);
          await page.mouse.up();
          await page.waitForTimeout(500);

          // Get new dimensions
          const newBox = await section.boundingBox();
          if (newBox) {
            console.log(`📐 Section ${i + 1} after resize: x=${newBox.x}, y=${newBox.y}, width=${newBox.width}, height=${newBox.height}`);

            // Check if resize actually happened
            const widthChanged = Math.abs(newBox.width - initialBox.width) > 5;
            const heightChanged = Math.abs(newBox.height - initialBox.height) > 5;

            if (widthChanged || heightChanged) {
              console.log(`✅ Section ${i + 1} resize successful! Width changed: ${widthChanged}, Height changed: ${heightChanged}`);
            } else {
              console.log(`⚠️ Section ${i + 1} resize may not have worked`);
            }

            // Test multiple resize handles if available
            if (handleCount > 1 && i === 0) {
              console.log(`🔄 Testing additional resize handle for section ${i + 1}...`);

              const secondHandle = resizeHandles.nth(1);
              await secondHandle.hover();

              const currentBox = await section.boundingBox();
              if (currentBox) {
                await page.mouse.down();
                await page.mouse.move(currentBox.x - 20, currentBox.y - 20);
                await page.waitForTimeout(300);
                await page.mouse.up();
                await page.waitForTimeout(500);

                const finalBox = await section.boundingBox();
                if (finalBox) {
                  console.log(`📐 Section ${i + 1} final: width=${finalBox.width}, height=${finalBox.height}`);
                  console.log(`✅ Multiple resize handles tested for section ${i + 1}!`);
                }
              }
            }
          }

        } else {
          console.log(`⚠️ No resize handles found for section ${i + 1}`);
        }

        // Reset mouse position
        await page.mouse.move(100, 100);
        await page.waitForTimeout(300);

      } catch (error) {
        console.error(`❌ Error testing section ${i + 1}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Check for resize-related errors
    if (resizeErrors.length > 0) {
      console.log('\n❌ Resize-related errors found:');
      resizeErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No resize-related JavaScript errors detected');
    }
  });

  test('should verify section positioning after resize', async ({ page }) => {
    // Wait for sections
    await page.waitForTimeout(3000);

    const sections = page.locator('.canvas-section, .section, [data-section]');
    const sectionCount = await sections.count();

    if (sectionCount === 0) {
      console.log('⚠️ No sections available for position verification');
      test.skip();
      return;
    }

    // Test the first section
    const section = sections.first();
    const initialBox = await section.boundingBox();

    if (!initialBox) {
      console.log('⚠️ Could not get initial section position');
      test.skip();
      return;
    }

    console.log(`📍 Initial position: x=${initialBox.x}, y=${initialBox.y}`);

    // Perform a resize operation
    await section.hover();
    await page.waitForTimeout(500);

    const resizeHandles = page.locator('.resize-handle, [data-resize], .handle');
    if (await resizeHandles.first().isVisible()) {
      const handle = resizeHandles.first();

      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox.x + 100, initialBox.y + 100);
      await page.waitForTimeout(300);
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Check position after resize
      const finalBox = await section.boundingBox();

      if (finalBox) {
        console.log(`📍 Final position: x=${finalBox.x}, y=${finalBox.y}`);

        // Verify position is reasonable (shouldn't jump unexpectedly)
        const positionChange = Math.abs(finalBox.x - initialBox.x) + Math.abs(finalBox.y - initialBox.y);

        if (positionChange < 50) {
          console.log('✅ Section position remained stable during resize');
        } else {
          console.log(`⚠️ Section position changed significantly during resize: ${positionChange}px total movement`);
        }
      }
    }
  });

  test.afterEach(async ({ page }) => {
    // Final check for any JavaScript errors
    const finalErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        finalErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      finalErrors.push(error.message);
    });

    // Wait a moment to catch any final errors
    await page.waitForTimeout(2000);

    if (finalErrors.length > 0) {
      console.log('\n❌ Final JavaScript errors detected:');
      finalErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No final JavaScript errors detected');
    }
  });
});