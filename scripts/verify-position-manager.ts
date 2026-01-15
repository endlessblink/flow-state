
/**
 * Standalone verification script for PositionManager & LockManager
 * Run with: npx ts-node --esm scripts/verify-position-manager.ts
 */

import { lockManager } from '../src/services/canvas/LockManager';
import { positionManager } from '../src/services/canvas/PositionManager';

async function runTests() {
    console.log('🧪 Starting Position System Verification...\n');

    // TEST 1: Basic Lock & Update
    console.log('Test 1: Basic Lock & Update');
    const nodeId = 'node-1';

    // Acquire lock
    const locked = lockManager.acquire(nodeId, 'user-drag');
    console.log(`Lock acquired: ${locked} (Expected: true)`);
    if (!locked) throw new Error('Failed to acquire initial lock');

    // Update position
    const updated = positionManager.updatePosition(nodeId, { x: 100, y: 100 }, 'user-drag');
    console.log(`Position updated: ${updated} (Expected: true)`);
    if (!updated) throw new Error('Failed to update position with valid lock');

    const pos = positionManager.getPosition(nodeId);
    console.log(`Current Position: ${JSON.stringify(pos?.position)} (Expected: {x:100, y:100})`);
    if (pos?.position.x !== 100) throw new Error('Position mismatch');

    console.log('✅ Test 1 Passed\n');


    // TEST 2: Race Condition (Sync vs User Drag)
    console.log('Test 2: Race Condition (Sync vs User Drag)');

    // User holds lock from Test 1. 
    // Attempt to update via 'remote-sync'
    const syncUpdate = positionManager.updatePosition(nodeId, { x: 999, y: 999 }, 'remote-sync');
    console.log(`Sync update allowed: ${syncUpdate} (Expected: false)`);

    if (syncUpdate) throw new Error('Sync update should have been rejected!');

    const safePos = positionManager.getPosition(nodeId);
    console.log(`Position after rejected sync: ${JSON.stringify(safePos?.position)} (Expected: {x:100, y:100})`);

    if (safePos?.position.x !== 100) throw new Error('Position corrupted by rejected sync');

    console.log('✅ Test 2 Passed\n');


    // TEST 3: Lock Release & Sync Success
    console.log('Test 3: Lock Release & Sync Success');

    lockManager.release(nodeId, 'user-drag');
    console.log('Lock released');

    const syncRetry = positionManager.updatePosition(nodeId, { x: 500, y: 500 }, 'remote-sync');
    console.log(`Sync retry allowed: ${syncRetry} (Expected: true)`);

    if (!syncRetry) throw new Error('Sync update should succeed after lock release');

    const finalPos = positionManager.getPosition(nodeId);
    console.log(`Final Position: ${JSON.stringify(finalPos?.position)} (Expected: {x:500, y:500})`);
    if (finalPos?.position.x !== 500) throw new Error('Position not updated after lock release');

    console.log('✅ Test 3 Passed\n');

    console.log('🎉 ALL TESTS PASSED');
}

runTests().catch(e => {
    console.error('❌ Tests Failed:', e);
    process.exit(1);
});
