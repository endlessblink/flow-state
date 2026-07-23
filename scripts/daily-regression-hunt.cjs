#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const DEFAULT_REPORT_DIR = 'reports/regression-hunt'
const MANIFEST_URL = 'https://in-theflow.com/updates/electron/latest-linux.yml'

const FIXED_DAILY_CHECKS = [
  {
    id: 'git-status',
    title: 'Workspace dirty-state boundary',
    command: ['git', 'status', '--short', '--branch'],
    failureClass: 'stale process/cache',
    timeoutMs: 20_000,
  },
  {
    id: 'electron-sync-guard',
    title: 'Auth, sync, undo, and Electron persistence guard',
    command: ['npm', 'run', 'guard:electron-sync'],
    failureClass: 'auth/sync',
    timeoutMs: 240_000,
  },
  {
    id: 'task-consistency-audit',
    title: 'Cardinal task consistency and recoverability inventory',
    command: ['npm', 'run', 'audit:task-consistency'],
    failureClass: 'task consistency/data recoverability',
    timeoutMs: 20_000,
  },
  {
    id: 'type-check',
    title: 'TypeScript/Vue contract check',
    command: ['npm', 'run', 'type-check'],
    failureClass: 'Canvas data/state',
    timeoutMs: 240_000,
  },
  {
    id: 'focused-recurring-pack',
    title: 'Focused recurring regression pack',
    command: [
      'npm',
      'test',
      '--',
      'tests/unit/sync/sync-orchestrator.test.ts',
      'tests/unit/sync/sync-status-popover.test.ts',
      'tests/unit/sync/cross-tab-sync.test.ts',
      'tests/unit/stores/auth-flow.test.ts',
      'tests/unit/canvas/canvas-composables.test.ts',
      'tests/unit/canvas/modal-task-resolution.test.ts',
      'tests/unit/components/quick-task-dropdown-pin.test.ts',
      'tests/unit/app/quick-task-durable-ack.test.ts',
      'tests/unit/kde/today-filter-parity.test.ts',
      'tests/unit/services/canonical-change-catchup.test.ts',
      'tests/unit/undo-entrypoint-contract.test.ts',
      'tests/contract/canonical-task-renderer-authority.test.ts',
      'src/composables/tasks/__tests__/useTaskContextMenuActions.spec.ts',
      'tests/unit/kde/timer-sync.test.ts',
    ],
    failureClass: 'Canvas data/state',
    timeoutMs: 240_000,
  },
  {
    id: 'lifecycle-durability',
    title: 'Delete, done, reload, and tombstone durability guard',
    command: [
      'npm',
      'test',
      '--',
      'tests/unit/undo-task-operations.test.ts',
      'tests/unit/task-rollback.test.ts',
      'tests/unit/stores/smart-merge.test.ts',
      'tests/unit/composables/useSupabaseDatabase-delete.test.ts',
      'tests/unit/sync/sync-orchestrator.test.ts',
      'tests/unit/local-api/done-for-now-handler.test.ts',
      'tests/unit/local-api/merge-tasks-handler.test.ts',
      'tests/unit/local-api/merge-tasks-route-contract.test.ts',
      'tests/unit/local-api/task-search.test.ts',
      'tests/unit/services/done-for-now.test.ts',
    ],
    failureClass: 'permanent delete/undo/recurring completion/duplicate merge',
    timeoutMs: 240_000,
  },
  {
    id: 'offline-reconnect-convergence',
    title: 'Offline create, edit, completion, and delete convergence',
    command: ['npm', 'run', 'test:offline-reconnect-flows'],
    failureClass: 'task consistency/offline sync queue',
    timeoutMs: 240_000,
  },
  {
    id: 'canonical-assistant-contract',
    title: 'Canonical operation, Notion activation, and convergence authority',
    command: [
      'bash',
      '-lc',
      'npm run test:reliable-assistant-contract && npm test -- tests/contract/canonical-task-contract.test.ts tests/contract/notion-activation-contract.test.ts tests/unit/local-api/canonical-task-patch-handler.test.ts tests/unit/local-api/notion-activation-handler.test.ts tests/unit/services/canonical-change-catchup.test.ts',
    ],
    failureClass: 'canonical assistant authority',
    timeoutMs: 300_000,
  },
  {
    id: 'timer-boundary',
    title: 'Electron/KDE timer local boundary diagnosis',
    command: ['node', 'scripts/diagnose-timer-boundary.cjs'],
    failureClass: 'KDE/local sidecar',
    timeoutMs: 60_000,
  },
  {
    id: 'live-boundary',
    title: 'Live desktop auth and KDE timer boundary diagnosis',
    command: ['node', 'scripts/diagnose-live-boundary.cjs'],
    failureClass: 'KDE/local sidecar',
    timeoutMs: 60_000,
  },
  {
    id: 'updater-manifest',
    title: 'Live Electron updater manifest probe',
    command: ['curl', '-fsS', '--max-time', '20', MANIFEST_URL],
    failureClass: 'Electron updater/runtime',
    timeoutMs: 30_000,
  },
]

