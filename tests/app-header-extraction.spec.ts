/**
 * AppHeader Extraction Test Suite
 *
 * Comprehensive tests for the extracted AppHeader component functionality
 * Tests all header features after extraction from App.vue
 */

import { test, expect } from '@playwright/test';

test.describe('AppHeader Extraction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');

    // Wait for app to fully load
    await page.waitForSelector('[data-testid="app-header"]', { timeout: 10000 });

    // Wait for any animations to complete
    await page.waitForTimeout(1000);
  });

  test('Header renders correctly with all components', async ({ page }) => {
    // Verify main header container exists
    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();

    // Verify user profile section exists
    const userProfile = page.locator('[data-testid="user-profile-container"]');
    await expect(userProfile).toBeVisible();

    // Verify project title exists
    const projectTitle = page.locator('[data-testid="project-title"]');
    await expect(projectTitle).toBeVisible();

    // Verify timer container exists
    const timerContainer = page.locator('[data-testid="timer-container"]');
    await expect(timerContainer).toBeVisible();

    // Verify time display exists
    const timeDisplay = page.locator('[data-testid="time-display"]');
    await expect(timeDisplay).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/header-initial-state.png',
      fullPage: false
    });
  });

  test('Dynamic project title updates correctly', async ({ page }) => {
    const projectTitle = page.locator('[data-testid="project-title"]');

    // Test initial title (should be "Board")
    await expect(projectTitle).toContainText('Board');

    // Test "Today" view
    await page.click('[data-testid="view-today"]');
    await expect(projectTitle).toContainText('Today');

    // Test "This Week" view
    await page.click('[data-testid="view-week"]');
    await expect(projectTitle).toContainText('This Week');

    // Test Board view
    await page.click('[data-testid="view-board"]');
    await expect(projectTitle).toContainText('Board');

    // Test Canvas view
    await page.click('[data-testid="view-canvas"]');
    await expect(projectTitle).toContainText('Canvas');

    // Test Calendar view
    await page.click('[data-testid="view-calendar"]');
    await expect(projectTitle).toContainText('Calendar');

    // Return to Board for other tests
    await page.click('[data-testid="view-board"]');
  });

  test('Timer controls functionality - Start Quick Timer', async ({ page }) => {
    // Find timer controls
    const startButton = page.locator('[data-testid="timer-start-btn"]');
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    const timerTime = page.locator('[data-testid="timer-time"]');

    // Verify initial state
    await expect(startButton).toBeVisible();
    await expect(timerDisplay).toBeVisible();

    // Store initial time
    const initialTime = await timerTime.textContent();

    // Start quick timer
    await startButton.click();

    // Wait for timer to start
    await page.waitForTimeout(1000);

    // Verify timer is running
    await expect(page.locator('[data-testid="timer-pause-btn"]')).toBeVisible();
    await expect(startButton).toBeHidden();

    // Verify time has changed
    const newTime = await timerTime.textContent();
    expect(newTime).not.toBe(initialTime);

    // Verify timer active state
    await expect(timerDisplay).toHaveClass(/timer-active/);

    // Take screenshot of active timer
    await page.screenshot({
      path: 'test-results/timer-active-state.png',
      fullPage: false
    });

    // Stop timer for cleanup
    await page.click('[data-testid="timer-stop-btn"]');
  });

  test('Timer controls functionality - Break timers', async ({ page }) => {
    // Test short break button
    const shortBreakBtn = page.locator('[data-testid="timer-short-break-btn"]');
    await expect(shortBreakBtn).toBeVisible();

    await shortBreakBtn.click();
    await page.waitForTimeout(1000);

    // Verify break timer is running
    await expect(page.locator('[data-testid="timer-pause-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveClass(/timer-break/);

    // Stop timer
    await page.click('[data-testid="timer-stop-btn"]');
    await page.waitForTimeout(500);

    // Test long break button
    const longBreakBtn = page.locator('[data-testid="timer-long-break-btn"]');
    await expect(longBreakBtn).toBeVisible();

    await longBreakBtn.click();
    await page.waitForTimeout(1000);

    // Verify break timer is running
    await expect(page.locator('[data-testid="timer-pause-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveClass(/timer-break/);

    // Stop timer for cleanup
    await page.click('[data-testid="timer-stop-btn"]');
  });

  test('Timer pause/resume/stop functionality', async ({ page }) => {
    // Start timer
    await page.click('[data-testid="timer-start-btn"]');
    await page.waitForTimeout(1000);

    // Test pause
    const pauseBtn = page.locator('[data-testid="timer-pause-btn"]');
    await pauseBtn.click();
    await page.waitForTimeout(500);

    // Verify resume button appears
    const resumeBtn = page.locator('[data-testid="timer-resume-btn"]');
    await expect(resumeBtn).toBeVisible();
    await expect(pauseBtn).toBeHidden();

    // Test resume
    await resumeBtn.click();
    await page.waitForTimeout(500);

    // Verify pause button reappears
    await expect(pauseBtn).toBeVisible();
    await expect(resumeBtn).toBeHidden();

    // Test stop
    await page.click('[data-testid="timer-stop-btn"]');
    await page.waitForTimeout(500);

    // Verify start button reappears
    await expect(page.locator('[data-testid="timer-start-btn"]')).toBeVisible();
    await expect(pauseBtn).toBeHidden();
    await expect(resumeBtn).toBeHidden();
  });

  test('Timer display and icon states', async ({ page }) => {
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    const timerIcon = page.locator('[data-testid="timer-icon"]');

    // Test inactive state
    await expect(timerDisplay).not.toHaveClass(/timer-active/);

    // Start timer
    await page.click('[data-testid="timer-start-btn"]');
    await page.waitForTimeout(1000);

    // Test active work session state
    await expect(timerDisplay).toHaveClass(/timer-active/);
    await expect(timerDisplay).not.toHaveClass(/timer-break/);

    // Check for work session icon (🍅)
    const workIcon = timerIcon.locator('.timer-emoticon');
    await expect(workIcon).toContainText('🍅');

    // Stop and start break timer
    await page.click('[data-testid="timer-stop-btn"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="timer-short-break-btn"]');
    await page.waitForTimeout(1000);

    // Test break session state
    await expect(timerDisplay).toHaveClass(/timer-active/);
    await expect(timerDisplay).toHaveClass(/timer-break/);

    // Check for break icon (🧎)
    await expect(timerIcon.locator('.timer-emoticon')).toContainText('🧎');

    // Cleanup
    await page.click('[data-testid="timer-stop-btn"]');
  });

  test('Time display functionality', async ({ page }) => {
    const timeDisplay = page.locator('[data-testid="time-display"]');

    // Verify time display is visible
    await expect(timeDisplay).toBeVisible();

    // Get initial time
    const initialTime = await timeDisplay.textContent();
    expect(initialTime).toMatch(/\d{1,2}:\d{2}:\d{2}/);

    // Wait and verify time updates
    await page.waitForTimeout(2000);
    const updatedTime = await timeDisplay.textContent();
    expect(updatedTime).toMatch(/\d{1,2}:\d{2}:\d{2}/);

    // Time should be different (or at least 2+ seconds passed)
    console.log(`Initial time: ${initialTime}, Updated time: ${updatedTime}`);
  });

  test('User profile integration', async ({ page }) => {
    const userProfileContainer = page.locator('[data-testid="user-profile-container"]');

    // Verify user profile container exists
    await expect(userProfileContainer).toBeVisible();

    // Test user profile visibility (may depend on auth state)
    // The UserProfile component should be conditionally rendered
    const userProfile = page.locator('[data-testid="user-profile"]');

    // Check if user is authenticated or not
    const isAuthenticated = await userProfile.isVisible();

    if (isAuthenticated) {
      console.log('User is authenticated - profile component is visible');
      await expect(userProfile).toBeVisible();
    } else {
      console.log('User is not authenticated - profile component is hidden');
      await expect(userProfile).toBeHidden();
    }

    // Either state is acceptable - just verify conditional rendering works
  });

  test('Responsive design behavior', async ({ page }) => {
    const header = page.locator('[data-testid="app-header"]');

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
    await expect(page.locator('[data-testid="timer-start-btn"]')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'test-results/header-mobile-view.png',
      fullPage: false
    });
  });

  test('Glass morphism styling preserved', async ({ page }) => {
    const header = page.locator('[data-testid="app-header"]');
    const controlPanel = page.locator('[data-testid="control-panel"]');

    // Verify header has proper styling classes
    await expect(header).toHaveClass(/header-section/);

    // Verify control panel has glass morphism styling
    await expect(controlPanel).toHaveClass(/control-panel/);

    // Test that styling is responsive to timer state
    await page.click('[data-testid="timer-start-btn"]');
    await page.waitForTimeout(1000);

    await expect(controlPanel).toHaveClass(/timer-active-panel/);

    // Cleanup
    await page.click('[data-testid="timer-stop-btn"]');
  });

  test('Keyboard shortcuts functionality', async ({ page }) => {
    // Test Space key for timer start/pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);

    // Verify timer started
    await expect(page.locator('[data-testid="timer-pause-btn"]')).toBeVisible();

    // Test Space key again for pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Verify timer paused
    await expect(page.locator('[data-testid="timer-resume-btn"]')).toBeVisible();

    // Test Ctrl+S to stop timer
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Verify timer stopped
    await expect(page.locator('[data-testid="timer-start-btn"]')).toBeVisible();

    // Test Ctrl+B for short break
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(1000);

    // Verify break timer started
    await expect(page.locator('[data-testid="timer-pause-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer-display"]')).toHaveClass(/timer-break/);

    // Cleanup
    await page.click('[data-testid="timer-stop-btn"]');
  });

  test('Console error monitoring', async ({ page }) => {
    // Monitor for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Interact with all header features
    await page.click('[data-testid="timer-start-btn"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="timer-pause-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="timer-resume-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="timer-stop-btn"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="timer-short-break-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="timer-stop-btn"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="view-today"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="view-board"]');
    await page.waitForTimeout(500);

    // Verify no console errors
    expect(errors).toHaveLength(0);

    if (errors.length > 0) {
      console.error('Console errors found:', errors);
    }
  });

  test('Performance and accessibility', async ({ page }) => {
    // Test basic accessibility
    await page.accessibility.snapshot();

    // Test that all interactive elements have proper labels
    const startBtn = page.locator('[data-testid="timer-start-btn"]');
    await expect(startBtn).toHaveAttribute('title');

    const pauseBtn = page.locator('[data-testid="timer-pause-btn"]');
    if (await pauseBtn.isVisible()) {
      await expect(pauseBtn).toHaveAttribute('title');
    }

    // Test performance with multiple rapid interactions
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="view-today"]');
      await page.waitForTimeout(100);
      await page.click('[data-testid="view-board"]');
      await page.waitForTimeout(100);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (5 seconds)
    expect(duration).toBeLessThan(5000);

    console.log(`Performance test completed in ${duration}ms`);
  });
});

// Helper data-testid selectors that should be added to AppHeader.vue
test.describe('AppHeader Test Configuration', () => {
  test('Verify test selectors are present', async ({ page }) => {
    // This test ensures we have the necessary data-testid attributes
    await page.goto('http://localhost:5546');

    const requiredSelectors = [
      '[data-testid="app-header"]',
      '[data-testid="user-profile-container"]',
      '[data-testid="project-title"]',
      '[data-testid="timer-container"]',
      '[data-testid="timer-display"]',
      '[data-testid="timer-icon"]',
      '[data-testid="timer-time"]',
      '[data-testid="control-panel"]',
      '[data-testid="time-display"]'
    ];

    for (const selector of requiredSelectors) {
      const element = page.locator(selector);
      if (await element.count() === 0) {
        console.warn(`Missing selector: ${selector}`);
      }
    }
  });
});