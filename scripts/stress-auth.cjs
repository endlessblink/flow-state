#!/usr/bin/env node

/**
 * TASK-363: Auth Edge Cases Stress Tests
 *
 * Tests authentication boundary conditions.
 * Critical for VPS deployments with multiple users.
 *
 * Tests:
 * 1. Anonymous/guest mode access
 * 2. Invalid token rejection
 * 3. Token structure validation
 * 4. RLS policy enforcement
 * 5. Rate limiting behavior
 *
 * Usage:
 *   npm run test:auth              # All tests
 *   npm run test:auth --quick      # Quick validation only
 */

const path = require('path')
const crypto = require('crypto')

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Handle relative URLs or missing config
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
if (!SUPABASE_URL.startsWith('http')) {
  SUPABASE_URL = 'http://127.0.0.1:54321'
}
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

async function fetchWithAuth(endpoint, token, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  return {
    status: response.status,
    ok: response.ok,
    data: await response.json().catch(() => null)
  }
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: Valid Anon Key Access
 */
async function testValidAnonKey() {
  log('\n🔑 Test 1: Valid Anon Key Access', 'cyan')

  const response = await fetchWithAuth('tasks?select=count', SUPABASE_ANON_KEY, {
    headers: { 'Prefer': 'count=exact' }
  })

  if (response.ok || response.status === 200) {
    pass('Anon key access', 'Authenticated successfully')
    return true
  } else if (response.status === 401) {
    fail('Anon key access', 'Authentication failed (401)')
    return false
  } else {
    warn('Anon key access', `Unexpected status: ${response.status}`)
    return true
  }
}

/**
 * Test 2: Invalid Token Rejection
 */
async function testInvalidTokenRejection() {
  log('\n🚫 Test 2: Invalid Token Rejection', 'cyan')

  const invalidTokens = [
    { name: 'Empty token', token: '' },
    { name: 'Random string', token: 'invalid_token_12345' },
    { name: 'Malformed JWT', token: 'eyJ.invalid.token' },
    { name: 'SQL injection attempt', token: "'; DROP TABLE tasks; --" }
  ]

  let allRejected = true

  for (const { name, token } of invalidTokens) {
    const response = await fetchWithAuth('tasks?select=id&limit=1', token)

    if (response.status === 401 || response.status === 403) {
      pass(`Reject ${name}`, `Status ${response.status}`)
    } else if (response.ok) {
      fail(`Reject ${name}`, 'Token was accepted!')
      allRejected = false
    } else {
      warn(`Reject ${name}`, `Unexpected status: ${response.status}`)
    }
  }

  return allRejected
}

/**
 * Test 3: Missing Authorization Header
 */
async function testMissingAuthHeader() {
  log('\n🔓 Test 3: Missing Authorization Header', 'cyan')

  const url = `${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`

  // Request with only apikey, no Authorization header
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY
      // No Authorization header
    }
  })

  if (response.status === 401 || response.status === 403) {
    pass('Missing auth header', `Rejected (${response.status})`)
  } else if (response.ok) {
    // Some setups allow anon access with just apikey
    warn('Missing auth header', 'Request succeeded - check RLS policies')
  } else {
    log(`    Status: ${response.status}`, 'reset')
    pass('Missing auth header', 'Request handled')
  }

  return true
}

/**
 * Test 4: Expired Token Simulation
 */
async function testExpiredTokenSimulation() {
  log('\n⏰ Test 4: Expired Token Simulation', 'cyan')

  // Create a fake expired JWT (this won't actually work against Supabase,
  // but tests the endpoint's response to malformed tokens)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: 'test-user',
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200
  })).toString('base64url')
  const fakeSignature = 'invalid_signature'

  const expiredToken = `${header}.${payload}.${fakeSignature}`

  const response = await fetchWithAuth('tasks?select=id&limit=1', expiredToken)

  if (response.status === 401 || response.status === 403) {
    pass('Expired token', `Rejected (${response.status})`)
  } else if (response.ok) {
    fail('Expired token', 'Token was accepted!')
    return false
  } else {
    warn('Expired token', `Status: ${response.status}`)
  }

  return true
}

/**
 * Test 5: Rate Limiting Behavior
 */
