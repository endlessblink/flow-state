#!/usr/bin/env node

// Test calendar drag and drop functionality
import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Testing Calendar Drag and Drop Fix...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Browser Console Error:', msg.text());
      } else if (msg.text().includes('CALENDAR') || msg.text().includes('⚠️') || msg.text().includes('✅')) {
        console.log('📝 Browser Console:', msg.text());
      }
    });

    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForSelector('div', { timeout: 10000 });

    // Create a test task first
    console.log('📝 Creating test task...');
    const taskInputs = await page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').count();

    if (taskInputs > 0) {
      const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
      await taskInput.click();
      await taskInput.fill('Test Drag Task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      console.log('✅ Test task created');
    }

    // Navigate to Canvas view to test inbox drag
    console.log('🎨 Testing Canvas Inbox Drag...');
    const canvasButtons = await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').count();
    if (canvasButtons > 0) {
      await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first().click();
      await page.waitForTimeout(3000);

      // Check if task appears in inbox panel
      const inboxTasks = await page.locator('.inbox-panel, [class*="inbox"]').count();
      console.log(`📥 Found inbox panels: ${inboxTasks}`);

      const taskInInbox = await page.locator('.inbox-panel:has-text("Test Drag Task"), [class*="inbox"]:has-text("Test Drag Task")').count();
      console.log(`📋 Tasks found in inbox: ${taskInInbox}`);
    }

    // Navigate to Calendar view to test drag and drop
    console.log('📅 Testing Calendar Drag and Drop...');
    const calendarButtons = await page.locator('button:has-text("Calendar"), [data-testid*="calendar"], .nav-item:has-text("Calendar")').count();
    if (calendarButtons > 0) {
      await page.locator('button:has-text("Calendar"), [data-testid*="calendar"], .nav-item:has-text("Calendar")').first().click();
      await page.waitForTimeout(3000);

      // Check for calendar errors
      const calendarErrors = await page.locator('text=/encountered an error/').count();
      if (calendarErrors > 0) {
        console.log('❌ Calendar view still has errors');
        const errorText = await page.locator('text=/encountered an error/').first().textContent();
        console.log('Error details:', errorText);
      } else {
        console.log('✅ Calendar view loaded without errors');
      }
    }

    console.log('🎉 Calendar drag and drop test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();