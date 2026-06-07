import { describe, expect, it } from 'vitest'
import {
  buildStructuredTaskCards,
  buildStructuredTaskFallback,
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
})
