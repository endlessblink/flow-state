// Debug script to test undo system functionality
// Run this in browser console on localhost:5550

console.log('🔍 Debugging undo system...');

// Test 1: Check if undo store is accessible
function testUndoStore() {
  console.log('\n=== Test 1: Undo Store Accessibility ===');

  // Try to access global undo store if available
  if (window.__NUXT__ || window.Vue) {
    console.log('✅ Vue/Nuxt detected');
  }

  // Check if undoRedoStore is available globally
  console.log('🔍 Looking for undo store...');
  console.log('window.undoRedoStore:', window.undoRedoStore);
  console.log('window.useUndoRedo:', window.useUndoRedo);

  return true;
}

// Test 2: Test keyboard event simulation
function testKeyboardEvents() {
  console.log('\n=== Test 2: Keyboard Event Simulation ===');

  // Create test elements
  const canvas = document.querySelector('.vue-flow__pane');
  if (!canvas) {
    console.log('❌ Canvas not found');
    return false;
  }

  console.log('✅ Canvas found:', canvas);

  // Click to create a node
  console.log('📍 Creating test node...');
  canvas.click();

  setTimeout(() => {
    const nodes = document.querySelectorAll('.vue-flow__node');
    console.log('📊 Nodes found:', nodes.length);

    if (nodes.length > 0) {
      // Select first node
      nodes[0].click();
      console.log('🎯 Selected first node');

      // Add debug listeners
      const originalLog = console.log;
      const logs = [];
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      // Simulate Delete key
      console.log('⌨️ Simulating Delete key...');
      const deleteEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true
      });

      document.dispatchEvent(deleteEvent);

      setTimeout(() => {
        console.log('📝 Console logs from delete operation:');
        logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));

        // Test Undo
        console.log('⌨️ Simulating Cmd+Z...');
        const undoEvent = new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          bubbles: true,
          cancelable: true
        });

        document.dispatchEvent(undoEvent);

        setTimeout(() => {
          console.log('📝 Console logs from undo operation:');
          const undoLogs = logs.slice(logs.length);
          undoLogs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));

          // Check final node count
          const finalNodes = document.querySelectorAll('.vue-flow__node');
          console.log('📊 Final node count:', finalNodes.length);

          // Restore console.log
          console.log = originalLog;

          console.log('🎯 Test completed! Check above logs for undo system activity.');
        }, 1000);
      }, 1000);
    } else {
      console.log('❌ No nodes found after clicking canvas');
    }
  }, 1000);

  return true;
}

// Test 3: Check Vue DevTools if available
function testVueDevTools() {
  console.log('\n=== Test 3: Vue DevTools Check ===');

  if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ Vue DevTools detected');
    // Try to get the app instance
    const app = document.querySelector('#app').__vue_app__;
    if (app) {
      console.log('✅ Vue app instance found');
      console.log('📊 App components:', Object.keys(app._context.components));
    }
  } else {
    console.log('❌ Vue DevTools not detected');
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting undo system debug tests...');

  testUndoStore();
  setTimeout(testKeyboardEvents, 1000);
  setTimeout(testVueDevTools, 5000);
}

// Auto-run
if (typeof window !== 'undefined') {
  runAllTests();
}

console.log('📜 Debug script loaded. Run runAllTests() to start testing.');