
import { test, expect } from '@playwright/test';

test.describe('Canvas Functionality Repro', () => {
    test('should create group and drag task', async ({ page }) => {
        // 1. Load App
        await page.goto('http://localhost:5546');
        await page.waitForSelector('.app-layout', { timeout: 10000 });

        // 2. Go to Canvas
        const canvasLink = page.locator('text=Canvas').first();
        if (await canvasLink.isVisible()) {
            await canvasLink.click();
        }
        await page.waitForSelector('.vue-flow', { timeout: 5000 });

        // 3. Create Group via Shift+G
        await page.keyboard.press('Shift+G');
        await page.waitForTimeout(1000);

        // 4. Verify Group Exists
        const groupNode = page.locator('.vue-flow__node[data-id^="section-"]').first();
        const count = await page.locator('.vue-flow__node[data-id^="section-"]').count();
        console.log(`Groups found: ${count}`);

        if (count === 0) {
            console.log('❌ Failed to create group via Shift+G');
            // Try Context Menu
            await page.mouse.click(500, 300, { button: 'right' });
            await page.waitForSelector('.context-menu', { timeout: 2000 });
            await page.locator('text=New Group').click();
            await page.waitForTimeout(1000);
        }

        await expect(page.locator('.vue-flow__node[data-id^="section-"]')).toBeVisible({ timeout: 5000 });
        const groupId = await groupNode.getAttribute('data-id');
        console.log(`Created Group ID: ${groupId}`);

        // 5. Create Task via Double Click
        // Click inside the group? Or outside?
        // Let's click at 300, 300 (assuming group is at center or we can find it)
        const groupBox = await groupNode.boundingBox();
        if (groupBox) {
            const taskX = groupBox.x + 50;
            const taskY = groupBox.y + 50;
            await page.mouse.dblclick(taskX, taskY);
            await page.waitForTimeout(1000);

            // Should create a task
            const taskNode = page.locator('.vue-flow__node:not([data-id^="section-"])').first();
            await expect(taskNode).toBeVisible();
            console.log('✅ Task Created');

            // 6. Test Dragging
            const taskBox = await taskNode.boundingBox();
            if (taskBox) {
                console.log('Attempting drag...');
                await page.mouse.move(taskBox.x + 10, taskBox.y + 10);
                await page.mouse.down();
                await page.mouse.move(taskBox.x + 200, taskBox.y + 100, { steps: 10 });
                await page.mouse.up();
                await page.waitForTimeout(500);

                // Check position
                const newTaskBox = await taskNode.boundingBox();
                if (newTaskBox && Math.abs(newTaskBox.x - taskBox.x) > 50) {
                    console.log('✅ Task Moved');
                } else {
                    console.log('❌ Task did not move significantly');
                    throw new Error('Task did not move');
                }
            }
        }
    });
});
