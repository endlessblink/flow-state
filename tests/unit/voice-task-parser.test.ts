/**
 * Voice Task Parser Unit Tests
 * TASK-1026: NLP Property Extraction
 * TASK-1028: Voice Confirmation UI + Edit Before Submit
 */

import { describe, it, expect } from 'vitest'
import { parseVoiceTranscript, useVoiceTaskParser } from '@/composables/useVoiceTaskParser'

describe('useVoiceTaskParser', () => {
  describe('Language Detection', () => {
    it('detects English text', () => {
      const result = parseVoiceTranscript('call dentist tomorrow')
      expect(result.detectedLanguage).toBe('en-US')
    })

    it('detects Hebrew text', () => {
      const result = parseVoiceTranscript('תזכיר לי להתקשר לרופא')
      expect(result.detectedLanguage).toBe('he-IL')
    })

    it('uses provided language when specified', () => {
      const result = parseVoiceTranscript('call dentist', 'he-IL')
      expect(result.detectedLanguage).toBe('he-IL')
    })
  })

  describe('Priority Extraction - English', () => {
    it('extracts "urgent" as high priority', () => {
      const result = parseVoiceTranscript('urgent call dentist')
      expect(result.priority).toBe('high')
      expect(result.title.toLowerCase()).toContain('call dentist')
      expect(result.title.toLowerCase()).not.toContain('urgent')
    })

    it('extracts "high priority" as high priority', () => {
      const result = parseVoiceTranscript('high priority fix the bug')
      expect(result.priority).toBe('high')
      expect(result.title.toLowerCase()).not.toContain('high priority')
    })

    it('extracts "important" as high priority', () => {
      const result = parseVoiceTranscript('important meeting with boss')
      expect(result.priority).toBe('high')
    })

    it('extracts "medium priority" as medium priority', () => {
      const result = parseVoiceTranscript('medium priority review documents')
      expect(result.priority).toBe('medium')
    })

    it('extracts "low priority" as low priority', () => {
      const result = parseVoiceTranscript('low priority organize desk')
      expect(result.priority).toBe('low')
    })

    it('extracts "when possible" as low priority', () => {
      const result = parseVoiceTranscript('when possible clean the garage')
      expect(result.priority).toBe('low')
    })

    it('returns null priority when no keywords found', () => {
      const result = parseVoiceTranscript('buy groceries')
      expect(result.priority).toBeNull()
    })
  })

  describe('Priority Extraction - Hebrew', () => {
    it('extracts "דחוף" as high priority', () => {
      const result = parseVoiceTranscript('דחוף להתקשר לרופא')
      expect(result.priority).toBe('high')
      expect(result.title).not.toContain('דחוף')
    })

    it('extracts "בעדיפות גבוהה" as high priority', () => {
      const result = parseVoiceTranscript('בעדיפות גבוהה לסיים את הפרויקט')
      expect(result.priority).toBe('high')
    })

    it('extracts "כשאפשר" as low priority', () => {
      const result = parseVoiceTranscript('כשאפשר לנקות את הבית')
      expect(result.priority).toBe('low')
    })
  })

  describe('Date Extraction - English', () => {
    it('extracts "today" as today\'s date', () => {
      const result = parseVoiceTranscript('call dentist today')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('today')

      const today = new Date()
      expect(result.dueDate?.getDate()).toBe(today.getDate())
    })

    it('extracts "tomorrow" as tomorrow\'s date', () => {
      const result = parseVoiceTranscript('call dentist tomorrow')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('tomorrow')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(result.dueDate?.getDate()).toBe(tomorrow.getDate())
    })

    it('extracts "next week" as date 7 days from now', () => {
      const result = parseVoiceTranscript('finish report next week')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('next week')

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      expect(result.dueDate?.getDate()).toBe(nextWeek.getDate())
    })

    it('extracts "in 3 days" as relative date', () => {
      const result = parseVoiceTranscript('submit proposal in 3 days')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('in 3 days')

      const expected = new Date()
      expected.setDate(expected.getDate() + 3)
      expect(result.dueDate?.getDate()).toBe(expected.getDate())
    })

    it('returns null date when no keywords found', () => {
      const result = parseVoiceTranscript('buy groceries')
      expect(result.dueDate).toBeNull()
      expect(result.dueDateLabel).toBeNull()
    })
  })

  describe('Date Extraction - Hebrew', () => {
    it('extracts "היום" as today\'s date', () => {
      const result = parseVoiceTranscript('להתקשר לרופא היום')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('היום')
    })

    it('extracts "מחר" as tomorrow\'s date', () => {
      const result = parseVoiceTranscript('להתקשר לרופא מחר')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('מחר')
    })

    it('extracts "שבוע הבא" as next week', () => {
      const result = parseVoiceTranscript('לסיים את הדוח שבוע הבא')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('שבוע הבא')
    })

    it('extracts "בעוד 5 ימים" as relative date', () => {
      const result = parseVoiceTranscript('להגיש הצעה בעוד 5 ימים')
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe('בעוד 5 ימים')
    })
  })

  describe('Filler Word Removal - English', () => {
    it('removes "remind me to" prefix', () => {
      const result = parseVoiceTranscript('remind me to call dentist')
      expect(result.title).toBe('Call dentist')
    })

    it('removes "I need to" prefix', () => {
      const result = parseVoiceTranscript('I need to buy groceries')
      expect(result.title).toBe('Buy groceries')
    })

    it('removes "please" from text', () => {
      const result = parseVoiceTranscript('please call mom')
      expect(result.title).toBe('Call mom')
    })
  })

  describe('Filler Word Removal - Hebrew', () => {
    it('removes "תזכיר לי ל" prefix', () => {
      const result = parseVoiceTranscript('תזכיר לי להתקשר לאמא')
      expect(result.title).not.toContain('תזכיר לי')
    })

    it('removes "צריך ל" prefix', () => {
      const result = parseVoiceTranscript('צריך לקנות מצרכים')
      expect(result.title).not.toContain('צריך ל')
    })
  })

  describe('Combined Extraction', () => {
    it('extracts priority, date, and title together (English)', () => {
      const result = parseVoiceTranscript('remind me tomorrow to call dentist high priority')
      expect(result.priority).toBe('high')
      expect(result.dueDateLabel).toBe('tomorrow')
      expect(result.title.toLowerCase()).toContain('call dentist')
      expect(result.title.toLowerCase()).not.toContain('tomorrow')
      expect(result.title.toLowerCase()).not.toContain('high priority')
    })

    it('extracts priority, date, and title together (Hebrew)', () => {
      const result = parseVoiceTranscript('תזכיר לי מחר להתקשר לרופא דחוף')
      expect(result.priority).toBe('high')
      expect(result.dueDateLabel).toBe('מחר')
      expect(result.title).not.toContain('מחר')
      expect(result.title).not.toContain('דחוף')
    })

    it('preserves raw transcript', () => {
      const input = 'remind me tomorrow to call dentist urgent'
      const result = parseVoiceTranscript(input)
      expect(result.rawTranscript).toBe(input)
    })
  })

  describe('Title Cleaning', () => {
    it('capitalizes first letter of title', () => {
      const result = parseVoiceTranscript('buy groceries')
      expect(result.title).toBe('Buy groceries')
    })

    it('removes extra whitespace', () => {
      const result = parseVoiceTranscript('buy   groceries  at store')
      expect(result.title).toBe('Buy groceries at store')
    })

    it('removes leading/trailing punctuation', () => {
      const result = parseVoiceTranscript(', call dentist.')
      expect(result.title).toBe('Call dentist')
    })

    it('falls back to raw transcript if title is empty after extraction', () => {
      const result = parseVoiceTranscript('tomorrow urgent')
      // After extracting "tomorrow" and "urgent", title might be empty
      // but should fall back to raw transcript
      expect(result.title.length).toBeGreaterThan(0)
    })
  })

  describe('useVoiceTaskParser composable', () => {
    it('returns parseTranscript function', () => {
      const { parseTranscript } = useVoiceTaskParser()
      expect(typeof parseTranscript).toBe('function')
    })

    it('returns detectLanguage function', () => {
      const { detectLanguage } = useVoiceTaskParser()
      expect(typeof detectLanguage).toBe('function')
      expect(detectLanguage('hello')).toBe('en-US')
      expect(detectLanguage('שלום')).toBe('he-IL')
    })
  })
})
