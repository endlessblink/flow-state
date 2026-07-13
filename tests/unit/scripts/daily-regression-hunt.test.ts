import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = 'scripts/daily-regression-hunt.cjs'

function runHunt(args: string[] = []) {
  return execFileSync('node', [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

describe('daily regression hunt script', () => {
  it('plans the fixed daily checks plus Monday canvas coverage without mutating state', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--notify',
      '--json',
      '--date',
      '2026-07-06',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    const ids = report.checks.map((check: { id: string }) => check.id)

    expect(report.mode).toBe('daily')
    expect(report.dryRun).toBe(true)
    expect(ids).toEqual(expect.arrayContaining([
      'git-status',
      'electron-sync-guard',
      'type-check',
      'focused-recurring-pack',
      'lifecycle-durability',
      'canonical-assistant-contract',
      'timer-boundary',
      'live-boundary',
      'updater-manifest',
      'canvas-flows',
    ]))
    expect(report.summary.failed).toBe(0)
    expect(report.summary.skipped).toBe(report.checks.length)
    expect(report.files.json).toContain(reportDir)
    expect(report.files.markdown).toContain(reportDir)
    expect(readdirSync(reportDir).some((name) => name.endsWith('.json'))).toBe(true)
    expect(readdirSync(reportDir).some((name) => name.endsWith('.md'))).toBe(true)
  })

  it('rotates Tuesday daily coverage to timer flows', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--json',
      '--date',
      '2026-07-07',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    const ids = report.checks.map((check: { id: string }) => check.id)

    expect(ids).toContain('timer-flows')
    expect(ids).not.toContain('canvas-flows')
  })

  it('can filter to one boundary for targeted smoke checks', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--json',
      '--only',
      'timer-boundary',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    expect(report.checks.map((check: { id: string }) => check.id)).toEqual(['timer-boundary'])
  })

  it('can filter to the widened live auth/timer boundary', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--json',
      '--only',
      'live-boundary',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    expect(report.checks.map((check: { id: string }) => check.id)).toEqual(['live-boundary'])
  })

  it('keeps lifecycle durability regressions in the fixed daily watchdog', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--json',
      '--only',
      'lifecycle-durability',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    expect(report.checks).toHaveLength(1)
    expect(report.checks[0]).toMatchObject({
      id: 'lifecycle-durability',
      failureClass: 'permanent delete/undo',
    })
    expect(report.checks[0].commandLine).toContain('tests/unit/undo-task-operations.test.ts')
    expect(report.checks[0].commandLine).toContain('tests/unit/task-rollback.test.ts')
    expect(report.checks[0].commandLine).toContain('tests/unit/stores/smart-merge.test.ts')
  })

  it('keeps executable canonical assistant proof in the fixed daily watchdog', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    const output = runHunt([
      '--dry-run',
      '--json',
      '--only',
      'canonical-assistant-contract',
      '--report-dir',
      reportDir,
    ])

    const report = JSON.parse(output)
    expect(report.checks).toHaveLength(1)
    expect(report.checks[0]).toMatchObject({
      id: 'canonical-assistant-contract',
      failureClass: 'canonical assistant authority',
    })
    expect(report.checks[0].commandLine).toContain('test:reliable-assistant-contract')
    expect(report.checks[0].commandLine).toContain('canonical-task-contract.test.ts')
    expect(report.checks[0].commandLine).toContain('notion-activation-handler.test.ts')
    expect(report.checks[0].commandLine).toContain('canonical-change-catchup.test.ts')
  })

  it('classifies recurring FlowState failure signatures', () => {
    const auth = JSON.parse(runHunt(['--classify', 'Sign-in expired changes are kept on this device']))
    const canvas = JSON.parse(runHunt(['--classify', 'canvas groups and tasks disappeared after switching views']))
    const timer = JSON.parse(runHunt(['--classify', 'KDE widget timer stuck at 0 and local api 5577 active task stale']))
    const canonical = JSON.parse(runHunt(['--classify', 'canonical Notion activation receipt or change sequence failed']))

    expect(auth.failureClass).toBe('auth/sync')
    expect(canvas.failureClass).toBe('Canvas data/state')
    expect(timer.failureClass).toBe('KDE/local sidecar')
    expect(canonical.failureClass).toBe('canonical assistant authority')
  })

  it('prints the latest markdown report path and summary', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'flowstate-regression-'))
    runHunt(['--dry-run', '--date', '2026-07-06', '--report-dir', reportDir])

    const latest = runHunt(['--latest', '--report-dir', reportDir])

    expect(latest).toContain('Latest FlowState regression hunt report')
    expect(latest).toContain('.md')
    expect(readFileSync(latest.trim().split('\n')[1], 'utf8')).toContain('# FlowState Regression Hunt')
  })

  it('exposes package scripts for daily, weekly, and latest report use', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

    expect(packageJson.scripts['regression:daily']).toBe('node scripts/daily-regression-hunt.cjs --mode daily')
    expect(packageJson.scripts['regression:weekly']).toBe('node scripts/daily-regression-hunt.cjs --mode weekly')
    expect(packageJson.scripts['regression:report']).toBe('node scripts/daily-regression-hunt.cjs --latest')
  })

  it('keeps rotated flow scripts pointed at existing test targets', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    const rotatedScripts = [
      'test:canvas-flows',
      'test:timer-flows',
      'test:task-flows',
      'test:user-flows',
    ]

    for (const scriptName of rotatedScripts) {
      const command = packageJson.scripts[scriptName]
      expect(command, `${scriptName} should exist`).toEqual(expect.any(String))

      const referencedPaths = command
        .split(/\s+/)
        .map((part: string) => part.replace(/^['"]|['"]$/g, '').replace(/^--[^=]+=*/, ''))
        .filter((part: string) => part.startsWith('tests/') || part.startsWith('scripts/'))

      expect(referencedPaths, `${scriptName} should reference a concrete test target`).not.toEqual([])
      for (const target of referencedPaths) {
        expect(existsSync(target), `${scriptName} references missing path: ${target}`).toBe(true)
      }
    }
  })

  it('installs the user timer with failure notifications enabled', () => {
    const installer = readFileSync('scripts/install-daily-regression-hunt.sh', 'utf8')

    expect(installer).toContain("ExecStart=/usr/bin/env bash -lc 'npm run regression:daily -- --notify'")
    expect(installer).toContain('OnCalendar=*-*-* 09:30:00')
  })
})
