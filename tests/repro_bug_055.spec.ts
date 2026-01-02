import { test, expect } from '@playwright/test';

test.describe('BUG-055 Representation: Group Resize Persistence', () => {
    test('tasks should maintain position after group resize and reload', async ({ page }) => {
        // 1. Setup: Load app
        await page.goto('http://localhost:5546');
        await page.waitForSelector('.vue-flow', { timeout: 10000 });

        // 2. Clear existing state (optional, but good for isolation)
        await page.evaluate(() => {
            const store = (window as any).canvasStore;
            if (store) {
                // Ideally we'd use a clean slate, but for now let's rely on finding/creating a test group
                console.log('Test setup: Checking stores...');
            }
        });

        // 3. Create a test group and task via console to ensure known state
        // We use the exposed window objects or internal application logic if accessible, 
        // but since we are in e2e, we'll try to use the UI or accessible globals if available for setup shortcuts.
        // For reliability in this specific repro, UI interaction is safer if globals aren't guaranteed.

        // Let's create a group manually via UI
        // Right click to open context menu
        await page.mouse.move(300, 300);
        await page.mouse.down({ button: 'right' });
        await page.mouse.up({ button: 'right' });

        // Click "Create Group"
        await page.getByText('Create Group', { exact: false }).first().click();
        await page.keyboard.type('Repro Group');
        await page.keyboard.press('Enter');

        // Wait for group to appear
        const group = page.locator('[data-id^="section-"]').last();
        await expect(group).toBeVisible();
        const groupId = await group.getAttribute('data-id');

        // Create a task inside the group
        // Right click inside the group
        const groupBox = await group.boundingBox();
        if (!groupBox) throw new Error('Group not found');

        await page.mouse.move(groupBox.x + 50, groupBox.y + 100);
        await page.mouse.down({ button: 'right' });
        await page.mouse.up({ button: 'right' });

        await page.getByText('Add Task Here').first().click();
        await page.getByPlaceholder('What needs to be done?').fill('Repro Task');
        await page.getByRole('button', { name: 'Create' }).click(); // Assuming 'Create' or similar
        // Fallback if QuickTask modal differs: press Enter
        await page.keyboard.press('Enter');

        // Wait for task
        const task = page.locator('.task-node').filter({ hasText: 'Repro Task' }).first();
        await expect(task).toBeVisible();

        // Get initial positions
        const taskBoxBefore = await task.boundingBox();
        if (!taskBoxBefore) throw new Error('Task not created');

        console.log(`Initial Task Y: ${taskBoxBefore.y}`);

        // 4. Resize the group from the TOP edge (this causes position change)
        // We need to find the top resize handle
        // Hover group to show handles
        await group.hover();

        // The top handle usually forces a position.y update for the group
        // If we only resize bottom/right, position.x/y of group doesn't change, only width/height.
        // BUG-055 specifically mentions "resizing from left/top edges".

        // Move mouse to top edge
        await page.mouse.move(groupBox.x + groupBox.width / 2, groupBox.y);
        await page.mouse.down();
        // Drag UP by 50px
        await page.mouse.move(groupBox.x + groupBox.width / 2, groupBox.y - 50);
        await page.mouse.up();

        // Wait for "settling" (debounce/sync)
        await page.waitForTimeout(2000);

        // 5. Check visual position immediately (Should be correct due to visual-only fix)
        const taskBoxAfterResize = await task.boundingBox();
        if (!taskBoxAfterResize) throw new Error('Task lost after resize');

        // logic: Task should NOT have moved visibly on screen? 
        // Actually, if I expand the group upwards, the group's Y decreases. 
        // The implementation logic I saw in CanvasView.vue applies an INVERSE delta to tasks.
        // So if Group Y goes -50, Task Local Y should go +50 to stay in same Absolute screen pos?
        // Or if tasks are children, their screen pos = GroupPos + LocalPos.
        // If GroupPos changes, Task Screen Pos changes unless LocalPos is updated.
        // The previous fix claims to "keep tasks visually at their absolute canvas position".
        // So distinct visual check:
        expect(Math.abs(taskBoxAfterResize.y - taskBoxBefore.y)).toBeLessThan(5); // Tolerance

        console.log('Visual check passed. Now reloading...');

        // 6. Reload Page (Crucial Step: verifies persistence to Store/DB)
        await page.reload();
        await page.waitForSelector('.vue-flow', { timeout: 10000 });

        // 7. Find task again
        const taskAfterReload = page.locator('.task-node').filter({ hasText: 'Repro Task' }).first();
        await expect(taskAfterReload).toBeVisible();

        const taskBoxAfterReload = await taskAfterReload.boundingBox();
        if (!taskBoxAfterReload) throw new Error('Task lost after reload');

        console.log(`Reload Task Y: ${taskBoxAfterReload.y}`);

        // 8. Assert: Position should still be the same
        // If BUG-055 exists (persistence failure), the task will jump because 
        // the Group's new position was saved, but the Task's "compensated" local position was NOT saved.
        expect(Math.abs(taskBoxAfterReload.y - taskBoxBefore.y)).toBeLessThan(5);
    });
});
