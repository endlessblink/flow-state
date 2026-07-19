import { describe, expect, it } from 'vitest'

import {
  SUPERVISED_UPDATE_EXIT_CODE,
  resolveUpdateRelaunch,
} from '../../../electron/supervisedUpdate'

describe('supervised Electron update handoff', () => {
  it('gives systemd sole relaunch authority for supervised installs', () => {
    expect(resolveUpdateRelaunch({ FLOWSTATE_SUPERVISED: '1' })).toEqual({
      strategy: 'systemd',
      exitCode: SUPERVISED_UPDATE_EXIT_CODE,
    })
    expect(SUPERVISED_UPDATE_EXIT_CODE).toBe(75)
  })

  it('preserves direct AppImage relaunch for unsupervised installs', () => {
    expect(resolveUpdateRelaunch({})).toEqual({
      strategy: 'direct',
      exitCode: 0,
    })
  })
})
