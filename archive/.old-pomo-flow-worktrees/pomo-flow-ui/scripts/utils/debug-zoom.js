// Debug script to test zoom functionality
// Run this in browser console when on the canvas page

console.log('=== Zoom Debug Test ===');

// Check canvas store zoom config
const canvasStore = window.__canvasStore;
if (canvasStore) {
    console.log('Canvas Store Zoom Config:', canvasStore.zoomConfig);
    console.log('Current viewport:', canvasStore.viewport);
}

// Get Vue Flow instance
const vueFlowInstance = document.querySelector('.vue-flow-container')?.__vueflow__;
if (vueFlowInstance) {
    console.log('Vue Flow minZoom:', vueFlowInstance.minZoom);
    console.log('Vue Flow maxZoom:', vueFlowInstance.maxZoom);
    console.log('Vue Flow current zoom:', vueFlowInstance.viewport.zoom);
}

// Test zoom to 5%
console.log('\n=== Testing 5% Zoom ===');
if (vueFlowInstance) {
    try {
        vueFlowInstance.zoomTo(0.05, { duration: 100 });
        setTimeout(() => {
            console.log('After zoomTo(0.05):', vueFlowInstance.viewport.zoom);
        }, 200);
    } catch (error) {
        console.error('Error zooming to 5%:', error);
    }
}

// List zoom presets
console.log('\n=== Available Zoom Presets ===');
const presetButtons = document.querySelectorAll('.zoom-preset-btn');
presetButtons.forEach(btn => {
    console.log('Button:', btn.textContent.trim(), 'Active:', btn.classList.contains('active'));
});

// Test zoom out button
console.log('\n=== Testing Zoom Out Button ===');
const zoomOutBtn = document.querySelector('[title="Zoom Out (-)"]');
if (zoomOutBtn) {
    console.log('Zoom out button found');
    // Store current zoom
    const currentZoom = vueFlowInstance?.viewport?.zoom || 1;
    console.log('Current zoom before zoom out:', currentZoom);

    // Click zoom out multiple times
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            zoomOutBtn.click();
            console.log(`Zoom out ${i + 1}:`, vueFlowInstance?.viewport?.zoom);
        }, i * 300);
    }
}