const ROTATING_DAILY_CHECKS = {
  1: {
    id: 'canvas-flows',
    title: 'Canvas user-flow rotation',
    command: ['npm', 'run', 'test:canvas-flows'],
    failureClass: 'Canvas data/state',
    timeoutMs: 300_000,
  },
  2: {
    id: 'timer-flows',
    title: 'Timer user-flow rotation',
    command: ['npm', 'run', 'test:timer-flows'],
    failureClass: 'KDE/local sidecar',
    timeoutMs: 300_000,
  },
  3: {
    id: 'task-flows',
    title: 'Task management user-flow rotation',
    command: ['npm', 'run', 'test:task-flows'],
    failureClass: 'permanent delete/undo',
    timeoutMs: 300_000,
  },
  4: {
    id: 'canvas-flows',
    title: 'Canvas user-flow rotation',
    command: ['npm', 'run', 'test:canvas-flows'],
    failureClass: 'Canvas data/state',
    timeoutMs: 300_000,
  },
  5: {
    id: 'timer-flows',
    title: 'Timer user-flow rotation',
    command: ['npm', 'run', 'test:timer-flows'],
    failureClass: 'KDE/local sidecar',
    timeoutMs: 300_000,
  },
  6: {
    id: 'stress-quick',
    title: 'Quick stress rotation',
    command: ['npm', 'run', 'test:stress:quick'],
    failureClass: 'stale process/cache',
    timeoutMs: 300_000,
  },
  0: {
    id: 'user-flows',
    title: 'Full user-flow rotation',
    command: ['npm', 'run', 'test:user-flows'],
    failureClass: 'Canvas data/state',
    timeoutMs: 420_000,
  },
}

const WEEKLY_CHECKS = [
  ROTATING_DAILY_CHECKS[1],
  ROTATING_DAILY_CHECKS[2],
  ROTATING_DAILY_CHECKS[3],
  ROTATING_DAILY_CHECKS[6],
  ROTATING_DAILY_CHECKS[0],
]

function parseArgs(argv) {
  const options = {
    mode: 'daily',
    dryRun: false,
    json: false,
    latest: false,
    notify: false,
    reportDir: DEFAULT_REPORT_DIR,
    only: null,
    date: null,
    classify: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--mode') {
      options.mode = argv[++i] || options.mode
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--latest') {
      options.latest = true
    } else if (arg === '--notify') {
      options.notify = true
    } else if (arg === '--report-dir') {
      options.reportDir = argv[++i] || options.reportDir
    } else if (arg === '--only') {
      options.only = (argv[++i] || '').split(',').map((value) => value.trim()).filter(Boolean)
    } else if (arg === '--date') {
      options.date = argv[++i] || null
    } else if (arg === '--classify') {
      options.classify = argv[++i] || ''
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!['daily', 'weekly'].includes(options.mode)) {
    throw new Error(`Unsupported --mode ${options.mode}`)
  }

  return options
}

function printHelp() {
  console.log(`FlowState daily regression hunt

Usage:
  node scripts/daily-regression-hunt.cjs [--mode daily|weekly] [--dry-run] [--json]
  node scripts/daily-regression-hunt.cjs --latest
  node scripts/daily-regression-hunt.cjs --classify "error text"

Options:
  --report-dir <dir>   Report output directory. Default: ${DEFAULT_REPORT_DIR}
  --only <ids>         Comma-separated check IDs to run.
  --date YYYY-MM-DD    Override date for rotation tests.
  --notify            Send a desktop notification when the run fails.
`)
}

