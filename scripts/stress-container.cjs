#!/usr/bin/env node

/**
 * TASK-361: Container Stability Stress Tests
 *
 * Tests Docker/Supabase container resilience for VPS deployments.
 * Critical for production stability.
 *
 * Tests:
 * 1. Supabase connection health
 * 2. Connection recovery after timeout
 * 3. Docker container status (if available)
 * 4. Database reconnection after restart
 * 5. Graceful degradation when Supabase unavailable
 *
 * Usage:
 *   npm run test:container           # All tests
 *   npm run test:container --quick   # Quick health check only
 *   npm run test:container --restart # Test actual container restart (DANGEROUS)
 */

const { execSync, exec } = require('child_process')
const path = require('path')
const fs = require('fs')

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

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      timeout: options.timeout || 10000,
      ...options
    }).trim()
  } catch (error) {
    return null
  }
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Check if Docker is available
 */
function testDockerAvailable() {
  log('\n🐳 Test 1: Docker Availability', 'cyan')

  const dockerVersion = runCommand('docker --version')
  if (!dockerVersion) {
    warn('Docker available', 'Docker not installed or not in PATH')
    return false
  }

  pass('Docker available', dockerVersion.split('\n')[0])

  // Check if Docker daemon is running
  const dockerInfo = runCommand('docker info --format "{{.ServerVersion}}"', { timeout: 5000 })
  if (!dockerInfo) {
    warn('Docker daemon running', 'Docker daemon not responding')
    return false
  }

  pass('Docker daemon running', `Server version ${dockerInfo}`)
  return true
}

/**
 * Test 2: Check Supabase containers
 */
function testSupabaseContainers() {
  log('\n📦 Test 2: Supabase Containers', 'cyan')

  // List Supabase-related containers
  const containers = runCommand('docker ps --format "{{.Names}}" | grep -i supabase || echo ""')

  if (!containers) {
    warn('Supabase containers', 'No Supabase containers found (may be using cloud Supabase)')
    return 'cloud'
  }

  const containerList = containers.split('\n').filter(c => c.trim())
  pass('Supabase containers found', `${containerList.length} containers`)

  // Check each critical container
  const criticalContainers = ['supabase_db', 'supabase_auth', 'supabase_rest', 'supabase_realtime']

  for (const name of criticalContainers) {
    const found = containerList.some(c => c.includes(name.replace('supabase_', '')))
    if (found) {
      pass(`Container ${name}`, 'Running')
    } else {
      warn(`Container ${name}`, 'Not found or not running')
    }
  }

  return 'local'
}

/**
 * Test 3: Supabase API Health Check
 */
async function testSupabaseHealth() {
  log('\n🏥 Test 3: Supabase API Health', 'cyan')

  const healthUrl = `${SUPABASE_URL}/rest/v1/`

  try {
    const response = await fetchWithTimeout(healthUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }, 5000)

    if (response.ok || response.status === 400) {
      // 400 is expected for root endpoint
      pass('Supabase REST API', `Responding (status ${response.status})`)
    } else {
      fail('Supabase REST API', `Unexpected status ${response.status}`)
      return false
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      fail('Supabase REST API', 'Timeout after 5 seconds')
    } else {
      fail('Supabase REST API', error.message)
    }
    return false
  }

  // Test auth endpoint
  const authUrl = `${SUPABASE_URL}/auth/v1/health`
  try {
    const response = await fetchWithTimeout(authUrl, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    }, 5000)

    if (response.ok) {
      pass('Supabase Auth API', 'Healthy')
    } else {
      warn('Supabase Auth API', `Status ${response.status}`)
    }
  } catch (error) {
    warn('Supabase Auth API', error.message)
  }

  return true
}

/**
 * Test 4: Database Query Performance
 */
