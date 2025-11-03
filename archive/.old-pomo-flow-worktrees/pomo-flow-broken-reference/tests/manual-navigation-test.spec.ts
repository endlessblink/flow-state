import { test, expect } from '@playwright/test';

test.describe('Manual Navigation Test', () => {
  test('Basic navigation works', async ({ page }) => {
    // Start with the homepage
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');

    // Take a screenshot to see what's loaded
    await page.screenshot({ path: 'test-results/homepage.png' });

    // Check if the page has loaded by looking for main app container
    const appContainer = page.locator('#app').first();
    await expect(appContainer).toBeVisible({ timeout: 10000 });

    console.log('Homepage loaded successfully');

    // Try to find navigation elements using text content
    const boardLink = page.locator('a:has-text("Board")').first();
    const calendarLink = page.locator('a:has-text("Calendar")').first();
    const canvasLink = page.locator('a:has-text("Canvas")').first();
    const allTasksLink = page.locator('a:has-text("All Tasks")').first();
    const quickSortLink = page.locator('a:has-text("Quick Sort")').first();

    console.log('Found navigation links');

    // Test Board view navigation
    if (await boardLink.isVisible()) {
      await boardLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/board-view.png' });
      console.log('Board view loaded');

      // Monitor console for ServiceOrchestrator logs
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        console.log('Console message:', msg.text());
        if (msg.text().includes('ServiceOrchestrator') || msg.text().includes('BOARD]')) {
          consoleMessages.push(msg.text());
        }
      });

      // Try to interact with the page to trigger logs
      await page.click('body');
      await page.waitForTimeout(2000);

      console.log('Board view console messages:', consoleMessages);
    }
  });
});