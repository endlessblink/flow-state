#!/usr/bin/env node
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const MATRIX_DOC = 'docs/process/failure-class-matrix.md'
const REQUIRED_MATRIX_FIELDS = [
  'Failure-class matrix',
  'Exact failure mode fixed',
  'Explicitly not covered',
  'Regression added for reported repro',
  'Live boundary proof',
]

const DONE_PATTERN = /✅\s*(DONE|Done)|Status\*\*:\s*✅|~~(?:BUG|TASK|FEATURE)-/i
const RECURRENCE_PATTERN = /\b(recurring|again|already fixed|already solved|previously fixed|keeps?|persists?|regression|same (?:bug|issue|symptom)|failure-class|failure class|KDE|Electron|sidecar|localhost|timer|subtasks?|canvas broke)\b/i
const MATRIX_PATTERN = new RegExp(REQUIRED_MATRIX_FIELDS.join('|'), 'i')

function parseArgs(argv) {
  const args = { mode: 'precommit' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--mode') args.mode = argv[++i]
    else if (arg === '--diff-file') args.diffFile = argv[++i]
    else if (arg === '--file') args.file = argv[++i]
    else if (arg === '--help' || arg === '-h') args.help = true
  }
  return args
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function readCachedMasterPlanDiff() {
  try {
    return execFileSync('git', ['diff', '--cached', '--', 'docs/MASTER_PLAN.md'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function addedLinesFromDiff(diff) {
  return diff
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1))
}

function hasRecurringCloseout(text) {
  return DONE_PATTERN.test(text) && RECURRENCE_PATTERN.test(text)
}

function hasFailureClassMatrix(text) {
  return MATRIX_PATTERN.test(text)
}

function promptAdvisory(prompt) {
  if (!RECURRENCE_PATTERN.test(prompt)) return ''
  return `[LAYER 5] Recurring issue detected - build a failure-class matrix before coding or claiming fixed. Use ${MATRIX_DOC}.`
}

function precommitResult(diff) {
  if (!diff.trim()) return { ok: true }
  const addedText = addedLinesFromDiff(diff).join('\n')
  if (!hasRecurringCloseout(addedText) || hasFailureClassMatrix(addedText)) {
    return { ok: true }
  }
  return {
    ok: false,
    message: [
      '',
      '❌ Recurring issue closeout is missing a failure-class matrix.',
      '',
      'A staged MASTER_PLAN change appears to mark a recurring/broad issue done.',
      `Before committing, add the matrix from ${MATRIX_DOC}`,
      'and name the exact failure mode fixed plus what remains uncovered.',
      '',
    ].join('\n'),
  }
}

function auditResult(content) {
  const findings = []
  const lines = content.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!DONE_PATTERN.test(line) || !RECURRENCE_PATTERN.test(line)) continue

    const block = lines.slice(index, Math.min(index + 18, lines.length)).join('\n')
    if (!hasFailureClassMatrix(block)) {
      findings.push({ line: index + 1, text: line.trim() })
    }
  }

  return findings
}

function printHelp() {
  console.log(`Usage:
  node scripts/recurring-issue-guard.cjs --mode prompt
  node scripts/recurring-issue-guard.cjs --mode precommit [--diff-file path]
  node scripts/recurring-issue-guard.cjs --mode audit [--file docs/MASTER_PLAN.md]`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return 0
  }

  if (args.mode === 'prompt') {
    const message = promptAdvisory(readStdin())
    if (message) console.log(message)
    return 0
  }

  if (args.mode === 'precommit') {
    const diff = args.diffFile ? readFileSync(args.diffFile, 'utf8') : readCachedMasterPlanDiff()
    const result = precommitResult(diff)
    if (!result.ok) {
      console.error(result.message)
      return 1
    }
    return 0
  }

  if (args.mode === 'audit') {
    const file = args.file || 'docs/MASTER_PLAN.md'
    const findings = auditResult(readFileSync(file, 'utf8'))
    if (findings.length === 0) {
      console.log('No weak recurring closeouts found.')
      return 0
    }
    console.log('Potential recurring closeouts without matrix:')
    for (const finding of findings) {
      console.log(`- ${file}:${finding.line} ${finding.text}`)
    }
    return 0
  }

  console.error(`Unknown mode: ${args.mode}`)
  printHelp()
  return 2
}

process.exitCode = main()
