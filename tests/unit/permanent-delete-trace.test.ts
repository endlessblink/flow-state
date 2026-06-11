import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beginPermanentDeleteTrace,
  endPermanentDeleteTrace,
  hasPermanentDeleteTrace,
  logPermanentDeleteTrace,
  logPermanentDeleteTraceIfActive,
} from '@/utils/permanentDeleteTrace'

describe('permanent delete trace logging', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (typeof window !== 'undefined') {
      delete window.__FlowStatePermanentDeleteTraces
    }
  })

  it('keeps one trace id across delete stages', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const traceId = beginPermanentDeleteTrace('task-12345678', 'unit-test')
    logPermanentDeleteTrace('task-12345678', 'after-local-delete', { stillVisible: false })

    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenNthCalledWith(1, '[PERMA-DELETE-TRACE]', expect.objectContaining({
      traceId,
      taskId: 'task-12345678',
      origin: 'unit-test',
      stage: 'begin',
    }))
    expect(warnSpy).toHaveBeenNthCalledWith(2, '[PERMA-DELETE-TRACE]', expect.objectContaining({
      traceId,
      stage: 'after-local-delete',
      stillVisible: false,
    }))
  })

  it('only emits conditional sync/load logs while a delete trace is active', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logPermanentDeleteTraceIfActive('task-no-trace', 'sync-readd')
    expect(warnSpy).not.toHaveBeenCalled()

    beginPermanentDeleteTrace('task-active-trace', 'unit-test')
    logPermanentDeleteTraceIfActive('task-active-trace', 'sync-readd')

    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenLastCalledWith('[PERMA-DELETE-TRACE]', expect.objectContaining({
      taskId: 'task-active-trace',
      stage: 'sync-readd',
    }))
  })

  it('stays active briefly after commit so post-delete resurrection logs are captured', () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    beginPermanentDeleteTrace('task-retained-trace', 'unit-test')
    endPermanentDeleteTrace('task-retained-trace', 'committed')

    expect(hasPermanentDeleteTrace('task-retained-trace')).toBe(true)

    vi.advanceTimersByTime(119_999)
    expect(hasPermanentDeleteTrace('task-retained-trace')).toBe(true)

    vi.advanceTimersByTime(1)
    expect(hasPermanentDeleteTrace('task-retained-trace')).toBe(false)
  })
})
