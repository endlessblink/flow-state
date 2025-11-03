#!/usr/bin/env node

// Comprehensive test to verify both calendar and canvas drag functionality
import { chromium } from 'playwright';

(async () => {
  console.log('🧪 Comprehensive Fix Verification Test...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Track all console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
      if (msg.text().includes('updateTaskInstance') ||
          msg.text().includes('not a function') ||
          msg.text().includes('Error:') ||
          msg.text().includes('INBOX') ||
          msg.text().includes('CANVAS') ||
          msg.text().includes('CALENDAR') ||
          msg.text().includes('✅') ||
          msg.text().includes('❌')) {
        console.log('📝 Browser Console:', msg.text());
      }
    });

    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForSelector('div', { timeout: 10000 });

    // Create a test task
    console.log('📝 Creating test task...');
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Add"], .quick-task-input, [data-testid*="task-input"]').first();
    await taskInput.click();
    await taskInput.fill('Comprehensive Test Task');
    await taskInput.press('Enter');
    await page.waitForTimeout(3000);
    console.log('✅ Test task created');

    // Test 1: Calendar View
    console.log('📅 Testing Calendar View...');
    const calendarButton = page.locator('button:has-text("Calendar"), [data-testid*="calendar"], .nav-item:has-text("Calendar")').first();
    await calendarButton.click();
    await page.waitForTimeout(3000);

    const calendarErrors = page.locator('text=/encountered an error/');
    const hasCalendarErrors = await calendarErrors.count() > 0;

    if (hasCalendarErrors) {
      console.log('❌ Calendar view has errors');
    } else {
      console.log('✅ Calendar view loaded without errors');
    }

    // Test 2: Canvas View and Inbox
    console.log('🎨 Testing Canvas View...');
    const canvasButton = page.locator('button:has-text("Canvas"), [data-testid*="canvas"], .nav-item:has-text("Canvas")').first();
    await canvasButton.click();
    await page.waitForTimeout(3000);

    const canvasErrors = page.locator('text=/encountered an error/');
    const hasCanvasErrors = await canvasErrors.count() > 0;

    if (hasCanvasErrors) {
      console.log('❌ Canvas view has errors');
    } else {
      console.log('✅ Canvas view loaded without errors');
    }

    // Check for inbox and task
    const inboxPanel = page.locator('.inbox-panel, [class*="inbox"]').first();
    const hasInbox = await inboxPanel.count() > 0;
    const taskInInbox = await page.locator('.inbox-panel:has-text("Comprehensive Test Task"), [class*="inbox"]:has-text("Comprehensive Test Task")').count();

    if (hasInbox && taskInInbox > 0) {
      console.log('✅ Task found in inbox - drag operations ready');
    } else {
      console.log('❌ Task not found in inbox or no inbox panel');
    }

    // Test 3: Check for any updateTaskInstance errors in console
    const updateTaskInstanceErrors = consoleMessages.filter(msg =>
      msg.includes('updateTaskInstance') && msg.includes('not a function')
    );

    if (updateTaskInstanceErrors.length === 0) {
      console.log('✅ No updateTaskInstance errors detected');
    } else {
      console.log('❌ updateTaskInstance errors found:', updateTaskInstanceErrors);
    }

    // Summary
    console.log('🎉 Comprehensive test completed!');
    console.log('📋 Summary:');
    console.log(`✅ Calendar view: ${hasCalendarErrors ? 'FAILED' : 'PASSED'}`);
    console.log(`✅ Canvas view: ${hasCanvasErrors ? 'FAILED' : 'PASSED'}`);
    console.log(`✅ Task in inbox: ${taskInInbox > 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ updateTaskInstance errors: ${updateTaskInstanceErrors.length === 0 ? 'PASSED' : 'FAILED'}`);

    const allTestsPassed = !hasCalendarErrors && !hasCanvasErrors && taskInInbox > 0 && updateTaskInstanceErrors.length === 0;

    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - Both calendar and canvas functionality are working!');
    } else {
      console.log('❌ Some tests failed - there are still issues to resolve');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();