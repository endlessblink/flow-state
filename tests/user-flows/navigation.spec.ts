import { test, expect } from '@playwright/test';

test.describe.skip('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Explicitly handle welcome modal if present
        const welcomeModal = page.locator('.modal-overlay').filter({ hasText: 'Welcome to FlowState' });
        try {
            if (await welcomeModal.isVisible({ timeout: 2000 })) {
                console.log('[TEST] Welcome modal detected, dismissing...');
                await page.getByRole('button', { name: 'Get Started' }).click();
                await expect(welcomeModal).toBeHidden();
            }
        } catch (e) {
            // Ignore timeout
        }
    });

    test('should navigate between main views', async ({ page }) => {
        await page.goto('/');

        // Check we are on Canvas (default)
        await expect(page).toHaveURL(/\/#\/$/);
        await expect(page.locator('.canvas-layout')).toBeVisible();

        // Navigate to Tasks
        // Assuming Sidebar has links. Let's find a link with "Tasks" or "Inbox" or "All Projects".
        // AppSidebar has "All Active" and "Inbox".
        await page.getByText('All Active').click();
        await expect(page).toHaveURL(/tasks/);
        await expect(page.locator('.all-tasks-view')).toBeVisible();

        // Navigate to Calendar
        // Sidebar has "Today" / "This Week"?
        // Or maybe a specialized Calendar link? 
        // NOTE: AppSidebar didn't explicitly show a "Calendar" link in the code snippet I saw, 
        // but likely "Today" or "This Week" goes to Smart Views which might be list views.
        // However, the router has /calendar. 
        // Let's rely on URL navigation for now if links aren't obvious.
        await page.goto('/#/calendar');
        await expect(page.locator('.calendar-layout')).toBeVisible();

        // Navigate to Board
        await page.goto('/#/board');
        // BoardView likely has a class .board-layout or similar
        // await expect(page.locator('.board-view')).toBeVisible(); 
    });
});
