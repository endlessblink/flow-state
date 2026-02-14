import { test, expect } from '@playwright/test';

test.describe('Canvas Interactions', () => {
    test.beforeEach(async ({ page }) => {
        // Bypass welcome modal
        await page.addInitScript(() => {
            localStorage.setItem('flowstate-welcome-seen', 'true');
        });
        await page.goto('/');
    });

    test('should load the canvas interaction', async ({ page }) => {
        await expect(page.locator('.canvas-layout')).toBeVisible();

        // Check if Vue Flow is present
        await expect(page.locator('.vue-flow-container')).toBeVisible();
    });
});
