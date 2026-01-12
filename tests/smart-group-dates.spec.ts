import { test, expect } from '@playwright/test';

test.describe('Smart Group Dates', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000)

        page.on('console', msg => {
            console.log(`BROWSER [${msg.type()}]: ${msg.text()}`)
        })

        console.log('🚀 Navigating to /#/canvas...')
        await page.goto('/#/canvas', { waitUntil: 'networkidle' });

        console.log('⏳ Waiting for .canvas-layout...')
        await page.waitForSelector('.canvas-layout', { state: 'attached', timeout: 30000 });

        console.log('⏳ Waiting for .vue-flow__pane...')
        await page.waitForSelector('.vue-flow__pane', { state: 'visible', timeout: 30000 });
        console.log('✅ Canvas ready')
    });

    test('should update task dueDate when dropped into "Today" group', async ({ page }) => {
        console.log('🛠 Opening Create Group modal...')
        await page.keyboard.press('Shift+G');

        const groupModal = page.locator('.modal-content').filter({ hasText: 'Create Group' });
        await groupModal.waitFor({ state: 'visible' });

        console.log('🛠 Filling group details...')
        await groupModal.locator('input[placeholder="Enter group name..."]').fill('Today');
        await groupModal.locator('button:has-text("Create Group")').click({ force: true });

        console.log('⏳ Waiting for group node...')
        const group = page.locator('.section-node').first();
        await group.waitFor({ state: 'visible' });

        console.log('🛠 Opening Quick Task Create modal...')
        const addTaskBtn = page.locator('button[aria-label="Add new task"]');
        await addTaskBtn.click({ force: true });

        const taskModal = page.locator('.modal-container').filter({ hasText: 'Create New Task' });
        await taskModal.waitFor({ state: 'visible' });

        console.log('🛠 Filling task details...')
        await taskModal.locator('input[placeholder="Enter task title..."]').fill('Smart Task Today');
        await taskModal.locator('button:has-text("Create Task")').click({ force: true });

        console.log('⏳ Waiting for task node...')
        const taskNode = page.locator('.task-node').first();
        await taskNode.waitFor({ state: 'visible' });

        console.log('🖱 Dragging Task into Group...')
        const groupBox = await group.boundingBox();
        const taskBox = await taskNode.boundingBox();

        if (groupBox && taskBox) {
            await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(groupBox.x + 50, groupBox.y + 100, { steps: 20 });
            await page.mouse.up();
        }

        console.log('🔍 Verifying date badge...')
        const dateBadge = taskNode.locator('.due-date-badge');
        await dateBadge.waitFor({ state: 'visible', timeout: 10000 });

        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const expectedDateText = `${day}/${month}/${year}`;

        console.log(`📊 Expected date text: ${expectedDateText}`)
        await expect(dateBadge).toContainText(expectedDateText);
        console.log('✅ Date verified via badge!')
    });

    test('should update task dueDate when dropped into "Tomorrow" group', async ({ page }) => {
        console.log('🛠 Opening Create Group modal...')
        await page.keyboard.press('Shift+G');

        const groupModal = page.locator('.modal-content').filter({ hasText: 'Create Group' });
        await groupModal.waitFor({ state: 'visible' });

        console.log('🛠 Filling group details...')
        await groupModal.locator('input[placeholder="Enter group name..."]').fill('Tomorrow');
        await groupModal.locator('button:has-text("Create Group")').click({ force: true });

        console.log('⏳ Waiting for group node...')
        const group = page.locator('.section-node').first();
        await group.waitFor({ state: 'visible' });

        console.log('🛠 Opening Quick Task Create modal...')
        const addTaskBtn = page.locator('button[aria-label="Add new task"]');
        await addTaskBtn.click({ force: true });

        const taskModal = page.locator('.modal-container').filter({ hasText: 'Create New Task' });
        await taskModal.waitFor({ state: 'visible' });

        console.log('🛠 Filling task details...')
        await taskModal.locator('input[placeholder="Enter task title..."]').fill('Smart Task Tomorrow');
        await taskModal.locator('button:has-text("Create Task")').click({ force: true });

        console.log('⏳ Waiting for task node...')
        const taskNode = page.locator('.task-node').first();
        await taskNode.waitFor({ state: 'visible' });

        console.log('🖱 Dragging Task into Group...')
        const groupBox = await group.boundingBox();
        const taskBox = await taskNode.boundingBox();

        if (groupBox && taskBox) {
            await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(groupBox.x + 50, groupBox.y + 100, { steps: 20 });
            await page.mouse.up();
        }

        console.log('🔍 Verifying date badge...')
        const dateBadge = taskNode.locator('.due-date-badge');
        await dateBadge.waitFor({ state: 'visible', timeout: 10000 });

        const date = new Date();
        date.setDate(date.getDate() + 1);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const expectedDateText = `${day}/${month}/${year}`;

        console.log(`📊 Expected date text: ${expectedDateText}`)
        await expect(dateBadge).toContainText(expectedDateText);
        console.log('✅ Date verified via badge!')
    });
});
