import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
      'offline-reconnect-convergence',
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
      failureClass: 'permanent delete/undo/recurring completion/duplicate merge',
    })
    expect(report.checks[0].command).toEqual(expect.arrayContaining([
      'tests/unit/local-api/done-for-now-handler.test.ts',
      'tests/unit/local-api/merge-tasks-handler.test.ts',
      'tests/unit/local-api/task-search.test.ts',
    ]))
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
    expect(packageJson.scripts['test:offline-reconnect-flows']).toContain('R10|R11|R12|R13|R14|R15|R16|R17|R18|R19|R20')
    expect(packageJson.scripts['preelectron:build']).toContain('test:offline-reconnect-flows')
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

  it('installs the user timer against a clean current-master snapshot with notifications enabled', () => {
    const installer = readFileSync('scripts/install-daily-regression-hunt.sh', 'utf8')
    const runner = readFileSync('scripts/run-daily-regression-hunt-clean.sh', 'utf8')

    expect(installer).toContain('install -m 0755 "$SCRIPT_REPO_DIR/scripts/run-daily-regression-hunt-clean.sh" "$RUNNER_PATH"')
    expect(installer).toContain('Environment=FLOWSTATE_REGRESSION_SOURCE_REPO=$SOURCE_REPO')
    expect(installer).toContain('ExecStart=/usr/bin/env bash $RUNNER_PATH --notify')
    expect(installer).toContain('OnCalendar=*-*-* 09:30:00')
    expect(runner).toContain('git -C "$SOURCE_REPO" fetch --quiet origin master')
    expect(runner).toContain('git -C "$SOURCE_REPO" worktree add --detach "$RUNNER_DIR" origin/master')
    expect(runner).toContain('git -C "$RUNNER_DIR" reset --hard origin/master')
    expect(runner).toContain('git -C "$RUNNER_DIR" clean -ffdx')
    expect(runner).toContain('--report-dir "$REPORT_DIR"')
    expect(runner).toContain('trap notify_preflight_failure ERR')
    expect(runner).toContain('FlowState regression runner failed before checks')
    expect(runner).toContain('sha256sum "$RUNNER_DIR/package-lock.json"')
    expect(runner).toContain('sha256sum "$RUNNER_DIR/package.json"')
    expect(runner).toContain('sha256sum "$RUNNER_DIR/scripts/patch-electron-builder-dependency-parser.cjs"')
    expect(runner).toContain("node -p 'process.versions.modules'")
    expect(runner).toContain("node -p 'process.version'")
    expect(runner).toContain('npm --version')
    expect(runner).toContain('uname -s')
    expect(runner).toContain('uname -m')
    expect(runner).toContain('npm ci --prefix "$RUNNER_DIR"')
    expect(runner).not.toContain('"$SOURCE_REPO/node_modules"')
  })

  it('runs remote master without modifying a dirty primary checkout and propagates notified failures', () => {
    const root = mkdtempSync(join(tmpdir(), 'flowstate-clean-runner-'))
    const remote = join(root, 'remote.git')
    const seed = join(root, 'seed')
    const primary = join(root, 'primary')
    const runnerDir = join(root, 'runner')
    const reports = join(primary, 'reports', 'regression-hunt')
    const dependencyRoot = join(root, 'dependencies')
    const binDir = join(root, 'bin')
    const npmCapture = join(root, 'npm-args.txt')
    const notifyCapture = join(root, 'notify-args.txt')
    const lock = JSON.stringify({ name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: {} })

    execFileSync('git', ['init', '--bare', remote])
    execFileSync('git', ['init', '-b', 'master', seed])
    execFileSync('git', ['-C', seed, 'config', 'user.email', 'fixture@flowstate.test'])
    execFileSync('git', ['-C', seed, 'config', 'user.name', 'FlowState Fixture'])
    writeFileSync(join(seed, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }))
    writeFileSync(join(seed, 'package-lock.json'), lock)
    mkdirSync(join(seed, 'scripts'))
    writeFileSync(join(seed, 'scripts', 'patch-electron-builder-dependency-parser.cjs'), '// fixture patch\n')
    writeFileSync(join(seed, 'version.txt'), 'remote-v1\n')
    execFileSync('git', ['-C', seed, 'add', '.'])
    execFileSync('git', ['-C', seed, 'commit', '-m', 'fixture v1'])
    execFileSync('git', ['-C', seed, 'remote', 'add', 'origin', remote])
    execFileSync('git', ['-C', seed, 'push', '-u', 'origin', 'master'])
    execFileSync('git', ['clone', remote, primary])

    const primaryHead = execFileSync('git', ['-C', primary, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(primary, 'version.txt'), 'dirty-primary\n')
    writeFileSync(join(primary, 'keep-untracked.txt'), 'preserve me\n')

    writeFileSync(join(seed, 'version.txt'), 'remote-v2\n')
    execFileSync('git', ['-C', seed, 'add', 'version.txt'])
    execFileSync('git', ['-C', seed, 'commit', '-m', 'fixture v2'])
    execFileSync('git', ['-C', seed, 'push', 'origin', 'master'])
    const remoteHead = execFileSync('git', ['-C', seed, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

    mkdirSync(binDir)
    writeFileSync(join(binDir, 'notify-send'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" > "$NOTIFY_CAPTURE"\n')
    writeFileSync(join(binDir, 'npm'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$NPM_CAPTURE"\nif [ "${1:-}" = "--version" ]; then echo "10.0.0"; exit 0; fi\nif [ "${1:-}" = "ci" ]; then mkdir -p "$FLOWSTATE_REGRESSION_RUNNER_DIR/node_modules"; exit 0; fi\nif [[ " $* " == *" --notify "* ]]; then notify-send "FlowState fixture failure"; fi\nexit 23\n')
    chmodSync(join(binDir, 'notify-send'), 0o755)
    chmodSync(join(binDir, 'npm'), 0o755)

    const result = spawnSync('bash', ['scripts/run-daily-regression-hunt-clean.sh', '--notify'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        FLOWSTATE_REGRESSION_SOURCE_REPO: primary,
        FLOWSTATE_REGRESSION_RUNNER_DIR: runnerDir,
        FLOWSTATE_REGRESSION_REPORT_DIR: reports,
        FLOWSTATE_REGRESSION_DEPENDENCY_DIR: dependencyRoot,
        NPM_CAPTURE: npmCapture,
        NOTIFY_CAPTURE: notifyCapture,
      },
    })

    expect(result.status, result.stderr).toBe(23)
    expect(execFileSync('git', ['-C', primary, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(primaryHead)
    expect(readFileSync(join(primary, 'version.txt'), 'utf8')).toBe('dirty-primary\n')
    expect(readFileSync(join(primary, 'keep-untracked.txt'), 'utf8')).toBe('preserve me\n')
    expect(execFileSync('git', ['-C', runnerDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(remoteHead)
    expect(readFileSync(join(runnerDir, 'version.txt'), 'utf8')).toBe('remote-v2\n')
    expect(readFileSync(npmCapture, 'utf8')).toContain(`ci --prefix ${runnerDir}`)
    expect(readFileSync(npmCapture, 'utf8')).toContain(`run regression:daily -- --report-dir ${reports} --notify`)
    expect(readFileSync(notifyCapture, 'utf8')).toContain('FlowState fixture failure')
  })
})
