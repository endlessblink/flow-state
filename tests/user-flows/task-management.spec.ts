import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('flowstate-onboarding-v2', 'true');
            localStorage.setItem('flowstate-welcome-seen', 'true');
            localStorage.setItem('flowstate-settings-v2', JSON.stringify({ aiSetupComplete: true }));
        });

        await page.goto('/#/tasks');

        // Explicitly handle welcome/onboarding modals if present
        const onboarding = page.locator('.onboarding-overlay');
        if (await onboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
            await page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first().click();
            await expect(onboarding).toBeHidden();
        }

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

        // Explicitly click 'Inbox' in sidebar to ensure we are in the right view
        // The quick add task goes to Inbox by default
        await page.getByText('Inbox', { exact: true }).click();

        // Wait a bit to ensure UI updates
        await page.waitForTimeout(2000);

        // Debug: Log the page content or search for the task
        const isVisible = await page.getByText(taskTitle).isVisible();
        console.log(`[TEST] Is task visible? ${isVisible}`);

        if (!isVisible) {
            console.log('[TEST] Task not found. Dumping task list items:');
            // Try simpler selector if .task-item is not found
            // Update to use the correct class from HierarchicalTaskRow.vue
            const items = await page.locator('.hierarchical-task-row').allTextContents();
            console.log(items);
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

    test('right-click completion persists after reload', async ({ page }) => {
        const taskTitle = `Recurring Action Gate ${Date.now()}`;
        const quickAddInput = page.getByPlaceholder(/Quick add task/i);
        await quickAddInput.fill(taskTitle);
        await quickAddInput.press('Enter');
        await page.getByText('Inbox', { exact: true }).click();

        const taskRow = page.locator('.hierarchical-task-row').filter({ hasText: taskTitle }).first();
        await expect(taskRow).toBeVisible();
        await taskRow.click({ button: 'right' });
        await page.getByText('Mark as Done', { exact: true }).click();

        await expect.poll(async () => page.evaluate((title) => {
            const root = document.querySelector('#app') as any;
            const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks');
            return tasks?.rawTasks.find((task: any) => task.title === title)?.status;
        }, taskTitle)).toBe('done');

        // The context-menu handler updates the reactive store before its awaited
        // guest-storage write completes. Reload only after the durable authority
        // contains the completed status, otherwise this test races the write.
        await expect.poll(async () => page.evaluate((title) => {
            const tasks = JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]');
            return tasks.find((task: any) => task.title === title)?.status;
        }, taskTitle)).toBe('done');

        await page.reload();
        await page.waitForSelector('.all-tasks-view');
        await expect.poll(async () => page.evaluate((title) => {
            const root = document.querySelector('#app') as any;
            const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks');
            return tasks?.rawTasks.find((task: any) => task.title === title)?.status;
        }, taskTitle)).toBe('done');
    });

    test('recurring guest mark-as-done advances to the next occurrence without an error toast', async ({ page }) => {
        const taskId = `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`;
        const taskTitle = `Recurring Guest Gate ${Date.now()}`;
        await page.evaluate(({ taskId, taskTitle }) => {
            const now = new Date().toISOString();
            localStorage.setItem('flowstate-guest-tasks', JSON.stringify([{
                id: taskId,
                title: taskTitle,
                description: '',
                status: 'todo',
                priority: 'medium',
                progress: 0,
                completedPomodoros: 0,
                subtasks: [],
                dueDate: '2026-07-23',
                estimatedDuration: 25,
                projectId: null,
                isInInbox: true,
                createdAt: now,
                updatedAt: now,
                recurrenceRule: {
                    pattern: 'daily',
                    interval: 1,
                    endType: 'never',
                },
            }]));
        }, { taskId, taskTitle });

        await page.reload();
        await page.waitForSelector('.all-tasks-view');
        await page.getByText('Inbox', { exact: true }).click();

        // Guest-task hydration continues after the shell is visible; wait for
        // the task projection before asserting the rendered row.
        await expect.poll(async () => page.evaluate((taskId) => {
            const root = document.querySelector('#app') as any;
            const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks');
            return Boolean(tasks?.rawTasks.some((task: any) => task.id === taskId));
        }, taskId), { timeout: 20_000 }).toBe(true);

        const taskRow = page.locator('.hierarchical-task-row').filter({ hasText: taskTitle }).first();
        await expect(taskRow).toBeVisible({ timeout: 20_000 });
        await taskRow.click({ button: 'right' });
        await page.getByText('Mark as Done', { exact: true }).click();

        await expect(page.getByText('Failed to complete task', { exact: true })).toHaveCount(0);
        await expect.poll(async () => page.evaluate(([taskTitle, taskId]) => {
            const root = document.querySelector('#app') as any;
            const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks');
            const living = tasks?.rawTasks.find((task: any) => task.id === taskId);
            const completion = tasks?.rawTasks.find((task: any) => task.recurrenceParentId === taskId && task.isCompletionRecord);
            return {
                title: living?.title,
                status: living?.status,
                dueDate: living?.dueDate,
                doneForNowUntil: living?.doneForNowUntil,
                recurrenceCount: living?.recurrenceCount,
                completionDueDate: completion?.dueDate,
                completionStatus: completion?.status,
            };
        }, [taskTitle, taskId])).toEqual({
            title: taskTitle,
            status: 'todo',
            dueDate: '2026-07-24',
            doneForNowUntil: '2026-07-24',
            recurrenceCount: 1,
            completionDueDate: '2026-07-23',
            completionStatus: 'done',
        });

        await page.reload();
        await page.waitForSelector('.all-tasks-view');
        await expect.poll(async () => page.evaluate((taskId) => {
            const root = document.querySelector('#app') as any;
            const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks');
            const living = tasks?.rawTasks.find((task: any) => task.id === taskId);
            return {
                status: living?.status,
                dueDate: living?.dueDate,
                doneForNowUntil: living?.doneForNowUntil,
                recurrenceCount: living?.recurrenceCount,
            };
        }, taskId)).toEqual({
            status: 'todo',
            dueDate: '2026-07-24',
            doneForNowUntil: '2026-07-24',
            recurrenceCount: 1,
        });
    });
});
