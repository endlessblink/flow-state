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
      'ExecStart=%h/.local/bin/flowstate --background --user-data-dir=%h/.config/flow-state',
    )
  })

  it('restarts crashes with a bound while reserving a distinct update handoff exit', () => {
    const service = readFileSync(servicePath, 'utf8')

    expect(service).toContain('Environment=FLOWSTATE_SUPERVISED=1')
    expect(service).toContain('Environment=FLOWSTATE_UPDATE_EXIT_CODE=75')
    expect(service).toContain('Restart=always')
    expect(service).toContain('RestartPreventExitStatus=75')
    expect(service).toMatch(/RestartSec=\d+s/)
    expect(service).toMatch(/StartLimitIntervalSec=\d+s/)
    expect(service).toMatch(/StartLimitBurst=\d+/)
  })

  it('installs an owner-only unit and enables it immediately', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'flowstate-background-installer-'))
    const home = join(fixture, 'home')
    const configHome = join(home, '.config')
    const binDir = join(fixture, 'bin')
    const systemctlLog = join(fixture, 'systemctl.log')
    mkdirSync(home, { recursive: true })
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
    expect(readFileSync(systemctlLog, 'utf8').trim().split('\n')).toEqual([
      '--user daemon-reload',
      '--user enable --now flowstate-background.service',
    ])
  })
})
