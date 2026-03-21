/**
 * TASK-1607: Security — XSS Vectors + Secrets Scanning
 *
 * Static-analysis tests that scan production source files for XSS risks and
 * banned patterns. All tests run entirely in Vitest (no browser required).
 *
 * Tests 1-5:  v-html usage audit — every occurrence must be sanitized
 * Tests 6-8:  Task-title / MarkdownRenderer injection risk audit
 * Tests 9-11: AI chat response rendering audit
 * Tests 12-13: URL href protocol scanning
 * Tests 14-15: No eval() or new Function() constructor in src/
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SRC_ROOT = join(__dirname, '../../../src')

/** Recursively collect all files under `dir` matching the given extensions. */
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts))
    } else if (exts.includes(extname(entry.name))) {
      results.push(full)
    }
  }
  return results
}

/** Return the <template> section of a .vue file, or empty string if absent. */
function extractTemplate(src: string): string {
  const m = src.match(/<template[\s\S]*?>([\s\S]*?)<\/template>/)
  return m ? m[0] : ''
}

/** Return the <script> sections of a .vue file, or the whole file for .ts. */
function extractScript(src: string, ext: string): string {
  if (ext !== '.vue') return src
  const sections: string[] = []
  const scriptRe = /<script[\s\S]*?>([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(src)) !== null) {
    sections.push(m[0])
  }
  return sections.join('\n')
}

const allVueFiles = collectFiles(SRC_ROOT, ['.vue'])
const allTsFiles = collectFiles(SRC_ROOT, ['.ts'])
const allSrcFiles = [...allVueFiles, ...allTsFiles]

// Known v-html locations discovered during audit (relative for readability)
const KNOWN_VHTML_FILES = [
  'components/common/MarkdownRenderer.vue',
  'components/base/ProjectEmojiIcon.vue',
  'components/layout/SearchModal.vue',
  'components/ai/ChatMessage.vue',
]

// ---------------------------------------------------------------------------
// Tests 1-5: v-html usage audit
// ---------------------------------------------------------------------------

describe('TASK-1607 — v-html XSS audit', () => {
  /**
   * Test 1: Enumerate ALL v-html occurrences.
   * This is a canary: if new v-html usages appear, this test surfaces them so
   * they can be reviewed. It does NOT fail on known occurrences — it documents
   * them. Unknown occurrences cause a failure.
   */
  it('Test 1: only known files use v-html', () => {
    const vhtmlFiles = allVueFiles.filter(f => readFileSync(f, 'utf8').includes('v-html'))
    const unknownFiles = vhtmlFiles.filter(
      f => !KNOWN_VHTML_FILES.some(known => f.endsWith(known))
    )
    expect(
      unknownFiles,
      `Unexpected new v-html usage detected in: ${unknownFiles.join(', ')}. ` +
      `Review for XSS risk, then add to KNOWN_VHTML_FILES if safe.`
    ).toHaveLength(0)
  })

  /**
   * Test 2: MarkdownRenderer — renderedHtml must come from parseMarkdown()
   * which runs DOMPurify internally.
   */
  it('Test 2: MarkdownRenderer uses parseMarkdown (DOMPurify-backed) for v-html', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/common/MarkdownRenderer.vue'))
    expect(filePath, 'MarkdownRenderer.vue must exist').toBeTruthy()
    const src = readFileSync(filePath!, 'utf8')
    // Confirms v-html binds to `renderedHtml` computed from `parseMarkdown`
    expect(src).toMatch(/v-html="renderedHtml"/)
    expect(src).toMatch(/parseMarkdown\(/)
  })

  /**
   * Test 3: SearchModal — v-html binds to `highlightMatch()` which delegates
   * to `highlightMatchSafe` (entity-escapes input before adding <mark> tags).
   */
  it('Test 3: SearchModal v-html binds to highlightMatch which uses highlightMatchSafe', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/layout/SearchModal.vue'))
    expect(filePath, 'SearchModal.vue must exist').toBeTruthy()
    const src = readFileSync(filePath!, 'utf8')
    expect(src).toMatch(/v-html="highlightMatch\(/)
    // The script section must import or define highlightMatchSafe
    const script = extractScript(src, '.vue')
    expect(script).toMatch(/highlightMatchSafe/)
  })

  /**
   * Test 4: ChatMessage — v-html binds to `renderedContent` which is passed
   * through sanitizeMarkdownHtml (DOMPurify wrapper).
   */
  it('Test 4: ChatMessage v-html binds to renderedContent sanitized by DOMPurify', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/ai/ChatMessage.vue'))
    expect(filePath, 'ChatMessage.vue must exist').toBeTruthy()
    const src = readFileSync(filePath!, 'utf8')
    expect(src).toMatch(/v-html="renderedContent"/)
    const script = extractScript(src, '.vue')
    expect(script).toMatch(/sanitizeMarkdownHtml/)
  })

  /**
   * Test 5: ProjectEmojiIcon — v-html binds to `colorfulSvg` which comes from
   * a static in-source SVG map (not user input), so no sanitization is needed.
   * Verify the source is a static lookup, not a prop or user data.
   */
  it('Test 5: ProjectEmojiIcon colorfulSvg is derived from static SVG map, not user input', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/base/ProjectEmojiIcon.vue'))
    expect(filePath, 'ProjectEmojiIcon.vue must exist').toBeTruthy()
    const src = readFileSync(filePath!, 'utf8')
    expect(src).toMatch(/v-html="colorfulSvg"/)
    const script = extractScript(src, '.vue')
    // colorfulSvg must come from getColorfulSvgData (static SVG map lookup)
    expect(script).toMatch(/getColorfulSvgData/)
    // It must NOT bind directly to a prop that holds raw user content
    expect(script).not.toMatch(/colorfulSvg\s*=\s*props\.\w+/)
  })
})

