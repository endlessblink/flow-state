import { test, expect } from '@playwright/test';

test.describe('TASK-167: Day Group Date Formatting', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Use specific nav selector to avoid ambiguity
        const canvasLink = page.locator('nav a[href="/canvas"]');
        await canvasLink.waitFor({ state: 'visible' });
        await canvasLink.click();

        // Wait for canvas to be effectively loaded
        await page.waitForSelector('.vue-flow__pane', { state: 'visible', timeout: 10000 });

        // Click center of screen to ensure focus
        // We use viewport size to calculate center to be safe
        const viewportSize = page.viewportSize();
        if (viewportSize) {
            await page.mouse.click(viewportSize.width / 2, viewportSize.height / 2);
        } else {
            await page.click('.vue-flow__pane', { position: { x: 300, y: 300 }, force: true });
        }
    });

    test('should display date suffix in D.M.YY format', async ({ page }) => {
        // 1. Create a "Friday" group using hotkey
        // Wait a bit for focus to settle
        await page.waitForTimeout(1000);
        await page.keyboard.press('Shift+G');

        // Check if group appeared
        const newGroup = page.locator('.section-node').first();
        try {
            await newGroup.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
            console.log('Group creation failed, trying context menu fallback...');
            // Fallback: Context menu if hotkey failed
            await page.mouse.click(300, 300, { button: 'right' });
            await page.click('text=Add Group');
            await newGroup.waitFor({ state: 'visible' });
        }

        // Rename it to "Friday"
        const input = newGroup.locator('.section-name-input');
        await input.fill('Friday');
        await input.press('Enter'); // Better than blur for saving usually

        // Wait for potential reactivity
        await page.waitForTimeout(500);

        // 2. Verify visibility
        const suffix = newGroup.locator('.section-date-suffix');
        await expect(suffix).toBeVisible();

        // 3. Verify Format: D.M.YY (e.g. 10.1.26)
        const today = new Date();
        const targetDay = 5; // Friday
        const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilTarget);

        // Expected components
        const d = targetDate.getDate();
        const m = targetDate.getMonth() + 1;
        const yy = targetDate.getFullYear().toString().slice(-2);

        const expectedText = `/ ${d}.${m}.${yy}`;
        await expect(suffix).toHaveText(expectedText);
    });

    test('should display date suffix for "Monday" group', async ({ page }) => {
        // Wait a bit for focus to settle
        await page.waitForTimeout(1000);
        await page.keyboard.press('Shift+G');

        const newGroup = page.locator('.section-node').first();
        try {
            await newGroup.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
            // Fallback
            await page.mouse.click(400, 400, { button: 'right' });
            await page.click('text=Add Group');
            await newGroup.waitFor({ state: 'visible' });
        }

        const input = newGroup.locator('.section-name-input');
        await input.fill('Monday');
        await input.press('Enter');

        const suffix = newGroup.locator('.section-date-suffix');
        await expect(suffix).toBeVisible();
        await expect(suffix).toContainText('.'); // Should contain dots
    });
});
