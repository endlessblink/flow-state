// Direct console test for undo/redo functionality
// Copy and paste this script into the browser console on http://localhost:5548/#/canvas

console.log('🚀 Starting direct console test for undo/redo functionality...');

(async function testUndoRedoFunctionality() {
    console.log('='.repeat(60));
    console.log('CANVAS UNDO/REDO FUNCTIONALITY TEST');
    console.log('='.repeat(60));

    let testResults = [];
    let undoStore = null;

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const icons = {
            'info': '📊',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'test': '🧪',
            'step': '📍'
        };

        console.log(`${icons[type]} [${timestamp}] ${message}`);
        testResults.push({ timestamp, message, type });
    }

    function recordTestResult(testName, passed, details) {
        const result = {
            test: testName,
            passed,
            details,
            timestamp: new Date().toLocaleTimeString()
        };

        testResults.push(result);
        return result;
    }

    // Helper function to wait
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Step 1: Access the undo store
    log('Step 1: Accessing undo store...', 'step');

    try {
        const app = document.querySelector('#app').__vue_app__;
        const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');

        if (canvasComponent?.setupState?.undoRedoStore) {
            undoStore = canvasComponent.setupState.undoRedoStore;
            log('✅ Undo store accessed successfully', 'success');
            log(`📊 Initial state - undoCount: ${undoStore.undoCount}, canUndo: ${undoStore.canUndo}`, 'info');
            recordTestResult('Undo Store Access', true, `undoCount: ${undoStore.undoCount}`);
        } else {
            throw new Error('Undo store not found in canvas component');
        }
    } catch (error) {
        log(`❌ Failed to access undo store: ${error.message}`, 'error');
        recordTestResult('Undo Store Access', false, error.message);
        return;
    }

    // Step 2: Create a test task
    log('Step 2: Creating test task...', 'step');

    try {
        const canvas = document.querySelector('.vue-flow__pane');
        if (!canvas) {
            throw new Error('Canvas not found');
        }

        // Click on canvas to create task
        canvas.click({ clientX: 300, clientY: 300 });
        await sleep(1000);

        // Fill in task details
        const titleInput = document.querySelector('input[placeholder*="title"], input[data-testid*="title"], input[type="text"]');
        if (titleInput) {
            titleInput.value = 'Console Test Task';
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            log('📝 Task title entered', 'info');
        }

        // Click create button
        const createBtn = document.querySelector('button[type="submit"], button[data-testid*="create"], button:contains("Create")');
        if (createBtn) {
            createBtn.click();
        }

        await sleep(2000);

        const nodes = document.querySelectorAll('.vue-flow__node');
        if (nodes.length > 0) {
            log(`✅ Task created successfully. Found ${nodes.length} nodes`, 'success');
            recordTestResult('Task Creation', true, `Created ${nodes.length} tasks`);
        } else {
            throw new Error('No tasks were created');
        }
    } catch (error) {
        log(`❌ Failed to create task: ${error.message}`, 'error');
        recordTestResult('Task Creation', false, error.message);
        return;
    }

    // Step 3: Test Delete key functionality
    log('Step 3: Testing Delete key with undo tracking...', 'step');

    try {
        const nodes = document.querySelectorAll('.vue-flow__node');
        if (nodes.length === 0) {
            throw new Error('No tasks found to delete');
        }

        // Record undo state before deletion
        const undoCountBefore = undoStore.undoCount;
        const canUndoBefore = undoStore.canUndo;
        log(`📊 Before deletion - undoCount: ${undoCountBefore}, canUndo: ${canUndoBefore}`, 'info');

        // Select first node
        const firstNode = nodes[0];
        firstNode.click();
        log('📍 Task selected', 'info');

        // Send Delete key event
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true,
            cancelable: true
        }));

        await sleep(1000);

        // Check state after deletion
        const undoCountAfter = undoStore.undoCount;
        const canUndoAfter = undoStore.canUndo;
        const nodesAfterDelete = document.querySelectorAll('.vue-flow__node');

        log(`📊 After deletion - undoCount: ${undoCountAfter}, canUndo: ${canUndoAfter}`, 'info');
        log(`📊 Nodes after deletion: ${nodesAfterDelete.length}`, 'info');

        if (undoCountAfter > undoCountBefore) {
            log('✅ SUCCESS: Undo count incremented after deletion!', 'success');
            log(`   📈 Undo count: ${undoCountBefore} → ${undoCountAfter}`, 'success');
            recordTestResult('Delete Key Undo Tracking', true, `undoCount: ${undoCountBefore} → ${undoCountAfter}`);
        } else {
            log('❌ FAILED: Undo count did not increment', 'error');
            log(`   ❌ Undo count unchanged: ${undoCountBefore}`, 'error');
            recordTestResult('Delete Key Undo Tracking', false, `undoCount unchanged: ${undoCountBefore}`);
        }
    } catch (error) {
        log(`❌ Failed to test Delete key: ${error.message}`, 'error');
        recordTestResult('Delete Key Undo Tracking', false, error.message);
    }

    // Step 4: Test undo restoration
    log('Step 4: Testing undo restoration with Cmd+Z...', 'step');

    try {
        const undoCountBefore = undoStore.undoCount;
        const nodesBefore = document.querySelectorAll('.vue-flow__node').length;

        log(`📊 Before undo - nodes: ${nodesBefore}, undoCount: ${undoCountBefore}`, 'info');

        // Send Cmd+Z event (or Ctrl+Z on Windows/Linux)
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'z',
            metaKey: true, // Use metaKey for Mac-like behavior
            bubbles: true,
            cancelable: true
        }));

        await sleep(1000);

        const undoCountAfter = undoStore.undoCount;
        const nodesAfter = document.querySelectorAll('.vue-flow__node').length;

        log(`📊 After undo - nodes: ${nodesAfter} (was ${nodesBefore}), undoCount: ${undoCountAfter}`, 'info');

        if (nodesAfter > nodesBefore) {
            log('✅ SUCCESS: Task restored with undo!', 'success');
            log(`   📈 Tasks restored: ${nodesAfter - nodesBefore}`, 'success');
            recordTestResult('Undo Restoration', true, `Restored ${nodesAfter - nodesBefore} tasks`);
        } else {
            log('❌ FAILED: Task not restored with undo', 'error');
            log(`   ❌ No change in task count: ${nodesBefore} → ${nodesAfter}`, 'error');
            recordTestResult('Undo Restoration', false, 'No tasks restored');
        }
    } catch (error) {
        log(`❌ Failed to test undo: ${error.message}`, 'error');
        recordTestResult('Undo Restoration', false, error.message);
    }

    // Step 5: Test additional deletion methods
    log('Step 5: Testing additional deletion methods...', 'step');

    // Test Shift+Delete
    try {
        const nodes = document.querySelectorAll('.vue-flow__node');
        if (nodes.length > 0) {
            const undoCountBefore = undoStore.undoCount;

            // Select and delete with Shift+Delete
            nodes[0].click();
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Delete',
                shiftKey: true,
                bubbles: true,
                cancelable: true
            }));

            await sleep(1000);

            const undoCountAfter = undoStore.undoCount;

            if (undoCountAfter > undoCountBefore) {
                log('✅ Shift+Delete also increments undo count', 'success');
                recordTestResult('Shift+Delete Test', true, `undoCount: ${undoCountBefore} → ${undoCountAfter}`);
            } else {
                log('⚠️ Shift+Delete does not increment undo count', 'warning');
                recordTestResult('Shift+Delete Test', false, 'undoCount unchanged');
            }
        }
    } catch (error) {
        log(`⚠️ Shift+Delete test failed: ${error.message}`, 'warning');
        recordTestResult('Shift+Delete Test', false, error.message);
    }

    // Test Backspace
    try {
        const nodes = document.querySelectorAll('.vue-flow__node');
        if (nodes.length > 0) {
            const undoCountBefore = undoStore.undoCount;

            // Select and delete with Backspace
            nodes[0].click();
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Backspace',
                bubbles: true,
                cancelable: true
            }));

            await sleep(1000);

            const undoCountAfter = undoStore.undoCount;

            if (undoCountAfter > undoCountBefore) {
                log('✅ Backspace also increments undo count', 'success');
                recordTestResult('Backspace Test', true, `undoCount: ${undoCountBefore} → ${undoCountAfter}`);
            } else {
                log('⚠️ Backspace does not increment undo count', 'warning');
                recordTestResult('Backspace Test', false, 'undoCount unchanged');
            }
        }
    } catch (error) {
        log(`⚠️ Backspace test failed: ${error.message}`, 'warning');
        recordTestResult('Backspace Test', false, error.message);
    }

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passedTests = testResults.filter(r => r.passed !== false).length;
    const totalTests = testResults.filter(r => r.test).length;

    log(`📊 Test Results: ${passedTests}/${totalTests} passed`, 'info');

    // Show individual results
    testResults.filter(r => r.test).forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.details}`);
    });

    if (passedTests === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! Canvas undo/redo system is working correctly!');
        console.log('✅ Delete key properly increments undo count');
        console.log('✅ Cmd+Z properly restores deleted tasks');
        console.log('✅ Unified command-based undo system is functional');
    } else {
        console.log('\n❌ SOME TESTS FAILED - Check results above');
        console.log('⚠️ The undo/redo system may need additional fixes');
    }

    console.log('\n💡 Final undo store state:', {
        undoCount: undoStore.undoCount,
        canUndo: undoStore.canUndo,
        canRedo: undoStore.canRedo
    });

    console.log('\n🔍 You can continue testing manually:');
    console.log('1. Create a task by clicking on the canvas');
    console.log('2. Select the task and press Delete');
    console.log('3. Press Cmd+Z (or Ctrl+Z) to undo');
    console.log('4. Verify the task is restored');

    return {
        totalTests,
        passedTests,
        undoStoreState: {
            undoCount: undoStore.undoCount,
            canUndo: undoStore.canUndo,
            canRedo: undoStore.canRedo
        }
    };
})();