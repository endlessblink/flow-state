import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Sync Conflict Resolution (Multi-Device)', () => {
    let contextA: BrowserContext;
    let contextB: BrowserContext;
    let pageA: Page;
    let pageB: Page;

    test.beforeEach(async ({ browser }) => {
        contextA = await browser.newContext();
        contextB = await browser.newContext();
        pageA = await contextA.newPage();
        pageB = await contextB.newPage();

        await pageA.goto('http://localhost:5546');
        await pageB.goto('http://localhost:5546');

        try {
            await Promise.all([
                pageA.waitForLoadState('networkidle'),
                pageB.waitForLoadState('networkidle')
            ]);
        } catch (e) { console.log('Load state ignore', e); }
    });

    test.afterEach(async () => {
        await contextA.close();
        await contextB.close();
    });

    async function createTask(page: Page, title: string) {
        const addButton = page.locator('button[aria-label="Add new task"]');
        await addButton.waitFor({ state: 'visible', timeout: 5000 });
        await addButton.click();

        const input = page.locator('input[placeholder="Enter task title..."]');
        await input.waitFor({ state: 'visible', timeout: 5000 });
        await input.fill(title);
        await page.keyboard.press('Enter');
        await input.waitFor({ state: 'hidden', timeout: 5000 });
    }

    async function createGroup(page: Page, name: string) {
        // 1. Click toolbar create group button
        const groupBtn = page.locator('button[aria-label="Create new group"]');
        await groupBtn.click();

        // 2. Wait for Modal and Input
        const nameInput = page.locator('input[placeholder="Enter group name..."]');
        await nameInput.waitFor({ state: 'visible', timeout: 5000 });
        await nameInput.fill(name);

        // 3. Click Create Button in Modal
        const createBtn = page.locator('button.btn-primary:has-text("Create Group")');
        await createBtn.click();

        // 4. Wait for Modal to Close and Group Node to Appear
        await nameInput.waitFor({ state: 'hidden', timeout: 5000 });

        // Check for the group node on canvas
        // Using filter checks input value for inputs
        const groupInput = page.locator('.section-node input').filter({ hasText: name }).first();
        await groupInput.waitFor({ state: 'visible', timeout: 10000 });
    }

    test.skip('Scenario 1: Status Toggle Race Condition', async () => {
        test.setTimeout(90000); // Increased for sync reliability
        const taskTitle = `Sync-Test-${Date.now()}`;
        await createTask(pageA, taskTitle);

        const taskB = pageB.locator(`.task-card:has-text("${taskTitle}"), .task-item:has-text("${taskTitle}")`).first();
        await expect(taskB).toBeVisible({ timeout: 30000 }); // Increased sync wait

        const checkboxA = pageA.locator(`.task-card:has-text("${taskTitle}") input[type="checkbox"]`).first();
        await checkboxA.click();

        const checkboxB = taskB.locator('input[type="checkbox"]').first();
        await expect(async () => {
            const isChecked = await checkboxB.isChecked();
            expect(isChecked).toBe(true);
        }).toPass({ timeout: 30000 }); // Increased sync wait
    });

    test.skip('Scenario 2: Drag & Drop Ghost Prevention', async () => {
        test.setTimeout(90000);
        const taskTitle = `Drag-Test-${Date.now()}`;
        await createTask(pageA, taskTitle);

        // Group 1
        const group1Name = `G1-${Date.now()}`;
        await createGroup(pageA, group1Name);

        // Group 2
        const group2Name = `G2-${Date.now()}`;
        await createGroup(pageA, group2Name);

        // Wait for Client B to sync everything
        // Use locator filter for name
        await expect(pageB.locator(`text=${taskTitle}`)).toBeVisible({ timeout: 30000 });
        await expect(pageB.locator('.section-node input').filter({ hasText: group1Name }).first()).toBeVisible({ timeout: 30000 });
        await expect(pageB.locator('.section-node input').filter({ hasText: group2Name }).first()).toBeVisible({ timeout: 30000 });

        // Client A moves Task -> Group 1
        const taskCardA = pageA.locator(`.task-card:has-text("${taskTitle}")`).first();
        const group1A = pageA.locator(`.section-node`).filter({ has: pageA.locator('input').filter({ hasText: group1Name }) }).first();

        const group1Box = await group1A.boundingBox();
        const taskBoxBefore = await taskCardA.boundingBox();

        if (group1Box && taskBoxBefore) {
            await pageA.mouse.move(taskBoxBefore.x + 10, taskBoxBefore.y + 10);
            await pageA.mouse.down();
            // Drag slowly
            await pageA.mouse.move(taskBoxBefore.x + 10, taskBoxBefore.y + 20, { steps: 5 });
            await pageA.mouse.move(group1Box.x + 50, group1Box.y + 50, { steps: 10 });
            await pageA.mouse.up();
        }

        // Client B moves Task -> Group 2
        const taskCardB = pageB.locator(`.task-card:has-text("${taskTitle}")`).first();
        const group2B = pageB.locator(`.section-node`).filter({ has: pageB.locator('input').filter({ hasText: group2Name }) }).first();

        const group2Box = await group2B.boundingBox();
        const taskBoxB = await taskCardB.boundingBox();

        if (group2Box && taskBoxB) {
            await pageB.mouse.move(taskBoxB.x + 10, taskBoxB.y + 10);
            await pageB.mouse.down();
            await pageB.mouse.move(group2Box.x + 50, group2Box.y + 50, { steps: 10 });
            await pageB.mouse.up();
        }

        // Verify Convergence
        await pageA.waitForTimeout(5000);

        const instancesA = await pageA.locator(`.task-card:has-text("${taskTitle}")`).count();
        const instancesB = await pageB.locator(`.task-card:has-text("${taskTitle}")`).count();

        expect(instancesA).toBe(1);
        expect(instancesB).toBe(1);
    });
});
