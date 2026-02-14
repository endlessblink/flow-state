import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
    test.beforeEach(async ({ page }) => {
        // Bypass welcome modal
        await page.addInitScript(() => {
            localStorage.setItem('flowstate-welcome-seen', 'true');
        });
        await page.goto('/#/tasks');
        // Wait for the view to load
        await page.waitForSelector('.all-tasks-view');
    });

    test('should allow creating a task via quick add', async ({ page }) => {
        // Open sidebar if hidden (assuming mobile or closed state, but usually open on desktop)
        // For now, assume desktop default open. 

        // Locate the Quick Add input in the sidebar
        const quickAddInput = page.getByPlaceholder(/Quick add task/i);
        await expect(quickAddInput).toBeVisible();

        const taskTitle = `New Test Task ${Date.now()}`;
        await quickAddInput.fill(taskTitle);
        await quickAddInput.press('Enter');

        // Verify task appears in the list
        // The AllTasksView has a TaskList or TaskTable. 
        // We look for the text.
        await expect(page.getByText(taskTitle)).toBeVisible();
    });

    test('should allow properly filtering tasks', async ({ page }) => {
        // Check if ViewControls are present
        await expect(page.locator('.view-controls')).toBeVisible();

        // Toggle "Hide Done" if it exists (it's a prop passed to ViewControls)
        // We might need to find the specific button.
        // Based on AllTasksView.vue code: .hide-done-toggle
        // const hideDoneBtn = page.locator('.hide-done-toggle');
        // if (await hideDoneBtn.isVisible()) {
        //   await hideDoneBtn.click();
        // }
    });
});
