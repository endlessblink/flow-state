
import { test, expect } from '@playwright/test';

test.describe('Scenario 21: Unrelated Group Independence', () => {
    test('Moving one group should NOT move unrelated groups', async ({ page }) => {
        // --- Setup (Boilerplate) ---
        test.setTimeout(120000);
        console.log('--- TEST START ---');
        page.on('console', msg => {
            if (msg.text().startsWith('[TEST]') || msg.text().startsWith('[TEST-DEBUG]') || msg.text().startsWith('[BUG-153 DEBUG]')) {
                console.log(msg.text());
            }
        });
        await page.goto('/#/canvas');

        // --- Setup ---
        // Enable the testing backdoor before navigation
        await page.addInitScript(() => {
            (window as any).PLAYWRIGHT_TEST = true;
        });

        console.log('--- TEST START ---');
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
            console.log('Login check passed or skipped');
        }

        // FORCE NAVIGATE to Canvas (in case login redirected to board)
        await page.goto('http://localhost:5546/canvas');
        // WAIT FOR CANVAS ELEMENT instead of strict URL (handle hash routing)
        await expect(page.locator('.canvas-layout')).toBeVisible({ timeout: 20000 });

        await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 30000 });
        console.log('Canvas loaded.');

        // Dismiss potential modals
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

        // 1. Create Group A and Group B directly via the store for maximum stability
        console.log('[TEST] Injecting groups directly into store...');
        await page.evaluate(async () => {
            const debug = (window as any).__POMO_FLOW_DEBUG__;
            if (!debug) throw new Error('Testing backdoor not found');

            const { canvasStore, orchestrator } = debug;

            // Create Group A
            await canvasStore.createGroup({
                name: 'Group A',
                color: '#6366f1',
                position: { x: 100, y: 100, width: 300, height: 200 },
                type: 'custom',
                layout: 'freeform',
                updatedAt: new Date().toISOString()
            });

            // Create Group B - far away
            await canvasStore.createGroup({
                name: 'Group B',
                color: '#ec4899',
                position: { x: 800, y: 100, width: 300, height: 200 },
                type: 'custom',
                layout: 'freeform',
                updatedAt: new Date().toISOString()
            });

            // Force sync to Vue Flow
            orchestrator.syncNodes();
        });

        // Wait for nodes to appear in Vue Flow
        await expect(page.locator('.section-node')).toHaveCount(2, { timeout: 15000 });
        console.log('[TEST] Groups injected and visible');

        const groupA = page.locator('.section-node').filter({ hasText: 'Group A' });
        const groupB = page.locator('.section-node').filter({ hasText: 'Group B' });

        const groupABox = await groupA.boundingBox();
        const groupBBox = await groupB.boundingBox();
        if (!groupABox || !groupBBox) throw new Error('Groups not properly rendered');

        // Get initial position of Group B
        const initialBoxB = await groupB.boundingBox();
        if (!initialBoxB) throw new Error('Group B not found');
        console.log(`[TEST] Group B Initial: (${initialBoxB.x}, ${initialBoxB.y})`);

        // IMPORTANT: Deselect everything before dragging Group A
        console.log('[TEST] Deselecting all...');
        await page.click('.vue-flow__pane');
        await page.waitForTimeout(200);

        // LOG SELECTION STATE
        const selectedCount = await page.evaluate(() => {
            return document.querySelectorAll('.vue-flow__node.selected').length;
        });
        console.log(`[TEST] Selected nodes count after deselection: ${selectedCount}`);

        // 3. Drag Group A
        const dragDistance = 100;
        console.log('[TEST] Dragging Group A...');
        await page.mouse.move(groupABox.x + 20, groupABox.y + 20);
        await page.mouse.down();

        // LOG SELECTION STATE DURING DRAG START
        const selectedCountDuringDrag = await page.evaluate(() => {
            return document.querySelectorAll('.vue-flow__node.selected').length;
        });
        console.log(`[TEST] Selected nodes count at drag start: ${selectedCountDuringDrag}`);

        await page.mouse.move(groupABox.x + 20 + dragDistance, groupABox.y + 20 + dragDistance, { steps: 10 });
        await page.mouse.up();
        console.log('[TEST] Drag Group A finished');
        await page.waitForTimeout(1000); // Wait for sync

        // 4. Check Group B position
        console.log('--- Step 7: Verifying results ---');

        // Log hierarchy
        await page.evaluate(() => {
            const nodes = document.querySelectorAll('.vue-flow__node');
            console.log(`[TEST] Total nodes on canvas: ${nodes.length}`);
            nodes.forEach(n => {
                const id = n.getAttribute('data-id');
                const isSelected = n.classList.contains('selected');
                const hasParent = n.hasAttribute('data-parent'); // Vue Flow might use this or something else
                console.log(`[TEST] Node ${id}: selected=${isSelected}, classes=${n.className}`);
            });
        });

        // Allow a tiny margin for float precision/rendering, but it should be basically identical
        const finalBoxB = await groupB.boundingBox();
        if (!finalBoxB) throw new Error('Group B lost after drag');
        console.log(`[TEST] Group B Final: (${finalBoxB.x}, ${finalBoxB.y})`);

        const xDiff = Math.abs(finalBoxB.x - initialBoxB.x);
        const yDiff = Math.abs(finalBoxB.y - initialBoxB.y);

        console.log(`[TEST] Group B moved by: dx=${xDiff}, dy=${yDiff}`);

        expect(xDiff).toBeLessThan(2); // Should not move
        expect(yDiff).toBeLessThan(2); // Should not move
    });
});
