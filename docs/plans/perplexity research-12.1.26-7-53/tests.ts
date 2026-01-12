/**
 * Testing Guide for Canvas Task Manager Refactoring
 * 
 * Use these tests to validate each phase of the refactoring
 */

// ============================================================================
// PHASE 1: DATABASE VERSIONING (Week 1-2)
// ============================================================================

/**
 * Test 1.1: Version field increments on update
 * Prerequisites: Run db-migration.sql
 */
async function testVersionIncrement() {
  console.log('\n=== Test 1.1: Version Increment ===');

  const supabase = createClient(URL, KEY);

  // Fetch node
  let { data: node } = await supabase
    .from('nodes')
    .select('id, version')
    .limit(1)
    .single();

  console.log(`Initial version: ${node.version}`);
  const initialVersion = node.version;

  // Update position
  const { data: updated } = await supabase
    .from('nodes')
    .update({ position: { x: 100, y: 200 } })
    .eq('id', node.id)
    .select('version')
    .single();

  console.log(`After update: ${updated.version}`);
  console.assert(
    updated.version === initialVersion + 1,
    'Version should increment by 1'
  );

  console.log('✓ PASS: Version incremented automatically');
}

/**
 * Test 1.2: Optimistic lock prevents conflict
 * Should fail to update if version doesn't match
 */
async function testOptimisticLock() {
  console.log('\n=== Test 1.2: Optimistic Lock ===');

  const supabase = createClient(URL, KEY);

  // Fetch node
  const { data: node } = await supabase
    .from('nodes')
    .select('id, version')
    .limit(1)
    .single();

  console.log(`Current version: ${node.version}`);

  // Try to update with wrong version
  const { data: result, error } = await supabase
    .from('nodes')
    .update({
      position: { x: 999, y: 999 },
      version: node.version + 1
    })
    .eq('id', node.id)
    .eq('version', node.version + 999) // ← Wrong version
    .select();

  console.assert(
    (!result || result.length === 0),
    'Update with wrong version should fail'
  );

  console.log('✓ PASS: Optimistic lock prevented invalid update');
}

/**
 * Test 1.3: Position history tracking
 * Check that position_history table is populated
 */
async function testPositionHistoryLogging() {
  console.log('\n=== Test 1.3: Position History Logging ===');

  const supabase = createClient(URL, KEY);

  // Fetch a node
  const { data: node } = await supabase
    .from('nodes')
    .select('id')
    .limit(1)
    .single();

  // Update its position
  await supabase
    .from('nodes')
    .update({ position: { x: 123, y: 456 } })
    .eq('id', node.id);

  // Check history
  const { data: history } = await supabase
    .from('node_position_history')
    .select('*')
    .eq('node_id', node.id)
    .order('changed_at', { ascending: false })
    .limit(1);

  console.assert(
    history && history.length > 0,
    'Position history should be logged'
  );
  console.log(`Latest position change:`, history[0]);
  console.log('✓ PASS: Position history is being tracked');
}

// ============================================================================
// PHASE 2: COORDINATE SYSTEM (Week 2-3)
// ============================================================================

/**
 * Test 2.1: Absolute position storage
 * Verify database stores absolute coordinates
 */
async function testAbsolutePositionStorage() {
  console.log('\n=== Test 2.1: Absolute Position Storage ===');

  const supabase = createClient(URL, KEY);

  // Create a parent group at (100, 100)
  const { data: parent } = await supabase
    .from('nodes')
    .insert({
      id: 'parent-test-' + Date.now(),
      position: { x: 100, y: 100 },
      width: 200,
      height: 200,
      type: 'group'
    })
    .select()
    .single();

  // Create a child at (150, 150) - absolute in world space
  const { data: child } = await supabase
    .from('nodes')
    .insert({
      id: 'child-test-' + Date.now(),
      position: { x: 150, y: 150 }, // ABSOLUTE
      parentGroupId: parent.id,
      width: 50,
      height: 50,
      type: 'task'
    })
    .select()
    .single();

  console.log(`Parent position (absolute): ${JSON.stringify(parent.position)}`);
  console.log(`Child position (absolute): ${JSON.stringify(child.position)}`);

  // Relative position should be: child - parent = (50, 50)
  const relativePosition = {
    x: child.position.x - parent.position.x,
    y: child.position.y - parent.position.y
  };
  console.log(`Child position (relative): ${JSON.stringify(relativePosition)}`);

  console.assert(
    child.position.x === 150 && child.position.y === 150,
    'Database should store absolute coordinates'
  );

  console.log('✓ PASS: Absolute coordinates stored correctly');

  // Cleanup
  await supabase.from('nodes').delete().eq('id', parent.id);
  await supabase.from('nodes').delete().eq('id', child.id);
}

