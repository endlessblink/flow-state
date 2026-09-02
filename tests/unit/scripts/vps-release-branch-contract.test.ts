import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const releaseScript = readFileSync('scripts/run-vps-release-with-doppler.sh', 'utf8')

describe('VPS Electron release branch contract', () => {
  it('builds the pushed main release rather than stale master', () => {
    expect(releaseScript).toContain('git clone --branch main --single-branch')
    expect(releaseScript).toContain("git -C '${REMOTE_REPO}' fetch origin main")
    expect(releaseScript).toContain("git -C '${REMOTE_REPO}' reset --hard origin/main")
    expect(releaseScript).not.toMatch(/origin\/master|--branch master/)
  })
})
