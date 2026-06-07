import { describe, expect, it } from 'vitest'
import {
  buildStructuredTaskCards,
  buildStructuredTaskFallback,
  finalizeTaskAnswer,
  isMeaningfulTaskReason,
  shouldUseStructuredTaskFallback,
} from '@/services/ai/pipeline/taskAnswerFallback'

const taskResults = [{
  success: true,
  message: 'נמצאו 3 משימות',
  data: [
    {
      id: 't1',
      title: 'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים',
      priority: 'high',
      daysOverdue: 2,
      description: 'טיפול שצריך עקביות ולא כדאי לפספס מנות.',
    },
    {
      id: 't2',
      title: 'לעבור על תוצאות פייפרפורט ולסקין',
      priority: 'high',
    },
    {
      id: 't3',
      title: 'Write one cold opener from the target list',
      priority: 'medium',
      estimatedDuration: 20,
    },
  ],
}]

describe('task answer fallback quality gate', () => {
  it('flags the shallow one-paragraph task answer shape from the Electron regression', () => {
    const shallow = 'הייתי מתחיל ב-"להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים", "לעבור על תוצאות פייפרפורט ולסקין", ו-"Write one cold opener from the target list", לפי הסדר הזה; אלה נראות כמו המשימות הכי דחופות כרגע.'

    expect(shouldUseStructuredTaskFallback(shallow, taskResults, null)).toBe(true)
  })

  it('does not replace valid parsed cards with meaningful per-card reasons', () => {
    const parsed = {
      groups: [{
        name: 'רצף',
        tasks: [{ title: 'לעבור על תוצאות פייפרפורט ולסקין', reason: 'פותח את שלב הכתיבה הבא' }],
      }],
      total: 3,
      rawBlock: '```cards\n{}\n```',
    }

    expect(shouldUseStructuredTaskFallback('קודם בודקים את התוצאות ואז כותבים.', taskResults, parsed)).toBe(false)
  })

  it('rejects parsed card reasons that only repeat priority or overdue metadata', () => {
    const parsed = {
      groups: [{
        name: 'דחוף',
        tasks: [
          { title: 'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים', reason: 'high priority' },
          { title: 'לעבור על תוצאות פייפרפורט ולסקין', reason: 'באיחור 2 ימים' },
        ],
      }],
      total: 3,
      rawBlock: '```cards\n{}\n```',
    }

    expect(shouldUseStructuredTaskFallback('אלה המשימות הדחופות.', taskResults, parsed)).toBe(true)
  })

  it('rejects parsed cards when only some task reasons are meaningful', () => {
    const parsed = {
      groups: [{
        name: 'רצף',
        tasks: [
          { title: 'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים', reason: 'ההערה נותנת הקשר רפואי שמצריך רצף' },
          { title: 'לעבור על תוצאות פייפרפורט ולסקין', reason: 'high priority' },
        ],
      }],
      total: 3,
      rawBlock: '```cards\n{}\n```',
    }

    expect(shouldUseStructuredTaskFallback('קודם מטפלים ברצף ואז במכירות.', taskResults, parsed)).toBe(true)
  })

  it('rejects structured-looking answers that mention tasks without meaningful reasons', () => {
    const shallowList = [
      '1. **להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים** - high priority',
      '2. **לעבור על תוצאות פייפרפורט ולסקין** - באיחור',
    ].join('\n')

    expect(shouldUseStructuredTaskFallback(shallowList, taskResults, null)).toBe(true)
  })

  it('classifies real stakes as meaningful reasons and metadata-only labels as shallow', () => {
    expect(isMeaningfulTaskReason('money or billing can get stuck')).toBe(true)
    expect(isMeaningfulTaskReason('פותח את שלב הכתיבה הבא')).toBe(true)
    expect(isMeaningfulTaskReason('high priority')).toBe(false)
    expect(isMeaningfulTaskReason('באיחור 2 ימים')).toBe(false)
  })

  it('builds a structured answer with explicit reasons and task names', () => {
    const answer = buildStructuredTaskFallback(taskResults, 'he')

    expect(answer).toContain('זה הסדר שהייתי בוחר')
    expect(answer).toContain('1. **להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים**')
    expect(answer).toContain('ההערה נותנת הקשר')
    expect(answer).toContain('2. **לעבור על תוצאות פייפרפורט ולסקין**')
    expect(answer).toContain('3. **Write one cold opener from the target list**')
    expect(answer).toContain('הקשר המרכזי')
  })

  it('builds matching card metadata with non-empty reasons', () => {
    const cards = buildStructuredTaskCards(taskResults, 'he', 'משימות מהתשובה', 'week_plan')

    expect(cards?.kind).toBe('week_plan')
    expect(cards?.groups[0].tasks.map(task => task.title)).toEqual([
      'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים',
      'לעבור על תוצאות פייפרפורט ולסקין',
      'Write one cold opener from the target list',
    ])
    expect(cards?.groups[0].tasks.every(task => task.reason.length > 0)).toBe(true)
  })

  it('finalizes a shallow formatter answer into rich visible text plus matching cards', () => {
    const shallow = 'הייתי מתחיל ב-"להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים", "לעבור על תוצאות פייפרפורט ולסקין", ו-"Write one cold opener from the target list", לפי הסדר הזה; אלה נראות כמו המשימות הכי דחופות כרגע.'

    const finalized = finalizeTaskAnswer(shallow, taskResults, 'he', {
      groupName: 'משימות מהתשובה',
      kind: 'week_plan',
    })

    expect(finalized.usedStructuredFallback).toBe(true)
    expect(finalized.displayText).toContain('זה הסדר שהייתי בוחר')
    expect(finalized.displayText).toContain('1. **להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים**')
    expect(finalized.cards?.kind).toBe('week_plan')
    expect(finalized.cards?.groups[0].tasks.map(task => task.title)).toEqual([
      'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים',
      'לעבור על תוצאות פייפרפורט ולסקין',
      'Write one cold opener from the target list',
    ])
    expect(finalized.cards?.groups[0].tasks.every(task => isMeaningfulTaskReason(task.reason))).toBe(true)
  })

  it('finalizes valid model cards without replacing them', () => {
    const answer = [
      'קודם בודקים את התוצאות ואז כותבים את הפתיח.',
      '',
      '```cards',
      JSON.stringify({
        kind: 'week_plan',
        groups: [{
          name: 'רצף מכירות',
          items: [
            { i: 2, reason: 'פותח את שלב הכתיבה הבא' },
            { i: 3, reason: 'תלוי ברשימת היעדים' },
          ],
        }],
      }),
      '```',
    ].join('\n')

    const finalized = finalizeTaskAnswer(answer, taskResults, 'he', {
      groupName: 'משימות מהתשובה',
      kind: 'week_plan',
    })

    expect(finalized.usedStructuredFallback).toBe(false)
    expect(finalized.displayText).toBe('קודם בודקים את התוצאות ואז כותבים את הפתיח.')
    expect(finalized.cards?.groups[0].tasks.map(task => task.title)).toEqual([
      'לעבור על תוצאות פייפרפורט ולסקין',
      'Write one cold opener from the target list',
    ])
  })

  it('preserves directive kind while replacing shallow day-plan cards', () => {
    const answer = [
      'היום מתחילים במה שהכי דחוף.',
      '',
      '```cards',
      JSON.stringify({
        kind: 'day_plan',
        groups: [{
          name: 'בוקר',
          items: [
            { i: 1, reason: 'high priority' },
            { i: 2, reason: 'באיחור' },
          ],
        }],
      }),
      '```',
    ].join('\n')

    const finalized = finalizeTaskAnswer(answer, taskResults, 'he', {
      groupName: 'תוכנית היום',
      kind: 'day_plan',
    })

    expect(finalized.usedStructuredFallback).toBe(true)
    expect(finalized.cards?.kind).toBe('day_plan')
    expect(finalized.cards?.groups[0].tasks.map(task => task.title)).toEqual([
      'להתחיל טיפול אוראו - פעמיים ביום לעשרה ימים',
      'לעבור על תוצאות פייפרפורט ולסקין',
      'Write one cold opener from the target list',
    ])
    expect(finalized.cards?.groups[0].tasks.every(task => isMeaningfulTaskReason(task.reason))).toBe(true)
  })

  it('loads nested task arrays when finalizing directive answers', () => {
    const nestedResults = [{
      success: true,
      message: 'נמצאו משימות',
      data: {
        dueTodayTasks: [
          {
            id: 'today-1',
            title: 'לבדוק תשלומים באתר דרך קאדרקום',
            priority: 'high',
          },
        ],
        overdueTasks: [
          {
            id: 'late-1',
            title: 'להגיב למירי ולשלוח חשבונית',
            priority: 'high',
            daysOverdue: 1,
          },
        ],
      },
    }]

    const finalized = finalizeTaskAnswer('הייתי מתחיל ב-"לבדוק תשלומים באתר דרך קאדרקום" ואז ב-"להגיב למירי ולשלוח חשבונית", כי אלה המשימות הכי דחופות כרגע.', nestedResults, 'he', {
      groupName: 'תוכנית היום',
      kind: 'day_plan',
    })

    expect(finalized.usedStructuredFallback).toBe(true)
    expect(finalized.cards?.kind).toBe('day_plan')
    expect(finalized.cards?.groups[0].tasks.map(task => task.title)).toEqual([
      'לבדוק תשלומים באתר דרך קאדרקום',
      'להגיב למירי ולשלוח חשבונית',
    ])
    expect(finalized.displayText).toContain('כסף או גבייה עלולים להיתקע')
    expect(finalized.displayText).toContain('כבר באיחור 1 ימים אחרי הסיכון האמיתי')
  })
})
