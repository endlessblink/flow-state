/**
 * Unit tests for useVoiceNLPParser
 * TASK-1026: Task Property Extraction (NLP)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useVoiceNLPParser } from '../../src/composables/useVoiceNLPParser'

describe('useVoiceNLPParser', () => {
  let parser: ReturnType<typeof useVoiceNLPParser>

  beforeEach(() => {
    parser = useVoiceNLPParser()
  })

  describe('Language Detection', () => {
    it('identifies Hebrew vs English text', () => {
      expect(parser.isHebrew('תזכיר לי מחר')).toBe(true)
      expect(parser.isHebrew('Remind me tomorrow')).toBe(false)
      expect(parser.isHebrew('meeting בעדיפות גבוהה')).toBe(true)
    })
  })

  describe('Priority Extraction', () => {
    it.each([
      ['urgent/high priority (EN)', 'Urgent call mom', 'high'],
      ['medium priority (EN)', 'Medium priority review docs', 'medium'],
      ['no rush → low (EN)', 'No rush organize desk', 'low'],
      ['no priority keyword (EN)', 'Send email', null],
      ['דחוף → high (HE)', 'דחוף להתקשר לאמא', 'high'],
      ['כשיש זמן → low (HE)', 'כשיש זמן לקרוא את הספר', 'low'],
    ])('%s', (_desc, input, expected) => {
      expect(parser.parseTranscription(input).priority).toBe(expected)
    })

    it('sets correct language tag on result', () => {
      expect(parser.parseTranscription('Send email high priority').language).toBe('en')
      expect(parser.parseTranscription('לשלוח מייל בעדיפות גבוהה').language).toBe('he')
    })
  })

  describe('Date Extraction', () => {
    it.each([
      ['today (EN)', 'Today send email', 0],
      ['tomorrow (EN)', 'Tomorrow call mom', 1],
      ['in 3 days (EN)', 'In 3 days finish report', 3],
      ['next week (EN)', 'Next week review docs', 7],
      ['in 2 weeks (EN)', 'In 2 weeks buy gift', 14],
      ['היום (HE)', 'היום לשלוח מייל', 0],
      ['מחר (HE)', 'מחר להתקשר לאמא', 1],
      ['בעוד 3 ימים (HE)', 'בעוד 3 ימים לסיים דוח', 3],
      ['בעוד 2 שבועות (HE)', 'בעוד 2 שבועות לקנות מתנה', 14],
    ])('extracts %s', (_desc, input, daysOffset) => {
      const result = parser.parseTranscription(input)
      const expected = new Date()
      expected.setDate(expected.getDate() + daysOffset)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "this weekend" as Saturday', () => {
      const result = parser.parseTranscription('This weekend clean house')
      expect(result.dueDate).not.toBeNull()
      expect(new Date(result.dueDate!).getDay()).toBe(6)
    })

    it('returns null when no date keyword present', () => {
      expect(parser.parseTranscription('Send email').dueDate).toBeNull()
    })
  })

  describe('Title Extraction', () => {
    it('strips trigger phrases and extracts remaining text', () => {
      expect(parser.parseTranscription('Remind me to send email').title).toBe('send email')
      expect(parser.parseTranscription('תזכיר לי לשלוח מייל').title).toBe('לשלוח מייל')
    })

    it('removes date + priority keywords and populates both fields', () => {
      const result = parser.parseTranscription('Remind me tomorrow to send email high priority')
      expect(result.title).toBe('send email')
      expect(result.priority).toBe('high')
      expect(result.dueDate).not.toBeNull()
    })

    it('falls back to original text when cleaning empties the title', () => {
      expect(parser.parseTranscription('tomorrow').title.length).toBeGreaterThan(0)
    })
  })

  describe('Action Detection', () => {
    it.each([
      ['create (default)', 'Buy groceries', 'create'],
      ['postpone (EN)', 'Postpone meeting by 3 days', 'postpone'],
      ['postpone (HE)', 'דחה את הפגישה ב-3 ימים', 'postpone'],
      ['complete (EN)', 'Mark done send email', 'complete'],
      ['delete', 'Delete old task', 'delete'],
    ])('detects %s', (_desc, input, expected) => {
      expect(parser.parseTranscription(input).action).toBe(expected)
    })
  })

  describe('Postpone Duration', () => {
    it('parses days and weeks into day count', () => {
      expect(parser.parseTranscription('Postpone task by 3 days').postponeDays).toBe(3)
      expect(parser.parseTranscription('Postpone task by 2 weeks').postponeDays).toBe(14)
      expect(parser.parseTranscription('דחה את המשימה ב-3 ימים').postponeDays).toBe(3)
      expect(parser.parseTranscription('Postpone task').postponeDays).toBeNull()
    })
  })

  describe('Confidence Scoring', () => {
    it('is higher with date+priority than without, and stays within [0,1]', () => {
      const withBoth = parser.parseTranscription('Tomorrow send email high priority')
      const withNeither = parser.parseTranscription('send email')
      expect(withBoth.confidence).toBeGreaterThan(withNeither.confidence)
      expect(withBoth.confidence).toBeGreaterThanOrEqual(0)
      expect(withBoth.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty and whitespace-only input', () => {
      expect(parser.parseTranscription('').title).toBe('')
      expect(parser.parseTranscription('   ').title).toBe('')
      expect(parser.parseTranscription('').action).toBe('create')
    })

    it('handles mixed-language input', () => {
      const result = parser.parseTranscription('Meeting about פרויקט tomorrow')
      expect(result.language).toBe('he')
      expect(result.dueDate).not.toBeNull()
    })
  })

  describe('Utility Functions', () => {
    it('formatDate returns YYYY-MM-DD with zero-padded digits', () => {
      expect(parser.formatDate(new Date('2026-03-15'))).toBe('2026-03-15')
      expect(parser.formatDate(new Date('2026-01-05'))).toBe('2026-01-05')
    })
  })

  describe('Examples Computed Property', () => {
    it('provides non-empty Hebrew and English example arrays with required fields', () => {
      const examples = parser.getExamples.value
      expect(examples.hebrew.length).toBeGreaterThan(0)
      expect(examples.english.length).toBeGreaterThan(0)
      expect(examples.hebrew[0].input).toBeTruthy()
      expect(examples.english[0].input).toBeTruthy()
    })
  })
})
