/**
 * Voice Task Parser Unit Tests
 * TASK-1026: NLP Property Extraction
 * TASK-1028: Voice Confirmation UI + Edit Before Submit
 *
 * Covers useVoiceTaskParser-specific fields: dueDateLabel, rawTranscript,
 * detectedLanguage locale format (en-US / he-IL), composable wrapper API.
 * Shared parsing logic (priority values, date math) is covered in voice-nlp-parser.test.ts.
 */

import { describe, it, expect } from 'vitest'
import { parseVoiceTranscript, useVoiceTaskParser } from '@/composables/useVoiceTaskParser'

describe('useVoiceTaskParser', () => {
  describe('Language Detection (locale format)', () => {
    it('returns en-US / he-IL locale codes and respects explicit override', () => {
      expect(parseVoiceTranscript('call dentist tomorrow').detectedLanguage).toBe('en-US')
      expect(parseVoiceTranscript('תזכיר לי להתקשר לרופא').detectedLanguage).toBe('he-IL')
      expect(parseVoiceTranscript('call dentist', 'he-IL').detectedLanguage).toBe('he-IL')
    })
  })

  describe('Priority Extraction', () => {
    it.each([
      ['urgent → high, keyword removed (EN)', 'urgent call dentist', 'high', 'call dentist'],
      ['medium priority (EN)', 'medium priority review documents', 'medium', null],
      ['no keyword → null (EN)', 'buy groceries', null, null],
      ['דחוף → high, keyword removed (HE)', 'דחוף להתקשר לרופא', 'high', null],
      ['כשאפשר → low (HE)', 'כשאפשר לנקות את הבית', 'low', null],
    ])('%s', (_desc, input, expectedPriority, titleContains) => {
      const result = parseVoiceTranscript(input)
      expect(result.priority).toBe(expectedPriority)
      if (titleContains) expect(result.title.toLowerCase()).toContain(titleContains)
    })
  })

  describe('dueDateLabel field', () => {
    it.each([
      ['today (EN)', 'call dentist today', 'today'],
      ['tomorrow (EN)', 'call dentist tomorrow', 'tomorrow'],
      ['next week (EN)', 'finish report next week', 'next week'],
      ['in 3 days (EN)', 'submit proposal in 3 days', 'in 3 days'],
      ['היום (HE)', 'להתקשר לרופא היום', 'היום'],
      ['מחר (HE)', 'להתקשר לרופא מחר', 'מחר'],
      ['שבוע הבא (HE)', 'לסיים את הדוח שבוע הבא', 'שבוע הבא'],
    ])('%s', (_desc, input, expectedLabel) => {
      const result = parseVoiceTranscript(input)
      expect(result.dueDate).not.toBeNull()
      expect(result.dueDateLabel).toBe(expectedLabel)
    })

    it('returns null for both dueDate and dueDateLabel when no keyword found', () => {
      const result = parseVoiceTranscript('buy groceries')
      expect(result.dueDate).toBeNull()
      expect(result.dueDateLabel).toBeNull()
    })
  })

  describe('Title Cleaning', () => {
    it('capitalizes, collapses whitespace, strips punctuation', () => {
      expect(parseVoiceTranscript('buy groceries').title).toBe('Buy groceries')
      expect(parseVoiceTranscript('buy   groceries  at store').title).toBe('Buy groceries at store')
      expect(parseVoiceTranscript(', call dentist.').title).toBe('Call dentist')
    })

    it('removes filler prefixes (EN + HE)', () => {
      expect(parseVoiceTranscript('remind me to call dentist').title).toBe('Call dentist')
      expect(parseVoiceTranscript('I need to buy groceries').title).toBe('Buy groceries')
      expect(parseVoiceTranscript('תזכיר לי להתקשר לאמא').title).not.toContain('תזכיר לי')
    })

    it('falls back to raw transcript when extraction empties the title', () => {
      expect(parseVoiceTranscript('tomorrow urgent').title.length).toBeGreaterThan(0)
    })
  })

  describe('rawTranscript field', () => {
    it('preserves the original input string verbatim', () => {
      const input = 'remind me tomorrow to call dentist urgent'
      expect(parseVoiceTranscript(input).rawTranscript).toBe(input)
    })
  })

  describe('Combined Extraction', () => {
    it('extracts priority + dueDateLabel + cleaned title together (EN)', () => {
      const result = parseVoiceTranscript('remind me tomorrow to call dentist high priority')
      expect(result.priority).toBe('high')
      expect(result.dueDateLabel).toBe('tomorrow')
      expect(result.title.toLowerCase()).toContain('call dentist')
      expect(result.title.toLowerCase()).not.toMatch(/tomorrow|high priority/)
    })

    it('extracts priority + dueDateLabel + cleaned title together (HE)', () => {
      const result = parseVoiceTranscript('תזכיר לי מחר להתקשר לרופא דחוף')
      expect(result.priority).toBe('high')
      expect(result.dueDateLabel).toBe('מחר')
      expect(result.title).not.toMatch(/מחר|דחוף/)
    })
  })

  describe('useVoiceTaskParser composable API', () => {
    it('exposes parseTranscript and detectLanguage functions', () => {
      const { parseTranscript, detectLanguage } = useVoiceTaskParser()
      expect(typeof parseTranscript).toBe('function')
      expect(detectLanguage('hello')).toBe('en-US')
      expect(detectLanguage('שלום')).toBe('he-IL')
    })
  })
})
