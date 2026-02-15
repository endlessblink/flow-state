/**
 * TASK-1324: Truncate long URLs for display while preserving the full URL for tooltips/copying.
 *
 * Detects URLs in text and replaces them with shortened display versions.
 * Example: "https://stackoverflow.com/questions/12345678/very-long-title-here"
 *       → "stackoverflow.com/questions/1234..."
 */

const URL_REGEX = /https?:\/\/[^\s]+/g

/**
 * Shorten a single URL string for display.
 * Strips protocol, truncates path to maxLength.
 */
export function truncateUrl(url: string, maxLength = 45): string {
  if (url.length <= maxLength) return url

  try {
    const parsed = new URL(url)
    // Strip protocol ("https://")
    const withoutProtocol = parsed.host + parsed.pathname + parsed.search + parsed.hash

    if (withoutProtocol.length <= maxLength) return withoutProtocol

    // Truncate with ellipsis
    return withoutProtocol.slice(0, maxLength - 1) + '…'
  } catch {
    // Not a valid URL, just truncate the string
    return url.slice(0, maxLength - 1) + '…'
  }
}

/**
 * Find URLs in a text string and replace them with truncated versions.
 * Non-URL text is preserved as-is.
 */
export function truncateUrlsInText(text: string, maxLength = 45): string {
  if (!text) return text
  return text.replace(URL_REGEX, (url) => truncateUrl(url, maxLength))
}