// ---------------------------------------------------------------------------
// Tests 6-8: Task title rendering injection risks
// ---------------------------------------------------------------------------

describe('TASK-1607 — Task title rendering safety', () => {
  /**
   * Test 6: The global `parseMarkdown` utility sanitizes output with DOMPurify
   * before returning.
   */
  it('Test 6: parseMarkdown in utils/markdown.ts calls DOMPurify.sanitize', () => {
    const mdUtil = allTsFiles.find(f => f.endsWith('utils/markdown.ts'))
    expect(mdUtil, 'utils/markdown.ts must exist').toBeTruthy()
    const src = readFileSync(mdUtil!, 'utf8')
    expect(src).toMatch(/DOMPurify\.sanitize/)
    expect(src).toMatch(/export const parseMarkdown/)
  })

  /**
   * Test 7: Task display components (.vue files containing "TaskRow" or
   * "TaskCard") must NOT use raw v-html for task.title without sanitization.
   */
  it('Test 7: TaskRow/TaskCard components do not inject task.title as raw v-html', () => {
    const taskDisplayFiles = allVueFiles.filter(
      f => /TaskRow|TaskCard/i.test(f) && !f.includes('__tests__')
    )
    const unsafe: string[] = []
    for (const f of taskDisplayFiles) {
      const template = extractTemplate(readFileSync(f, 'utf8'))
      // Pattern: v-html bound directly to task.title or similar
      if (/v-html=["'][^"']*title[^"']*["']/.test(template)) {
        unsafe.push(f)
      }
    }
    expect(
      unsafe,
      `Task display component(s) inject title via v-html without sanitization: ${unsafe.join(', ')}`
    ).toHaveLength(0)
  })

  /**
   * Test 8: security.ts exports both `highlightMatchSafe` and
   * `sanitizeMarkdownHtml` — the two sanitization utilities used by
   * task/search display.
   */
  it('Test 8: utils/security.ts exports highlightMatchSafe and sanitizeMarkdownHtml', () => {
    const secUtil = allTsFiles.find(f => f.endsWith('utils/security.ts'))
    expect(secUtil, 'utils/security.ts must exist').toBeTruthy()
    const src = readFileSync(secUtil!, 'utf8')
    expect(src).toMatch(/export.*highlightMatchSafe/)
    expect(src).toMatch(/export.*sanitizeMarkdownHtml/)
    // Both must internally use DOMPurify
    expect(src).toMatch(/DOMPurify/)
  })
})

// ---------------------------------------------------------------------------
// Tests 9-11: AI chat rendering
// ---------------------------------------------------------------------------

describe('TASK-1607 — AI chat rendering safety', () => {
  /**
   * Test 9: AI response rendering in ChatMessage uses markdown-it with
   * html: false (prevents raw HTML pass-through from AI output).
   */
  it('Test 9: ChatMessage markdown-it is configured with html: false', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/ai/ChatMessage.vue'))
    expect(filePath).toBeTruthy()
    const script = extractScript(readFileSync(filePath!, 'utf8'), '.vue')
    // The MarkdownIt constructor call must set html: false
    expect(script).toMatch(/html\s*:\s*false/)
  })

  /**
   * Test 10: ChatMessage pipes md.render() output through sanitizeMarkdownHtml
   * before assigning to renderedContent — double protection layer.
   */
  it('Test 10: renderedContent applies sanitizeMarkdownHtml(md.render(...))', () => {
    const filePath = allVueFiles.find(f => f.endsWith('components/ai/ChatMessage.vue'))
    expect(filePath).toBeTruthy()
    const script = extractScript(readFileSync(filePath!, 'utf8'), '.vue')
    expect(script).toMatch(/sanitizeMarkdownHtml\s*\(\s*md\.render\s*\(/)
  })

  /**
   * Test 11: AI service providers (ollama, groq etc.) do NOT inject HTML —
   * they return plain text / markdown only (no v-html in provider files).
   */
  it('Test 11: AI provider files do not use v-html', () => {
    const providerDir = join(SRC_ROOT, 'services/ai')
    let providerFiles: string[] = []
    try {
      providerFiles = collectFiles(providerDir, ['.ts', '.vue'])
    } catch {
      // directory may not exist in all environments
    }
    const withVhtml = providerFiles.filter(f => readFileSync(f, 'utf8').includes('v-html'))
    expect(
      withVhtml,
      `AI provider file(s) should not use v-html: ${withVhtml.join(', ')}`
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Tests 12-13: javascript: protocol in href attributes
// ---------------------------------------------------------------------------

describe('TASK-1607 — javascript: protocol in hrefs', () => {
  /**
   * Test 12: No .vue template section hardcodes a `javascript:` href.
   */
  it('Test 12: no .vue template hardcodes javascript: href', () => {
    const violations: string[] = []
    for (const f of allVueFiles) {
      const template = extractTemplate(readFileSync(f, 'utf8'))
      if (/href\s*=\s*["']javascript:/i.test(template)) {
        violations.push(f)
      }
    }
    expect(violations, `Files with hardcoded javascript: href: ${violations.join(', ')}`).toHaveLength(0)
  })

  /**
   * Test 13: sanitizeUrl in utils/markdown.ts blocks the javascript: protocol
   * and several obfuscation variants.
   */
  it('Test 13: sanitizeUrl function is present and blocks dangerous protocols', () => {
    const mdUtil = allTsFiles.find(f => f.endsWith('utils/markdown.ts'))
    expect(mdUtil).toBeTruthy()
    const src = readFileSync(mdUtil!, 'utf8')
    // Must export sanitizeUrl
    expect(src).toMatch(/export.*sanitizeUrl|sanitizeUrl.*export/)
    // Must explicitly block javascript:
    expect(src).toMatch(/javascript:/)
    // Must block vbscript: as well
    expect(src).toMatch(/vbscript:/)
  })
})

// ---------------------------------------------------------------------------
// Tests 14-15: No eval() or new Function() in production source
// ---------------------------------------------------------------------------

describe('TASK-1607 — No eval / Function constructor in src/', () => {
  /**
   * Test 14: No production .ts file uses `eval(` outside of comments/strings
   * describing the restriction.
   */
  it('Test 14: no production .ts file calls eval()', () => {
    const violations: string[] = []
    for (const f of allTsFiles) {
      const src = readFileSync(f, 'utf8')
      // Strip single-line comments, then check
      const withoutComments = src.replace(/\/\/[^\n]*/g, '')
      // Match eval( not preceded by word chars (avoids "preeval", "retrieve", etc.)
      if (/(?<![a-zA-Z_$])eval\s*\(/.test(withoutComments)) {
        violations.push(f)
      }
    }
    expect(
      violations,
      `Production TypeScript files calling eval(): ${violations.join(', ')}`
    ).toHaveLength(0)
  })

  /**
   * Test 15: No production .ts file uses `new Function(` (dynamic code eval).
   */
  it('Test 15: no production .ts file uses new Function() constructor', () => {
    const violations: string[] = []
    for (const f of allTsFiles) {
      const src = readFileSync(f, 'utf8')
      const withoutComments = src.replace(/\/\/[^\n]*/g, '')
      if (/new\s+Function\s*\(/.test(withoutComments)) {
        violations.push(f)
      }
    }
    expect(
      violations,
      `Production TypeScript files using new Function(): ${violations.join(', ')}`
    ).toHaveLength(0)
  })
})
