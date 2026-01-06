import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Configure marked for our needs
 */
const renderer = new marked.Renderer()

// Custom renderer rules if needed
// e.g. for external links
renderer.link = ({ href, title, text }) => {
    return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
    silent: true
})

/**
 * Parses markdown into safe HTML
 */
export const parseMarkdown = (content: string): string => {
    if (!content) return ''

    try {
        const rawHtml = marked.parse(content) as string
        return DOMPurify.sanitize(rawHtml)
    } catch (error) {
        console.error('Error parsing markdown:', error)
        return content // Fallback to raw text
    }
}
