import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function run(script: string, argument: string): number {
  try {
    execFileSync('bash', [script, argument], { cwd: process.cwd(), stdio: 'pipe' })
    return 0
  } catch (error) {
    return (error as { status?: number }).status ?? 1
  }
}

describe('production deployment convergence gates', () => {
  it('fails a production build that lacks the PWA worker or manifest', () => {
    const build = mkdtempSync(join(tmpdir(), 'flowstate-build-'))
    mkdirSync(join(build, 'assets'))
    writeFileSync(join(build, 'index.html'), '<script src="assets/app.js"></script>')
    writeFileSync(join(build, 'assets', 'app.js'), '')
    chmodSync('scripts/deploy/verify-build.sh', 0o755)

    expect(run('scripts/deploy/verify-build.sh', build)).not.toBe(0)
  })

  it('fails manifest validation when the production manifest is absent', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'flowstate-manifest-')), 'manifest.webmanifest')

    expect(run('scripts/deploy/validate-manifest.sh', missing)).not.toBe(0)
  })

  it('serializes the full ship gate and restores Doppler build input afterward', () => {
    const script = readFileSync('scripts/deploy-electron-update.sh', 'utf8')

    expect(script).toContain('npm run test -- --maxWorkers=1')
    expect(script).toContain('HIDDEN_ENV_PRODUCTION')
    expect(script).toContain('trap restore_env_production EXIT')
  })
})
