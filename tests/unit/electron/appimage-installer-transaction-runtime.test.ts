import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const updaterSource = readFileSync(resolve(process.cwd(), 'electron/updater.ts'), 'utf8')
const scriptMatch = updaterSource.match(
  /const script = `([\s\S]*?)`\n\n  const installerArgs/,
)
if (!scriptMatch) throw new Error('embedded AppImage installer script not found')
const installerScript = scriptMatch[1].replaceAll('\\${', '${')

function makeFixture(options: { reportedVersion?: string; failSwap?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-appimage-transaction-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const systemctlLog = join(root, 'systemctl.log')

  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
exit 0
`)
  writeFileSync(join(bin, 'curl'), `#!/bin/sh
printf '{"appVersion":"%s"}' "$REPORTED_VERSION"
`)
  writeFileSync(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n')
  writeFileSync(join(bin, 'mv'), `#!/bin/sh
source="$1"
if [ "$source" = "-f" ]; then source="$2"; fi
case "$source" in
  *.flowstate-update-tmp)
    if [ "$FAIL_SWAP" = "1" ]; then exit 1; fi
    ;;
esac
exec /bin/mv "$@"
`)
  for (const command of ['systemctl', 'curl', 'sleep', 'mv']) {
    chmodSync(join(bin, command), 0o755)
  }

  const target = join(root, 'FlowState.AppImage')
  const pending = join(root, 'FlowState-1.4.275-x86_64.AppImage')
  const info = join(root, 'update-info.json')
  writeFileSync(target, 'known-good')
  writeFileSync(pending, 'replacement')
  writeFileSync(info, '{}')

  const run = () => execFileSync('/bin/sh', [
    '-c',
    installerScript,
    'flowstate-appimage-install-test',
    target,
    pending,
    info,
    '99999999',
    'systemd',
    '1.4.275',
  ], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      SYSTEMCTL_LOG: systemctlLog,
      REPORTED_VERSION: options.reportedVersion ?? '1.4.275',
      FAIL_SWAP: options.failSwap ? '1' : '0',
    },
    stdio: 'pipe',
  })

  return { root, target, pending, info, systemctlLog, run }
}

describe('supervised AppImage installer transaction runtime', () => {
  it('verifies a direct replacement before clearing the pending marker', () => {
    expect(installerScript).toContain('wait_for_direct_health()')
    expect(installerScript).toContain('fail_after_swap "direct replacement readiness"')
  })

  it('removes the backup and pending marker only after replacement provenance matches', () => {
    const fixture = makeFixture()

    fixture.run()

    expect(readFileSync(fixture.target, 'utf8')).toBe('replacement')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('rejects stale localhost health and restores the known-good AppImage', () => {
    const fixture = makeFixture({ reportedVersion: '1.4.274' })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
    expect(readFileSync(fixture.systemctlLog, 'utf8')).toContain(
      'start flowstate-background.service',
    )
  })

  it('restores the known-good target when the atomic swap fails', () => {
    const fixture = makeFixture({ failSwap: true })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
  })
})
