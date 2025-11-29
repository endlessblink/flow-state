/**
 * Emoji detection and feature detection utilities
 * Helps determine optimal rendering approach for emojis
 */

import { hasSvgRepresentation, hasColorfulSvgRepresentation } from './emojiSvgMap'

/**
 * Detect if the browser supports modern emoji rendering features
 */
export function detectEmojiSupport(): {
  supportsTwemoji: boolean
  supportsNativeEmoji: boolean
  supportsSvgRendering: boolean
  recommendedApproach: 'svg' | 'native' | 'mixed'
} {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      supportsTwemoji: false,
      supportsNativeEmoji: true,
      supportsSvgRendering: true,
      recommendedApproach: 'native'
    }
  }

  // Test basic emoji rendering
  const testEmoji = '📁'
  ctx.font = '14px system-ui'
  ctx.fillText(testEmoji, 0, 14)
  const imageData = ctx.getImageData(0, 0, 1, 1)

  const hasColorEmoji = imageData.data[3] > 0

  return {
    supportsTwemoji: typeof twemoji !== 'undefined',
    supportsNativeEmoji: hasColorEmoji,
    supportsSvgRendering: true,
    recommendedApproach: hasColorEmoji ? 'mixed' : 'svg'
  }
}

/**
 * Determine the best rendering approach for a specific emoji
 */
export function getEmojiRenderingStrategy(emoji: string): {
  shouldUseSvg: boolean
  shouldUseNative: boolean
  fallbackStrategy: 'native' | 'blank'
} {
  // If we have colorful SVG representation, let the component handle it
  // (Component will check hasColorfulSvgRepresentation independently)
  if (hasColorfulSvgRepresentation(emoji)) {
    return {
      shouldUseSvg: false, // Let colorful SVG take precedence
      shouldUseNative: true, // Keep native as fallback
      fallbackStrategy: 'native'
    }
  }

  // If we have regular SVG representation, prefer it for crispness
  if (hasSvgRepresentation(emoji)) {
    return {
      shouldUseSvg: true,
      shouldUseNative: true, // Keep native as fallback
      fallbackStrategy: 'native'
    }
  }

  // For rare emojis, use native rendering
  return {
    shouldUseSvg: false,
    shouldUseNative: true,
    fallbackStrategy: 'native'
  }
}

/**
 * Check if an emoji is likely to be well-supported across browsers
 */
export function isEmojiWellSupported(emoji: string): boolean {
  // Common emojis that have good browser support
  const wellSupportedEmojis = ['📁', '🎯', '💼', '🚀', '⭐', '🏠', '🪣', '✅', '❌', '⚠️', 'ℹ️']
  return wellSupportedEmojis.includes(emoji)
}

/**
 * Get emoji metadata for optimization decisions
 */
export function getEmojiMetadata(emoji: string) {
  return {
    emoji,
    hasSvg: hasSvgRepresentation(emoji),
    isCommon: isEmojiWellSupported(emoji),
    charCode: emoji.charCodeAt(0),
    isSurrogate: emoji.length > 1, // Detect surrogate pairs for complex emojis
    renderingStrategy: getEmojiRenderingStrategy(emoji)
  }
}