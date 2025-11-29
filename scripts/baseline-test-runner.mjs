#!/usr/bin/env node

/**
 * Pomo-Flow Baseline Test Runner
 * Automated baseline testing for Phase 3 preparation
 *
 * This script establishes comprehensive baseline metrics before
 * component refactoring begins in Phase 3.
 */

import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cpus } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Baseline configuration
const BASELINE_CONFIG = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  memory: process.memoryUsage(),
  cpus: cpus().length,
  projectName: 'Pomo-Flow Phase 3 Baseline',
  version: '1.0.0'
}

// Test phases with timeout and retry configuration
const TEST_PHASES = [
  {
    name: 'Infrastructure Validation',
    tests: [
      { command: 'npm run validate:imports', timeout: 30000, critical: true },
      { command: 'npm run validate:css', timeout: 30000, critical: true },
      { command: 'npm run build', timeout: 300000, critical: true }
    ]
  },
  {
    name: 'Unit Testing',
    tests: [
      { command: 'npm run test -- --run', timeout: 120000, critical: true }
    ]
  },
  {
    name: 'Safety Testing',
    tests: [
      { command: 'npm run test:safety', timeout: 60000, critical: false }
    ]
  },
  {
    name: 'Performance Metrics',
    tests: [
      { command: 'node scripts/measure-bundle-size.js', timeout: 30000, critical: false },
      { command: 'node scripts/measure-startup-time.js', timeout: 60000, critical: false }
    ]
  }
]

// Results tracking
let results = {
  config: BASELINE_CONFIG,
  phases: [],
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    criticalFailures: 0,
    totalTime: 0,
    success: false
  },
  artifacts: []
}

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${level}] ${message}`)
}

function ensureDirectoryExists(filePath) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function executeTest(testConfig, phaseName) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    log(`Executing: ${testConfig.command}`)

    const child = spawn(testConfig.command, {
      shell: true,
      stdio: 'pipe',
      cwd: process.cwd()
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      process.stdout.write(output)
    })

    child.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      process.stderr.write(output)
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      const duration = Date.now() - startTime
      log(`Test timed out after ${testConfig.timeout}ms: ${testConfig.command}`, 'ERROR')
      resolve({
        name: testConfig.command,
        phase: phaseName,
        status: 'TIMEOUT',
        duration,
        timeout: testConfig.timeout,
        stdout: stdout.slice(-1000), // Last 1000 chars
        stderr: stderr.slice(-1000),
        critical: testConfig.critical,
        error: `Test timed out after ${testConfig.timeout}ms`
      })
    }, testConfig.timeout)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const duration = Date.now() - startTime

      const result = {
        name: testConfig.command,
        phase: phaseName,
        status: code === 0 ? 'PASSED' : 'FAILED',
        duration,
        exitCode: code,
        signal,
        stdout,
        stderr,
        critical: testConfig.critical
      }

      if (signal === 'SIGKILL') {
        result.status = 'TIMEOUT'
        result.error = `Test killed due to timeout (${testConfig.timeout}ms)`
      } else if (code !== 0) {
        result.error = `Test failed with exit code ${code}`
      }

      resolve(result)
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      const duration = Date.now() - startTime
      log(`Test execution error: ${error.message}`, 'ERROR')
      resolve({
        name: testConfig.command,
        phase: phaseName,
        status: 'ERROR',
        duration,
        error: error.message,
        stdout,
        stderr,
        critical: testConfig.critical
      })
    })
  })
}

function generateBundleAnalysis() {
  try {
    const distPath = join(process.cwd(), 'dist')
    if (existsSync(distPath)) {
      const analysis = {
        timestamp: new Date().toISOString(),
        distPath,
        assets: []
      }

      // This would ideally use a proper directory scanner
      // For now, we'll store basic information
      return analysis
    }
  } catch (error) {
    log(`Bundle analysis failed: ${error.message}`, 'WARN')
  }
  return null
}

async function runBaselineTests() {
  const overallStartTime = Date.now()

  log('🚀 Starting Pomo-Flow Phase 3 Baseline Testing')
  log(`Configuration: ${JSON.stringify(BASELINE_CONFIG, null, 2)}`)

  for (const phase of TEST_PHASES) {
    log(`\n📋 Starting Phase: ${phase.name}`)

    const phaseResult = {
      name: phase.name,
      startTime: new Date().toISOString(),
      tests: [],
      summary: {
        total: phase.tests.length,
        passed: 0,
        failed: 0,
        totalTime: 0
      }
    }

    for (const testConfig of phase.tests) {
      const testResult = await executeTest(testConfig, phase.name)
      phaseResult.tests.push(testResult)

      // Update counters
      results.summary.totalTests++
      if (testResult.status === 'PASSED') {
        results.summary.passedTests++
        phaseResult.summary.passed++
      } else {
        results.summary.failedTests++
        phaseResult.summary.failed++

        if (testResult.critical) {
          results.summary.criticalFailures++
          log(`❌ CRITICAL TEST FAILED: ${testConfig.command}`, 'ERROR')
        } else {
          log(`⚠️  Non-critical test failed: ${testConfig.command}`, 'WARN')
        }
      }
    }

    phaseResult.endTime = new Date().toISOString()
    phaseResult.summary.totalTime = Date.now() - Date.parse(phaseResult.startTime)
    results.phases.push(phaseResult)

    log(`✅ Phase "${phase.name}" completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`)
  }

  // Generate performance metrics
  log('\n📊 Generating performance metrics...')
  const bundleAnalysis = generateBundleAnalysis()
  if (bundleAnalysis) {
    results.artifacts.push(bundleAnalysis)
  }

  // Finalize results
  const overallEndTime = Date.now()
  results.summary.totalTime = overallEndTime - overallStartTime
  results.summary.success = results.summary.criticalFailures === 0
  results.endTime = new Date().toISOString()

  // Save results
  const resultsPath = join(process.cwd(), 'test-results', 'baseline-results.json')
  ensureDirectoryExists(resultsPath)

  writeFileSync(resultsPath, JSON.stringify(results, null, 2))

  // Generate summary report
  const summaryPath = join(process.cwd(), 'test-results', 'baseline-summary.md')
  generateSummaryReport(results, summaryPath)

  // Log final results
  log('\n' + '='.repeat(80))
  log('🏁 BASELINE TESTING COMPLETE')
  log('='.repeat(80))
  log(`Total Duration: ${(results.summary.totalTime / 1000).toFixed(2)} seconds`)
  log(`Tests Passed: ${results.summary.passedTests}/${results.summary.totalTests}`)
  log(`Critical Failures: ${results.summary.criticalFailures}`)
  log(`Overall Status: ${results.summary.success ? '✅ SUCCESS' : '❌ FAILED'}`)
  log(`Results saved to: ${resultsPath}`)
  log(`Summary saved to: ${summaryPath}`)

  if (results.summary.criticalFailures > 0) {
    log('\n❌ BASELINE FAILED - Critical tests failed. Address issues before proceeding with Phase 3.', 'ERROR')
    process.exit(1)
  } else {
    log('\n✅ BASELINE SUCCESS - Ready to proceed with Phase 3 component refactoring.')
    process.exit(0)
  }
}

function generateSummaryReport(results, outputPath) {
  const report = `# Pomo-Flow Phase 3 Baseline Report

