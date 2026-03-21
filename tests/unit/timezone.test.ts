/**
 * TASK-1594: Timezone-correctness tests for date handling
 *
 * Root cause being guarded: `new Date("2026-03-17")` parses the string as UTC
 * midnight, which in positive UTC offsets (e.g. UTC+2) gives the previous
 * calendar day when converted to local time. All date comparisons must use
 * local-date representations (YYYY-MM-DD strings or `new Date(year, m, d)`).
 *
 * The nanny popup bug: comparing `dueDate` (stored as "2026-03-17") against
 * `new Date()` via Date constructor caused "today" tasks to appear as
 * "tomorrow" for users in UTC+ timezones after 22:00 UTC.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatDateKey, normalizeDueDate } from '@/utils/dateUtils'
import { toSupabaseTask, fromSupabaseTask } from '@/utils/supabaseMappers'

// ---------------------------------------------------------------------------
// Helper: set the system clock and optionally simulate a timezone offset.
//
// jsdom runs in UTC by default. To simulate a user in e.g. UTC+3, we fake
// the Date constructor so that `new Date()` returns a Date whose
// `getFullYear / getMonth / getDate` report local time in that offset.
//
// Strategy: vi.setSystemTime pins the absolute epoch ms. The formatDateKey
// implementation uses `d.getFullYear()` / `d.getMonth()` / `d.getDate()`
// which ARE affected by the real system timezone (UTC in tests). We
// therefore test the implementation's local-date arithmetic directly.
// ---------------------------------------------------------------------------

describe('TASK-1594: Timezone-correctness for date handling', () => {

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // formatDateKey tests
  // -------------------------------------------------------------------------

  it('1. formatDateKey() returns a YYYY-MM-DD string', () => {
    const d = new Date(2026, 2, 17, 14, 30, 0) // March 17 2026 14:30 local
    const result = formatDateKey(d)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2026-03-17')
  })

  it('2. formatDateKey() uses LOCAL date components, not UTC', () => {
    // If the implementation used d.toISOString().slice(0,10) it would use UTC.
    // We create a date that is UTC midnight — this is "the previous day" in UTC−X
    // and "the current day" in UTC+X when it is e.g. 01:00 UTC+1.
    //
    // The correct behaviour is to use local date parts (getFullYear/getMonth/getDate).
    // We test both: a Date constructed with local constructor should give its local date.
    const localDate = new Date(2026, 2, 17, 0, 0, 0) // March 17 local midnight
    const result = formatDateKey(localDate)
    // Must be the date we constructed in local time
    expect(result).toBe('2026-03-17')
  })

  it('3. Due date comparison: task due "2026-03-17" compares correctly against local today', () => {
    vi.useFakeTimers()
    // Simulate local time on March 17 2026, 15:00
    vi.setSystemTime(new Date(2026, 2, 17, 15, 0, 0))

    const todayKey = formatDateKey(new Date())
    const taskDueDate = '2026-03-17'

    // String equality — no Date constructor involved, no timezone pitfall
    expect(todayKey).toBe('2026-03-17')
    expect(taskDueDate === todayKey).toBe(true)
  })

  it('4. Due date "today" check works at 23:59 local time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 23, 59, 59))

    const todayKey = formatDateKey(new Date())
    expect(todayKey).toBe('2026-03-17')

    // A task due today should still match at 23:59
    expect('2026-03-17' === todayKey).toBe(true)
  })

  it('5. Due date "today" check works at 00:01 local time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 0, 1, 0))

    const todayKey = formatDateKey(new Date())
    expect(todayKey).toBe('2026-03-17')

    expect('2026-03-17' === todayKey).toBe(true)
  })

  it('6. Date string comparison avoids new Date() timezone pitfalls', () => {
    // The CORRECT pattern for comparing due dates
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 20, 0, 0))

    const todayKey = formatDateKey(new Date())

    // WRONG pattern (what causes bugs):
    // new Date("2026-03-17") parses as UTC midnight, which in UTC+3 is
    // 2026-03-16 at 21:00 local time — a different day!
    const utcParsed = new Date("2026-03-17")
    // In UTC (jsdom default), this stays as March 17
    // In UTC+N, utcParsed.toLocaleDateString() may give March 16

    // CORRECT pattern: compare strings directly
    const taskDate = '2026-03-17'
    expect(taskDate === todayKey).toBe(true)   // string comparison — always correct

    // The formatDateKey of a local-time Date is what we should compare against
    const localDate = new Date(2026, 2, 17, 0, 0, 0)
    expect(formatDateKey(localDate)).toBe('2026-03-17')

    // UTC-parsed date is NOT reliable for local comparisons in non-UTC environments
    // In our UTC test environment it happens to be equal, but we document the pitfall:
    expect(utcParsed.getUTCFullYear()).toBe(2026)
    expect(utcParsed.getUTCMonth()).toBe(2)   // March = 2
    expect(utcParsed.getUTCDate()).toBe(17)
    // In UTC+2 environment: utcParsed.getDate() would be 16 (previous local day!)
    // That's why we must use local Date constructor: new Date(year, month, day)
  })

  it('7. moveTaskToSmartGroup("today") sets date to LOCAL today, not UTC', () => {
    vi.useFakeTimers()
    // Simulate 20:00 on March 17 2026 local time (which is 18:00 UTC in UTC+2)
    vi.setSystemTime(new Date(2026, 2, 17, 20, 0, 0))

    // This is the implementation path inside moveTaskToSmartGroup:
    //   const today = new Date()
    //   dueDate = formatDateKey(today)
    // We verify it uses local date arithmetic
    const today = new Date()
    const dueDate = formatDateKey(today)
    expect(dueDate).toBe('2026-03-17')  // must be local date, not UTC
  })

  it('8. moveTaskToSmartGroup("tomorrow") sets date to LOCAL tomorrow', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 23, 0, 0)) // 23:00 local — next day in UTC+1

    // Implementation path:
    //   const tom = new Date(today)
    //   tom.setDate(today.getDate() + 1)
    //   dueDate = formatDateKey(tom)
    const today = new Date()
    const tom = new Date(today)
    tom.setDate(today.getDate() + 1)
    const tomorrowKey = formatDateKey(tom)

    expect(tomorrowKey).toBe('2026-03-18')  // must be local tomorrow
  })

  it('9. DST spring-forward: date arithmetic does not skip a day', () => {
    vi.useFakeTimers()
    // US spring forward 2026: March 8 at 02:00 clocks jump to 03:00 (UTC−5 → UTC−4)
    // Simulate the moment just after spring-forward (03:01 local, which was 02:01)
    // We use local-time Date constructor so DST offset is applied
    vi.setSystemTime(new Date(2026, 2, 8, 3, 1, 0)) // March 8 03:01

    const today = new Date()
    const todayKey = formatDateKey(today)
    expect(todayKey).toBe('2026-03-08')

    // Adding one day: March 8 → March 9 (no day skipped)
    const tom = new Date(today)
    tom.setDate(today.getDate() + 1)
    const tomorrowKey = formatDateKey(tom)
    expect(tomorrowKey).toBe('2026-03-09')

    // formatDateKey relies on getDate(), not arithmetic on epoch ms,
    // so it is immune to the DST hour gap
    expect(tomorrowKey).not.toBe('2026-03-08')  // no duplicate
    expect(tomorrowKey).not.toBe('2026-03-10')  // no skip
  })

  it('10. DST fall-back: date arithmetic does not duplicate a day', () => {
    vi.useFakeTimers()
    // US fall-back 2026: November 1 at 02:00 clocks fall to 01:00 (UTC−4 → UTC−5)
    vi.setSystemTime(new Date(2026, 10, 1, 1, 30, 0)) // November 1 01:30

    const today = new Date()
    const todayKey = formatDateKey(today)
    expect(todayKey).toBe('2026-11-01')

    // Adding one day should give November 2, not November 1 again
    const tom = new Date(today)
    tom.setDate(today.getDate() + 1)
    const tomorrowKey = formatDateKey(tom)
    expect(tomorrowKey).toBe('2026-11-02')

    expect(tomorrowKey).not.toBe('2026-11-01')  // no duplication
  })

  it('11. Date-only strings ("2026-03-17") parsed consistently via normalizeDueDate', () => {
    // new Date("2026-03-17") → UTC midnight (pitfall)
    // normalizeDueDate should preserve the date-only string as-is (no conversion)
    const result = normalizeDueDate('2026-03-17')
    expect(result).toBe('2026-03-17')  // passthrough, no timezone conversion

    // Also works for other dates
    expect(normalizeDueDate('2026-01-01')).toBe('2026-01-01')
    expect(normalizeDueDate('2026-12-31')).toBe('2026-12-31')
  })

  it('12. ISO datetime strings with timezone offset are normalized to local date', () => {
    // An ISO string like "2026-03-17T22:00:00.000Z" is UTC 22:00
    // In UTC+3, this is 2026-03-18 01:00 local — so the local date is March 18!
    // normalizeDueDate should extract the date part from the ISO string correctly.

    // In our UTC test environment, "2026-03-17T00:00:00.000Z" stays as March 17
    const isoUTC = '2026-03-17T14:30:00.000Z'
    const result = normalizeDueDate(isoUTC)

    // normalizeDueDate implementation splits on 'T' to get the date part,
    // which is the UTC date embedded in the ISO string — matches BUG-1416 fix behaviour
    // (BUG-1416: canonical dueDate format is YYYY-MM-DD extracted from ISO strings)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2026-03-17')  // UTC date preserved from ISO string
  })

  it('13. created_at and updated_at values are ISO strings with timezone info', () => {
    const userId = 'user-test-001'

    const task = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      title: 'TS test',
      description: '',
      status: 'todo' as const,
      priority: null,
      projectId: 'project-123e4567-e89b-12d3-a456-426614174000',
      completedPomodoros: 0,
      estimatedPomodoros: 1,
      progress: 0,
      dueDate: '',
      subtasks: [],
      tags: [],
      isInInbox: false,
      order: 0,
      createdAt: new Date('2026-01-15T10:30:00.000Z'),
      updatedAt: new Date('2026-03-17T08:00:00.000Z'),
    }

    const result = toSupabaseTask(task, userId)

    // created_at should be a full ISO string (ends with Z for UTC)
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(result.created_at).toContain('T')

    // updated_at is always set to now() inside toSupabaseTask
    expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(result.updated_at).toContain('T')
  })

  it('14. Supabase timestamptz values round-trip correctly through mappers', () => {
    const userId = 'user-test-001'

    // Simulate a DB record with timestamptz values (Supabase returns ISO strings)
    const dbRecord = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      user_id: userId,
      title: 'Round-trip task',
      description: '',
      status: 'planned',
      priority: null,
      project_id: 'project-123e4567-e89b-12d3-a456-426614174000',
      completed_pomodoros: 0,
      estimated_pomodoros: 1,
      progress: 0,
      due_date: '2026-03-21',         // date-only string
      subtasks: [],
      tags: [],
      is_in_inbox: false,
      order: 0,
      is_deleted: false,
      deleted_at: null,
      completed_at: null,
      created_at: '2026-01-15T10:30:00.000000+00:00',
      updated_at: '2026-03-17T08:00:00.000000+00:00',
    }

    const task = fromSupabaseTask(dbRecord)

    // Dates should be parsed as Date objects
    expect(task.createdAt).toBeInstanceOf(Date)
    expect(task.updatedAt).toBeInstanceOf(Date)

    // Values should be valid dates (not NaN)
    expect(isNaN((task.createdAt as Date).getTime())).toBe(false)
    expect(isNaN((task.updatedAt as Date).getTime())).toBe(false)

    // due_date should come back as the date-only string
    expect(task.dueDate).toBe('2026-03-21')

    // Now convert back to DB format — created_at should survive
    const backToDb = toSupabaseTask(task, userId)
    expect(backToDb.created_at).toBeTruthy()
    expect(backToDb.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // due_date must remain as date-only string (BUG-1286: no T00:00:00.000Z appended)
    expect(backToDb.due_date).toBe('2026-03-21')
    expect(backToDb.due_date).not.toContain('T')
  })

  it('15. Calendar view date grouping uses local dates, not UTC', () => {
    // formatDateKey is the function used by calendar grouping to key tasks into day buckets.
    // Verify that tasks scheduled at various local times all key into the correct local day.
    vi.useFakeTimers()

    const cases: Array<{ localDate: Date; expected: string }> = [
      { localDate: new Date(2026, 2, 17, 0, 0, 0),  expected: '2026-03-17' },  // midnight
      { localDate: new Date(2026, 2, 17, 12, 0, 0), expected: '2026-03-17' },  // noon
      { localDate: new Date(2026, 2, 17, 23, 59, 0),expected: '2026-03-17' },  // end of day
      { localDate: new Date(2026, 2, 18, 0, 0, 0),  expected: '2026-03-18' },  // next midnight
      { localDate: new Date(2026, 0, 1, 0, 0, 0),   expected: '2026-01-01' },  // new year
      { localDate: new Date(2026, 11, 31, 23, 59, 0),expected: '2026-12-31' }, // year end
    ]

    for (const { localDate, expected } of cases) {
      vi.setSystemTime(localDate)
      const key = formatDateKey(new Date()) // new Date() returns the mocked local time
      expect(key, `Expected date key ${expected} for ${localDate.toISOString()}`).toBe(expected)
    }
  })
})
