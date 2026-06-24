import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PomodoroSession } from '@/stores/timer'
import { syncLocalApiTimerSnapshot } from '@/composables/useLocalApiBridge'

describe('Renderer local API timer snapshot bridge', () => {
  const setLocalApiTimerSnapshot = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T10:00:11.000Z'))
    setLocalApiTimerSnapshot.mockReset()
    vi.stubGlobal('window', {
      electronAPI: {
        isElectron: true,
        setLocalApiTimerSnapshot,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sends the active Electron timer session to the sidecar in KDE API row shape', () => {
    const session: PomodoroSession = {
      id: 'session-1',
      taskId: 'task-1',
      startTime: new Date('2026-06-25T10:00:00.000Z'),
      duration: 1500,
      remainingTime: 1499.8,
      isActive: true,
      isPaused: false,
      isBreak: false,
      deviceLeaderId: null,
      deviceLeaderLastSeen: Date.parse('2026-06-25T10:00:10.000Z'),
    }

    syncLocalApiTimerSnapshot(session, 'electron-device-1')

    expect(setLocalApiTimerSnapshot).toHaveBeenCalledTimes(1)
    expect(setLocalApiTimerSnapshot).toHaveBeenCalledWith({
      active: true,
      updatedAt: Date.parse('2026-06-25T10:00:11.000Z'),
      session: {
        id: 'session-1',
        task_id: 'task-1',
        start_time: '2026-06-25T10:00:00.000Z',
        duration: 1500,
        remaining_time: 1499,
        is_active: true,
        is_paused: false,
        is_break: false,
        completed_at: null,
        device_leader_id: 'electron-device-1',
        device_leader_last_seen: '2026-06-25T10:00:10.000Z',
      },
    })
  })

  it('clears the local timer snapshot when the renderer has no current session', () => {
    syncLocalApiTimerSnapshot(null, 'electron-device-1')

    expect(setLocalApiTimerSnapshot).toHaveBeenCalledTimes(1)
    expect(setLocalApiTimerSnapshot).toHaveBeenCalledWith({
      active: false,
      updatedAt: Date.parse('2026-06-25T10:00:11.000Z'),
      session: null,
    })
  })

  it('is a no-op outside Electron', () => {
    vi.stubGlobal('window', { electronAPI: { isElectron: false, setLocalApiTimerSnapshot } })

    syncLocalApiTimerSnapshot(null, 'electron-device-1')

    expect(setLocalApiTimerSnapshot).not.toHaveBeenCalled()
  })
})
