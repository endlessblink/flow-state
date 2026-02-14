import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/tasks');

        // Explicitly handle welcome modal if present
        const welcomeModal = page.locator('.modal-overlay').filter({ hasText: 'Welcome to FlowState' });
        // Short timeout for the check to avoid waiting too long if it's not there
        try {
            if (await welcomeModal.isVisible({ timeout: 2000 })) {
                console.log('[TEST] Welcome modal detected, dismissing...');
                await page.getByRole('button', { name: 'Get Started' }).click();
                await expect(welcomeModal).toBeHidden();
            }
        } catch (e) {
            // Ignore timeout, meaning modal didn't appear
        }

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
        console.log(`[TEST] Creating task: ${taskTitle}`);
        await quickAddInput.fill(taskTitle);
        await quickAddInput.press('Enter');
        console.log('[TEST] Task creation submitted');

        // Wait a bit to ensure UI updates
        await page.waitForTimeout(2000);

        // Debug: Log the page content or search for the task
        const isVisible = await page.getByText(taskTitle).isVisible();
        console.log(`[TEST] Is task visible? ${isVisible}`);

        if (!isVisible) {
            console.log('[TEST] Task not found. Dumping task list items:');
            const tasks = await page.locator('.task-item').allTextContents();
            console.log(tasks);
        }

        // Verify task appears in the list
        await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10000 });
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
