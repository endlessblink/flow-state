import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Sanitize URL to prevent XSS via javascript:, data:, and other dangerous protocols
 * Returns the safe URL or null if the URL is unsafe
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'vbscript:', 'data:', 'file:', 'blob:'])

function sanitizeUrl(href: string | null | undefined): string | null {
  if (!href || typeof href !== 'string') return null

  // Normalize and trim
  const normalizedHref = href.trim().toLowerCase()

  // Check for blocked protocols BEFORE URL parsing (catches obfuscation)
  for (const blocked of BLOCKED_PROTOCOLS) {
    if (normalizedHref.startsWith(blocked) ||
      normalizedHref.includes('\n' + blocked) ||
      normalizedHref.includes('\r' + blocked) ||
      normalizedHref.includes('\t' + blocked)) {
      return null
    }
  }

  // Check for URL-encoded dangerous protocols
  try {
    const decoded = decodeURIComponent(href)
    const decodedLower = decoded.toLowerCase()
    if (decodedLower.startsWith('javascript:') ||
      decodedLower.startsWith('vbscript:') ||
      decodedLower.startsWith('data:')) {
      return null
    }
  } catch {
    // decodeURIComponent failed - URL might be malformed, allow URL parsing to handle it
  }

  try {
    const url = new URL(href, window.location.origin)

    // Explicit protocol allowlist check
    if (!SAFE_PROTOCOLS.has(url.protocol)) {
      return null
    }

    // Block protocol-relative URLs that could redirect to malicious sites
    if (href.startsWith('//')) {
      return null
    }

    return url.href
  } catch {
    // Invalid URL - return null for safety
    return null
  }
}

/**
 * Configure marked for our needs
 * IMPORTANT: For Tiptap compatibility, task lists must use data-type attributes
 */
marked.use({
  gfm: true,
  breaks: true,
  silent: true,
  renderer: {
    link({ href, title, text }) {
      // Sanitize URL to prevent XSS attacks
      const safeHref = sanitizeUrl(href)
      if (!safeHref) {
        // Unsafe URL - render as plain text instead of link
        return text
      }
      return `<a href="${safeHref}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`
    },
    list({ items, ordered, start }) {
      const tag = ordered ? 'ol' : 'ul'
      const isTask = items.some(item => (item as any).task)
      // For Tiptap: use data-type="taskList" instead of class
      const dataAttr = isTask ? ' data-type="taskList"' : ''
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : ''

      let body = ''
      for (const item of items) {
        body += (this as any).listitem(item)
      }

      return `<${tag}${dataAttr}${startAttr}>\n${body}</${tag}>\n`
    },
    // For Tiptap: task list items need data-type="taskItem" and data-checked attributes
    listitem({ text, task, checked }) {
      if (task) {
        // Tiptap TaskItem format: <li data-type="taskItem" data-checked="true/false">
        const checkedVal = checked ? 'true' : 'false'
        return `<li data-type="taskItem" data-checked="${checkedVal}"><label><input type="checkbox" ${checked ? 'checked' : ''}></label><div>${text}</div></li>\n`
      }
      return `<li>${text}</li>\n`
    }
  }
})

/**
 * Parses markdown into safe HTML
 */
export const parseMarkdown = (content: string): string => {
  if (!content) return ''

  try {
    // marked.parse is synchronous for strings in most environments
    const rawHtml = marked.parse(content) as string

    // Sanitize with checkbox support and Tiptap data attributes
    const sanitized = DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['input', 'mark'],
      ADD_ATTR: ['type', 'checked', 'class', 'disabled', 'data-type', 'data-checked']
    })

    // Convert ==highlight== syntax to <mark> for Tiptap's Highlight extension
    // This is a non-standard markdown extension commonly used in Obsidian and other editors
    const withHighlight = sanitized.replace(/==(.*?)==/g, '<mark>$1</mark>')

    return withHighlight
  } catch (error) {
    console.error('Error parsing markdown:', error)
    return content // Fallback to raw text
  }
}

