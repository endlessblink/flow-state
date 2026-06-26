import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(__dirname, '../../../scripts/recurring-issue-guard.cjs')
const tempRoots: string[] = []

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-recurring-guard-'))
  tempRoots.push(root)
  return root
}

function runGuard(args: string[], input = '') {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    input,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH || '',
    },
  })
}

describe('recurring-issue-guard', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('emits an advisory prompt warning for recurring issue wording', () => {
    const result = runGuard(['--mode', 'prompt'], 'timer got stuck again after we already fixed it')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Recurring issue detected')
    expect(result.stdout).toContain('docs/process/failure-class-matrix.md')
  })

  it('blocks recurring MASTER_PLAN closeout diffs that lack a failure-class matrix', () => {
    const root = makeRoot()
    const diffPath = join(root, 'missing-matrix.diff')
    writeFileSync(diffPath, [
      'diff --git a/docs/MASTER_PLAN.md b/docs/MASTER_PLAN.md',
      '--- a/docs/MASTER_PLAN.md',
      '+++ b/docs/MASTER_PLAN.md',
      '@@ -1,3 +1,4 @@',
      '+### ~~BUG-999 KDE timer stuck again~~ ✅ DONE',
      '+The timer regression keeps happening in Electron and KDE.',
    ].join('\n'))

    const result = runGuard(['--mode', 'precommit', '--diff-file', diffPath])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('failure-class matrix')
  })

  it('allows recurring MASTER_PLAN closeout diffs when the matrix fields are present', () => {
    const root = makeRoot()
    const diffPath = join(root, 'with-matrix.diff')
    writeFileSync(diffPath, [
      'diff --git a/docs/MASTER_PLAN.md b/docs/MASTER_PLAN.md',
      '--- a/docs/MASTER_PLAN.md',
      '+++ b/docs/MASTER_PLAN.md',
      '@@ -1,3 +1,9 @@',
      '+### ~~BUG-999 KDE timer stuck again~~ ✅ DONE',
      '+The timer regression keeps happening in Electron and KDE.',
      '+**Failure-class matrix**:',
      '+**Exact failure mode fixed**: completion-at-zero sidecar payload',
      '+**Explicitly not covered**: unrelated renderer stale cache',
      '+**Regression added for reported repro**: tests/unit/kde/timer-sync.test.ts',
      '+**Live boundary proof**: local sidecar probe',
    ].join('\n'))

    const result = runGuard(['--mode', 'precommit', '--diff-file', diffPath])

    expect(result.status).toBe(0)
  })

  it('reports weak historical DONE entries in audit mode without failing the process', () => {
    const root = makeRoot()
    const masterPlanPath = join(root, 'MASTER_PLAN.md')
    writeFileSync(masterPlanPath, [
      '### ~~BUG-999 Electron timer stuck again~~ ✅ DONE',
      'The same symptom persisted after the earlier fix.',
    ].join('\n'))

    const result = runGuard(['--mode', 'audit', '--file', masterPlanPath])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Potential recurring closeouts without matrix')
    expect(result.stdout).toContain('BUG-999')
  })
})
