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

function makeFixture(options: {
  reportedVersion?: string
  failSwap?: boolean
  strategy?: 'systemd' | 'direct'
  replacementProcess?: 'live' | 'exited'
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-appimage-transaction-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const systemctlLog = join(root, 'systemctl.log')
  const curlCount = join(root, 'curl-count')

  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
exit 0
`)
  writeFileSync(join(bin, 'curl'), `#!/bin/sh
count=0
if [ -f "$CURL_COUNT" ]; then count=$(cat "$CURL_COUNT"); fi
count=$((count + 1))
printf '%s' "$count" > "$CURL_COUNT"
if [ "$INSTALL_STRATEGY" = "direct" ] && [ "$count" -eq 1 ]; then exit 1; fi
printf '{"appVersion":"%s","instanceId":"%s"}' "$REPORTED_VERSION" "$FLOW_STATE_UPDATE_INSTANCE_ID"
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
  writeFileSync(
    pending,
    options.replacementProcess === 'exited'
      ? '#!/bin/sh\nexit 0\n'
      : '#!/bin/sh\nprintf replacement-running\nwhile :; do /bin/sleep 1; done\n',
  )
  chmodSync(pending, 0o755)
  writeFileSync(info, '{}')

  const run = () => execFileSync('/bin/sh', [
    '-c',
    installerScript,
    'flowstate-appimage-install-test',
    target,
    pending,
    info,
    '99999999',
    options.strategy ?? 'systemd',
    '1.4.275',
  ], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      SYSTEMCTL_LOG: systemctlLog,
      REPORTED_VERSION: options.reportedVersion ?? '1.4.275',
      FAIL_SWAP: options.failSwap ? '1' : '0',
      INSTALL_STRATEGY: options.strategy ?? 'systemd',
      CURL_COUNT: curlCount,
    },
    stdio: 'pipe',
  })

  return { root, target, pending, info, systemctlLog, run }
}

describe('supervised AppImage installer transaction runtime', () => {
  it('verifies a direct replacement before clearing the pending marker', () => {
    expect(installerScript).toContain('wait_for_direct_health()')
    expect(installerScript).toContain('fail_after_swap "direct replacement readiness"')
    expect(installerScript).toContain("tr -d '[:space:]'")
    expect(installerScript).toContain('direct readiness probe response')
  })

  it('terminates the old AppImage process group so its sidecar cannot hold the health port', () => {
    expect(installerScript).toContain('ps -o pgid= -p "$pid"')
    expect(installerScript).toContain('kill "$signal" -- "-$pgid"')
  })

  it('removes the backup and pending marker only after replacement provenance matches', () => {
    const fixture = makeFixture()

    fixture.run()

    expect(readFileSync(fixture.target, 'utf8')).toContain('replacement-running')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('executes the direct replacement path and clears markers only after fresh provenance', () => {
    const fixture = makeFixture({ strategy: 'direct' })

    fixture.run()

    expect(readFileSync(fixture.target, 'utf8')).toContain('replacement-running')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('rolls back a direct replacement when fresh provenance is stale', () => {
    const fixture = makeFixture({ strategy: 'direct', reportedVersion: '1.4.274' })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
  })

  it('rejects a matching provenance response when the replacement process already exited', () => {
    const fixture = makeFixture({ strategy: 'direct', replacementProcess: 'exited' })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
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
