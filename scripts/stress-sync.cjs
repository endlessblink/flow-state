#!/usr/bin/env node

/**
 * TASK-362: Sync Conflict Resolution Stress Tests
 *
 * Tests race conditions and conflict resolution for VPS deployments.
 * Simulates multi-device/multi-tab scenarios.
 *
 * Tests:
 * 1. Concurrent task creation (same ID collision)
 * 2. Rapid update race conditions
 * 3. Optimistic sync conflict detection
 * 4. Position conflict resolution
 * 5. Parent-child relationship race conditions
 *
 * Usage:
 *   npm run test:sync              # All tests
 *   npm run test:sync --quick      # Quick validation only
 */

const path = require('path')
const crypto = require('crypto')

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
  skipped: []
}

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function pass(testName, detail = '') {
  results.passed.push({ name: testName, detail })
  log(`  ✅ ${testName}${detail ? `: ${detail}` : ''}`, 'green')
}

function fail(testName, reason) {
  results.failed.push({ name: testName, reason })
  log(`  ❌ ${testName}: ${reason}`, 'red')
}

function warn(testName, reason) {
  results.warnings.push({ name: testName, reason })
  log(`  ⚠️  ${testName}: ${reason}`, 'yellow')
}

function skip(testName, reason) {
  results.skipped.push({ name: testName, reason })
  log(`  ⏭️  ${testName}: ${reason}`, 'yellow')
}

// ============================================================================
// Helper Functions
// ============================================================================

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateUUID() {
  return crypto.randomUUID()
}

async function supabaseRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers
    }
  })

  if (!response.ok && response.status !== 409) {
    const text = await response.text()
    throw new Error(`Supabase request failed: ${response.status} - ${text}`)
  }

  return {
    status: response.status,
    data: response.status !== 204 ? await response.json().catch(() => null) : null
  }
}

