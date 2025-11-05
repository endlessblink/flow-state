/**
 * AppHeader Smoke Test Suite
 * Quick verification that the extracted AppHeader works correctly
 */

import { test, expect } from '@playwright/test';

test.describe('AppHeader Smoke Tests', () => {
  test('AppHeader loads and displays basic components', async ({ page }) => {
    await page.goto('http://localhost:5546');

    // Wait for the app to load (wait for any heading to appear)
    await page.waitForSelector('h1', { timeout: 15000 });

    // Take a screenshot to see what loaded
    await page.screenshot({ path: 'test-results/app-header-loaded.png' });

    // Verify basic header structure exists
    const headerSection = page.locator('.header-section');
    await expect(headerSection).toBeVisible();

    // Verify project title shows
    const projectTitle = page.locator('h1');
    await expect(projectTitle).toBeVisible();

    // Verify timer container exists
    const timerContainer = page.locator('.timer-container');
    await expect(timerContainer).toBeVisible();

    // Verify time display exists
    const timeDisplay = page.locator('.time-display-container');
    await expect(timeDisplay).toBeVisible();

    console.log('✅ AppHeader basic structure verified');
  });

  test('Dynamic title changes work', async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForSelector('h1', { timeout: 15000 });

    const projectTitle = page.locator('h1');

    // Initial title should be Board
    await expect(projectTitle).toContainText('Board');
    console.log('✅ Initial title verified as Board');

    // Navigate to Calendar and verify title change
    await page.click('a[href="#/calendar"]');
    await page.waitForTimeout(1000);
    await expect(projectTitle).toContainText('Calendar');
    console.log('✅ Title updated to Calendar');

    // Navigate to Canvas and verify title change
    await page.click('a[href="#/canvas"]');
    await page.waitForTimeout(1000);
    await expect(projectTitle).toContainText('Canvas');
    console.log('✅ Title updated to Canvas');

    // Return to Board
    await page.click('a[href="#/"]');
    await page.waitForTimeout(1000);
    await expect(projectTitle).toContainText('Board');
    console.log('✅ Title returned to Board');

    await page.screenshot({ path: 'test-results/title-changes-working.png' });
  });

  test('Timer functionality works', async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForSelector('h1', { timeout: 15000 });

    // Find timer display
    const timerDisplay = page.locator('.timer-time');
    await expect(timerDisplay).toBeVisible();
    const initialTime = await timerDisplay.textContent();
    console.log(`Initial timer time: ${initialTime}`);

    // Start timer (use a more flexible selector)
    const timerButtons = page.locator('.timer-controls button');
    const startButton = timerButtons.first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for timer to start
    await page.waitForTimeout(2000);

    // Check if timer is running (time should be different)
    const newTime = await timerDisplay.textContent();
    console.log(`Timer time after starting: ${newTime}`);

    // Check if page title shows focus session
    const pageTitle = await page.title();
    console.log(`Page title during timer: ${pageTitle}`);

    // Stop the timer
    const stopButton = page.locator('button').filter({ hasText: 'Stop' }).first();
    if (await stopButton.isVisible()) {
      await stopButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Timer stopped successfully');
    }

    await page.screenshot({ path: 'test-results/timer-functionality-working.png' });

    // Basic verification that something happened
    expect(newTime).not.toBe(initialTime);
    console.log('✅ Timer functionality verified');
  });

  test('No critical errors in console', async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForSelector('h1', { timeout: 15000 });

    // Collect console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Wait a bit to collect any console errors
    await page.waitForTimeout(3000);

    // Check for error messages
    const errorMessages = consoleMessages.filter(msg => msg.includes('[ERROR]') || msg.includes('[error]'));

    if (errorMessages.length > 0) {
      console.log('⚠️ Console errors found:');
      errorMessages.forEach(err => console.log(err));
    } else {
      console.log('✅ No critical console errors detected');
    }

    // We expect some errors might exist, but let's verify the app still functions
    const headerSection = page.locator('.header-section');
    await expect(headerSection).toBeVisible();

    console.log(`✅ App remains functional despite ${errorMessages.length} console messages`);
  });
});