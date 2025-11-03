// Debug script to identify the exact source of the undo error
// Copy and paste this into browser console on the canvas page

console.log('🔍 DEBUGGING UNDO ERROR...');

// Check what's actually available in the component
try {
    const app = document.querySelector('#app').__vue_app__;
    const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');

    if (!canvasComponent) {
        console.log('❌ Canvas component not found');
        return;
    }

    console.log('✅ Canvas component found');

    // Check setup state
    const setupState = canvasComponent.setupState;
    console.log('🔍 Setup state keys:', Object.keys(setupState || {}));

    // Find all undo-related variables
    const undoKeys = Object.keys(setupState || {}).filter(key => key.toLowerCase().includes('undo'));
    console.log('🔍 Undo-related keys:', undoKeys);

    // Check each one
    undoKeys.forEach(key => {
        const value = setupState[key];
        console.log(`🔍 ${key}:`, {
            type: typeof value,
            hasUndoCount: value && typeof value.undoCount !== 'undefined',
            hasValue: value && typeof value.value !== 'undefined',
            actualValue: value
        });

        // If this has undoCount, test accessing it
        if (value && typeof value.undoCount !== 'undefined') {
            try {
                const count = value.undoCount;
                console.log(`✅ ${key}.undoCount accessible:`, count);
            } catch (error) {
                console.log(`❌ ${key}.undoCount ERROR:`, error.message);
            }
        }

        // If this has .value, test accessing it
        if (value && typeof value.value !== 'undefined') {
            try {
                const val = value.value;
                console.log(`✅ ${key}.value accessible:`, val);
            } catch (error) {
                console.log(`❌ ${key}.value ERROR:`, error.message);
            }
        }
    });

    // Try to find the error source by looking at handleKeyDown
    console.log('🔍 Checking handleKeyDown method...');
    if (typeof canvasComponent.handleKeyDown === 'function') {
        console.log('✅ handleKeyDown method exists');

        // Try to call it with a mock event to see if it errors
        try {
            const mockEvent = new KeyboardEvent('keydown', { key: 'Delete' });
            console.log('🔍 Testing handleKeyDown with mock event...');
            // Don't actually call it, just check if it would error
        } catch (error) {
            console.log('❌ handleKeyDown ERROR:', error.message);
        }
    }

    // Check all refs that might contain undo data
    console.log('🔍 Checking all refs...');
    Object.keys(setupState || {}).forEach(key => {
        const value = setupState[key];
        if (value && typeof value === 'object' && value.__v_isRef) {
            console.log(`🔍 Ref ${key}:`, {
                value: value.value,
                hasUndoAccess: value.value && typeof value.value.undoCount !== 'undefined'
            });
        }
    });

} catch (error) {
    console.log('❌ DEBUG ERROR:', error.message);
    console.log('Stack:', error.stack);
}

console.log('\n🔧 DEBUGGING COMPLETE');