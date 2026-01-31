/**
 * Unit tests for script detection utility
 * BUG-1109: Fix Hebrew Voice Transcription (Multilingual)
 */

import { describe, it, expect } from 'vitest'
import { detectScript, containsArabicScript } from '../../src/utils/scriptDetection'

describe('scriptDetection', () => {
  describe('detectScript', () => {
    it('should return latin for empty or whitespace-only text', () => {
      expect(detectScript('')).toBe('latin')
      expect(detectScript('   ')).toBe('latin')
      expect(detectScript(null as unknown as string)).toBe('latin')
      expect(detectScript(undefined as unknown as string)).toBe('latin')
    })

    it('should return latin for pure English text', () => {
      expect(detectScript('Hello world')).toBe('latin')
      expect(detectScript('Create a meeting tomorrow at 3pm')).toBe('latin')
      expect(detectScript('The quick brown fox jumps over the lazy dog')).toBe('latin')
    })

    it('should return hebrew for pure Hebrew text', () => {
      expect(detectScript('שלום עולם')).toBe('hebrew')
      expect(detectScript('צור פגישה מחר')).toBe('hebrew')
      expect(detectScript('מה המצב היום')).toBe('hebrew')
    })

    it('should return arabic for pure Arabic text', () => {
      expect(detectScript('مرحبا بالعالم')).toBe('arabic')
      expect(detectScript('السلام عليكم')).toBe('arabic')
    })

    it('should return hebrew for mixed Hebrew + English (less than 30% Arabic)', () => {
      // Hebrew with English words
      expect(detectScript('Call דני tomorrow')).toBe('hebrew')
      expect(detectScript('Meeting עם שרה at 3pm')).toBe('hebrew')
      expect(detectScript('שלום hello')).toBe('hebrew')
    })

    it('should return arabic when Arabic exceeds 30% threshold', () => {
      // More than 30% Arabic characters
      expect(detectScript('مرحبا שלום مرحبا')).toBe('arabic')
    })

    it('should handle mixed scripts correctly', () => {
      // Mostly Hebrew with some English
      expect(detectScript('תזכורת: check email')).toBe('hebrew')
      // Pure Latin with numbers/punctuation
      expect(detectScript('Meeting at 3:00 PM!')).toBe('latin')
    })
  })

  describe('containsArabicScript', () => {
    it('should return true for Arabic text', () => {
      expect(containsArabicScript('مرحبا')).toBe(true)
    })

    it('should return false for Hebrew text', () => {
      expect(containsArabicScript('שלום')).toBe(false)
    })

    it('should return false for English text', () => {
      expect(containsArabicScript('Hello world')).toBe(false)
    })

    it('should return false for empty text', () => {
      expect(containsArabicScript('')).toBe(false)
    })
  })
})
