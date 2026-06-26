#!/usr/bin/env node
const { execFileSync } = require('node:child_process')

function stagedDiff() {
  try {
    return execFileSync('git', ['diff', '--cached', '--', 'docs/MASTER_PLAN.md'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

const diff = stagedDiff()
if (!diff.trim()) process.exit(0)

const addedLines = diff
  .split('\n')
  .filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .map(line => line.slice(1))

const addedText = addedLines.join('\n')
const marksDone = /✅\s*(DONE|Done)|Status\*\*:\s*✅|~~BUG-|~~TASK-|~~FEATURE-/i.test(addedText)
const recurrenceSignal = /\b(recurring|again|already fixed|previously fixed|keeps?|persists?|regression|same symptom|failure-class|KDE|Electron|sidecar|localhost|timer|subtasks?|canvas broke)\b/i.test(addedText)
const hasMatrix = /Failure-class matrix|Exact failure mode fixed|Explicitly not covered|Regression added for reported repro|Live boundary proof/i.test(addedText)

if (marksDone && recurrenceSignal && !hasMatrix) {
  console.error('')
  console.error('❌ Recurring issue closeout is missing a failure-class matrix.')
  console.error('')
  console.error('A staged MASTER_PLAN change appears to mark a recurring/broad issue done.')
  console.error('Before committing, add the matrix from docs/process/failure-class-matrix.md')
  console.error('and name the exact failure mode fixed plus what remains uncovered.')
  console.error('')
  process.exit(1)
}

process.exit(0)
