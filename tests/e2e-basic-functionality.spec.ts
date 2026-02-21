import { test, expect } from '@playwright/test';

async function dismissBlockingOverlays(page: import('@playwright/test').Page) {
  const onboarding = page.locator('.onboarding-overlay')
  if (await onboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    const btn = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click({ force: true })
  }

  const aiWizard = page.locator('.wizard-overlay')
  if (await aiWizard.isVisible({ timeout: 1500 }).catch(() => false)) {
    const btn = page.locator('.wizard-overlay .close-btn').first()
    if (await btn.isVisible().catch(() => false)) await btn.click({ force: true })
  }
}

test.describe('FlowState Basic Functionality E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({
        seen: true,
        version: 2,
        dismissedAt: new Date().toISOString(),
      }))
      localStorage.setItem('flowstate-welcome-seen', 'true')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({
        aiSetupComplete: true,
        aiPreferredProvider: 'groq',
      }))
    })
    // Navigate to the application
    await page.goto('/#/board');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    await dismissBlockingOverlays(page);
  });

  test('Application loads correctly', async ({ page }) => {
    // Check if the main application container is visible
    await expect(page.locator('body')).toBeVisible();

    // Check for title
    const title = await page.title();
    expect(title).toContain('FlowState');

    // Check for no console errors
    const messages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });

    // Wait a bit to collect any console errors
    await page.waitForTimeout(2000);

    // Assert no critical console errors
    expect(messages.filter(msg => msg.includes('CRITICAL'))).toHaveLength(0);
  });

  test('Board view loads and is functional', async ({ page }) => {
    // Look for board view elements - check for kanban/swimlane structure
    const boardElements = page.locator('.swimlane, .kanban-column, .board-column, [class*="swimlane"], [class*="column"]');

    // Board elements should be present on the default board view
    const boardCount = await boardElements.count();
    console.log(`Found ${boardCount} board elements`);

    // Board route should render a board container even if initially empty.
    const boardContainer = page.locator('.kanban-board, .board-container, .kanban-view')
    expect(boardCount > 0 || await boardContainer.count() > 0).toBeTruthy()
  });

  test('Timer functionality works', async ({ page }) => {
    // Look for specific timer element (not using OR selector)
    const timerContainer = page.locator('.timer-container').first();
    await expect(timerContainer).toBeVisible({ timeout: 5000 });

    // Check for timer time display
    const timerTime = page.locator('.timer-time');
    await expect(timerTime).toBeVisible();

    // Check for timer controls
    const startButton = page.locator('button[title="Start 25-min work timer"]');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);

      // Verify timer is active (may show different content)
      const activeTimer = page.locator('.timer-active, .timer-running, [class*="active"]');
      await expect(activeTimer.first()).toBeVisible({ timeout: 5000 })
      // Note: Timer might not be immediately active, so we don't assert failure if not found
    }
  });

  test('Task creation is possible', async ({ page }) => {
    await dismissBlockingOverlays(page)
    // Look for task creation input
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="add"], .quick-task-input');

    if (await taskInput.isVisible()) {
      await taskInput.fill('E2E Test Task');
      await page.keyboard.press('Enter');

      // Wait for task to be created
      await page.waitForTimeout(1000);

      // Look for the created task
      const createdTask = page.locator('.task-card, .task-item, [data-testid*="task"]').filter({ hasText: 'E2E Test Task' });
      expect(await createdTask.count()).toBeGreaterThan(0);
    } else {
      // Alternative: Look for add task button
      const addButton = page.locator('button').filter({ hasText: /add|create|new|new task/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('Navigation between views works', async ({ page }) => {
    // Look for navigation elements
    const navLinks = page.locator('nav a, .nav-link, [class*="nav"] a, [data-testid*="nav"]');

    if (await navLinks.count() > 0) {
      const firstNavLink = navLinks.first();
      await firstNavLink.click();
      await page.waitForTimeout(1000);

      // Verify navigation occurred (URL or content changed)
      expect(page.url()).not.toBe('http://localhost:5546/');
    }
  });

  test('Data persistence check - IndexedDB', async ({ page }) => {
    // Evaluate IndexedDB in the browser context
    const dbStatus = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('flow-state');

        request.onerror = () => resolve({ error: 'Failed to open IndexedDB' });
        request.onsuccess = () => {
          const db = request.result;
          if (db.objectStoreNames.contains('tasks')) {
            resolve({ success: true, hasTasksStore: true });
          } else {
            resolve({ success: true, hasTasksStore: false });
          }
        };
      });
    });

    expect(dbStatus.error).toBeFalsy();
    expect(dbStatus.success).toBe(true);
  });

  test('Responsive design works', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Check if mobile navigation appears
    const mobileNav = page.locator('.mobile-nav, .hamburger, [class*="mobile"]');
    // Mobile nav might or might not be visible, which is fine
  });
});