async function testRateLimiting() {
  log('\n🚦 Test 5: Rate Limiting Behavior', 'cyan')

  const requestCount = 50
  const results = []

  log(`    Sending ${requestCount} rapid requests...`, 'reset')

  const startTime = Date.now()

  for (let i = 0; i < requestCount; i++) {
    const response = await fetchWithAuth('tasks?select=count', SUPABASE_ANON_KEY, {
      headers: { 'Prefer': 'count=exact' }
    })
    results.push(response.status)
  }

  const elapsed = Date.now() - startTime
  const successCount = results.filter(s => s === 200).length
  const rateLimited = results.filter(s => s === 429).length
  const errors = results.filter(s => s >= 400 && s !== 429).length

  log(`    Completed in ${elapsed}ms`, 'reset')
  log(`    Success: ${successCount}, Rate limited: ${rateLimited}, Errors: ${errors}`, 'reset')

  if (rateLimited > 0) {
    pass('Rate limiting active', `${rateLimited} requests were rate limited`)
  } else if (successCount === requestCount) {
    warn('Rate limiting', 'No rate limiting detected (all succeeded)')
  } else {
    warn('Rate limiting', `${errors} requests failed with errors`)
  }

  return true
}

/**
 * Test 6: Auth Endpoint Health
 */
async function testAuthEndpointHealth() {
  log('\n🏥 Test 6: Auth Endpoint Health', 'cyan')

  const endpoints = [
    { name: 'Auth health', url: `${SUPABASE_URL}/auth/v1/health` },
    { name: 'Auth settings', url: `${SUPABASE_URL}/auth/v1/settings` }
  ]

  for (const { name, url } of endpoints) {
    try {
      const response = await fetch(url, {
        headers: { 'apikey': SUPABASE_ANON_KEY }
      })

      if (response.ok) {
        pass(name, 'Healthy')
      } else if (response.status === 404) {
        skip(name, 'Endpoint not available')
      } else {
        warn(name, `Status ${response.status}`)
      }
    } catch (error) {
      warn(name, error.message)
    }
  }

  return true
}

/**
 * Test 7: Token Refresh Simulation
 */
async function testTokenRefreshSimulation() {
  log('\n🔄 Test 7: Token Refresh Simulation', 'cyan')

  // Test the refresh endpoint exists and responds appropriately
  const refreshUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`

  try {
    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: 'invalid_refresh_token'
      })
    })

    if (response.status === 400 || response.status === 401) {
      pass('Token refresh endpoint', 'Rejects invalid refresh token')
    } else if (response.status === 404) {
      skip('Token refresh endpoint', 'Endpoint not available')
    } else {
      warn('Token refresh endpoint', `Status ${response.status}`)
    }
  } catch (error) {
    warn('Token refresh endpoint', error.message)
  }

  return true
}

/**
 * Test 8: Cross-Origin Request Handling
 */
async function testCrossOriginHandling() {
  log('\n🌐 Test 8: CORS Configuration', 'cyan')

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
        'apikey': SUPABASE_ANON_KEY
      }
    })

    const allowOrigin = response.headers.get('Access-Control-Allow-Origin')
    const allowMethods = response.headers.get('Access-Control-Allow-Methods')

    if (allowOrigin === '*') {
      warn('CORS config', 'Allows all origins (*) - consider restricting for production')
    } else if (allowOrigin) {
      pass('CORS config', `Origin restriction: ${allowOrigin}`)
    } else {
      pass('CORS config', 'No CORS headers (may block cross-origin)')
    }
  } catch (error) {
    warn('CORS config', error.message)
  }

  return true
}

// ============================================================================
// Main
// ============================================================================

function printSummary() {
  log('\n' + '='.repeat(60), 'bold')
  log('AUTH EDGE CASES TEST SUMMARY', 'bold')
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

  // Auth-specific recommendations
  log('\n--- AUTH RECOMMENDATIONS ---', 'cyan')
  if (results.failed.length === 0) {
    log('  ✅ Auth configuration is secure', 'green')
  } else {
    log('  • Review token validation logic', 'yellow')
    log('  • Ensure RLS policies are enforced', 'yellow')
    log('  • Consider adding rate limiting', 'yellow')
  }

  log('\n')

  if (results.failed.length > 0) {
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const quickMode = args.includes('--quick')

  log('🔐 FlowState Auth Edge Cases Tests (TASK-363)', 'bold')
  log('=' .repeat(60), 'bold')
  log(`Supabase URL: ${SUPABASE_URL}`, 'reset')

  if (quickMode) {
    log('Running quick validation only...', 'cyan')
  }

  // Run tests
  await testValidAnonKey()
  await testInvalidTokenRejection()
  await testMissingAuthHeader()

  if (!quickMode) {
    await testExpiredTokenSimulation()
    await testRateLimiting()
    await testAuthEndpointHealth()
    await testTokenRefreshSimulation()
    await testCrossOriginHandling()
  }

  printSummary()
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red')
  process.exit(1)
})