function classifyFailure(text = '', fallback = 'unknown') {
  const value = String(text).toLowerCase()

  if (/(sign[- ]?in expired|auth|session|token|sync error|sync queue|reconnect grace)/.test(value)) {
    return 'auth/sync'
  }
  if (/(channel_error|realtime|websocket|supabase)/.test(value)) {
    return 'Supabase/realtime'
  }
  if (/(canonical|notion activation|operation receipt|change sequence)/.test(value)) {
    return 'canonical assistant authority'
  }
  if (/(permanent.?delete|hard.?delete|undo|tombstone|trash)/.test(value)) {
    return 'permanent delete/undo'
  }
  if (/(kde|plasmoid|timer stuck|active[- ]?task|local api|5577|break prompt|stuck at 0)/.test(value)) {
    return 'KDE/local sidecar'
  }
  if (/(canvas|group|groups|nodes?|view switch|switching views|disappear|position)/.test(value)) {
    return 'Canvas data/state'
  }
  if (/(latest-linux|appimage|electron updater|update manifest|version|artifact)/.test(value)) {
    return 'Electron updater/runtime'
  }
  if (/(duplicate process|stale|cache|hidden process|heartbeat)/.test(value)) {
    return 'stale process/cache'
  }

  return fallback
}

function getRotationDate(dateArg) {
  if (dateArg) {
    return new Date(`${dateArg}T00:00:00Z`)
  }
  return new Date()
}

function buildChecks(options) {
  const checks = [...FIXED_DAILY_CHECKS]
  if (options.mode === 'weekly') {
    checks.push(...WEEKLY_CHECKS)
  } else {
    const day = getRotationDate(options.date).getUTCDay()
    checks.push(ROTATING_DAILY_CHECKS[day])
  }

  const uniqueChecks = []
  const seen = new Set()
  for (const check of checks) {
    if (!check || seen.has(check.id)) {
      continue
    }
    seen.add(check.id)
    uniqueChecks.push(check)
  }

  if (!options.only?.length) {
    return uniqueChecks
  }

  const requested = new Set(options.only)
  return uniqueChecks.filter((check) => requested.has(check.id) || requested.has(check.failureClass))
}

function runCommand(check, dryRun) {
  const startedAt = new Date().toISOString()
  const commandLine = check.command.join(' ')

  if (dryRun) {
    return {
      ...check,
      commandLine,
      status: 'skipped',
      exitCode: null,
      durationMs: 0,
      startedAt,
      endedAt: new Date().toISOString(),
      outputSnippet: 'Dry run: command was planned but not executed.',
      likelyFailureClass: check.failureClass,
      nextReproCommand: commandLine,
    }
  }

  const start = Date.now()
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: check.timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', CI: process.env.CI || '1' },
  })
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  const exitCode = result.status ?? (result.signal ? 124 : 1)
  const status = exitCode === 0 ? 'pass' : 'fail'

  return {
    ...check,
    commandLine,
    status,
    exitCode,
    signal: result.signal || null,
    durationMs: Date.now() - start,
    startedAt,
    endedAt: new Date().toISOString(),
    outputSnippet: tail(combined, 6_000),
    likelyFailureClass: status === 'fail' ? classifyFailure(combined, check.failureClass) : check.failureClass,
    nextReproCommand: commandLine,
  }
}

function tail(text, limit) {
  if (!text) {
    return ''
  }
  return text.length <= limit ? text : text.slice(text.length - limit)
}

function summarize(checks) {
  const summary = checks.reduce((currentSummary, check) => {
    currentSummary.total += 1
    currentSummary[check.status] += 1
    return currentSummary
  }, { total: 0, pass: 0, fail: 0, skipped: 0 })
  summary.passed = summary.pass
  summary.failed = summary.fail
  return summary
}

