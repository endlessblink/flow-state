import { test, expect } from '@playwright/test';

test.describe('BUG-153: Zombie Task Movement', () => {
    test('Attached task should move with parent group', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes

        console.log('--- TEST START ---');
        await page.goto('/');

        // Auth Handling
        try {
            const signInBtn = page.locator('button', { hasText: 'Sign In' });
            if (await signInBtn.isVisible({ timeout: 5000 })) {
                console.log('Logging in...');
                await signInBtn.click();
                await page.fill('input[type="email"]', 'test@example.com');
                await page.fill('input[type="password"]', 'password');
                await page.click('button[type="submit"]');
            }
        } catch (e) {
            console.log('Auth check skipped or failed (might be already logged in)');
        }

        // Navigate to Canvas
        console.log('Navigating to Canvas...');
        try {
            // Try explicit link first
            await page.click('a[href="#/canvas"]', { timeout: 5000 });
        } catch {
            // Dismiss potential modals (Welcome/Changelog) blocking the UI
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Aggressively remove modal manager if it's blocking
            await page.evaluate(() => {
                const modal = document.querySelector('.modal-manager');
                if (modal) modal.remove();
            });
            await page.waitForTimeout(500);

            // Try text
            await page.click('text=Canvas');
        }

        // Wait for Canvas Load
        await page.waitForSelector('.vue-flow__pane', { state: 'visible', timeout: 30000 });
        console.log('Canvas loaded.');

        // Reset View
        await page.mouse.click(500, 300);

        // 1. Create a Group (Shift+G)
        console.log('Creating Group...');
        await page.keyboard.press('Shift+G');
        const group = page.locator('.section-node').first();
        await group.waitFor({ state: 'visible', timeout: 10000 });

        const groupBoxBefore = await group.boundingBox();
        if (!groupBoxBefore) throw new Error('Group not found');
        console.log('Initial Group:', groupBoxBefore);

        // 2. Create a Task (n)
        console.log('Creating Task...');
        // Move mouse away to ensure task isn't auto-dropped inside immediately
        await page.mouse.move(groupBoxBefore.x + 400, groupBoxBefore.y);
        await page.keyboard.press('n');
        const task = page.locator('.task-node').first();
        await task.waitFor({ state: 'visible' });

        const taskBoxBefore = await task.boundingBox();
        if (!taskBoxBefore) throw new Error('Task not found');
        console.log('Initial Task:', taskBoxBefore);

        // 3. Drag Task INTO Group
        console.log('Dragging Task into Group...');
        const taskCenterX = taskBoxBefore.x + taskBoxBefore.width / 2;
        const taskCenterY = taskBoxBefore.y + taskBoxBefore.height / 2;
        const groupCenterX = groupBoxBefore.x + groupBoxBefore.width / 2;
        const groupCenterY = groupBoxBefore.y + groupBoxBefore.height / 2;

        await page.mouse.move(taskCenterX, taskCenterY);
        await page.mouse.down();
        await page.mouse.move(groupCenterX, groupCenterY, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(2000); // Sync Wait

        // Verify Task is visually inside
        const taskBoxAfterDrag = await task.boundingBox();
        if (!taskBoxAfterDrag) throw new Error('Task lost after drag');
        console.log('Task After Drag:', taskBoxAfterDrag);

        expect(taskBoxAfterDrag.x).toBeGreaterThan(groupBoxBefore.x);
        expect(taskBoxAfterDrag.x).toBeLessThan(groupBoxBefore.x + groupBoxBefore.width);

        // 4. Move the Group
        console.log('Moving Group...');
        const dragStartX = groupBoxBefore.x + 20;
        const dragStartY = groupBoxBefore.y + 20;
        const deltaX = 100;
        const deltaY = 50;

        await page.mouse.move(dragStartX, dragStartY);
        await page.mouse.down();
        await page.mouse.move(dragStartX + deltaX, dragStartY + deltaY, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(2000); // Sync Wait

        // 5. Verify Positions
        const groupBoxFinal = await group.boundingBox();
        const taskBoxFinal = await task.boundingBox();
        if (!groupBoxFinal || !taskBoxFinal) throw new Error('Element missing');

        console.log('Final Group:', groupBoxFinal);
        console.log('Final Task:', taskBoxFinal);

        // Group should have moved
        expect(groupBoxFinal.x).toBeCloseTo(groupBoxBefore.x + deltaX, -1);

        // Task should have moved by SAME DELTA
        // Logic: Final Task X approx TaskAfterDrag X + Delta
        expect(taskBoxFinal.x).toBeCloseTo(taskBoxAfterDrag.x + deltaX, -1);
        expect(taskBoxFinal.y).toBeCloseTo(taskBoxAfterDrag.y + deltaY, -1); // Fails if task "stays put"

        console.log('--- TEST PASSED ---');
    });
});
