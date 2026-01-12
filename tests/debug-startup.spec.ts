
import { test, expect } from '@playwright/test';

test('capture startup errors', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => messages.push(`[UNCAUGHT] ${err.message}`));

    try {
        await page.goto('http://localhost:5546');
        await page.waitForSelector('.app-layout', { timeout: 5000 });
    } catch (e) {
        console.log('--- BROWSER CONSOLE LOGS ---');
        messages.forEach(m => console.log(m));
        console.log('---------------------------');
        throw e;
    }
});
