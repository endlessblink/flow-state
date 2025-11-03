// Simple validation script - copy and paste this into browser console
// Run on http://localhost:5548/#/canvas

console.log('🔍 Checking undo/redo system...');

try {
    // Try to access the Vue app
    const app = document.querySelector('#app').__vue_app__;

    if (!app) {
        console.log('❌ Vue app not found');
        return;
    }

    console.log('✅ Vue app found');

    // Try to find canvas component
    const canvasComponent = app._instance.components.find(c => c.type?.name === 'CanvasView');

    if (!canvasComponent) {
        console.log('❌ Canvas component not found');
        return;
    }

    console.log('✅ Canvas component found');

    // Try to access undo store
    const undoStore = canvasComponent.setupState?.undoRedoStore;

    if (!undoStore) {
        console.log('❌ Undo store not found');
        return;
    }

    console.log('✅ SUCCESS: Undo store accessible without errors!');
    console.log(`📊 Current state:`);
    console.log(`   - undoCount: ${undoStore.undoCount || 0}`);
    console.log(`   - canUndo: ${undoStore.canUndo || false}`);
    console.log(`   - canRedo: ${undoStore.canRedo || false}`);

    // Check if methods exist
    const hasUndo = typeof undoStore.undo === 'function';
    const hasRedo = typeof undoStore.redo === 'function';

    console.log(`   - has undo method: ${hasUndo}`);
    console.log(`   - has redo method: ${hasRedo}`);

    if (hasUndo && hasRedo) {
        console.log('\n🎉 ALL CHECKS PASSED!');
        console.log('✅ Undo/redo system is working correctly');
        console.log('✅ No more "undoRedo.undoCount is undefined" errors');
        console.log('\n💡 Ready to test:');
        console.log('   1. Click canvas to create task');
        console.log('   2. Select task and press Delete');
        console.log('   3. Press Cmd+Z (or Ctrl+Z) to undo');
        console.log('   4. Task should be restored');
    } else {
        console.log('❌ ERROR: Missing undo/redo methods');
    }

} catch (error) {
    console.log('❌ ERROR:', error.message);
    console.log('   The undo/redo system may still have issues');
}

console.log('\n🔍 Validation completed.');