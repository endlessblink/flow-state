// Immediate browser test for undo/redo functionality
// This script will open a browser and test the functionality

const puppeteer = require('puppeteer');

async function testUndoRedo() {
    console.log('🚀 Starting browser-based undo/redo test...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false, // Show the browser
            slowMo: 100 // Slow down for better visibility
        });

        const page = await browser.newPage();

        // Enable console logging
        page.on('console', msg => {
            console.log(`Browser console [${msg.type()}]: ${msg.text()}`);
        });

        // Navigate to the canvas
        await page.goto('http://localhost:5550/#/canvas');
        console.log('📍 Navigated to canvas page');

        // Wait for app to load
        await page.waitForSelector('#app', { timeout: 15000 });
        console.log('✅ App loaded');

        // Wait for Vue Flow canvas
        await page.waitForSelector('.vue-flow__pane', { timeout: 10000 });
        console.log('✅ Canvas ready');

        // Test 1: Create a task
        console.log('\n🧪 Test 1: Creating task...');
        await page.click('.vue-flow__pane', { position: { x: 300, y: 300 } });

        // Wait for modal
        await page.waitForSelector('input[placeholder*="title"], input[type="text"]', { timeout: 5000 });

        // Fill in task details
        await page.type('input[placeholder*="title"], input[type="text"]', 'Test Undo Task');

        // Submit
        await page.click('button[type="submit"]');

        // Wait for task to appear
        await page.waitForSelector('.vue-flow__node', { timeout: 5000 });

        const initialNodeCount = await page.$$eval('.vue-flow__node', nodes => nodes.length);
        console.log(`✅ Task created! Found ${initialNodeCount} nodes`);

        // Test 2: Get undo state before deletion
        console.log('\n🧪 Test 2: Checking undo state before deletion...');
        const undoStateBefore = await page.evaluate(() => {
            const app = document.querySelector('#app').__vue_app__;
            const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');
            const undoStore = canvasComponent?.setupState?.undoRedoStore;

            if (!undoStore) {
                console.error('❌ Undo store not found!');
                return null;
            }

            return {
                undoCount: undoStore.undoCount,
                canUndo: undoStore.canUndo,
                canRedo: undoStore.canRedo
            };
        });

        if (!undoStateBefore) {
            throw new Error('Could not access undo store');
        }

        console.log(`📊 Before deletion - undoCount: ${undoStateBefore.undoCount}, canUndo: ${undoStateBefore.canUndo}`);

        // Test 3: Delete the task
        console.log('\n🧪 Test 3: Deleting task with Delete key...');

        // Select the first node
        await page.click('.vue-flow__node');
        console.log('✅ Task selected');

        // Send Delete key
        await page.keyboard.press('Delete');
        await page.waitForTimeout(1000); // Wait for deletion to process

        // Check nodes after deletion
        const nodesAfterDelete = await page.$$eval('.vue-flow__node', nodes => nodes.length);
        console.log(`📊 Nodes after deletion: ${nodesAfterDelete}`);

        // Test 4: Check undo state after deletion
        console.log('\n🧪 Test 4: Checking undo state after deletion...');
        const undoStateAfter = await page.evaluate(() => {
            const app = document.querySelector('#app').__vue_app__;
            const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');
            const undoStore = canvasComponent?.setupState?.undoRedoStore;

            return {
                undoCount: undoStore.undoCount,
                canUndo: undoStore.canUndo,
                canRedo: undoStore.canRedo
            };
        });

        console.log(`📊 After deletion - undoCount: ${undoStateAfter.undoCount}, canUndo: ${undoStateAfter.canUndo}`);

        // Test 5: Verify undo count incremented
        console.log('\n🧪 Test 5: Verifying undo count increment...');
        if (undoStateAfter.undoCount > undoStateBefore.undoCount) {
            console.log('✅ SUCCESS: Undo count incremented after deletion!');
            console.log(`   ${undoStateBefore.undoCount} → ${undoStateAfter.undoCount}`);
        } else {
            console.log('❌ FAILED: Undo count did not increment');
            console.log(`   ${undoStateBefore.undoCount} → ${undoStateAfter.undoCount}`);
        }

        // Test 6: Test undo restoration
        console.log('\n🧪 Test 6: Testing undo restoration...');

        const nodesBeforeUndo = nodesAfterDelete;

        // Send Cmd+Z (or Ctrl+Z)
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
        await page.waitForTimeout(1000);

        const nodesAfterUndo = await page.$$eval('.vue-flow__node', nodes => nodes.length);
        console.log(`📊 Nodes after undo: ${nodesAfterUndo} (was ${nodesBeforeUndo})`);

        if (nodesAfterUndo > nodesBeforeUndo) {
            console.log('✅ SUCCESS: Task restored with undo!');
        } else {
            console.log('❌ FAILED: Task not restored with undo');
        }

        // Test 7: Final verification
        console.log('\n🧪 Test 7: Final verification...');
        const finalUndoState = await page.evaluate(() => {
            const app = document.querySelector('#app').__vue_app__;
            const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');
            const undoStore = canvasComponent?.setupState?.undoRedoStore;

            return {
                undoCount: undoStore.undoCount,
                canUndo: undoStore.canUndo,
                canRedo: undoStore.canRedo
            };
        });

        console.log(`📊 Final state - undoCount: ${finalUndoState.undoCount}, canUndo: ${finalUndoState.canUndo}`);

        // Summary
        console.log('\n🎯 TEST SUMMARY');
        console.log('================');
        if (undoStateAfter.undoCount > undoStateBefore.undoCount && nodesAfterUndo > nodesBeforeUndo) {
            console.log('🎉 ALL TESTS PASSED!');
            console.log('✅ Delete key increments undo count');
            console.log('✅ Cmd+Z restores deleted tasks');
            console.log('✅ Canvas undo/redo system is working correctly!');
        } else {
            console.log('❌ SOME TESTS FAILED');
            console.log('⚠️ Check the logs above for details');
        }

        // Keep browser open for manual inspection
        console.log('\n💡 Browser will remain open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Check if server is running first
async function checkServer() {
    try {
        const response = await fetch('http://localhost:5550');
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Run the test
async function main() {
    console.log('🔍 Checking if server is running on http://localhost:5550...');

    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.error('❌ Server is not running on http://localhost:5550');
        console.error('Please start the server with: npm run dev');
        process.exit(1);
    }

    console.log('✅ Server is running');
    await testUndoRedo();
}

main().catch(console.error);