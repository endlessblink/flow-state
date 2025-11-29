/**
 * Hebrew Text Alignment Composable
 *
 * Provides Hebrew Unicode detection and right-alignment functionality
 * for dynamic text alignment in Vue 3 components.
 *
 * Features:
 * - Hebrew Unicode detection (\u0590-\u05FF)
 * - Dynamic class application (hebrew-text, text-align-right, direction-rtl)
 * - Force right-alignment for Hebrew content regardless of document direction
 * - Mixed text support: "משימה Task meeting" → right-aligned
 * - Real-time Hebrew detection and alignment as user types
 * - Works in both LTR and RTL document modes
 */

import { computed, ref, type Ref } from 'vue'

export function useHebrewAlignment() {
  // Hebrew Unicode range detection
  const HEBREW_UNICODE_RANGE = /[\u0590-\u05FF]/

  /**
   * Check if text contains any Hebrew characters
   * @param text - Text to check for Hebrew content
   * @returns boolean - True if Hebrew characters are detected
   */
  const containsHebrew = (text: string): boolean => {
    return HEBREW_UNICODE_RANGE.test(text)
  }

  /**
   * Determine if text should be right-aligned based on Hebrew content
   * @param text - Text to analyze
   * @returns boolean - True if text should be right-aligned
   */
  const shouldAlignRight = (text: string): boolean => {
    if (!text || text.trim() === '') return false
    return containsHebrew(text)
  }

  /**
   * Generate CSS classes for Hebrew text alignment
   * @param text - Text to analyze
   * @returns object - CSS classes object for dynamic binding
   */
  const getAlignmentClasses = (text: string) => {
    const hasHebrew = shouldAlignRight(text)

    return {
      'hebrew-text': hasHebrew,
      'text-align-right': hasHebrew,
      'direction-rtl': hasHebrew
    }
  }

  /**
   * Apply appropriate text alignment styles
   * @param text - Text to analyze
   * @returns object - Style object for inline styling
   */
  const applyInputAlignment = (text: string) => {
    const hasHebrew = shouldAlignRight(text)

    return {
      textAlign: (hasHebrew ? 'right' : 'left') as 'left' | 'right' | 'center' | 'justify',
      direction: (hasHebrew ? 'rtl' : 'ltr') as 'ltr' | 'rtl'
    }
  }

  /**
   * Reactive alignment based on text content
   * @param textRef - Vue ref containing text content
   * @returns computed object with reactive alignment properties
   */
  const createReactiveAlignment = (textRef: Ref<string>) => {
    return computed(() => {
      const text = textRef.value || ''
      const hasHebrew = shouldAlignRight(text)

      return {
        shouldAlignRight: hasHebrew,
        classes: {
          'hebrew-text': hasHebrew,
          'text-align-right': hasHebrew,
          'direction-rtl': hasHebrew
        },
        styles: {
          textAlign: hasHebrew ? 'right' : 'left',
          direction: hasHebrew ? 'rtl' : 'ltr'
        }
      }
    })
  }

  return {
    // Core functions
    containsHebrew,
    shouldAlignRight,

    // Style application
    getAlignmentClasses,
    applyInputAlignment,

    // Reactive helpers
    createReactiveAlignment
  }
}