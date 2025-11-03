#!/usr/bin/env node

// Simple test to check if canvas and calendar views load without errors
import { chromium } from 'playwright';

(async () => {
  console.log('🔍 Testing Canvas and Calendar Views Loading...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Browser Console Error:', msg.text());
      } else if (msg.text().includes('⚠️') || msg.text().includes('❌') || msg.text().includes('✅')) {
        console.log('📝 Browser Console:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('🔴 Page Error:', error.message);
    });

    console.log('🌐 Navigating to application...');
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });

    // Wait for app to load
    try {
      await page.waitForSelector('.main-app', { timeout: 10000 });
    } catch {
      await page.waitForSelector('div', { timeout: 10000 });
    }
    console.log('✅ Application loaded successfully');

    // Test Canvas View
    console.log('🎨 Testing Canvas View...');
    try {
      // Look for canvas navigation button by text content
      const canvasButtons = await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').count();
      if (canvasButtons > 0) {
        await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first().click();
        await page.waitForTimeout(3000); // Wait for canvas to load

        // Check for any error messages
        const canvasError = await page.locator('text=/encountered an error/').count();
        if (canvasError > 0) {
          console.log('❌ Canvas view has error messages');
          const errorText = await page.locator('text=/encountered an error/').first().textContent();
          console.log('Error details:', errorText);
        } else {
          console.log('✅ Canvas view loaded without errors');
        }

        // Check for canvas elements
        const canvasElements = await page.locator('.vue-flow, .canvas-container, [class*="canvas"], [class*="flow"]').count();
        console.log(`✅ Canvas elements found: ${canvasElements}`);
      } else {
        console.log('⚠️ Canvas navigation button not found');
      }
    } catch (error) {
      console.log('❌ Canvas test failed:', error.message);
    }

    // Test Calendar View
    console.log('📅 Testing Calendar View...');
    try {
      // Look for calendar navigation button by text content
      const calendarButtons = await page.locator('button:has-text("Calendar"), [data-testid*="calendar"], .nav-item:has-text("Calendar")').count();
      if (calendarButtons > 0) {
        await page.locator('button:has-text("Calendar"), [data-testid*="calendar"], .nav-item:has-text("Calendar")').first().click();
        await page.waitForTimeout(3000); // Wait for calendar to load

        // Check for any error messages
        const calendarError = await page.locator('text=/encountered an error/').count();
        if (calendarError > 0) {
          console.log('❌ Calendar view has error messages');
          const errorText = await page.locator('text=/encountered an error/').first().textContent();
          console.log('Error details:', errorText);
        } else {
          console.log('✅ Calendar view loaded without errors');
        }

        // Check for calendar elements
        const calendarElements = await page.locator('.vue-cal, .calendar-container, [class*="calendar"], [class*="cal"]').count();
        console.log(`✅ Calendar elements found: ${calendarElements}`);
      } else {
        console.log('⚠️ Calendar navigation button not found');
      }
    } catch (error) {
      console.log('❌ Calendar test failed:', error.message);
    }

    // Test Task Creation
    console.log('➕ Testing Task Creation...');
    try {
      // Look for task input
      const taskInputs = await page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').count();
      if (taskInputs > 0) {
        const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
        await taskInput.click();
        await taskInput.fill('Test Task for Error Verification');
        await taskInput.press('Enter');
        await page.waitForTimeout(2000);

        // Check if task was created
        const taskCreated = await page.locator('text=Test Task for Error Verification').count();
        console.log(`✅ Task created successfully: ${taskCreated > 0}`);
      } else {
        console.log('⚠️ Task input not found');
      }
    } catch (error) {
      console.log('❌ Task creation test failed:', error.message);
    }

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();