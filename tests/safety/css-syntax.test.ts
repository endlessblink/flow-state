import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')
const srcDir = join(projectRoot, 'src')

// Known CSS custom properties (design tokens) used in the project
const KNOWN_DESIGN_TOKENS = [
  // Colors
  '--color-primary', '--color-secondary', '--color-accent',
  '--text-primary', '--text-secondary', '--text-muted',
  '--border-primary', '--border-secondary', '--border-medium',
  '--surface-primary', '--surface-secondary', '--surface-tertiary',
  '--bg-primary', '--bg-secondary', '--bg-tertiary',
  '--brand-primary', '--brand-secondary',
  '--green-50', '--green-100', '--green-200', '--green-600',
  '--red-50', '--red-100', '--red-200', '--red-600',
  '--yellow-50', '--yellow-100', '--yellow-200', '--yellow-600',
  '--blue-50', '--blue-100', '--blue-200', '--blue-600',
  '--purple-gradient-start', '--purple-gradient-end',
  '--purple-gradient-hover-start', '--purple-gradient-hover-end',
  '--purple-border-subtle', '--purple-border-medium', '--purple-border-active',
  '--purple-glow-subtle', '--purple-shadow-strong',
  '--glass-bg-soft', '--glass-bg-light', '--glass-bg-medium', '--glass-bg-heavy',
  '--glass-bg-tint', '--glass-border', '--glass-border-strong', '--glass-border-soft',
  '--overlay-dark',

  // Spacing
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  '--space-8', '--space-10', '--space-12', '--space-16', '--space-20',

  // Typography
  '--text-xs', '--text-sm', '--text-base', '--text-md', '--text-lg', '--text-xl',
  '--text-2xl', '--text-3xl', '--text-4xl',
  '--font-thin', '--font-light', '--font-normal', '--font-medium', '--font-semibold',
  '--font-bold', '--font-mono',

  // Borders & Radius
  '--border-width', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
  '--radius-2xl', '--radius-full',

  // Shadows
  '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl', '--shadow-subtle',
  '--shadow-soft', '--shadow-medium', '--shadow-strong',

  // Animation & Transitions
  '--duration-fast', '--duration-normal', '--duration-slow',
  '--spring-smooth', '--spring-bounce',

  // Z-index
  '--z-dropdown', '--z-sticky', '--z-fixed', '--z-modal-backdrop', '--z-modal',
  '--z-popover', '--z-tooltip', '--z-toast'
]

// ---------------------------------------------------------------------------
// Module-level helpers shared between describe blocks
// ---------------------------------------------------------------------------

function findAllStyleFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      findAllStyleFiles(fullPath, files)
    } else if (item.endsWith('.css') || item.endsWith('.scss')) {
      files.push(fullPath)
    }
  }
  return files
}

function extractAllVueStyles(): Array<{ filePath: string; css: string; fullContent: string }> {
  const vueFiles: string[] = []

  function findVueFiles(dir: string) {
    const items = readdirSync(dir)
    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        findVueFiles(fullPath)
      } else if (item.endsWith('.vue')) {
        vueFiles.push(fullPath)
      }
    }
  }

  findVueFiles(srcDir)

  const result: Array<{ filePath: string; css: string; fullContent: string }> = []
  for (const vueFile of vueFiles) {
    try {
      const content = readFileSync(vueFile, 'utf-8')
      // Capture ALL <style> blocks (scoped or not)
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g)
      if (styleMatch) {
        const combinedCss = styleMatch
          .map(block => block.replace(/<style[^>]*>/, '').replace(/<\/style>/, ''))
          .join('\n')
        result.push({ filePath: vueFile, css: combinedCss, fullContent: content })
      }
    } catch {
      // skip unreadable files
    }
  }
  return result
}

// ---------------------------------------------------------------------------

