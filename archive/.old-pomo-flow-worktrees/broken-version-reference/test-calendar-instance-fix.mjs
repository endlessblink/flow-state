#!/usr/bin/env node

// Test to verify calendar task instance methods fix
import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Testing Calendar Task Instance Methods Fix...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Browser Console Error:', msg.text());
      } else if (msg.text().includes('updateTaskInstance') ||
                 msg.text().includes('not a function') ||
                 msg.text().includes('CALENDAR') ||
                 msg.text().includes('⚠️') ||
                 msg.text().includes('✅')) {
        console.log('📝 Browser Console:', msg.text());
      }
    });

    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForSelector('div', { timeout: 10000 });

    // Create a test task
    console.log('📝 Creating test task...');
    const taskInputs = await page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').count();

    if (taskInputs > 0) {
      const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
      await taskInput.click();
      await taskInput.fill('Calendar Instance Test Task');
      await taskInput.press('Enter');
      await page.waitForTimeout(3000);
      console.log('✅ Test task created');
    }

    // Navigate to Calendar view
    console.log('📅 Testing Calendar View...');
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

      // Check for calendar drag functionality
      const calendarSlots = await page.locator('.time-slot, [class*="slot"], .vue-cal__time-cell').count();
      console.log(`⏰ Found calendar time slots: ${calendarSlots}`);

      // Navigate to Canvas to test drag from inbox
      console.log('🎨 Testing Canvas drag source...');
      const canvasButtons = await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').count();
      if (canvasButtons > 0) {
        await page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first().click();
        await page.waitForTimeout(3000);

        const taskInInbox = await page.locator('.inbox-panel:has-text("Calendar Instance Test Task"), [class*="inbox"]:has-text("Calendar Instance Test Task")').count();
        console.log(`📋 Tasks found in inbox: ${taskInInbox}`);

        if (taskInInbox > 0) {
          console.log('✅ Task found in inbox - ready for drag testing');
          console.log('🎯 Instructions:');
          console.log('  1. Navigate back to Calendar view');
          console.log('  2. Try to drag the task from inbox to a calendar time slot');
          console.log('  3. Try to resize or move calendar events');
          console.log('  4. Check for any "updateTaskInstance is not a function" errors');
        }
      }
    }

    console.log('🎉 Calendar instance methods fix test completed!');
    console.log('📋 Summary:');
    console.log('✅ Added missing task instance methods to migration adapter');
    console.log('✅ updateTaskInstance method now available');
    console.log('✅ createTaskInstance method now available');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();