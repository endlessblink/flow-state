/**
 * Centralized emoji scheme for Storybook story organization
 * Ensures consistent visual hierarchy and ease of maintenance
 */

export const EMOJI = {
  // Documentation & Meta
  DOCS: '📖',
  DESIGN: '🎨',

  // Main Categories
  COMPONENTS: '🧩',
  OVERLAYS: '🎭',
  FEATURES: '✨',

  // Component Types
  BASE: '🔘',
  FORM: '📝',
  DISPLAY: '🏷️',
  LAYOUT: '📐',

  // Overlay Types
  MODAL: '🪟',
  MENU: '📋',
  POPUP: '💬',
  TOOLTIP: '💭',

  // Feature Views
  BOARD: '📋',
  CANVAS: '🎨',
  CALENDAR: '📅',
  TASKS: '✅',

  // Status Indicators (for tags)
  STABLE: '✅',
  BETA: '🧪',
  NEW: '🆕',
  DEPRECATED: '⚠️',
} as const

// Type-safe access to emoji values
export type EmojiKey = keyof typeof EMOJI

// Helper function for building story titles
export function buildStoryTitle(
  category: EmojiKey | EmojiKey[],
  subcategory?: EmojiKey | EmojiKey[],
  component?: string
): string {
  const parts: string[] = []

  // Add category
  if (Array.isArray(category)) {
    parts.push(category.map((c) => `${EMOJI[c]}`).join(' '))
  } else {
    parts.push(`${EMOJI[category]}`)
  }

  // Add subcategory
  if (subcategory) {
    if (Array.isArray(subcategory)) {
      parts.push(subcategory.map((s) => `${EMOJI[s]}`).join(' '))
    } else {
      parts.push(`${EMOJI[subcategory]}`)
    }
  }

  // Add component name
  if (component) {
    parts.push(component)
  }

  return parts.join('/')
}

export default EMOJI
