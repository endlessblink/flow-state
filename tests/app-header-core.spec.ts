/**
 * Core AppHeader Functionality Test Suite
 * Focused tests for the most critical AppHeader features after extraction
 */

import { test, expect } from '@playwright/test';

test.describe('AppHeader Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');

    // Wait for app to fully load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Wait for any animations to complete
    await page.waitForTimeout(1000);
  });

  test('AppHeader basic structure and title display', async ({ page }) => {
    // Verify main header container exists
    const header = page.locator('.header-section');
    await expect(header).toBeVisible();

    // Verify project title exists and shows default
    const projectTitle = page.locator('h1');
    await expect(projectTitle).toBeVisible();
    await expect(projectTitle).toContainText('Board');

    // Verify timer container exists
    const timerContainer = page.locator('.timer-container');
    await expect(timerContainer).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/header-basic-structure.png',
      fullPage: false
    });
  });

  test('Dynamic title updates with route navigation', async ({ page }) => {
    const projectTitle = page.locator('h1');

    // Test initial title
    await expect(projectTitle).toContainText('Board');

    // Test Calendar view
    await page.click('a[href="#/calendar"]');
    await page.waitForTimeout(500);
    await expect(projectTitle).toContainText('Calendar');

    // Test Canvas view
    await page.click('a[href="#/canvas"]');
    await page.waitForTimeout(500);
    await expect(projectTitle).toContainText('Canvas');

    // Return to Board
    await page.click('a[href="#/"]');
    await page.waitForTimeout(500);
    await expect(projectTitle).toContainText('Board');

    // Take screenshot of title transitions
    await page.screenshot({
      path: 'test-results/header-dynamic-titles.png',
      fullPage: false
    });
  });

  test('Timer start functionality', async ({ page }) => {
    // Find timer display and verify initial state
    const timerDisplay = page.locator('.timer-time');
    await expect(timerDisplay).toBeVisible();
    await expect(timerDisplay).toContainText('20:00');

    // Start timer using the start button
    const startButton = page.locator('button').filter({ hasText: 'Start 25-min work timer' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for timer to start
    await page.waitForTimeout(1000);

    // Verify timer is running (time should be different from initial)
    const newTime = await timerDisplay.textContent();
    expect(newTime).not.toBe('20:00');

    // Verify page title changed to include timer info
    const pageTitle = await page.title();
    expect(pageTitle).toContain('Focus Session');

    // Verify pause button is now visible
    const pauseButton = page.locator('button').filter({ hasText: 'Pause timer' });
    await expect(pauseButton).toBeVisible();

    // Take screenshot of active timer
    await page.screenshot({
      path: 'test-results/timer-active-state.png',
      fullPage: false
    });

    // Stop timer for cleanup
    const stopButton = page.locator('button').filter({ hasText: 'Stop timer' });
    await stopButton.click();
    await page.waitForTimeout(500);
  });

  test('Timer pause/resume functionality', async ({ page }) => {
    // Start timer first
    const startButton = page.locator('button').filter({ hasText: 'Start 25-min work timer' });
    await startButton.click();
    await page.waitForTimeout(1000);

    // Pause timer
    const pauseButton = page.locator('button').filter({ hasText: 'Pause timer' });
    await pauseButton.click();
    await page.waitForTimeout(500);

    // Verify resume button appears
    const resumeButton = page.locator('button').filter({ hasText: 'Resume timer' });
    await expect(resumeButton).toBeVisible();

    // Resume timer
    await resumeButton.click();
    await page.waitForTimeout(500);

    // Verify pause button reappears
    await expect(pauseButton).toBeVisible();

    // Cleanup
    const stopButton = page.locator('button').filter({ hasText: 'Stop timer' });
    await stopButton.click();
  });

  test('Timer break functionality', async ({ page }) => {
    // Test short break button
    const shortBreakButton = page.locator('button').filter({ hasText: 'Start 5-min break' });
    await expect(shortBreakButton).toBeVisible();

    await shortBreakButton.click();
    await page.waitForTimeout(1000);

    // Verify break timer is running
    const timerDisplay = page.locator('.timer-time');
    const breakTime = await timerDisplay.textContent();
    expect(breakTime).not.toBe('20:00'); // Should be different from work session duration

    // Check for break icon or styling
    const timerContainer = page.locator('.timer-display');
    const hasBreakClass = await timerContainer.evaluate(el => el.classList.contains('timer-break'));
    expect(hasBreakClass).toBe(true);

    // Cleanup
    const stopButton = page.locator('button').filter({ hasText: 'Stop timer' });
    await stopButton.click();
    await page.waitForTimeout(500);
  });

  test('Time display is visible and functional', async ({ page }) => {
    // Verify time display container exists
    const timeDisplayContainer = page.locator('.time-display-container');
    await expect(timeDisplayContainer).toBeVisible();

    // Get initial time content
    const timeContent = await timeDisplayContainer.textContent();
    expect(timeContent).toBeTruthy();
    expect(timeContent.length).toBeGreaterThan(0);

    // Time should contain time pattern
    expect(timeContent).toMatch(/\d{1,2}:\d{2}/);

    // Take screenshot of time display
    await page.screenshot({
      path: 'test-results/time-display-working.png',
      fullPage: false
    });
  });

  test('User authentication state handling', async ({ page }) => {
    // Check if user profile section exists (regardless of visibility)
    const userProfileContainer = page.locator('.user-profile-container');
    await expect(userProfileContainer).toBeAttached();

    // The user profile should either show the user component or be hidden
    // Both states are valid depending on authentication
    const isVisible = await userProfileContainer.isVisible();

    // Log the authentication state for debugging
    console.log(`User profile container visible: ${isVisible}`);

    // Take screenshot to document the state
    await page.screenshot({
      path: 'test-results/user-auth-state.png',
      fullPage: false
    });
  });

  test('Header responsive behavior', async ({ page }) => {
    const header = page.locator('.header-section');

    // Test desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(header).toBeVisible();

    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(header).toBeVisible();

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(header).toBeVisible();

    // Verify timer controls are still accessible on mobile
    const startButton = page.locator('button').filter({ hasText: 'Start 25-min work timer' });
    await expect(startButton).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'test-results/header-mobile-responsive.png',
      fullPage: false
    });
  });

  test('No console errors during header interactions', async ({ page }) => {
    // Monitor for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Interact with header features
    const startButton = page.locator('button').filter({ hasText: 'Start 25-min work timer' });
    await startButton.click();
    await page.waitForTimeout(1000);

    const pauseButton = page.locator('button').filter({ hasText: 'Pause timer' });
    await pauseButton.click();
    await page.waitForTimeout(500);

    const resumeButton = page.locator('button').filter({ hasText: 'Resume timer' });
    await resumeButton.click();
    await page.waitForTimeout(500);

    const stopButton = page.locator('button').filter({ hasText: 'Stop timer' });
    await stopButton.click();
    await page.waitForTimeout(500);

    // Navigate between views
    await page.click('a[href="#/calendar"]');
    await page.waitForTimeout(500);
    await page.click('a[href="#/canvas"]');
    await page.waitForTimeout(500);
    await page.click('a[href="#/"]');
    await page.waitForTimeout(500);

    // Verify no console errors
    expect(errors.length).toBe(0);

    if (errors.length > 0) {
      console.error('Console errors found:', errors);
    }
  });
});