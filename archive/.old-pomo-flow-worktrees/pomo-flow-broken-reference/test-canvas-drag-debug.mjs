#!/usr/bin/env node

// Test script specifically for canvas drag and drop debugging
import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Testing Canvas Drag and Drop with Enhanced Logging...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    page.on('console', msg => {
      // Filter for specific drag and drop related console messages
      if (msg.text().includes('INBOX') ||
          msg.text().includes('CANVAS') ||
          msg.text().includes('🎯') ||
          msg.text().includes('📤') ||
          msg.text().includes('📥') ||
          msg.text().includes('📍') ||
          msg.text().includes('✅') ||
          msg.text().includes('❌') ||
          msg.text().includes('⚠️')) {
        console.log('📝 Browser Console:', msg.text());
      }
    });

    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForSelector('div', { timeout: 10000 });

    // Create a test task first
    console.log('📝 Creating test task for drag testing...');
    const taskInputs = await page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').count();

    if (taskInputs > 0) {
      const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
      await taskInput.click();
      await taskInput.fill('Drag Test Task');
      await taskInput.press('Enter');
      await page.waitForTimeout(3000); // Wait for task to be created and appear
      console.log('✅ Test task created for drag testing');
    }

    // Navigate to Canvas view
    console.log('🎨 Navigating to Canvas view...');
    const canvasButtons = await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').count();
    if (canvasButtons > 0) {
      await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first().click();
      await page.waitForTimeout(3000);

      // Check for inbox panel
      const inboxPanels = await page.locator('.inbox-panel, [class*="inbox"]').count();
      console.log(`📥 Found inbox panels: ${inboxPanels}`);

      if (inboxPanels > 0) {
        // Look for the task in inbox
        const taskInInbox = await page.locator('.inbox-panel:has-text("Drag Test Task"), [class*="inbox"]:has-text("Drag Test Task")').count();
        console.log(`📋 Tasks found in inbox: ${taskInInbox}`);

        if (taskInInbox > 0) {
          console.log('✅ Task found in inbox - ready for drag testing');
          console.log('🎯 Instructions:');
          console.log('  1. Find the task "Drag Test Task" in the inbox panel');
          console.log('  2. Try to drag it to the canvas area');
          console.log('  3. Check console logs for detailed drag and drop debugging');

          // Wait for user to test drag and drop
          console.log('⏳ Waiting 30 seconds for drag and drop testing...');
          await page.waitForTimeout(30000);
        } else {
          console.log('❌ Task not found in inbox');

          // Check if task exists anywhere
          const taskAnywhere = await page.locator('text=Drag Test Task').count();
          console.log(`🔍 Task found anywhere: ${taskAnywhere}`);
        }
      } else {
        console.log('❌ No inbox panel found');
      }

      // Check for canvas drop zones
      const canvasArea = await page.locator('.vue-flow, .canvas-container, [class*="canvas"]').count();
      console.log(`🎨 Found canvas areas: ${canvasArea}`);
    } else {
      console.log('❌ Canvas button not found');
    }

    console.log('🎉 Canvas drag and drop debug test completed!');
    console.log('📋 Check the console logs above for detailed drag and drop debugging information');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();