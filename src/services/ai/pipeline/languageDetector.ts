/**
 * Deterministic Language Detector for AI Chat Pipeline
 *
 * Detects language of text using Unicode range analysis.
 * No LLM calls — purely deterministic.
 *
 * Used by the pipeline to:
 * 1. Detect user's input language (pre-processing)
 * 2. Detect if LLM response matches user's language (post-processing)
 *
 * @see TASK-1376 in MASTER_PLAN.md
 */

import type { DetectedLanguage } from './types'

/** Hebrew Unicode range (same as useHebrewAlignment.ts and useVoiceTaskParser.ts) */
const HEBREW_RANGE = /[\u0590-\u05FF]/g

/** Latin character range (ASCII + extended Latin) */
const LATIN_RANGE = /[a-zA-Z\u00C0-\u024F]/g

/**
 * Detect the primary language of a text string.
 *
 * Uses character ratio analysis — counts Hebrew vs Latin characters
 * and returns whichever dominates. If neither is present or they're
 * roughly equal, returns 'unknown'.
 *
 * @param text - Text to analyze
 * @returns Detected language: 'en', 'he', or 'unknown'
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) return 'unknown'

  // Strip markdown, URLs, code blocks, and common non-language tokens
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')      // code blocks
    .replace(/`[^`]+`/g, '')              // inline code
    .replace(/https?:\/\/\S+/g, '')       // URLs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-/g, '') // UUIDs
    .replace(/\d+/g, '')                  // numbers
    .replace(/[^\p{L}\s]/gu, '')          // keep only letters and spaces
    .trim()

  if (cleaned.length === 0) return 'unknown'

  const hebrewChars = (cleaned.match(HEBREW_RANGE) || []).length
  const latinChars = (cleaned.match(LATIN_RANGE) || []).length
  const totalSignificant = hebrewChars + latinChars

  if (totalSignificant === 0) return 'unknown'

  const hebrewRatio = hebrewChars / totalSignificant

  // Thresholds: >60% Hebrew = Hebrew, <40% Hebrew = English, else unknown
  if (hebrewRatio > 0.6) return 'he'
  if (hebrewRatio < 0.4) return 'en'
  return 'unknown'
}

/**
 * Detect if two texts are in different languages.
 *
 * Used to check if LLM response matches user's input language.
 * Returns true if there's a clear mismatch (e.g., user wrote English,
 * LLM responded in Hebrew).
 *
 * @param inputText - User's original input
 * @param outputText - LLM's response
 * @returns true if languages clearly mismatch
 */
export function detectLanguageMismatch(inputText: string, outputText: string): boolean {
  const inputLang = detectLanguage(inputText)
  const outputLang = detectLanguage(outputText)

  // Only flag mismatch when BOTH are clearly detected and different
  if (inputLang === 'unknown' || outputLang === 'unknown') return false
  return inputLang !== outputLang
}

/**
 * Check if text contains Hebrew characters.
 * Simple boolean check, faster than full detectLanguage().
 */
export function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text)
}

/**
 * Get the dominant text direction for a language.
 */
export function getTextDirection(lang: DetectedLanguage): 'ltr' | 'rtl' {
  return lang === 'he' ? 'rtl' : 'ltr'
}
