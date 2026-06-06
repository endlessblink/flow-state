import { describe, it, expect } from 'vitest'
import { detectExpectedLanguageMismatch, resolveChatOutputLanguage } from '@/composables/useAIChat'

describe('AI chat message language override', () => {
  it.each([
    ['en', 'auto', 'en'],
    ['he', 'auto', 'he'],
    ['he', 'en', 'en'],
    ['en', 'he', 'he'],
  ] as const)('resolves detected=%s setting=%s to %s', (detected, setting, expected) => {
    expect(resolveChatOutputLanguage(detected, setting)).toBe(expected)
  })

  it('detects mismatch against selected output language, not input language', () => {
    expect(detectExpectedLanguageMismatch('en', 'שלום וברכה')).toBe(true)
    expect(detectExpectedLanguageMismatch('he', 'Hello there')).toBe(true)
    expect(detectExpectedLanguageMismatch('he', 'שלום וברכה')).toBe(false)
    expect(detectExpectedLanguageMismatch('en', 'Hello there')).toBe(false)
  })

  it('does not flag unknown/non-linguistic output as a mismatch', () => {
    expect(detectExpectedLanguageMismatch('he', '12345')).toBe(false)
  })
})
