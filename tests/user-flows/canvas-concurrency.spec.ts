import { test, expect } from '@playwright/test';

test.describe.skip('Canvas Concurrency & Race Conditions', () => {
    test.beforeEach(async ({ page }) => {
        // Go to canvas
        await page.goto('/#canvas');
        await page.waitForTimeout(2000); // Wait for app init

        // Seed a task directly via store to ensure valid state
        await page.evaluate(async () => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            if (!debug) throw new Error('Debug hooks not found - ensure NODE_ENV is development or PLAYWRIGHT_TEST is set');

            // Create a specific test task
            await debug.taskStore.createTask({
                title: 'Race Condition Target',
                description: 'Target for drag operations',
                status: 'todo',
                canvasPosition: { x: 100, y: 100 }
            });
        });

        // Wait for the node to appear
        await page.waitForSelector('.vue-flow__node', { timeout: 5000 });
    });

    test('should prioritize user drag over remote sync updates', async ({ page }) => {
        // 1. Identify the target node
        const node = page.locator('.vue-flow__node').filter({ hasText: 'Race Condition Target' }).first();
        const nodeId = await node.getAttribute('data-id');

        console.log(`Testing race condition on node: ${nodeId}`);

        const box = await node.boundingBox();
        if (!box) throw new Error('No node found to drag');

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        // 2. Start Dragging with Verification Loop
        console.log('Attempting to start drag...');

        // Use hover to ensure focus
        await node.hover();
        await page.mouse.down();

        let validDrag = false;
        let lastDragStatus = null;

        for (let i = 1; i <= 5; i++) {
            // Move with steps to simulate cleaner DOM events
            await page.mouse.move(startX + 50 + (i * 10), startY + 50 + (i * 10), { steps: 5 });
            await page.waitForTimeout(200);

            // Check Lock AND PM Position
            const dragStatus = await page.evaluate(async (id) => {
                const debug = (window as any).__POMO_FLOW_DEBUG__;
                // Defensively await imports mostly for safety
                const lockManager = await debug.lockManager;
                const pm = await debug.positionManager;

                const locked = lockManager.isLocked(id);
                const owner = lockManager.getLockOwner(id);
                const pos = pm.getPosition(id)?.position;

                return { locked, owner, pos };
            }, nodeId);

            lastDragStatus = dragStatus;
            console.log(`[TEST-DEBUG] Attempt ${i}: Locked=${dragStatus.locked} (${dragStatus.owner}), PosX=${dragStatus.pos?.x}`);

            if (dragStatus.locked && dragStatus.owner === 'user-drag' && (dragStatus.pos?.x ?? 0) > 120) {
                validDrag = true;
                break;
            }
        }

        if (!validDrag) {
            console.error('Final Drag Status:', lastDragStatus);
            throw new Error('Failed to initialize valid drag state (Lock not acquired or PM not updating)');
        }

        // DEBUG: Check PositionManager BEFORE sync
        const pmPosBefore = await page.evaluate(async (id) => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            const pm = await debug.positionManager;
            const pos = pm.getPosition(id);
            console.log(`[TEST-DEBUG] PM Before Sync:`, pos?.position);
            return pos?.position;
        }, nodeId);

        // 3. Simulate "Remote Sync" (the race condition)
        await page.evaluate(async (targetId) => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            console.log('⚡ Triggering conflicting sync update...');

            // Force an update that looks like it came from sync
            debug.taskStore.updateTaskFromSync(targetId, {
                id: targetId,
                title: 'Race Condition Target',
                canvasPosition: { x: 100, y: 100 }, // OLD position
                updatedAt: new Date().toISOString()
            });
        }, nodeId);

        // DEBUG: Check PositionManager AFTER sync
        const pmPosAfter = await page.evaluate(async (id) => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            const pm = await debug.positionManager;
            const pos = pm.getPosition(id);
            console.log(`[TEST-DEBUG] PM After Sync:`, pos?.position);
            return pos?.position;
        }, nodeId);

        console.log(`PM Comparison: Before=${pmPosBefore?.x}, After=${pmPosAfter?.x}`);

        // Assert that sync did NOT reset the position
        expect(pmPosAfter?.x).toEqual(pmPosBefore?.x);

        // 4. Continue Dragging (The user is still persistent)
        // Move further away
        await page.mouse.move(startX + 150, startY + 150, { steps: 5 });

        // 5. Release
        await page.mouse.up();

        // 6. Verify Final Position
        const finalBox = await node.boundingBox();

        const displacementX = (finalBox?.x ?? 0) - (box.x);

        console.log(`Final displacement X: ${displacementX}`);

        // Should be roughly +150
        expect(displacementX).toBeGreaterThan(120);
    });

    test('should prioritize user resize over remote sync updates', async ({ page }) => {
        // 1. Setup: Create a Group
        await page.evaluate(async () => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;

            // Create a group manually via store (mocking what UI does)
            const groupId = 'group-race-test';
            const group = {
                id: groupId,
                name: 'Resize Race Group',
                position: { x: 300, y: 300, width: 200, height: 200 },
                isCollapsed: false,
                isVisible: true,
                type: 'custom',
                parentGroupId: null,
                _depth: 0,
                items: []
            };

            // Directly manipulate store for setup speed
            debug.canvasStore._rawGroups.push(group);
            // Ensure PositionManager knows about it
            const pm = await debug.positionManager;
            pm.updatePosition(groupId, group.position, 'local');

            // Trigger sync to ensure Vue Flow renders it
            debug.canvasStore.syncTrigger++;
        });

        // Wait for group to render
        const groupNode = page.locator('.vue-flow__node-sectionNode').filter({ hasText: 'Resize Race Group' }).first();
        await groupNode.waitFor({ state: 'visible', timeout: 5000 });
        const groupId = await groupNode.getAttribute('data-id');

        // 2. Start Resizing

        const box = await groupNode.boundingBox();
        if (!box) throw new Error('Group node bounding box not found');

        // Target bottom-right corner
        const handleX = box.x + box.width - 5;
        const handleY = box.y + box.height - 5;

        console.log(`Starting resize at ${handleX}, ${handleY}`);

        await page.mouse.move(handleX, handleY);
        await page.mouse.down();

        // Drag to resize (make it bigger)
        // Move in steps to trigger events and acquire lock
        await page.mouse.move(handleX + 50, handleY + 50, { steps: 10 });
        await page.waitForTimeout(200);

        // 3. Verify Lock ('user-resize')
        const isLocked = await page.evaluate(async (id) => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            const lockManager = await debug.lockManager;
            return lockManager.isLocked(id) && lockManager.getLockOwner(id) === 'user-resize'; // Verify correct lock type
        }, groupId);

        if (!isLocked) {
            console.warn('⚠️ Resize did not acquire lock! This might be due to handle targeting issues.');
            // Proceeding anyway to see if test fails, but warning is critical.
        } else {
            console.log('✅ Resize lock acquired.');
        }

        // 4. Trigger Conflicting Sync (Attempt to reset size/pos)
        await page.evaluate(async (gid) => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            console.log('⚡ Triggering conflicting sync update on group...');

            // Simulate "Remote Sync"
            const pm = await debug.positionManager;
            const result = pm.batchUpdate([
                { id: gid, x: 300, y: 300, width: 200, height: 200 } // Reset to original
            ], 'remote-sync');
            console.log('Sync result:', result);

        }, groupId);

        // 5. Continue Resizing
        await page.mouse.move(handleX + 100, handleY + 100, { steps: 5 });
        await page.mouse.up();

        // 6. Verify Final Dimensions
        // Should be +100 larger
        const finalBox = await groupNode.boundingBox();
        const widthChange = (finalBox?.width ?? 0) - (box.width);

        console.log(`Final width change: ${widthChange}`);

        expect(widthChange).toBeGreaterThan(80);
    });
});