async function testDatabasePerformance() {
  log('\n⚡ Test 4: Database Query Performance', 'cyan')

  const queryUrl = `${SUPABASE_URL}/rest/v1/tasks?select=count&limit=1`

  const times = []
  const attempts = 5

  for (let i = 0; i < attempts; i++) {
    const start = Date.now()
    try {
      await fetchWithTimeout(queryUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact'
        }
      }, 10000)
      times.push(Date.now() - start)
    } catch (error) {
      times.push(-1) // Mark as failed
    }
  }

  const successful = times.filter(t => t > 0)
  const failed = times.filter(t => t < 0).length

  if (successful.length === 0) {
    fail('Database queries', 'All queries failed')
    return false
  }

  const avg = Math.round(successful.reduce((a, b) => a + b, 0) / successful.length)
  const max = Math.max(...successful)
  const min = Math.min(...successful)

  if (failed > 0) {
    warn('Database reliability', `${failed}/${attempts} queries failed`)
  }

  if (avg > 1000) {
    warn('Database latency', `Average ${avg}ms (high)`)
  } else if (avg > 500) {
    pass('Database latency', `Average ${avg}ms (acceptable)`)
  } else {
    pass('Database latency', `Average ${avg}ms (good)`)
  }

  log(`    Min: ${min}ms, Max: ${max}ms, Avg: ${avg}ms`, 'reset')
  return true
}

/**
 * Test 5: Connection Recovery Simulation
 */
async function testConnectionRecovery() {
  log('\n🔄 Test 5: Connection Recovery Simulation', 'cyan')

  // Simulate connection drop by making rapid requests
  const rapidRequests = 10
  const queryUrl = `${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`

  let successCount = 0
  let failCount = 0

  log(`    Making ${rapidRequests} rapid requests...`, 'reset')

  const promises = []
  for (let i = 0; i < rapidRequests; i++) {
    promises.push(
      fetchWithTimeout(queryUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }, 5000)
        .then(() => { successCount++ })
        .catch(() => { failCount++ })
    )
  }

  await Promise.all(promises)

  if (failCount === 0) {
    pass('Rapid request handling', `${successCount}/${rapidRequests} succeeded`)
  } else if (failCount < rapidRequests / 2) {
    warn('Rapid request handling', `${failCount}/${rapidRequests} failed (some dropped)`)
  } else {
    fail('Rapid request handling', `${failCount}/${rapidRequests} failed (connection issues)`)
    return false
  }

  // Test recovery after pause
  log('    Pausing 2 seconds then retrying...', 'reset')
  await sleep(2000)

  try {
    const start = Date.now()
    await fetchWithTimeout(queryUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }, 5000)
    const elapsed = Date.now() - start
    pass('Recovery after pause', `Responded in ${elapsed}ms`)
  } catch (error) {
    fail('Recovery after pause', error.message)
    return false
  }

  return true
}

/**
 * Test 6: WebSocket/Realtime Connection
 */
async function testRealtimeConnection() {
  log('\n📡 Test 6: Realtime WebSocket', 'cyan')

  // Check if realtime endpoint responds
  const realtimeUrl = SUPABASE_URL.replace('http', 'ws').replace(':54321', ':54321') + '/realtime/v1/websocket'

  // We can't easily test WebSocket in Node without additional deps,
  // so we test the HTTP endpoint instead
  const httpRealtimeUrl = `${SUPABASE_URL}/realtime/v1/`

  try {
    const response = await fetchWithTimeout(httpRealtimeUrl, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    }, 5000)

    // Realtime endpoint may return various status codes
    if (response.status < 500) {
      pass('Realtime endpoint', `Responding (status ${response.status})`)
    } else {
      fail('Realtime endpoint', `Server error ${response.status}`)
      return false
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      fail('Realtime endpoint', 'Timeout')
    } else {
      warn('Realtime endpoint', error.message)
    }
    return false
  }

  return true
}

/**
 * Test 7: Container Restart Recovery (DANGEROUS - only with --restart flag)
 */
