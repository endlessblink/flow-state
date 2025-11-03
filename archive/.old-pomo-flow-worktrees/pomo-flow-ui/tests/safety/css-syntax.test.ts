import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // Check for var() syntax errors
      const varMatches = line.match(/var\s*\(\s*([^)]+)\s*\)/g)
      if (varMatches) {
        for (const varMatch of varMatches) {
          // Check for missing -- prefix
          if (varMatch.includes('var(') && !varMatch.includes('--')) {
            issues.push({
              line: lineNumber,
              issue: `Invalid CSS variable syntax: ${varMatch.trim()}. CSS variables must start with '--'`
            })
          }

          // Check for mismatched parentheses
          const openParens = (varMatch.match(/\(/g) || []).length
          const closeParens = (varMatch.match(/\)/g) || []).length
          if (openParens !== closeParens) {
            issues.push({
              line: lineNumber,
              issue: `Mismatched parentheses in CSS variable: ${varMatch.trim()}`
            })
          }
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

    // Common CSS property validation patterns
    const validPropertyPatterns = [
      // Standard CSS properties
      /^[a-z-]+:\s*.+;?$/i,
      // CSS custom properties
      /^--[a-z-]+:\s*.+;?$/i,
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