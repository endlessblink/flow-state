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
  /const script = (?:String\.raw)?`([\s\S]*?)`\n\n  const installerArgs/,
)
if (!scriptMatch) throw new Error('embedded AppImage installer script not found')
// The test extracts the template source instead of importing Electron; resolve
// the deliberately literal shell-brace expression exactly as the JS template
// evaluates it at runtime.
const installerScript = scriptMatch[1].replaceAll("${'${'}", '${')

function makeFixture(options: { reportedVersion?: string; failSwap?: boolean; strategy?: 'systemd' | 'direct' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-appimage-transaction-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const systemctlLog = join(root, 'systemctl.log')
  const strategy = options.strategy ?? 'systemd'

  writeFileSync(join(bin, 'systemctl'), `#!/bin/sh
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
if [ "$1" = "--user" ] && [ "$2" = "show" ] && [ "$3" = "--property=MainPID" ]; then
  printf '%s\n' "4242"
fi
exit 0
`)
  writeFileSync(join(bin, 'curl'), `#!/bin/sh
count=0
if [ -f "$CURL_COUNT" ]; then count=$(cat "$CURL_COUNT"); fi
count=$((count + 1))
printf '%s\n' "$count" > "$CURL_COUNT"
if [ "$STRATEGY" = "direct" ] && [ "$count" -eq 2 ]; then exit 1; fi
if [ "$count" -eq 1 ]; then
  printf '{"appVersion":"%s","processId":111,"parentPid":4242,"instanceId":"old-instance"}' "$REPORTED_VERSION"
elif [ "$STRATEGY" = "direct" ] && [ -f "$DIRECT_IDENTITY" ]; then
  pid=$(sed -n '1p' "$DIRECT_IDENTITY")
  instance=$(sed -n '2p' "$DIRECT_IDENTITY")
  printf '{"appVersion":"%s","processId":%s,"parentPid":%s,"instanceId":"%s"}' "$REPORTED_VERSION" "$pid" "$pid" "$instance"
else
  printf '{"appVersion":"%s","processId":222,"parentPid":4242,"instanceId":"replacement-instance"}' "$REPORTED_VERSION"
fi
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
  if (strategy === 'direct') {
    writeFileSync(target, '#!/bin/sh\n/bin/sleep 2\n')
    writeFileSync(pending, '#!/bin/sh\nprintf "%s\\n%s\\n" "$$" "$FLOW_STATE_UPDATE_INSTANCE_ID" > "$DIRECT_IDENTITY"\n/bin/sleep 2\n')
    chmodSync(target, 0o755)
    chmodSync(pending, 0o755)
  } else {
    writeFileSync(target, 'known-good')
    writeFileSync(pending, 'replacement')
  }
  writeFileSync(info, '{}')

  const run = () => execFileSync('/bin/sh', [
    '-c',
    installerScript,
    'flowstate-appimage-install-test',
    target,
    pending,
    info,
    '99999999',
    strategy,
    '1.4.275',
  ], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      SYSTEMCTL_LOG: systemctlLog,
      CURL_COUNT: join(root, 'curl-count'),
      REPORTED_VERSION: options.reportedVersion ?? '1.4.275',
      FAIL_SWAP: options.failSwap ? '1' : '0',
      DIRECT_IDENTITY: join(root, 'direct-identity'),
      STRATEGY: strategy,
    },
    stdio: 'pipe',
  })

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

    expect(readFileSync(fixture.target, 'utf8')).toBe('replacement')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('verifies a live direct-mode replacement before clearing the pending marker', () => {
    const fixture = makeFixture({ strategy: 'direct' })

    fixture.run()

    expect(readFileSync(fixture.target, 'utf8')).toContain('FLOW_STATE_UPDATE_INSTANCE_ID')
    expect(() => readFileSync(`${fixture.target}.flowstate-update-backup`)).toThrow()
    expect(() => readFileSync(fixture.info)).toThrow()
  })

  it('rejects stale localhost health and restores the known-good AppImage', () => {
    const fixture = makeFixture({ reportedVersion: '1.4.274' })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
    const failureReceipt = readFileSync(`${fixture.info}.failed`, 'utf8')
    expect(failureReceipt).toContain('FlowState-1.4.275-x86_64.AppImage\n')
    expect(failureReceipt).toContain('version=1.4.275\n')
    expect(failureReceipt).toContain('artifactUrl=FlowState-1.4.275-x86_64.AppImage\n')
    expect(failureReceipt).toContain('errorClass=readiness\n')
    expect(failureReceipt).toContain('reason=supervised readiness\n')
    expect(failureReceipt).not.toContain('\\n')
    expect(readFileSync(fixture.systemctlLog, 'utf8')).toContain(
      'start flowstate-background.service',
    )
  })

  it('restores the known-good target when the atomic swap fails', () => {
    const fixture = makeFixture({ failSwap: true })

    expect(fixture.run).toThrow()

    expect(readFileSync(fixture.target, 'utf8')).toBe('known-good')
    expect(readFileSync(fixture.info, 'utf8')).toBe('{}')
    expect(readFileSync(`${fixture.info}.failed`, 'utf8')).toContain('reason=swap target\n')
  })
})
