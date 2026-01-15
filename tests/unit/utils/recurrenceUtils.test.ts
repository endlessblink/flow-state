import { describe, it, expect } from 'vitest'
import {
    getNextOccurrence,
    validateRecurrenceRule
} from '../../../src/utils/recurrenceUtils'
import { RecurrencePattern } from '../../../src/types/recurrence'

const formatDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

describe('recurrenceUtils', () => {
    describe('getNextOccurrence - Custom Rules', () => {
        it('handles EVERY N DAYS', () => {
            const start = new Date(2026, 0, 1)
            const rule = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 3 DAYS' }

            const next = getNextOccurrence(start, rule)
            expect(formatDate(next)).toBe('2026-01-04')
        })

        it('handles EVERY N WEEKS ON [DAYS]', () => {
            const start = new Date(2026, 0, 14) // Wednesday
            const rule = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 WEEKS ON MON,FRI' }

            // Next should be Friday (same week)
            const next1 = getNextOccurrence(start, rule)
            expect(formatDate(next1)).toBe('2026-01-16')

            // Next after Friday should be Monday (next week)
            const next2 = getNextOccurrence(next1, rule)
            expect(formatDate(next2)).toBe('2026-01-19')
        })

        it('handles EVERY N MONTHS ON LAST DAY', () => {
            const start = new Date(2026, 0, 31)
            const rule = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 MONTHS ON LAST DAY' }

            const next = getNextOccurrence(start, rule)
            expect(formatDate(next)).toBe('2026-02-28')

            const next2 = getNextOccurrence(next, rule)
            expect(formatDate(next2)).toBe('2026-03-31')
        })

        it('handles EVERY N MONTHS ON NTH WEEKDAY', () => {
            const start = new Date(2026, 0, 1) // Thursday
            const rule = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 MONTHS ON 2ND TUESDAY' }

            // Jan 2026 2nd Tuesday: Jan 13
            // Feb 2026 2nd Tuesday: Feb 10
            const next = getNextOccurrence(start, rule)
            expect(formatDate(next)).toBe('2026-02-10')
        })

        it('falls back safely for invalid rules', () => {
            const start = new Date(2026, 0, 1)
            const rule = { pattern: RecurrencePattern.CUSTOM, customRule: 'INVALID RULE' }

            const next = getNextOccurrence(start, rule)
            expect(formatDate(next)).toBe('2026-01-02')
        })
    })

    describe('validateRecurrenceRule - Custom Rules', () => {
        it('validates correct custom rules', () => {
            const rule1 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 3 DAYS' }
            expect(validateRecurrenceRule(rule1).isValid).toBe(true)

            const rule2 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 2 WEEKS ON MON,FRI' }
            expect(validateRecurrenceRule(rule2).isValid).toBe(true)

            const rule3 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 MONTHS ON LAST DAY' }
            expect(validateRecurrenceRule(rule3).isValid).toBe(true)

            const rule4 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 MONTHS ON 2ND TUESDAY' }
            expect(validateRecurrenceRule(rule4).isValid).toBe(true)
        })

        it('invalidates incorrect custom rules', () => {
            const rule1 = { pattern: RecurrencePattern.CUSTOM, customRule: '' }
            expect(validateRecurrenceRule(rule1).isValid).toBe(false)

            const rule2 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY DAY' }
            expect(validateRecurrenceRule(rule2).isValid).toBe(false)

            const rule3 = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 MONTH ON LAST DAY' } // Missing 'S' in MONTHS
            expect(validateRecurrenceRule(rule3).isValid).toBe(false)
        })
    })
})
