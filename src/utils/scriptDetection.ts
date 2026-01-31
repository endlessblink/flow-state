/**
 * Script Detection Utility
 * BUG-1109: Fix Hebrew Voice Transcription (Multilingual)
 *
 * Detects script type from text using Unicode ranges.
 * Used by Groq Whisper to detect Arabic confusion and retry with Hebrew.
 */

export type ScriptType = 'hebrew' | 'arabic' | 'latin' | 'mixed'

/**
 * Detect script type from text using Unicode ranges
 *
 * Unicode Ranges:
 * - Hebrew: \u0590-\u05FF (Hebrew block)
 * - Arabic: \u0600-\u06FF (Arabic block)
 *
 * @param text - Text to analyze
 * @returns Detected script type
 */
export function detectScript(text: string): ScriptType {
  if (!text?.trim()) return 'latin'

  const hebrewCount = (text.match(/[\u0590-\u05FF]/g) || []).length
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length
  const total = hebrewCount + arabicCount

  if (total === 0) return 'latin'
  if (arabicCount / total > 0.3) return 'arabic' // >30% Arabic
  if (hebrewCount > 0) return 'hebrew'
  return 'latin'
}

/**
 * Check if text contains Arabic script
 * Convenience function for the retry logic
 */
export function containsArabicScript(text: string): boolean {
  return detectScript(text) === 'arabic'
}
