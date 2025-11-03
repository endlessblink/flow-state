#!/usr/bin/env node

/**
 * Standalone CSS validation script
 * Checks for CSS syntax errors and invalid design tokens
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
const srcDir = join(projectRoot, 'src')

class CSSValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  // Find all CSS and SCSS files
  findStyleFiles(dir, files = []) {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        this.findStyleFiles(fullPath, files)
      } else if (item.endsWith('.css') || item.endsWith('.scss')) {
        files.push(fullPath)
      }
    }

    return files
  }

  // Extract CSS from Vue files
  extractCSSFromVueFiles() {
    const vueFiles = []

    function findVueFiles(dir) {
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

    const cssFiles = []

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
  findInvalidCSSVariables(css) {
    const lines = css.split('\n')
    const issues = []

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
              issue: `Invalid CSS variable syntax: ${varMatch.trim()}. CSS variables must start with '--'`,
              suggestion: 'Fix the CSS variable syntax'
            })
          }

          // Check for mismatched parentheses
          const openParens = (varMatch.match(/\(/g) || []).length
          const closeParens = (varMatch.match(/\)/g) || []).length
          if (openParens !== closeParens) {
            issues.push({
              line: lineNumber,
              issue: `Mismatched parentheses in CSS variable: ${varMatch.trim()}`,
              suggestion: 'Fix the parentheses'
            })
          }
        }
      }

      // Check for common CSS syntax errors
      if (line.includes('var-space-')) {
        issues.push({
          line: lineNumber,
          issue: `Invalid CSS variable syntax detected: 'var-space-' should be 'var(--space-)'`,
          suggestion: 'Add missing -- prefix'
        })
      }

      // Check for trailing commas or semicolons in odd places
      if (line.trim().endsWith(',)') || line.trim().endsWith(';)')) {
        issues.push({
          line: lineNumber,
          issue: `Invalid CSS syntax: trailing comma or semicolon before closing parenthesis`,
          suggestion: 'Remove trailing comma/semicolon'
        })
      }
    })

    return issues
  }

  // Check for undefined design tokens
  findUndefinedDesignTokens(css) {
    const varRegex = /var\s*\(\s*--([^)]+)\s*\)/g
    const usedTokens = new Set()
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

  validate() {
    const cssFiles = this.findStyleFiles(srcDir)
    const vueCSSFiles = this.extractCSSFromVueFiles()

    console.log(`🔍 Analyzing ${cssFiles.length + vueCSSFiles.length} CSS files for syntax issues...\n`)

    // Check standalone CSS files
    for (const filePath of cssFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(projectRoot, '')
        const issues = this.findInvalidCSSVariables(content)

        issues.forEach(issue => {
          this.errors.push({
            file: relativePath,
            line: issue.line,
            issue: issue.issue,
            suggestion: issue.suggestion
          })
        })

        // Check for undefined tokens
        const undefinedTokens = this.findUndefinedDesignTokens(content)
        if (undefinedTokens.length > 0) {
          this.warnings.push({
            file: relativePath,
            issue: `Potentially undefined design tokens: ${undefinedTokens.join(', ')}`,
            suggestion: 'Verify these tokens exist in your design system'
          })
        }

      } catch (error) {
        this.errors.push({
          file: filePath.replace(projectRoot, ''),
          line: 0,
          issue: `Failed to read file: ${error.message}`,
          suggestion: 'Check if file is accessible'
        })
      }
    }

    // Check CSS in Vue files
    for (const { filePath, css } of vueCSSFiles) {
      try {
        const relativePath = filePath.replace(projectRoot, '')
        const issues = this.findInvalidCSSVariables(css)

        issues.forEach(issue => {
          this.errors.push({
            file: `${relativePath} (style block)`,
            line: issue.line,
            issue: issue.issue,
            suggestion: issue.suggestion
          })
        })

        // Check for undefined tokens
        const undefinedTokens = this.findUndefinedDesignTokens(css)
        if (undefinedTokens.length > 0) {
          this.warnings.push({
            file: `${relativePath} (style block)`,
            issue: `Potentially undefined design tokens: ${undefinedTokens.join(', ')}`,
            suggestion: 'Verify these tokens exist in your design system'
          })
        }

      } catch (error) {
        this.errors.push({
          file: `${filePath.replace(projectRoot, '')} (style block)`,
          line: 0,
          issue: `Failed to parse CSS: ${error.message}`,
          suggestion: 'Check CSS syntax in Vue file'
        })
      }
    }

    return this.errors.length === 0
  }

  printResults() {
    if (this.errors.length > 0) {
      console.error('🚨 CSS Syntax Errors:')
      this.errors.forEach((error, index) => {
        console.error(`\n${index + 1}. ${error.file}`)
        if (error.line) {
          console.error(`   Line: ${error.line}`)
        }
        console.error(`   Issue: ${error.issue}`)
        console.error(`   Suggestion: ${error.suggestion}`)
      })
      console.error('\n')
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️  CSS Validation Warnings:')
      this.warnings.forEach((warning, index) => {
        console.warn(`\n${index + 1}. ${warning.file}`)
        console.warn(`   Issue: ${warning.issue}`)
        console.warn(`   Suggestion: ${warning.suggestion}`)
      })
      console.warn('\n')
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All CSS syntax is valid!')
    }

    console.log(`📊 Results: ${this.errors.length} errors, ${this.warnings.length} warnings`)
  }
}

// Main execution
function main() {
  const validator = new CSSValidator()
  const isValid = validator.validate()
  validator.printResults()

  // Exit with error code if validation failed
  process.exit(isValid ? 0 : 1)
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { CSSValidator }