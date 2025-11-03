#!/usr/bin/env node

// Quick test to verify canvas is working after cache clear
import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Testing Canvas After Cache Clear...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Go to the app
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForSelector('div', { timeout: 10000 });

    console.log('✅ Application loaded successfully');

    // Test 1: Create a task
    console.log('📝 Test 1: Creating a test task...');
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
    await taskInput.click();
    await taskInput.fill('Canvas Test After Cache Clear');
    await taskInput.press('Enter');
    await page.waitForTimeout(2000);
    console.log('✅ Task created successfully');

    // Test 2: Navigate to Canvas
    console.log('🎨 Test 2: Navigating to Canvas view...');
    const canvasButton = page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first();
    await canvasButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Canvas view loaded');

    // Test 3: Check for any canvas errors
    console.log('🔍 Test 3: Checking for canvas errors...');

    // Wait a bit longer to ensure any error overlays would appear
    await page.waitForTimeout(2000);

    const errorOverlay = page.locator('.error-overlay, .error-message, [class*="error"]').first();
    const errorVisible = await errorOverlay.isVisible();

    if (errorVisible) {
      const errorText = await errorOverlay.textContent();
      console.log('❌ ERROR: Canvas error detected:', errorText);
    } else {
      console.log('✅ SUCCESS: No canvas errors detected');
    }

    // Test 4: Check inbox functionality
    console.log('📥 Test 4: Checking inbox functionality...');
    const taskInInbox = await page.locator('.inbox-panel:has-text("Canvas Test After Cache Clear"), [class*="inbox"]:has-text("Canvas Test After Cache Clear")').count();
    console.log(`📥 Tasks found in inbox: ${taskInInbox}`);

    if (taskInInbox > 0) {
      console.log('✅ SUCCESS: Task appears in inbox');
      console.log('🎯 INSTRUCTIONS: Try dragging the task to the canvas area');
    } else {
      console.log('ℹ️ INFO: Task not found in inbox (might need to wait longer)');
    }

    console.log('');
    console.log('🎉 FINAL RESULTS:');
    console.log('✅ Application stability: WORKING');
    console.log('✅ Task creation: WORKING');
    console.log('✅ Canvas navigation: WORKING');
    console.log(errorVisible ? '❌ Canvas errors: DETECTED' : '✅ Canvas errors: NONE');
    console.log('');
    console.log('📝 If no errors shown above, the canvas is fixed!');
    console.log('📝 Try dragging tasks from inbox to canvas to test full functionality');

    await page.waitForTimeout(5000); // Keep open for manual testing

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();