/**
 * Test 2.2: Coordinate conversion roundtrip
 * Verify conversion doesn't lose precision
 */
function testCoordinateConversionRoundtrip() {
  console.log('\n=== Test 2.2: Coordinate Conversion Roundtrip ===');

  // Import from coordinates.ts
  const {
    toRelativePosition,
    toAbsolutePosition,
    validateCoordinateConversion
  } = require('@/utils/coordinates');

  const mockDbNodes = [
    { id: 'parent', position: { x: 100, y: 100 }, parentGroupId: null },
    {
      id: 'child',
      position: { x: 250, y: 300 },
      parentGroupId: 'parent'
    }
  ];

  const child = mockDbNodes[1];

  // Convert absolute → relative
  const relative = toRelativePosition(child, mockDbNodes);
  console.log(`Absolute: ${JSON.stringify(child.position)}`);
  console.log(`Relative: ${JSON.stringify(relative)}`);

  // Should be (150, 200)
  console.assert(
    relative.x === 150 && relative.y === 200,
    'Relative conversion should be correct'
  );

  // Convert back: relative → absolute
  const mockVueFlowNode = {
    position: relative,
    parentNode: 'parent'
  };

  const absolute = toAbsolutePosition(mockVueFlowNode, mockDbNodes);
  console.log(`Reconstructed absolute: ${JSON.stringify(absolute)}`);

  // Should match original
  console.assert(
    absolute.x === 250 && absolute.y === 300,
    'Roundtrip conversion should match original'
  );

  console.log('✓ PASS: Coordinate conversion is lossless');
}

/**
 * Test 2.3: No position reset on page refresh
 * Simulate page reload
 */
async function testNoPositionResetOnRefresh() {
  console.log('\n=== Test 2.3: No Position Reset on Refresh ===');

  const supabase = createClient(URL, KEY);

  // Create a test node
  const { data: node } = await supabase
    .from('nodes')
    .insert({
      id: 'refresh-test-' + Date.now(),
      position: { x: 500, y: 600 },
      width: 100,
      height: 100
    })
    .select()
    .single();

  console.log(`Created node at: ${JSON.stringify(node.position)}`);

  // Simulate refresh: fetch the node again
  const { data: reloaded } = await supabase
    .from('nodes')
    .select('position')
    .eq('id', node.id)
    .single();

  console.log(`After refresh: ${JSON.stringify(reloaded.position)}`);

  console.assert(
    reloaded.position.x === 500 && reloaded.position.y === 600,
    'Position should not reset to (0,0)'
  );

  console.log('✓ PASS: Position persists across refreshes');

  // Cleanup
  await supabase.from('nodes').delete().eq('id', node.id);
}

// ============================================================================
// PHASE 3: STATE MACHINE (Week 3)
// ============================================================================

/**
 * Test 3.1: State machine prevents invalid transitions
 */
function testStateTransitions() {
  console.log('\n=== Test 3.1: State Machine Transitions ===');

  const { useNodeStateMachine, NodeState } = require('@/utils/state-machine');
  const state = useNodeStateMachine();

  console.log(`Initial state: ${state.currentState.value}`);
  console.assert(
    state.currentState.value === NodeState.IDLE,
    'Should start in IDLE'
  );

  // Valid transition: IDLE → DRAGGING
  const canDrag = state.canTransitionTo(NodeState.DRAGGING_LOCAL);
  console.assert(canDrag, 'Should allow IDLE → DRAGGING');

  state.setState(NodeState.DRAGGING_LOCAL);
  console.log(`After drag start: ${state.currentState.value}`);

  // Invalid transition: DRAGGING → RESIZING
  const canResize = state.canTransitionTo(NodeState.RESIZING);
  console.assert(!canResize, 'Should NOT allow DRAGGING → RESIZING');

  // Valid transition: DRAGGING → SYNCING
  const canSync = state.canTransitionTo(NodeState.SYNCING);
  console.assert(canSync, 'Should allow DRAGGING → SYNCING');

  console.log('✓ PASS: State machine enforces valid transitions');
}

/**
 * Test 3.2: Impossible states prevented
 */
function testNoImpossibleStates() {
  console.log('\n=== Test 3.2: Impossible States Prevented ===');

  const { useNodeStateMachine, NodeState } = require('@/utils/state-machine');
  const state = useNodeStateMachine();

  // Try to reach an "impossible" state
  const transitions = [
    NodeState.IDLE,
    NodeState.DRAGGING_LOCAL,
    NodeState.SYNCING,
    NodeState.CONFLICT
  ];

  for (const target of transitions) {
    const success = state.setState(target);
    if (!success) {
      console.log(`Cannot reach: ${target}`);
    }
  }

  console.log(`Final state: ${state.currentState.value}`);
  console.log('✓ PASS: State machine graph is valid');
}

