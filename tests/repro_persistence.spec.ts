
import { test, expect } from '@playwright/test';

test.describe('Scenario 6: Layout Persistence', () => {
    test('Nested groups and tasks should persist positions after reload', async ({ page }) => {
        // --- Setup ---
        test.setTimeout(120000);
        console.log('--- TEST START: PERSISTENCE ---');

        await page.goto('http://localhost:5546/canvas');

        // Authenticate if needed
        const loginForm = page.locator('input[type="email"]');
        try {
            if (await loginForm.isVisible({ timeout: 5000 })) {
                console.log('Logging in...');
                await loginForm.fill('test@example.com');
                await page.fill('input[type="password"]', 'password');
                await page.click('button[type="submit"]');
                await page.waitForURL('**/canvas');
            }
        } catch (e) {
            console.log('Login check passed');
        }

        // FORCE NAVIGATE to Canvas (in case login redirected to board)
        await page.goto('http://localhost:5546/canvas');
        // WAIT FOR CANVAS ELEMENT instead of strict URL (handle hash routing)
        await expect(page.locator('.canvas-layout')).toBeVisible({ timeout: 20000 });

        await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 30000 });
        console.log('Canvas loaded.');

        await page.addInitScript(() => {
            (window as any).PLAYWRIGHT_TEST = true;
        });

        // 1. Inject Nested Layout
        // Group A (Parent) -> Group B (Nested) -> Task 1 (Nested in B)
        console.log('[TEST] Injecting nested layout...');
        const ids = await page.evaluate(async () => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            if (!debug) throw new Error('Testing backdoor not found');
            const { canvasStore, taskStore, orchestrator } = debug;

            // Create Parent Group A
            const groupA = await canvasStore.createGroup({
                name: 'Parent Group',
                color: '#6366f1',
                position: { x: 100, y: 100, width: 500, height: 400 },
                type: 'custom',
                updatedAt: new Date().toISOString()
            });

            // Create Child Group B (Nested in A)
            // Position is RELATIVE in code logic, but store.createGroup usually takes absolute if following "Canvas 2.0 Store" rules 
            // but let's check current createGroup implementation.
            // Actually, createGroup inputs are usually treated as "World/Absolute" by default in store actions unless specified.
            // Let's assume we pass Absolute, and store handles it.
            // Wait, if we want strict control, we should use `createGroup` then `updateGroup` to reparent.

            // Create B at Absolute (200, 200) -> Inside A (100, 100)
            const groupB = await canvasStore.createGroup({
                name: 'Child Group',
                color: '#ec4899',
                position: { x: 200, y: 200, width: 200, height: 150 },
                type: 'custom',
                updatedAt: new Date().toISOString()
            });

            // Create Task 1 at Absolute (250, 250) -> Inside B (200, 200)
            const task1 = await taskStore.createTask({
                title: 'Nested Task',
                status: 'todo',
                canvasPosition: { x: 250, y: 250 },
                updatedAt: new Date().toISOString()
            });

            // REPARENTING
            // A is Root.
            // B -> Parent A.
            await canvasStore.updateGroup(groupB.id, { parentGroupId: groupA.id });

            // Task 1 -> Parent B.
            await taskStore.updateTask(task1.id, { parentId: groupB.id });

            orchestrator.syncNodes();

            return { groupAId: groupA.id, groupBId: groupB.id, taskId: task1.id };
        });

        console.log('[TEST] Layout injected:', ids);

        // Wait for render
        await expect(page.locator(`[data-id="${ids.groupAId}"]`)).toBeVisible();
        await expect(page.locator(`[data-id="${ids.groupBId}"]`)).toBeVisible();
        await expect(page.locator(`[data-id="${ids.taskId}"]`)).toBeVisible();

        // Check Initial Positions (Visual/DOM)
        const getPositions = async () => {
            const boxA = await page.locator(`[data-id="${ids.groupAId}"]`).boundingBox();
            const boxB = await page.locator(`[data-id="${ids.groupBId}"]`).boundingBox();
            const boxT = await page.locator(`[data-id="${ids.taskId}"]`).boundingBox();
            return { boxA, boxB, boxT };
        };

        const initial = await getPositions();
        console.log('[TEST] Initial Positions:', initial);
        if (!initial.boxA || !initial.boxB || !initial.boxT) throw new Error('Elements missing');

        // A is at ~100,100. B is at ~200,200. T is at ~250,250.
        expect(Math.abs(initial.boxA.x - 100)).toBeLessThan(50); // Allowing for margin/padding/viewport offset

        // 2. RELOAD PAGE
        console.log('[TEST] Reloading page...');
        await page.reload();
        await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 30000 });
        // Wait for nodes (sometimes takes a moment to sync from DB)
        await expect(page.locator(`[data-id="${ids.groupAId}"]`)).toBeVisible({ timeout: 10000 });

        const afterReload1 = await getPositions();
        console.log('[TEST] Post-Reload 1 Positions:', afterReload1);

        // Check Stability
        expect(Math.abs(afterReload1.boxA!.x - initial.boxA.x)).toBeLessThan(2);
        expect(Math.abs(afterReload1.boxA!.y - initial.boxA.y)).toBeLessThan(2);

        expect(Math.abs(afterReload1.boxB!.x - initial.boxB.x)).toBeLessThan(2);
        expect(Math.abs(afterReload1.boxB!.y - initial.boxB.y)).toBeLessThan(2);

        expect(Math.abs(afterReload1.boxT!.x - initial.boxT.x)).toBeLessThan(2);
        expect(Math.abs(afterReload1.boxT!.y - initial.boxT.y)).toBeLessThan(2);

        console.log('[TEST] Persistence Check 1 PASSED (Static)');

        // 3. DRAG PARENT (Group A)
        // Drag A by +100, +100
        console.log('[TEST] Dragging Parent Group A...');
        await page.mouse.move(initial.boxA.x + 20, initial.boxA.y + 20);
        await page.mouse.down();
        await page.mouse.move(initial.boxA.x + 120, initial.boxA.y + 120, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(2000); // Wait for sync/cascade

        const afterDrag = await getPositions();
        console.log('[TEST] Post-Drag Positions:', afterDrag);

        // Verify A moved locally
        expect(afterDrag.boxA!.x).toBeGreaterThan(initial.boxA.x + 90);

        // Verify B followed (A moved ~100, B was inside A)
        // Since B is relative to A, B should also move ~100 in World Space
        expect(afterDrag.boxB!.x).toBeGreaterThan(initial.boxB.x + 90);

        // Verify Task followed (Cascade Update)
        expect(afterDrag.boxT!.x).toBeGreaterThan(initial.boxT.x + 90);

        // 4. RELOAD PAGE AGAIN
        console.log('[TEST] Reloading page after drag...');
        await page.reload();
        await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 30000 });
        await expect(page.locator(`[data-id="${ids.groupAId}"]`)).toBeVisible({ timeout: 10000 });

        const afterReload2 = await getPositions();
        console.log('[TEST] Post-Reload 2 Positions:', afterReload2);

        // Check Persistence of New Positions
        expect(Math.abs(afterReload2.boxA!.x - afterDrag.boxA!.x)).toBeLessThan(2);
        expect(Math.abs(afterReload2.boxA!.y - afterDrag.boxA!.y)).toBeLessThan(2);

        expect(Math.abs(afterReload2.boxB!.x - afterDrag.boxB!.x)).toBeLessThan(2);
        expect(Math.abs(afterReload2.boxB!.y - afterDrag.boxB!.y)).toBeLessThan(2);

        expect(Math.abs(afterReload2.boxT!.x - afterDrag.boxT!.x)).toBeLessThan(2);
        expect(Math.abs(afterReload2.boxT!.y - afterDrag.boxT!.y)).toBeLessThan(2);

        console.log('[TEST] Persistence Check 2 PASSED (Dynamic)');
    });
});