Generated: ${results.endTime}
Total Duration: ${(results.summary.totalTime / 1000).toFixed(2)} seconds

## Executive Summary

- **Status**: ${results.summary.success ? '✅ SUCCESS' : '❌ FAILED'}
- **Tests Passed**: ${results.summary.passedTests}/${results.summary.totalTests}
- **Critical Failures**: ${results.summary.criticalFailures}
- **Environment**: ${results.config.platform} (${results.config.arch}) - Node ${results.config.nodeVersion}

## Phase Results

${results.phases.map(phase => `
### ${phase.name}

**Duration**: ${(phase.summary.totalTime / 1000).toFixed(2)}s
**Results**: ${phase.summary.passed}/${phase.summary.total} tests passed

${phase.tests.map(test => `
- **${test.name}**: ${test.status} (${(test.duration / 1000).toFixed(2)}s)
  ${test.error ? `  \n  ❌ Error: ${test.error}` : ''}
  ${test.critical ? '  \n  ⚠️ Critical test' : ''}
`).join('\n')}
`).join('\n')}

## Performance Metrics

- **Bundle Size**: ${results.artifacts.find(a => a.distPath) ? 'See bundle analysis' : 'Not available'}
- **Startup Time**: ${results.artifacts.length > 0 ? 'Measured' : 'Not measured'}

## Recommendations

${results.summary.success ?
  '✅ Baseline established successfully. Ready to proceed with Phase 3 component refactoring.' :
  '❌ Critical failures detected. Address these issues before beginning Phase 3 refactoring.'}

## Next Steps

1. Review any failed tests and fix critical issues
2. Use this baseline as reference for Phase 3 refactoring
3. Monitor for regressions during component optimization
4. Update baseline after major refactoring milestones

---
*Report generated by Pomo-Flow Baseline Test Runner v${results.config.version}*
`

  ensureDirectoryExists(outputPath)
  writeFileSync(outputPath, report)
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'ERROR')
  log(error.stack, 'ERROR')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}`, 'ERROR')
  log(`Reason: ${reason}`, 'ERROR')
  process.exit(1)
})

// Run baseline tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runBaselineTests().catch((error) => {
    log(`Baseline testing failed: ${error.message}`, 'ERROR')
    process.exit(1)
  })
}