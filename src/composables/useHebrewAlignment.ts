import { computed, ref } from 'vue'

/**
 * Composable for detecting and handling Hebrew text alignment
 *
 * Provides utilities to:
 * - Detect Hebrew characters in text
 * - Apply right-alignment for Hebrew content
 * - Handle mixed Hebrew/English text consistently
 * - Force right-alignment regardless of document direction
 */
export function useHebrewAlignment() {
  // Hebrew Unicode range detection
  const HEBREW_UNICODE_REGEX = /[\u0590-\u05FF]/

  /**
   * Detect if text contains Hebrew characters
   */
  const containsHebrew = (text: string): boolean => {
    if (!text || typeof text !== 'string') return false
    return HEBREW_UNICODE_REGEX.test(text)
  }

  /**
   * Determine if text should be right-aligned
   * Returns true if text contains Hebrew characters
   */
  const shouldAlignRight = (text: string): boolean => {
    return containsHebrew(text)
  }

  /**
   * Generate CSS classes for Hebrew text alignment
   */
  const getHebrewTextClasses = (text: string): Record<string, boolean> => {
    return {
      'hebrew-text': shouldAlignRight(text),
      'text-align-right': shouldAlignRight(text),
      'direction-rtl': shouldAlignRight(text)
    }
  }

  /**
   * Get text alignment style for Hebrew content
   */
  const getTextAlignment = (text: string): 'right' | 'start' => {
    return shouldAlignRight(text) ? 'right' : 'start'
  }

  /**
   * Get text direction for Hebrew content
   */
  const getTextDirection = (text: string): 'rtl' | 'auto' => {
    return shouldAlignRight(text) ? 'rtl' : 'auto'
  }

  /**
   * Reactive version for dynamic text content
   */
  const createHebrewAlignment = (text: () => string) => {
    return computed(() => {
      const currentText = text()
      return {
        containsHebrew: containsHebrew(currentText),
        shouldAlignRight: shouldAlignRight(currentText),
        textAlignment: getTextAlignment(currentText),
        textDirection: getTextDirection(currentText),
        classes: getHebrewTextClasses(currentText)
      }
    })
  }

  /**
   * Apply Hebrew alignment to input element
   */
  const applyInputAlignment = (element: HTMLElement, text: string): void => {
    if (!element) return

    if (shouldAlignRight(text)) {
      element.style.textAlign = 'right'
      element.style.direction = 'rtl'
    } else {
      element.style.textAlign = ''
      element.style.direction = ''
    }
  }

  /**
   * Force right-alignment for Hebrew content in any context
   * This overrides the document direction when Hebrew is detected
   */
  const forceHebrewAlignment = (text: string) => {
    return {
      style: shouldAlignRight(text) ? {
        textAlign: 'right',
        direction: 'rtl'
      } : {},
      class: shouldAlignRight(text) ? 'hebrew-content' : ''
    }
  }

  return {
    // Detection methods
    containsHebrew,
    shouldAlignRight,

    // Style generation
    getHebrewTextClasses,
    getTextAlignment,
    getTextDirection,
    forceHebrewAlignment,

    // Reactive helpers
    createHebrewAlignment,

    // DOM manipulation
    applyInputAlignment
  }
}