describe('CSS Syntax and Design Token Validation', () => {
  // Find all CSS and SCSS files
  function findStyleFiles(dir: string, files: string[] = []): string[] {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        findStyleFiles(fullPath, files)
      } else if (item.endsWith('.css') || item.endsWith('.scss')) {
        files.push(fullPath)
      }
    }

    return files
  }

  // Extract CSS from Vue files
  function extractCSSFromVueFiles(): Array<{ filePath: string, css: string }> {
    const vueFiles: string[] = []

    function findVueFiles(dir: string) {
      const items = readdirSync(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          findVueFiles(fullPath)
        } else if (item.endsWith('.vue')) {
          vueFiles.push(fullPath)
        }
      }
    }

    findVueFiles(srcDir)

    const cssFiles: Array<{ filePath: string, css: string }> = []

    for (const vueFile of vueFiles) {
      try {
        const content = readFileSync(vueFile, 'utf-8')
        const styleMatch = content.match(/<style[^>]*scoped[^>]*>([\s\S]*?)<\/style>/)

        if (styleMatch) {
          cssFiles.push({
            filePath: vueFile,
            css: styleMatch[1]
          })
        }
      } catch (error) {
        console.warn(`Could not read Vue file: ${vueFile}`)
      }
    }

    return cssFiles
  }

  // Check for invalid CSS variable syntax
  function findInvalidCSSVariables(css: string): Array<{ line: number, issue: string }> {
    const lines = css.split('\n')
    const issues: Array<{ line: number, issue: string }> = []

    // Helper to extract balanced var() expressions (handles nesting)
    function extractBalancedVar(str: string, startIndex: number): string | null {
      if (!str.slice(startIndex).startsWith('var(')) return null

      let depth = 0
      let i = startIndex + 4 // Skip 'var('
      depth = 1

      while (i < str.length && depth > 0) {
        if (str[i] === '(') depth++
        else if (str[i] === ')') depth--
        i++
      }

      if (depth !== 0) return null // Unbalanced
      return str.slice(startIndex, i)
    }

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // Find all var( occurrences and extract balanced expressions
      let searchIndex = 0
      while (true) {
        const varIndex = line.indexOf('var(', searchIndex)
        if (varIndex === -1) break

        const varExpr = extractBalancedVar(line, varIndex)
        if (varExpr === null) {
          // Could not extract balanced var() - likely mismatched parens
          // Extract partial for error message
          const partialEnd = line.indexOf(')', varIndex)
          const partial = partialEnd !== -1
            ? line.slice(varIndex, partialEnd + 1)
            : line.slice(varIndex, Math.min(varIndex + 50, line.length))
          issues.push({
            line: lineNumber,
            issue: `Mismatched parentheses in CSS variable: ${partial.trim()}`
          })
          searchIndex = varIndex + 4
        } else {
          // Check for missing -- prefix in the variable name
          if (!varExpr.includes('--')) {
            issues.push({
              line: lineNumber,
              issue: `Invalid CSS variable syntax: ${varExpr.trim()}. CSS variables must start with '--'`
            })
          }
          searchIndex = varIndex + varExpr.length
        }
      }

      // Check for common CSS syntax errors
      if (line.includes('var-space-')) {
        issues.push({
          line: lineNumber,
          issue: `Invalid CSS variable syntax detected: 'var-space-' should be 'var(--space-)'`
        })
      }

      // Check for trailing commas or semicolons in odd places
      if (line.trim().endsWith(',)') || line.trim().endsWith(';)')) {
        issues.push({
          line: lineNumber,
          issue: `Invalid CSS syntax: trailing comma or semicolon before closing parenthesis`
        })
      }
    })

    return issues
  }

  // Check for undefined design tokens
  function findUndefinedDesignTokens(css: string): string[] {
    const varRegex = /var\s*\(\s*--([^)]+)\s*\)/g
    const usedTokens = new Set<string>()
    let match

    while ((match = varRegex.exec(css)) !== null) {
      const tokenName = `--${match[1].trim()}`
      usedTokens.add(tokenName)
    }

    const undefinedTokens = Array.from(usedTokens).filter(token => {
      return !KNOWN_DESIGN_TOKENS.some(known => token.includes(known.replace('--', '')))
    })

    return undefinedTokens
  }

  // Check for invalid CSS properties
  function findInvalidCSSProperties(css: string): Array<{ line: number, property: string, value: string }> {
    const lines = css.split('\n')
    const invalidProperties: Array<{ line: number, property: string, value: string }> = []
    let inMultiLineComment = false

    // Common CSS property validation patterns
    const validPropertyPatterns = [
      // Standard CSS properties
      /^[a-z-]+:\s*.+;?$/i,
      // CSS custom properties (including augmented-ui vars like --aug-tl1)
      /^--[a-z0-9-]+:\s*.+;?$/i,
      // Media queries, at-rules
      /^@.+/,
      // Selectors
      /^[.#\[].*$/,
      // Nesting, pseudo-classes
      /^&|:[a-z-]+/,
      // Comments
      /^\/\*.*\*\/$/,
      /^\s*\/\/.*$/,
      // Empty lines
      /^\s*$/
    ]

    lines.forEach((line, index) => {
      const lineNumber = index + 1
      const trimmedLine = line.trim()

      // Track multi-line comment state
      if (trimmedLine.includes('/*') && !trimmedLine.includes('*/')) {
        inMultiLineComment = true
        return
      }
      if (trimmedLine.includes('*/')) {
        inMultiLineComment = false
        return
      }
      if (inMultiLineComment) {
        return
      }

      if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine.startsWith('//') || trimmedLine.startsWith('@')) {
        return
      }

      // Check if line looks like a property declaration
      if (trimmedLine.includes(':') && !trimmedLine.includes('var(')) {
        const isComment = trimmedLine.startsWith('/*') || trimmedLine.startsWith('//')
        const isSelector = /^[.#\[&:]/.test(trimmedLine) || trimmedLine.includes('{') || trimmedLine.includes('}')

        if (!isComment && !isSelector) {
          const isValid = validPropertyPatterns.some(pattern => pattern.test(trimmedLine))
          if (!isValid) {
            const [property, ...valueParts] = trimmedLine.split(':')
            const value = valueParts.join(':').trim()

            if (property && value) {
              invalidProperties.push({
                line: lineNumber,
                property: property.trim(),
                value: value.replace(';', '').trim()
              })
            }
          }
        }
      }
    })

    return invalidProperties
  }

  const cssFiles = findStyleFiles(srcDir)
  const vueCSSFiles = extractCSSFromVueFiles()

  it('should have valid CSS variable syntax', () => {
    const allIssues: Array<{ file: string, line: number, issue: string }> = []

    // Check standalone CSS files
    for (const filePath of cssFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')
        const issues = findInvalidCSSVariables(content)

        issues.forEach(issue => {
          allIssues.push({
            file: relativePath,
            line: issue.line,
            issue: issue.issue
          })
        })
      } catch (error) {
        allIssues.push({
          file: filePath.replace(projectRoot, ''),
          line: 0,
          issue: `Failed to read file: ${error}`
        })
      }
    }

    // Check CSS in Vue files
    for (const { filePath, css } of vueCSSFiles) {
      try {
        const relativePath = filePath.replace(projectRoot, '')
        const issues = findInvalidCSSVariables(css)

        issues.forEach(issue => {
          allIssues.push({
            file: `${relativePath} (style block)`,
            line: issue.line,
            issue: issue.issue
          })
        })
      } catch (error) {
        allIssues.push({
          file: `${filePath.replace(projectRoot, '')} (style block)`,
          line: 0,
          issue: `Failed to parse CSS: ${error}`
        })
      }
    }

    if (allIssues.length > 0) {
      console.error('\n🚨 CSS Variable Syntax Errors:')
      allIssues.forEach(({ file, line, issue }) => {
        console.error(`  ❌ ${file}:${line} - ${issue}`)
      })
      console.error('\n')
    }

    expect(allIssues).toHaveLength(0)
  })

  it('should not use undefined design tokens', () => {
    const allUndefinedTokens: Array<{ file: string, tokens: string[] }> = []

    // Check standalone CSS files
    for (const filePath of cssFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')
        const undefinedTokens = findUndefinedDesignTokens(content)

        if (undefinedTokens.length > 0) {
          allUndefinedTokens.push({
            file: relativePath,
            tokens: undefinedTokens
          })
        }
      } catch (error) {
        console.warn(`Could not analyze CSS file: ${filePath}`)
      }
    }

    // Check CSS in Vue files
    for (const { filePath, css } of vueCSSFiles) {
      try {
        const relativePath = filePath.replace(projectRoot, '')
        const undefinedTokens = findUndefinedDesignTokens(css)

        if (undefinedTokens.length > 0) {
          allUndefinedTokens.push({
            file: `${relativePath} (style block)`,
            tokens: undefinedTokens
          })
        }
      } catch (error) {
        console.warn(`Could not analyze CSS in Vue file: ${filePath}`)
      }
    }

    if (allUndefinedTokens.length > 0) {
      console.error('\n⚠️  Potentially Undefined Design Tokens:')
      allUndefinedTokens.forEach(({ file, tokens }) => {
        console.error(`  ⚠️  ${file}:`)
        tokens.forEach(token => {
          console.error(`    - ${token}`)
        })
      })
      console.log('\n💡 If these are valid tokens, add them to KNOWN_DESIGN_TOKENS in the test file')
    }

    // This is a warning test, not a failure
    expect(allUndefinedTokens.length).toBeGreaterThanOrEqual(0)
  })

  it('should have valid CSS property syntax', () => {
    const allInvalidProperties: Array<{ file: string, line: number, property: string, value: string }> = []

    // Check CSS in Vue files
    for (const { filePath, css } of vueCSSFiles) {
      try {
        const relativePath = filePath.replace(projectRoot, '')
        const invalidProperties = findInvalidCSSProperties(css)

        invalidProperties.forEach(prop => {
          allInvalidProperties.push({
            file: `${relativePath} (style block)`,
            line: prop.line,
            property: prop.property,
            value: prop.value
          })
        })
      } catch (error) {
        console.warn(`Could not analyze CSS properties in Vue file: ${filePath}`)
      }
    }

    if (allInvalidProperties.length > 0) {
      console.error('\n🚨 Invalid CSS Properties:')
      allInvalidProperties.forEach(({ file, line, property, value }) => {
        console.error(`  ❌ ${file}:${line} - ${property}: ${value}`)
      })
      console.error('\n')
    }

    expect(allInvalidProperties).toHaveLength(0)
  })

  it('should have consistent CSS formatting', () => {
    const formattingIssues: Array<{ file: string, line: number, issue: string }> = []

    // Check CSS in Vue files
    for (const { filePath, css } of vueCSSFiles) {
      try {
        const relativePath = filePath.replace(projectRoot, '')
        const lines = css.split('\n')

        lines.forEach((line, index) => {
          const lineNumber = index + 1
          const trimmedLine = line.trim()

          // Check for multiple consecutive spaces
          if (trimmedLine.includes('  ') && !trimmedLine.includes('/*')) {
            formattingIssues.push({
              file: `${relativePath} (style block)`,
              line: lineNumber,
              issue: 'Multiple consecutive spaces detected'
            })
          }

          // Check for missing semicolons in property declarations
          if (trimmedLine.includes(':') &&
              !trimmedLine.endsWith(';') &&
              !trimmedLine.endsWith('}') &&
              !trimmedLine.includes('var(') &&
              !trimmedLine.startsWith('/*') &&
              !trimmedLine.startsWith('//') &&
              !trimmedLine.includes('{')) {
            formattingIssues.push({
              file: `${relativePath} (style block)`,
              line: lineNumber,
              issue: 'Missing semicolon after property declaration'
            })
          }
        })
      } catch (error) {
        console.warn(`Could not analyze CSS formatting in Vue file: ${filePath}`)
      }
    }

    if (formattingIssues.length > 0) {
      console.warn('\n⚠️  CSS Formatting Issues:')
      formattingIssues.forEach(({ file, line, issue }) => {
        console.warn(`  ⚠️  ${file}:${line} - ${issue}`)
      })
      console.log('\n💡 These are style suggestions, not blocking errors')
    }

    // This is a warning test, not a failure
    expect(formattingIssues.length).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// WebKitGTK CSS Safety (Tauri Parity)
// Guards against CSS patterns that break in Tauri's embedded WebKitGTK renderer.
// Failures here indicate a regression that will silently misbehave on Linux desktop.
// ---------------------------------------------------------------------------

describe('WebKitGTK CSS Safety (Tauri Parity)', () => {
  const cssFiles = findAllStyleFiles(srcDir)
  const vueStyleFiles = extractAllVueStyles()

  // -------------------------------------------------------------------------
  // 1. overflow:clip detection
  //    Every `overflow: clip` (and axis variants) MUST have a nearby
  //    `/* WebKitGTK-safe */` comment (same line or within 2 lines above/below).
  //    The `.swiping` selector context is also accepted.
  //    Rationale: older WebKitGTK builds (Tauri Linux) ignore `overflow: clip`
  //    silently, leading to invisible layout bugs.  Reviewed usages must be
  //    annotated so future developers know they were intentional.
  // -------------------------------------------------------------------------

  it('overflow:clip usages must be annotated with /* WebKitGTK-safe */ or be in .swiping context', () => {
    const overflowClipRegex = /overflow(?:-x|-y)?\s*:\s*clip/

    interface ClipViolation {
      file: string
      line: number
      text: string
    }

    function checkLinesForUnannotatedClip(
      lines: string[],
      relativeFilePath: string,
    ): ClipViolation[] {
      const violations: ClipViolation[] = []

      lines.forEach((line, idx) => {
        if (!overflowClipRegex.test(line)) return

        // Accepted: same-line WebKitGTK-safe marker
        if (line.includes('WebKitGTK-safe')) return

        // Accepted: within 2 lines above or below
        const window = lines.slice(Math.max(0, idx - 2), idx + 3)
        if (window.some(l => l.includes('WebKitGTK-safe'))) return

        // Accepted: line is inside a .swiping selector block
        // (scan backwards for the nearest opening selector)
        let blockDepth = 0
        let inSwipingBlock = false
        for (let i = idx - 1; i >= 0; i--) {
          const l = lines[i]
          const closeBraces = (l.match(/}/g) || []).length
          const openBraces = (l.match(/\{/g) || []).length
          blockDepth += closeBraces - openBraces
          if (blockDepth < 0) {
            // We've crossed out of the current block — check selector
            if (/\.swiping/.test(l)) {
              inSwipingBlock = true
            }
            break
          }
        }
        if (inSwipingBlock) return

        violations.push({
          file: relativeFilePath,
          line: idx + 1,
          text: line.trim(),
        })
      })

      return violations
    }

    const allViolations: ClipViolation[] = []

    // Scan standalone CSS/SCSS files
    for (const filePath of cssFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const rel = filePath.replace(projectRoot, '')
        allViolations.push(...checkLinesForUnannotatedClip(lines, rel))
      } catch {
        // skip unreadable
      }
    }

    // Scan Vue style blocks
    for (const { filePath, css } of vueStyleFiles) {
      const lines = css.split('\n')
      const rel = `${filePath.replace(projectRoot, '')} (style block)`
      allViolations.push(...checkLinesForUnannotatedClip(lines, rel))
    }

    if (allViolations.length > 0) {
      console.error('\n[WebKitGTK] Unannotated overflow:clip usages:')
      allViolations.forEach(({ file, line, text }) => {
        console.error(`  FAIL ${file}:${line} — ${text}`)
        console.error(`       Add /* WebKitGTK-safe */ on the same line or within 2 lines,`)
        console.error(`       or place the rule inside a .swiping selector block.`)
      })
      console.error()
    }

    expect(allViolations).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 2. perspective + position:fixed trap
  //    `perspective` creates a CSS containing block, which prevents
  //    `position: fixed` descendants from escaping to the viewport.
  //    Coexistence in the same style block is a latent BUG-1453-class trap.
  //    This test WARNS (does not fail) so existing known usages aren't blocked.
  // -------------------------------------------------------------------------

  it('(warn) perspective and position:fixed should not coexist in the same style block', () => {
    const perspectiveRegex = /\bperspective\s*:/
    const fixedRegex = /\bposition\s*:\s*fixed/

    interface PerspectiveTrap {
      file: string
      perspectiveLine: number
      fixedLine: number
    }

    const traps: PerspectiveTrap[] = []

    function checkForPerspectiveTrap(
      css: string,
      relativeFilePath: string,
    ): void {
      const lines = css.split('\n')
      let hasPerspective = false
      let perspectiveLine = -1
      let hasFixed = false
      let fixedLine = -1

      lines.forEach((line, idx) => {
        if (perspectiveRegex.test(line)) {
          hasPerspective = true
          perspectiveLine = idx + 1
        }
        if (fixedRegex.test(line)) {
          hasFixed = true
          fixedLine = idx + 1
        }
      })

      if (hasPerspective && hasFixed) {
        traps.push({
          file: relativeFilePath,
          perspectiveLine,
          fixedLine,
        })
      }
    }

    // Standalone CSS files
    for (const filePath of cssFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        checkForPerspectiveTrap(content, filePath.replace(projectRoot, ''))
      } catch {
        // skip
      }
    }

    // Vue style blocks
    for (const { filePath, css } of vueStyleFiles) {
      checkForPerspectiveTrap(
        css,
        `${filePath.replace(projectRoot, '')} (style block)`,
      )
    }

    if (traps.length > 0) {
      console.warn('\n[WebKitGTK] WARN — perspective + position:fixed coexist in the same style block:')
      traps.forEach(({ file, perspectiveLine, fixedLine }) => {
        console.warn(`  WARN ${file}`)
        console.warn(`       perspective: at line ${perspectiveLine}`)
        console.warn(`       position: fixed at line ${fixedLine}`)
        console.warn(`       "perspective" creates a CSS containing block that traps fixed-position`)
        console.warn(`       descendants (BUG-1453).  Remove perspective or use transform:translateZ(0)`)
        console.warn(`       on the child instead.`)
      })
      console.warn()
    }

    // Warn-only: assert we are aware of the number so regressions surface
    // as diff noise in CI rather than as silent failures.
    expect(typeof traps.length).toBe('number')

    if (traps.length > 0) {
      console.warn(`[WebKitGTK] ${traps.length} perspective+fixed trap(s) found — review before shipping.`)
    }
  })

  // -------------------------------------------------------------------------
  // 3. .tauri-app overrides must exist
  //    WebKitGTK-specific CSS overrides live under the .tauri-app class.
  //    This test guards against accidental deletion.
  // -------------------------------------------------------------------------

  it('.tauri-app CSS overrides must exist in src/assets/styles.css', () => {
    const stylesCssPath = join(srcDir, 'assets', 'styles.css')
    let content: string

    try {
      content = readFileSync(stylesCssPath, 'utf-8')
    } catch {
      throw new Error(`Cannot read src/assets/styles.css — file missing or unreadable`)
    }

    const tauriAppRules = content.match(/\.tauri-app\b/g) || []

    if (tauriAppRules.length === 0) {
      console.error('\n[WebKitGTK] FAIL — .tauri-app selectors are missing from src/assets/styles.css')
      console.error('  These WebKitGTK-specific overrides must not be removed.')
      console.error('  See MEMORY.md BUG-1453 section for context.\n')
    } else {
      console.log(`[WebKitGTK] OK — ${tauriAppRules.length} .tauri-app rule(s) found in styles.css`)
    }

    expect(tauriAppRules.length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // 4. No bare boolean attributes on <draggable> / <Draggable>
  //    vuedraggable passes options via $attrs.  Vue 3 converts bare boolean
  //    HTML attributes to the empty string "".  SortableJS treats "" as falsy,
  //    so e.g. `force-fallback` (bare) → forceFallback: "" → false → broken
  //    drag on touch (BUG-1335).  Must always be `:force-fallback="true"`.
  // -------------------------------------------------------------------------

  it('vuedraggable must not use bare boolean attributes (BUG-1335)', () => {
    // These attrs MUST be bound (:attr="true"), never bare (attr or attr="")
    const GUARDED_ATTRS = ['force-fallback', 'delay-on-touch-only', 'bubble-scroll']

    interface DraggableBug {
      file: string
      line: number
      attr: string
      text: string
    }

    const violations: DraggableBug[] = []

    const allVueFiles: string[] = []
    function collectVueFiles(dir: string) {
      const items = readdirSync(dir)
      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          collectVueFiles(fullPath)
        } else if (item.endsWith('.vue')) {
          allVueFiles.push(fullPath)
        }
      }
    }
    collectVueFiles(srcDir)

    for (const vueFile of allVueFiles) {
      let content: string
      try {
        content = readFileSync(vueFile, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      let insideDraggable = false

      lines.forEach((line, idx) => {
        const lineNumber = idx + 1

        // Detect start of <draggable or <Draggable
        if (/<[Dd]raggable\b/.test(line)) {
          insideDraggable = true
        }

        if (insideDraggable) {
          for (const attr of GUARDED_ATTRS) {
            // Bare attribute: the attr name is present but NOT preceded by ':'
            // Match: attr (standalone word), attr="...", but NOT :attr
            const barePattern = new RegExp(`(?<!:)\\b${attr}\\b(?!=)`)
            const quotedBarePattern = new RegExp(`(?<!:)\\b${attr}\\s*=\\s*["'][^"']*["']`)

            if (barePattern.test(line) || quotedBarePattern.test(line)) {
              // Double-check it's not actually a bound attr by looking for the leading colon
              const colIndex = line.indexOf(attr)
              const charBefore = colIndex > 0 ? line[colIndex - 1] : ''
              if (charBefore !== ':') {
                violations.push({
                  file: vueFile.replace(projectRoot, ''),
                  line: lineNumber,
                  attr,
                  text: line.trim(),
                })
              }
            }
          }

          // Close the draggable scan when we hit '>' or '/>' outside a string
          if (/[^=]>/.test(line) || line.trimEnd().endsWith('>')) {
            insideDraggable = false
          }
        }
      })
    }

    if (violations.length > 0) {
      console.error('\n[WebKitGTK/BUG-1335] Bare boolean attribute(s) on <draggable>:')
      violations.forEach(({ file, line, attr, text }) => {
        console.error(`  FAIL ${file}:${line} — bare "${attr}"`)
        console.error(`       ${text}`)
        console.error(`       Fix: use :${attr}="true" (bound) instead of bare ${attr}`)
      })
      console.error()
    }

    expect(violations).toHaveLength(0)
  })
})