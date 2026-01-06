import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Configure marked for our needs
 */
marked.use({
    gfm: true,
    breaks: true,
    silent: true,
    renderer: {
        link({ href, title, text }) {
            return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`
        },
        list({ items, ordered, start }) {
            const tag = ordered ? 'ol' : 'ul'
            const isTask = items.some(item => (item as any).task)
            const classAttr = isTask ? ' class="task-list"' : ''
            const startAttr = ordered && start !== 1 ? ` start="${start}"` : ''

            let body = ''
            for (const item of items) {
                body += (this as any).listitem(item)
            }

            return `<${tag}${classAttr}${startAttr}>\n${body}</${tag}>\n`
        },
        // We'll let the container's dir="auto" handle the general layout 
        // to avoid individual blocks flipping unexpectedly
        listitem({ text, task, checked }) {
            if (task) {
                const checkedAttr = checked ? 'checked' : ''
                return `<li class="task-list-item" dir="auto"><input type="checkbox" class="md-checkbox" ${checkedAttr}> ${text}</li>\n`
            }
            return `<li dir="auto">${text}</li>\n`
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

        // Sanitize with checkbox support
        const sanitized = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['input'],
            ADD_ATTR: ['type', 'checked', 'class', 'disabled']
        })

        // Transform checkboxes to be interactive classes
        // 1. First, handle standard GFM checkboxes produced by marked
        let transformed = sanitized.replace(
            /<input[^>]+type=["' ]checkbox["' ][^>]*>/gi,
            (match) => {
                const isChecked = /\bchecked\b/i.test(match)
                return `<input type="checkbox" class="md-checkbox" ${isChecked ? 'checked' : ''}>`
            }
        )

        // 2. Then, handle standalone [ ] and [x] at the beginning of lines or after block tags
        // This is the "Live Preview" style parsing
        transformed = transformed.replace(
            /(<(?:p|li|h[1-6]|div)[^>]*>|(?:\r?\n)|^)\s*\[([ x])\]/gi,
            (match, prefix, state) => {
                const isChecked = state === 'x' || state === 'X'
                return `${prefix}<input type="checkbox" class="md-checkbox" ${isChecked ? 'checked' : ''}>`
            }
        )

        // 3. One more pass for cases where marked might have missed it or mixed it with text
        // Only match if it looks like a task (at start of string or after a newline/space)
        transformed = transformed.replace(
            /(^|\s)\[([ x])\](\s|$)/gi,
            (match, before, state, after) => {
                const isChecked = state === 'x' || state === 'X'
                return `${before}<input type="checkbox" class="md-checkbox" ${isChecked ? 'checked' : ''}>${after}`
            }
        )

        return transformed
    } catch (error) {
        console.error('Error parsing markdown:', error)
        return content // Fallback to raw text
    }
}
