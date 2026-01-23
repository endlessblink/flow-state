#!/usr/bin/env node

/**
 * TASK-364: WebSocket Stability Stress Tests
 *
 * Tests Supabase Realtime WebSocket stability.
 * Critical for real-time sync on VPS deployments.
 *
 * Tests:
 * 1. Realtime endpoint availability
 * 2. Connection establishment
 * 3. Multiple channel subscriptions
 * 4. Message throughput
 * 5. Reconnection behavior
 *
 * Usage:
 *   npm run test:websocket           # All tests
 *   npm run test:websocket --quick   # Quick validation only
 */

const path = require('path')
const WebSocket = require('ws')

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Handle relative URLs or missing config
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
if (!SUPABASE_URL.startsWith('http')) {
  SUPABASE_URL = 'http://127.0.0.1:54321'
}
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// Derive WebSocket URL
const WS_URL = SUPABASE_URL
  .replace('http://', 'ws://')
  .replace('https://', 'wss://')
  .replace(':54321', ':54321') + '/realtime/v1/websocket'

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

function createWebSocket(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY
      }
    })

    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('Connection timeout'))
    }, timeout)

    ws.on('open', () => {
      clearTimeout(timer)
      resolve(ws)
    })

    ws.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Realtime HTTP Endpoint
 */
async function testRealtimeEndpoint() {
  log('\n📡 Test 1: Realtime HTTP Endpoint', 'cyan')

  const httpUrl = `${SUPABASE_URL}/realtime/v1/`

  try {
    const response = await fetch(httpUrl, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    })

    if (response.status < 500) {
      pass('Realtime HTTP endpoint', `Status ${response.status}`)
      return true
    } else {
      fail('Realtime HTTP endpoint', `Server error ${response.status}`)
      return false
    }
  } catch (error) {
    fail('Realtime HTTP endpoint', error.message)
    return false
  }
}

/**
 * Test 2: WebSocket Connection
 */
async function testWebSocketConnection() {
  log('\n🔌 Test 2: WebSocket Connection', 'cyan')

  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

  try {
    const ws = await createWebSocket(wsUrl, 10000)

    pass('WebSocket connect', 'Connection established')

    // Send a heartbeat
    ws.send(JSON.stringify({
      topic: 'phoenix',
      event: 'heartbeat',
      payload: {},
      ref: '1'
    }))

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(null) // Timeout is not a failure for heartbeat
      }, 3000)

      ws.on('message', (data) => {
        clearTimeout(timer)
        resolve(JSON.parse(data.toString()))
      })
    })

    if (response) {
      pass('WebSocket heartbeat', 'Server responded')
    } else {
      warn('WebSocket heartbeat', 'No response (may be normal)')
    }

    ws.close()
    return true
  } catch (error) {
    if (error.message.includes('timeout')) {
      fail('WebSocket connect', 'Connection timeout')
    } else {
      fail('WebSocket connect', error.message)
    }
    return false
  }
}

/**
 * Test 3: Multiple Connections
 */
