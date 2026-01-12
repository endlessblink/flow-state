
import { test, expect } from '@playwright/test';

test('inspect sync state', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.goto('http://localhost:5546');
    await page.waitForSelector('.app-layout', { timeout: 10000 });

    // Open Canvas
    const canvasLink = page.locator('text=Canvas').first();
    if (await canvasLink.isVisible()) {
        await canvasLink.click();
    }
    await page.waitForTimeout(3000);

    // Check logs for specific warnings
    const skips = logs.filter(l => l.includes('Sync skipped'));
    console.log('Sync Skip Warnings:', skips);

    // Inject script to check state
    const state = await page.evaluate(() => {
        // We'll try to access the window debug object if available
        // CanvasView.vue mounts: window.__POMO_FLOW_DEBUG__
        const debug = (window as any).__POMO_FLOW_DEBUG__;
        if (!debug) return { error: 'No debug object found' };

        // We need to access internal state of orchestrator -> actions -> operationState
        // This is tricky without direct access.
        // But we can check if nodes are empty
        return {
            nodesLength: debug.orchestrator.nodes.value.length,
            isCanvasReady: debug.orchestrator.isCanvasReady.value,
            operationLoading: debug.orchestrator.operationLoading.value
        };
    });

    console.log('State Dump:', state);
});
