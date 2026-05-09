import { describe, it, expect } from 'vitest'
import { htmlToMarkdown, parseMarkdown } from '@/utils/markdown'

const countParagraphs = (html: string) => (html.match(/<p\b[^>]*>/gi) || []).length
const hasEmptyParagraph = (html: string) => /<p[^>]*>\s*<\/p>/i.test(html)

describe('markdown blank-line round-trip', () => {
  it('preserves a single blank line between two paragraphs', () => {
    const html = parseMarkdown(htmlToMarkdown('<p>First</p><p></p><p>Second</p>'))
    expect(countParagraphs(html)).toBe(3)
    expect(hasEmptyParagraph(html)).toBe(true)
  })

  it('caps consecutive blank-line paragraphs at one (matches editor UX)', () => {
    const html = parseMarkdown(htmlToMarkdown('<p>A</p><p></p><p></p><p>B</p>'))
    // Multi-blank input is normalised to a single visible blank line.
    expect(countParagraphs(html)).toBe(3)
    expect(hasEmptyParagraph(html)).toBe(true)
  })

  it('treats <p><br></p> as a blank-line paragraph', () => {
    const html = parseMarkdown(htmlToMarkdown('<p>A</p><p><br></p><p>B</p>'))
    expect(countParagraphs(html)).toBe(3)
    expect(hasEmptyParagraph(html)).toBe(true)
  })

  it('does not introduce blank lines for adjacent non-empty paragraphs', () => {
    const html = parseMarkdown(htmlToMarkdown('<p>A</p><p>B</p>'))
    expect(countParagraphs(html)).toBe(2)
    expect(hasEmptyParagraph(html)).toBe(false)
  })

  it('preserves Shift+Enter hard breaks within a paragraph', () => {
    const md = htmlToMarkdown('<p>Line1<br>Line2</p>')
    const html = parseMarkdown(md)
    expect(html).toMatch(/<br\s*\/?>/i)
  })

  it('round-trips the URL-pair case from the bug report', () => {
    const input =
      '<p>https://filmfreeway.com/tisff-2</p>' +
      '<p></p>' +
      '<p>https://drive.google.com/drive/folders/14F7h9nQ14d34pppFChMvwxQceeSW1ZXl</p>'
    const html = parseMarkdown(htmlToMarkdown(input))
    expect(countParagraphs(html)).toBe(3)
    expect(hasEmptyParagraph(html)).toBe(true)
    expect(html).toContain('filmfreeway.com/tisff-2')
    expect(html).toContain('14F7h9nQ14d34pppFChMvwxQceeSW1ZXl')
  })

  it('caps runaway blank lines at one visible blank between paragraphs', () => {
    const input = '<p>A</p>' + '<p></p>'.repeat(20) + '<p>B</p>'
    const md = htmlToMarkdown(input)
    // Pipeline collapses to at most 3 consecutive newlines
    expect(md).not.toMatch(/\n{4,}/)
  })
})