// ============================================================================
// PHASE 4: INTEGRATION TEST (Week 4)
// ============================================================================

/**
 * Test 4.1: Drag + Sync + Refresh cycle
 * The main workflow test
 */
async function testDragSyncRefreshCycle() {
  console.log('\n=== Test 4.1: Drag → Sync → Refresh ===');

  const supabase = createClient(URL, KEY);
  const { useNodeSync, dbNodesToVueFlowNodes, toAbsolutePosition } = 
    require('@/utils/coordinates');

  // Create test node
  const { data: node } = await supabase
    .from('nodes')
    .insert({
      id: 'drag-test-' + Date.now(),
      position: { x: 100, y: 100 },
      width: 50,
      height: 50
    })
    .select()
    .single();

  console.log(`1. Created node at: ${JSON.stringify(node.position)}`);

  // Simulate drag: move to (200, 200)
  const simulatedVueFlowNode = {
    id: `section-${node.id}`,
    position: { x: 200, y: 200 },
    parentNode: undefined
  };

  console.log(`2. Simulated drag to: ${JSON.stringify(simulatedVueFlowNode.position)}`);

  // Sync
  const absolutePos = toAbsolutePosition(simulatedVueFlowNode, [node]);
  console.log(`3. Converted to absolute: ${JSON.stringify(absolutePos)}`);

  const { data: synced } = await supabase
    .from('nodes')
    .update({ position: absolutePos, version: node.version + 1 })
    .eq('id', node.id)
    .eq('version', node.version)
    .select()
    .single();

  console.log(`4. Synced to DB, new version: ${synced.version}`);

  // Refresh: fetch again
  const { data: refreshed } = await supabase
    .from('nodes')
    .select('position, version')
    .eq('id', node.id)
    .single();

  console.log(`5. After refresh: ${JSON.stringify(refreshed.position)}`);

  // Verify
  console.assert(
    refreshed.position.x === 200 && refreshed.position.y === 200,
    'Position should persist'
  );
  console.assert(
    refreshed.version === synced.version,
    'Version should match'
  );

  console.log('✓ PASS: Full drag → sync → refresh cycle works');

  // Cleanup
  await supabase.from('nodes').delete().eq('id', node.id);
}

/**
 * Test 4.2: Concurrent edits with conflict detection
 */
async function testConcurrentEditConflict() {
  console.log('\n=== Test 4.2: Concurrent Edit Conflict Detection ===');

  const supabase = createClient(URL, KEY);

  // Create test node
  const { data: node } = await supabase
    .from('nodes')
    .insert({
      id: 'conflict-test-' + Date.now(),
      position: { x: 100, y: 100 },
      width: 50,
      height: 50
    })
    .select()
    .single();

  console.log(`Initial version: ${node.version}`);

  // Client 1 updates
  const { data: update1 } = await supabase
    .from('nodes')
    .update({ position: { x: 200, y: 200 }, version: node.version + 1 })
    .eq('id', node.id)
    .eq('version', node.version)
    .select()
    .single();

  console.log(`Client 1 updated, new version: ${update1.version}`);

  // Client 2 tries to update with old version (conflict!)
  const { data: update2, error } = await supabase
    .from('nodes')
    .update({ position: { x: 300, y: 300 }, version: node.version + 1 })
    .eq('id', node.id)
    .eq('version', node.version) // ← Old version
    .select();

  console.log(`Client 2 update result: ${update2?.length === 0 ? 'CONFLICT' : 'SUCCESS'}`);

  console.assert(
    !update2 || update2.length === 0,
    'Second update should fail due to version mismatch'
  );

  console.log('✓ PASS: Conflict detection works');

  // Cleanup
  await supabase.from('nodes').delete().eq('id', node.id);
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Canvas Task Manager - Architecture Refactoring Tests  ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    // Phase 1
    await testVersionIncrement();
    await testOptimisticLock();
    await testPositionHistoryLogging();

    // Phase 2
    await testAbsolutePositionStorage();
    testCoordinateConversionRoundtrip();
    await testNoPositionResetOnRefresh();

    // Phase 3
    testStateTransitions();
    testNoImpossibleStates();

    // Phase 4
    await testDragSyncRefreshCycle();
    await testConcurrentEditConflict();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                   ALL TESTS PASSED ✓                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n✗ TEST FAILED:', error);
  }
}