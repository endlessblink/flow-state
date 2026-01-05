import DOMPurify from 'dompurify'

/**
 * Sanitizes and highlights search matches in text safely.
 * Escapes HTML characters in the text to prevent XSS, then wraps matches in <mark> tags.
 *
 * @param text The text to search in
 * @param query The search query
 * @returns Safe HTML string with highlighted matches
 */
export const highlightMatchSafe = (text: string, query: string): string => {
  // Sanitize the text first to prevent XSS by escaping HTML entities
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  if (!query || !query.trim()) return escapedText

  // Escape regex special characters in the query
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${safeQuery})`, 'gi')

  // Apply highlighting. Since text is already escaped, adding <mark> is safe.
  // Note: This may break highlighting if the query matches part of an entity (e.g. "amp" in "&amp;")
  // but it guarantees security.
  return escapedText.replace(regex, '<mark>$1</mark>')
}

/**
 * Sanitizes HTML content generated from markdown, specifically allowing
 * checkbox inputs for task lists while stripping unsafe scripts.
 *
 * @param html The HTML string (output from marked)
 * @returns Sanitized HTML string
 */
export const sanitizeMarkdownHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['input'], // Allow input tags for checkboxes
    ADD_ATTR: ['type', 'checked', 'class', 'disabled'] // Allow necessary attributes
  })
}

/**
 * Processes markdown HTML to enable interactive checkboxes.
 * First sanitizes the HTML, then transforms checkboxes to be interactive.
 *
 * @param html The raw HTML from markdown parser
 * @returns Processed and sanitized HTML
 */
export const processMarkdownCheckboxes = (html: string): string => {
  const sanitized = sanitizeMarkdownHtml(html)

  // Add data attributes to checkboxes for interactivity
  // Replace checkbox inputs with clickable versions
  // Use a robust regex to find checkbox inputs regardless of attribute order
  return sanitized.replace(
    /<input[^>]*type="checkbox"[^>]*>/g,
    (match) => {
      const isChecked = match.includes('checked')
      return `<input type="checkbox" class="md-checkbox" ${isChecked ? 'checked' : ''}>`
    }
  )
}