async function testContainerRestart() {
  log('\n🔥 Test 7: Container Restart Recovery', 'cyan')

  const args = process.argv.slice(2)
  if (!args.includes('--restart')) {
    skip('Container restart', 'Use --restart flag to enable (DANGEROUS)')
    return true
  }

  log('    ⚠️  DANGER: This will restart the Supabase database container!', 'yellow')
  log('    Waiting 3 seconds... (Ctrl+C to cancel)', 'yellow')
  await sleep(3000)

  // Find the database container
  const dbContainer = runCommand('docker ps --format "{{.Names}}" | grep -i "supabase.*db" | head -1')

  if (!dbContainer) {
    skip('Container restart', 'No Supabase DB container found')
    return true
  }

  log(`    Restarting container: ${dbContainer}`, 'cyan')

  // Restart the container
  const restartResult = runCommand(`docker restart ${dbContainer}`, { timeout: 60000 })

  if (!restartResult && restartResult !== '') {
    fail('Container restart', 'Restart command failed')
    return false
  }

  pass('Container restarted', dbContainer)

  // Wait for container to be healthy
  log('    Waiting for container to be healthy...', 'reset')

  let healthy = false
  for (let i = 0; i < 30; i++) {
    await sleep(1000)

    const isRunning = runCommand(`docker inspect -f '{{.State.Running}}' ${dbContainer}`)
    if (isRunning === 'true') {
      healthy = true
      break
    }

    log(`    Attempt ${i + 1}/30...`, 'reset')
  }

  if (!healthy) {
    fail('Container recovery', 'Container did not become healthy in 30 seconds')
    return false
  }

  pass('Container healthy', 'Container is running')

  // Test database connection
  log('    Testing database connection after restart...', 'reset')
  await sleep(2000) // Give it a moment

  const queryUrl = `${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`
  let connectionRestored = false

  for (let i = 0; i < 10; i++) {
    try {
      await fetchWithTimeout(queryUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }, 5000)
      connectionRestored = true
      break
    } catch (error) {
      log(`    Connection attempt ${i + 1}/10 failed, retrying...`, 'yellow')
      await sleep(2000)
    }
  }

  if (connectionRestored) {
    pass('Connection restored', 'Database accessible after restart')
  } else {
    fail('Connection restored', 'Could not reconnect after restart')
    return false
  }

  return true
}

/**
 * Test 8: Graceful Degradation
 */
async function testGracefulDegradation() {
  log('\n🛡️  Test 8: Graceful Degradation Check', 'cyan')

  // Check if shadow backup exists (fallback when Supabase unavailable)
  const shadowPath = path.join(__dirname, '..', 'public', 'shadow-latest.json')

  if (fs.existsSync(shadowPath)) {
    const stats = fs.statSync(shadowPath)
    const ageHours = Math.floor((Date.now() - stats.mtimeMs) / 3600000)

    if (ageHours > 24) {
      warn('Shadow backup age', `${ageHours} hours old (consider refreshing)`)
    } else {
      pass('Shadow backup available', `${(stats.size / 1024).toFixed(1)}KB, ${ageHours}h old`)
    }
  } else {
    warn('Shadow backup', 'Not found - no offline fallback available')
  }

  // Check if localStorage backup mechanism exists
  const backupSystemPath = path.join(__dirname, '..', 'src', 'composables', 'useBackupSystem.ts')
  if (fs.existsSync(backupSystemPath)) {
    pass('Backup system', 'useBackupSystem.ts exists')
  } else {
    warn('Backup system', 'useBackupSystem.ts not found')
  }

  return true
}

// ============================================================================
// Main
// ============================================================================

function printSummary() {
  log('\n' + '='.repeat(60), 'bold')
  log('CONTAINER STABILITY TEST SUMMARY', 'bold')
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

  // VPS-specific recommendations
  log('\n--- VPS RECOMMENDATIONS ---', 'cyan')
  if (results.failed.length === 0 && results.warnings.length === 0) {
    log('  ✅ Container setup is healthy for VPS deployment', 'green')
  } else {
    if (results.warnings.some(w => w.name.includes('Docker'))) {
      log('  • Consider using Docker for consistent deployments', 'yellow')
    }
    if (results.warnings.some(w => w.name.includes('latency'))) {
      log('  • Database latency is high - check VPS resources', 'yellow')
    }
    if (results.warnings.some(w => w.name.includes('Shadow backup'))) {
      log('  • Enable shadow-mirror for offline resilience', 'yellow')
    }
  }

  log('\n')

  if (results.failed.length > 0) {
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const quickMode = args.includes('--quick')

  log('🐳 FlowState Container Stability Tests (TASK-361)', 'bold')
  log('=' .repeat(60), 'bold')
  log(`Supabase URL: ${SUPABASE_URL}`, 'reset')

  if (quickMode) {
    log('Running quick health check only...', 'cyan')
  }

  // Run tests
  const dockerAvailable = testDockerAvailable()
  const supabaseType = dockerAvailable ? testSupabaseContainers() : 'unknown'

  await testSupabaseHealth()

  if (!quickMode) {
    await testDatabasePerformance()
    await testConnectionRecovery()
    await testRealtimeConnection()
    await testContainerRestart()
  }

  await testGracefulDegradation()

  printSummary()
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red')
  process.exit(1)
})
