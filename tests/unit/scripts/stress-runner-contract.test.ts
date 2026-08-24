import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runner = readFileSync('scripts/run-stress-tests.sh', 'utf8')
const dataIntegrity = readFileSync('tests/stress/data-integrity.spec.ts', 'utf8')
const security = readFileSync('tests/stress/security.spec.ts', 'utf8')
const e2eLauncher = readFileSync('scripts/run-e2e.sh', 'utf8')
const selfHostRunner = readFileSync('scripts/test-self-host.sh', 'utf8')
const devLauncher = readFileSync('scripts/start-dev.sh', 'utf8')

describe('stress runner failure contract', () => {
  it('does not convert failed stress commands into a successful run', () => {
    expect(runner).toContain('set -euo pipefail')
    expect(runner).toContain('TEST_EXIT=0')
    expect(runner).toContain('BENCHMARK_EXIT=0')
    expect(runner).toContain('REPORT_EXIT=0')
    expect(runner).toContain('exit "$FINAL_EXIT"')
    expect(runner).not.toMatch(/playwright test[\s\S]*\|\| true/)
    expect(runner).not.toMatch(/test:bench[\s\S]*\|\| true/)
    expect(runner).not.toMatch(/generate-stress-report[\s\S]*\|\| true/)
  })

  it('keeps browser stress checks on the real acceptance surface', () => {
    expect(dataIntegrity).toContain('a[href="#/board"]')
    expect(dataIntegrity).toContain("getByRole('textbox', { name: 'Quick add task' })")
    expect(dataIntegrity).toContain('expect(createdTasks).toHaveLength(taskCount)')
    expect(dataIntegrity).not.toContain('No canvas nodes found - skipping')
    expect(security).toContain('a[href="#/board"]')
    expect(security).toContain("getByRole('textbox', { name: 'Quick add task' })")
    expect(security).not.toContain('No task cards found - skipping')
    expect(security).not.toContain('Rich text editor not found - skipping')
  })

  it('parses current and legacy local Supabase status keys without assuming quote syntax', () => {
    expect(e2eLauncher).toContain('status_value()')
    expect(e2eLauncher).toContain('status_value SECRET_KEY')
    expect(e2eLauncher).toContain('status_value SERVICE_ROLE_KEY')
    expect(e2eLauncher).toContain('status_value PUBLISHABLE_KEY')
    expect(e2eLauncher).toContain('status_value ANON_KEY')
    expect(e2eLauncher).toContain('status_value API_URL')
  })

  it('keeps the disposable self-host stack bounded and isolated', () => {
    expect(selfHostRunner).toContain('docker compose --progress quiet')
    expect(selfHostRunner).toContain('BUILD_LOG="/tmp/flowstate-self-host-build-${PROJECT_NAME}.log"')
    expect(selfHostRunner).toContain('tail -n 80 "$BUILD_LOG"')
    expect(selfHostRunner).toContain('down -v --remove-orphans >/dev/null 2>&1')
    expect(selfHostRunner).toContain('PROJECT_NAME="flowstate-test"')
    expect(selfHostRunner).toContain('docker compose -p "$PROJECT_NAME"')
    expect(selfHostRunner).toContain('down -v --remove-orphans')
    expect(selfHostRunner).toContain('s.Health&&s.Health!==\'healthy\'')
    expect(selfHostRunner).toContain('flock -n 9')
    expect(selfHostRunner).toContain('flowstate-self-host-test.lock')
  })

  it('propagates a Vite failure so the launcher cannot leave a stale owner pid', () => {
    expect(devLauncher).toContain('concurrently --kill-others-on-fail')
    expect(devLauncher).toContain('trap cleanup EXIT INT TERM HUP')
  })
})
