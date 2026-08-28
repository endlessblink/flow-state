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
const installerScript = scriptMatch[1]
  .replaceAll('\\${', '${')
  .replaceAll('\\\\', '\\')

function makeFixture(options: {
  reportedVersion?: string
  failSwap?: boolean
  replacementExits?: boolean
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-appimage-transaction-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const systemctlLog = join(root, 'systemctl.log')
  const fixturePid = join(root, 'fixture-pid')
  const fixtureRole = join(root, 'fixture-role')

  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
exit 0
`)
  writeFileSync(join(bin, 'curl'), `#!/bin/sh
count=0
if [ -f "$CURL_COUNT" ]; then count=$(cat "$CURL_COUNT"); fi
count=$((count + 1))
printf '%s\n' "$count" > "$CURL_COUNT"
if [ "$count" -eq 1 ]; then
  printf '{"appVersion":"1.4.275","processId":111,"parentPid":999,"instanceId":"old-instance"}'
  exit 0
fi
if [ "$count" -eq 2 ]; then
  # The old direct-mode bridge has stopped, so the replacement may be swapped in.
  exit 7
fi
  if [ ! -s "$FIXTURE_PID" ] || ! kill -0 "$(cat "$FIXTURE_PID")" 2>/dev/null || ! ps -o stat= -p "$(cat "$FIXTURE_PID")" | grep -qv '^Z'; then
  exit 7
fi
pid=$(cat "$FIXTURE_PID")
role=$(cat "$FIXTURE_ROLE")
if [ "$role" = "known-good" ]; then
  version=1.4.275
  instance=known-good-instance
else
  version="$REPORTED_VERSION"
  instance=replacement-instance
fi
printf '{"appVersion":"%s","processId":%s,"parentPid":%s,"instanceId":"%s"}' "$version" "$pid" "$pid" "$instance"
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
  const makeAppImage = (role: string, exits: boolean) => `#!/bin/sh
printf '%s\\n' "$$" > "$FIXTURE_PID"
printf '%s\\n' "${role}" > "$FIXTURE_ROLE"
${exits ? 'exit 0' : 'while :; do /bin/sleep 1; done'}
`
  writeFileSync(target, makeAppImage('known-good', false))
  writeFileSync(pending, makeAppImage('replacement', options.replacementExits ?? false))
  chmodSync(target, 0o755)
  chmodSync(pending, 0o755)
  writeFileSync(info, '{}')

  const cleanup = () => {
    if (!readFileSync(fixturePid, 'utf8').trim()) return
    try {
      process.kill(Number(readFileSync(fixturePid, 'utf8')), 'SIGTERM')
    } catch {
      // The exited-replacement fixture has already stopped.
    }
  }
  const run = () => {
    try {
      return execFileSync('/bin/sh', [
        '-c',
        installerScript,
        'flowstate-appimage-install-test',
        target,
        pending,
        info,
        '99999999',
        'direct',
        '1.4.275',
      ], {
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SYSTEMCTL_LOG: systemctlLog,
          CURL_COUNT: join(root, 'curl-count'),
          FIXTURE_PID: fixturePid,
          FIXTURE_ROLE: fixtureRole,
          REPORTED_VERSION: options.reportedVersion ?? '1.4.275',
          FAIL_SWAP: options.failSwap ? '1' : '0',
        },
        stdio: 'pipe',
      })
    } finally {
      cleanup()
    }
  }

  return { root, target, pending, info, systemctlLog, run }
}

describe('supervised AppImage installer transaction runtime', () => {
  it('verifies a direct replacement before clearing the pending marker', () => {
    expect(installerScript).toContain('wait_for_health_identity()')
    expect(installerScript).toContain('fail_after_swap "direct replacement readiness"')
  })

  it('terminates the old AppImage process group so its sidecar cannot hold the health port', () => {
    expect(installerScript).toContain('ps -o pgid= -p "$pid"')
    expect(installerScript).toContain('kill "$signal" -- "-$pgid"')
  })

  it('requires replacement provenance to include a new PID and instance identity bound to the supervisor', () => {
    expect(installerScript).toContain('processId')
    expect(installerScript).toContain('parentPid')
    expect(installerScript).toContain('instanceId')
    expect(installerScript).toContain('supervised_pid=$(systemctl --user show --property=MainPID --value flowstate-background.service')
    expect(installerScript).toContain('live_parent_pid" = "$supervised_pid"')
    expect(installerScript).toContain('live_process_id" != "${old_process_id:-}"')
    expect(installerScript).toContain('live_instance_id" != "${old_instance_id:-}"')
  })

  it('waits for the direct-mode bridge to stop before swapping the AppImage', () => {
    expect(installerScript).toContain('wait_for_direct_port_free()')
    expect(installerScript).toContain('old local bridge did not stop before replacement')
    expect(installerScript.indexOf('wait_for_direct_port_free || fail_install')).toBeLessThan(
      installerScript.indexOf('mv -f "$tmp" "$target"'),
    )
  })

  it('removes the backup and pending marker only after replacement provenance matches', () => {
    const fixture = makeFixture()

    fixture.run()

    expect(readFileSync(fixture.target, 'utf8')).toContain('replacement')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('rejects stale localhost health and restores the known-good AppImage', () => {
    const fixture = makeFixture({ reportedVersion: '1.4.274' })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toContain('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
  })

  it('rolls back when the direct replacement exits before becoming healthy', () => {
    const fixture = makeFixture({ replacementExits: true })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toContain('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
  })

  it('restores the known-good target when the atomic swap fails', () => {
    const fixture = makeFixture({ failSwap: true })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toContain('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
  })
})
