import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Canvas Drag-and-Drop Filter Logic', () => {
    test.setTimeout(120000); // Increase timeout for slow builds
    test.beforeEach(async ({ page }) => {
        // Clear debug log
        fs.writeFileSync('test_debug.log', 'STARTING TEST\n');

        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/');
        // Wait for app to be ready
        await page.waitForSelector('.flow-state-app');

        // Clear any existing tasks to start fresh
        await page.evaluate(() => {
            const store = (window as any).pinia.state.value.tasks;
            if (store) {
                store.tasks = [];
            }
        });

        // Enable console logging from browser to file
        page.on('console', msg => {
            const text = msg.text();
            fs.appendFileSync('test_debug.log', `BROWSER: ${text}\n`);
            if (msg.type() === 'error') {
                console.error(`BROWSER ERROR: ${text}`);
            } else {
                console.log(`BROWSER LOG: ${text}`);
            }
        });
    });

    test('should automatically apply "Today" date when dragging task to Canvas in "Today" view', async ({ page }) => {
        // 1. Create a task in the Inbox using store action to ensure reactivity
        const taskId = await page.evaluate(async () => {
            const store = (window as any).pinia._s.get('tasks');

            const task = await store.createTask({
                title: 'Test Task for Drag Drop',
                status: 'planned',
                isInInbox: true
            });
            return task.id;
        });
        console.log(`BROWSER LOG: Created task with ID: ${taskId}`);

        // 2. Switch Canvas to "Today" view
        await page.evaluate(() => {
            const store = (window as any).pinia._s.get('tasks');
            // Set smart view to 'today'
            store.activeSmartView = 'today';
            // Ensure activeSmartViews set has it too if using the new set-based logic
            if (store.activeSmartViews) {
                store.activeSmartViews.add('today');
            }
        });

        await page.waitForTimeout(500); // Wait for reactivity

        // Ensure inbox is visible and expanded
        const inboxPanel = page.locator('.unified-inbox-panel');
        const collapseBtn = inboxPanel.locator('.collapse-btn');

        // Check if collapsed (filters not visible)
        // The filters container class is .smart-filters-horizontal
        const filters = inboxPanel.locator('.smart-filters-horizontal');
        if (!await filters.isVisible()) {
            console.log('BROWSER LOG: Inbox collapsed, clicking collapse button to expand');
            await collapseBtn.click();
            await filters.waitFor({ state: 'visible', timeout: 2000 });
        }

        // Switch Inbox to 'All' filter to see the new task (which defaults to backlog)
        // Use a more specific locator for the filter tab
        const allFilterBtn = inboxPanel.locator('.filter-tab', { hasText: 'All' });
        if (await allFilterBtn.isVisible()) {
            await allFilterBtn.click();
            // Wait for tasks to update
            await page.waitForTimeout(500);
        } else {
            console.log('BROWSER LOG: All filter button not found');
        }

        // 3. Verify task is in Inbox but NOT on Canvas
        // Wait for inbox to populate
        await page.waitForTimeout(1000);
        const inboxTask = page.locator('.task-card', { hasText: 'Test Task for Drag Drop' });
        await expect(inboxTask).toBeVisible();

        const canvasNode = page.locator(`[data-node-id="task-${taskId}"]`);
        await expect(canvasNode).not.toBeVisible();

        // 4. Simulate Drop Event directly (bypassing UI drag flakiness)
        console.log('TEST LOG: Dispatching drop event now');
        await page.evaluate((id) => {
            const dropZone = document.querySelector('.canvas-drop-zone');
            if (!dropZone) throw new Error('Drop zone not found');

            const data = JSON.stringify({
                taskId: id,
                source: 'unified-inbox-standalone'
            });

            const event = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                clientX: 300,
                clientY: 300,
                dataTransfer: new DataTransfer()
            });

            event.dataTransfer?.setData('application/json', data);

            dropZone.dispatchEvent(event);
        }, taskId);

        // 5. Verify task APPEARS on Canvas
        // This expects the fix: the task should now have "Today" date and be visible
        await expect(canvasNode).toBeVisible({ timeout: 5000 });

        // 6. Verify task data was updated
        const taskData = await page.evaluate((id) => {
            const taskStore = (window as any).pinia.state.value.tasks;
            return taskStore.tasks.find((t: any) => t.id === id);
        }, taskId);

        // Check if it matches "Today" logic (dueDate or scheduledDate)
        const todayStr = new Date().toISOString().split('T')[0];
        const matchesToday = taskData.dueDate === todayStr ||
            (taskData.instances && taskData.instances.some((i: any) => i.scheduledDate === todayStr));

        expect(matchesToday).toBe(true);
    });
});
