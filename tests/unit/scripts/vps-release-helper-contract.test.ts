import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('VPS release helper credential handling', () => {
  it('reuses the root-only VPS Doppler environment without prompting locally', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/run-vps-release-with-doppler.sh'), 'utf8')

    expect(script).toContain('/etc/flowstate/doppler-release.env')
    expect(script).not.toContain('read -r -s -p "Doppler service token: "')
  })

  it('pins the production Doppler context and rejects caller-controlled release modes', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/run-vps-release-with-doppler.sh'), 'utf8')

    expect(script).toContain('--project flow-state')
    expect(script).toContain('--config prd')
    expect(script).toContain('DOPPLER_PROJECT=flow-state')
    expect(script).toContain('DOPPLER_CONFIG=prd')
    expect(script).toContain('if [[ $# -ne 0 ]]')
    expect(script).toContain('git status --porcelain')
    expect(script).toContain('git rev-parse HEAD')
    expect(script).toContain('git cat-file -e')
  })

  it('does not expose production deployment bypass switches', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/deploy-electron-update.sh'), 'utf8')

    expect(script).toContain('Refusing production deployment bypass')
    expect(script).not.toContain('SKIP_DEPLOY=true')
    expect(script).not.toContain('SKIP_GUARD=true')
    expect(script).not.toContain('SKIP_TESTS=true')
  })

  it('requires a complete clean source-bound receipt before promotion', () => {
    const receipt = readFileSync(resolve(process.cwd(), 'scripts/create-flowstate-release-receipt.cjs'), 'utf8')
    const promoter = readFileSync(resolve(process.cwd(), 'scripts/promote-flowstate-release.sh'), 'utf8')

    expect(receipt).toContain("ledger.source.dirty !== false")
    expect(receipt).toContain('receipt source commit')
    expect(promoter).toContain("receipt.source?.dirty !== false")
    expect(promoter).toContain('web.sha256')
    expect(promoter).toContain('web.fileCount')
  })
})
