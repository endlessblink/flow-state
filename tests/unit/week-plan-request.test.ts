/**
 * TASK-1821 — isWeekPlanRequest / normalizeForRouting truth table.
 *
 * The decisive signal for forward-planning vs retrospective-summary is the
 * predicate/tense, NOT the time word. Bare "this week"/"השבוע" must NOT count as
 * planning, and any retrospective predicate must veto planning.
 */
import { describe, it, expect } from 'vitest'
import { isWeekPlanRequest, normalizeForRouting } from '@/services/ai/pipeline/dayPlan'

describe('normalizeForRouting', () => {
  it('strips Hebrew niqqud and lowercases/collapses', () => {
    // "שָׁלוֹם   Hello" → niqqud removed, lowercased, single-spaced
    expect(normalizeForRouting('שָׁלוֹם   Hello')).toBe('שלום hello')
  })
})

describe('isWeekPlanRequest', () => {
  it.each([
    'plan my week',
    'plan the week',
    'plan the rest of my week',
    'help me plan the remaining week',
    'help me plan until the end of the week',
    'help me plan tomorrow',
    'תכנן את השבוע',
    'תעזור לי לתכנן את השבוע', // "לתכנן" contains "תכנן"
    'תעזור לי לתכנן את שארית השבוע',
    'תעזור לי לתכנן עד סוף השבוע',
    'סדר לי את המשך השבוע',
    'plan לי את השבוע',
    'what should I do this week',
    'מה לעשות השבוע',
  ])('is TRUE for forward planning: "%s"', (msg) => {
    expect(isWeekPlanRequest(msg)).toBe(true)
  })

  it.each([
    'summarize my week',
    'weekly summary',
    'סיכום שבועי',
    'מה עשיתי השבוע',      // retrospective predicate vetoes planning
    'what did I do this week',
    'this week',            // bare time word, no predicate
    'מה לעשות',             // weak predicate, no horizon → suggest_next_task, not week plan
    'how do I organize my day?', // a how-to question, not a plan command
  ])('is FALSE for non-planning: "%s"', (msg) => {
    expect(isWeekPlanRequest(msg)).toBe(false)
  })
})
