import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('VPS release helper credential handling', () => {
  it('reuses the root-only VPS Doppler environment without prompting locally', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/run-vps-release-with-doppler.sh'), 'utf8')

    expect(script).toContain('/etc/flowstate/doppler-release.env')
    expect(script).not.toContain('read -r -s -p "Doppler service token: "')
  })
})
