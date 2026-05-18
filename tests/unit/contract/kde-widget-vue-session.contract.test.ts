/**
 * TASK-1790: Contract test — KDE widget write shape ↔ Vue read mapper.
 *
 * The KDE widget and the Vue/Electron app talk to the same Supabase
 * `timer_sessions` table. The widget writes payloads constructed in QML
 * (packages/kde-widget/contents/ui/main.qml); the Vue app reads them via
 * `fromSupabaseTimerSession` (src/utils/supabaseMappers.ts).
 *
 * If either side's column set drifts (new column, renamed column, type change)
 * cross-device sync breaks silently — exactly the class of failure that
 * produced TASK-1790. This contract test takes the canonical widget payload
 * shape (verbatim from main.qml line ~4445) and asserts the Vue mapper
 * hydrates every field correctly.
 *
 * If this test fails, the two clients are no longer wire-compatible — fix
 * BOTH sides before merging.
 */

import { describe, it, expect } from 'vitest'
import { fromSupabaseTimerSession } from '@/utils/supabaseMappers'
import type { SupabaseTimerSession } from '@/types/supabase'

// Canonical payload shape written by the KDE widget. Mirror of the `payload`
// object in main.qml around line 4445. Any field added to the widget side
// must be added here too — that's the contract.
function makeKdeWidgetPayload(overrides: Partial<SupabaseTimerSession> = {}): SupabaseTimerSession {
  return {
    id: 'aa0e8400-e29b-41d4-a716-446655440099',
    user_id: '717f5209-42d8-4bb9-8781-740107a384e5',
    task_id: 'general',
    start_time: '2026-05-18T12:16:20.097Z',
    duration: 1500,
    remaining_time: 1461,
    is_active: true,
    is_paused: false,
    is_break: false,
    completed_at: null,
    device_leader_id: 'kde-widget',
    device_leader_last_seen: '2026-05-18T12:17:00.195Z',
    ...overrides,
  } as SupabaseTimerSession
}

describe('TASK-1790 contract: KDE widget payload → Vue mapper', () => {
  it('every field the widget writes is preserved through the Vue mapper', () => {
    const widgetPayload = makeKdeWidgetPayload()
    const session = fromSupabaseTimerSession(widgetPayload)

    expect(session.id).toBe(widgetPayload.id)
    expect(session.taskId).toBe(widgetPayload.task_id)
    expect(session.startTime).toBeInstanceOf(Date)
    expect(session.startTime.toISOString()).toBe(widgetPayload.start_time)
    expect(session.duration).toBe(widgetPayload.duration)
    expect(session.remainingTime).toBe(widgetPayload.remaining_time)
    expect(session.isActive).toBe(true)
    expect(session.isPaused).toBe(false)
    expect(session.isBreak).toBe(false)
    expect(session.completedAt).toBeUndefined()
    expect(session.deviceLeaderId).toBe('kde-widget')
    expect(session.deviceLeaderLastSeen).toBe(
      new Date(widgetPayload.device_leader_last_seen!).getTime()
    )
  })

  it('paused-state widget payload round-trips correctly', () => {
    const session = fromSupabaseTimerSession(
      makeKdeWidgetPayload({ is_paused: true, is_active: true })
    )
    expect(session.isPaused).toBe(true)
    expect(session.isActive).toBe(true)
  })

  it('break-session widget payload round-trips correctly', () => {
    const session = fromSupabaseTimerSession(
      makeKdeWidgetPayload({ is_break: true, task_id: 'general' })
    )
    expect(session.isBreak).toBe(true)
    expect(session.taskId).toBe('general')
  })

  it('completed widget payload preserves completedAt as Date', () => {
    const session = fromSupabaseTimerSession(
      makeKdeWidgetPayload({
        is_active: false,
        completed_at: '2026-05-18T12:25:00.000Z',
      })
    )
    expect(session.isActive).toBe(false)
    expect(session.completedAt).toBeInstanceOf(Date)
    expect(session.completedAt!.toISOString()).toBe('2026-05-18T12:25:00.000Z')
  })

  it('device_leader_id="kde-widget" survives mapping (Vue uses this to detect widget-led sessions)', () => {
    // If the widget started a session, Vue must see the widget as the leader
    // so it correctly enters follower mode instead of fighting for leadership.
    const session = fromSupabaseTimerSession(makeKdeWidgetPayload())
    expect(session.deviceLeaderId).toBe('kde-widget')
  })
})