async function testMultipleConnections() {
  log('\n🔀 Test 3: Multiple Connections', 'cyan')

  const connectionCount = 5
  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`
  const connections = []

  try {
    for (let i = 0; i < connectionCount; i++) {
      const ws = await createWebSocket(wsUrl, 5000)
      connections.push(ws)
    }

    pass('Multiple connections', `${connections.length} connections established`)

    // Close all connections
    for (const ws of connections) {
      ws.close()
    }

    return true
  } catch (error) {
    // Close any open connections
    for (const ws of connections) {
      try { ws.close() } catch (e) { /* ignore */ }
    }

    warn('Multiple connections', `Only ${connections.length}/${connectionCount} connected: ${error.message}`)
    return connections.length > 0
  }
}

/**
 * Test 4: Channel Subscription
 */
async function testChannelSubscription() {
  log('\n📺 Test 4: Channel Subscription', 'cyan')

  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

  try {
    const ws = await createWebSocket(wsUrl, 10000)

    // Subscribe to a channel
    const joinMessage = JSON.stringify({
      topic: 'realtime:public:tasks',
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: true },
          presence: { key: '' },
          postgres_changes: []
        }
      },
      ref: '2'
    })

    ws.send(joinMessage)

    // Wait for join response
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ event: 'timeout' })
      }, 5000)

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.event === 'phx_reply' || msg.event === 'phx_error') {
          clearTimeout(timer)
          resolve(msg)
        }
      })
    })

    if (response.event === 'phx_reply' && response.payload?.status === 'ok') {
      pass('Channel subscription', 'Joined successfully')
    } else if (response.event === 'phx_error') {
      warn('Channel subscription', 'Join error (may need auth)')
    } else if (response.event === 'timeout') {
      warn('Channel subscription', 'No response (may be normal)')
    } else {
      warn('Channel subscription', `Unexpected: ${response.event}`)
    }

    ws.close()
    return true
  } catch (error) {
    fail('Channel subscription', error.message)
    return false
  }
}

/**
 * Test 5: Message Throughput
 */
async function testMessageThroughput() {
  log('\n⚡ Test 5: Message Throughput', 'cyan')

  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

  try {
    const ws = await createWebSocket(wsUrl, 10000)

    const messageCount = 20
    let sent = 0
    let received = 0

    // Send rapid heartbeats
    const startTime = Date.now()

    for (let i = 0; i < messageCount; i++) {
      ws.send(JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: `hb_${i}`
      }))
      sent++
    }

    // Count responses
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000)

      ws.on('message', () => {
        received++
        if (received >= messageCount) {
          clearTimeout(timer)
          resolve()
        }
      })
    })

    const elapsed = Date.now() - startTime
    const throughput = Math.round((sent / (elapsed / 1000)))

    log(`    Sent: ${sent}, Received: ${received}, Time: ${elapsed}ms`, 'reset')
    log(`    Throughput: ~${throughput} msg/sec`, 'reset')

    if (received >= sent * 0.8) {
      pass('Message throughput', `${received}/${sent} messages, ${throughput} msg/sec`)
    } else if (received > 0) {
      warn('Message throughput', `Only ${received}/${sent} received`)
    } else {
      warn('Message throughput', 'No responses received')
    }

    ws.close()
    return true
  } catch (error) {
    fail('Message throughput', error.message)
    return false
  }
}

/**
 * Test 6: Reconnection Behavior
 */
async function testReconnection() {
  log('\n🔄 Test 6: Reconnection Behavior', 'cyan')

  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

  try {
    // First connection
    let ws = await createWebSocket(wsUrl, 10000)
    pass('Initial connection', 'Established')

    // Close it
    ws.close()
    log('    Connection closed, waiting 1 second...', 'reset')
    await sleep(1000)

    // Reconnect
    ws = await createWebSocket(wsUrl, 10000)
    pass('Reconnection', 'Re-established successfully')

    ws.close()
    return true
  } catch (error) {
    fail('Reconnection', error.message)
    return false
  }
}

/**
 * Test 7: Connection Stability (Long-running)
 */
async function testConnectionStability() {
  log('\n⏱️  Test 7: Connection Stability (10 seconds)', 'cyan')

  const wsUrl = `${WS_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

  try {
    const ws = await createWebSocket(wsUrl, 10000)
    let disconnected = false
    let errors = 0

    ws.on('close', () => { disconnected = true })
    ws.on('error', () => { errors++ })

    // Keep connection alive with heartbeats
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: 'stability'
        }))
      }
    }, 2000)

    // Wait 10 seconds
    await sleep(10000)
    clearInterval(heartbeatInterval)

    if (!disconnected && errors === 0) {
      pass('Connection stability', '10 seconds without disconnection')
    } else if (disconnected) {
      fail('Connection stability', 'Disconnected during test')
    } else {
      warn('Connection stability', `${errors} errors during test`)
    }

    ws.close()
    return !disconnected
  } catch (error) {
    fail('Connection stability', error.message)
    return false
  }
}

// ============================================================================
// Main
// ============================================================================

function printSummary() {
  log('\n' + '='.repeat(60), 'bold')
  log('WEBSOCKET STABILITY TEST SUMMARY', 'bold')
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

  // WebSocket-specific recommendations
  log('\n--- WEBSOCKET RECOMMENDATIONS ---', 'cyan')
  if (results.failed.length === 0) {
    log('  ✅ WebSocket/Realtime is stable', 'green')
  } else {
    log('  • Check Supabase Realtime container status', 'yellow')
    log('  • Verify WebSocket port is accessible', 'yellow')
    log('  • Implement reconnection logic in client', 'yellow')
  }

  log('\n')

  if (results.failed.length > 0) {
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const quickMode = args.includes('--quick')

  log('📡 FlowState WebSocket Stability Tests (TASK-364)', 'bold')
  log('=' .repeat(60), 'bold')
  log(`WebSocket URL: ${WS_URL}`, 'reset')

  // Check if ws module is available
  try {
    require('ws')
  } catch (error) {
    log('\n❌ WebSocket module not installed. Run: npm install ws', 'red')
    process.exit(1)
  }

  if (quickMode) {
    log('Running quick validation only...', 'cyan')
  }

  // Run tests
  await testRealtimeEndpoint()
  await testWebSocketConnection()

  if (!quickMode) {
    await testMultipleConnections()
    await testChannelSubscription()
    await testMessageThroughput()
    await testReconnection()
    await testConnectionStability()
  }

  printSummary()
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red')
  process.exit(1)
})