/**
 * Convert HTML to Markdown (BUG-013 FIX)
 * Simple conversion for Tiptap output - handles common formatting
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let markdown = html

  // Sanitize first to prevent any XSS in the processing
  markdown = DOMPurify.sanitize(markdown)

  // BUG-276 FIX: Process TipTap TaskItem elements FIRST
  // TipTap structure: <li data-type="taskItem" data-checked="true/false"><label><input...></label><div>content</div></li>
  // Extract text from the <div> inside and convert based on data-checked attribute
  // Handle both attribute orders (data-type before data-checked and vice versa)
  markdown = markdown.replace(/<li[^>]*data-type=["']taskItem["'][^>]*data-checked=["']true["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi, '- [x] $1\n')
  markdown = markdown.replace(/<li[^>]*data-type=["']taskItem["'][^>]*data-checked=["']false["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi, '- [ ] $1\n')
  markdown = markdown.replace(/<li[^>]*data-checked=["']true["'][^>]*data-type=["']taskItem["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi, '- [x] $1\n')
  markdown = markdown.replace(/<li[^>]*data-checked=["']false["'][^>]*data-type=["']taskItem["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi, '- [ ] $1\n')

  // Remove any remaining checkbox inputs and labels (they've been processed above)
  markdown = markdown.replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
  markdown = markdown.replace(/<input[^>]*type=["']?checkbox["']?[^>]*>/gi, '')

  // Bold: <strong> or <b> -> **text**
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')

  // Italic: <em> or <i> -> *text*
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

  // Strikethrough: <s> or <del> -> ~~text~~
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
  markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')

  // Underline: <u> -> no standard markdown, keep as HTML for now
  // Some parsers support __text__ but it conflicts with bold
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>')

  // Highlight: <mark> -> ==text== (some markdown flavors support this)
  markdown = markdown.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==')

  // Tables: Convert HTML tables to markdown tables
  // This is a simplified conversion - handles basic tables
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[][] = []
    const headerMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)
    const bodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)

    // Process header
    if (headerMatch) {
      const headerRow = headerMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)
      if (headerRow) {
        const cells = headerRow[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || []
        rows.push(cells.map((cell: string) => cell.replace(/<th[^>]*>([\s\S]*?)<\/th>/i, '$1').replace(/<[^>]+>/g, '').trim()))
      }
    }

    // Process body rows
    const content = bodyMatch ? bodyMatch[1] : tableContent
    const bodyRows = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
    for (const row of bodyRows) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
      if (cells.length > 0) {
        rows.push(cells.map((cell: string) => cell.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i, '$1').replace(/<[^>]+>/g, '').trim()))
      }
    }

    if (rows.length === 0) return ''

    // Build markdown table
    const colCount = Math.max(...rows.map(r => r.length))
    let mdTable = '\n'

    // First row (header or first data row)
    mdTable += '| ' + rows[0].map(c => c || ' ').join(' | ') + ' |\n'
    // Separator
    mdTable += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n'
    // Remaining rows
    for (let i = 1; i < rows.length; i++) {
      mdTable += '| ' + rows[i].map(c => c || ' ').join(' | ') + ' |\n'
    }

    return mdTable
  })

  // Horizontal rule: <hr> -> ---
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, '\n---\n')

  // Links: <a href="url">text</a> -> [text](url)
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')

  // Code blocks: <pre><code> -> ```code```
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
  markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')

  // Inline code: <code> -> `text`
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

  // Headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')

  // List items: <li> -> - (task items with data-type="taskItem" already handled at top of function)
  // BUG-276 FIX: Only handle regular list items here, task items are processed earlier
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')

  // Remove list wrappers
  markdown = markdown.replace(/<\/?ul[^>]*>/gi, '')
  markdown = markdown.replace(/<\/?ol[^>]*>/gi, '')

  // Paragraphs: <p> -> text with newline
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')

  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')

  // Remove any remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ')
  markdown = markdown.replace(/&amp;/g, '&')
  markdown = markdown.replace(/&lt;/g, '<')
  markdown = markdown.replace(/&gt;/g, '>')
  markdown = markdown.replace(/&quot;/g, '"')
  markdown = markdown.replace(/&#39;/g, "'")

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.trim()

  return markdown
}

// Export sanitizeUrl for use in TiptapEditor link validation (BUG-014 FIX)
export { sanitizeUrl }
