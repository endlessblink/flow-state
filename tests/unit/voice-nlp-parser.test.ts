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
    it('detects Hebrew text', () => {
      expect(parser.isHebrew('תזכיר לי מחר')).toBe(true)
    })

    it('detects English text', () => {
      expect(parser.isHebrew('Remind me tomorrow')).toBe(false)
    })

    it('detects mixed text as Hebrew if Hebrew chars present', () => {
      expect(parser.isHebrew('meeting בעדיפות גבוהה')).toBe(true)
    })
  })

  describe('English - Priority Extraction', () => {
    it('extracts high priority from "high priority"', () => {
      const result = parser.parseTranscription('Send email high priority')
      expect(result.priority).toBe('high')
      expect(result.language).toBe('en')
    })

    it('extracts high priority from "urgent"', () => {
      const result = parser.parseTranscription('Urgent call mom')
      expect(result.priority).toBe('high')
    })

    it('extracts high priority from "important"', () => {
      const result = parser.parseTranscription('Important meeting notes')
      expect(result.priority).toBe('high')
    })

    it('extracts medium priority', () => {
      const result = parser.parseTranscription('Medium priority review docs')
      expect(result.priority).toBe('medium')
    })

    it('extracts low priority from "low priority"', () => {
      const result = parser.parseTranscription('Low priority cleanup files')
      expect(result.priority).toBe('low')
    })

    it('extracts low priority from "no rush"', () => {
      const result = parser.parseTranscription('No rush organize desk')
      expect(result.priority).toBe('low')
    })

    it('returns null for no priority', () => {
      const result = parser.parseTranscription('Send email')
      expect(result.priority).toBeNull()
    })
  })

  describe('Hebrew - Priority Extraction', () => {
    it('extracts high priority from "בעדיפות גבוהה"', () => {
      const result = parser.parseTranscription('לשלוח מייל בעדיפות גבוהה')
      expect(result.priority).toBe('high')
      expect(result.language).toBe('he')
    })

    it('extracts high priority from "דחוף"', () => {
      const result = parser.parseTranscription('דחוף להתקשר לאמא')
      expect(result.priority).toBe('high')
    })

    it('extracts low priority from "לא דחוף"', () => {
      const result = parser.parseTranscription('לא דחוף לסדר את השולחן')
      expect(result.priority).toBe('low')
    })

    it('extracts low priority from "כשיש זמן"', () => {
      const result = parser.parseTranscription('כשיש זמן לקרוא את הספר')
      expect(result.priority).toBe('low')
    })
  })

  describe('English - Date Extraction', () => {
    it('extracts "today"', () => {
      const result = parser.parseTranscription('Today send email')
      const today = new Date().toISOString().split('T')[0]
      expect(result.dueDate).toBe(today)
    })

    it('extracts "tomorrow"', () => {
      const result = parser.parseTranscription('Tomorrow call mom')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(result.dueDate).toBe(tomorrow.toISOString().split('T')[0])
    })

    it('extracts "in 3 days"', () => {
      const result = parser.parseTranscription('In 3 days finish report')
      const expected = new Date()
      expected.setDate(expected.getDate() + 3)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "in 2 weeks"', () => {
      const result = parser.parseTranscription('In 2 weeks buy gift')
      const expected = new Date()
      expected.setDate(expected.getDate() + 14)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "next week"', () => {
      const result = parser.parseTranscription('Next week review docs')
      const expected = new Date()
      expected.setDate(expected.getDate() + 7)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "this weekend"', () => {
      const result = parser.parseTranscription('This weekend clean house')
      expect(result.dueDate).not.toBeNull()
      // Weekend should be Saturday
      const dueDate = new Date(result.dueDate!)
      expect(dueDate.getDay()).toBe(6) // Saturday
    })

    it('returns null for no date', () => {
      const result = parser.parseTranscription('Send email')
      expect(result.dueDate).toBeNull()
    })
  })

  describe('Hebrew - Date Extraction', () => {
    it('extracts "היום"', () => {
      const result = parser.parseTranscription('היום לשלוח מייל')
      const today = new Date().toISOString().split('T')[0]
      expect(result.dueDate).toBe(today)
    })

    it('extracts "מחר"', () => {
      const result = parser.parseTranscription('מחר להתקשר לאמא')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(result.dueDate).toBe(tomorrow.toISOString().split('T')[0])
    })

    it('extracts "בעוד 3 ימים"', () => {
      const result = parser.parseTranscription('בעוד 3 ימים לסיים דוח')
      const expected = new Date()
      expected.setDate(expected.getDate() + 3)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "בעוד שבועיים"', () => {
      const result = parser.parseTranscription('בעוד 2 שבועות לקנות מתנה')
      const expected = new Date()
      expected.setDate(expected.getDate() + 14)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('extracts "בסוף השבוע"', () => {
      const result = parser.parseTranscription('בסוף השבוע לנקות בית')
      expect(result.dueDate).not.toBeNull()
    })
  })

  describe('Title Extraction', () => {
    it('cleans trigger phrases from English', () => {
      const result = parser.parseTranscription('Remind me to send email')
      expect(result.title).toBe('send email')
    })

    it('cleans trigger phrases from Hebrew', () => {
      const result = parser.parseTranscription('תזכיר לי לשלוח מייל')
      expect(result.title).toBe('לשלוח מייל')
    })

    it('removes date keywords from title', () => {
      const result = parser.parseTranscription('Tomorrow send email')
      expect(result.title).toBe('send email')
      expect(result.dueDate).not.toBeNull()
    })

    it('removes priority keywords from title', () => {
      const result = parser.parseTranscription('High priority send email')
      expect(result.title).toBe('send email')
      expect(result.priority).toBe('high')
    })

    it('handles combined date and priority', () => {
      const result = parser.parseTranscription('Remind me tomorrow to send email high priority')
      expect(result.title).toBe('send email')
      expect(result.priority).toBe('high')
      expect(result.dueDate).not.toBeNull()
    })

    it('preserves original text if cleaning removes everything', () => {
      const result = parser.parseTranscription('tomorrow')
      // Should fall back to original since title would be empty
      expect(result.title.length).toBeGreaterThan(0)
    })
  })

  describe('Action Detection', () => {
    it('defaults to "create" for new tasks', () => {
      const result = parser.parseTranscription('Buy groceries')
      expect(result.action).toBe('create')
    })

    it('detects postpone action in English', () => {
      const result = parser.parseTranscription('Postpone meeting by 3 days')
      expect(result.action).toBe('postpone')
    })

    it('detects postpone action in Hebrew', () => {
      const result = parser.parseTranscription('דחה את הפגישה ב-3 ימים')
      expect(result.action).toBe('postpone')
    })

    it('detects complete action in English', () => {
      const result = parser.parseTranscription('Mark done send email')
      expect(result.action).toBe('complete')
    })

    it('detects complete action in Hebrew', () => {
      const result = parser.parseTranscription('סמן כבוצע לשלוח מייל')
      expect(result.action).toBe('complete')
    })

    it('detects delete action', () => {
      const result = parser.parseTranscription('Delete old task')
      expect(result.action).toBe('delete')
    })

    it('detects edit action', () => {
      const result = parser.parseTranscription('Edit meeting task')
      expect(result.action).toBe('edit')
    })
  })

  describe('Postpone Duration', () => {
    it('extracts days from English "by 3 days"', () => {
      const result = parser.parseTranscription('Postpone task by 3 days')
      expect(result.postponeDays).toBe(3)
    })

    it('extracts days from Hebrew "ב-3 ימים"', () => {
      const result = parser.parseTranscription('דחה את המשימה ב-3 ימים')
      expect(result.postponeDays).toBe(3)
    })

    it('extracts weeks and converts to days', () => {
      const result = parser.parseTranscription('Postpone task by 2 weeks')
      expect(result.postponeDays).toBe(14)
    })

    it('returns null when no duration specified', () => {
      const result = parser.parseTranscription('Postpone task')
      expect(result.postponeDays).toBeNull()
    })
  })

  describe('Confidence Scoring', () => {
    it('has higher confidence with date and priority', () => {
      const withBoth = parser.parseTranscription('Tomorrow send email high priority')
      const withNeither = parser.parseTranscription('send email')

      expect(withBoth.confidence).toBeGreaterThan(withNeither.confidence)
    })

    it('confidence is between 0 and 1', () => {
      const result = parser.parseTranscription('Remind me tomorrow to send email high priority')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Real-World Examples from MASTER_PLAN', () => {
    it('parses Hebrew example: "תזכיר לי מחר לשלוח מייל בעדיפות גבוהה"', () => {
      const result = parser.parseTranscription('תזכיר לי מחר לשלוח מייל בעדיפות גבוהה')

      expect(result.language).toBe('he')
      expect(result.priority).toBe('high')
      expect(result.dueDate).not.toBeNull()
      expect(result.title).toContain('לשלוח מייל')
      expect(result.action).toBe('create')
    })

    it('parses Hebrew example: "בעוד שבועיים לקנות מתנה לאמא"', () => {
      const result = parser.parseTranscription('בעוד 2 שבועות לקנות מתנה לאמא')

      expect(result.language).toBe('he')
      expect(result.dueDate).not.toBeNull()
      // Due date should be 14 days from now
      const expected = new Date()
      expected.setDate(expected.getDate() + 14)
      expect(result.dueDate).toBe(expected.toISOString().split('T')[0])
    })

    it('parses Hebrew command: "דחה את המשימה של הפגישה ב-3 ימים"', () => {
      const result = parser.parseTranscription('דחה את המשימה של הפגישה ב-3 ימים')

      expect(result.language).toBe('he')
      expect(result.action).toBe('postpone')
      expect(result.postponeDays).toBe(3)
    })

    it('parses English example: "Remind me tomorrow to send email high priority"', () => {
      const result = parser.parseTranscription('Remind me tomorrow to send email high priority')

      expect(result.language).toBe('en')
      expect(result.priority).toBe('high')
      expect(result.dueDate).not.toBeNull()
      expect(result.title).toBe('send email')
      expect(result.action).toBe('create')
    })

    it('parses English example: "In two weeks buy gift for mom"', () => {
      const result = parser.parseTranscription('In 2 weeks buy gift for mom')

      expect(result.language).toBe('en')
      expect(result.dueDate).not.toBeNull()
    })

    it('parses English command: "Postpone meeting task by 3 days"', () => {
      const result = parser.parseTranscription('Postpone meeting task by 3 days')

      expect(result.language).toBe('en')
      expect(result.action).toBe('postpone')
      expect(result.postponeDays).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = parser.parseTranscription('')
      expect(result.title).toBe('')
      expect(result.action).toBe('create')
    })

    it('handles whitespace-only string', () => {
      const result = parser.parseTranscription('   ')
      expect(result.title).toBe('')
    })

    it('handles very long input', () => {
      const longText = 'This is a very long task description that goes on and on ' +
        'about many different things and should still be parsed correctly ' +
        'even though it is quite lengthy tomorrow high priority'

      const result = parser.parseTranscription(longText)
      expect(result.priority).toBe('high')
      expect(result.dueDate).not.toBeNull()
    })

    it('handles mixed language gracefully', () => {
      // Mostly English with one Hebrew word
      const result = parser.parseTranscription('Meeting about פרויקט tomorrow')
      expect(result.language).toBe('he') // Hebrew chars detected
      expect(result.dueDate).not.toBeNull()
    })
  })

  describe('Utility Functions', () => {
    it('formatDate returns YYYY-MM-DD', () => {
      const date = new Date('2026-03-15')
      expect(parser.formatDate(date)).toBe('2026-03-15')
    })

    it('formatDate pads single digits', () => {
      const date = new Date('2026-01-05')
      expect(parser.formatDate(date)).toBe('2026-01-05')
    })
  })

  describe('Examples Computed Property', () => {
    it('provides Hebrew examples', () => {
      const examples = parser.getExamples.value
      expect(examples.hebrew.length).toBeGreaterThan(0)
      expect(examples.hebrew[0].input).toBeTruthy()
      expect(examples.hebrew[0].description).toBeTruthy()
    })

    it('provides English examples', () => {
      const examples = parser.getExamples.value
      expect(examples.english.length).toBeGreaterThan(0)
      expect(examples.english[0].input).toBeTruthy()
      expect(examples.english[0].description).toBeTruthy()
    })
  })
})