function writeReports(report, reportDir) {
  mkdirSync(reportDir, { recursive: true })
  const safeTimestamp = report.startedAt.replace(/[:.]/g, '-')
  const base = `${report.date}-${report.mode}-${safeTimestamp}`
  const jsonPath = resolve(reportDir, `${base}.json`)
  const markdownPath = resolve(reportDir, `${base}.md`)

  report.files = {
    json: jsonPath,
    markdown: markdownPath,
  }

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(markdownPath, renderMarkdown(report))
}

function renderMarkdown(report) {
  const lines = [
    '# FlowState Regression Hunt',
    '',
    `- Date: ${report.date}`,
    `- Mode: ${report.mode}`,
    `- Dry run: ${report.dryRun ? 'yes' : 'no'}`,
    `- Summary: ${report.summary.pass} passed, ${report.summary.fail} failed, ${report.summary.skipped} skipped`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    '',
    '## Checks',
    '',
  ]

  for (const check of report.checks) {
    lines.push(`### ${statusLabel(check.status)} ${check.id}`)
    lines.push('')
    lines.push(`- Title: ${check.title}`)
    lines.push(`- Command: \`${check.commandLine}\``)
    lines.push(`- Failure class: ${check.likelyFailureClass}`)
    lines.push(`- Exit code: ${check.exitCode === null ? 'n/a' : check.exitCode}`)
    lines.push(`- Duration: ${check.durationMs}ms`)
    lines.push(`- Next repro: \`${check.nextReproCommand}\``)
    if (check.outputSnippet) {
      lines.push('')
      lines.push('```text')
      lines.push(check.outputSnippet)
      lines.push('```')
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function statusLabel(status) {
  if (status === 'pass') return 'PASS'
  if (status === 'fail') return 'FAIL'
  return 'SKIP'
}

function printLatest(reportDir) {
  const absoluteReportDir = resolve(reportDir)
  if (!existsSync(absoluteReportDir)) {
    console.log(`No FlowState regression hunt reports found in ${absoluteReportDir}`)
    return
  }

  const markdownReports = readdirSync(absoluteReportDir)
    .filter((name) => name.endsWith('.md'))
    .sort()

  if (!markdownReports.length) {
    console.log(`No FlowState regression hunt markdown reports found in ${absoluteReportDir}`)
    return
  }

  const latestPath = join(absoluteReportDir, markdownReports[markdownReports.length - 1])
  const content = readFileSync(latestPath, 'utf8')
  const summaryLine = content.split('\n').find((line) => line.startsWith('- Summary:')) || '- Summary: unavailable'
  console.log('Latest FlowState regression hunt report')
  console.log(latestPath)
  console.log(summaryLine)
}

function notifyIfNeeded(report, enabled) {
  if (!enabled || report.summary.fail === 0) {
    return
  }

  const failed = report.checks.find((check) => check.status === 'fail')
  const title = `FlowState regression failed: ${report.summary.fail}/${report.summary.total}`
  const body = [
    failed ? `${failed.id}: ${failed.likelyFailureClass}` : 'Open the latest report for details.',
    report.files.markdown,
  ].filter(Boolean).join('\n')

  spawnSync('notify-send', ['-u', 'critical', title, body], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 10_000,
    env: process.env,
  })
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.classify !== null) {
    console.log(JSON.stringify({ failureClass: classifyFailure(options.classify) }))
    return 0
  }

  if (options.latest) {
    printLatest(options.reportDir)
    return 0
  }

  const startedAt = new Date().toISOString()
  const date = options.date || startedAt.slice(0, 10)
  const plannedChecks = buildChecks(options)
  const checks = plannedChecks.map((check) => runCommand(check, options.dryRun))
  const finishedAt = new Date().toISOString()
  const report = {
    schemaVersion: 1,
    name: 'flowstate-daily-regression-hunt',
    mode: options.mode,
    date,
    dryRun: options.dryRun,
    startedAt,
    finishedAt,
    summary: summarize(checks),
    checks,
    files: {},
  }

  writeReports(report, options.reportDir)
  notifyIfNeeded(report, options.notify)

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`FlowState regression hunt: ${report.summary.pass} passed, ${report.summary.fail} failed, ${report.summary.skipped} skipped`)
    console.log(`JSON: ${report.files.json}`)
    console.log(`Markdown: ${report.files.markdown}`)
  }

  return report.summary.fail > 0 ? 1 : 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
