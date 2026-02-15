/**
 * TASK-1325: URL detection utilities
 * Pure functions to detect and extract URLs from text.
 */

const URL_REGEX = /https?:\/\/[^\s]+/g

/**
 * Check if the entire input string is a URL (possibly with surrounding whitespace).
 */
export function isUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extract all URLs found in a text string.
 */
export function extractUrls(text: string): string[] {
  if (!text) return []
  const matches = text.match(URL_REGEX)
  return matches || []
}