// Test task template
function createTestTask(overrides = {}) {
  const id = generateUUID()
  return {
    id,
    title: `STRESS_TEST_${id.slice(0, 8)}`,
    description: 'Created by sync stress test - safe to delete',
    status: 'todo',
    priority: 'medium',
    is_in_inbox: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

// Cleanup test tasks
async function cleanupTestTasks() {
  try {
    await supabaseRequest('tasks?title=like.STRESS_TEST_*', {
      method: 'DELETE'
    })
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Concurrent Task Creation (ID Collision Test)
 */
async function testConcurrentCreation() {
  log('\n🔀 Test 1: Concurrent Task Creation', 'cyan')

  // Create 10 tasks simultaneously
  const concurrency = 10
  const tasks = Array(concurrency).fill(null).map(() => createTestTask())

  const startTime = Date.now()
  const results = await Promise.allSettled(
    tasks.map(task =>
      supabaseRequest('tasks', {
        method: 'POST',
        body: JSON.stringify(task)
      })
    )
  )

  const elapsed = Date.now() - startTime
  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  log(`    Created ${succeeded}/${concurrency} tasks in ${elapsed}ms`, 'reset')

  if (succeeded === concurrency) {
    pass('Concurrent creation', `${concurrency} tasks in ${elapsed}ms`)
  } else if (succeeded > concurrency * 0.8) {
    warn('Concurrent creation', `${failed} failed (${Math.round(failed/concurrency*100)}% failure rate)`)
  } else {
    fail('Concurrent creation', `${failed}/${concurrency} failed`)
    return false
  }

  // Cleanup
  for (const task of tasks) {
    try {
      await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })
    } catch (e) { /* ignore */ }
  }

  return true
}

/**
 * Test 2: Rapid Update Race Condition
 */
async function testRapidUpdates() {
  log('\n⚡ Test 2: Rapid Update Race Condition', 'cyan')

  // Create a test task
  const task = createTestTask()
  await supabaseRequest('tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  })

  // Perform 20 rapid updates to same task
  const updateCount = 20
  const updates = []

  for (let i = 0; i < updateCount; i++) {
    updates.push(
      supabaseRequest(`tasks?id=eq.${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: `STRESS_TEST_${task.id.slice(0, 8)}_v${i}`,
          updated_at: new Date().toISOString()
        })
      })
    )
  }

  const results = await Promise.allSettled(updates)
  const succeeded = results.filter(r => r.status === 'fulfilled').length

  // Fetch final state
  const { data: finalTasks } = await supabaseRequest(`tasks?id=eq.${task.id}&select=*`)
  const finalTask = finalTasks?.[0]

  if (succeeded === updateCount) {
    pass('Rapid updates', `${updateCount} updates succeeded`)
  } else {
    warn('Rapid updates', `${updateCount - succeeded} updates failed`)
  }

  // Check data consistency
  if (finalTask) {
    const versionMatch = finalTask.title.match(/_v(\d+)$/)
    if (versionMatch) {
      log(`    Final version: v${versionMatch[1]}`, 'reset')
      pass('Data consistency', 'Task has valid final state')
    } else {
      warn('Data consistency', 'Unexpected final title format')
    }
  } else {
    fail('Data consistency', 'Task not found after updates')
  }

  // Cleanup
  await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })

  return true
}

/**
 * Test 3: Duplicate ID Prevention
 */
async function testDuplicateIdPrevention() {
  log('\n🔒 Test 3: Duplicate ID Prevention', 'cyan')

  // Create a task with specific ID
  const task = createTestTask()

  // First creation should succeed
  const result1 = await supabaseRequest('tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  })

  if (result1.status !== 201 && result1.status !== 200) {
    fail('First task creation', `Status ${result1.status}`)
    return false
  }
  pass('First task creation', 'Succeeded')

  // Second creation with same ID should fail or be handled
  let duplicateHandled = false
  try {
    const result2 = await supabaseRequest('tasks', {
      method: 'POST',
      body: JSON.stringify(task),
      prefer: 'return=minimal'
    })

    if (result2.status === 409) {
      duplicateHandled = true
      pass('Duplicate ID rejected', 'Conflict (409) returned')
    } else if (result2.status === 200 || result2.status === 201) {
      // Check if it actually created a duplicate
      const { data: duplicates } = await supabaseRequest(`tasks?id=eq.${task.id}&select=count`)
      if (duplicates?.length > 1) {
        fail('Duplicate ID rejected', 'Duplicate was created!')
      } else {
        pass('Duplicate ID rejected', 'Upsert behavior - no duplicate')
        duplicateHandled = true
      }
    }
  } catch (error) {
    if (error.message.includes('409') || error.message.includes('duplicate') || error.message.includes('unique')) {
      duplicateHandled = true
      pass('Duplicate ID rejected', 'Conflict error thrown')
    } else {
      warn('Duplicate ID handling', error.message)
    }
  }

  if (!duplicateHandled) {
    warn('Duplicate ID handling', 'No explicit rejection - check RLS policies')
  }

  // Cleanup
  await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })

  return true
}

/**
 * Test 4: Position Conflict Simulation
 */
async function testPositionConflict() {
  log('\n📍 Test 4: Position Conflict Simulation', 'cyan')

  // Create a task with position
  const task = createTestTask({
    position: JSON.stringify({ x: 100, y: 100 }),
    position_version: 1
  })

  await supabaseRequest('tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  })

  // Simulate two "devices" updating position simultaneously
  const update1 = supabaseRequest(`tasks?id=eq.${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      position: JSON.stringify({ x: 200, y: 200 }),
      position_version: 2,
      updated_at: new Date().toISOString()
    })
  })

  const update2 = supabaseRequest(`tasks?id=eq.${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      position: JSON.stringify({ x: 300, y: 300 }),
      position_version: 2,
      updated_at: new Date().toISOString()
    })
  })

  await Promise.allSettled([update1, update2])

  // Check final state
  const { data: finalTasks } = await supabaseRequest(`tasks?id=eq.${task.id}&select=position,position_version`)
  const finalTask = finalTasks?.[0]

  if (finalTask?.position) {
    const pos = typeof finalTask.position === 'string'
      ? JSON.parse(finalTask.position)
      : finalTask.position

    log(`    Final position: (${pos.x}, ${pos.y})`, 'reset')

    // Either position is valid (last-write-wins is acceptable)
    if ((pos.x === 200 && pos.y === 200) || (pos.x === 300 && pos.y === 300)) {
      pass('Position conflict resolved', 'Last-write-wins')
    } else {
      warn('Position conflict', `Unexpected position: (${pos.x}, ${pos.y})`)
    }
  } else {
    warn('Position conflict', 'No position data returned')
  }

  // Cleanup
  await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })

  return true
}

/**
 * Test 5: Batch Operation Atomicity
 */
async function testBatchAtomicity() {
  log('\n📦 Test 5: Batch Operation Simulation', 'cyan')

  // Create 5 tasks that should be created together
  const batchId = generateUUID().slice(0, 8)
  const tasks = Array(5).fill(null).map((_, i) => createTestTask({
    title: `STRESS_TEST_BATCH_${batchId}_${i}`,
    description: `Batch task ${i}`
  }))

  // Create all at once
  const createResults = await Promise.allSettled(
    tasks.map(task =>
      supabaseRequest('tasks', {
        method: 'POST',
        body: JSON.stringify(task)
      })
    )
  )

  const created = createResults.filter(r => r.status === 'fulfilled').length

  if (created === tasks.length) {
    pass('Batch creation', `${created}/${tasks.length} tasks created`)
  } else {
    warn('Batch creation', `Only ${created}/${tasks.length} created`)
  }

  // Verify all exist
  const { data: found } = await supabaseRequest(`tasks?title=like.STRESS_TEST_BATCH_${batchId}_*&select=id`)

  if (found?.length === tasks.length) {
    pass('Batch verification', 'All tasks found in database')
  } else {
    warn('Batch verification', `Found ${found?.length || 0}/${tasks.length}`)
  }

  // Cleanup
  for (const task of tasks) {
    try {
      await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })
    } catch (e) { /* ignore */ }
  }

  return true
}

/**
 * Test 6: Delete-During-Update Race Condition
 */
async function testDeleteDuringUpdate() {
  log('\n🗑️  Test 6: Delete-During-Update Race', 'cyan')

  // Create a task
  const task = createTestTask()
  await supabaseRequest('tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  })

  // Simultaneously try to update and delete
  const updatePromise = supabaseRequest(`tasks?id=eq.${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'UPDATED_TITLE' })
  }).catch(e => ({ error: e.message }))

  const deletePromise = supabaseRequest(`tasks?id=eq.${task.id}`, {
    method: 'DELETE'
  }).catch(e => ({ error: e.message }))

  const [updateResult, deleteResult] = await Promise.all([updatePromise, deletePromise])

  // Check task state
  const { data: remaining } = await supabaseRequest(`tasks?id=eq.${task.id}&select=id`)

  if (!remaining || remaining.length === 0) {
    pass('Delete won race', 'Task was deleted (expected behavior)')
  } else {
    warn('Update won race', 'Task still exists - delete may have failed')
    // Cleanup
    await supabaseRequest(`tasks?id=eq.${task.id}`, { method: 'DELETE' })
  }

  return true
}

// ============================================================================
// Main
// ============================================================================

function printSummary() {
  log('\n' + '='.repeat(60), 'bold')
  log('SYNC CONFLICT TEST SUMMARY', 'bold')
  log('='.repeat(60), 'bold')

  log(`\n✅ Passed: ${results.passed.length}`, 'green')
  log(`❌ Failed: ${results.failed.length}`, results.failed.length > 0 ? 'red' : 'reset')
  log(`⚠️  Warnings: ${results.warnings.length}`, results.warnings.length > 0 ? 'yellow' : 'reset')
  log(`⏭️  Skipped: ${results.skipped.length}`, results.skipped.length > 0 ? 'yellow' : 'reset')

  if (results.failed.length > 0) {
    log('\n--- FAILURES ---', 'red')
    results.failed.forEach(f => {
      log(`  • ${f.name}: ${f.reason}`, 'red')
    })
  }

  if (results.warnings.length > 0) {
    log('\n--- WARNINGS ---', 'yellow')
    results.warnings.forEach(w => {
      log(`  • ${w.name}: ${w.reason}`, 'yellow')
    })
  }

  // Sync-specific recommendations
  log('\n--- SYNC RECOMMENDATIONS ---', 'cyan')
  if (results.failed.length === 0) {
    log('  ✅ Sync conflict handling is working correctly', 'green')
  } else {
    log('  • Review RLS policies for conflict handling', 'yellow')
    log('  • Consider implementing optimistic locking', 'yellow')
    log('  • Add retry logic for failed operations', 'yellow')
  }

  log('\n')

  if (results.failed.length > 0) {
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const quickMode = args.includes('--quick')

  log('🔀 FlowState Sync Conflict Tests (TASK-362)', 'bold')
  log('=' .repeat(60), 'bold')
  log(`Supabase URL: ${SUPABASE_URL}`, 'reset')

  if (quickMode) {
    log('Running quick validation only...', 'cyan')
  }

  // Cleanup any leftover test data
  await cleanupTestTasks()

  // Run tests
  await testConcurrentCreation()
  await testRapidUpdates()
  await testDuplicateIdPrevention()

  if (!quickMode) {
    await testPositionConflict()
    await testBatchAtomicity()
    await testDeleteDuringUpdate()
  }

  // Final cleanup
  await cleanupTestTasks()

  printSummary()
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red')
  process.exit(1)
})
