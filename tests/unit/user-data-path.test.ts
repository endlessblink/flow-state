import { describe, it, expect } from 'vitest'
import { resolveUserDataDir } from '../../electron/userDataPath'

/**
 * BUG-1932 regression pack. The user's actual repro shape: the Hermes agent launched FlowState
 * with HOME=/home/endlessblink/.hermes/profiles/office-work/home, so Electron read an empty
 * profile and rendered the Sign In screen while the real session was intact in ~/.config.
 */

const PASSWD_HOME = '/home/endlessblink'
const APP = 'flow-state'

const base = {
  passwdHome: PASSWD_HOME,
  appName: APP,
  platform: 'linux' as NodeJS.Platform,
}

describe('resolveUserDataDir', () => {
  it('pins to the passwd home when a launcher rewrites HOME (the BUG-1932 repro)', () => {
    const result = resolveUserDataDir({
      ...base,
      env: {
        HOME: '/home/endlessblink/.hermes/profiles/office-work/home',
        HERMES_REAL_HOME: PASSWD_HOME,
      },
    })
    expect(result).toBe('/home/endlessblink/.config/flow-state')
  })

  it('leaves Electron alone when HOME is the real home', () => {
    expect(resolveUserDataDir({ ...base, env: { HOME: PASSWD_HOME } })).toBeNull()
  })

  it('honours deliberate isolation via FLOWSTATE_ALLOW_HOME_OVERRIDE', () => {
    const result = resolveUserDataDir({
      ...base,
      env: { HOME: '/tmp/fake-home', FLOWSTATE_ALLOW_HOME_OVERRIDE: '1' },
    })
    expect(result).toBeNull()
  })

  it('honours XDG_CONFIG_HOME when it lives under the passwd home', () => {
    const result = resolveUserDataDir({
      ...base,
      env: { HOME: PASSWD_HOME, XDG_CONFIG_HOME: '/home/endlessblink/.config-alt' },
    })
    expect(result).toBeNull()
  })

  it('overrides XDG_CONFIG_HOME pointing outside the passwd home', () => {
    const result = resolveUserDataDir({
      ...base,
      env: { HOME: PASSWD_HOME, XDG_CONFIG_HOME: '/tmp/sandbox/.config' },
    })
    expect(result).toBe('/home/endlessblink/.config/flow-state')
  })

  it('pins when HOME is unset entirely', () => {
    expect(resolveUserDataDir({ ...base, env: {} })).toBe('/home/endlessblink/.config/flow-state')
  })

  it('does not treat a sibling directory as inside the passwd home', () => {
    // /home/endlessblink2 must not match a naive startsWith on /home/endlessblink
    const result = resolveUserDataDir({ ...base, env: { HOME: '/home/endlessblink2' } })
    expect(result).toBe('/home/endlessblink/.config/flow-state')
  })

  it('never rewrites userData on macOS or Windows', () => {
    for (const platform of ['darwin', 'win32'] as NodeJS.Platform[]) {
      expect(resolveUserDataDir({ ...base, platform, env: { HOME: '/tmp/fake-home' } })).toBeNull()
    }
  })

  it('is inert without a passwd home', () => {
    expect(resolveUserDataDir({ ...base, passwdHome: '', env: { HOME: '/tmp/x' } })).toBeNull()
  })
})
