import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../../..')
const servicePath = join(projectRoot, 'infra/electron-background/flowstate-background.service')
const installerPath = join(projectRoot, 'scripts/install-electron-background-service.sh')

describe('FlowState Electron background service', () => {
  it('runs the canonical launcher in the graphical session with one stable profile', () => {
    const service = readFileSync(servicePath, 'utf8')

    expect(service).toContain('After=graphical-session.target')
    expect(service).toContain('PartOf=graphical-session.target')
    expect(service).toContain('WantedBy=graphical-session.target')
    expect(service).toContain('Environment=HOME=%h')
    expect(service).toContain('Environment=XDG_CONFIG_HOME=%h/.config')
    expect(service).toContain(
      'ExecStart=%h/.local/bin/FlowState-launch.sh --user-data-dir=%h/.config/flow-state',
    )
    expect(service).not.toContain('ExecStart=%h/.local/bin/flowstate ')
  })

  it('restarts crashes while leaving a normal user close closed', () => {
    const service = readFileSync(servicePath, 'utf8')

    expect(service).toContain('Environment=FLOWSTATE_SUPERVISED=1')
    expect(service).toContain('Environment=FLOWSTATE_UPDATE_EXIT_CODE=75')
    expect(service).toContain('Restart=on-failure')
    expect(service).not.toContain('Restart=always')
    expect(service).toContain('RestartPreventExitStatus=75')
    expect(service).toMatch(/RestartSec=\d+s/)
    expect(service).toMatch(/StartLimitIntervalSec=\d+s/)
    expect(service).toMatch(/StartLimitBurst=\d+/)
    expect(service).toContain('TimeoutStopSec=20s')
  })

  it('installs an owner-only unit and enables it immediately', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'flowstate-background-installer-'))
    const home = join(fixture, 'home')
    const configHome = join(home, '.config')
    const binDir = join(fixture, 'bin')
    const systemctlLog = join(fixture, 'systemctl.log')
    mkdirSync(home, { recursive: true })
    mkdirSync(join(home, '.local/bin'), { recursive: true })
    writeFileSync(join(home, '.local/bin/FlowState-launch.sh'), '#!/bin/sh\n', { mode: 0o755 })
    const profileDir = join(configHome, 'flow-state')
    mkdirSync(profileDir, { recursive: true, mode: 0o775 })
    const localApiConfig = join(profileDir, 'local-api.json')
    const electronStore = join(profileDir, 'store.json')
    const electronStoreBackup = join(profileDir, 'store.json.bak')
    const clearedElectronStoreBackup = join(profileDir, 'store.json.bak-cleared')
    writeFileSync(localApiConfig, '{"token":"secret"}\n', { mode: 0o664 })
    writeFileSync(electronStore, '{"auth-backup":{}}\n', { mode: 0o664 })
    writeFileSync(electronStoreBackup, '{"auth-backup":{}}\n', { mode: 0o664 })
    writeFileSync(clearedElectronStoreBackup, '{"auth-backup":{}}\n', { mode: 0o664 })
    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      join(binDir, 'systemctl'),
      `#!/bin/sh\nprintf '%s\\n' "$*" >> "${systemctlLog}"\n`,
      { mode: 0o755 },
    )

    execFileSync('/bin/bash', [installerPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: configHome,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    })

    const installedUnit = join(configHome, 'systemd/user/flowstate-background.service')
    expect(readFileSync(installedUnit, 'utf8')).toBe(readFileSync(servicePath, 'utf8'))
    expect(statSync(installedUnit).mode & 0o777).toBe(0o600)
    expect(statSync(profileDir).mode & 0o777).toBe(0o700)
    expect(statSync(localApiConfig).mode & 0o777).toBe(0o600)
    expect(statSync(electronStore).mode & 0o777).toBe(0o600)
    expect(statSync(electronStoreBackup).mode & 0o777).toBe(0o600)
    expect(statSync(clearedElectronStoreBackup).mode & 0o777).toBe(0o600)
    expect(readFileSync(systemctlLog, 'utf8').trim().split('\n')).toEqual([
      '--user daemon-reload',
      '--user enable --now flowstate-background.service',
    ])
  })

  it('refuses to install when the verified desktop launcher is missing', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'flowstate-background-no-launcher-'))
    const home = join(fixture, 'home')
    const binDir = join(fixture, 'bin')
    mkdirSync(home, { recursive: true })
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'systemctl'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    expect(() => execFileSync('/bin/bash', [installerPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: join(home, '.config'),
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
      stdio: 'pipe',
    })).toThrow()
  })
})
