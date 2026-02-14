import { test, expect } from '@playwright/test';

test.describe('Advanced Features', () => {
    test.beforeEach(async ({ page }) => {
        // Bypass welcome modal
        await page.addInitScript(() => {
            localStorage.setItem('flowstate-welcome-seen', 'true');
        });
    });

    test('should load without errors', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.app-layout')).toBeVisible();
    });
});
